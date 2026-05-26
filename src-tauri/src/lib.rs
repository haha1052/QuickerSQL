use std::fs::File;
use std::io::Read;
use std::path::PathBuf;
use std::sync::{Mutex, Arc};
use std::panic::catch_unwind;
use tauri::State;

pub mod project;
pub mod database;

use project::ProjectManager;
use database::{DatabaseManager, SqliteDriver, DuckDbDriver, DatabaseError, SharedDatabaseManager};
use database::traits::DatabaseDriver;

#[derive(serde::Serialize)]
pub struct DatabaseStatus {
    pub db_type: String,
    pub tables: Vec<String>,
    pub row_count: Vec<(String, i64)>,
    pub is_connected: bool,
}

#[derive(serde::Serialize)]
pub struct SqlStatementResult {
    pub statement: String,
    pub success: bool,
    pub error: Option<String>,
    pub columns: Option<Vec<String>>,
    pub rows: Option<Vec<Vec<String>>>,
    pub affected_rows: Option<u64>,
}

#[derive(serde::Serialize)]
pub struct BatchExecuteResult {
    pub results: Vec<SqlStatementResult>,
    pub success_count: usize,
    pub fail_count: usize,
}

#[derive(serde::Serialize)]
pub struct ProjectInfo {
    pub name: String,
    pub db_path: String,
}

struct AppState {
    db_manager: SharedDatabaseManager,
    db_path: Mutex<PathBuf>,
    duckdb_conn: Mutex<Option<Arc<Mutex<Box<dyn database::DatabaseConnection>>>>>,
    temp_file: Mutex<Option<tempfile::NamedTempFile>>,
}

impl AppState {
    fn new() -> Self {
        let mut db_manager = DatabaseManager::new();
        db_manager.register_driver(Box::new(SqliteDriver::new()));

        let db_path = match ProjectManager::get_default_db_path() {
            Ok(path) => path,
            Err(_) => std::env::temp_dir().join("la_duck_temp.db"),
        };

        let manager = Arc::new(db_manager);
        let state = AppState {
            db_manager: manager.clone(),
            db_path: Mutex::new(db_path.clone()),
            duckdb_conn: Mutex::new(None),
            temp_file: Mutex::new(None),
        };

        let _ = Self::connect_default_db(&manager, &state.db_path.lock().unwrap());
        let _ = state.init_duckdb(&db_path);

        state
    }

    fn connect_default_db(db_manager: &SharedDatabaseManager, db_path: &PathBuf) -> Result<(), String> {
        match db_manager.connect("sqlite", db_path) {
            Ok(_) => Ok(()),
            Err(DatabaseError::FileNotFound) => {
                db_manager.create_and_connect("sqlite", db_path).map_err(|e| e.to_string())
            }
            Err(e) => Err(e.to_string()),
        }
    }

    fn set_db_path(&self, new_path: PathBuf) -> Result<(), String> {
        // 1. 清理旧的连接和临时文件
        {
            let mut duckdb_guard = self.duckdb_conn.lock()
                .map_err(|e| format!("获取连接锁失败: {}", e))?;
            let mut temp_guard = self.temp_file.lock()
                .map_err(|e| format!("获取临时文件锁失败: {}", e))?;
            
            *duckdb_guard = None;
            *temp_guard = None;
        }
        
        // 2. 更新路径
        let mut path = self.db_path.lock().map_err(|e| format!("获取路径锁失败: {}", e))?;
        *path = new_path.clone();
        drop(path);

        // 3. 初始化新连接
        match self.init_duckdb(&new_path) {
            Ok(_) => Ok(()),
            Err(e) => {
                log::warn!("初始化 DuckDB 失败: {}, 将继续使用 SQLite", e);
                // 确保清理
                {
                    let mut duckdb_guard = self.duckdb_conn.lock()
                        .map_err(|e| format!("获取连接锁失败: {}", e))?;
                    let mut temp_guard = self.temp_file.lock()
                        .map_err(|e| format!("获取临时文件锁失败: {}", e))?;
                    *duckdb_guard = None;
                    *temp_guard = None;
                }
                Ok(())
            }
        }
    }

    fn init_duckdb(&self, sqlite_path: &PathBuf) -> Result<(), String> {
        use tempfile::NamedTempFile;

        let temp_file = NamedTempFile::new()
            .map_err(|e| format!("创建临时文件失败: {}", e))?;
        let driver = DuckDbDriver::new();

        let conn = driver.create_database(temp_file.path())
            .map_err(|e| format!("创建 DuckDB 连接失败: {}", e))?;

        // 1. ATTACH SQLite 数据库
        let sqlite_path_str = sqlite_path.to_string_lossy().replace("\\", "\\\\");
        let attach_sql = format!("ATTACH '{}' AS sqlite_db (TYPE SQLITE);", sqlite_path_str);

        conn.execute(&attach_sql, &[])
            .map_err(|e| format!("ATTACH SQLite 失败: {}", e))?;

        // 2. 获取所有表名
        let get_tables_sql = "
            SELECT name 
            FROM sqlite_db.sqlite_master 
            WHERE type='table' 
            AND name NOT LIKE 'sqlite_%'
            AND name NOT LIKE 'duckdb_%'
        ";
        
        let table_names: Vec<String> = match conn.query(get_tables_sql, &[]) {
            Ok(result) => result.rows.into_iter()
                .filter(|row| !row.is_empty())
                .map(|row| row[0].clone())
                .collect(),
            Err(e) => {
                log::warn!("获取表名失败: {}", e);
                Vec::new()
            }
        };

        // 3. 为每个表创建 VIEW
        let mut success_count = 0;
        for table_name in &table_names {
            use crate::database::SqlIdentifier;
            
            // 验证表名安全
            if !SqlIdentifier::is_safe_identifier(table_name) {
                log::warn!("跳过不安全的表名: {}", table_name);
                continue;
            }
            
            // 创建 VIEW 的 SQL
            let quoted_table = SqlIdentifier::quote_identifier(table_name);
            let create_view_sql = format!(
                "CREATE OR REPLACE VIEW {} AS SELECT * FROM sqlite_db.{}",
                quoted_table,
                quoted_table
            );
            
            // 执行创建 VIEW
            if let Err(e) = conn.execute(&create_view_sql, &[]) {
                log::warn!("为表 '{}' 创建 VIEW 失败: {}", table_name, e);
            } else {
                log::debug!("为表 '{}' 成功创建 VIEW", table_name);
                success_count += 1;
            }
        }

        // 4. 设置其他配置
        conn.execute("SET preserve_insertion_order = false;", &[])
            .map_err(|e| format!("设置 DuckDB 配置失败: {}", e))?;

        // 5. 保存临时文件和连接
        *self.temp_file.lock().map_err(|e| format!("获取锁失败: {}", e))? = Some(temp_file);
        *self.duckdb_conn.lock().map_err(|e| format!("获取锁失败: {}", e))? = Some(Arc::new(Mutex::new(conn)));

        log::info!(
            "DuckDB 初始化完成，已 ATTACH SQLite 并创建 {}/{} 个 VIEW: {}",
            success_count, table_names.len(), sqlite_path.display()
        );
        Ok(())
    }

    fn get_duckdb_connection(&self) -> Result<Arc<Mutex<Box<dyn database::DatabaseConnection>>>, String> {
        let duckdb_opt = self.duckdb_conn.lock().map_err(|e| format!("获取锁失败: {}", e))?;
        duckdb_opt.clone().ok_or_else(|| "DuckDB 连接未初始化".to_string())
    }
}

fn try_decode_all_encodings(data: &[u8]) -> String {
    if let Ok(text) = std::str::from_utf8(data) {
        return text.to_string();
    }
    let (text, _) = encoding_rs::GBK.decode_without_bom_handling(data);
    text.to_string()
}

struct CsvRow {
    fields: Vec<String>,
}

impl CsvRow {
    fn parse(line: &str) -> Option<Self> {
        let mut fields = Vec::new();
        let mut current = String::new();
        let mut in_quotes = false;
        let mut chars = line.chars().peekable();

        while let Some(c) = chars.next() {
            match (c, in_quotes) {
                ('"', true) => {
                    if chars.peek() == Some(&'"') {
                        current.push('"');
                        chars.next();
                    } else {
                        in_quotes = false;
                    }
                }
                ('"', false) => {
                    in_quotes = true;
                }
                (',', false) => {
                    fields.push(std::mem::take(&mut current));
                }
                _ => {
                    current.push(c);
                }
            }
        }
        fields.push(current);
        Some(CsvRow { fields })
    }
}

#[derive(serde::Serialize, specta::Type)]
pub struct SheetInfo {
    name: String,
    row_count: usize,
    column_count: usize,
}

#[derive(serde::Serialize, specta::Type)]
pub struct ExcelPreview {
    sheets: Vec<SheetInfo>,
    active_sheet_preview: Option<CsvPreview>,
}

#[derive(serde::Serialize, specta::Type)]
pub struct CsvPreview {
    headers: Vec<String>,
    rows: Vec<Vec<String>>,
}

const MAX_EXCEL_FILE_SIZE: u64 = 50 * 1024 * 1024;
const MAX_PREVIEW_ROWS: usize = 100;

pub fn get_excel_sheets_impl(file_path: &str) -> Result<ExcelPreview, String> {
    use calamine::{open_workbook_auto, Reader};
    
    log::info!("开始读取Excel文件: {}", file_path);
    
    let path = std::path::Path::new(file_path);
    if !path.exists() {
        log::warn!("Excel文件不存在: {}", file_path);
        return Err(format!("文件不存在: {}", file_path));
    }
    
    match std::fs::metadata(path) {
        Ok(metadata) => {
            if metadata.len() > MAX_EXCEL_FILE_SIZE {
                log::warn!("Excel文件过大: {} bytes", metadata.len());
                return Err(format!("文件大小超过限制（最大{}MB）", MAX_EXCEL_FILE_SIZE / 1024 / 1024));
            }
        }
        Err(e) => {
            log::warn!("无法获取文件元数据: {}", e);
            return Err(format!("无法访问文件: {}", e));
        }
    }
    
    let mut workbook = open_workbook_auto(file_path)
        .map_err(|e| {
            let error_msg = e.to_string();
            log::error!("打开Excel文件失败: {}", error_msg);
            if error_msg.to_lowercase().contains("password") || 
               error_msg.to_lowercase().contains("encrypted") {
                "Excel文件已加密，请先解密".to_string()
            } else {
                format!("无法打开Excel文件: {}", e)
            }
        })?;
    
    let mut sheets = Vec::new();
    let mut active_sheet_preview = None;
    
    let sheet_names = workbook.sheet_names().to_vec();
    
    if sheet_names.is_empty() {
        log::warn!("Excel文件为空，没有工作表: {}", file_path);
        return Err("Excel文件为空，没有工作表".to_string());
    }
    
    for sheet_name in sheet_names {
        match workbook.worksheet_range(&sheet_name) {
            Ok(range) => {
                let row_count = range.rows().len();
                
                if let (Some((_start_row, start_col)), Some((_end_row, end_col))) = (range.start(), range.end()) {
                    let column_count = (end_col - start_col + 1) as usize;
                
                    sheets.push(SheetInfo {
                        name: sheet_name.clone(),
                        row_count,
                        column_count,
                    });
                    
                    if active_sheet_preview.is_none() {
                        active_sheet_preview = Some(extract_excel_preview(&range));
                    }
                }
            }
            Err(e) => {
                log::warn!("无法读取Sheet '{}': {}", sheet_name, e);
            }
        }
    }
    
    if sheets.is_empty() {
        log::error!("无法读取任何工作表: {}", file_path);
        return Err("无法读取任何工作表，请检查文件是否损坏".to_string());
    }
    
    log::info!("成功读取Excel文件，共 {} 个Sheet", sheets.len());
    Ok(ExcelPreview { sheets, active_sheet_preview })
}

pub fn load_excel_sheet_impl(file_path: &str, sheet_name: &str) -> Result<CsvPreview, String> {
    use calamine::{open_workbook_auto, Reader};
    
    log::info!("开始加载Excel Sheet: {} from {}", sheet_name, file_path);
    
    let path = std::path::Path::new(file_path);
    if !path.exists() {
        log::warn!("Excel文件不存在: {}", file_path);
        return Err(format!("文件不存在: {}", file_path));
    }
    
    match std::fs::metadata(path) {
        Ok(metadata) => {
            if metadata.len() > MAX_EXCEL_FILE_SIZE {
                log::warn!("Excel文件过大: {} bytes", metadata.len());
                return Err(format!("文件大小超过限制（最大{}MB）", MAX_EXCEL_FILE_SIZE / 1024 / 1024));
            }
        }
        Err(e) => {
            log::warn!("无法获取文件元数据: {}", e);
            return Err(format!("无法访问文件: {}", e));
        }
    }
    
    let mut workbook = open_workbook_auto(file_path)
        .map_err(|e| {
            let error_msg = e.to_string();
            log::error!("打开Excel文件失败: {}", error_msg);
            if error_msg.to_lowercase().contains("password") || 
               error_msg.to_lowercase().contains("encrypted") {
                "Excel文件已加密，请先解密".to_string()
            } else {
                format!("无法打开Excel文件: {}", e)
            }
        })?;
    
    let range = workbook.worksheet_range(sheet_name)
        .map_err(|e| {
            log::error!("无法读取Sheet '{}': {}", sheet_name, e);
            format!("无法读取Sheet '{}': {}", sheet_name, e)
        })?;
    
    log::info!("成功加载Sheet '{}'", sheet_name);
    Ok(extract_excel_preview(&range))
}

fn extract_excel_preview(range: &calamine::Range<calamine::Data>) -> CsvPreview {
    let mut headers = Vec::new();
    let mut rows = Vec::new();
    
    for (i, row) in range.rows().enumerate() {
        let fields: Vec<String> = row
            .iter()
            .map(|cell| cell.to_string())
            .collect();
        
        if i == 0 {
            headers = fields;
        } else if i <= MAX_PREVIEW_ROWS {
            rows.push(fields);
        }
    }
    
    CsvPreview { headers, rows }
}

#[derive(serde::Deserialize)]
struct FieldMeta {
    name: String,
    dataType: String,
}

#[derive(serde::Deserialize)]
struct ImportRequest {
    rows: Vec<Vec<String>>,
    table_name: String,
    fields: Vec<FieldMeta>,
}

#[derive(serde::Deserialize)]
struct ImportRequestV2 {
    file_path: String,
    sheet_name: Option<String>,
    table_name: String,
    has_header: bool,
    fields: Vec<FieldMeta>,
}

#[derive(serde::Serialize)]
struct DatabaseInfo {
    db_type: String,
    name: String,
    is_available: bool,
    description: String,
}

#[tauri::command]
fn list_databases(_state: State<AppState>) -> Vec<DatabaseInfo> {
    vec![
        DatabaseInfo {
            db_type: "sqlite".to_string(),
            name: "SQLite".to_string(),
            is_available: true,
            description: "轻量级本地数据库".to_string(),
        },
    ]
}

#[tauri::command]
fn get_database_status(state: State<AppState>) -> Result<DatabaseStatus, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| e.to_string())?;

    let result = conn.query(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
        &[]
    ).map_err(|e| e.to_string())?;

    let tables: Vec<String> = result.rows.into_iter()
        .filter(|row| !row.is_empty())
        .map(|row| row[0].clone())
        .collect();

    let mut row_count = Vec::new();
    for table in &tables {
        let count_query = format!("SELECT COUNT(*) FROM \"{}\"", table);
        if let Ok(count_result) = conn.query(&count_query, &[]) {
            if let Some(count_row) = count_result.rows.first() {
                if let Ok(count) = count_row[0].parse::<i64>() {
                    row_count.push((table.clone(), count));
                }
            }
        }
    }

    Ok(DatabaseStatus {
        db_type: conn.get_database_type().to_string(),
        tables,
        row_count,
        is_connected: true,
    })
}

#[tauri::command]
fn get_all_database_status(state: State<AppState>) -> Vec<DatabaseStatus> {
    let mut results = Vec::new();
    if let Ok(status) = get_database_status(state) {
        results.push(status);
    }
    results
}

#[tauri::command]
fn load_csv(_state: State<AppState>, file_path: String) -> Result<CsvPreview, String> {
    let mut file = File::open(&file_path)
        .map_err(|e| format!("无法打开文件: {}", e))?;

    let mut data = Vec::new();
    file.read_to_end(&mut data)
        .map_err(|e| format!("无法读取文件: {}", e))?;

    let text = try_decode_all_encodings(&data);

    let lines: Vec<&str> = text.lines().collect();
    if lines.is_empty() {
        return Err("文件为空".to_string());
    }

    let header_line = lines[0];
    let headers = CsvRow::parse(header_line)
        .ok_or("无法解析表头行")?
        .fields;

    let mut rows = Vec::new();
    for (i, line) in lines.iter().skip(1).enumerate() {
        if i >= 100 {
            break;
        }
        if line.trim().is_empty() {
            continue;
        }
        if let Some(row) = CsvRow::parse(line) {
            rows.push(row.fields);
        }
    }

    Ok(CsvPreview { headers, rows })
}

#[tauri::command]
fn get_excel_sheets(file_path: String) -> Result<ExcelPreview, String> {
    get_excel_sheets_impl(&file_path)
}

#[tauri::command]
fn load_excel_sheet(file_path: String, sheet_name: String) -> Result<CsvPreview, String> {
    load_excel_sheet_impl(&file_path, &sheet_name)
}

#[tauri::command]
fn import_data(state: State<AppState>, request: ImportRequest) -> Result<String, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| e.to_string())?;
    let safe_table_name = request.table_name.replace(' ', "_");

    conn.execute(&format!("DROP TABLE IF EXISTS \"{}\"", safe_table_name), &[])
        .map_err(|e| e.to_string())?;

    let mut create_sql = format!("CREATE TABLE \"{}\" (", safe_table_name);
    let mut column_defs = Vec::new();
    let mut column_names = Vec::new();

    for field in &request.fields {
        let safe_field_name: String = field.name.chars()
            .map(|c| if c.is_alphanumeric() || c == '_' || ('\u{4e00}' <= c && c <= '\u{9fff}') { c } else { '_' })
            .collect();
        let safe_field_name = if safe_field_name.trim().is_empty() || safe_field_name.chars().all(|c| c == '_') {
            format!("column_{}", column_names.len() + 1)
        } else {
            safe_field_name
        };
        let safe_field_name = if safe_field_name.chars().next().map(|c| c.is_ascii_digit()).unwrap_or(false) {
            format!("col_{}", safe_field_name)
        } else {
            safe_field_name
        };
        let data_type = match field.dataType.to_uppercase().as_str() {
            "INTEGER" => "INTEGER",
            "REAL" => "REAL",
            "BOOLEAN" => "BOOLEAN",
            "DATE" => "TEXT",
            _ => "TEXT"
        };
        column_defs.push(format!("\"{}\" {}", safe_field_name, data_type));
        column_names.push(safe_field_name);
    }

    create_sql.push_str(&column_defs.join(", "));
    create_sql.push(')');

    conn.execute(&create_sql, &[]).map_err(|e| e.to_string())?;

    let col_refs: Vec<&str> = column_names.iter().map(|s| s.as_str()).collect();
    let count = conn.batch_insert(
        &safe_table_name,
        &col_refs,
        &request.rows,
        1000
    ).map_err(|e| e.to_string())?;

    Ok(format!("成功导入 {} 行到 {} 表 '{}'", count, conn.get_database_type(), safe_table_name))
}

#[tauri::command]
fn import_data_v2(state: State<AppState>, request: ImportRequestV2) -> Result<String, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| e.to_string())?;
    let safe_table_name = request.table_name.replace(' ', "_");

    let db_path = state.db_path.lock().map_err(|e| format!("获取数据库路径失败: {}", e))?;
    log::info!("数据库路径: {}", db_path.display());

    conn.execute(&format!("DROP TABLE IF EXISTS \"{}\"", safe_table_name), &[])
        .map_err(|e| e.to_string())?;

    let mut create_sql = format!("CREATE TABLE \"{}\" (", safe_table_name);
    let mut column_defs = Vec::new();
    let mut column_names = Vec::new();

    for field in &request.fields {
        let safe_field_name: String = field.name.chars()
            .map(|c| if c.is_alphanumeric() || c == '_' || ('\u{4e00}' <= c && c <= '\u{9fff}') { c } else { '_' })
            .collect();
        let safe_field_name = if safe_field_name.trim().is_empty() || safe_field_name.chars().all(|c| c == '_') {
            format!("column_{}", column_names.len() + 1)
        } else {
            safe_field_name
        };
        let safe_field_name = if safe_field_name.chars().next().map(|c| c.is_ascii_digit()).unwrap_or(false) {
            format!("col_{}", safe_field_name)
        } else {
            safe_field_name
        };
        let data_type = match field.dataType.to_uppercase().as_str() {
            "INTEGER" => "INTEGER",
            "REAL" => "REAL",
            "BOOLEAN" => "BOOLEAN",
            "DATE" => "TEXT",
            _ => "TEXT"
        };
        column_defs.push(format!("\"{}\" {}", safe_field_name, data_type));
        column_names.push(safe_field_name);
    }

    create_sql.push_str(&column_defs.join(", "));
    create_sql.push(')');

    conn.execute(&create_sql, &[]).map_err(|e| e.to_string())?;

    let all_rows: Vec<Vec<String>> = match &request.sheet_name {
        Some(sheet) => load_all_excel_data(&request.file_path, sheet)?,
        None => load_all_csv_data(&request.file_path)?
    };

    let mut final_rows: Vec<Vec<String>>;

    if request.has_header {
        if all_rows.len() > 1 {
            final_rows = all_rows[1..].to_vec();
        } else {
            final_rows = vec![];
        }
    } else {
        let headers: Vec<String> = (0..request.fields.len())
            .map(|i| format!("col_{}", i + 1))
            .collect();
        final_rows = vec![headers];
        final_rows.extend(all_rows.clone());
    }

    let col_refs: Vec<&str> = column_names.iter().map(|s| s.as_str()).collect();

    log::info!("准备导入数据: 表名={}, 总行数={}, 字段数={}", safe_table_name, final_rows.len(), column_names.len());
    log::debug!("字段列表: {:?}", column_names);

    if final_rows.is_empty() {
        log::warn!("警告: 要导入的数据为空！");
        return Err("没有数据可导入，请检查文件是否包含数据行".to_string());
    }

    log::info!("开始批量插入, batch_size=1000");
    let count = conn.batch_insert(
        &safe_table_name,
        &col_refs,
        &final_rows,
        1000
    ).map_err(|e| {
        log::error!("批量插入失败: {}", e);
        e.to_string()
    })?;

    log::info!("导入完成: 成功插入 {} 行", count);

    let verify_result = conn.query(
        &format!("SELECT COUNT(*) FROM \"{}\"", safe_table_name),
        &[]
    );
    match verify_result {
        Ok(result) => {
            if let Some(row) = result.rows.first() {
                let actual_count: u64 = row[0].parse().unwrap_or(0);
                log::info!("验证结果: 表 '{}' 实际包含 {} 行数据", safe_table_name, actual_count);
                if actual_count != count {
                    log::warn!("数据不一致！插入了 {} 行，但表中只有 {} 行", count, actual_count);
                }
            }
        }
        Err(e) => {
            log::warn!("验证查询失败: {}", e);
        }
    }

    Ok(format!("成功导入 {} 行到 {} 表 '{}'", count, conn.get_database_type(), safe_table_name))
}

fn load_all_csv_data(file_path: &str) -> Result<Vec<Vec<String>>, String> {
    let mut file = File::open(file_path)
        .map_err(|e| format!("无法打开文件: {}", e))?;

    let mut data = Vec::new();
    file.read_to_end(&mut data)
        .map_err(|e| format!("无法读取文件: {}", e))?;

    let text = try_decode_all_encodings(&data);
    let lines: Vec<&str> = text.lines().collect();

    let mut rows = Vec::new();
    for line in lines {
        if line.trim().is_empty() {
            continue;
        }
        if let Some(csv_row) = CsvRow::parse(line) {
            rows.push(csv_row.fields);
        }
    }

    Ok(rows)
}

fn load_all_excel_data(file_path: &str, sheet_name: &str) -> Result<Vec<Vec<String>>, String> {
    use calamine::{open_workbook_auto, Reader};
    let path = std::path::Path::new(file_path);
    if !path.exists() {
        return Err(format!("Excel文件不存在: {}", file_path));
    }

    let mut workbook = open_workbook_auto(file_path)
        .map_err(|e| format!("无法打开Excel文件: {}", e))?;

    let range = workbook.worksheet_range(sheet_name)
        .map_err(|e| format!("无法读取Sheet '{}': {}", sheet_name, e))?;

    let mut rows = Vec::new();
    for row in range.rows() {
        let fields: Vec<String> = row
            .iter()
            .map(|cell| cell.to_string())
            .collect();
        rows.push(fields);
    }

    Ok(rows)
}

fn split_sql_statements(sql: &str) -> Vec<String> {
    let mut statements = Vec::new();
    let mut current = String::new();
    let mut in_string = false;
    let mut string_char = '\0';
    let mut in_comment = false;
    let mut in_block_comment = false;

    let chars: Vec<char> = sql.chars().collect();
    let mut i = 0;

    while i < chars.len() {
        let c = chars[i];

        if in_block_comment {
            if c == '*' && i + 1 < chars.len() && chars[i + 1] == '/' {
                in_block_comment = false;
                i += 2;
                continue;
            }
            i += 1;
            continue;
        }

        if !in_string && !in_comment {
            if c == '-' && i + 1 < chars.len() && chars[i + 1] == '-' {
                in_comment = true;
                i += 2;
                continue;
            }
            if c == '/' && i + 1 < chars.len() && chars[i + 1] == '*' {
                in_block_comment = true;
                i += 2;
                continue;
            }
            if c == '\'' || c == '"' {
                in_string = true;
                string_char = c;
                current.push(c);
                i += 1;
                continue;
            }
            if c == ';' {
                let stmt = current.trim().to_string();
                if !stmt.is_empty() {
                    statements.push(stmt);
                }
                current.clear();
                i += 1;
                continue;
            }
        } else if in_string {
            if c == '\\' && i + 1 < chars.len() {
                current.push(c);
                current.push(chars[i + 1]);
                i += 2;
                continue;
            }
            if c == string_char {
                in_string = false;
            }
        } else if in_comment {
            if c == '\n' || c == '\r' {
                in_comment = false;
                continue;
            }
            i += 1;
            continue;
        }

        current.push(c);
        i += 1;
    }

    let stmt = current.trim().to_string();
    if !stmt.is_empty() {
        statements.push(stmt);
    }

    statements
}

fn execute_sql_with_sqlite(
    conn: &database::MutexGuardConnection,
    stmt: &str,
    results: &mut Vec<SqlStatementResult>,
    success_count: &mut usize,
    fail_count: &mut usize,
) {
    let upper_stmt = stmt.to_uppercase();
    
    if upper_stmt.starts_with("SELECT") || upper_stmt.starts_with("PRAGMA") {
        match conn.query(stmt, &[]) {
            Ok(result) => {
                results.push(SqlStatementResult {
                    statement: stmt.to_string(),
                    success: true,
                    error: None,
                    columns: Some(result.columns),
                    rows: Some(result.rows),
                    affected_rows: None,
                });
                *success_count += 1;
            }
            Err(e) => {
                results.push(SqlStatementResult {
                    statement: stmt.to_string(),
                    success: false,
                    error: Some(format!("执行查询失败: {}", e)),
                    columns: None,
                    rows: None,
                    affected_rows: None,
                });
                *fail_count += 1;
            }
        }
    } else {
        match conn.execute(stmt, &[]) {
            Ok(rows) => {
                results.push(SqlStatementResult {
                    statement: stmt.to_string(),
                    success: true,
                    error: None,
                    columns: None,
                    rows: None,
                    affected_rows: Some(rows),
                });
                *success_count += 1;
            }
            Err(e) => {
                results.push(SqlStatementResult {
                    statement: stmt.to_string(),
                    success: false,
                    error: Some(format!("执行SQL失败: {}", e)),
                    columns: None,
                    rows: None,
                    affected_rows: None,
                });
                *fail_count += 1;
            }
        }
    }
}

#[tauri::command]
fn execute_sql(state: State<AppState>, sql: String) -> Result<BatchExecuteResult, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let sqlite_conn = state.db_manager.get_connection().map_err(|e| e.to_string())?;
    
    let table_names = database::router::QueryRouter::get_table_names(&sqlite_conn);
    let table_names_ref: Vec<&str> = table_names.iter().map(|s| s.as_str()).collect();
    
    let statements = split_sql_statements(&sql);
    
    if statements.is_empty() {
        return Err("没有有效的SQL语句".to_string());
    }

    let mut results: Vec<SqlStatementResult> = Vec::new();
    let mut success_count = 0;
    let mut fail_count = 0;

    for stmt in statements.iter() {
        let trimmed_stmt = stmt.trim();
        if trimmed_stmt.is_empty() {
            continue;
        }

        let use_duckdb = database::router::QueryRouter::should_use_duckdb(trimmed_stmt);
        
        if use_duckdb {
            match state.get_duckdb_connection() {
                Ok(duckdb_conn_arc) => {
                    let duckdb_conn = duckdb_conn_arc.lock().map_err(|e| e.to_string())?;
                    
                    let routed_sql_result = database::router::QueryRouter::route_table_names(
                        trimmed_stmt,
                        &table_names_ref
                    );
                    
                    match routed_sql_result {
                        Ok(routed_sql) => {
                            let result = catch_unwind(|| {
                                duckdb_conn.query(&routed_sql, &[])
                            });
                    
                            match result {
                                Ok(Ok(query_result)) => {
                                    results.push(SqlStatementResult {
                                        statement: trimmed_stmt.to_string(),
                                        success: true,
                                        error: None,
                                        columns: Some(query_result.columns),
                                        rows: Some(query_result.rows),
                                        affected_rows: None,
                                    });
                                    success_count += 1;
                                }
                                Ok(Err(e)) => {
                                    log::warn!("DuckDB execution failed, falling back to SQLite: {}", e);
                                    execute_sql_with_sqlite(&sqlite_conn, trimmed_stmt, &mut results, &mut success_count, &mut fail_count);
                                }
                                Err(e) => {
                                    log::error!("DuckDB panicked, falling back to SQLite: {:?}", e);
                                    execute_sql_with_sqlite(&sqlite_conn, trimmed_stmt, &mut results, &mut success_count, &mut fail_count);
                                }
                            }
                        }
                        Err(e) => {
                            log::warn!("SQL routing failed, falling back to SQLite: {}", e);
                            execute_sql_with_sqlite(&sqlite_conn, trimmed_stmt, &mut results, &mut success_count, &mut fail_count);
                        }
                    }
                }
                Err(e) => {
                    log::warn!("DuckDB not initialized, using SQLite: {}", e);
                    execute_sql_with_sqlite(&sqlite_conn, trimmed_stmt, &mut results, &mut success_count, &mut fail_count);
                }
            }
        } else {
            execute_sql_with_sqlite(&sqlite_conn, trimmed_stmt, &mut results, &mut success_count, &mut fail_count);
        }
    }

    Ok(BatchExecuteResult {
        results,
        success_count,
        fail_count,
    })
}

#[tauri::command]
fn list_tables(state: State<AppState>) -> Result<Vec<String>, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| e.to_string())?;
    let result = conn.query(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
        &[]
    ).map_err(|e| e.to_string())?;

    let tables: Vec<String> = result.rows.into_iter()
        .filter(|row| !row.is_empty())
        .map(|row| row[0].clone())
        .collect();

    Ok(tables)
}

#[tauri::command]
fn delete_table(state: State<AppState>, table_name: String) -> Result<String, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| e.to_string())?;
    let safe_name = table_name.replace(|c: char| !c.is_alphanumeric() && c != '_', "");
    let sql = format!("DROP TABLE IF EXISTS \"{}\"", safe_name);
    conn.execute(&sql, &[]).map_err(|e| format!("删除表失败: {}", e))?;
    
    Ok(format!("表 '{}' 已删除", safe_name))
}

#[tauri::command]
fn get_table_row_count(state: State<AppState>, table_name: String) -> Result<i64, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| e.to_string())?;
    let safe_name = table_name.replace(|c: char| !c.is_alphanumeric() && c != '_', "");
    let sql = format!("SELECT COUNT(*) FROM \"{}\"", safe_name);
    let result = conn.query(&sql, &[]).map_err(|e| format!("获取行数失败: {}", e))?;
    
    if let Some(row) = result.rows.first() {
        row[0].parse::<i64>().map_err(|e| format!("解析行数失败: {}", e))
    } else {
        Err("未获取到行数".to_string())
    }
}

#[tauri::command]
fn create_project(project_name: String) -> Result<String, String> {
    ProjectManager::create(&project_name)
        .map(|path| path.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn open_project(db_path: String) -> Result<bool, String> {
    let path = PathBuf::from(db_path.clone());
    ProjectManager::open(&path)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn list_projects() -> Result<Vec<String>, String> {
    ProjectManager::list_projects()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_project(project_name: String) -> Result<String, String> {
    ProjectManager::delete_project(&project_name)
        .map(|_| format!("项目 '{}' 已删除", project_name))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn rename_project(old_name: String, new_name: String) -> Result<String, String> {
    ProjectManager::rename_project(&old_name, &new_name)
        .map(|_| format!("项目已从 '{}' 重命名为 '{}'", old_name, new_name))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn switch_project(state: State<AppState>, project_name: String) -> Result<String, String> {
    let db_path = dirs::data_dir()
        .ok_or("无法获取数据目录".to_string())?
        .join("la-duck")
        .join(&project_name)
        .join("meta.db");

    if !db_path.exists() {
        return Err(format!("项目 '{}' 的数据库文件不存在", project_name));
    }

    state.set_db_path(db_path.clone())?;
    state.db_manager.connect("sqlite", &db_path).map_err(|e| e.to_string())?;

    Ok(format!("已切换到项目: {}", project_name))
}

#[tauri::command]
fn open_database_from_path(state: State<AppState>, db_path: String) -> Result<String, String> {
    let path = PathBuf::from(db_path.clone());

    if !path.exists() {
        return Err(format!("数据库文件不存在: {}", db_path));
    }

    state.set_db_path(path.clone())?;
    
    match state.db_manager.connect("sqlite", &path) {
        Ok(_) => Ok(format!("已打开数据库: {}", path.to_string_lossy())),
        Err(e) => Err(format!("无法打开数据库文件: {}", e)),
    }
}

#[tauri::command]
fn export_database(state: State<AppState>, dest_path: String) -> Result<String, String> {
    let source_path = state.db_path.lock().map_err(|e| e.to_string())?;
    let dest = PathBuf::from(dest_path);

    ProjectManager::export_database(&source_path, &dest)
        .map(|_| format!("数据库已导出到: {}", dest.to_string_lossy()))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_current_db_path(state: State<AppState>) -> Result<String, String> {
    let path = state.db_path.lock().map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content)
        .map_err(|e| format!("写入文件失败: {}", e))
}

#[tauri::command]
fn export_selected_projects(selected_projects: Vec<String>, dest_dir: String) -> Result<Vec<String>, String> {
    let dest_path = PathBuf::from(&dest_dir);
    
    if !dest_path.exists() {
        return Err(format!("导出目录不存在: {}", dest_dir));
    }
    
    let mut exported_paths = Vec::new();
    
    for project_name in &selected_projects {
        let db_path = dirs::data_dir()
            .ok_or("无法获取数据目录".to_string())?
            .join("la-duck")
            .join(&project_name)
            .join("meta.db");
        
        if !db_path.exists() {
            return Err(format!("项目 '{}' 的数据库不存在", project_name));
        }

        let export_file = dest_path.join(format!("{}.db", project_name));
        
        ProjectManager::export_database(&db_path, &export_file)
            .map_err(|e| format!("导出项目 '{}' 失败: {}", project_name, e))?;
        
        exported_paths.push(export_file.to_string_lossy().to_string());
    }
    
    Ok(exported_paths)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            list_databases,
            get_database_status,
            get_all_database_status,
            load_csv,
            import_data,
            import_data_v2,
            execute_sql,
            list_tables,
            delete_table,
            get_table_row_count,
            create_project,
            open_project,
            list_projects,
            delete_project,
            rename_project,
            switch_project,
            open_database_from_path,
            export_database,
            get_current_db_path,
            get_excel_sheets,
            load_excel_sheet,
            write_text_file,
            export_selected_projects,
        ])
        .plugin(tauri_plugin_dialog::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// #[cfg(test)]
// mod excel_tests;  // 暂时禁用，有编译问题
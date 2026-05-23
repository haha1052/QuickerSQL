use std::fs::File;
use std::io::Read;
use std::path::PathBuf;
use std::sync::{Mutex, Arc};
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
        let mut path = self.db_path.lock().map_err(|e| format!("获取路径锁失败: {}", e))?;
        *path = new_path.clone();
        drop(path);

        let current_path = self.db_path.lock().map_err(|e| format!("获取路径锁失败: {}", e))?;
        
        match self.init_duckdb(&current_path) {
            Ok(_) => Ok(()),
            Err(e) => {
                log::warn!("初始化 DuckDB 失败: {}, 将继续使用 SQLite", e);
                *self.duckdb_conn.lock().unwrap() = None;
                Ok(())
            }
        }
    }

    fn init_duckdb(&self, sqlite_path: &PathBuf) -> Result<(), String> {
        use tempfile::NamedTempFile;

        let temp_file = NamedTempFile::new().map_err(|e| format!("创建临时文件失败: {}", e))?;
        let driver = DuckDbDriver::new();

        let conn = driver.create_database(temp_file.path())
            .map_err(|e| format!("创建 DuckDB 连接失败: {}", e))?;

        let sqlite_path_str = sqlite_path.to_string_lossy().replace("\\", "\\\\");
        let attach_sql = format!("ATTACH '{}' AS sqlite_db (TYPE SQLITE);", sqlite_path_str);

        conn.execute(&attach_sql, &[])
            .map_err(|e| format!("ATTACH SQLite 失败: {}", e))?;

        conn.execute("SET preserve_insertion_order = false;", &[])
            .map_err(|e| format!("设置 DuckDB 配置失败: {}", e))?;

        *self.duckdb_conn.lock().map_err(|e| format!("获取锁失败: {}", e))? = Some(Arc::new(Mutex::new(conn)));

        log::info!("DuckDB 初始化完成，已 ATTACH SQLite: {}", sqlite_path.display());
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
struct CsvPreview {
    headers: Vec<String>,
    rows: Vec<Vec<String>>,
}

#[derive(serde::Deserialize)]
struct FieldMeta {
    name: String,
}

#[derive(serde::Deserialize)]
struct ImportRequest {
    rows: Vec<Vec<String>>,
    table_name: String,
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
fn import_data(state: State<AppState>, request: ImportRequest) -> Result<String, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| e.to_string())?;
    let safe_table_name = request.table_name.replace(' ', "_");

    // 1. 删除旧表
    conn.execute(&format!("DROP TABLE IF EXISTS \"{}\"", safe_table_name), &[])
        .map_err(|e| e.to_string())?;

    // 2. 创建新表
    let mut create_sql = format!("CREATE TABLE \"{}\" (", safe_table_name);
    let mut column_defs = Vec::new();
    let mut column_names = Vec::new();

    for field in &request.fields {
        let safe_field_name = field.name.replace(' ', "_");
        column_defs.push(format!("\"{}\" TEXT", safe_field_name));
        column_names.push(safe_field_name);
    }

    create_sql.push_str(&column_defs.join(", "));
    create_sql.push(')');

    conn.execute(&create_sql, &[]).map_err(|e| e.to_string())?;

    // 3. 批量插入数据
    let col_refs: Vec<&str> = column_names.iter().map(|s| s.as_str()).collect();
    let count = conn.batch_insert(
        &safe_table_name,
        &col_refs,
        &request.rows,
        1000 // 每批 1000 行
    ).map_err(|e| e.to_string())?;

    Ok(format!("成功导入 {} 行到 {} 表 '{}'", count, conn.get_database_type(), safe_table_name))
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
                    
                    let routed_sql = database::router::QueryRouter::route_table_names(
                        trimmed_stmt,
                        &table_names_ref
                    );
                    
                    match duckdb_conn.query(&routed_sql, &[]) {
                        Ok(result) => {
                            results.push(SqlStatementResult {
                                statement: trimmed_stmt.to_string(),
                                success: true,
                                error: None,
                                columns: Some(result.columns),
                                rows: Some(result.rows),
                                affected_rows: None,
                            });
                            success_count += 1;
                        }
                        Err(e) => {
                            log::warn!("DuckDB execution failed, falling back to SQLite: {}", e);
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
            execute_sql,
            list_tables,
            delete_table,
            get_table_row_count,
            create_project,
            open_project,
            list_projects,
            delete_project,
            switch_project,
            open_database_from_path,
            export_database,
            get_current_db_path,
        ])
        .plugin(tauri_plugin_dialog::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
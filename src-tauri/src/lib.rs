use std::fs::File;
use std::io::Read;
use std::sync::Mutex;
use tauri::State;

// 数据库状态
#[derive(serde::Serialize)]
pub struct DatabaseStatus {
    pub db_type: String,
    pub tables: Vec<String>,
    pub row_count: Vec<(String, i64)>,
    pub is_connected: bool,
}

// 应用状态 - 只使用 SQLite
struct AppState {
    sqlite_conn: Mutex<rusqlite::Connection>,
}

impl AppState {
    fn new() -> Self {
        // 使用临时文件数据库
        let temp_db_path = std::env::temp_dir().join("la_duck_temp.db");
        let sqlite_conn = rusqlite::Connection::open(&temp_db_path)
            .expect("无法创建 SQLite 数据库");

        AppState {
            sqlite_conn: Mutex::new(sqlite_conn),
        }
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

// ==================== 公共数据结构 ====================

#[derive(serde::Serialize, specta::Type)]
struct CsvPreview {
    headers: Vec<String>,
    rows: Vec<Vec<String>>,
}

#[derive(serde::Deserialize)]
struct FieldMeta {
    name: String,
    data_type: String,
}

#[derive(serde::Deserialize)]
struct ImportRequest {
    rows: Vec<Vec<String>>,
    table_name: String,
    fields: Vec<FieldMeta>,
}

#[derive(serde::Serialize)]
struct QueryResult {
    columns: Vec<String>,
    rows: Vec<Vec<String>>,
}

// ==================== 可用数据库列表 ====================

#[derive(serde::Serialize)]
struct DatabaseInfo {
    db_type: String,
    name: String,
    is_available: bool,
    description: String,
}

#[tauri::command]
fn list_databases() -> Vec<DatabaseInfo> {
    vec![
        DatabaseInfo {
            db_type: "sqlite".to_string(),
            name: "SQLite".to_string(),
            is_available: true,
            description: "轻量级本地数据库（Rust后端）".to_string(),
        },
        DatabaseInfo {
            db_type: "duckdb".to_string(),
            name: "DuckDB".to_string(),
            is_available: true,
            description: "分析型数据库（WASM前端）".to_string(),
        },
    ]
}

// ==================== 获取数据库状态 ====================

#[tauri::command]
fn get_database_status(state: State<AppState>) -> Result<DatabaseStatus, String> {
    let conn = state.sqlite_conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).map_err(|e| e.to_string())?;

    let tables: Vec<String> = stmt.query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut row_count = Vec::new();
    for table in &tables {
        let count_query = format!("SELECT COUNT(*) FROM \"{}\"", table);
        if let Ok(mut count_stmt) = conn.prepare(&count_query) {
            if let Ok(count) = count_stmt.query_row([], |row| row.get(0)) {
                row_count.push((table.clone(), count));
            }
        }
    }

    Ok(DatabaseStatus {
        db_type: "SQLite".to_string(),
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
    // DuckDB 状态由前端 WASM 管理
    results
}

// ==================== CSV 加载 ====================

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

// ==================== 导入数据（仅 SQLite） ====================

#[tauri::command]
fn import_data(state: State<AppState>, request: ImportRequest) -> Result<String, String> {
    let conn = state.sqlite_conn.lock().map_err(|e| e.to_string())?;
    let safe_table_name = request.table_name.replace(' ', "_");

    conn.execute(&format!("DROP TABLE IF EXISTS {}", safe_table_name), [])
        .map_err(|e| e.to_string())?;

    let mut create_sql = format!("CREATE TABLE {} (", safe_table_name);
    let mut column_defs = Vec::new();

    for field in &request.fields {
        let safe_field_name = field.name.replace(' ', "_");
        let col_def = format!("\"{}\" TEXT", safe_field_name);
        column_defs.push(col_def);
    }

    create_sql.push_str(&column_defs.join(", "));
    create_sql.push(')');

    conn.execute(&create_sql, []).map_err(|e| e.to_string())?;

    for row in &request.rows {
        let values: Vec<String> = row.iter()
            .map(|v| {
                let escaped = v.replace('\'', "''");
                format!("'{}'", escaped)
            })
            .collect();

        let insert_sql = format!(
            "INSERT INTO {} VALUES ({})",
            safe_table_name,
            values.join(", ")
        );

        conn.execute(&insert_sql, []).map_err(|e| e.to_string())?;
    }

    Ok(format!("成功导入 {} 行到 SQLite 表 '{}'", request.rows.len(), safe_table_name))
}

// ==================== SQL 执行（仅 SQLite） ====================

#[tauri::command]
fn execute_sql(state: State<AppState>, sql: String) -> Result<QueryResult, String> {
    let conn = state.sqlite_conn.lock().map_err(|e| e.to_string())?;

    let upper_sql = sql.to_uppercase();
    let is_select = upper_sql.trim().starts_with("SELECT");

    if is_select {
        let mut stmt = conn.prepare(&sql).map_err(|e| format!("准备查询失败: {}", e))?;
        let column_names: Vec<String> = stmt.column_names().iter()
            .map(|s| s.to_string())
            .collect();

        let mut rows = Vec::new();
        let mut query_result = stmt.query([]).map_err(|e| format!("执行查询失败: {}", e))?;

        while let Ok(Some(row)) = query_result.next() {
            let mut row_data = Vec::new();
            for i in 0..column_names.len() {
                match row.get(i) {
                    Ok(val) => row_data.push(val),
                    Err(_) => row_data.push(String::from("NULL")),
                }
            }
            rows.push(row_data);
        }

        Ok(QueryResult { columns: column_names, rows })
    } else {
        conn.execute(&sql, []).map_err(|e| format!("执行SQL失败: {}", e))?;
        Ok(QueryResult {
            columns: vec!["状态".to_string()],
            rows: vec![vec!["执行成功".to_string()]],
        })
    }
}

// ==================== 表列表 ====================

#[tauri::command]
fn list_tables(state: State<AppState>) -> Result<Vec<String>, String> {
    let conn = state.sqlite_conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).map_err(|e| e.to_string())?;

    let tables: Vec<String> = stmt.query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(tables)
}

// ==================== 删除表（仅 SQLite） ====================

#[tauri::command]
fn delete_table(state: State<AppState>, table_name: String) -> Result<String, String> {
    let conn = state.sqlite_conn.lock().map_err(|e| e.to_string())?;
    let safe_name = table_name.replace(|c: char| !c.is_alphanumeric() && c != '_', "");
    let sql = format!("DROP TABLE IF EXISTS \"{}\"", safe_name);
    conn.execute(&sql, []).map_err(|e| format!("删除表失败: {}", e))?;
    Ok(format!("表 '{}' 已删除", safe_name))
}

// ==================== 获取表行数 ====================

#[tauri::command]
fn get_table_row_count(state: State<AppState>, table_name: String) -> Result<i64, String> {
    let conn = state.sqlite_conn.lock().map_err(|e| e.to_string())?;
    let safe_name = table_name.replace(|c: char| !c.is_alphanumeric() && c != '_', "");
    let sql = format!("SELECT COUNT(*) FROM \"{}\"", safe_name);
    let count: i64 = conn.query_row(&sql, [], |row| row.get(0))
        .map_err(|e| format!("获取行数失败: {}", e))?;
    Ok(count)
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
        ])
        .plugin(tauri_plugin_dialog::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
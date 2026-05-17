use std::fs::File;
use std::io::Read;
use std::sync::Mutex;
use tauri::State;
use rusqlite::{Connection, Result};

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
struct QueryResult {
    columns: Vec<String>,
    rows: Vec<Vec<String>>,
}

struct AppState {
    db: Mutex<Connection>,
}

fn init_db() -> Connection {
    let conn = Connection::open_in_memory()
        .expect("无法创建内存数据库");
    conn
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
fn import_to_duckdb(state: State<AppState>, request: ImportRequest) -> Result<String, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

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

    Ok(format!("成功导入 {} 行到表 '{}'", request.rows.len(), safe_table_name))
}

#[tauri::command]
fn execute_sql(state: State<AppState>, sql: String) -> Result<QueryResult, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

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
            rows: vec![vec!["执行成功".to_string()]] 
        })
    }
}

#[tauri::command]
fn list_tables(state: State<AppState>) -> Result<Vec<String>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .map_err(|e| e.to_string())?;
    
    let tables: Vec<String> = stmt.query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>>>()
        .map_err(|e| e.to_string())?;

    Ok(tables)
}

#[derive(serde::Serialize)]
struct DuckDbStatus {
    tables: Vec<String>,
    row_count: Vec<(String, i64)>,
    is_connected: bool,
}

#[tauri::command]
fn get_duckdb_status(state: State<AppState>) -> Result<DuckDbStatus, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .map_err(|e| e.to_string())?;
    
    let tables: Vec<String> = stmt.query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>>>()
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

    Ok(DuckDbStatus {
        tables,
        row_count,
        is_connected: true,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState { db: Mutex::new(init_db()) })
        .invoke_handler(tauri::generate_handler![
            load_csv,
            import_to_duckdb,
            execute_sql,
            list_tables,
            get_duckdb_status
        ])
        .plugin(tauri_plugin_dialog::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

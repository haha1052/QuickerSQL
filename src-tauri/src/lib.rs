use std::sync::Mutex;
use tauri::State;
use duckdb::{Connection, Result};

#[derive(serde::Serialize, specta::Type)]
struct CsvPreview {
    headers: Vec<String>,
    rows: Vec<Vec<String>>,
}

struct AppState {
    db: Mutex<Connection>,
}

fn init_db() -> Connection {
    Connection::open(":memory:").unwrap()
}

#[tauri::command]
fn load_csv(state: State<AppState>, file_path: String) -> Result<CsvPreview, String> {
    let conn = state.db.lock().unwrap();

    conn.execute("DROP VIEW IF EXISTS temp_csv", []).map_err(|e| e.to_string())?;
    
    let create_view_sql = format!(
        "CREATE VIEW temp_csv AS SELECT * FROM read_csv_auto('{}', AUTO_DETECT=TRUE)",
        file_path.replace("\\", "/")
    );
    conn.execute(&create_view_sql, []).map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare("PRAGMA table_info(temp_csv)").map_err(|e| e.to_string())?;
    let headers: Vec<String> = stmt.query_map([], |row| row.get(1))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare("SELECT * FROM temp_csv LIMIT 100").map_err(|e| e.to_string())?;
    let mut rows_vec = Vec::new();
    
    let mut query_result = stmt.query([]).map_err(|e| e.to_string())?;
    while let Some(row) = query_result.next().map_err(|e| e.to_string())? {
        let mut row_data = Vec::new();
        for i in 0..headers.len() {
            let val: String = row.get(i).unwrap_or_default();
            row_data.push(val);
        }
        rows_vec.push(row_data);
    }

    Ok(CsvPreview { headers, rows: rows_vec })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState { db: Mutex::new(init_db()) })
        .invoke_handler(tauri::generate_handler![load_csv])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

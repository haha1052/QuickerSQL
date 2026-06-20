//! 文件操作相关 Tauri 命令（CSV/Excel 导入）
//!
//! DDL/INSERT 逻辑已下沉到 [`crate::services::DatabaseService`]，
//! 本文件仅负责参数解析、读取文件、调用服务和写审计日志。
use crate::TauriAppState;
use crate::database::SqlIdentifier;
use crate::models::database::{CsvPreview, ExcelPreview, FieldMeta, ImportRequest, ImportRequestV2, SheetInfo};
use crate::services::DatabaseService;
use tauri::State;
use std::fs::File;
use std::io::Read;

const MAX_EXCEL_FILE_SIZE: u64 = 50 * 1024 * 1024;
const MAX_PREVIEW_ROWS: usize = 100;

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

fn extract_excel_preview(range: &calamine::Range<calamine::Data>) -> CsvPreview {
    let mut headers = Vec::new();
    let mut rows = Vec::new();

    for (i, row) in range.rows().enumerate() {
        let fields: Vec<String> = row.iter().map(|cell| cell.to_string()).collect();

        if i == 0 {
            headers = fields;
        } else if i <= MAX_PREVIEW_ROWS {
            rows.push(fields);
        }
    }

    CsvPreview { headers, rows }
}

fn get_excel_sheets_impl(file_path: &str) -> Result<ExcelPreview, String> {
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

    let mut workbook = open_workbook_auto(file_path).map_err(|e| {
        let error_msg = e.to_string();
        log::error!("打开Excel文件失败: {}", error_msg);
        if error_msg.to_lowercase().contains("password") || error_msg.to_lowercase().contains("encrypted") {
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

fn load_excel_sheet_impl(file_path: &str, sheet_name: &str) -> Result<CsvPreview, String> {
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

    let mut workbook = open_workbook_auto(file_path).map_err(|e| {
        let error_msg = e.to_string();
        log::error!("打开Excel文件失败: {}", error_msg);
        if error_msg.to_lowercase().contains("password") || error_msg.to_lowercase().contains("encrypted") {
            "Excel文件已加密，请先解密".to_string()
        } else {
            format!("无法打开Excel文件: {}", e)
        }
    })?;

    let range = workbook.worksheet_range(sheet_name).map_err(|e| {
        log::error!("无法读取Sheet '{}': {}", sheet_name, e);
        format!("无法读取Sheet '{}': {}", sheet_name, e)
    })?;

    log::info!("成功加载Sheet '{}'", sheet_name);
    Ok(extract_excel_preview(&range))
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

    let mut workbook = open_workbook_auto(file_path).map_err(|e| format!("无法打开Excel文件: {}", e))?;

    let range = workbook.worksheet_range(sheet_name).map_err(|e| format!("无法读取Sheet '{}': {}", sheet_name, e))?;

    let mut rows = Vec::new();
    for row in range.rows() {
        let fields: Vec<String> = row.iter().map(|cell| cell.to_string()).collect();
        rows.push(fields);
    }

    Ok(rows)
}

/// 处理字段名安全化和类型推断（纯字段推导，不执行任何 DB 操作）
fn prepare_field_info(fields: &[FieldMeta]) -> (Vec<String>, Vec<(String, String)>) {
    let mut column_defs = Vec::new();
    let mut column_names = Vec::new();

    for field in fields {
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
        let data_type = match field.data_type.to_uppercase().as_str() {
            "INTEGER" => "INTEGER",
            "REAL" => "REAL",
            "BOOLEAN" => "BOOLEAN",
            "DATE" => "TEXT",
            _ => "TEXT"
        };
        column_defs.push((safe_field_name.clone(), data_type.to_string()));
        column_names.push(safe_field_name);
    }

    (column_names, column_defs)
}

/// 加载 CSV 文件预览
#[tauri::command]
pub fn load_csv(_state: State<'_, TauriAppState>, file_path: String) -> Result<CsvPreview, String> {
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

/// 获取 Excel 文件的所有 Sheet 信息
#[tauri::command]
pub fn get_excel_sheets(file_path: String) -> Result<ExcelPreview, String> {
    get_excel_sheets_impl(&file_path)
}

/// 加载指定的 Excel Sheet
#[tauri::command]
pub fn load_excel_sheet(file_path: String, sheet_name: String) -> Result<CsvPreview, String> {
    load_excel_sheet_impl(&file_path, &sheet_name)
}

/// [已废弃] V1 导入接口
#[deprecated(since = "2.0.0", note = "请使用 import_data_v2")]
#[tauri::command]
pub fn import_data(state: State<'_, TauriAppState>, request: ImportRequest) -> Result<String, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| e.to_string())?;
    let safe_table_name = request.table_name.replace(' ', "_");
    // 表名安全校验
    let _ = SqlIdentifier::new(&safe_table_name)?;

    // DROP → CREATE → INSERT，全部下沉到 DatabaseService
    DatabaseService::drop_table_if_exists(&conn, &safe_table_name)?;

    let (column_names, columns_schema) = prepare_field_info(&request.fields);
    let schema_slices: Vec<(String, String)> = columns_schema;
    DatabaseService::create_table_from_schema(&conn, &safe_table_name, &schema_slices)?;

    let count = DatabaseService::batch_insert_rows(&conn, &safe_table_name, &column_names, &request.rows)?;

    Ok(format!("成功导入 {} 行到 {} 表 '{}'", count, conn.get_database_type(), safe_table_name))
}

/// V2 导入接口（直接读文件，性能更好）
#[tauri::command]
pub fn import_data_v2(state: State<'_, TauriAppState>, request: ImportRequestV2) -> Result<String, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| e.to_string())?;
    let safe_table_name = request.table_name.replace(' ', "_");
    let _ = SqlIdentifier::new(&safe_table_name)?;

    let db_path = state.db_path.lock().map_err(|e| format!("获取数据库路径失败: {}", e))?;
    log::info!("数据库路径: {}", db_path.display());

    // DB 操作下沉到 DatabaseService
    DatabaseService::drop_table_if_exists(&conn, &safe_table_name)?;

    let (column_names, columns_schema) = prepare_field_info(&request.fields);
    DatabaseService::create_table_from_schema(&conn, &safe_table_name, &columns_schema)?;

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

    log::info!("准备导入数据: 表名={}, 总行数={}, 字段数={}", safe_table_name, final_rows.len(), column_names.len());
    log::debug!("字段列表: {:?}", column_names);

    if final_rows.is_empty() {
        log::warn!("警告: 要导入的数据为空！");
        return Err("没有数据可导入，请检查文件是否包含数据行".to_string());
    }

    log::info!("开始批量插入, batch_size=1000");
    let count = DatabaseService::batch_insert_rows(&conn, &safe_table_name, &column_names, &final_rows)
        .map_err(|e| {
            log::error!("批量插入失败: {}", e);
            e
        })?;

    log::info!("导入完成: 成功插入 {} 行", count);

    // 验证计数（走 DatabaseService，避免拼接 SQL）
    if let Ok(actual_count) = DatabaseService::get_row_count(&conn, &safe_table_name) {
        log::info!("验证结果: 表 '{}' 实际包含 {} 行数据", safe_table_name, actual_count);
        if actual_count != count as i64 {
            log::warn!("数据不一致！插入了 {} 行，但表中只有 {} 行", count, actual_count);
        }
    }

    // 刷新 VIEW（仅在 DuckDB 可用时）
    if let Ok(duckdb_conn) = state.get_duckdb_connection() {
        if let Ok(guard) = duckdb_conn.lock() {
            let _ = crate::services::ViewService::refresh_single_view(&*guard, &safe_table_name);
        }
    }

    // 记录审计日志
    let audit_request = crate::models::audit_log::RecordAuditLogRequest {
        module: "import".to_string(),
        action: "import_data_v2".to_string(),
        description: format!("导入数据到表 '{}'", safe_table_name),
        status: "success".to_string(),
        duration_ms: None,
        details: Some(format!("table_name={}, row_count={}", safe_table_name, count)),
    };
    let _ = crate::services::AuditLogService::record_audit_log(&conn, audit_request);

    Ok(format!("成功导入 {} 行到 {} 表 '{}'", count, conn.get_database_type(), safe_table_name))
}

/// 写入文本文件
#[tauri::command]
pub fn write_text_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content)
        .map_err(|e| format!("写入文件失败: {}", e))
}

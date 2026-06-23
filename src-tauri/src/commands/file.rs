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
use std::io::{Read, Write};
use std::path::Path;
use tokio::time::{timeout, Duration};

const MAX_EXCEL_FILE_SIZE: u64 = 50 * 1024 * 1024;
const MAX_PREVIEW_ROWS: usize = 100;

// 导入超时配置（根据文件大小动态调整）
const COPY_TIMEOUT_SECS: u64 = 10;       // COPY 命令基础超时（适用于小文件）
const TRADITIONAL_TIMEOUT_SECS: u64 = 20; // 传统批量插入基础超时
const LARGE_FILE_THRESHOLD: u64 = 10 * 1024 * 1024; // 10MB 为大文件阈值
const TIMEOUT_PER_MB_SECS: u64 = 2;      // 每增加 1MB 增加 2 秒超时

/// 计算导入超时时间（根据文件大小动态调整）
fn calculate_import_timeout(file_size: u64, use_copy: bool) -> Duration {
    let base_timeout = if use_copy { COPY_TIMEOUT_SECS } else { TRADITIONAL_TIMEOUT_SECS };
    
    // 大文件增加额外超时时间
    if file_size > LARGE_FILE_THRESHOLD {
        let extra_mb = (file_size - LARGE_FILE_THRESHOLD) / (1024 * 1024);
        let extra_secs = extra_mb * TIMEOUT_PER_MB_SECS;
        Duration::from_secs(base_timeout + extra_secs)
    } else {
        Duration::from_secs(base_timeout)
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

/// 将 Excel 数据导出为临时 CSV 文件（用于 COPY 命令导入）
fn export_excel_to_temp_csv(file_path: &str, sheet_name: &str, has_header: bool) -> Result<String, String> {
    use calamine::{open_workbook_auto, Reader};
    let path = Path::new(file_path);
    if !path.exists() {
        return Err(format!("Excel文件不存在: {}", file_path));
    }

    let mut workbook = open_workbook_auto(file_path).map_err(|e| format!("无法打开Excel文件: {}", e))?;

    let range = workbook.worksheet_range(sheet_name).map_err(|e| format!("无法读取Sheet '{}': {}", sheet_name, e))?;

    // 创建应用专属临时目录（Windows: C:\Users\xxx\AppData\Local\quickersql_temp）
    let temp_dir = dirs::data_local_dir()
        .ok_or("无法获取应用数据目录")?
        .join("quickersql_temp");
    
    // 确保临时目录存在
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("无法创建临时目录: {}", e))?;
    
    // 创建临时文件路径（UUID 格式避免冲突）
    let temp_path = temp_dir.join(format!("excel_import_{}.csv", uuid::Uuid::new_v4()));
    
    let mut file = File::create(&temp_path)
        .map_err(|e| format!("无法创建临时CSV文件: {}", e))?;

    // 写入 BOM 以确保正确的 UTF-8 编码
    file.write_all(&[0xEF, 0xBB, 0xBF])
        .map_err(|e| format!("写入BOM失败: {}", e))?;

    let rows: Vec<Vec<String>> = range.rows()
        .map(|row| row.iter().map(|cell| cell.to_string()).collect())
        .collect();

    // 如果有表头且数据行数大于0，从第二行开始写入（跳过表头）
    let start_index = if has_header && !rows.is_empty() { 1 } else { 0 };
    
    // 分批写入（每100行刷盘一次）
    const BATCH_SIZE: usize = 100;
    let mut batch_count = 0;
    
    for row in rows.iter().skip(start_index) {
        let line = row.iter()
            .map(|field| {
                // 如果字段包含逗号、引号或换行，需要用引号包裹并转义
                if field.contains(',') || field.contains('"') || field.contains('\n') || field.contains('\r') {
                    format!("\"{}\"", field.replace('"', "\"\""))
                } else {
                    field.clone()
                }
            })
            .collect::<Vec<_>>()
            .join(",");
        
        writeln!(file, "{}", line)
            .map_err(|e| format!("写入CSV行失败: {}", e))?;
        
        batch_count += 1;
        
        // 每100行刷盘一次
        if batch_count % BATCH_SIZE == 0 {
            file.flush()
                .map_err(|e| format!("刷盘失败: {}", e))?;
            log::debug!("已写入 {} 行，执行刷盘", batch_count);
        }
    }
    
    // 最终刷盘确保所有数据写入
    file.flush()
        .map_err(|e| format!("最终刷盘失败: {}", e))?;

    Ok(temp_path.to_string_lossy().to_string())
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

/// 使用传统方式导入数据（适用于 Excel 和 COPY 失败的情况）
fn import_using_traditional_method(
    conn: &crate::database::MutexGuardConnection,
    safe_table_name: &str,
    column_names: &[String],
    request: &ImportRequestV2,
) -> Result<usize, String> {
    let all_rows: Vec<Vec<String>> = match &request.sheet_name {
        Some(sheet) => load_all_excel_data(&request.file_path, sheet)?,
        None => load_all_csv_data(&request.file_path)?
    };

    let final_rows: Vec<Vec<String>> = if request.has_header {
        if all_rows.len() > 1 {
            all_rows[1..].to_vec()
        } else {
            vec![]
        }
    } else {
        all_rows
    };

    log::info!("准备导入数据: 表名={}, 总行数={}, 字段数={}", safe_table_name, final_rows.len(), column_names.len());

    if final_rows.is_empty() {
        return Err("没有数据可导入，请检查文件是否包含数据行".to_string());
    }

    log::info!("开始批量插入, batch_size=100");
    let count = DatabaseService::batch_insert_rows(conn, safe_table_name, column_names, &final_rows)
        .map_err(|e| {
            log::error!("批量插入失败: {}", e);
            e
        })?;

    Ok(count)
}

/// V2 导入接口（异步版本，直接读文件，性能更好）
#[tauri::command(async)]
pub async fn import_data_v2(state: State<'_, TauriAppState>, request: ImportRequestV2) -> Result<String, String> {
    use std::time::Instant;

    let overall_start = Instant::now();
    log::info!("开始异步导入任务: file_path={}, table_name={}", request.file_path, request.table_name);

    // 前置校验（在主线程快速执行）
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let safe_table_name = request.table_name.replace(' ', "_");
    let _ = SqlIdentifier::new(&safe_table_name)?;

    // 文件路径校验
    let file_path = std::path::Path::new(&request.file_path);
    if !file_path.exists() {
        return Err(format!("文件不存在: {}", request.file_path));
    }

    // 检查文件是否可读（readonly 检查）并获取文件大小用于计算超时
    let file_size = match std::fs::metadata(file_path) {
        Ok(metadata) => {
            if metadata.permissions().readonly() {
                log::warn!("文件为只读，但仍可尝试导入: {}", request.file_path);
            }
            let size = metadata.len();
            log::info!("文件大小: {} bytes", size);
            size
        }
        Err(e) => {
            return Err(format!("无法访问文件元数据: {}", e));
        }
    };

    // 计算超时时间（优先使用 COPY 命令，所以用 COPY 超时）
    let import_timeout = calculate_import_timeout(file_size, true);
    log::info!("导入超时设置: {}秒 (文件大小: {}MB)", 
        import_timeout.as_secs(), file_size / (1024 * 1024));

    // 克隆必要的 Arc 引用，以便在 spawn_blocking 内使用
    let db_manager = state.db_manager.clone();
    let duckdb_conn_opt = state.duckdb_conn.lock().map_err(|e| format!("获取 DuckDB 连接失败: {}", e))?.clone();
    
    // 克隆文件路径用于超时错误日志（request 会在 spawn_blocking 中被移动）
    let file_path_for_timeout_log = request.file_path.clone();

    // 将阻塞 IO 放入 spawn_blocking，并用 timeout 包装
    let blocking_task = tokio::task::spawn_blocking(move || {
        let blocking_start = Instant::now();
        log::info!("进入 spawn_blocking，开始阻塞 IO 操作");

        // 获取连接（在 spawn_blocking 内）
        let conn = db_manager.get_connection().map_err(|e| e.to_string())?;
        let lock_acquire_time = blocking_start.elapsed();
        log::info!("数据库连接获取耗时: {}ms", lock_acquire_time.as_millis());

        // DB 操作下沉到 DatabaseService
        let drop_create_start = Instant::now();
        DatabaseService::drop_table_if_exists(&conn, &safe_table_name)?;
        let (column_names, columns_schema) = prepare_field_info(&request.fields);
        DatabaseService::create_table_from_schema(&conn, &safe_table_name, &columns_schema)?;
        log::info!("DROP + CREATE 耗时: {}ms", drop_create_start.elapsed().as_millis());

        let count: usize;

        // 优先使用 DuckDB COPY 命令（最快）
        // CSV 文件直接使用 COPY，Excel 文件先转临时 CSV 再使用 COPY
        let file_to_import = if let Some(sheet) = &request.sheet_name {
            // Excel 文件：先导出为临时 CSV
            let export_start = Instant::now();
            log::info!("Excel 文件，正在导出到临时 CSV...");
            match export_excel_to_temp_csv(&request.file_path, sheet, request.has_header) {
                Ok(temp_csv_path) => {
                    log::info!("Excel 导出成功，临时文件: {}, 耗时: {}ms", 
                        temp_csv_path, export_start.elapsed().as_millis());
                    Some(temp_csv_path)
                }
                Err(e) => {
                    log::warn!("Excel 导出失败，回退到传统方式: {}", e);
                    None
                }
            }
        } else {
            // CSV 文件：直接使用原文件
            None
        };

        if let Some(csv_path) = file_to_import {
            // 使用 COPY 命令导入临时 CSV（已处理表头，所以 has_header=false）
            let copy_start = Instant::now();
            match DatabaseService::fast_import_csv(&conn, &safe_table_name, &csv_path, false) {
                Ok(cnt) => {
                    count = cnt;
                    log::info!("使用 COPY 命令快速导入完成: {} 行, 耗时: {}ms", 
                        count, copy_start.elapsed().as_millis());
                }
                Err(e) => {
                    log::warn!("COPY 命令失败，回退到传统方式: {}", e);
                    count = import_using_traditional_method(&conn, &safe_table_name, &column_names, &request)?;
                }
            }
            // 清理临时文件（异步删除，避免阻塞）
            let csv_path_clone = csv_path.clone();
            tokio::spawn(async move {
                if let Err(e) = tokio::fs::remove_file(&csv_path_clone).await {
                    log::warn!("异步删除临时文件失败: {} - {}", csv_path_clone, e);
                } else {
                    log::info!("异步删除临时文件成功: {}", csv_path_clone);
                }
            });
        } else if request.sheet_name.is_none() {
            // CSV 文件：直接使用 COPY 命令
            let copy_start = Instant::now();
            match DatabaseService::fast_import_csv(&conn, &safe_table_name, &request.file_path, request.has_header) {
                Ok(cnt) => {
                    count = cnt;
                    log::info!("使用 COPY 命令快速导入完成: {} 行, 耗时: {}ms", 
                        count, copy_start.elapsed().as_millis());
                }
                Err(e) => {
                    log::warn!("COPY 命令失败，回退到传统方式: {}", e);
                    count = import_using_traditional_method(&conn, &safe_table_name, &column_names, &request)?;
                }
            }
        } else {
            // 兜底：使用传统方式
            count = import_using_traditional_method(&conn, &safe_table_name, &column_names, &request)?;
        }

        log::info!("导入完成: 成功插入 {} 行", count);

        // 验证计数（走 DatabaseService，避免拼接 SQL）
        if let Ok(actual_count) = DatabaseService::get_row_count(&conn, &safe_table_name) {
            log::info!("验证结果: 表 '{}' 实际包含 {} 行数据", safe_table_name, actual_count);
            if actual_count != count as i64 {
                log::warn!("数据不一致！插入了 {} 行，但表中只有 {} 行", count, actual_count);
            }
        }

        // 刷新 VIEW（仅在 DuckDB 可用时）
        if let Some(duckdb_conn) = duckdb_conn_opt {
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
            duration_ms: Some(overall_start.elapsed().as_millis() as i64),
            details: Some(format!("table_name={}, row_count={}", safe_table_name, count)),
        };
        let _ = crate::services::AuditLogService::record_audit_log(&conn, audit_request);

        log::info!("spawn_blocking 总耗时: {}ms", blocking_start.elapsed().as_millis());

        Ok(format!("成功导入 {} 行到 {} 表 '{}'", count, conn.get_database_type(), safe_table_name))
    });

    // 用 timeout 包装 blocking_task，超时后自动取消
    let result = timeout(import_timeout, blocking_task)
        .await
        .map_err(|_| {
            log::error!("导入执行超时: 文件={}, 超时时间={}秒", file_path_for_timeout_log, import_timeout.as_secs());
            "导入执行超时，请检查文件大小或数据库状态".to_string()
        })?
        .map_err(|e| format!("spawn_blocking 执行失败: {}", e))?;

    log::info!("异步导入任务总耗时: {}ms", overall_start.elapsed().as_millis());
    result
}

/// 写入文本文件
#[tauri::command]
pub fn write_text_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content)
        .map_err(|e| format!("写入文件失败: {}", e))
}
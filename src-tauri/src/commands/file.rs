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

/// 计算导入超时时间（优先使用用户设置，否则根据文件大小动态调整）
fn calculate_import_timeout(file_size: u64, use_copy: bool, user_timeout: Option<u64>) -> Duration {
    if let Some(timeout_secs) = user_timeout {
        return Duration::from_secs(timeout_secs);
    }

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

fn try_decode_all_encodings(data: &[u8], auto_detect: bool, default_encoding: &str) -> String {
    if auto_detect {
        if let Ok(text) = std::str::from_utf8(data) {
            return text.to_string();
        }
        let (text, _) = encoding_rs::GBK.decode_without_bom_handling(data);
        return text.to_string();
    }

    let encoding = match default_encoding {
        "GBK" | "GB2312" => encoding_rs::GBK,
        "UTF-16" => encoding_rs::UTF_16LE,
        "ASCII" => encoding_rs::UTF_8,
        _ => encoding_rs::UTF_8,
    };
    let (text, _) = encoding.decode_without_bom_handling(data);
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

fn parse_txt_line(line: &str, delimiter: &str) -> Vec<String> {
    line.split(delimiter).map(|s| s.trim().to_string()).collect()
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
        log::warn!("文件不存在: {}", file_path);
        return Err("文件不存在，请检查文件路径".to_string());
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
            return Err("无法访问文件，请检查文件是否被占用或路径权限".to_string());
        }
    }

    let mut workbook = open_workbook_auto(file_path).map_err(|e| {
        let error_msg = e.to_string();
        log::error!("打开Excel文件失败: {}", error_msg);
        if error_msg.to_lowercase().contains("password") || error_msg.to_lowercase().contains("encrypted") {
            "Excel文件已加密，请先解密".to_string()
        } else {
            "Excel文件打开失败，请检查文件格式是否正确".to_string()
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
        log::warn!("文件不存在: {}", file_path);
        return Err("文件不存在，请检查文件路径".to_string());
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
            return Err("无法访问文件，请检查文件是否被占用或路径权限".to_string());
        }
    }

    let mut workbook = open_workbook_auto(file_path).map_err(|e| {
        let error_msg = e.to_string();
        log::error!("打开Excel文件失败: {}", error_msg);
        if error_msg.to_lowercase().contains("password") || error_msg.to_lowercase().contains("encrypted") {
            "Excel文件已加密，请先解密".to_string()
        } else {
            "Excel文件打开失败，请检查文件格式是否正确".to_string()
        }
    })?;

    let range = workbook.worksheet_range(sheet_name).map_err(|e| {
        log::error!("[load_excel_sheet_impl] 无法读取Sheet '{}': error={}", sheet_name, e);
        "工作表读取失败，请检查文件格式或表名".to_string()
    })?;

    log::info!("成功加载Sheet '{}'", sheet_name);
    Ok(extract_excel_preview(&range))
}

fn load_all_json_data(file_path: &str, auto_detect_encoding: bool, default_encoding: &str) -> Result<Vec<Vec<String>>, String> {
    let mut file = File::open(file_path)
        .map_err(|e| {
            log::error!("[file] 无法打开文件: error={}", e);
            "文件打开失败，请检查文件是否被占用或路径权限".to_string()
        })?;

    let mut data = Vec::new();
    file.read_to_end(&mut data)
        .map_err(|e| {
            log::error!("[file] 无法读取文件: error={}", e);
            "文件读取失败，请检查文件是否被占用或文件格式".to_string()
        })?;

    let text = try_decode_all_encodings(&data, auto_detect_encoding, default_encoding);

    if text.trim().is_empty() {
        return Err("文件为空".to_string());
    }

    let values = load_json_content(&text)?;

    let mut headers = Vec::new();
    let mut header_set = std::collections::HashSet::new();

    for value in &values {
        if let serde_json::Value::Object(obj) = value {
            for key in obj.keys() {
                if !header_set.contains(key) {
                    header_set.insert(key.clone());
                    headers.push(key.clone());
                }
            }
        }
    }

    let mut rows = Vec::new();
    rows.push(headers.clone());

    for value in values {
        if let serde_json::Value::Object(obj) = value {
            let row: Vec<String> = headers.iter()
                .map(|header| {
                    obj.get(header)
                        .map(|v| match v {
                            serde_json::Value::Null => "".to_string(),
                            serde_json::Value::Bool(b) => b.to_string(),
                            serde_json::Value::Number(n) => n.to_string(),
                            serde_json::Value::String(s) => s.clone(),
                            serde_json::Value::Array(arr) => {
                                serde_json::to_string(arr).unwrap_or_else(|_| "[]".to_string())
                            }
                            serde_json::Value::Object(o) => {
                                serde_json::to_string(o).unwrap_or_else(|_| "{}".to_string())
                            }
                        })
                        .unwrap_or_default()
                })
                .collect();
            rows.push(row);
        }
    }

    Ok(rows)
}

fn load_all_csv_data(file_path: &str, auto_detect_encoding: bool, default_encoding: &str) -> Result<Vec<Vec<String>>, String> {
    let mut file = File::open(file_path)
        .map_err(|e| {
            log::error!("[file] 无法打开文件: error={}", e);
            "文件打开失败，请检查文件是否被占用或路径权限".to_string()
        })?;

    let mut data = Vec::new();
    file.read_to_end(&mut data)
        .map_err(|e| {
            log::error!("[file] 无法读取文件: error={}", e);
            "文件读取失败，请检查文件是否被占用或文件格式".to_string()
        })?;

    let text = try_decode_all_encodings(&data, auto_detect_encoding, default_encoding);
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

fn load_all_txt_data(file_path: &str, delimiter: &str, auto_detect_encoding: bool, default_encoding: &str) -> Result<Vec<Vec<String>>, String> {
    let mut file = File::open(file_path)
        .map_err(|e| {
            log::error!("[file] 无法打开文件: error={}", e);
            "文件打开失败，请检查文件是否被占用或路径权限".to_string()
        })?;

    let mut data = Vec::new();
    file.read_to_end(&mut data)
        .map_err(|e| {
            log::error!("[file] 无法读取文件: error={}", e);
            "文件读取失败，请检查文件是否被占用或文件格式".to_string()
        })?;

    let text = try_decode_all_encodings(&data, auto_detect_encoding, default_encoding);
    let delimiter = if delimiter.is_empty() {
        detect_delimiter(&text)
    } else {
        delimiter.to_string()
    };
    let lines: Vec<&str> = text.lines().collect();

    let mut rows = Vec::new();
    for line in lines {
        if line.trim().is_empty() {
            continue;
        }
        rows.push(parse_txt_line(line, &delimiter));
    }

    Ok(rows)
}

fn load_all_excel_data(file_path: &str, sheet_name: &str) -> Result<Vec<Vec<String>>, String> {
    use calamine::{open_workbook_auto, Reader};
    let path = std::path::Path::new(file_path);
    if !path.exists() {
        log::warn!("[load_all_excel_data] Excel 文件不存在: path={}", file_path);
        return Err("Excel文件不存在，请检查文件路径".to_string());
    }

    let mut workbook = open_workbook_auto(file_path).map_err(|e| {
        log::error!("[file] 无法打开Excel文件: error={}", e);
        "Excel文件打开失败，请检查文件格式是否正确".to_string()
    })?;

    let range = workbook.worksheet_range(sheet_name).map_err(|e| {
        log::error!("[file] 无法读取Sheet '{}': error={}", sheet_name, e);
        "工作表读取失败，请检查文件格式或表名".to_string()
    })?;

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
        log::warn!("[export_excel_to_temp_csv] Excel 文件不存在: path={}", file_path);
        return Err("Excel文件不存在，请检查文件路径".to_string());
    }

    let mut workbook = open_workbook_auto(file_path).map_err(|e| {
        log::error!("[file] 无法打开Excel文件: error={}", e);
        "Excel文件打开失败，请检查文件格式是否正确".to_string()
    })?;

    let range = workbook.worksheet_range(sheet_name).map_err(|e| {
        log::error!("[file] 无法读取Sheet '{}': error={}", sheet_name, e);
        "工作表读取失败，请检查文件格式或表名".to_string()
    })?;

    // 创建应用专属临时目录（Windows: C:\Users\xxx\AppData\Local\quickersql_temp）
    let temp_dir = dirs::data_local_dir()
        .ok_or("无法获取应用数据目录")?
        .join("quickersql_temp");
    
    // 确保临时目录存在
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| {
            log::error!("[export_excel_to_temp_csv] 无法创建临时目录: error={}", e);
            "创建临时目录失败，请检查磁盘空间".to_string()
        })?;
    
    // 创建临时文件路径（UUID 格式避免冲突）
    let temp_path = temp_dir.join(format!("excel_import_{}.csv", uuid::Uuid::new_v4()));
    
    let mut file = File::create(&temp_path)
        .map_err(|e| {
            log::error!("[export_excel_to_temp_csv] 无法创建临时CSV文件: error={}", e);
            "创建临时文件失败，请检查磁盘空间".to_string()
        })?;

    // 写入 BOM 以确保正确的 UTF-8 编码
    file.write_all(&[0xEF, 0xBB, 0xBF])
        .map_err(|e| {
            log::error!("[export_excel_to_temp_csv] 写入BOM失败: error={}", e);
            "临时文件写入失败，请检查磁盘空间".to_string()
        })?;

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
            .map_err(|e| {
                log::error!("[export_excel_to_temp_csv] 写入CSV行失败: error={}", e);
                "临时文件写入失败，请检查磁盘空间".to_string()
            })?;
        
        batch_count += 1;
        
        // 每100行刷盘一次
        if batch_count % BATCH_SIZE == 0 {
            file.flush()
                .map_err(|e| {
                    log::error!("[export_excel_to_temp_csv] 刷盘失败: error={}", e);
                    "临时文件写入失败，请检查磁盘空间".to_string()
                })?;
            log::debug!("已写入 {} 行，执行刷盘", batch_count);
        }
    }
    
    // 最终刷盘确保所有数据写入
    file.flush()
        .map_err(|e| {
            log::error!("[export_excel_to_temp_csv] 最终刷盘失败: error={}", e);
            "临时文件写入失败，请检查磁盘空间".to_string()
        })?;

    Ok(temp_path.to_string_lossy().to_string())
}

/// 处理字段名安全化和类型推断（纯字段推导，不执行任何 DB 操作）
fn prepare_field_info(fields: &[FieldMeta]) -> (Vec<String>, Vec<(String, String)>) {
    let mut column_defs = Vec::new();
    let mut column_names = Vec::new();

    for field in fields {
        let safe_field_name: String = field.name.chars()
            .map(|c| if c.is_alphanumeric() || c == '_' || ('\u{4e00}'..='\u{9fff}').contains(&c) { c } else { '_' })
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

fn load_json_content(text: &str) -> Result<Vec<serde_json::Value>, String> {
    match serde_json::from_str::<Vec<serde_json::Value>>(text) {
        Ok(array) => Ok(array),
        Err(_) => {
            let mut values = Vec::new();
            for line in text.lines() {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }
                match serde_json::from_str::<serde_json::Value>(trimmed) {
                    Ok(value) => values.push(value),
                    Err(e) => {
                        log::error!("[load_json_content] JSON Lines 解析失败: error={}", e);
                        return Err("JSON 数据解析失败，请检查文件格式".to_string());
                    }
                }
            }
            if values.is_empty() {
                return Err("无法解析 JSON 数据".to_string());
            }
            Ok(values)
        }
    }
}

fn extract_json_headers_and_rows(values: Vec<serde_json::Value>) -> CsvPreview {
    let mut headers = Vec::new();
    let mut header_set = std::collections::HashSet::new();

    for value in &values {
        if let serde_json::Value::Object(obj) = value {
            for key in obj.keys() {
                if !header_set.contains(key) {
                    header_set.insert(key.clone());
                    headers.push(key.clone());
                }
            }
        }
    }

    let mut rows = Vec::new();
    for (i, value) in values.into_iter().enumerate() {
        if i >= MAX_PREVIEW_ROWS {
            break;
        }
        if let serde_json::Value::Object(obj) = value {
            let row: Vec<String> = headers.iter()
                .map(|header| {
                    obj.get(header)
                        .map(|v| match v {
                            serde_json::Value::Null => "".to_string(),
                            serde_json::Value::Bool(b) => b.to_string(),
                            serde_json::Value::Number(n) => n.to_string(),
                            serde_json::Value::String(s) => s.clone(),
                            serde_json::Value::Array(arr) => {
                                serde_json::to_string(arr).unwrap_or_else(|_| "[]".to_string())
                            }
                            serde_json::Value::Object(o) => {
                                serde_json::to_string(o).unwrap_or_else(|_| "{}".to_string())
                            }
                        })
                        .unwrap_or_default()
                })
                .collect();
            rows.push(row);
        }
    }

    CsvPreview { headers, rows }
}

/// 加载 JSON 文件预览（支持 JSON 数组和 JSON Lines 格式）
#[tauri::command]
pub fn load_json(
    _state: State<'_, TauriAppState>,
    file_path: String,
    auto_detect_encoding: Option<bool>,
    default_encoding: Option<String>,
) -> Result<CsvPreview, String> {
    let auto_detect = auto_detect_encoding.unwrap_or(true);
    let default_enc = default_encoding.unwrap_or_else(|| "UTF-8".to_string());

    let mut file = File::open(&file_path)
        .map_err(|e| {
            log::error!("[file] 无法打开文件: error={}", e);
            "文件打开失败，请检查文件是否被占用或路径权限".to_string()
        })?;

    let mut data = Vec::new();
    file.read_to_end(&mut data)
        .map_err(|e| {
            log::error!("[file] 无法读取文件: error={}", e);
            "文件读取失败，请检查文件是否被占用或文件格式".to_string()
        })?;

    let text = try_decode_all_encodings(&data, auto_detect, &default_enc);

    if text.trim().is_empty() {
        return Err("文件为空".to_string());
    }

    let values = load_json_content(&text)?;
    Ok(extract_json_headers_and_rows(values))
}

/// 加载 CSV 文件预览
#[tauri::command]
pub fn load_csv(
    _state: State<'_, TauriAppState>,
    file_path: String,
    auto_detect_encoding: Option<bool>,
    default_encoding: Option<String>,
    batch_size: Option<usize>,
) -> Result<CsvPreview, String> {
    let _ = batch_size; // 预留参数，后续用于分批加载大文件预览
    let auto_detect = auto_detect_encoding.unwrap_or(true);
    let default_enc = default_encoding.unwrap_or_else(|| "UTF-8".to_string());

    let mut file = File::open(&file_path)
        .map_err(|e| {
            log::error!("[file] 无法打开文件: error={}", e);
            "文件打开失败，请检查文件是否被占用或路径权限".to_string()
        })?;

    let mut data = Vec::new();
    file.read_to_end(&mut data)
        .map_err(|e| {
            log::error!("[file] 无法读取文件: error={}", e);
            "文件读取失败，请检查文件是否被占用或文件格式".to_string()
        })?;

    let text = try_decode_all_encodings(&data, auto_detect, &default_enc);

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

/// 自动检测 TXT 文件分隔符
///
/// 候选分隔符：逗号、制表符、分号、竖线。取前 5 行非空行，选择能产生最多一致列数的分隔符；
/// 若结果相同，优先级为 逗号 > 制表符 > 分号 > 竖线；若均无法分割，回退到制表符。
fn detect_delimiter(text: &str) -> String {
    const CANDIDATES: &[&str] = &[",", "\t", ";", "|"];
    const SAMPLE_LINES: usize = 5;

    let non_empty_lines: Vec<&str> = text
        .lines()
        .map(|line| line.trim())
        .filter(|line| !line.is_empty())
        .take(SAMPLE_LINES)
        .collect();

    if non_empty_lines.is_empty() {
        return "\t".to_string();
    }

    let mut best_delimiter = "\t";
    let mut best_score = 0;

    for &delim_str in CANDIDATES {
        let counts: Vec<usize> = non_empty_lines
            .iter()
            .map(|line| parse_txt_line(line, delim_str).len())
            .collect();

        let mut freq = std::collections::HashMap::new();
        for &count in &counts {
            *freq.entry(count).or_insert(0) += 1;
        }

        let (mode_count, mode_freq) = freq
            .into_iter()
            .max_by_key(|&(count, f)| (f, count))
            .unwrap_or((1, 0));

        let score = if mode_count > 1 { mode_freq } else { 0 };

        if score > best_score {
            best_score = score;
            best_delimiter = delim_str;
        }
    }

    if best_score == 0 {
        "\t".to_string()
    } else {
        best_delimiter.to_string()
    }
}

/// 加载 TXT 文件预览
#[tauri::command]
pub fn load_txt(
    _state: State<'_, TauriAppState>,
    file_path: String,
    delimiter: Option<String>,
    auto_detect_encoding: Option<bool>,
    default_encoding: Option<String>,
) -> Result<CsvPreview, String> {
    let auto_detect = auto_detect_encoding.unwrap_or(true);
    let default_enc = default_encoding.unwrap_or_else(|| "UTF-8".to_string());

    let mut file = File::open(&file_path)
        .map_err(|e| {
            log::error!("[file] 无法打开文件: error={}", e);
            "文件打开失败，请检查文件是否被占用或路径权限".to_string()
        })?;

    let mut data = Vec::new();
    file.read_to_end(&mut data)
        .map_err(|e| {
            log::error!("[file] 无法读取文件: error={}", e);
            "文件读取失败，请检查文件是否被占用或文件格式".to_string()
        })?;

    let text = try_decode_all_encodings(&data, auto_detect, &default_enc);

    let lines: Vec<&str> = text.lines().collect();
    if lines.is_empty() {
        return Err("文件为空".to_string());
    }

    let delimiter = delimiter
        .filter(|d| !d.is_empty())
        .unwrap_or_else(|| detect_delimiter(&text));

    let headers = parse_txt_line(lines[0], &delimiter);

    let mut rows = Vec::new();
    for (i, line) in lines.iter().skip(1).enumerate() {
        if i >= MAX_PREVIEW_ROWS {
            break;
        }
        if line.trim().is_empty() {
            continue;
        }
        rows.push(parse_txt_line(line, &delimiter));
    }

    Ok(CsvPreview { headers, rows })
}

/// 加载 Parquet 文件预览
#[tauri::command]
pub fn load_parquet(
    state: State<'_, TauriAppState>,
    file_path: String,
) -> Result<CsvPreview, String> {
    log::info!("开始加载 Parquet 文件预览: {}", file_path);

    let path = std::path::Path::new(&file_path);
    if !path.exists() {
        log::warn!("[load_parquet] Parquet 文件不存在: path={}", file_path);
        return Err("文件不存在，请检查文件路径".to_string());
    }

    let duckdb_conn = state.duckdb_manager.get_connection().map_err(|e| {
        log::error!("[load_parquet] 获取 DuckDB 连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;

    let preview = DatabaseService::preview_parquet_file(&duckdb_conn, &file_path, MAX_PREVIEW_ROWS)?;

    log::info!("成功加载 Parquet 文件预览，共 {} 行", preview.rows.len());
    Ok(preview)
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

    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[import_data] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;
    let safe_table_name = request.table_name.replace(' ', "_");
    // 表名安全校验
    let _ = SqlIdentifier::new(&safe_table_name)?;

    // DROP → CREATE → INSERT，全部下沉到 DatabaseService
    DatabaseService::drop_table_if_exists(&conn, &safe_table_name)?;

    let (column_names, columns_schema) = prepare_field_info(&request.fields);
    let schema_slices: Vec<(String, String)> = columns_schema;
    DatabaseService::create_table_from_schema(&conn, &safe_table_name, &schema_slices)?;

    let count = DatabaseService::batch_insert_rows(&conn, &safe_table_name, &column_names, &request.rows, None)?;

    Ok(format!("成功导入 {} 行到 {} 表 '{}'", count, conn.get_database_type(), safe_table_name))
}

fn is_json_file(file_path: &str) -> bool {
    let lower_path = file_path.to_lowercase();
    lower_path.ends_with(".json") || lower_path.ends_with(".jsonl") || lower_path.ends_with(".ndjson")
}

fn is_txt_file(file_path: &str) -> bool {
    file_path.to_lowercase().ends_with(".txt")
}

/// 使用传统方式导入数据（适用于 Excel、JSON、TXT 和 COPY 失败的情况）
fn import_using_traditional_method(
    conn: &crate::database::MutexGuardConnection,
    safe_table_name: &str,
    column_names: &[String],
    request: &ImportRequestV2,
) -> Result<usize, String> {
    let all_rows: Vec<Vec<String>> = match (
        &request.sheet_name,
        is_json_file(&request.file_path),
        is_txt_file(&request.file_path),
    ) {
        (Some(sheet), _, _) => load_all_excel_data(&request.file_path, sheet)?,
        (None, true, _) => load_all_json_data(&request.file_path, true, "UTF-8")?,
        (None, false, true) => {
            load_all_txt_data(&request.file_path, request.delimiter.as_deref().unwrap_or(""), true, "UTF-8")?
        }
        (None, false, false) => load_all_csv_data(&request.file_path, true, "UTF-8")?,
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

    log::info!("开始批量插入, batch_size={:?}", request.batch_size);
    let count = DatabaseService::batch_insert_rows(conn, safe_table_name, column_names, &final_rows, request.batch_size)
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
        log::warn!("[import_data_v2] 文件不存在: path={}", request.file_path);
        return Err("文件不存在，请检查文件路径".to_string());
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
            log::error!("[import_data_v2] 无法访问文件元数据: error={}", e);
            return Err("无法访问文件，请检查文件是否被占用或路径权限".to_string());
        }
    };

    // 从设置中读取最大导入文件大小限制
    let max_file_size_mb = match state.db_manager.get_connection() {
        Ok(conn) => {
            match crate::services::SettingsService::get_setting(&conn, "import", "maxImportFileSize") {
                Ok(Some(setting)) => {
                    setting.value.parse::<u64>().unwrap_or(100)
                }
                _ => 100
            }
        }
        Err(_) => 100
    };
    let max_file_size_bytes = max_file_size_mb * 1024 * 1024;

    // 从设置中读取导入超时时间
    let import_timeout_secs: u64 = match state.db_manager.get_connection() {
        Ok(conn) => {
            match crate::services::SettingsService::get_setting(&conn, "import", "importTimeout") {
                Ok(Some(setting)) => {
                    let secs: i64 = setting.value.parse().unwrap_or(60);
                    secs.clamp(5, 3600) as u64
                }
                _ => 60
            }
        }
        Err(_) => 60
    };

    if file_size > max_file_size_bytes {
        log::warn!("文件大小超过限制: {} bytes > {} bytes ({}MB)", file_size, max_file_size_bytes, max_file_size_mb);
        return Err(format!("文件过大（{:.2}MB），超过最大限制 {}MB，请拆分文件后再导入", 
            file_size as f64 / (1024.0 * 1024.0), max_file_size_mb));
    }

    // 使用用户设置的导入超时时间
    let import_timeout = calculate_import_timeout(file_size, true, Some(import_timeout_secs));
    log::info!("导入超时设置: {}秒 (文件大小: {}MB)",
        import_timeout.as_secs(), file_size / (1024 * 1024));

    // 克隆必要的 Arc 引用，以便在 spawn_blocking 内使用
    // 业务数据表存储在 DuckDB，导入操作统一走 duckdb_manager
    let duckdb_manager = state.duckdb_manager.clone();
    let sqlite_manager = state.db_manager.clone();
    
    // 克隆文件路径用于超时错误日志（request 会在 spawn_blocking 中被移动）
    let file_path_for_timeout_log = request.file_path.clone();

    // 将阻塞 IO 放入 spawn_blocking，并用 timeout 包装
    let blocking_task = tokio::task::spawn_blocking(move || {
        let blocking_start = Instant::now();
        log::info!("进入 spawn_blocking，开始阻塞 IO 操作");

        // 获取 DuckDB 连接（在 spawn_blocking 内）
        let conn = duckdb_manager.get_connection().map_err(|e| {
            log::error!("[import_data_v2] spawn_blocking 内获取 DuckDB 连接失败: error={}", e);
            "数据库连接异常，请重新打开数据库".to_string()
        })?;
        let lock_acquire_time = blocking_start.elapsed();
        log::info!("DuckDB 连接获取耗时: {}ms", lock_acquire_time.as_millis());

        // DB 操作下沉到 DatabaseService
        let drop_create_start = Instant::now();
        DatabaseService::drop_table_if_exists(&conn, &safe_table_name)?;
        let (column_names, columns_schema) = prepare_field_info(&request.fields);
        DatabaseService::create_table_from_schema(&conn, &safe_table_name, &columns_schema)?;
        log::info!("DROP + CREATE 耗时: {}ms", drop_create_start.elapsed().as_millis());

        let count: usize;

        let is_parquet_file = request.file_path.to_lowercase().ends_with(".parquet");

        if is_json_file(&request.file_path) {
            log::info!("JSON 文件，使用传统方式导入...");
            count = import_using_traditional_method(&conn, &safe_table_name, &column_names, &request)?;
        } else if is_txt_file(&request.file_path) {
            log::info!("TXT 文件，跳过 COPY 命令，使用传统方式导入...");
            count = import_using_traditional_method(&conn, &safe_table_name, &column_names, &request)?;
        } else {
            let file_to_import = if let Some(sheet) = &request.sheet_name {
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
            } else if is_parquet_file {
                Some("__PARQUET_FILE__".to_string())
            } else {
                None
            };

            if let Some(file_path_or_marker) = file_to_import {
                if file_path_or_marker == "__PARQUET_FILE__" {
                    let copy_start = Instant::now();
                    log::info!("Parquet 文件，使用 DuckDB COPY 命令导入...");
                    
                    match DatabaseService::fast_import_parquet(&conn, &safe_table_name, &request.file_path) {
                        Ok(cnt) => {
                            count = cnt;
                            log::info!("使用 DuckDB COPY PARQUET 命令导入完成: {} 行, 耗时: {}ms", 
                                count, copy_start.elapsed().as_millis());
                        }
                        Err(e) => {
                            log::warn!("DuckDB COPY PARQUET 命令失败，回退到传统方式: {}", e);
                            count = import_using_traditional_method(&conn, &safe_table_name, &column_names, &request)?;
                        }
                    }
                } else {
                    let copy_start = Instant::now();
                    match DatabaseService::fast_import_csv(&conn, &safe_table_name, &file_path_or_marker, false, None) {
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
                    let csv_path_clone = file_path_or_marker.clone();
                    tokio::spawn(async move {
                        if let Err(e) = tokio::fs::remove_file(&csv_path_clone).await {
                            log::warn!("异步删除临时文件失败: {} - {}", csv_path_clone, e);
                        } else {
                            log::info!("异步删除临时文件成功: {}", csv_path_clone);
                        }
                    });
                }
            } else if request.sheet_name.is_none() {
                let copy_start = Instant::now();
                match DatabaseService::fast_import_csv(
                    &conn,
                    &safe_table_name,
                    &request.file_path,
                    request.has_header,
                    request.delimiter.as_deref(),
                ) {
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
                count = import_using_traditional_method(&conn, &safe_table_name, &column_names, &request)?;
            }
        }

        log::info!("导入完成: 成功插入 {} 行", count);

        // 验证计数（走 DatabaseService，避免拼接 SQL）
        if let Ok(actual_count) = DatabaseService::get_row_count(&conn, &safe_table_name) {
            log::info!("验证结果: 表 '{}' 实际包含 {} 行数据", safe_table_name, actual_count);
            if actual_count != count as i64 {
                log::warn!("数据不一致！插入了 {} 行，但表中只有 {} 行", count, actual_count);
            }
        }

        // 记录审计日志（系统表在 SQLite，使用 sqlite_manager）
        let audit_conn = sqlite_manager.get_connection().ok();
        let audit_request = crate::models::audit_log::RecordAuditLogRequest {
            module: "import".to_string(),
            action: "import_data_v2".to_string(),
            description: format!("导入数据到表 '{}'", safe_table_name),
            status: "success".to_string(),
            duration_ms: Some(overall_start.elapsed().as_millis() as i64),
            details: Some(format!("table_name={}, row_count={}", safe_table_name, count)),
        };
        if let Some(audit_conn) = audit_conn {
            let _ = crate::services::AuditLogService::record_audit_log(&audit_conn, audit_request);
        }

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
        .map_err(|e| {
            log::error!("[import_data_v2] spawn_blocking 执行失败: error={}", e);
            "后台任务执行失败，请重试".to_string()
        })?;

    log::info!("异步导入任务总耗时: {}ms", overall_start.elapsed().as_millis());
    result
}

/// 写入文本文件
#[tauri::command]
pub fn write_text_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content)
        .map_err(|e| {
            log::error!("[write_text_file] 写入文件失败: error={}", e);
            "文件写入失败，请检查磁盘空间或文件权限".to_string()
        })
}

/// 获取文件元数据（大小等）
#[tauri::command]
pub fn get_file_metadata(file_path: String) -> Result<(u64, bool), String> {
    let path = std::path::Path::new(&file_path);
    if !path.exists() {
        return Ok((0, false));
    }
    match std::fs::metadata(path) {
        Ok(metadata) => Ok((metadata.len(), true)),
        Err(e) => {
            log::error!("[get_file_metadata] 获取文件元数据失败: error={}", e);
            Err("获取文件信息失败，请检查文件是否存在".to_string())
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ============ 路径边界测试 ============

    /// 空路径应被拒绝（get_excel_sheets_impl 内部会检测文件存在性）
    #[test]
    fn test_get_excel_sheets_impl_empty_path() {
        let result = get_excel_sheets_impl("");
        assert!(result.is_err(), "空路径应返回错误");
        let msg = result.unwrap_err();
        assert!(
            msg.contains("文件不存在") || msg.contains("访问") || msg.contains("路径"),
            "错误信息应提示路径问题，实际: {}", msg
        );
    }

    /// 不存在的文件路径（相对路径）应被拒绝，返回用户可读错误
    #[test]
    fn test_get_excel_sheets_impl_nonexistent_relative_path() {
        let result = get_excel_sheets_impl("nonexistent_file.xlsx");
        assert!(result.is_err(), "不存在的相对路径应返回错误");
        let msg = result.unwrap_err();
        assert!(msg.contains("文件不存在"), "错误信息应提示文件不存在，实际: {}", msg);
    }

    /// 不存在的文件路径（绝对路径）应被拒绝
    #[test]
    fn test_get_excel_sheets_impl_nonexistent_absolute_path() {
        let result = get_excel_sheets_impl("C:/nonexistent_dir/nonexistent_file.xlsx");
        assert!(result.is_err(), "不存在的绝对路径应返回错误");
        assert!(
            result.unwrap_err().contains("文件不存在"),
            "错误信息应提示文件不存在"
        );
    }

    /// 含空格的路径应被正确处理（此处文件不存在，验证不 panic 且返回可读错误）
    #[test]
    fn test_get_excel_sheets_impl_path_with_spaces() {
        let result = get_excel_sheets_impl("path with spaces/file.xlsx");
        assert!(result.is_err(), "含空格的不存在路径应返回错误");
        assert!(
            result.unwrap_err().contains("文件不存在"),
            "应返回文件不存在的错误"
        );
    }

    /// 含中文字符的路径应被正确处理
    #[test]
    fn test_get_excel_sheets_impl_path_with_chinese() {
        let result = get_excel_sheets_impl("数据目录/测试文件.xlsx");
        assert!(result.is_err(), "含中文的不存在路径应返回错误");
        assert!(
            result.unwrap_err().contains("文件不存在"),
            "中文路径错误应返回文件不存在"
        );
    }

    /// load_excel_sheet_impl 对空路径应返回错误
    #[test]
    fn test_load_excel_sheet_impl_empty_path() {
        let result = load_excel_sheet_impl("", "Sheet1");
        assert!(result.is_err(), "空路径应返回错误");
        assert!(
            result.unwrap_err().contains("文件不存在"),
            "空路径错误信息应提示文件不存在"
        );
    }

    /// load_excel_sheet_impl 对不存在的文件应返回错误
    #[test]
    fn test_load_excel_sheet_impl_nonexistent_file() {
        let result = load_excel_sheet_impl("nonexistent.xlsx", "Sheet1");
        assert!(result.is_err(), "不存在的文件应返回错误");
    }

    /// load_all_excel_data 对不存在的文件应返回错误
    #[test]
    fn test_load_all_excel_data_nonexistent_file() {
        let result = load_all_excel_data("nonexistent.xlsx", "Sheet1");
        assert!(result.is_err(), "不存在的 Excel 文件应返回错误");
        assert!(
            result.unwrap_err().contains("Excel文件不存在"),
            "错误信息应提示 Excel 文件不存在"
        );
    }

    /// export_excel_to_temp_csv 对不存在的文件应返回错误
    #[test]
    fn test_export_excel_to_temp_csv_nonexistent_file() {
        let result = export_excel_to_temp_csv("nonexistent.xlsx", "Sheet1", true);
        assert!(result.is_err(), "不存在的 Excel 文件导出应返回错误");
        assert!(
            result.unwrap_err().contains("Excel文件不存在"),
            "导出错误信息应提示 Excel 文件不存在"
        );
    }

    // ============ 扩展名识别测试 ============

    /// is_json_file 应正确识别 JSON 系列扩展名
    #[test]
    fn test_is_json_file_supported_extensions() {
        assert!(is_json_file("data.json"), ".json 应识别为 JSON 文件");
        assert!(is_json_file("data.jsonl"), ".jsonl 应识别为 JSON 文件");
        assert!(is_json_file("data.ndjson"), ".ndjson 应识别为 JSON 文件");
        assert!(is_json_file("DATA.JSON"), "大写扩展名应识别为 JSON 文件");
    }

    /// is_json_file 对非 JSON 扩展名应返回 false
    #[test]
    fn test_is_json_file_unsupported_extensions() {
        assert!(!is_json_file("data.exe"), ".exe 不应识别为 JSON 文件");
        assert!(!is_json_file("data.bat"), ".bat 不应识别为 JSON 文件");
        assert!(!is_json_file("data.csv"), ".csv 不应识别为 JSON 文件");
        assert!(!is_json_file("data.xlsx"), ".xlsx 不应识别为 JSON 文件");
        assert!(!is_json_file("data.txt"), ".txt 不应识别为 JSON 文件");
    }

    /// is_txt_file 应正确识别 TXT 扩展名
    #[test]
    fn test_is_txt_file_supported_extensions() {
        assert!(is_txt_file("data.txt"), ".txt 应识别为 TXT 文件");
        assert!(is_txt_file("DATA.TXT"), "大写 .TXT 应识别为 TXT 文件");
    }

    /// is_txt_file 对非 TXT 扩展名应返回 false
    #[test]
    fn test_is_txt_file_unsupported_extensions() {
        assert!(!is_txt_file("data.exe"), ".exe 不应识别为 TXT 文件");
        assert!(!is_txt_file("data.bat"), ".bat 不应识别为 TXT 文件");
        assert!(!is_txt_file("data.csv"), ".csv 不应识别为 TXT 文件");
        assert!(!is_txt_file("data.json"), ".json 不应识别为 TXT 文件");
    }

    // ============ calculate_import_timeout 测试 ============

    /// 用户自定义超时应优先生效
    #[test]
    fn test_calculate_import_timeout_user_override() {
        let result = calculate_import_timeout(1024, true, Some(120));
        assert_eq!(result, Duration::from_secs(120), "用户自定义超时应优先生效");
    }

    /// 小文件 + COPY 模式应使用基础 COPY 超时
    #[test]
    fn test_calculate_import_timeout_small_file_copy() {
        let result = calculate_import_timeout(1024, true, None);
        assert_eq!(
            result, Duration::from_secs(COPY_TIMEOUT_SECS),
            "小文件 + COPY 应使用 COPY 基础超时"
        );
    }

    /// 小文件 + 传统模式应使用基础传统超时
    #[test]
    fn test_calculate_import_timeout_small_file_traditional() {
        let result = calculate_import_timeout(1024, false, None);
        assert_eq!(
            result, Duration::from_secs(TRADITIONAL_TIMEOUT_SECS),
            "小文件 + 传统模式应使用传统基础超时"
        );
    }

    /// 大文件应在基础超时上增加每 MB 超时
    #[test]
    fn test_calculate_import_timeout_large_file() {
        // 15MB 文件，超出 10MB 阈值 5MB，应增加 5 * 2 = 10 秒
        let file_size: u64 = 15 * 1024 * 1024;
        let result = calculate_import_timeout(file_size, true, None);
        let expected = Duration::from_secs(COPY_TIMEOUT_SECS + 5 * TIMEOUT_PER_MB_SECS);
        assert_eq!(result, expected, "大文件应按每 MB 增加超时");
    }

    // ============ CsvRow::parse 测试 ============

    /// 简单 CSV 行应正确解析
    #[test]
    fn test_csv_row_parse_simple() {
        let row = CsvRow::parse("a,b,c").expect("简单 CSV 行应解析成功");
        assert_eq!(row.fields, vec!["a", "b", "c"], "字段应正确分割");
    }

    /// 含引号的 CSV 行应正确解析（引号内逗号不分割）
    #[test]
    fn test_csv_row_parse_quoted() {
        let row = CsvRow::parse("\"a,b\",c").expect("含引号 CSV 行应解析成功");
        assert_eq!(row.fields.len(), 2, "引号内逗号不应分割字段");
        assert_eq!(row.fields[0], "a,b", "引号内逗号应保留");
        assert_eq!(row.fields[1], "c", "非引号字段应正确解析");
    }

    /// 转义引号应正确解析（"" → "）
    #[test]
    fn test_csv_row_parse_escaped_quotes() {
        let row = CsvRow::parse("\"a\"\"b\",c").expect("转义引号 CSV 行应解析成功");
        assert_eq!(row.fields[0], "a\"b", "转义引号应还原为单引号");
    }

    /// 空行应返回单个空字段（不 panic）
    #[test]
    fn test_csv_row_parse_empty_line() {
        let row = CsvRow::parse("").expect("空行不应 panic");
        assert_eq!(row.fields, vec![""], "空行应返回单字段空字符串");
    }

    // ============ parse_txt_line 测试 ============

    /// 基本分隔符解析
    #[test]
    fn test_parse_txt_line_comma() {
        let fields = parse_txt_line("a, b, c", ",");
        assert_eq!(fields, vec!["a", "b", "c"], "逗号分隔应正确解析并 trim");
    }

    /// 制表符分隔
    #[test]
    fn test_parse_txt_line_tab() {
        let fields = parse_txt_line("a\tb\tc", "\t");
        assert_eq!(fields, vec!["a", "b", "c"], "制表符分隔应正确解析");
    }

    /// 空分隔符的行为由 Rust split 实现：按字符分割（边界含空串）
    ///
    /// 注意：生产代码中 load_txt 会先过滤掉空分隔符（改用 detect_delimiter），
    /// 此处仅记录 split("") 的实际行为，避免调用方误以为会得到整行单字段。
    #[test]
    fn test_parse_txt_line_empty_delimiter_splits_by_char() {
        let fields = parse_txt_line("abc", "");
        // Rust 的 split("") 行为：["", "a", "b", "c", ""]（首尾各有一个空串）
        assert_eq!(fields.len(), 5, "空分隔符会按字符分割（首尾含空串）");
    }

    // ============ detect_delimiter 测试 ============

    /// 逗号分隔的文本应检测出逗号
    #[test]
    fn test_detect_delimiter_comma() {
        let text = "a,b,c\n1,2,3\n4,5,6";
        let delim = detect_delimiter(text);
        assert_eq!(delim, ",", "应检测出逗号分隔符");
    }

    /// 制表符分隔的文本应检测出制表符
    #[test]
    fn test_detect_delimiter_tab() {
        let text = "a\tb\tc\n1\t2\t3\n4\t5\t6";
        let delim = detect_delimiter(text);
        assert_eq!(delim, "\t", "应检测出制表符分隔符");
    }

    /// 空文本应回退到制表符
    #[test]
    fn test_detect_delimiter_empty_text() {
        let delim = detect_delimiter("");
        assert_eq!(delim, "\t", "空文本应回退到制表符");
    }

    /// 无法分割的文本应回退到制表符
    #[test]
    fn test_detect_delimiter_no_separator() {
        let delim = detect_delimiter("abcdef\nghijkl");
        assert_eq!(delim, "\t", "无法分割的文本应回退到制表符");
    }

    // ============ try_decode_all_encodings 测试 ============

    /// UTF-8 自动检测应正确解码
    #[test]
    fn test_try_decode_all_encodings_utf8_auto() {
        let text = "你好，世界";
        let data = text.as_bytes();
        let decoded = try_decode_all_encodings(data, true, "UTF-8");
        assert_eq!(decoded, text, "UTF-8 文本应正确解码");
    }

    /// 指定 GBK 编码应正确解码
    #[test]
    fn test_try_decode_all_encodings_gbk() {
        // "你好" 的 GBK 编码字节
        let gbk_bytes: &[u8] = &[0xC4, 0xE3, 0xBA, 0xC3];
        let decoded = try_decode_all_encodings(gbk_bytes, false, "GBK");
        assert_eq!(decoded, "你好", "GBK 编码应正确解码为中文");
    }

    /// 空字节数组应返回空字符串（不 panic）
    #[test]
    fn test_try_decode_all_encodings_empty() {
        let decoded = try_decode_all_encodings(&[], true, "UTF-8");
        assert_eq!(decoded, "", "空字节数组应返回空字符串");
    }

    // ============ load_json_content 测试 ============

    /// JSON 数组应正确解析
    #[test]
    fn test_load_json_content_array() {
        let text = r#"[{"name":"alice","age":30},{"name":"bob","age":25}]"#;
        let values = load_json_content(text).expect("JSON 数组应解析成功");
        assert_eq!(values.len(), 2, "应解析出 2 个对象");
    }

    /// JSON Lines 格式应正确解析
    #[test]
    fn test_load_json_content_jsonl() {
        let text = "{\"name\":\"alice\"}\n{\"name\":\"bob\"}";
        let values = load_json_content(text).expect("JSON Lines 应解析成功");
        assert_eq!(values.len(), 2, "应解析出 2 个 JSON Lines 对象");
    }

    /// 非法 JSON 应返回错误
    #[test]
    fn test_load_json_content_invalid() {
        let result = load_json_content("not a json");
        assert!(result.is_err(), "非法 JSON 应返回错误");
    }

    /// 空文本（仅空白行）应返回错误
    #[test]
    fn test_load_json_content_empty() {
        let result = load_json_content("   \n  \n");
        assert!(result.is_err(), "空白文本应返回错误");
    }

    // ============ prepare_field_info 测试 ============

    /// 基本字段应正确推导列名和类型
    #[test]
    fn test_prepare_field_info_basic() {
        let fields = vec![
            FieldMeta { name: "id".to_string(), data_type: "INTEGER".to_string() },
            FieldMeta { name: "name".to_string(), data_type: "TEXT".to_string() },
            FieldMeta { name: "price".to_string(), data_type: "REAL".to_string() },
        ];
        let (column_names, column_defs) = prepare_field_info(&fields);
        assert_eq!(column_names, vec!["id", "name", "price"], "列名应保留原值");
        assert_eq!(column_defs[0].1, "INTEGER", "INTEGER 类型应保留");
        assert_eq!(column_defs[1].1, "TEXT", "TEXT 类型应保留");
        assert_eq!(column_defs[2].1, "REAL", "REAL 类型应保留");
    }

    /// 含特殊字符的字段名应被安全化（非字母数字/下划线/中文 → 下划线）
    #[test]
    fn test_prepare_field_info_special_chars() {
        let fields = vec![
            FieldMeta { name: "user-name".to_string(), data_type: "TEXT".to_string() },
            FieldMeta { name: "price$".to_string(), data_type: "REAL".to_string() },
        ];
        let (column_names, _) = prepare_field_info(&fields);
        assert_eq!(column_names[0], "user_name", "连字符应被替换为下划线");
        assert_eq!(column_names[1], "price_", "美元符号应被替换为下划线");
    }

    /// 全特殊字符的字段名应回退为 column_N
    #[test]
    fn test_prepare_field_info_all_special_chars() {
        let fields = vec![
            FieldMeta { name: "$$$".to_string(), data_type: "TEXT".to_string() },
        ];
        let (column_names, _) = prepare_field_info(&fields);
        assert_eq!(column_names[0], "column_1", "全特殊字符应回退为 column_N");
    }

    /// 以数字开头的字段名应加 col_ 前缀
    #[test]
    fn test_prepare_field_info_leading_digit() {
        let fields = vec![
            FieldMeta { name: "1col".to_string(), data_type: "TEXT".to_string() },
        ];
        let (column_names, _) = prepare_field_info(&fields);
        assert_eq!(column_names[0], "col_1col", "数字开头应加 col_ 前缀");
    }

    /// 中文字段名应保留（符合安全字符集）
    #[test]
    fn test_prepare_field_info_chinese_name() {
        let fields = vec![
            FieldMeta { name: "姓名".to_string(), data_type: "TEXT".to_string() },
        ];
        let (column_names, _) = prepare_field_info(&fields);
        assert_eq!(column_names[0], "姓名", "中文字段名应保留");
    }
}
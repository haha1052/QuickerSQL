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

fn try_decode_all_encodings(data: &[u8])
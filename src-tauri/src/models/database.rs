//! 数据库相关数据结构
//! 从 lib.rs 迁移的类型定义
use serde::{Deserialize, Serialize};

/// 数据库状态
#[derive(Debug, Clone, Serialize)]
pub struct DatabaseStatus {
    pub db_type: String,
    pub tables: Vec<String>,
    pub row_count: Vec<(String, i64)>,
    pub is_connected: bool,
}

/// 单条 SQL 执行结果
#[derive(Debug, Clone, Serialize)]
pub struct SqlStatementResult {
    pub statement: String,
    pub success: bool,
    pub error: Option<String>,
    pub columns: Option<Vec<String>>,
    pub rows: Option<Vec<Vec<String>>>,
    pub affected_rows: Option<u64>,
    pub engine: Option<String>,
    #[serde(rename = "executionTimeMs")]
    pub execution_time_ms: Option<i64>,
}

/// 批量 SQL 执行结果
#[derive(Debug, Clone, Serialize)]
pub struct BatchExecuteResult {
    pub results: Vec<SqlStatementResult>,
    pub success_count: usize,
    pub fail_count: usize,
}

/// 项目信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInfo {
    pub id: String,                    // UUID
    pub name: String,                  // 项目显示名
    pub db_path: String,               // 数据库文件相对路径
    pub created_at: String,            // ISO 8601 时间
    pub updated_at: String,            // ISO 8601 时间
    pub last_opened_at: Option<String>, // 最近打开时间
    pub description: Option<String>,    // 描述
}

/// Sheet 信息
#[derive(Debug, Clone, Serialize)]
pub struct SheetInfo {
    pub name: String,
    pub row_count: usize,
    pub column_count: usize,
}

/// Excel 预览数据
#[derive(Debug, Clone, Serialize)]
pub struct ExcelPreview {
    pub sheets: Vec<SheetInfo>,
    pub active_sheet_preview: Option<CsvPreview>,
}

/// CSV 预览数据
#[derive(Debug, Clone, Serialize)]
pub struct CsvPreview {
    pub headers: Vec<String>,
    pub rows: Vec<Vec<String>>,
}

/// 字段元信息
#[derive(Debug, Clone, Deserialize)]
pub struct FieldMeta {
    pub name: String,
    #[serde(rename = "dataType")]
    pub data_type: String,
}

/// V1 导入请求（已废弃）
#[derive(Debug, Clone, Deserialize)]
pub struct ImportRequest {
    pub rows: Vec<Vec<String>>,
    pub table_name: String,
    pub fields: Vec<FieldMeta>,
}

/// V2 导入请求
#[derive(Debug, Clone, Deserialize)]
pub struct ImportRequestV2 {
    pub file_path: String,
    pub sheet_name: Option<String>,
    pub table_name: String,
    pub has_header: bool,
    pub fields: Vec<FieldMeta>,
    pub batch_size: Option<usize>,
    pub delimiter: Option<String>,
}

/// 数据库信息
#[derive(Debug, Clone, Serialize)]
pub struct DatabaseInfo {
    pub db_type: String,
    pub name: String,
    pub is_available: bool,
    pub description: String,
}

/// 表基本信息（列表页用 —— 含 rowCount/columnCount/isSystemTable）
#[derive(Debug, Clone, Serialize)]
pub struct TableInfo {
    pub name: String,
    pub row_count: i64,
    pub column_count: i64,
    pub is_system_table: bool,
}

/// 列元信息（点击表箭头展开时返回）
#[derive(Debug, Clone, Serialize)]
pub struct ColumnInfo {
    pub name: String,
    pub data_type: String,
    pub nullable: bool,
    pub default_value: Option<String>,
    pub is_primary_key: bool,
    pub position: i64,
}

/// 表扩展元信息（索引数 + 估算磁盘大小）
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct TableMetaInfo {
    pub index_count: i64,
    pub size_bytes: i64,
}

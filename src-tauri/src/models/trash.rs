//! 回收站数据结构
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

/// 回收站策略
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum TrashStrategy {
    /// 重命名策略（小表）
    Rename,
    /// Parquet 导出策略（大表）
    Parquet,
}

/// 回收站项
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrashItem {
    /// 回收站项 ID
    pub id: String,
    /// 原始表名
    pub original_table_name: String,
    /// 回收站表名（重命名策略时）
    pub trash_table_name: Option<String>,
    /// 回收站文件路径（Parquet 策略时）
    pub trash_file_path: Option<String>,
    /// 行数
    pub row_count: u64,
    /// 使用的策略
    pub strategy: TrashStrategy,
    /// 删除时间
    pub deleted_at: DateTime<Utc>,
    /// 删除者
    pub deleted_by: Option<String>,
}

/// 创建回收站项的请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTrashItemRequest {
    /// 原始表名
    pub original_table_name: String,
    /// 行数
    pub row_count: u64,
}

/// 回收站列表响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrashListResponse {
    /// 回收站项列表
    pub items: Vec<TrashItem>,
    /// 总数
    pub total: usize,
    /// 总占用空间（字节）
    pub total_size_bytes: Option<u64>,
}

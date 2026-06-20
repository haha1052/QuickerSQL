//! 查询历史数据结构
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

/// 查询历史项
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryHistoryItem {
    /// 历史记录 ID
    pub id: String,
    /// SQL 内容
    pub sql: String,
    /// 名称（可选）
    pub name: Option<String>,
    /// 执行时间
    pub executed_at: DateTime<Utc>,
    /// 执行耗时（毫秒）
    pub execution_time_ms: Option<i64>,
    /// 返回行数
    pub row_count: Option<i64>,
    /// 是否成功
    pub success: bool,
    /// 错误消息（失败时）
    pub error_message: Option<String>,
    /// 是否收藏
    pub is_favorite: bool,
    /// 标签（逗号分隔）
    pub tags: Option<String>,
}

/// 查询历史列表请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryHistoryListRequest {
    /// 搜索关键词
    pub search: Option<String>,
    /// 只看收藏
    pub only_favorites: Option<bool>,
    /// 分页偏移
    pub offset: Option<i64>,
    /// 分页大小
    pub limit: Option<i64>,
}

/// 查询历史列表响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryHistoryListResponse {
    /// 历史记录列表
    pub items: Vec<QueryHistoryItem>,
    /// 总数
    pub total: i64,
}

/// 记录查询历史的请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordQueryHistoryRequest {
    /// SQL 内容
    pub sql: String,
    /// 名称
    pub name: Option<String>,
    /// 执行耗时（毫秒）
    pub execution_time_ms: Option<i64>,
    /// 返回行数
    pub row_count: Option<i64>,
    /// 是否成功
    pub success: bool,
    /// 错误消息
    pub error_message: Option<String>,
}

/// 更新收藏状态的请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateFavoriteRequest {
    /// 历史记录 ID
    pub id: String,
    /// 是否收藏
    pub is_favorite: bool,
}

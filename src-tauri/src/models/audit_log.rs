//! 审计日志数据结构
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

/// 审计日志项
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditLogItem {
    /// 日志 ID
    pub id: String,
    /// 时间戳
    pub timestamp: DateTime<Utc>,
    /// 模块: "sql" | "import" | "project" | "settings" | "trash" | "chart"
    pub module: String,
    /// 操作: "query" | "import" | "create" | "delete" | "open" | "update"
    pub action: String,
    /// 人类可读描述
    pub description: String,
    /// 状态: "success" | "failed"
    pub status: String,
    /// 执行耗时（毫秒）
    pub duration_ms: Option<i64>,
    /// 附加信息（JSON 字符串）
    pub details: Option<String>,
}

/// 记录审计日志的请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordAuditLogRequest {
    /// 模块
    pub module: String,
    /// 操作
    pub action: String,
    /// 描述
    pub description: String,
    /// 状态
    pub status: String,
    /// 执行耗时（毫秒）
    pub duration_ms: Option<i64>,
    /// 附加信息（JSON 字符串）
    pub details: Option<String>,
}

/// 查询审计日志的请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryAuditLogsRequest {
    /// 模块过滤
    pub module: Option<String>,
    /// 状态过滤
    pub status: Option<String>,
    /// 开始时间（ISO 8601）
    pub start_time: Option<String>,
    /// 结束时间（ISO 8601）
    pub end_time: Option<String>,
    /// 分页大小（默认 100）
    pub limit: Option<i64>,
    /// 分页偏移（默认 0）
    pub offset: Option<i64>,
}

/// 审计日志列表响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditLogsListResponse {
    /// 日志列表
    pub items: Vec<AuditLogItem>,
    /// 总数
    pub total: i64,
}

//! DuckDB 相关数据结构
use serde::Serialize;

#[derive(Serialize, Clone, Debug)]
pub struct DuckDbInitStatus {
    pub success: bool,
    pub view_count: i32,
    pub total_tables: i32,
    pub duration_ms: i64,
    pub trigger: String,
}
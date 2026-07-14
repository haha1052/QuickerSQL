//! SQL 片段数据结构
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SqlSnippet {
    pub id: String,
    pub name: String,
    pub sql: String,
    pub description: Option<String>,
    pub category: Option<String>,
    pub tags: Option<String>,
    pub is_favorite: bool,
    pub created_at: String,
    pub updated_at: String,
}

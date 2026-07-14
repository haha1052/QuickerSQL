//! 项目管理相关数据结构
//!
//! 本文件定义项目管理专用结构体，与 database.rs 中的 ProjectInfo 互补。
//! ProjectInfo 已经在 database.rs 中定义，这里定义注册表专用的结构。

use serde::{Deserialize, Serialize};

/// 项目注册表记录（对应 __projects_registry 表的一行）
/// 用于全局项目管理，存储在 projects.db 中
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRegistryEntry {
    pub id: String,                     // UUID，主键
    pub name: String,                   // 项目显示名
    pub db_path: String,                // 数据库文件相对路径，如 "projects/<uuid>/meta.db"
    pub created_at: String,             // ISO 8601 创建时间
    pub updated_at: String,             // ISO 8601 更新时间
    pub last_opened_at: Option<String>, // 最近打开时间
    pub description: Option<String>,    // 项目描述
}

/// 项目内部信息表记录（对应每个项目 meta.db 中的 __project_info 表）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInternalInfo {
    pub id: String,            // 与注册表一致的 UUID
    pub name: String,          // 项目名（冗余存储，方便导入导出）
    pub created_at: String,    // 创建时间
    pub schema_version: i32,   // 数据库结构版本号
}

//! 应用状态数据结构
//! 负责存储应用级别的全局状态（如是否首次启动、当前版本、工作区布局等）
//!
//! 设计原则：
//! - 使用键值对结构，便于未来扩展新的状态
//! - 与 Settings 分离：Settings 是用户可更改的偏好设置，AppState 是系统内部状态
//! - 所有状态对前端只读，只能通过专门的接口更新

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

/// 应用状态项
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppStateItem {
    /// 状态分类（如 "system", "welcome", "workspace"）
    pub category: String,
    /// 状态键（如 "has_launched", "version"）
    pub key: String,
    /// 值（字符串，按需在前端解析）
    pub value: String,
    /// 描述（仅调试用）
    pub description: Option<String>,
    /// 创建时间
    pub created_at: DateTime<Utc>,
    /// 更新时间
    pub updated_at: DateTime<Utc>,
}

/// 获取应用状态的响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppStateResponse {
    pub category: String,
    pub key: String,
    pub value: String,
}

/// 更新应用状态的请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateAppStateRequest {
    pub category: String,
    pub key: String,
    pub value: String,
    pub description: Option<String>,
}

/// 批量获取应用状态的响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppStateBatchResponse {
    pub items: Vec<AppStateResponse>,
}

/// 工作区面板（用于持久化工作区布局）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspacePanel {
    /// 面板 ID（前端生成，如 "panel_1718000000000"）
    pub id: String,
    /// 面板类型（"sql_editor", "results_grid", "chart"）
    pub panel_type: String,
    /// 面板标题（显示在 UI 上）
    pub title: String,
    /// 面板大小（百分比，相对整个工作区）
    pub size: i32,
    /// 关联的 SQL 内容（当面板类型为 sql_editor 时）
    pub sql_content: Option<String>,
    /// 是否已激活
    pub is_active: bool,
    /// 排序位置（用于还原布局顺序）
    pub position: i32,
    /// 创建时间
    pub created_at: DateTime<Utc>,
    /// 更新时间
    pub updated_at: DateTime<Utc>,
}

/// 工作区 Tab（用于持久化 Tab）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceTab {
    /// Tab ID
    pub id: String,
    /// Tab 标题
    pub title: String,
    /// Tab 类型
    pub tab_type: String,
    /// 排序位置
    pub position: i32,
    /// 是否是当前激活的 Tab
    pub is_active: bool,
    /// 面板列表
    pub panels: Vec<WorkspacePanel>,
    /// 创建时间
    pub created_at: DateTime<Utc>,
    /// 更新时间
    pub updated_at: DateTime<Utc>,
}

/// 保存工作区的请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveWorkspaceRequest {
    pub tabs: Vec<WorkspaceTab>,
}

/// 加载工作区的响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadWorkspaceResponse {
    pub tabs: Vec<WorkspaceTab>,
}

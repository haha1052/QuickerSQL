//! 设置数据结构
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

/// 设置值类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SettingValueType {
    /// 字符串
    String,
    /// 数字
    Number,
    /// 布尔值
    Boolean,
    /// 选择（下拉菜单）
    Select,
    /// 多选
    MultiSelect,
}

/// 设置元数据（定义信息，不包含用户修改的值）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingMeta {
    /// 分类
    pub category: String,
    /// 键
    pub key: String,
    /// 值类型
    pub value_type: SettingValueType,
    /// 默认值
    pub default_value: String,
    /// 描述
    pub description: Option<String>,
    /// 选项（JSON 格式）
    pub options: Option<String>,
    /// 最小值（数值类型用）
    pub min_value: Option<f64>,
    /// 最大值（数值类型用）
    pub max_value: Option<f64>,
    /// 步长（数值类型用）
    pub step: Option<f64>,
    /// 是否可见
    pub is_visible: bool,
    /// 是否为系统设置
    pub is_system: bool,
    /// 是否已实现（前端只渲染已实现的）
    pub is_implemented: bool,
}

/// 设置元数据分类
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingMetaCategory {
    /// 分类 ID
    pub id: String,
    /// 分类名称
    pub name: String,
    /// 分类图标
    pub icon: Option<String>,
    /// 设置元数据列表
    pub items: Vec<SettingMeta>,
}

/// 设置元数据列表响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingsMetaResponse {
    /// 分类列表
    pub categories: Vec<SettingMetaCategory>,
    /// 总设置项数
    pub total_items: usize,
}

/// 设置项
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingItem {
    /// 设置项 ID
    pub id: String,
    /// 分类
    pub category: String,
    /// 键
    pub key: String,
    /// 值（已序列化的字符串）
    pub value: String,
    /// 值类型
    pub value_type: SettingValueType,
    /// 描述
    pub description: Option<String>,
    /// 选项（JSON 格式）
    pub options: Option<String>,
    /// 是否可见
    pub is_visible: bool,
    /// 是否为系统设置
    pub is_system: bool,
    /// 更新时间
    pub updated_at: DateTime<Utc>,
}

/// 设置分类
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingCategory {
    /// 分类 ID
    pub id: String,
    /// 分类名称
    pub name: String,
    /// 分类图标
    pub icon: Option<String>,
    /// 设置项列表
    pub items: Vec<SettingItem>,
}

/// 获取设置的请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetSettingRequest {
    /// 分类
    pub category: Option<String>,
    /// 键
    pub key: Option<String>,
}

/// 更新设置的请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateSettingRequest {
    /// 分类
    pub category: String,
    /// 键
    pub key: String,
    /// 值（已序列化的字符串）
    pub value: String,
}

/// 批量更新设置的请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchUpdateSettingsRequest {
    /// 设置项列表
    pub settings: Vec<UpdateSettingRequest>,
}

/// 重置设置的请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResetSettingsRequest {
    /// 分类（None 表示重置所有）
    pub category: Option<String>,
}

/// 设置列表响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingsListResponse {
    /// 分类列表
    pub categories: Vec<SettingCategory>,
    /// 总设置项数
    pub total_items: usize,
}

/// 导出设置响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportSettingsResponse {
    /// 版本
    pub version: String,
    /// 导出时间
    pub exported_at: DateTime<Utc>,
    /// 设置数据
    pub settings: Vec<SettingItem>,
}

/// 导入设置请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportSettingsRequest {
    /// 版本
    pub version: String,
    /// 设置数据
    pub settings: Vec<SettingItem>,
}

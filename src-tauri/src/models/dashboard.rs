//! Dashboard 数据结构
use serde::{Deserialize, Serialize};

/// 查询参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryParam {
    pub name: String,
    #[serde(rename = "type")]
    pub param_type: String,
    pub default: String,
    pub options: Option<Vec<String>>,
    pub label: String,
}

/// 查询结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<String>>,
}

/// 保存的查询
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedQuery {
    pub id: String,
    pub name: String,
    pub sql: String,
    pub params: Vec<QueryParam>,
    #[serde(rename = "cacheTtlSecs")]
    pub cache_ttl_secs: i64,
    #[serde(rename = "lastResult")]
    pub last_result: Option<QueryResult>,
    #[serde(rename = "lastRunAt")]
    pub last_run_at: Option<i64>,
    #[serde(rename = "createdBy")]
    pub created_by: String,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

/// 图表过滤器
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChartFilter {
    pub field: String,
    pub operator: String,
    pub value: String,
}

/// 图表类型
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedChart {
    pub id: String,
    pub name: String,
    #[serde(rename = "queryId")]
    pub query_id: String,
    pub sql: String,
    #[serde(rename = "chartType")]
    pub chart_type: String,
    #[serde(rename = "xAxis")]
    pub x_axis: String,
    #[serde(rename = "yAxis")]
    pub y_axis: Vec<String>,
    pub title: String,
    pub filters: Vec<ChartFilter>,
    pub tags: Vec<String>,
    pub description: String,
    pub thumbnail: Option<String>,
    pub config: Option<serde_json::Value>,
    /// 授权范围: "all" = 所有仪表盘可用; "restricted" = 仅指定仪表盘可用
    pub visibility: String,
    /// visibility = "restricted" 时生效，记录允许使用的仪表盘 ID
    #[serde(rename = "authorizedDashboardIds")]
    pub authorized_dashboard_ids: Vec<String>,
    /// 最近一次执行结果缓存（供自动化任务 refresh_chart 使用）
    #[serde(rename = "lastResult")]
    pub last_result: Option<QueryResult>,
    /// 最近一次执行时间戳（秒）
    #[serde(rename = "lastRunAt")]
    pub last_run_at: Option<i64>,
    #[serde(rename = "createdBy")]
    pub created_by: String,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

/// 仪表盘过滤器
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardFilter {
    pub id: String,
    pub field: String,
    pub label: String,
    #[serde(rename = "type")]
    pub filter_type: String,
    #[serde(rename = "defaultValue")]
    pub default_value: serde_json::Value,
    pub options: Option<Vec<String>>,
}

/// 仪表盘项目（图表在仪表盘中的位置和配置覆盖）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardItem {
    pub id: String,
    #[serde(rename = "dashboardId")]
    pub dashboard_id: String,
    #[serde(rename = "chartId")]
    pub chart_id: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    #[serde(rename = "configOverrides")]
    pub config_overrides: Option<serde_json::Value>,
    pub position: i32,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

/// 仪表盘项布局更新参数（用于批量保存布局）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardItemLayoutUpdate {
    pub id: String,
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub width: Option<f64>,
    pub height: Option<f64>,
}

/// 仪表盘
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Dashboard {
    pub id: String,
    pub name: String,
    pub description: String,
    pub layout: Vec<DashboardItem>,
    pub filters: Vec<DashboardFilter>,
    #[serde(rename = "refreshIntervalSecs")]
    pub refresh_interval_secs: i64,
    #[serde(rename = "isDefault")]
    pub is_default: bool,
    #[serde(rename = "createdBy")]
    pub created_by: String,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
    // 背景设置
    pub background_color: Option<String>,
    pub background_image: Option<String>,
    pub canvas_width: Option<i64>,
    pub canvas_height: Option<i64>,
    pub padding: Option<i64>,
    pub grid_gap: i64,
    pub row_height: i64,
    pub snap_to_grid: bool,
}

/// Dashboard 精简信息（用于启动聚合返回，供前端 Dashboard 页面首屏展示）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardLite {
    pub id: String,
    pub name: String,
    pub description: String,
    pub is_default: bool,
    pub refresh_interval_secs: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

/// SavedChart 精简信息（用于启动聚合返回，供前端 Dashboard 页面首屏展示）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedChartLite {
    pub id: String,
    pub name: String,
    pub chart_type: String,
    pub x_axis: String,
    pub y_axis: Vec<String>,
    pub title: String,
    pub tags: Vec<String>,
    pub description: String,
    pub visibility: String,
    /// visibility = "restricted" 时生效，记录允许使用的仪表盘 ID
    /// 修复：启动聚合必须带回该字段，否则前端 ChartLibraryPanel 会因 authorizedDashboardIds=[]
    /// 误判 restricted 图表不可添加到任何仪表盘（导致"添加图表失败"现象）
    pub authorized_dashboard_ids: Vec<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

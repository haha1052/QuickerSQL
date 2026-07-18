//! 仪表盘相关 Tauri 命令

use crate::TauriAppState;
use crate::models::dashboard::*;
use crate::services::DashboardService;
use tauri::State;

// ============ SavedChart Commands ============

/// 获取保存的图表列表
#[tauri::command]
pub async fn get_saved_charts(
    state: State<'_, TauriAppState>,
    query_id: Option<String>,
    tags: Option<Vec<String>>,
) -> Result<Vec<SavedChart>, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[dashboard] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;

    DashboardService::get_saved_charts(&conn, query_id, tags)
}

/// 创建保存的图表
/// visibility: "all" = 授权给所有仪表盘; "restricted" = 仅授权给 authorized_dashboard_ids 中列出的
// TODO(2026-07-17): Tauri command 参数 13 个，参数由前端 invoke 反序列化，
// 重构成 struct 会改变前端调用契约，留待 v24.0 统一引入 CreateSavedChartParams
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn create_saved_chart(
    state: State<'_, TauriAppState>,
    name: String,
    query_id: String,
    query_sql: String,
    chart_type: String,
    x_axis: String,
    y_axis: String,
    title: Option<String>,
    tags: Option<Vec<String>>,
    description: Option<String>,
    config: Option<String>,
    visibility: Option<String>,
    authorized_dashboard_ids: Option<Vec<String>>,
) -> Result<SavedChart, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    log::info!(
        "[create_saved_chart] name={}, query_id={}, sql_len={}, chart_type={}, x_axis={}, y_axis={:?}, visibility={:?}, authorized_dashboards={:?}",
        name, query_id, query_sql.len(), chart_type, x_axis, y_axis, visibility, authorized_dashboard_ids
    );

    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[dashboard] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;


    let y_axis_vec: Vec<String> = serde_json::from_str(&y_axis).unwrap_or_else(|_| Vec::new());
    let config_value: Option<serde_json::Value> = config
        .and_then(|c| serde_json::from_str(&c).ok());

    DashboardService::create_saved_chart(
        &conn,
        name,
        query_id,
        query_sql,
        chart_type,
        x_axis,
        y_axis_vec,
        title,
        tags,
        description,
        config_value,
        visibility,
        authorized_dashboard_ids,
    )
}

/// 删除保存的图表
#[tauri::command]
pub async fn delete_saved_chart(
    state: State<'_, TauriAppState>,
    id: String,
) -> Result<(), String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[dashboard] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;

    DashboardService::delete_saved_chart(&conn, &id)
}

/// 更新保存的图表（允许编辑图表配置、类型、坐标轴、SQL 等，以及授权范围）
// TODO(2026-07-17): Tauri command 参数 13 个，参数由前端 invoke 反序列化，
// 重构成 struct 会改变前端调用契约，留待 v24.0 统一引入 UpdateSavedChartParams
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn update_saved_chart(
    state: State<'_, TauriAppState>,
    id: String,
    name: Option<String>,
    chart_type: Option<String>,
    x_axis: Option<String>,
    y_axis: Option<String>, // JSON: Vec<String>
    title: Option<String>,
    tags: Option<Vec<String>>,
    description: Option<String>,
    config: Option<String>, // JSON
    visibility: Option<String>,
    authorized_dashboard_ids: Option<Vec<String>>,
    sql: Option<String>,
) -> Result<SavedChart, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[dashboard] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;


    let y_axis_vec = y_axis.and_then(|y| serde_json::from_str(&y).ok());
    let config_value = config.and_then(|c| serde_json::from_str(&c).ok());

    DashboardService::update_saved_chart(
        &conn,
        &id,
        name,
        chart_type,
        x_axis,
        y_axis_vec,
        title,
        tags,
        description,
        config_value,
        visibility,
        authorized_dashboard_ids,
        sql,
    )
}

/// 获取保存的查询
#[tauri::command]
pub async fn get_saved_query(
    state: State<'_, TauriAppState>,
    id: String,
) -> Result<SavedQuery, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[dashboard] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;

    DashboardService::get_saved_query(&conn, &id)
}

// ============ Dashboard Commands ============

/// 获取仪表盘列表
#[tauri::command]
pub async fn get_dashboards(
    state: State<'_, TauriAppState>,
) -> Result<Vec<Dashboard>, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[dashboard] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;

    DashboardService::get_dashboards(&conn)
}

/// 获取单个仪表盘
#[tauri::command]
pub async fn get_dashboard(
    state: State<'_, TauriAppState>,
    id: String,
) -> Result<Dashboard, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[dashboard] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;

    DashboardService::get_dashboard(&conn, &id)
}

/// 创建仪表盘
#[tauri::command]
pub async fn create_dashboard(
    state: State<'_, TauriAppState>,
    name: String,
    description: Option<String>,
) -> Result<Dashboard, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[dashboard] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;

    DashboardService::create_dashboard(&conn, name, description)
}

/// 更新仪表盘
// TODO(2026-07-17): Tauri command 参数 15 个，参数由前端 invoke 反序列化，
// 重构成 struct 会改变前端调用契约，留待 v24.0 统一引入 UpdateDashboardParams
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn update_dashboard(
    state: State<'_, TauriAppState>,
    id: String,
    name: Option<String>,
    description: Option<String>,
    layout: Option<String>,       // JSON
    filters: Option<String>,       // JSON
    refresh_interval_secs: Option<i64>,
    background_color: Option<String>,
    background_image: Option<String>,
    canvas_width: Option<i64>,
    canvas_height: Option<i64>,
    padding: Option<i64>,
    grid_gap: Option<i64>,
    row_height: Option<i64>,
    snap_to_grid: Option<bool>,
) -> Result<Dashboard, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[dashboard] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;


    let layout_vec: Option<Vec<DashboardItem>> = layout.and_then(|l| serde_json::from_str(&l).ok());
    let filters_vec: Option<Vec<DashboardFilter>> = filters.and_then(|f| serde_json::from_str(&f).ok());

    DashboardService::update_dashboard(
        &conn,
        &id,
        name,
        description,
        layout_vec,
        filters_vec,
        refresh_interval_secs,
        background_color,
        background_image,
        canvas_width,
        canvas_height,
        padding,
        grid_gap,
        row_height,
        snap_to_grid,
    )
}

/// 删除仪表盘
#[tauri::command]
pub async fn delete_dashboard(
    state: State<'_, TauriAppState>,
    id: String,
) -> Result<(), String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[dashboard] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;

    DashboardService::delete_dashboard(&conn, &id)
}

// ============ DashboardItem Commands ============

/// 添加图表到仪表盘
#[tauri::command]
pub async fn add_chart_to_dashboard(
    state: State<'_, TauriAppState>,
    dashboard_id: String,
    chart_id: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<DashboardItem, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[dashboard] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;

    DashboardService::add_chart_to_dashboard(&conn, dashboard_id, chart_id, x, y, width, height)
}

/// 更新仪表盘项目
#[tauri::command]
pub async fn update_dashboard_item(
    state: State<'_, TauriAppState>,
    id: String,
    x: Option<f64>,
    y: Option<f64>,
    width: Option<f64>,
    height: Option<f64>,
    config_overrides: Option<String>,
) -> Result<DashboardItem, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[dashboard] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;


    let config_value: Option<serde_json::Value> = config_overrides
        .and_then(|c| serde_json::from_str(&c).ok());

    DashboardService::update_dashboard_item(&conn, &id, x, y, width, height, config_value)
}

/// 从仪表盘移除图表
#[tauri::command]
pub async fn remove_chart_from_dashboard(
    state: State<'_, TauriAppState>,
    item_id: String,
) -> Result<(), String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[dashboard] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;

    DashboardService::remove_chart_from_dashboard(&conn, &item_id)
}

/// 批量保存仪表盘布局（事务性更新）
#[tauri::command]
pub async fn save_dashboard_layout(
    state: State<'_, TauriAppState>,
    dashboard_id: String,
    layout_updates: String,
) -> Result<Dashboard, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[dashboard] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;

    let layout_updates_vec: Vec<DashboardItemLayoutUpdate> = serde_json::from_str(&layout_updates)
        .map_err(|e| {
            log::error!("[save_dashboard_layout] 解析布局更新参数失败: error={}", e);
            "布局参数解析失败，请刷新页面后重试".to_string()
        })?;

    DashboardService::save_dashboard_layout(&conn, &dashboard_id, layout_updates_vec)
}

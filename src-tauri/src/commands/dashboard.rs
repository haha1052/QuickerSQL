//! 仪表盘相关 Tauri 命令

use crate::TauriAppState;
use crate::models::dashboard::*;
use crate::services::DashboardService;
use tauri::State;

/// 仪表盘名称最大长度（与数据库列约束保持一致）
const MAX_DASHBOARD_NAME_LEN: usize = 255;

/// 仪表盘/图表名称参数校验（commands 层边界检查）
///
/// 校验规则：
/// - 拒绝空名称（含纯空白）
/// - 拒绝超长名称（超过 255 字符）
/// - 允许特殊字符（引号、分号等），因 Service 层使用参数化查询保证安全
///
/// 返回 `Ok(())` 表示通过校验；`Err(String)` 表示参数非法。
fn validate_dashboard_name(name: &str) -> Result<(), String> {
    if name.trim().is_empty() {
        return Err("名称不能为空".to_string());
    }
    if name.chars().count() > MAX_DASHBOARD_NAME_LEN {
        return Err(format!("名称过长（最多 {} 字符）", MAX_DASHBOARD_NAME_LEN));
    }
    Ok(())
}

/// 仪表盘/图表/项目 ID 参数校验（commands 层边界检查）
///
/// 校验规则：
/// - 拒绝空 ID（含纯空白）
///
/// 返回 `Ok(())` 表示通过校验；`Err(String)` 表示参数非法。
fn validate_dashboard_id(id: &str) -> Result<(), String> {
    if id.trim().is_empty() {
        return Err("ID 不能为空".to_string());
    }
    Ok(())
}

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
    visual_config: Option<String>,
    visibility: Option<String>,
    authorized_dashboard_ids: Option<Vec<String>>,
) -> Result<SavedChart, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    validate_dashboard_name(&name)?;

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
    let visual_config_value: Option<serde_json::Value> = visual_config
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
        visual_config_value,
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
    visual_config: Option<String>, // JSON
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
    log::warn!("[CMD] update_saved_chart: visual_config raw = {:?}", visual_config.as_ref().map(|s| s.chars().take(200).collect::<String>()));
    let visual_config_value = visual_config.and_then(|c| {
        match serde_json::from_str::<serde_json::Value>(&c) {
            Ok(v) => Some(v),
            Err(e) => {
                log::warn!("[CMD] visual_config JSON parse FAILED: {}", e);
                None
            }
        }
    });
    log::warn!("[CMD] update_saved_chart: visual_config_value.is_some = {}", visual_config_value.is_some());
    log::warn!("[CMD] update_saved_chart: visual_config_value keys = {:?}", visual_config_value.as_ref().map(|v| v.as_object().map(|o| o.keys().collect::<Vec<_>>())));

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
        visual_config_value,
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

    validate_dashboard_id(&id)?;

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

    validate_dashboard_name(&name)?;

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

    validate_dashboard_id(&id)?;
    if let Some(ref n) = name {
        validate_dashboard_name(n)?;
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

    validate_dashboard_id(&id)?;

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

    validate_dashboard_id(&dashboard_id)?;

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

#[cfg(test)]
mod tests {
    use super::*;

    // ============ validate_dashboard_name 测试 ============

    /// 空名称应被拒绝
    #[test]
    fn test_validate_dashboard_name_empty() {
        let result = validate_dashboard_name("");
        assert!(result.is_err(), "空名称应返回错误");
        let msg = result.unwrap_err();
        assert!(msg.contains("不能为空"), "错误信息应提示空值，实际: {}", msg);
    }

    /// 纯空白名称应被拒绝（与空字符串等价）
    #[test]
    fn test_validate_dashboard_name_whitespace_only() {
        let result = validate_dashboard_name("   \n\t  ");
        assert!(result.is_err(), "纯空白名称应返回错误");
        assert!(
            result.unwrap_err().contains("不能为空"),
            "纯空白应提示空值"
        );
    }

    /// 正常名称应通过校验
    #[test]
    fn test_validate_dashboard_name_valid() {
        let result = validate_dashboard_name("销售仪表盘");
        assert!(result.is_ok(), "正常中文名称应通过校验");
    }

    /// 含引号的名称应通过校验（Service 层使用参数化查询保证安全）
    #[test]
    fn test_validate_dashboard_name_with_quotes() {
        let result = validate_dashboard_name("仪表盘'销售'");
        assert!(result.is_ok(), "含单引号的名称应通过校验（参数化查询保证安全）");
    }

    /// 含分号的名称应通过校验
    #[test]
    fn test_validate_dashboard_name_with_semicolon() {
        let result = validate_dashboard_name("销售;利润");
        assert!(result.is_ok(), "含分号的名称应通过校验");
    }

    /// SQL 注入尝试的名称应通过校验（参数化查询保证安全，不在 command 层拦截）
    #[test]
    fn test_validate_dashboard_name_sql_injection_attempt() {
        let result = validate_dashboard_name("test'; DROP TABLE __dashboards; --");
        assert!(result.is_ok(), "SQL 注入尝试名称应通过校验（参数化查询保证安全）");
    }

    /// 超长名称应被拒绝（超过 255 字符）
    #[test]
    fn test_validate_dashboard_name_too_long() {
        let long_name = "a".repeat(MAX_DASHBOARD_NAME_LEN + 1);
        let result = validate_dashboard_name(&long_name);
        assert!(result.is_err(), "超长名称应返回错误");
        let msg = result.unwrap_err();
        assert!(msg.contains("过长"), "错误信息应提示过长，实际: {}", msg);
    }

    /// 刚好达到上限的名称应通过校验（边界值：255 字符）
    #[test]
    fn test_validate_dashboard_name_boundary_max_length() {
        let max_name = "a".repeat(MAX_DASHBOARD_NAME_LEN);
        let result = validate_dashboard_name(&max_name);
        assert!(result.is_ok(), "刚好达到上限的名称应通过校验");
    }

    // ============ validate_dashboard_id 测试 ============

    /// 空 ID 应被拒绝
    #[test]
    fn test_validate_dashboard_id_empty() {
        let result = validate_dashboard_id("");
        assert!(result.is_err(), "空 ID 应返回错误");
        let msg = result.unwrap_err();
        assert!(msg.contains("不能为空"), "错误信息应提示空值，实际: {}", msg);
    }

    /// 纯空白 ID 应被拒绝
    #[test]
    fn test_validate_dashboard_id_whitespace_only() {
        let result = validate_dashboard_id("   \t  ");
        assert!(result.is_err(), "纯空白 ID 应返回错误");
        assert!(
            result.unwrap_err().contains("不能为空"),
            "纯空白 ID 应提示空值"
        );
    }

    /// 正常 ID 应通过校验
    #[test]
    fn test_validate_dashboard_id_valid() {
        let result = validate_dashboard_id("dash_abc123");
        assert!(result.is_ok(), "正常 ID 应通过校验");
    }

    /// 含特殊字符的 ID 应通过校验（参数化查询保证安全）
    #[test]
    fn test_validate_dashboard_id_with_special_chars() {
        let result = validate_dashboard_id("id'with;special--chars");
        assert!(result.is_ok(), "含特殊字符的 ID 应通过校验（参数化查询保证安全）");
    }

    /// 仅含空格的 ID 应被拒绝（避免空格被当作有效 ID）
    #[test]
    fn test_validate_dashboard_id_single_space() {
        let result = validate_dashboard_id(" ");
        assert!(result.is_err(), "仅含空格的 ID 应返回错误");
    }

    // ============ 常量校验 ============

    /// MAX_DASHBOARD_NAME_LEN 应为 255（与数据库列约束保持一致）
    #[test]
    fn test_max_dashboard_name_len_is_255() {
        assert_eq!(MAX_DASHBOARD_NAME_LEN, 255, "仪表盘名称最大长度应为 255");
    }
}
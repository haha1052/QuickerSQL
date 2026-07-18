//! 应用状态相关 Tauri 命令
//!
//! 提供以下接口：
//! - get_app_state(category, key)        -> 获取单个应用状态
//! - get_app_states_by_category(category) -> 按分类获取所有状态
//! - update_app_state(category, key, value, description) -> 更新（或创建）应用状态
//! - save_workspace(tabs)               -> 保存当前工作区布局（整体替换）
//! - load_workspace()                   -> 加载上次保存的工作区布局
//! - restart_app()                      -> 重启应用

use crate::TauriAppState;
use crate::models::app_state::*;
use crate::services::AppStateService;
use tauri::State;

/// 获取单个应用状态
#[tauri::command]
pub fn get_app_state_cmd(
    state: State<'_, TauriAppState>,
    category: String,
    key: String,
) -> Result<Option<AppStateResponse>, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }
    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[app_state] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;
    AppStateService::get_app_state(&conn, &category, &key)
}

/// 按分类获取所有应用状态
#[tauri::command]
pub fn get_app_states_by_category_cmd(
    state: State<'_, TauriAppState>,
    category: String,
) -> Result<Vec<AppStateResponse>, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }
    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[app_state] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;
    AppStateService::get_app_states_by_category(&conn, &category)
}

/// 更新应用状态（不存在则创建）
#[tauri::command]
pub fn update_app_state_cmd(
    state: State<'_, TauriAppState>,
    category: String,
    key: String,
    value: String,
    description: Option<String>,
) -> Result<(), String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }
    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[app_state] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;
    let result = AppStateService::update_app_state(&conn, &category, &key, &value, description.as_deref());

    if result.is_ok() {
        let audit_request = crate::models::audit_log::RecordAuditLogRequest {
            module: "app_state".to_string(),
            action: "update".to_string(),
            description: format!("更新应用状态: {}.{}", category, key),
            status: "success".to_string(),
            duration_ms: None,
            details: Some(format!("value={}", value)),
        };
        let _ = crate::services::AuditLogService::record_audit_log(&conn, audit_request);
    }
    result
}

/// 保存工作区布局
#[tauri::command]
pub fn save_workspace_cmd(
    state: State<'_, TauriAppState>,
    tabs: Vec<WorkspaceTab>,
) -> Result<(), String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }
    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[app_state] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;
    AppStateService::save_workspace(&conn, &tabs)?;

    let audit_request = crate::models::audit_log::RecordAuditLogRequest {
        module: "workspace".to_string(),
        action: "save".to_string(),
        description: format!("保存工作区布局: {} Tabs / {} 面板",
            tabs.len(),
            tabs.iter().map(|t| t.panels.len()).sum::<usize>()
        ),
        status: "success".to_string(),
        duration_ms: None,
        details: None,
    };
    let _ = crate::services::AuditLogService::record_audit_log(&conn, audit_request);
    Ok(())
}

/// 加载工作区布局
#[tauri::command]
pub fn load_workspace_cmd(
    state: State<'_, TauriAppState>,
) -> Result<Vec<WorkspaceTab>, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }
    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[app_state] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;
    AppStateService::load_workspace(&conn)
}

/// 重启应用
#[tauri::command]
pub fn restart_app() -> Result<(), String> {
    // 获取当前可执行文件的路径
    let current_exe = std::env::current_exe()
        .map_err(|e| {
            log::error!("[restart_app] 获取可执行文件路径失败: error={}", e);
            "应用重启失败，请手动重启".to_string()
        })?;

    // 启动新的实例
    std::process::Command::new(current_exe)
        .spawn()
        .map_err(|e| {
            log::error!("[restart_app] 启动新实例失败: error={}", e);
            "应用重启失败，请手动重启".to_string()
        })?;

    // 退出当前实例
    // 使用 std::process::exit 会立即终止，spawn 可能在后台还未完成
    // 使用 Arc<AtomicBool> 等优雅退出机制需要更大的架构改动
    // 这里直接退出是安全的，因为新实例已经启动
    std::process::exit(0);
}

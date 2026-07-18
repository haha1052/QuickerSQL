//! 查询历史相关 Tauri 命令
use crate::TauriAppState;
use crate::services::QueryHistoryService;
use crate::models::query_history::*;
use tauri::State;

/// 获取查询历史列表
#[tauri::command]
pub fn get_query_history(
    state: State<'_, TauriAppState>,
    request: QueryHistoryListRequest,
) -> Result<QueryHistoryListResponse, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[query_history] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;
    QueryHistoryService::get_history_sync(&conn, request)
}

/// 记录查询历史
#[tauri::command]
pub fn record_query_history(
    state: State<'_, TauriAppState>,
    request: RecordQueryHistoryRequest,
) -> Result<QueryHistoryItem, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[query_history] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;
    QueryHistoryService::record_query_sync(&conn, request)
}

/// 更新收藏状态
#[tauri::command]
pub fn update_query_favorite(
    state: State<'_, TauriAppState>,
    request: UpdateFavoriteRequest,
) -> Result<(), String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[query_history] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;
    QueryHistoryService::update_favorite_sync(&conn, request)
}

/// 删除查询历史记录
#[tauri::command]
pub fn delete_query_history(
    state: State<'_, TauriAppState>,
    id: String,
) -> Result<(), String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[query_history] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;
    QueryHistoryService::delete_history_sync(&conn, &id)
}

/// 清理旧的历史记录
#[tauri::command]
pub fn cleanup_old_history(
    state: State<'_, TauriAppState>,
    keep_days: Option<i64>,
) -> Result<i64, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[query_history] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;
    QueryHistoryService::cleanup_old_history_sync(&conn, keep_days)
}

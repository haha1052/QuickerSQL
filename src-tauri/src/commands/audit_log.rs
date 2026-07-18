//! 审计日志相关 Tauri 命令
use crate::TauriAppState;
use crate::models::audit_log::*;
use crate::services::{AuditLogService, SettingsService};
use tauri::State;

/// 记录审计日志
#[tauri::command]
pub fn record_audit_log_cmd(
    state: State<'_, TauriAppState>,
    request: RecordAuditLogRequest,
) -> Result<AuditLogItem, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[audit_log] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;

    let enabled = SettingsService::get_setting(&conn, "security", "enableAuditLog")
        .ok()
        .flatten()
        .map(|s| s.value.to_lowercase() != "false")
        .unwrap_or(true);

    if !enabled {
        return Err("审计日志已禁用".to_string());
    }

    AuditLogService::record_audit_log(&conn, request)
}

/// 查询审计日志
#[tauri::command]
pub fn query_audit_logs_cmd(
    state: State<'_, TauriAppState>,
    request: QueryAuditLogsRequest,
) -> Result<AuditLogsListResponse, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[audit_log] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;
    AuditLogService::query_audit_logs(&conn, request)
}

/// 清理过期审计日志
#[tauri::command]
pub fn cleanup_expired_audit_logs_cmd(
    state: State<'_, TauriAppState>,
    retention_days: i64,
) -> Result<i64, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[audit_log] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;
    AuditLogService::cleanup_expired_logs(&conn, retention_days)
}

/// 统计审计日志总数
#[tauri::command]
pub fn count_audit_logs_cmd(state: State<'_, TauriAppState>) -> Result<i64, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[audit_log] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;
    AuditLogService::count_audit_logs(&conn)
}

/// 清空所有审计日志
#[tauri::command]
pub fn clear_all_audit_logs_cmd(state: State<'_, TauriAppState>) -> Result<(), String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[audit_log] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;
    AuditLogService::clear_all_audit_logs(&conn)
}

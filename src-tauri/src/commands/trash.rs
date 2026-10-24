//! 回收站相关 Tauri 命令
use crate::TauriAppState;
use crate::database::SqlIdentifier;
use crate::services::TrashService;
use crate::models::trash::*;
use tauri::State;
use log;

/// 获取回收站列表（仅访问 SQLite 的 __trash_metadata）
#[tauri::command]
pub fn get_trash_list(state: State<'_, TauriAppState>) -> Result<TrashListResponse, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[trash] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;
    TrashService::get_trash_list_sync(&conn)
}

/// 将表移动到回收站
///
/// 业务数据表在 DuckDB，回收站元数据在 SQLite。
/// - sqlite_conn: 读写 __trash_metadata + settings + audit log
/// - duckdb_conn: 查询行数 + ALTER TABLE RENAME
#[tauri::command]
pub fn move_to_trash(state: State<'_, TauriAppState>, table_name: String) -> Result<TrashItem, String> {
    if !state.db_manager.is_connected() || !state.duckdb_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    // 禁止删除系统表
    if SqlIdentifier::is_system_table(&table_name) {
        return Err(format!("系统表 '{}' 不允许删除或修改", table_name));
    }

    let sqlite_conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[trash] 获取 SQLite 连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;

    let duckdb_conn = state.duckdb_manager.get_connection().map_err(|e| {
        log::error!("[trash] 获取 DuckDB 连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;

    // 从 DuckDB 获取行数
    let row_count = TrashService::get_table_row_count(&duckdb_conn, &table_name)?;

    log::info!("准备将表 {} ({} 行) 移动到回收站", table_name, row_count);

    // 移动到回收站（DuckDB 重命名表 + SQLite 写元数据）
    let result = TrashService::move_to_trash_sync(&sqlite_conn, &duckdb_conn, &table_name, row_count);

    if result.is_ok() {
        let audit_request = crate::models::audit_log::RecordAuditLogRequest {
            module: "trash".to_string(),
            action: "move_to_trash".to_string(),
            description: format!("表 {} 移动到回收站 ({} 行)", table_name, row_count),
            status: "success".to_string(),
            duration_ms: None,
            details: None,
        };
        let _ = crate::services::AuditLogService::record_audit_log(&sqlite_conn, audit_request);
    }

    result
}

/// 从回收站恢复表
#[tauri::command]
pub fn restore_from_trash(state: State<'_, TauriAppState>, trash_id: String) -> Result<String, String> {
    if !state.db_manager.is_connected() || !state.duckdb_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let sqlite_conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[trash] 获取 SQLite 连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;
    let duckdb_conn = state.duckdb_manager.get_connection().map_err(|e| {
        log::error!("[trash] 获取 DuckDB 连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;

    let result = TrashService::restore_from_trash_sync(&sqlite_conn, &duckdb_conn, &trash_id);

    if result.is_ok() {
        let audit_request = crate::models::audit_log::RecordAuditLogRequest {
            module: "trash".to_string(),
            action: "restore".to_string(),
            description: format!("从回收站恢复 (id: {})", trash_id),
            status: "success".to_string(),
            duration_ms: None,
            details: None,
        };
        let _ = crate::services::AuditLogService::record_audit_log(&sqlite_conn, audit_request);
    }

    result
}

/// 永久删除回收站项
#[tauri::command]
pub fn permanent_delete(state: State<'_, TauriAppState>, trash_id: String) -> Result<String, String> {
    if !state.db_manager.is_connected() || !state.duckdb_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let sqlite_conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[trash] 获取 SQLite 连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;
    let duckdb_conn = state.duckdb_manager.get_connection().map_err(|e| {
        log::error!("[trash] 获取 DuckDB 连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;

    let result = TrashService::permanent_delete_sync(&sqlite_conn, &duckdb_conn, &trash_id);

    if result.is_ok() {
        let audit_request = crate::models::audit_log::RecordAuditLogRequest {
            module: "trash".to_string(),
            action: "permanent_delete".to_string(),
            description: format!("永久删除回收站项 (id: {})", trash_id),
            status: "success".to_string(),
            duration_ms: None,
            details: None,
        };
        let _ = crate::services::AuditLogService::record_audit_log(&sqlite_conn, audit_request);
    }

    result
}

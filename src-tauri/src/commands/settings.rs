//! 设置相关 Tauri 命令
use crate::TauriAppState;
use crate::models::settings::*;
use crate::services::SettingsService;
use tauri::State;

/// 获取所有设置
#[tauri::command]
pub fn get_all_settings_cmd(state: State<'_, TauriAppState>) -> Result<SettingsListResponse, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| e.to_string())?;
    SettingsService::get_all_settings(&conn)
}

/// 获取单个设置
#[tauri::command]
pub fn get_setting_cmd(state: State<'_, TauriAppState>, category: String, key: String) -> Result<Option<SettingItem>, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| e.to_string())?;
    SettingsService::get_setting(&conn, &category, &key)
}

/// 更新设置
#[tauri::command]
pub fn update_setting_cmd(state: State<'_, TauriAppState>, category: String, key: String, value: String) -> Result<SettingItem, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| e.to_string())?;
    let result = SettingsService::update_setting(&conn, &category, &key, &value);

    if result.is_ok() {
        let audit_request = crate::models::audit_log::RecordAuditLogRequest {
            module: "settings".to_string(),
            action: "update".to_string(),
            description: format!("修改设置: {}.{}", category, key),
            status: "success".to_string(),
            duration_ms: None,
            details: Some(format!("value={}", value)),
        };
        let _ = crate::services::AuditLogService::record_audit_log(&conn, audit_request);
    }
    result
}

/// 批量更新设置
#[tauri::command]
pub fn batch_update_settings_cmd(state: State<'_, TauriAppState>, settings: Vec<UpdateSettingRequest>) -> Result<Vec<SettingItem>, String> {
    let conn = state.db_manager.get_connection().map_err(|e| e.to_string())?;
    let count = settings.len();
    let result = SettingsService::batch_update_settings(&conn, &settings);

    if result.is_ok() {
        let audit_request = crate::models::audit_log::RecordAuditLogRequest {
            module: "settings".to_string(),
            action: "batch_update".to_string(),
            description: format!("批量修改设置 ({}项)", count),
            status: "success".to_string(),
            duration_ms: None,
            details: Some(format!("count={}", count)),
        };
        let _ = crate::services::AuditLogService::record_audit_log(&conn, audit_request);
    }

    result
}

/// 重置设置
#[tauri::command]
pub fn reset_settings_cmd(state: State<'_, TauriAppState>, category: Option<String>) -> Result<(), String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| e.to_string())?;
    SettingsService::reset_settings(&conn, category.as_deref())
}

/// 导出设置
#[tauri::command]
pub fn export_settings_cmd(state: State<'_, TauriAppState>) -> Result<ExportSettingsResponse, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| e.to_string())?;
    SettingsService::export_settings(&conn)
}

/// 导入设置
#[tauri::command]
pub fn import_settings_cmd(state: State<'_, TauriAppState>, import_data: ImportSettingsRequest) -> Result<(), String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| e.to_string())?;
    SettingsService::import_settings(&conn, &import_data)
}

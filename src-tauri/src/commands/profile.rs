//! 数据探查相关 Tauri 命令

use crate::TauriAppState;
use crate::models::profile::ProfileResult;
use crate::services::ProfileService;
use tauri::State;

/// 对指定数据表执行数据探查
/// `force_full_scan` 为 true 时，即使超过 5 万行也不启用采样。
#[tauri::command]
pub async fn profile_table(
    state: State<'_, TauriAppState>,
    table_name: String,
    force_full_scan: Option<bool>,
) -> Result<ProfileResult, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }
    let conn = state
        .db_manager
        .get_connection()
        .map_err(|e| e.to_string())?;

    ProfileService::profile_table(&conn, &table_name, force_full_scan.unwrap_or(false))
}

/// 对前端传入的查询结果（列名 + 二维字符串）执行内存内数据探查。
/// 用于：用户刚跑了 SQL，对 SELECT 结果做统计。
#[tauri::command]
pub async fn profile_result(
    columns: Vec<String>,
    rows: Vec<Vec<String>>,
) -> Result<ProfileResult, String> {
    ProfileService::profile_result(&columns, &rows)
}

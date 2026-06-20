//! 自动化任务命令
//! 暴露给前端的 Tauri 命令

use crate::models::automation::*;
use crate::services::TaskService;
use crate::TauriAppState;
use tauri::State;

#[tauri::command]
pub fn list_automation_tasks(
    state: State<'_, TauriAppState>,
    filter_state: Option<String>,
    filter_type: Option<String>,
    keyword: Option<String>,
) -> Result<TaskListResponse, String> {
    let conn = state.db_manager.get_connection().map_err(|e| format!("{}", e))?;
    TaskService::list_tasks(&conn, filter_state, filter_type, keyword)
}

#[tauri::command]
pub fn get_automation_task(
    state: State<'_, TauriAppState>,
    id: String,
) -> Result<Task, String> {
    let conn = state.db_manager.get_connection().map_err(|e| format!("{}", e))?;
    TaskService::get_task(&conn, &id)
}

#[tauri::command]
pub fn create_automation_task(
    state: State<'_, TauriAppState>,
    req: CreateTaskRequest,
) -> Result<Task, String> {
    let conn = state.db_manager.get_connection().map_err(|e| format!("{}", e))?;
    TaskService::create_task(&conn, req)
}

#[tauri::command]
pub fn update_automation_task(
    state: State<'_, TauriAppState>,
    id: String,
    patch: UpdateTaskRequest,
) -> Result<Task, String> {
    let conn = state.db_manager.get_connection().map_err(|e| format!("{}", e))?;
    TaskService::update_task(&conn, &id, patch)
}

#[tauri::command]
pub fn delete_automation_task(
    state: State<'_, TauriAppState>,
    id: String,
) -> Result<(), String> {
    let conn = state.db_manager.get_connection().map_err(|e| format!("{}", e))?;
    TaskService::delete_task(&conn, &id)
}

#[tauri::command]
pub fn enable_automation_task(
    state: State<'_, TauriAppState>,
    id: String,
) -> Result<Task, String> {
    let conn = state.db_manager.get_connection().map_err(|e| format!("{}", e))?;
    TaskService::enable_task(&conn, &id)
}

#[tauri::command]
pub fn disable_automation_task(
    state: State<'_, TauriAppState>,
    id: String,
) -> Result<Task, String> {
    let conn = state.db_manager.get_connection().map_err(|e| format!("{}", e))?;
    TaskService::disable_task(&conn, &id)
}

#[tauri::command]
pub fn run_automation_task_now(
    state: State<'_, TauriAppState>,
    id: String,
) -> Result<TaskRun, String> {
    TaskService::run_task_now(&state.db_manager, &id)
}

#[tauri::command]
pub fn get_automation_task_runs(
    state: State<'_, TauriAppState>,
    task_id: String,
    limit: Option<i64>,
) -> Result<Vec<TaskRun>, String> {
    let conn = state.db_manager.get_connection().map_err(|e| format!("{}", e))?;
    TaskService::get_task_runs(&conn, &task_id, limit)
}

#[tauri::command]
pub fn ensure_automation_tables(
    state: State<'_, TauriAppState>,
) -> Result<bool, String> {
    let conn = state.db_manager.get_connection().map_err(|e| format!("{}", e))?;
    TaskService::ensure_tables_exists(&conn).map(|_| true)
}

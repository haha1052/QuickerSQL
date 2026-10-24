//! 项目管理相关 Tauri 命令
//!
//! v2.0 重构：适配新的 ProjectService（基于 UUID + 注册表）
//! - 命令参数从项目名改为项目 ID
//! - 新增 duplicate_project、import_project、export_project、get_current_project_id
//! - 保留 open_project、open_database_from_path、export_database、get_current_db_path
//!
//! 架构约束：
//! - commands 层只做参数校验 + 调用 Service + 返回 Result
//! - 禁止直接拼接 SQL（audit log description 用 format! 不算 SQL 拼接）
//! - 禁止 unwrap()/expect()，用 map_err 转化错误
use crate::TauriAppState;
use crate::database::MutexGuardConnection;
use crate::models::ProjectInfo;
use crate::services::ProjectService;
use std::path::{Path, PathBuf};
use tauri::State;

// ==================== 内部辅助函数 ====================

/// 初始化系统表（连接切换后调用）
///
/// 提取自 switch_project / open_database_from_path 的公共逻辑：
/// - 旧表名迁移（_settings → __settings）
/// - 确保所有系统表存在
fn init_system_tables(conn: &MutexGuardConnection<'_>) {
    if let Err(e) = crate::services::MigrationService::run_legacy_table_migrations(conn) {
        log::warn!("旧表名迁移失败: {}", e);
    }
    if let Err(e) = crate::services::SettingsService::ensure_settings_table_exists(conn) {
        log::warn!("初始化设置表失败: {}", e);
    }
    if let Err(e) = crate::services::TaskService::ensure_tables_exists(conn) {
        log::warn!("初始化自动化任务表失败: {}", e);
    }
    if let Err(e) = crate::services::QueryHistoryService::ensure_query_history_table_exists(conn) {
        log::warn!("初始化查询历史表失败: {}", e);
    }
    if let Err(e) = crate::services::AuditLogService::ensure_audit_log_table_exists(conn) {
        log::warn!("初始化审计日志表失败: {}", e);
    }
    if let Err(e) = crate::services::TrashService::ensure_trash_table_exists(conn) {
        log::warn!("初始化回收站表失败: {}", e);
    }
    if let Err(e) = crate::services::DashboardService::ensure_tables_exist(conn) {
        log::warn!("初始化仪表盘表失败: {}", e);
    }
    if let Err(e) = crate::services::AppStateService::ensure_app_state_table_exists(conn) {
        log::warn!("初始化应用状态表失败: {}", e);
    }
    if let Err(e) = crate::services::AppStateService::ensure_workspace_tables_exist(conn) {
        log::warn!("初始化工作区表失败: {}", e);
    }
}

/// 通过当前 db_path 反查注册表获取 project_id
///
/// 返回：
/// - Ok(Some(id))：当前数据库对应注册表中的某个项目
/// - Ok(None)：当前数据库不在注册表中（可能是旧数据未迁移）
fn get_current_project_id_inner(state: &State<'_, TauriAppState>) -> Result<Option<String>, String> {
    let current_db_path = state.db_path.lock().map_err(|e| {
        log::error!("[project] 获取数据库路径锁失败: error={}", e);
        "数据库状态异常，请重试".to_string()
    })?;
    let projects = ProjectService::list_projects()?;
    for project in projects {
        let project_db_path = ProjectService::resolve_db_path(&project.db_path)?;
        if *current_db_path == project_db_path {
            return Ok(Some(project.id));
        }
    }
    Ok(None)
}

/// 清理文件名中的非法字符（Windows 文件系统）
fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            _ => c,
        })
        .collect()
}

// ==================== 项目 CRUD 命令 ====================

/// 创建新项目
///
/// 调用 ProjectService::create 生成 UUID 目录 + 注册表记录。
/// 成功后记录审计日志。前端会用返回的 ProjectInfo.id 调用 switch_project。
#[tauri::command]
pub fn create_project(
    state: State<'_, TauriAppState>,
    project_name: String,
    description: Option<String>,
) -> Result<ProjectInfo, String> {
    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[project] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;
    let result = ProjectService::create(&project_name, description.as_deref());

    if let Ok(ref project_info) = result {
        let audit_request = crate::models::audit_log::RecordAuditLogRequest {
            module: "project".to_string(),
            action: "create".to_string(),
            description: format!("创建项目: {} ({})", project_info.name, project_info.id),
            status: "success".to_string(),
            duration_ms: None,
            details: None,
        };
        let _ = crate::services::AuditLogService::record_audit_log(&conn, audit_request);
    }

    result
}

/// 列出所有项目
#[tauri::command]
pub fn list_projects() -> Result<Vec<ProjectInfo>, String> {
    ProjectService::list_projects()
}

/// 重命名项目（按 ID 重命名，不动文件系统）
///
/// 新实现只更新注册表和 __project_info，不需要关闭/重连数据库。
#[tauri::command]
pub fn rename_project(
    state: State<'_, TauriAppState>,
    project_id: String,
    new_name: String,
) -> Result<ProjectInfo, String> {
    if new_name.trim().is_empty() {
        return Err("项目名称不能为空".to_string());
    }

    let result = ProjectService::rename_project(&project_id, &new_name);

    if result.is_ok() {
        let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[project] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;
        let audit_request = crate::models::audit_log::RecordAuditLogRequest {
            module: "project".to_string(),
            action: "rename".to_string(),
            description: format!("重命名项目: id={}, new_name={}", project_id, new_name),
            status: "success".to_string(),
            duration_ms: None,
            details: None,
        };
        let _ = crate::services::AuditLogService::record_audit_log(&conn, audit_request);
    }

    result
}

/// 删除项目（按 ID 删除）
///
/// 如果删除的是当前项目，先切换到 default 项目以释放文件锁。
#[tauri::command]
pub fn delete_project(state: State<'_, TauriAppState>, project_id: String) -> Result<String, String> {
    // 1. 检查是否为当前项目，如果是则先切换到 default
    let current_project_id = get_current_project_id_inner(&state)?;
    if let Some(current_id) = current_project_id {
        if current_id == project_id {
            // 切换到 default 项目（避免删除当前已连接的库）
            let default_db_path = ProjectService::get_default_db_path()?;
            state.set_db_path(default_db_path.clone())?;
            state.db_manager.close_connection();
            state.db_manager
                .connect("sqlite", &default_db_path)
                .map_err(|e| {
                    log::error!("[delete_project] 切换到默认项目失败: error={}", e);
                    "数据库切换失败，请重试".to_string()
                })?;

            // 系统表初始化
            {
                let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[project] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;
                init_system_tables(&conn);
            }
        }
    }

    // 2. 删除项目
    let result = ProjectService::delete_project(&project_id)
        .map(|_| format!("项目 '{}' 已删除", project_id));

    // 3. 记录审计日志
    if result.is_ok() {
        let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[project] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;
        let audit_request = crate::models::audit_log::RecordAuditLogRequest {
            module: "project".to_string(),
            action: "delete".to_string(),
            description: format!("删除项目: {}", project_id),
            status: "success".to_string(),
            duration_ms: None,
            details: None,
        };
        let _ = crate::services::AuditLogService::record_audit_log(&conn, audit_request);
    }

    result
}

/// 切换到指定项目（按 ID 切换）
///
/// ⚠️ 关键约束：调用 `state.db_manager.connect()` 之前，必须确保没有任何
/// `MutexGuardConnection` 在作用域内持有 `active_connection` 的锁，否则
/// 会发生 "同一线程重复获取同一 Mutex" 的**死锁**。
#[tauri::command]
pub fn switch_project(
    state: State<'_, TauriAppState>,
    _app: tauri::AppHandle,
    project_id: String,
) -> Result<ProjectInfo, String> {
    // 1. 调用 Service 更新 last_opened_at 并获取项目信息
    let project_info = ProjectService::switch_project(&project_id)?;

    // 2. 解析绝对路径
    let db_path = ProjectService::resolve_db_path(&project_info.db_path)?;

    if !db_path.exists() {
        log::warn!("[switch_project] 项目数据库文件不存在: project_id={}, db_path={:?}", project_id, db_path);
        return Err("项目数据库文件不存在，请检查项目完整性".to_string());
    }

    // 3. 先更新 db_path（内部不获取 active_connection 锁）
    state.set_db_path(db_path.clone())?;

    // 4. 关闭旧连接（显式释放 active_connection 的锁）
    state.db_manager.close_connection();

    // 5. 建立新连接（此时 active_connection 不被任何 MutexGuard 持有）
    state.db_manager
        .connect("sqlite", &db_path)
        .map_err(|e| {
            log::error!("[switch_project] 建立数据库连接失败: error={}", e);
            "数据库连接失败，请检查文件".to_string()
        })?;

    // 6. 系统表初始化 + 审计日志
    {
        let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[project] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;
        init_system_tables(&conn);

        let audit_request = crate::models::audit_log::RecordAuditLogRequest {
            module: "project".to_string(),
            action: "switch".to_string(),
            description: format!("切换到项目: {} ({})", project_info.name, project_id),
            status: "success".to_string(),
            duration_ms: None,
            details: None,
        };
        let _ = crate::services::AuditLogService::record_audit_log(&conn, audit_request);
    }

    // 7. DuckDB 连接已由 set_db_path 自动连接到 data.duckdb，无需额外预加载
    log::info!("[switch_project] DuckDB 已自动连接到 data.duckdb");

    Ok(project_info)
}

/// 复制项目（文件级复制 + 新 ID）
///
/// 完整复制源项目的所有数据（表、查询历史、仪表盘、自动化任务、设置）。
#[tauri::command]
pub fn duplicate_project(
    state: State<'_, TauriAppState>,
    source_id: String,
    new_name: String,
) -> Result<ProjectInfo, String> {
    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[project] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;
    let result = ProjectService::duplicate_project(&source_id, &new_name);

    if let Ok(ref project_info) = result {
        let audit_request = crate::models::audit_log::RecordAuditLogRequest {
            module: "project".to_string(),
            action: "duplicate".to_string(),
            description: format!(
                "复制项目: source={}, new={} ({})",
                source_id, project_info.name, project_info.id
            ),
            status: "success".to_string(),
            duration_ms: None,
            details: None,
        };
        let _ = crate::services::AuditLogService::record_audit_log(&conn, audit_request);
    }

    result
}

/// 导入项目（从外部 .db/.qsql 文件）
#[tauri::command]
pub fn import_project(
    state: State<'_, TauriAppState>,
    source_file_path: String,
    new_name: String,
) -> Result<ProjectInfo, String> {
    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[project] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;
    let source_path = Path::new(&source_file_path);
    let result = ProjectService::import_project(source_path, &new_name);

    if let Ok(ref project_info) = result {
        let audit_request = crate::models::audit_log::RecordAuditLogRequest {
            module: "project".to_string(),
            action: "import".to_string(),
            description: format!(
                "导入项目: {} ({}, source={})",
                project_info.name, project_info.id, source_file_path
            ),
            status: "success".to_string(),
            duration_ms: None,
            details: None,
        };
        let _ = crate::services::AuditLogService::record_audit_log(&conn, audit_request);
    }

    result
}

/// 导出项目到指定路径
#[tauri::command]
pub fn export_project(
    state: State<'_, TauriAppState>,
    project_id: String,
    dest_path: String,
) -> Result<String, String> {
    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[project] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;
    let dest = Path::new(&dest_path);
    let result = ProjectService::export_project(&project_id, dest)
        .map(|_| format!("项目已导出到: {}", dest_path));

    if result.is_ok() {
        let audit_request = crate::models::audit_log::RecordAuditLogRequest {
            module: "project".to_string(),
            action: "export".to_string(),
            description: format!("导出项目: id={}, dest={}", project_id, dest_path),
            status: "success".to_string(),
            duration_ms: None,
            details: None,
        };
        let _ = crate::services::AuditLogService::record_audit_log(&conn, audit_request);
    }

    result
}

/// 获取当前项目 ID
///
/// 通过当前 db_path 反查注册表获取 project_id。
/// 如果找不到（可能是旧数据未迁移），返回 Err 提示用户迁移。
#[tauri::command]
pub fn get_current_project_id(state: State<'_, TauriAppState>) -> Result<String, String> {
    match get_current_project_id_inner(&state)? {
        Some(id) => Ok(id),
        None => Err("当前数据库未在项目注册表中找到，可能需要迁移旧数据".to_string()),
    }
}

// ==================== 保留的命令 ====================

/// 打开项目（保留原签名，按 db_path 打开）
#[tauri::command]
pub fn open_project(state: State<'_, TauriAppState>, db_path: String) -> Result<bool, String> {
    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[project] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;
    let path = PathBuf::from(db_path.clone());
    let result = ProjectService::open(&path);

    if result.is_ok() {
        let audit_request = crate::models::audit_log::RecordAuditLogRequest {
            module: "project".to_string(),
            action: "open".to_string(),
            description: format!("打开项目: {}", db_path),
            status: "success".to_string(),
            duration_ms: None,
            details: None,
        };
        let _ = crate::services::AuditLogService::record_audit_log(&conn, audit_request);
    }

    result
}

/// 从指定路径打开数据库
///
/// ⚠️ 与 `switch_project` 相同的约束：connect() 之前必须无任何 MutexGuardConnection 在作用域内。
#[tauri::command]
pub fn open_database_from_path(
    state: State<'_, TauriAppState>,
    db_path: String,
) -> Result<String, String> {
    let path = PathBuf::from(db_path.clone());

    if !path.exists() {
        log::warn!("[open_database_from_path] 数据库文件不存在: db_path={}", db_path);
        return Err("数据库文件不存在，请检查文件路径".to_string());
    }

    // 1. 更新 db_path（不获取 active_connection 锁）
    state.set_db_path(path.clone())?;

    // 2. 关闭旧连接，确保 active_connection 的锁无任何持有者
    state.db_manager.close_connection();

    // 3. 建立新连接
    state.db_manager
        .connect("sqlite", &path)
        .map_err(|e| {
            log::error!("[open_database_from_path] 建立数据库连接失败: error={}", e);
            "数据库连接失败，请检查文件".to_string()
        })?;

    // 4. 初始化系统表 + 审计日志
    {
        let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[project] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;
        init_system_tables(&conn);

        let audit_request = crate::models::audit_log::RecordAuditLogRequest {
            module: "project".to_string(),
            action: "open_database".to_string(),
            description: format!("从路径打开数据库: {}", db_path),
            status: "success".to_string(),
            duration_ms: None,
            details: None,
        };
        let _ = crate::services::AuditLogService::record_audit_log(&conn, audit_request);
    }

    Ok(format!("已打开数据库: {}", path.to_string_lossy()))
}

/// 导出当前数据库
#[tauri::command]
pub fn export_database(state: State<'_, TauriAppState>, dest_path: String) -> Result<String, String> {
    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[project] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;
    let source_path = state.db_path.lock().map_err(|e| {
        log::error!("[project] 获取数据库路径锁失败: error={}", e);
        "数据库状态异常，请重试".to_string()
    })?;
    let dest = PathBuf::from(dest_path.clone());

    let result = ProjectService::export_database(&source_path, &dest)
        .map(|_| format!("数据库已导出到: {}", dest.to_string_lossy()));

    if result.is_ok() {
        let audit_request = crate::models::audit_log::RecordAuditLogRequest {
            module: "project".to_string(),
            action: "export".to_string(),
            description: format!("导出数据库到: {}", dest_path),
            status: "success".to_string(),
            duration_ms: None,
            details: None,
        };
        let _ = crate::services::AuditLogService::record_audit_log(&conn, audit_request);
    }

    result
}

/// 获取当前数据库路径
#[tauri::command]
pub fn get_current_db_path(state: State<'_, TauriAppState>) -> Result<String, String> {
    let path = state.db_path.lock().map_err(|e| {
        log::error!("[project] 获取数据库路径锁失败: error={}", e);
        "数据库状态异常，请重试".to_string()
    })?;
    Ok(path.to_string_lossy().to_string())
}

/// 批量导出选中的项目（按 ID）
#[tauri::command]
pub fn export_selected_projects(
    state: State<'_, TauriAppState>,
    selected_project_ids: Vec<String>,
    dest_dir: String,
) -> Result<Vec<String>, String> {
    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[project] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;
    let dest_path = PathBuf::from(&dest_dir);

    if !dest_path.exists() {
        log::error!("[export_selected_projects] 导出目录不存在: dir={}", dest_dir);
        return Err("导出目录不存在，请检查路径".to_string());
    }

    let mut exported_paths = Vec::new();

    for project_id in &selected_project_ids {
        let project_info = ProjectService::get_project_info(project_id)
            .map_err(|e| {
                log::error!("[export_selected_projects] 获取项目信息失败: project_id={}, error={}", project_id, e);
                "项目信息读取失败，请检查项目是否存在".to_string()
            })?;

        let safe_name = sanitize_filename(&project_info.name);
        let export_file = dest_path.join(format!("{}.db", safe_name));

        ProjectService::export_project(project_id, &export_file)
            .map_err(|e| {
                log::error!("[export_selected_projects] 导出项目失败: project_id={}, export_file={:?}, error={}", project_id, export_file, e);
                "项目导出失败，请检查目标路径权限".to_string()
            })?;

        exported_paths.push(export_file.to_string_lossy().to_string());
    }

    let audit_request = crate::models::audit_log::RecordAuditLogRequest {
        module: "project".to_string(),
        action: "batch_export".to_string(),
        description: format!(
            "批量导出 {} 个项目到: {}",
            selected_project_ids.len(),
            dest_dir
        ),
        status: "success".to_string(),
        duration_ms: None,
        details: Some(format!("project_ids={:?}", selected_project_ids)), // safe_sql: debug log, not SQL
    };
    let _ = crate::services::AuditLogService::record_audit_log(&conn, audit_request);

    Ok(exported_paths)
}

#[allow(dead_code)]
fn build_view_sql_with_type_casts(
    sqlite_conn: &crate::database::MutexGuardConnection,
    table_name: &str,
) -> String {
    let columns = match crate::services::DatabaseService::get_columns(sqlite_conn, table_name) {
        Ok(cols) => cols,
        Err(e) => {
            log::warn!("获取表 {} 的列信息失败，回退到 SELECT *: {}", table_name, e);
            let quoted_table = crate::database::SqlIdentifier::quote_identifier(table_name);
            return format!(
                "CREATE OR REPLACE VIEW {} AS SELECT * FROM sqlite_db.{}",
                quoted_table, quoted_table
            );
        }
    };

    let quoted_table = crate::database::SqlIdentifier::quote_identifier(table_name);
    let select_list = columns
        .iter()
        .map(|col| {
            let quoted_name = crate::database::SqlIdentifier::quote_identifier(&col.name);
            match duckdb_cast_type(&col.data_type) {
                Some(cast_type) => format!("CAST({} AS {}) AS {}", quoted_name, cast_type, quoted_name),
                None => quoted_name.to_string(),
            }
        })
        .collect::<Vec<_>>()
        .join(", ");

    format!(
        "CREATE OR REPLACE VIEW {} AS SELECT {} FROM sqlite_db.{}",
        quoted_table, select_list, quoted_table
    )
}

#[allow(dead_code)]
fn duckdb_cast_type(sqlite_type: &str) -> Option<&'static str> {
    let t = sqlite_type.to_uppercase();
    match t.as_str() {
        "INTEGER" | "INT" | "BIGINT" | "SMALLINT" | "TINYINT" | "MEDIUMINT" => Some("BIGINT"),
        "REAL" | "FLOAT" | "DOUBLE" => Some("DOUBLE"),
        "NUMERIC" | "DECIMAL" => Some("DECIMAL"),
        "BOOLEAN" => Some("BOOLEAN"),
        "DATE" => Some("DATE"),
        "TIME" => Some("TIME"),
        "DATETIME" | "TIMESTAMP" => Some("TIMESTAMP"),
        "TEXT" | "VARCHAR" | "STRING" | "CHAR" | "CLOB" | "" => None,
        _ => None,
    }
}
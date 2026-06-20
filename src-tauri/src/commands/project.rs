//! 项目管理相关 Tauri 命令
use crate::TauriAppState;
use crate::services::ProjectService;
use tauri::State;
use std::path::PathBuf;

/// 创建新项目
#[tauri::command]
pub fn create_project(state: State<'_, TauriAppState>, project_name: String) -> Result<String, String> {
    let conn = state.db_manager.get_connection().map_err(|e| e.to_string())?;
    let result = ProjectService::create(&project_name)
        .map(|path| path.to_string_lossy().to_string())
        .map_err(|e| e.to_string());

    if result.is_ok() {
        let audit_request = crate::models::audit_log::RecordAuditLogRequest {
            module: "project".to_string(),
            action: "create".to_string(),
            description: format!("创建项目: {}", project_name),
            status: "success".to_string(),
            duration_ms: None,
            details: None,
        };
        let _ = crate::services::AuditLogService::record_audit_log(&conn, audit_request);
    }

    result
}

/// 打开项目
#[tauri::command]
pub fn open_project(state: State<'_, TauriAppState>, db_path: String) -> Result<bool, String> {
    let conn = state.db_manager.get_connection().map_err(|e| e.to_string())?;
    let path = PathBuf::from(db_path.clone());
    let result = ProjectService::open(&path)
        .map_err(|e| e.to_string());

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

/// 列出所有项目
#[tauri::command]
pub fn list_projects() -> Result<Vec<String>, String> {
    ProjectService::list_projects()
        .map_err(|e| e.to_string())
}

/// 删除项目
#[tauri::command]
pub fn delete_project(state: State<'_, TauriAppState>, project_name: String) -> Result<String, String> {
    let conn = state.db_manager.get_connection().map_err(|e| e.to_string())?;
    let result = ProjectService::delete_project(&project_name)
        .map(|_| format!("项目 '{}' 已删除", project_name))
        .map_err(|e| e.to_string());

    if result.is_ok() {
        let audit_request = crate::models::audit_log::RecordAuditLogRequest {
            module: "project".to_string(),
            action: "delete".to_string(),
            description: format!("删除项目: {}", project_name),
            status: "success".to_string(),
            duration_ms: None,
            details: None,
        };
        let _ = crate::services::AuditLogService::record_audit_log(&conn, audit_request);
    }

    result
}

/// 重命名项目
#[tauri::command]
pub fn rename_project(state: State<'_, TauriAppState>, old_name: String, new_name: String) -> Result<String, String> {
    let conn = state.db_manager.get_connection().map_err(|e| e.to_string())?;
    let result = ProjectService::rename_project(&old_name, &new_name)
        .map(|_| format!("项目已从 '{}' 重命名为 '{}'", old_name, new_name))
        .map_err(|e| e.to_string());

    if result.is_ok() {
        let audit_request = crate::models::audit_log::RecordAuditLogRequest {
            module: "project".to_string(),
            action: "rename".to_string(),
            description: format!("重命名项目: {} -> {}", old_name, new_name),
            status: "success".to_string(),
            duration_ms: None,
            details: None,
        };
        let _ = crate::services::AuditLogService::record_audit_log(&conn, audit_request);
    }

    result
}

/// 切换到指定项目（切换数据库）
///
/// ⚠️ 关键约束：调用 `state.db_manager.connect()` 之前，必须确保没有任何
/// `MutexGuardConnection` 在作用域内持有 `active_connection` 的锁，否则
/// 会发生 "同一线程重复获取同一 Mutex" 的**死锁**。
#[tauri::command]
pub fn switch_project(state: State<'_, TauriAppState>, project_name: String) -> Result<String, String> {
    let db_path = dirs::data_dir()
        .ok_or("无法获取数据目录".to_string())?
        .join("quickersql")
        .join(&project_name)
        .join("meta.db");

    if !db_path.exists() {
        return Err(format!("项目 '{}' 的数据库文件不存在", project_name));
    }

    // 1️⃣ 先更新 db_path（内部不获取 active_connection 锁）
    state.set_db_path(db_path.clone())?;

    // 2️⃣ 关闭旧连接（显式释放 active_connection 的锁）
    //    这里直接调用 close_connection() 清空 active_connection 中的 Option
    //    注意：之前的旧 conn 会在 drop 时释放锁，这里再次确认清空
    state.db_manager.close_connection();

    // 3️⃣ 建立新连接（此时 active_connection 不被任何 MutexGuard 持有）
    //    connect() 内部会 lock_active_connection()，无死锁风险
    state.db_manager.connect("sqlite", &db_path).map_err(|e| e.to_string())?;

    // 4️⃣ 做一次新数据库的系统表初始化和迁移
    //    （因为切到了一个全新的 SQLite 文件，里面可能没有 __ 前缀的系统表）
    let result_msg: String;
    {
        let conn = state.db_manager.get_connection().map_err(|e| e.to_string())?;
        // 旧表名迁移（如 _settings → __settings）
        if let Err(e) = crate::services::MigrationService::run_legacy_table_migrations(&conn) {
            log::warn!("旧表名迁移失败: {}", e);
        }
        // 确保系统表存在
        if let Err(e) = crate::services::SettingsService::ensure_settings_table_exists(&conn) {
            log::warn!("初始化设置表失败: {}", e);
        }
        if let Err(e) = crate::services::TaskService::ensure_tables_exists(&conn) {
            log::warn!("初始化自动化任务表失败: {}", e);
        }
        if let Err(e) = crate::services::QueryHistoryService::ensure_query_history_table_exists(&conn) {
            log::warn!("初始化查询历史表失败: {}", e);
        }
        if let Err(e) = crate::services::AuditLogService::ensure_audit_log_table_exists(&conn) {
            log::warn!("初始化审计日志表失败: {}", e);
        }
        if let Err(e) = crate::services::TrashService::ensure_trash_table_exists(&conn) {
            log::warn!("初始化回收站表失败: {}", e);
        }
        if let Err(e) = crate::services::DashboardService::ensure_tables_exist(&conn) {
            log::warn!("初始化仪表盘表失败: {}", e);
        }
        if let Err(e) = crate::services::AppStateService::ensure_app_state_table_exists(&conn) {
            log::warn!("初始化应用状态表失败: {}", e);
        }
        if let Err(e) = crate::services::AppStateService::ensure_workspace_tables_exist(&conn) {
            log::warn!("初始化工作区表失败: {}", e);
        }

        // 写入 audit log
        let audit_request = crate::models::audit_log::RecordAuditLogRequest {
            module: "project".to_string(),
            action: "switch".to_string(),
            description: format!("切换到项目: {}", project_name),
            status: "success".to_string(),
            duration_ms: None,
            details: None,
        };
        let _ = crate::services::AuditLogService::record_audit_log(&conn, audit_request);
        result_msg = format!("已切换到项目: {}", project_name);
    }

    Ok(result_msg)
}

/// 从指定路径打开数据库
///
/// ⚠️ 与 `switch_project` 相同的约束：connect() 之前必须无任何 MutexGuardConnection 在作用域内。
#[tauri::command]
pub fn open_database_from_path(state: State<'_, TauriAppState>, db_path: String) -> Result<String, String> {
    let path = PathBuf::from(db_path.clone());

    if !path.exists() {
        return Err(format!("数据库文件不存在: {}", db_path));
    }

    // 1. 更新 db_path（不获取 active_connection 锁）
    state.set_db_path(path.clone())?;

    // 2. 关闭旧连接，确保 active_connection 的锁无任何持有者
    state.db_manager.close_connection();

    // 3. 建立新连接
    state.db_manager.connect("sqlite", &path).map_err(|e| e.to_string())?;

    // 4. 初始化新数据库的系统表 + 记录审计日志
    //    （内层 scope 确保 conn 会被 drop 后才能再次调用 get_connection）
    {
        let conn = state.db_manager.get_connection().map_err(|e| e.to_string())?;
        if let Err(e) = crate::services::MigrationService::run_legacy_table_migrations(&conn) {
            log::warn!("旧表名迁移失败: {}", e);
        }
        if let Err(e) = crate::services::SettingsService::ensure_settings_table_exists(&conn) {
            log::warn!("初始化设置表失败: {}", e);
        }
        if let Err(e) = crate::services::TaskService::ensure_tables_exists(&conn) {
            log::warn!("初始化自动化任务表失败: {}", e);
        }
        if let Err(e) = crate::services::QueryHistoryService::ensure_query_history_table_exists(&conn) {
            log::warn!("初始化查询历史表失败: {}", e);
        }
        if let Err(e) = crate::services::AuditLogService::ensure_audit_log_table_exists(&conn) {
            log::warn!("初始化审计日志表失败: {}", e);
        }
        if let Err(e) = crate::services::TrashService::ensure_trash_table_exists(&conn) {
            log::warn!("初始化回收站表失败: {}", e);
        }
        if let Err(e) = crate::services::DashboardService::ensure_tables_exist(&conn) {
            log::warn!("初始化仪表盘表失败: {}", e);
        }
        if let Err(e) = crate::services::AppStateService::ensure_app_state_table_exists(&conn) {
            log::warn!("初始化应用状态表失败: {}", e);
        }
        if let Err(e) = crate::services::AppStateService::ensure_workspace_tables_exist(&conn) {
            log::warn!("初始化工作区表失败: {}", e);
        }

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
    let conn = state.db_manager.get_connection().map_err(|e| e.to_string())?;
    let source_path = state.db_path.lock().map_err(|e| e.to_string())?;
    let dest = PathBuf::from(dest_path.clone());

    let result = ProjectService::export_database(&source_path, &dest)
        .map(|_| format!("数据库已导出到: {}", dest.to_string_lossy()))
        .map_err(|e| e.to_string());

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
    let path = state.db_path.lock().map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

/// 批量导出选中的项目
#[tauri::command]
pub fn export_selected_projects(state: State<'_, TauriAppState>, selected_projects: Vec<String>, dest_dir: String) -> Result<Vec<String>, String> {
    let conn = state.db_manager.get_connection().map_err(|e| e.to_string())?;
    let dest_path = PathBuf::from(&dest_dir);

    if !dest_path.exists() {
        return Err(format!("导出目录不存在: {}", dest_dir));
    }

    let mut exported_paths = Vec::new();

    for project_name in &selected_projects {
        let project_db_path = dirs::data_dir()
            .ok_or("无法获取数据目录".to_string())?
            .join("quickersql")
            .join(&project_name)
            .join("meta.db");

        if !project_db_path.exists() {
            return Err(format!("项目 '{}' 的数据库不存在", project_name));
        }

        let export_file = dest_path.join(format!("{}.db", project_name));

        ProjectService::export_database(&project_db_path, &export_file)
            .map_err(|e| format!("导出项目 '{}' 失败: {}", project_name, e))?;

        exported_paths.push(export_file.to_string_lossy().to_string());
    }

    let audit_request = crate::models::audit_log::RecordAuditLogRequest {
        module: "project".to_string(),
        action: "batch_export".to_string(),
        description: format!("批量导出 {} 个项目到: {}", selected_projects.len(), dest_dir),
        status: "success".to_string(),
        duration_ms: None,
        details: Some(format!("projects={:?}", selected_projects)),
    };
    let _ = crate::services::AuditLogService::record_audit_log(&conn, audit_request);

    Ok(exported_paths)
}

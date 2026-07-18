//! 数据库相关 Tauri 命令
//!
//! 所有数据库操作均下沉到 [`crate::services::DatabaseService`]，
//! 本文件只负责参数解析、获取连接、调用服务、写审计日志。
use crate::TauriAppState;
use crate::database::SqlIdentifier;
use crate::models::database::{ColumnInfo, DatabaseInfo, DatabaseStatus, TableInfo, TableMetaInfo};
use crate::services::DatabaseService;
use tauri::State;

/// 列出可用数据库类型
#[tauri::command]
pub fn list_databases(_state: State<'_, TauriAppState>) -> Vec<DatabaseInfo> {
    vec![
        DatabaseInfo {
            db_type: "sqlite".to_string(),
            name: "SQLite".to_string(),
            is_available: true,
            description: "轻量级本地数据库".to_string(),
        },
    ]
}

/// 获取数据库状态
#[tauri::command]
pub fn get_database_status(state: State<'_, TauriAppState>) -> Result<DatabaseStatus, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[database] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;

    let tables_list = DatabaseService::list_tables_with_meta(&conn)?;
    let tables: Vec<String> = tables_list.iter().map(|t| t.name.clone()).collect();

    // 逐表调用 DatabaseService::get_row_count 收集行数
    let mut row_count = Vec::with_capacity(tables.len());
    for table in &tables {
        if let Ok(count) = DatabaseService::get_row_count(&conn, table) {
            row_count.push((table.clone(), count));
        }
    }

    Ok(DatabaseStatus {
        db_type: conn.get_database_type().to_string(),
        tables,
        row_count,
        is_connected: true,
    })
}

/// 获取所有数据库状态
#[tauri::command]
pub fn get_all_database_status(state: State<'_, TauriAppState>) -> Vec<DatabaseStatus> {
    let mut results = Vec::new();
    if let Ok(status) = get_database_status(state) {
        results.push(status);
    }
    results
}

/// 列出所有表（含 row_count / column_count / is_system_table 元信息）
#[tauri::command]
pub fn list_tables(state: State<'_, TauriAppState>) -> Result<Vec<TableInfo>, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[database] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;
    DatabaseService::list_tables_with_meta(&conn)
}

/// 查询指定表的列元信息（返回 [`ColumnInfo`] 数组）
#[tauri::command]
pub fn get_table_columns(
    state: State<'_, TauriAppState>,
    table_name: String,
) -> Result<Vec<ColumnInfo>, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[database] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;
    DatabaseService::get_table_columns(&conn, &table_name)
}

/// 删除表（移到回收站）
#[tauri::command]
pub fn delete_table(state: State<'_, TauriAppState>, table_name: String) -> Result<String, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    // 标识符校验
    let _ = SqlIdentifier::new(&table_name)?;

    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[database] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;

    // 获取表的行数（用于写审计日志与回收站条目）
    let row_count = crate::services::TrashService::get_table_row_count(&conn, &table_name)?;

    // 将表移到回收站
    let _result = crate::services::TrashService::move_to_trash_sync(&conn, &table_name, row_count)?;

    // 删除对应的 DuckDB VIEW（仅在可用时）
    if let Ok(duckdb_conn) = state.get_duckdb_connection() {
        if let Ok(guard) = duckdb_conn.lock() {
            let _ = crate::services::ViewService::drop_single_view(&**guard, &table_name);
        }
    }

    // 记录审计日志
    let audit_request = crate::models::audit_log::RecordAuditLogRequest {
        module: "database".to_string(),
        action: "delete_table".to_string(),
        description: format!("删除表 '{}'", table_name),
        status: "success".to_string(),
        duration_ms: None,
        details: Some(format!("table_name={}, row_count={}", table_name, row_count)),
    };
    let _ = crate::services::AuditLogService::record_audit_log(&conn, audit_request);

    Ok(format!("表 '{}' 已移到回收站", table_name))
}

/// 重命名表
#[tauri::command]
pub fn rename_table(
    state: State<'_, TauriAppState>,
    old_table_name: String,
    new_table_name: String,
) -> Result<String, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[database] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;

    // 核心逻辑下沉到 DatabaseService（系统表检查、存在性校验、执行重命名）
    DatabaseService::rename_table_safe(&conn, &old_table_name, &new_table_name)?;

    // 同步 DuckDB VIEW（删除旧 VIEW，由 ViewService 负责安全封装）
    if let Ok(duckdb_conn) = state.get_duckdb_connection() {
        if let Ok(guard) = duckdb_conn.lock() {
            let _ = crate::services::ViewService::drop_single_view(&**guard, &old_table_name);
        }
    }

    // 记录审计日志
    let audit_request = crate::models::audit_log::RecordAuditLogRequest {
        module: "database".to_string(),
        action: "rename_table".to_string(),
        description: format!("重命名表 '{}' -> '{}'", old_table_name, new_table_name),
        status: "success".to_string(),
        duration_ms: None,
        details: Some(format!("old={}, new={}", old_table_name, new_table_name)),
    };
    let _ = crate::services::AuditLogService::record_audit_log(&conn, audit_request);

    Ok(format!("表 '{}' 已重命名为 '{}'", old_table_name, new_table_name))
}

/// 获取表的扩展元信息（索引数 + 估算磁盘大小）
#[tauri::command]
pub fn get_table_meta(state: State<'_, TauriAppState>, table_name: String) -> Result<TableMetaInfo, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }
    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[database] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;
    DatabaseService::get_table_performance_info(&conn, &table_name)
}

/// 获取表的行数
#[tauri::command]
pub fn get_table_row_count(state: State<'_, TauriAppState>, table_name: String) -> Result<i64, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[database] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;
    DatabaseService::get_row_count(&conn, &table_name)
}

/// DuckDB 诊断信息（用于排查 DuckDB 初始化失败问题）
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DuckDbDiagnostics {
    pub is_available: bool,
    pub error_message: Option<String>,
    pub init_attempted: bool,
}

/// 获取 DuckDB 诊断信息
#[tauri::command]
pub fn get_duckdb_diagnostics(state: State<'_, TauriAppState>) -> DuckDbDiagnostics {
    let duckdb_guard = state.duckdb_conn.lock().ok();
    let is_available = duckdb_guard.as_ref().and_then(|g| g.as_ref()).is_some();

    if is_available {
        DuckDbDiagnostics {
            is_available: true,
            error_message: None,
            init_attempted: true,
        }
    } else {
        // 尝试触发初始化并捕获错误
        match state.get_duckdb_connection() {
            Ok(_) => DuckDbDiagnostics {
                is_available: true,
                error_message: None,
                init_attempted: true,
            },
            Err(e) => DuckDbDiagnostics {
                is_available: false,
                error_message: Some(e),
                init_attempted: true,
            },
        }
    }
}

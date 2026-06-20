//! SQL 执行相关 Tauri 命令
use crate::TauriAppState;
use crate::database::SqlIdentifier;
use crate::models::database::{SqlStatementResult, BatchExecuteResult};
use tauri::State;
use std::panic::catch_unwind;

/// 拆分 SQL 语句
fn split_sql_statements(sql: &str) -> Vec<String> {
    let mut statements = Vec::new();
    let mut current = String::new();
    let mut in_string = false;
    let mut string_char = '\0';
    let mut in_comment = false;
    let mut in_block_comment = false;

    let chars: Vec<char> = sql.chars().collect();
    let mut i = 0;

    while i < chars.len() {
        let c = chars[i];

        if in_block_comment {
            if c == '*' && i + 1 < chars.len() && chars[i + 1] == '/' {
                in_block_comment = false;
                i += 2;
                continue;
            }
            i += 1;
            continue;
        }

        if !in_string && !in_comment {
            if c == '-' && i + 1 < chars.len() && chars[i + 1] == '-' {
                in_comment = true;
                i += 2;
                continue;
            }
            if c == '/' && i + 1 < chars.len() && chars[i + 1] == '*' {
                in_block_comment = true;
                i += 2;
                continue;
            }
            if c == '\'' || c == '"' {
                in_string = true;
                string_char = c;
                current.push(c);
                i += 1;
                continue;
            }
            if c == ';' {
                let stmt = current.trim().to_string();
                if !stmt.is_empty() {
                    statements.push(stmt);
                }
                current.clear();
                i += 1;
                continue;
            }
        } else if in_string {
            if c == '\\' && i + 1 < chars.len() {
                current.push(c);
                current.push(chars[i + 1]);
                i += 2;
                continue;
            }
            if c == string_char {
                in_string = false;
            }
        } else if in_comment {
            if c == '\n' || c == '\r' {
                in_comment = false;
                continue;
            }
            i += 1;
            continue;
        }

        current.push(c);
        i += 1;
    }

    let stmt = current.trim().to_string();
    if !stmt.is_empty() {
        statements.push(stmt);
    }

    statements
}

/// 解析 DROP TABLE 语句中的表名
fn parse_drop_table_table_name(stmt: &str) -> Option<String> {
    let upper_stmt = stmt.to_uppercase();
    let upper_stmt = upper_stmt.trim();

    if !upper_stmt.starts_with("DROP TABLE") {
        return None;
    }

    let mut rest = upper_stmt[11..].trim().to_string();

    if rest.starts_with("IF EXISTS") {
        rest = rest[10..].trim().to_string();
    }

    let parts: Vec<&str> = rest.split_whitespace().collect();
    if parts.is_empty() {
        return None;
    }

    let table_name = parts[0].trim().to_string();

    Some(table_name.replace('"', "").replace('\'', ""))
}

struct ExecutionMetadata {
    success: bool,
    row_count: Option<i64>,
    error_message: Option<String>,
}

/// 记录查询历史的辅助函数（使用已有的连接）
fn record_query_to_history(
    conn: &crate::database::MutexGuardConnection,
    sql: &str,
    execution_time_ms: i64,
    row_count: Option<i64>,
    success: bool,
    error_message: Option<String>,
) {
    let request = crate::models::query_history::RecordQueryHistoryRequest {
        sql: sql.to_string(),
        name: None,
        execution_time_ms: Some(execution_time_ms),
        row_count,
        success,
        error_message,
    };
    let _ = crate::services::QueryHistoryService::record_query_sync(conn, request);
}

fn execute_sql_with_sqlite(
    conn: &crate::database::MutexGuardConnection,
    stmt: &str,
    results: &mut Vec<SqlStatementResult>,
    success_count: &mut usize,
    fail_count: &mut usize,
) -> ExecutionMetadata {
    let upper_stmt = stmt.to_uppercase();

    if upper_stmt.starts_with("SELECT") || upper_stmt.starts_with("PRAGMA") {
        match conn.query(stmt, &[]) {
            Ok(result) => {
                results.push(SqlStatementResult {
                    statement: stmt.to_string(),
                    success: true,
                    error: None,
                    columns: Some(result.columns),
                    rows: Some(result.rows.clone()),
                    affected_rows: None,
                });
                *success_count += 1;
                ExecutionMetadata {
                    success: true,
                    row_count: Some(result.rows.len() as i64),
                    error_message: None,
                }
            }
            Err(e) => {
                results.push(SqlStatementResult {
                    statement: stmt.to_string(),
                    success: false,
                    error: Some(format!("执行查询失败: {}", e)),
                    columns: None,
                    rows: None,
                    affected_rows: None,
                });
                *fail_count += 1;
                ExecutionMetadata {
                    success: false,
                    row_count: None,
                    error_message: Some(format!("执行查询失败: {}", e)),
                }
            }
        }
    } else if upper_stmt.starts_with("DROP TABLE") {
        match parse_drop_table_table_name(stmt) {
            Some(table_name) => {
                // 禁止 DROP 系统表
                if SqlIdentifier::is_system_table(&table_name) {
                    let err_msg = format!("系统表 '{}' 不允许删除或修改", table_name);
                    results.push(SqlStatementResult {
                        statement: stmt.to_string(),
                        success: false,
                        error: Some(err_msg.clone()),
                        columns: None,
                        rows: None,
                        affected_rows: None,
                    });
                    *fail_count += 1;
                    return ExecutionMetadata {
                        success: false,
                        row_count: None,
                        error_message: Some(err_msg),
                    };
                }

                let result = crate::services::TrashService::get_table_row_count(conn, &table_name)
                    .and_then(|row_count| crate::services::TrashService::move_to_trash_sync(conn, &table_name, row_count as u64));

                match result {
                    Ok(_) => {
                        results.push(SqlStatementResult {
                            statement: stmt.to_string(),
                            success: true,
                            error: None,
                            columns: None,
                            rows: None,
                            affected_rows: Some(1),
                        });
                        *success_count += 1;
                        ExecutionMetadata {
                            success: true,
                            row_count: Some(1),
                            error_message: None,
                        }
                    }
                    Err(e) => {
                        results.push(SqlStatementResult {
                            statement: stmt.to_string(),
                            success: false,
                            error: Some(format!("删除表失败: {}", e)),
                            columns: None,
                            rows: None,
                            affected_rows: None,
                        });
                        *fail_count += 1;
                        ExecutionMetadata {
                            success: false,
                            row_count: None,
                            error_message: Some(format!("删除表失败: {}", e)),
                        }
                    }
                }
            }
            None => {
                results.push(SqlStatementResult {
                    statement: stmt.to_string(),
                    success: false,
                    error: Some("无法解析 DROP TABLE 语句中的表名".to_string()),
                    columns: None,
                    rows: None,
                    affected_rows: None,
                });
                *fail_count += 1;
                ExecutionMetadata {
                    success: false,
                    row_count: None,
                    error_message: Some("无法解析 DROP TABLE 语句中的表名".to_string()),
                }
            }
        }
    } else {
        match conn.execute(stmt, &[]) {
            Ok(rows) => {
                results.push(SqlStatementResult {
                    statement: stmt.to_string(),
                    success: true,
                    error: None,
                    columns: None,
                    rows: None,
                    affected_rows: Some(rows),
                });
                *success_count += 1;
                ExecutionMetadata {
                    success: true,
                    row_count: Some(rows as i64),
                    error_message: None,
                }
            }
            Err(e) => {
                results.push(SqlStatementResult {
                    statement: stmt.to_string(),
                    success: false,
                    error: Some(format!("执行SQL失败: {}", e)),
                    columns: None,
                    rows: None,
                    affected_rows: None,
                });
                *fail_count += 1;
                ExecutionMetadata {
                    success: false,
                    row_count: None,
                    error_message: Some(format!("执行SQL失败: {}", e)),
                }
            }
        }
    }
}

/// 判断一条 SQL 是否应当使用独立临时连接执行。
/// SELECT / WITH / EXPLAIN / PRAGMA 等长查询走临时连接，
/// 避免持有主连接锁阻塞其他短命令。
fn should_use_temp_connection(sql: &str) -> bool {
    let upper = sql.trim_start().to_uppercase();
    upper.starts_with("SELECT")
        || upper.starts_with("WITH")
        || upper.starts_with("EXPLAIN")
        || upper.starts_with("PRAGMA")
}

#[tauri::command]
pub fn execute_sql(state: State<'_, TauriAppState>, sql: String) -> Result<BatchExecuteResult, String> {
    use std::time::Instant;
    let overall_start = Instant::now();

    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    // 主连接：读取表名元信息、写审计日志、写查询历史
    let sqlite_conn = state.db_manager.get_connection().map_err(|e| e.to_string())?;

    let table_names = crate::database::router::QueryRouter::get_table_names(&sqlite_conn);
    let table_names_ref: Vec<&str> = table_names.iter().map(|s| s.as_str()).collect();

    let statements = split_sql_statements(&sql);

    if statements.is_empty() {
        return Err("没有有效的SQL语句".to_string());
    }

    let mut results: Vec<SqlStatementResult> = Vec::new();
    let mut success_count = 0;
    let mut fail_count = 0;
    let mut execution_metadatas: Vec<(String, i64, ExecutionMetadata)> = Vec::new();

    for stmt in statements.iter() {
        let trimmed_stmt = stmt.trim();
        if trimmed_stmt.is_empty() {
            continue;
        }

        let stmt_start = Instant::now();
        let use_duckdb = crate::database::router::QueryRouter::should_use_duckdb(trimmed_stmt);

        let metadata: ExecutionMetadata;

        if use_duckdb {
            match state.get_duckdb_connection() {
                Ok(duckdb_conn_arc) => {
                    {
                        let duckdb_conn = duckdb_conn_arc.lock().map_err(|e| e.to_string())?;

                        let routed_sql_result = crate::database::router::QueryRouter::route_table_names(
                            trimmed_stmt,
                            &table_names_ref
                        );

                        match routed_sql_result {
                            Ok(routed_sql) => {
                                let result = catch_unwind(|| {
                                    duckdb_conn.query(&routed_sql, &[])
                                });

                                match result {
                                    Ok(Ok(query_result)) => {
                                        results.push(SqlStatementResult {
                                            statement: trimmed_stmt.to_string(),
                                            success: true,
                                            error: None,
                                            columns: Some(query_result.columns),
                                            rows: Some(query_result.rows.clone()),
                                            affected_rows: None,
                                        });
                                        success_count += 1;
                                        metadata = ExecutionMetadata {
                                            success: true,
                                            row_count: Some(query_result.rows.len() as i64),
                                            error_message: None,
                                        };
                                    }
                                    Ok(Err(e)) => {
                                        log::warn!("DuckDB execution failed, falling back to SQLite: {}", e);
                                        // 根据前缀选择主连接或临时连接
                                        if should_use_temp_connection(trimmed_stmt) {
                                            match state.db_manager.open_temporary_connection() {
                                                Ok(temp_conn) => {
                                                    metadata = execute_sql_on_conn(
                                                        &*temp_conn,
                                                        trimmed_stmt,
                                                        &mut results,
                                                        &mut success_count,
                                                        &mut fail_count,
                                                    );
                                                }
                                                Err(e) => {
                                                    log::warn!("临时连接获取失败，回退到主连接: {}", e);
                                                    metadata = execute_sql_with_sqlite(&sqlite_conn, trimmed_stmt, &mut results, &mut success_count, &mut fail_count);
                                                }
                                            }
                                        } else {
                                            metadata = execute_sql_with_sqlite(&sqlite_conn, trimmed_stmt, &mut results, &mut success_count, &mut fail_count);
                                        }
                                    }
                                    Err(e) => {
                                        log::error!("DuckDB panicked, falling back to SQLite: {:?}", e);
                                        if should_use_temp_connection(trimmed_stmt) {
                                            match state.db_manager.open_temporary_connection() {
                                                Ok(temp_conn) => {
                                                    metadata = execute_sql_on_conn(
                                                        &*temp_conn,
                                                        trimmed_stmt,
                                                        &mut results,
                                                        &mut success_count,
                                                        &mut fail_count,
                                                    );
                                                }
                                                Err(e) => {
                                                    log::warn!("临时连接获取失败，回退到主连接: {}", e);
                                                    metadata = execute_sql_with_sqlite(&sqlite_conn, trimmed_stmt, &mut results, &mut success_count, &mut fail_count);
                                                }
                                            }
                                        } else {
                                            metadata = execute_sql_with_sqlite(&sqlite_conn, trimmed_stmt, &mut results, &mut success_count, &mut fail_count);
                                        }
                                    }
                                }
                            }
                            Err(e) => {
                                log::warn!("SQL routing failed, falling back to SQLite: {}", e);
                                if should_use_temp_connection(trimmed_stmt) {
                                    match state.db_manager.open_temporary_connection() {
                                        Ok(temp_conn) => {
                                            metadata = execute_sql_on_conn(
                                                &*temp_conn,
                                                trimmed_stmt,
                                                &mut results,
                                                &mut success_count,
                                                &mut fail_count,
                                            );
                                        }
                                        Err(e) => {
                                            log::warn!("临时连接获取失败，回退到主连接: {}", e);
                                            metadata = execute_sql_with_sqlite(&sqlite_conn, trimmed_stmt, &mut results, &mut success_count, &mut fail_count);
                                        }
                                    }
                                } else {
                                    metadata = execute_sql_with_sqlite(&sqlite_conn, trimmed_stmt, &mut results, &mut success_count, &mut fail_count);
                                }
                            }
                        }
                    }
                }
                Err(e) => {
                    log::warn!("DuckDB not initialized, using SQLite: {}", e);
                    // 选择连接类型
                    if should_use_temp_connection(trimmed_stmt) {
                        match state.db_manager.open_temporary_connection() {
                            Ok(temp_conn) => {
                                metadata = execute_sql_on_conn(
                                    &*temp_conn,
                                    trimmed_stmt,
                                    &mut results,
                                    &mut success_count,
                                    &mut fail_count,
                                );
                            }
                            Err(e) => {
                                log::warn!("临时连接获取失败，回退到主连接: {}", e);
                                metadata = execute_sql_with_sqlite(&sqlite_conn, trimmed_stmt, &mut results, &mut success_count, &mut fail_count);
                            }
                        }
                    } else {
                        metadata = execute_sql_with_sqlite(&sqlite_conn, trimmed_stmt, &mut results, &mut success_count, &mut fail_count);
                    }
                }
            }
        } else {
            // SQLite 路径：按前缀选择主连接或临时连接
            if should_use_temp_connection(trimmed_stmt) {
                match state.db_manager.open_temporary_connection() {
                    Ok(temp_conn) => {
                        metadata = execute_sql_on_conn(
                            &*temp_conn,
                            trimmed_stmt,
                            &mut results,
                            &mut success_count,
                            &mut fail_count,
                        );
                    }
                    Err(e) => {
                        log::warn!("临时连接获取失败，回退到主连接: {}", e);
                        metadata = execute_sql_with_sqlite(&sqlite_conn, trimmed_stmt, &mut results, &mut success_count, &mut fail_count);
                    }
                }
            } else {
                metadata = execute_sql_with_sqlite(&sqlite_conn, trimmed_stmt, &mut results, &mut success_count, &mut fail_count);
            }
        }

        let stmt_duration = stmt_start.elapsed().as_millis() as i64;
        execution_metadatas.push((trimmed_stmt.to_string(), stmt_duration, metadata));
    }

    // 记录查询历史（此时DuckDB锁已释放，避免死锁）
    for (sql_stmt, duration, meta) in &execution_metadatas {
        record_query_to_history(
            &sqlite_conn,
            &sql_stmt,
            *duration,
            meta.row_count,
            meta.success,
            meta.error_message.clone(),
        );
    }

    // 记录审计日志
    {
        for (sql_stmt, duration, meta) in &execution_metadatas {
            let description: String = sql_stmt.chars().take(100).collect();
            let details = serde_json::to_string(&serde_json::json!({
                "sql": sql_stmt,
            })).unwrap_or_else(|_| format!("{{\"sql\":\"{}\"}}", sql_stmt.replace('"', "\\\"")));
            let audit_request = crate::models::audit_log::RecordAuditLogRequest {
                module: "sql".to_string(),
                action: "query".to_string(),
                description,
                status: if meta.success { "success".to_string() } else { "failed".to_string() },
                duration_ms: Some(*duration),
                details: Some(details),
            };
            let _ = crate::services::AuditLogService::record_audit_log(&sqlite_conn, audit_request);
        }
    }

    log::debug!("整体执行耗时: {:?}", overall_start.elapsed());

    Ok(BatchExecuteResult {
        results,
        success_count,
        fail_count,
    })
}

/// 在任意实现了 `DatabaseConnection` 的连接上执行 SQL，
/// 内部只负责 SELECT/PRAGMA → query()，其余 → execute()，
/// 不与任何全局锁耦合（调用方决定连接的生命周期）。
fn execute_sql_on_conn(
    conn: &dyn crate::database::DatabaseConnection,
    stmt: &str,
    results: &mut Vec<SqlStatementResult>,
    success_count: &mut usize,
    fail_count: &mut usize,
) -> ExecutionMetadata {
    let upper_stmt = stmt.to_uppercase();

    if upper_stmt.starts_with("SELECT") || upper_stmt.starts_with("PRAGMA") {
        match conn.query(stmt, &[]) {
            Ok(result) => {
                results.push(SqlStatementResult {
                    statement: stmt.to_string(),
                    success: true,
                    error: None,
                    columns: Some(result.columns),
                    rows: Some(result.rows.clone()),
                    affected_rows: None,
                });
                *success_count += 1;
                ExecutionMetadata {
                    success: true,
                    row_count: Some(result.rows.len() as i64),
                    error_message: None,
                }
            }
            Err(e) => {
                results.push(SqlStatementResult {
                    statement: stmt.to_string(),
                    success: false,
                    error: Some(format!("执行查询失败: {}", e)),
                    columns: None,
                    rows: None,
                    affected_rows: None,
                });
                *fail_count += 1;
                ExecutionMetadata {
                    success: false,
                    row_count: None,
                    error_message: Some(format!("执行查询失败: {}", e)),
                }
            }
        }
    } else {
        match conn.execute(stmt, &[]) {
            Ok(rows) => {
                results.push(SqlStatementResult {
                    statement: stmt.to_string(),
                    success: true,
                    error: None,
                    columns: None,
                    rows: None,
                    affected_rows: Some(rows),
                });
                *success_count += 1;
                ExecutionMetadata {
                    success: true,
                    row_count: Some(rows as i64),
                    error_message: None,
                }
            }
            Err(e) => {
                results.push(SqlStatementResult {
                    statement: stmt.to_string(),
                    success: false,
                    error: Some(format!("执行SQL失败: {}", e)),
                    columns: None,
                    rows: None,
                    affected_rows: None,
                });
                *fail_count += 1;
                ExecutionMetadata {
                    success: false,
                    row_count: None,
                    error_message: Some(format!("执行SQL失败: {}", e)),
                }
            }
        }
    }
}
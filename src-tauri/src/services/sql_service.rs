//! SQL 执行服务
//!
//! 封装复杂的 SQL 执行调度逻辑：
//! - SQL 语句拆分
//! - DuckDB / SQLite 路由
//! - 临时连接回退
//! - panic 安全保护
//! - 查询历史、审计日志记录
//!
//! 所有 `conn.query` / `conn.execute` 调用必须留在此模块，
//! commands 层只负责参数校验、连接获取、返回结果包装。

use crate::database::{DatabaseConnection, DatabaseManager, MutexGuardConnection, SqlIdentifier};
use crate::models::database::{BatchExecuteResult, SqlStatementResult};
use std::panic::catch_unwind;
use std::sync::Arc;
use std::sync::Mutex;
use std::time::Instant;

/// SQL 执行元信息：单条语句执行结果摘要
#[derive(Clone)]
struct ExecutionMetadata {
    success: bool,
    row_count: Option<i64>,
    error_message: Option<String>,
}

/// SQL 执行上下文：批量执行流水线中各函数共享的执行状态
///
/// 持有 SQLite 连接、DuckDB 连接选项、DB Manager、表名清单、查询缓存以及
/// 结果累加器（`results` / `success_count` / `fail_count`），避免在
/// `execute_via_duckdb_or_sqlite` 等流水线函数之间重复传递 8+ 个参数。
///
/// 仅在 `sql_service.rs` 内部使用，不跨模块、不序列化。
struct SqlExecContext<'a> {
    sqlite_conn: &'a MutexGuardConnection<'a>,
    duckdb_conn_opt: &'a Option<Arc<Mutex<Box<dyn DatabaseConnection>>>>,
    db_manager: &'a DatabaseManager,
    table_names: &'a [String],
    query_cache: Option<&'a crate::services::query_cache_service::QueryCacheService>,
    results: &'a mut Vec<SqlStatementResult>,
    success_count: &'a mut usize,
    fail_count: &'a mut usize,
}

/// SQL 执行调度服务
pub struct SqlExecutionService;

impl SqlExecutionService {
    /// 拆分 SQL 语句
    pub fn split_sql_statements(sql: &str) -> Vec<String> {
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
    pub fn parse_drop_table_table_name(stmt: &str) -> Option<String> {
        let upper_stmt = stmt.to_uppercase();
        let upper_stmt = upper_stmt.trim();

        if !upper_stmt.starts_with("DROP TABLE") {
            return None;
        }

        // 安全检查：确保 "DROP TABLE" 后面有内容
        if upper_stmt.len() <= 11 {
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

        Some(table_name.replace(['"', '\''], ""))
    }

    /// 判断一条 SQL 是否应当使用独立临时连接执行。
    pub fn should_use_temp_connection(sql: &str) -> bool {
        let upper = sql.trim_start().to_uppercase();
        upper.starts_with("SELECT")
            || upper.starts_with("WITH")
            || upper.starts_with("EXPLAIN")
            || upper.starts_with("PRAGMA")
    }

    /// 判断一组 SQL 语句是否全部为只读（SELECT / WITH / EXPLAIN / PRAGMA）。
    ///
    /// 与 [`crate::services::query_cache_service::is_cacheable`] 保持一致的白名单语义，
    /// 用于多语句场景下"是否可以尝试走缓存路径"的前置判断。
    pub fn is_all_readonly(stmts: &[String]) -> bool {
        stmts.iter().all(|s| {
            let trimmed = s.trim_start().to_uppercase();
            trimmed.starts_with("SELECT")
                || trimmed.starts_with("WITH")
                || trimmed.starts_with("EXPLAIN")
                || trimmed.starts_with("PRAGMA")
        })
    }

    /// 判断一组 SQL 语句中是否包含写操作（INSERT / UPDATE / DELETE / DROP / CREATE / ALTER / TRUNCATE / REPLACE）。
    ///
    /// 用于：在多语句场景下决定是否需要触发查询缓存全量失效。
    pub fn contains_write_operation(stmts: &[String]) -> bool {
        stmts.iter().any(|s| {
            let trimmed = s.trim_start().to_uppercase();
            trimmed.starts_with("INSERT")
                || trimmed.starts_with("UPDATE")
                || trimmed.starts_with("DELETE")
                || trimmed.starts_with("DROP")
                || trimmed.starts_with("CREATE")
                || trimmed.starts_with("ALTER")
                || trimmed.starts_with("TRUNCATE")
                || trimmed.starts_with("REPLACE")
        })
    }

    /// 记录查询历史的辅助函数
    pub fn record_query_to_history(
        conn: &MutexGuardConnection<'_>,
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

    /// 在 SQLite 主连接上执行单条语句（路由到具体子函数）
    fn execute_on_sqlite(
        conn: &MutexGuardConnection<'_>,
        stmt: &str,
        results: &mut Vec<SqlStatementResult>,
        success_count: &mut usize,
        fail_count: &mut usize,
    ) -> ExecutionMetadata {
        let upper_stmt = stmt.to_uppercase();

        let is_query_stmt = upper_stmt.starts_with("SELECT")
            || upper_stmt.starts_with("WITH")
            || upper_stmt.starts_with("EXPLAIN")
            || upper_stmt.starts_with("PRAGMA");

        if is_query_stmt {
            Self::execute_query_on_sqlite(conn, stmt, results, success_count, fail_count)
        } else if upper_stmt.starts_with("DROP TABLE") {
            Self::execute_drop_table_on_sqlite(conn, stmt, results, success_count, fail_count)
        } else {
            Self::execute_other_on_sqlite(conn, stmt, results, success_count, fail_count)
        }
    }

    /// SQLite：执行查询语句（SELECT/WITH/EXPLAIN/PRAGMA）
    fn execute_query_on_sqlite(
        conn: &MutexGuardConnection<'_>,
        stmt: &str,
        results: &mut Vec<SqlStatementResult>,
        success_count: &mut usize,
        fail_count: &mut usize,
    ) -> ExecutionMetadata {
        match conn.query(stmt, &[]) {
            Ok(result) => {
                let row_count = result.rows.len();
                results.push(SqlStatementResult {
                    statement: stmt.to_string(),
                    success: true,
                    error: None,
                    columns: Some(result.columns),
                    rows: Some(result.rows),
                    affected_rows: None,
                    engine: Some("sqlite".to_string()),
                    execution_time_ms: None,
                });
                *success_count += 1;
                ExecutionMetadata {
                    success: true,
                    row_count: Some(row_count as i64),
                    error_message: None,
                }
            }
            Err(e) => {
                let err_msg = format!("执行查询失败: {}", e);
                results.push(SqlStatementResult {
                    statement: stmt.to_string(),
                    success: false,
                    error: Some(err_msg.clone()),
                    columns: None,
                    rows: None,
                    affected_rows: None,
                    engine: Some("sqlite".to_string()),
                    execution_time_ms: None,
                });
                *fail_count += 1;
                ExecutionMetadata {
                    success: false,
                    row_count: None,
                    error_message: Some(err_msg),
                }
            }
        }
    }

    /// SQLite：执行 DROP TABLE 语句（系统表拦截 + 回收站移入 + 解析失败处理）
    fn execute_drop_table_on_sqlite(
        conn: &MutexGuardConnection<'_>,
        stmt: &str,
        results: &mut Vec<SqlStatementResult>,
        success_count: &mut usize,
        fail_count: &mut usize,
    ) -> ExecutionMetadata {
        match Self::parse_drop_table_table_name(stmt) {
            Some(table_name) => {
                if SqlIdentifier::is_system_table(&table_name) {
                    let err_msg = format!("系统表 '{}' 不允许删除或修改", table_name);
                    results.push(SqlStatementResult {
                        statement: stmt.to_string(),
                        success: false,
                        error: Some(err_msg.clone()),
                        columns: None,
                        rows: None,
                        affected_rows: None,
                        engine: Some("sqlite".to_string()),
                        execution_time_ms: None,
                    });
                    *fail_count += 1;
                    ExecutionMetadata {
                        success: false,
                        row_count: None,
                        error_message: Some(err_msg),
                    }
                } else {
                    Self::drop_table_via_trash(
                        conn,
                        stmt,
                        &table_name,
                        results,
                        success_count,
                        fail_count,
                    )
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
                    engine: Some("sqlite".to_string()),
                    execution_time_ms: None,
                });
                *fail_count += 1;
                ExecutionMetadata {
                    success: false,
                    row_count: None,
                    error_message: Some("无法解析 DROP TABLE 语句中的表名".to_string()),
                }
            }
        }
    }

    /// SQLite：通过回收站服务删除表（非系统表）
    fn drop_table_via_trash(
        conn: &MutexGuardConnection<'_>,
        stmt: &str,
        table_name: &str,
        results: &mut Vec<SqlStatementResult>,
        success_count: &mut usize,
        fail_count: &mut usize,
    ) -> ExecutionMetadata {
        let result = crate::services::TrashService::get_table_row_count(conn, table_name)
            .and_then(|row_count| {
                crate::services::TrashService::move_to_trash_sync(conn, table_name, row_count)
            });

        match result {
            Ok(_) => {
                results.push(SqlStatementResult {
                    statement: stmt.to_string(),
                    success: true,
                    error: None,
                    columns: None,
                    rows: None,
                    affected_rows: Some(1),
                    engine: Some("sqlite".to_string()),
                    execution_time_ms: None,
                });
                *success_count += 1;
                ExecutionMetadata {
                    success: true,
                    row_count: Some(1),
                    error_message: None,
                }
            }
            Err(e) => {
                let err_msg = format!("删除表失败: {}", e);
                results.push(SqlStatementResult {
                    statement: stmt.to_string(),
                    success: false,
                    error: Some(err_msg.clone()),
                    columns: None,
                    rows: None,
                    affected_rows: None,
                    engine: Some("sqlite".to_string()),
                    execution_time_ms: None,
                });
                *fail_count += 1;
                ExecutionMetadata {
                    success: false,
                    row_count: None,
                    error_message: Some(err_msg),
                }
            }
        }
    }

    /// SQLite：执行非查询语句（INSERT/UPDATE/DELETE/CREATE/ALTER 等）
    fn execute_other_on_sqlite(
        conn: &MutexGuardConnection<'_>,
        stmt: &str,
        results: &mut Vec<SqlStatementResult>,
        success_count: &mut usize,
        fail_count: &mut usize,
    ) -> ExecutionMetadata {
        match conn.execute(stmt, &[]) {
            Ok(rows) => {
                results.push(SqlStatementResult {
                    statement: stmt.to_string(),
                    success: true,
                    error: None,
                    columns: None,
                    rows: None,
                    affected_rows: Some(rows),
                    engine: Some("sqlite".to_string()),
                    execution_time_ms: None,
                });
                *success_count += 1;
                ExecutionMetadata {
                    success: true,
                    row_count: Some(rows as i64),
                    error_message: None,
                }
            }
            Err(e) => {
                let err_msg = format!("执行SQL失败: {}", e);
                results.push(SqlStatementResult {
                    statement: stmt.to_string(),
                    success: false,
                    error: Some(err_msg.clone()),
                    columns: None,
                    rows: None,
                    affected_rows: None,
                    engine: Some("sqlite".to_string()),
                    execution_time_ms: None,
                });
                *fail_count += 1;
                ExecutionMetadata {
                    success: false,
                    row_count: None,
                    error_message: Some(err_msg),
                }
            }
        }
    }

    /// 在任意实现了 `DatabaseConnection` trait 的连接上执行 SQL（路由到具体子函数）
    fn execute_on_conn(
        conn: &dyn DatabaseConnection,
        stmt: &str,
        results: &mut Vec<SqlStatementResult>,
        success_count: &mut usize,
        fail_count: &mut usize,
    ) -> ExecutionMetadata {
        let upper_stmt = stmt.to_uppercase();

        // 严格区分查询语句与写操作：SELECT/WITH/EXPLAIN/PRAGMA 强制返回数据集
        let is_query_stmt = upper_stmt.starts_with("SELECT")
            || upper_stmt.starts_with("WITH")
            || upper_stmt.starts_with("EXPLAIN")
            || upper_stmt.starts_with("PRAGMA");

        if is_query_stmt {
            Self::execute_query_on_conn(conn, stmt, results, success_count, fail_count)
        } else {
            Self::execute_other_on_conn(conn, stmt, results, success_count, fail_count)
        }
    }

    /// 通用连接：执行查询语句（SELECT/WITH/EXPLAIN/PRAGMA）
    fn execute_query_on_conn(
        conn: &dyn DatabaseConnection,
        stmt: &str,
        results: &mut Vec<SqlStatementResult>,
        success_count: &mut usize,
        fail_count: &mut usize,
    ) -> ExecutionMetadata {
        match conn.query(stmt, &[]) {
            Ok(result) => {
                let row_count = result.rows.len();
                results.push(SqlStatementResult {
                    statement: stmt.to_string(),
                    success: true,
                    error: None,
                    columns: Some(result.columns),
                    rows: Some(result.rows),
                    affected_rows: None,
                    engine: Some("sqlite".to_string()),
                    execution_time_ms: None,
                });
                *success_count += 1;
                ExecutionMetadata {
                    success: true,
                    row_count: Some(row_count as i64),
                    error_message: None,
                }
            }
            Err(e) => {
                let err_msg = format!("执行查询失败: {}", e);
                results.push(SqlStatementResult {
                    statement: stmt.to_string(),
                    success: false,
                    error: Some(err_msg.clone()),
                    columns: None,
                    rows: None,
                    affected_rows: None,
                    engine: Some("sqlite".to_string()),
                    execution_time_ms: None,
                });
                *fail_count += 1;
                ExecutionMetadata {
                    success: false,
                    row_count: None,
                    error_message: Some(err_msg),
                }
            }
        }
    }

    /// 通用连接：执行非查询语句（INSERT/UPDATE/DELETE/CREATE/ALTER 等）
    fn execute_other_on_conn(
        conn: &dyn DatabaseConnection,
        stmt: &str,
        results: &mut Vec<SqlStatementResult>,
        success_count: &mut usize,
        fail_count: &mut usize,
    ) -> ExecutionMetadata {
        match conn.execute(stmt, &[]) {
            Ok(rows) => {
                results.push(SqlStatementResult {
                    statement: stmt.to_string(),
                    success: true,
                    error: None,
                    columns: None,
                    rows: None,
                    affected_rows: Some(rows),
                    engine: Some("sqlite".to_string()),
                    execution_time_ms: None,
                });
                *success_count += 1;
                ExecutionMetadata {
                    success: true,
                    row_count: Some(rows as i64),
                    error_message: None,
                }
            }
            Err(e) => {
                let err_msg = format!("执行SQL失败: {}", e);
                results.push(SqlStatementResult {
                    statement: stmt.to_string(),
                    success: false,
                    error: Some(err_msg.clone()),
                    columns: None,
                    rows: None,
                    affected_rows: None,
                    engine: Some("sqlite".to_string()),
                    execution_time_ms: None,
                });
                *fail_count += 1;
                ExecutionMetadata {
                    success: false,
                    row_count: None,
                    error_message: Some(err_msg),
                }
            }
        }
    }

    /// 【核心】执行一批 SQL 语句的业务逻辑编排
    ///
    /// 负责：SQL 拆分、表名路由、DuckDB/SQLite 切换、临时连接回退、
    /// panic 安全保护、查询历史与审计日志写入。
    ///
    /// **M7.2+ 新增**：当传入 `query_cache`（Some）时，对每条只读语句：
    /// - 先查缓存，命中则直接返回缓存结果
    /// - 未命中则正常执行，执行成功后写回缓存
    ///
    /// 对每条写语句：触发 `query_cache` 的全量失效，确保数据一致性。
    ///
    /// 连接获取由调用方（commands 层）负责。
    pub fn execute_sql_batch(
        sqlite_conn: &MutexGuardConnection<'_>,
        duckdb_conn_opt: Option<Arc<Mutex<Box<dyn DatabaseConnection>>>>,
        db_manager: &DatabaseManager,
        sql: &str,
        query_cache: Option<&crate::services::query_cache_service::QueryCacheService>,
    ) -> Result<BatchExecuteResult, String> {
        let overall_start = Instant::now();

        // 读取 queryTimeout 设置并设置 SQLite busy_timeout（动态调整）
        // 注意：SQLite 的 busy_timeout 控制锁定等待时间，不是查询执行时间
        // 这里读取设置值用于日志记录和后续可能的超时检测
        let query_timeout_secs: i64 = crate::services::SettingsService::get_setting(sqlite_conn, "database", "queryTimeout")
            .ok()
            .flatten()
            .and_then(|s| s.value.parse::<i64>().ok())
            .filter(|&v| (1..=3600).contains(&v))
            .unwrap_or(60);
        // 设置 SQLite busy_timeout PRAGMA
        // 当前已在 sqlite.rs 中设置默认值 30000ms
        // 注意：PRAGMA 不支持参数化，但 query_timeout_secs 已经经过 clamp 验证为有效整数
        let busy_timeout_ms = query_timeout_secs * 1000;
        if busy_timeout_ms != 30000 {
            // 安全：busy_timeout_ms 是经过 clamp 的整数，无 SQL 注入风险
            let pragma_sql = format!("PRAGMA busy_timeout = {};", busy_timeout_ms);
            if let Err(e) = sqlite_conn.query(&pragma_sql, &[]) {
                log::warn!("设置 busy_timeout 失败: {}", e);
            }
        }

        let table_names = crate::database::router::QueryRouter::get_table_names(sqlite_conn);
        let table_names_ref: Vec<&str> = table_names.iter().map(|s| s.as_str()).collect();

        let statements = Self::split_sql_statements(sql);
        if statements.is_empty() {
            return Err("没有有效的SQL语句".to_string());
        }

        // 前置扫描：整批是否含写操作？若有，需在执行前做全量失效
        // （执行时仍会在每条写语句处单独再次失效，保证确定性）
        if let Some(qc) = query_cache {
            if Self::contains_write_operation(&statements) {
                qc.invalidate_all();
                log::debug!(
                    "[查询缓存] execute_sql_batch 检测到写操作，先执行全量失效"
                );
            }
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

            // ------------- 缓存查寻（仅只读 + 传入了 query_cache） -------------
            if let Some(duration) = Self::try_cache_lookup_for_stmt(
                query_cache,
                &duckdb_conn_opt,
                trimmed_stmt,
                &stmt_start,
                &mut results,
                &mut success_count,
            ) {
                execution_metadatas.push((
                    trimmed_stmt.to_string(),
                    duration,
                    ExecutionMetadata {
                        success: true,
                        row_count: None, // 缓存命中不走历史记录，保持兼容
                        error_message: None,
                    },
                ));
                continue;
            }

            // ------------- 正常执行路径（DuckDB 或 SQLite） -------------
            // 构造执行上下文：将共享状态集中传递，避免 too_many_arguments
            let mut ctx = SqlExecContext {
                sqlite_conn,
                duckdb_conn_opt: &duckdb_conn_opt,
                db_manager,
                table_names: &table_names,
                query_cache,
                results: &mut results,
                success_count: &mut success_count,
                fail_count: &mut fail_count,
            };
            let metadata = Self::execute_via_duckdb_or_sqlite(
                &mut ctx,
                trimmed_stmt,
                &table_names_ref,
                &stmt_start,
            )?;
            // ctx 在此退出作用域，释放对 results / success_count / fail_count 的可变借用

            let stmt_duration = stmt_start.elapsed().as_millis() as i64;
            if let Some(last_result) = results.last_mut() {
                last_result.execution_time_ms = Some(stmt_duration);
            }
            execution_metadatas.push((trimmed_stmt.to_string(), stmt_duration, metadata));
        }

        // 记录查询历史与审计日志（此时 DuckDB 锁已释放，避免死锁）
        Self::record_batch_execution_logs(sqlite_conn, &execution_metadatas);

        log::debug!("整体执行耗时: {:?}", overall_start.elapsed());

        Ok(BatchExecuteResult {
            results,
            success_count,
            fail_count,
        })
    }

    /// 尝试从查询缓存中获取只读语句的结果。
    ///
    /// 命中缓存时：将缓存结果推入 `results`，递增 `success_count`，
    /// 并返回 `Some(duration)` 供调用方记录 metadata。
    /// 未命中或不可缓存时：返回 `None`，调用方走正常执行路径。
    fn try_cache_lookup_for_stmt(
        query_cache: Option<&crate::services::query_cache_service::QueryCacheService>,
        duckdb_conn_opt: &Option<Arc<Mutex<Box<dyn DatabaseConnection>>>>,
        trimmed_stmt: &str,
        stmt_start: &Instant,
        results: &mut Vec<SqlStatementResult>,
        success_count: &mut usize,
    ) -> Option<i64> {
        let qc = query_cache?;
        let trimmed = trimmed_stmt.trim_start().to_uppercase();
        let cacheable = trimmed.starts_with("SELECT")
            || trimmed.starts_with("PRAGMA")
            || trimmed.starts_with("WITH")
            || trimmed.starts_with("EXPLAIN");
        if !cacheable {
            return None;
        }
        let cache_key = crate::services::query_cache_service::make_cache_key(trimmed_stmt, &[]);
        let cached = qc.get(&cache_key)?;

        let cache_engine = if duckdb_conn_opt.is_some() { "duckdb" } else { "sqlite" };
        let execution_time_ms = stmt_start.elapsed().as_millis() as i64;
        results.push(SqlStatementResult {
            statement: trimmed_stmt.to_string(),
            success: true,
            error: None,
            columns: Some(cached.columns),
            rows: Some(cached.rows),
            affected_rows: None,
            engine: Some(cache_engine.to_string()),
            execution_time_ms: Some(execution_time_ms),
        });
        *success_count += 1;
        // 返回 duration（保留原始代码中 stmt_start.elapsed() 二次调用的行为）
        Some(stmt_start.elapsed().as_millis() as i64)
    }

    /// 根据语句类型选择 DuckDB 或 SQLite 执行路径。
    ///
    /// DuckDB 不可用、路由失败、查询失败或 panic 时均回退到 SQLite。
    fn execute_via_duckdb_or_sqlite(
        ctx: &mut SqlExecContext<'_>,
        trimmed_stmt: &str,
        table_names_ref: &[&str],
        stmt_start: &Instant,
    ) -> Result<ExecutionMetadata, String> {
        let use_duckdb = crate::database::router::QueryRouter::should_use_duckdb(trimmed_stmt);

        if !use_duckdb {
            let query_cache = ctx.query_cache;
            return Ok(Self::execute_with_connection_strategy(
                ctx.sqlite_conn,
                ctx.db_manager,
                trimmed_stmt,
                &mut *ctx.results,
                &mut *ctx.success_count,
                &mut *ctx.fail_count,
                query_cache,
            ));
        }

        // use_duckdb == true：需要 DuckDB 连接
        let duckdb_conn_mutex = match ctx.duckdb_conn_opt {
            Some(m) => m,
            None => {
                log::warn!("DuckDB not initialized, using SQLite");
                let query_cache = ctx.query_cache;
                return Ok(Self::execute_with_connection_strategy(
                    ctx.sqlite_conn,
                    ctx.db_manager,
                    trimmed_stmt,
                    &mut *ctx.results,
                    &mut *ctx.success_count,
                    &mut *ctx.fail_count,
                    query_cache,
                ));
            }
        };

        let duckdb_conn_guard = duckdb_conn_mutex
            .lock()
            .map_err(|e| format!("获取 DuckDB 连接锁失败: {}", e))?;

        match crate::database::router::QueryRouter::route_table_names(
            trimmed_stmt,
            table_names_ref,
        ) {
            Ok(routed_sql) => Ok(Self::execute_routed_duckdb_query(
                ctx,
                &duckdb_conn_guard,
                trimmed_stmt,
                &routed_sql,
                stmt_start,
            )),
            Err(e) => {
                log::warn!("SQL routing failed, falling back to SQLite: {}", e);
                let query_cache = ctx.query_cache;
                Ok(Self::execute_with_connection_strategy(
                    ctx.sqlite_conn,
                    ctx.db_manager,
                    trimmed_stmt,
                    &mut *ctx.results,
                    &mut *ctx.success_count,
                    &mut *ctx.fail_count,
                    query_cache,
                ))
            }
        }
    }

    /// 执行已路由的 DuckDB 查询，处理 panic 安全保护与成功/失败/panic 三种分支。
    fn execute_routed_duckdb_query(
        ctx: &mut SqlExecContext<'_>,
        duckdb_conn_guard: &std::sync::MutexGuard<'_, Box<dyn DatabaseConnection>>,
        trimmed_stmt: &str,
        routed_sql: &str,
        stmt_start: &Instant,
    ) -> ExecutionMetadata {
        let result = catch_unwind(std::panic::AssertUnwindSafe(|| {
            duckdb_conn_guard.query(routed_sql, &[])
        }));

        match result {
            Ok(Ok(query_result)) => {
                let query_cache = ctx.query_cache;
                Self::handle_duckdb_query_success(
                    query_result,
                    trimmed_stmt,
                    stmt_start,
                    &mut *ctx.results,
                    &mut *ctx.success_count,
                    query_cache,
                )
            }
            Ok(Err(e)) => Self::handle_duckdb_query_error(
                ctx,
                duckdb_conn_guard,
                trimmed_stmt,
                routed_sql,
                stmt_start,
                e,
            ),
            Err(e) => Self::handle_duckdb_panic(ctx, trimmed_stmt, e),
        }
    }

    /// DuckDB 查询成功：推入结果、写回缓存、返回成功 metadata。
    fn handle_duckdb_query_success(
        query_result: crate::database::traits::QueryResult,
        trimmed_stmt: &str,
        stmt_start: &Instant,
        results: &mut Vec<SqlStatementResult>,
        success_count: &mut usize,
        query_cache: Option<&crate::services::query_cache_service::QueryCacheService>,
    ) -> ExecutionMetadata {
        let row_count = query_result.rows.len();
        let execution_time_ms = stmt_start.elapsed().as_millis() as i64;
        // 先缓存再移动
        let cached_result = query_result.clone();
        results.push(SqlStatementResult {
            statement: trimmed_stmt.to_string(),
            success: true,
            error: None,
            columns: Some(query_result.columns),
            rows: Some(query_result.rows),
            affected_rows: None,
            engine: Some("duckdb".to_string()),
            execution_time_ms: Some(execution_time_ms),
        });
        *success_count += 1;

        Self::cache_duckdb_result_if_cacheable(query_cache, trimmed_stmt, cached_result);

        ExecutionMetadata {
            success: true,
            row_count: Some(row_count as i64),
            error_message: None,
        }
    }

    /// DuckDB 查询失败：若是表/VIEW 不存在错误，先刷新 VIEW 再重试；
    /// 仍然失败则记录审计日志并回退到 SQLite。
    fn handle_duckdb_query_error(
        ctx: &mut SqlExecContext<'_>,
        duckdb_conn_guard: &std::sync::MutexGuard<'_, Box<dyn DatabaseConnection>>,
        trimmed_stmt: &str,
        routed_sql: &str,
        stmt_start: &Instant,
        error: crate::database::traits::DatabaseError,
    ) -> ExecutionMetadata {
        let err_msg = error.to_string();
        let err_lower = err_msg.to_lowercase();
        let is_view_error = err_lower.contains("table not found")
            || err_lower.contains("view not found")
            || err_lower.contains("does not exist");

        let retry_result: Option<ExecutionMetadata> = if is_view_error {
            Self::try_duckdb_view_refresh_retry(
                ctx,
                duckdb_conn_guard,
                trimmed_stmt,
                routed_sql,
                stmt_start,
                &err_msg,
            )
        } else {
            None
        };

        match retry_result {
            Some(meta) => meta,
            None => {
                log::warn!(
                    "DuckDB execution failed, falling back to SQLite: {}",
                    err_msg
                );
                Self::record_audit_log_duckdb_failure(ctx.sqlite_conn, trimmed_stmt, &err_msg);
                let query_cache = ctx.query_cache;
                Self::execute_with_connection_strategy(
                    ctx.sqlite_conn,
                    ctx.db_manager,
                    trimmed_stmt,
                    &mut *ctx.results,
                    &mut *ctx.success_count,
                    &mut *ctx.fail_count,
                    query_cache,
                )
            }
        }
    }

    /// 刷新缺失的 VIEW 后重试 DuckDB 查询。
    /// 成功则推入结果 + 写回缓存 + 返回 metadata；失败则返回 None 供调用方回退。
    ///
    /// P2-4 优化：不再全量刷新所有 VIEW，而是先查询 DuckDB 中已存在的 VIEW 列表，
    /// 仅为缺失的表创建 VIEW。避免不必要的 `CREATE OR REPLACE VIEW` 开销。
    fn try_duckdb_view_refresh_retry(
        ctx: &mut SqlExecContext<'_>,
        duckdb_conn_guard: &std::sync::MutexGuard<'_, Box<dyn DatabaseConnection>>,
        trimmed_stmt: &str,
        routed_sql: &str,
        stmt_start: &Instant,
        err_msg: &str,
    ) -> Option<ExecutionMetadata> {
        log::warn!(
            "DuckDB 检测到表/VIEW 不存在错误，尝试增量创建缺失 VIEW 后重试。错误: {}",
            err_msg
        );

        match Self::refresh_missing_views(
            &***duckdb_conn_guard,
            ctx.sqlite_conn,
            ctx.table_names,
        ) {
            Ok(refresh_count) => {
                log::info!(
                    "VIEW 增量刷新完成，新建 {} 个 VIEW，正在重试查询...",
                    refresh_count
                );

                let retry_query_result = catch_unwind(std::panic::AssertUnwindSafe(|| {
                    duckdb_conn_guard.query(routed_sql, &[])
                }));

                match retry_query_result {
                    Ok(Ok(query_result)) => {
                        let row_count = query_result.rows.len();
                        let execution_time_ms = stmt_start.elapsed().as_millis() as i64;
                        let cached_result = query_result.clone();
                        ctx.results.push(SqlStatementResult {
                            statement: trimmed_stmt.to_string(),
                            success: true,
                            error: None,
                            columns: Some(query_result.columns),
                            rows: Some(query_result.rows),
                            affected_rows: None,
                            engine: Some("duckdb".to_string()),
                            execution_time_ms: Some(execution_time_ms),
                        });
                        *ctx.success_count += 1;

                        let query_cache = ctx.query_cache;
                        Self::cache_duckdb_result_if_cacheable(
                            query_cache,
                            trimmed_stmt,
                            cached_result,
                        );

                        Some(ExecutionMetadata {
                            success: true,
                            row_count: Some(row_count as i64),
                            error_message: None,
                        })
                    }
                    Ok(Err(retry_e)) => {
                        log::warn!(
                            "DuckDB VIEW 增量刷新后重试仍然失败，回退到 SQLite: {}",
                            retry_e
                        );
                        None
                    }
                    Err(retry_panic) => {
                        log::error!(
                            "DuckDB VIEW 增量刷新后重试发生 panic，回退到 SQLite: {:?}",
                            retry_panic
                        );
                        None
                    }
                }
            }
            Err(refresh_e) => {
                log::warn!(
                    "VIEW 增量刷新失败，直接回退到 SQLite: {}",
                    refresh_e
                );
                None
            }
        }
    }

    /// P2-4: 增量创建缺失的 VIEW
    ///
    /// 查询 DuckDB 中已存在的 VIEW 列表，仅为尚未创建 VIEW 的表创建 VIEW。
    /// 相比 `refresh_all_views_with_type_casts`，避免了不必要的 VIEW 重建开销。
    ///
    /// # Arguments
    /// * `duckdb_conn` - DuckDB 数据库连接
    /// * `sqlite_conn` - SQLite 数据库连接（用于获取列类型信息）
    /// * `table_names` - 需要创建 VIEW 的表名列表
    ///
    /// # Returns
    /// * `Ok(usize)` - 成功创建的 VIEW 数量
    /// * `Err(String)` - 查询已存在 VIEW 列表失败
    fn refresh_missing_views(
        duckdb_conn: &dyn DatabaseConnection,
        sqlite_conn: &MutexGuardConnection,
        table_names: &[String],
    ) -> Result<usize, String> {
        // 查询 DuckDB 中已存在的 VIEW 名称
        let existing_views = Self::list_existing_duckdb_views(duckdb_conn)?;

        let mut success_count = 0;
        for table_name in table_names {
            // VIEW 已存在，跳过
            if existing_views.contains(table_name) {
                continue;
            }
            // 仅为缺失的表创建 VIEW
            if crate::services::ViewService::refresh_single_view_with_type_casts(
                duckdb_conn,
                sqlite_conn,
                table_name,
            )
            .is_ok()
            {
                success_count += 1;
            }
        }

        log::info!(
            "VIEW 增量刷新完成，新建 {}/{} 个 VIEW（已存在 {} 个）",
            success_count,
            table_names.len(),
            existing_views.len()
        );
        Ok(success_count)
    }

    /// 查询 DuckDB 中已存在的 VIEW 名称集合
    ///
    /// 通过 `information_schema.views` 查询 main schema 下的所有 VIEW 名称。
    /// 用于 P2-4 增量 VIEW 创建：只创建缺失的 VIEW，避免全量刷新。
    fn list_existing_duckdb_views(
        duckdb_conn: &dyn DatabaseConnection,
    ) -> Result<std::collections::HashSet<String>, String> {
        let result = duckdb_conn
            .query(
                "SELECT table_name FROM information_schema.views WHERE table_schema = 'main'",
                &[],
            )
            .map_err(|e| format!("查询已存在 VIEW 列表失败: {}", e))?;

        let views: std::collections::HashSet<String> = result
            .rows
            .into_iter()
            .filter(|row| !row.is_empty())
            .map(|row| row[0].clone())
            .collect();

        Ok(views)
    }

    /// DuckDB 发生 panic：记录审计日志后回退到 SQLite 执行。
    fn handle_duckdb_panic(
        ctx: &mut SqlExecContext<'_>,
        trimmed_stmt: &str,
        panic_payload: Box<dyn std::any::Any + Send>,
    ) -> ExecutionMetadata {
        log::error!(
            "DuckDB panicked, falling back to SQLite: {:?}",
            panic_payload
        );
        // 将 DuckDB panic 信息写入审计日志（在回退之前）
        let panic_msg = if let Some(s) = panic_payload.downcast_ref::<String>() {
            s.clone()
        } else if let Some(s) = panic_payload.downcast_ref::<&str>() {
            (*s).to_string()
        } else {
            "panic payload could not be serialized".to_string()
        };
        let panic_desc: String = trimmed_stmt.chars().take(100).collect();
        let panic_details = serde_json::to_string(&serde_json::json!({
            "sql": trimmed_stmt,
            "panic": panic_msg,
        }))
        .unwrap_or_else(|_| format!("{{\"sql\":\"{}\"}}", trimmed_stmt.replace('"', "\\\"")));
        let panic_audit_req = crate::models::audit_log::RecordAuditLogRequest {
            module: "sql".to_string(),
            action: "query".to_string(),
            description: format!("DuckDB panicked: {}", panic_desc),
            status: "failed".to_string(),
            duration_ms: None,
            details: Some(panic_details),
        };
        let _ = crate::services::AuditLogService::record_audit_log(
            ctx.sqlite_conn,
            panic_audit_req,
        );

        let query_cache = ctx.query_cache;
        Self::execute_with_connection_strategy(
            ctx.sqlite_conn,
            ctx.db_manager,
            trimmed_stmt,
            &mut *ctx.results,
            &mut *ctx.success_count,
            &mut *ctx.fail_count,
            query_cache,
        )
    }

    /// 仅缓存成功的只读 DuckDB 查询结果；写语句则触发全量失效。
    fn cache_duckdb_result_if_cacheable(
        query_cache: Option<&crate::services::query_cache_service::QueryCacheService>,
        trimmed_stmt: &str,
        cached_result: crate::database::traits::QueryResult,
    ) {
        let qc = match query_cache {
            Some(qc) => qc,
            None => return,
        };
        let trimmed = trimmed_stmt.trim_start().to_uppercase();
        let cacheable = trimmed.starts_with("SELECT")
            || trimmed.starts_with("PRAGMA")
            || trimmed.starts_with("WITH")
            || trimmed.starts_with("EXPLAIN");
        if cacheable {
            let cache_key =
                crate::services::query_cache_service::make_cache_key(trimmed_stmt, &[]);
            qc.set(cache_key, cached_result);
        } else {
            // DuckDB 侧出现写语句（正常极少），做防御性失效
            qc.invalidate_all();
        }
    }

    /// 将 DuckDB 执行失败信息写入审计日志（用于回退 SQLite 前的记录）。
    fn record_audit_log_duckdb_failure(
        sqlite_conn: &MutexGuardConnection<'_>,
        trimmed_stmt: &str,
        err_msg: &str,
    ) {
        let err_desc: String = trimmed_stmt.chars().take(100).collect();
        let err_details = serde_json::to_string(&serde_json::json!({
            "sql": trimmed_stmt,
            "error": err_msg,
        }))
        .unwrap_or_else(|_| format!("{{\"sql\":\"{}\"}}", trimmed_stmt.replace('"', "\\\"")));
        let audit_req = crate::models::audit_log::RecordAuditLogRequest {
            module: "sql".to_string(),
            action: "query".to_string(),
            description: format!("DuckDB execution failed: {}", err_desc),
            status: "failed".to_string(),
            duration_ms: None,
            details: Some(err_details),
        };
        let _ = crate::services::AuditLogService::record_audit_log(sqlite_conn, audit_req);
    }

    /// 批量记录查询历史与审计日志。
    fn record_batch_execution_logs(
        sqlite_conn: &MutexGuardConnection<'_>,
        execution_metadatas: &[(String, i64, ExecutionMetadata)],
    ) {
        // 记录查询历史（此时 DuckDB 锁已释放，避免死锁）
        for (sql_stmt, duration, meta) in execution_metadatas {
            Self::record_query_to_history(
                sqlite_conn,
                sql_stmt,
                *duration,
                meta.row_count,
                meta.success,
                meta.error_message.clone(),
            );
        }

        // 记录审计日志
        for (sql_stmt, duration, meta) in execution_metadatas {
            let description: String = sql_stmt.chars().take(100).collect();
            let details = serde_json::to_string(&serde_json::json!({
                "sql": sql_stmt,
            }))
            .unwrap_or_else(|_| format!("{{\"sql\":\"{}\"}}", sql_stmt.replace('"', "\\\"")));
            let audit_request = crate::models::audit_log::RecordAuditLogRequest {
                module: "sql".to_string(),
                action: "query".to_string(),
                description,
                status: if meta.success {
                    "success".to_string()
                } else {
                    "failed".to_string()
                },
                duration_ms: Some(*duration),
                details: Some(details),
            };
            let _ = crate::services::AuditLogService::record_audit_log(
                sqlite_conn,
                audit_request,
            );
        }
    }

    /// SQLite 端的连接策略：优先临时连接（长查询），失败回退到主连接
    ///
    /// 当传入 `query_cache` 时：
    /// - 只读查询成功后将结果写回缓存
    /// - 写语句成功后触发全量失效
    fn execute_with_connection_strategy(
        sqlite_conn: &MutexGuardConnection<'_>,
        db_manager: &DatabaseManager,
        trimmed_stmt: &str,
        results: &mut Vec<SqlStatementResult>,
        success_count: &mut usize,
        fail_count: &mut usize,
        query_cache: Option<&crate::services::query_cache_service::QueryCacheService>,
    ) -> ExecutionMetadata {
        let metadata = if Self::should_use_temp_connection(trimmed_stmt) {
            match db_manager.open_temporary_connection() {
                Ok(temp_conn) => Self::execute_on_conn(
                    &*temp_conn,
                    trimmed_stmt,
                    results,
                    success_count,
                    fail_count,
                ),
                Err(e) => {
                    log::warn!("临时连接获取失败，回退到主连接: {}", e);
                    Self::execute_on_sqlite(
                        sqlite_conn,
                        trimmed_stmt,
                        results,
                        success_count,
                        fail_count,
                    )
                }
            }
        } else {
            Self::execute_on_sqlite(
                sqlite_conn,
                trimmed_stmt,
                results,
                success_count,
                fail_count,
            )
        };

        // 根据刚刚执行的最后一条结果做缓存写回 / 写操作失效
        if let Some(qc) = query_cache {
            Self::apply_cache_post_exec(qc, results, trimmed_stmt);
        }

        metadata
    }

    /// P2-4 重构：从 `execute_with_connection_strategy` 提取的缓存写回 / 失效逻辑
    ///
    /// 原为 5 层嵌套（`if let Some(qc)` → `if let Some(last)` → `if last.statement == ...`
    /// → `if last.success && cacheable` → `if let (Some(columns), Some(rows))`），通过
    /// early return 降为最大 2 层，行为完全保持一致：
    /// - 取最后一条结果；若与 `trimmed_stmt` 不匹配则直接返回
    /// - 只读语句（SELECT/PRAGMA/WITH/EXPLAIN）+ 成功 + 含 columns/rows → 写回缓存
    /// - 只读语句但失败 → 不操作（保持原 else 分支空逻辑）
    /// - 写语句（非只读）→ 触发全量失效
    fn apply_cache_post_exec(
        qc: &crate::services::query_cache_service::QueryCacheService,
        results: &[SqlStatementResult],
        trimmed_stmt: &str,
    ) {
        let last = match results.last() {
            Some(last) => last,
            None => return,
        };
        if last.statement != trimmed_stmt {
            return;
        }

        let trimmed = trimmed_stmt.trim_start().to_uppercase();
        let cacheable = trimmed.starts_with("SELECT")
            || trimmed.starts_with("PRAGMA")
            || trimmed.starts_with("WITH")
            || trimmed.starts_with("EXPLAIN");

        if !cacheable {
            // 写语句 → 全量失效
            qc.invalidate_all();
            return;
        }
        // 只读语句 + 成功 + 含结果 → 写回缓存
        if !last.success {
            return;
        }
        if let (Some(columns), Some(rows)) = (&last.columns, &last.rows) {
            let cache_key =
                crate::services::query_cache_service::make_cache_key(trimmed_stmt, &[]);
            qc.set(
                cache_key,
                crate::database::traits::QueryResult {
                    columns: columns.clone(),
                    rows: rows.clone(),
                },
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ============================================================
    // split_sql_statements 测试
    // ============================================================

    #[test]
    fn test_split_sql_single_statement_success() {
        let result = SqlExecutionService::split_sql_statements("SELECT * FROM users;");
        assert_eq!(result, vec!["SELECT * FROM users"]);
    }

    #[test]
    fn test_split_sql_multiple_statements_success() {
        let result = SqlExecutionService::split_sql_statements(
            "SELECT * FROM users; SELECT * FROM orders; DELETE FROM logs WHERE id < 10;",
        );
        assert_eq!(
            result,
            vec![
                "SELECT * FROM users",
                "SELECT * FROM orders",
                "DELETE FROM logs WHERE id < 10"
            ]
        );
    }

    #[test]
    fn test_split_sql_line_comment_ignored() {
        let result = SqlExecutionService::split_sql_statements(
            "-- this is a comment; should not split\nSELECT * FROM users;",
        );
        assert_eq!(result, vec!["SELECT * FROM users"]);
    }

    #[test]
    fn test_split_sql_block_comment_ignored() {
        let result = SqlExecutionService::split_sql_statements(
            "/* this is a ; block comment */ SELECT * FROM users;",
        );
        assert_eq!(result, vec!["SELECT * FROM users"]);
    }

    #[test]
    fn test_split_sql_string_with_semicolon_not_split() {
        let result = SqlExecutionService::split_sql_statements(
            "SELECT * FROM users WHERE name = 'hello; world';",
        );
        assert_eq!(
            result,
            vec!["SELECT * FROM users WHERE name = 'hello; world'"]
        );
    }

    #[test]
    fn test_split_sql_no_trailing_semicolon_captured() {
        let result = SqlExecutionService::split_sql_statements("SELECT * FROM users");
        assert_eq!(result, vec!["SELECT * FROM users"]);
    }

    #[test]
    fn test_split_sql_empty_string_returns_empty() {
        let result = SqlExecutionService::split_sql_statements("");
        assert_eq!(result, Vec::<String>::new());
    }

    #[test]
    fn test_split_sql_only_semicolons_returns_empty() {
        let result = SqlExecutionService::split_sql_statements(";;;");
        assert_eq!(result, Vec::<String>::new());
    }

    // ============================================================
    // parse_drop_table_table_name 测试
    // ============================================================

    #[test]
    fn test_parse_drop_table_simple_name_success() {
        // 注意：当前实现对整个语句 uppercase，导致表名也被大写。这是已知行为。
        assert_eq!(
            SqlExecutionService::parse_drop_table_table_name("DROP TABLE users"),
            Some("USERS".to_string())
        );
    }

    #[test]
    fn test_parse_drop_table_if_exists_success() {
        assert_eq!(
            SqlExecutionService::parse_drop_table_table_name("DROP TABLE IF EXISTS users"),
            Some("USERS".to_string())
        );
    }

    #[test]
    fn test_parse_drop_table_quoted_name_removes_quotes() {
        assert_eq!(
            SqlExecutionService::parse_drop_table_table_name("DROP TABLE \"users\""),
            Some("USERS".to_string())
        );
    }

    #[test]
    fn test_parse_drop_table_no_table_name_returns_none() {
        assert_eq!(
            SqlExecutionService::parse_drop_table_table_name("DROP TABLE"),
            None
        );
    }

    #[test]
    fn test_parse_drop_table_non_drop_statement_returns_none() {
        assert_eq!(
            SqlExecutionService::parse_drop_table_table_name("SELECT * FROM users"),
            None
        );
    }

    #[test]
    fn test_parse_drop_table_whitespace_and_case_insensitive() {
        assert_eq!(
            SqlExecutionService::parse_drop_table_table_name("  drop table if exists   my_table  "),
            Some("MY_TABLE".to_string())
        );
    }

    // ============================================================
    // should_use_temp_connection 测试
    // ============================================================

    #[test]
    fn test_should_use_temp_connection_select_returns_true() {
        assert!(SqlExecutionService::should_use_temp_connection(
            "SELECT * FROM users"
        ));
    }

    #[test]
    fn test_should_use_temp_connection_with_returns_true() {
        assert!(SqlExecutionService::should_use_temp_connection(
            "WITH cte AS (SELECT 1) SELECT * FROM cte"
        ));
    }

    #[test]
    fn test_should_use_temp_connection_explain_returns_true() {
        assert!(SqlExecutionService::should_use_temp_connection(
            "EXPLAIN SELECT * FROM users"
        ));
    }

    #[test]
    fn test_should_use_temp_connection_pragma_returns_true() {
        assert!(SqlExecutionService::should_use_temp_connection(
            "PRAGMA table_info(users)"
        ));
    }

    #[test]
    fn test_should_use_temp_connection_insert_delete_create_returns_false() {
        assert!(!SqlExecutionService::should_use_temp_connection(
            "INSERT INTO users VALUES (1, 'a')"
        ));
        assert!(!SqlExecutionService::should_use_temp_connection(
            "DELETE FROM users WHERE id = 1"
        ));
        assert!(!SqlExecutionService::should_use_temp_connection(
            "CREATE TABLE test (id INT)"
        ));
    }

    // ============================================================
    // split_sql_statements 补充覆盖
    // ============================================================

    #[test]
    fn test_split_sql_statements_leading_trailing_whitespace_ignored() {
        let r = SqlExecutionService::split_sql_statements("   SELECT 1; \n SELECT 2;  ");
        assert_eq!(r, vec!["SELECT 1", "SELECT 2"]);
    }

    #[test]
    fn test_split_sql_statements_mixed_single_and_double_quotes() {
        // 单引号字符串与双引号标识符混合
        let r = SqlExecutionService::split_sql_statements(
            "INSERT INTO \"a;b\" VALUES ('x;y'); SELECT 2;",
        );
        assert_eq!(
            r,
            vec!["INSERT INTO \"a;b\" VALUES ('x;y')", "SELECT 2"]
        );
    }

    #[test]
    fn test_split_sql_statements_empty_string_and_whitespace_only() {
        assert!(SqlExecutionService::split_sql_statements("").is_empty());
        assert!(SqlExecutionService::split_sql_statements("  \n\n\t  ").is_empty());
    }

    // ============================================================
    // 注释中的分号应被忽略
    // ============================================================

    #[test]
    fn test_split_sql_statements_line_comment_semicolon_ignored() {
        let r = SqlExecutionService::split_sql_statements(
            "SELECT 1; -- comment with ; semicolons;;;\n SELECT 2;",
        );
        assert_eq!(r, vec!["SELECT 1", "SELECT 2"]);
    }

    #[test]
    fn test_split_sql_statements_block_comment_semicolon_ignored() {
        let r = SqlExecutionService::split_sql_statements(
            "SELECT 1; /* a; b; c; */ SELECT 2;",
        );
        assert_eq!(r, vec!["SELECT 1", "SELECT 2"]);
    }

    #[test]
    fn test_split_sql_statements_nested_block_comment_style_safe() {
        // 虽然 SQL 通常不支持嵌套 block comment，本函数应当按 * / 顺序解析
        let r = SqlExecutionService::split_sql_statements(
            "/* outer /* inner */ SELECT 1; SELECT 2;",
        );
        // 解析器会遇到 */ 时结束块注释，因此应当还能得到 SELECT 1 和 SELECT 2
        // 精确断言内容由实现决定，此处仅验证不 panic 且至少得到 2 条语句
        assert!(r.len() >= 2);
    }

    // ============================================================
    // parse_drop_table_table_name 补充覆盖
    // ============================================================

    #[test]
    fn test_parse_drop_table_name_trims_and_uppercases() {
        assert_eq!(
            SqlExecutionService::parse_drop_table_table_name("DROP TABLE   users  "),
            Some("USERS".to_string())
        );
    }

    #[test]
    fn test_parse_drop_table_non_drop_prefix_returns_none() {
        assert!(SqlExecutionService::parse_drop_table_table_name("SELECT * FROM users").is_none());
        assert!(SqlExecutionService::parse_drop_table_table_name("DROPTABLE users").is_none());
    }

    // ============================================================
    // should_use_temp_connection 补充覆盖
    // ============================================================

    #[test]
    fn test_should_use_temp_connection_leading_whitespace() {
        assert!(SqlExecutionService::should_use_temp_connection(
            "   SELECT * FROM users"
        ));
    }

    #[test]
    fn test_should_use_temp_connection_update_returns_false() {
        assert!(!SqlExecutionService::should_use_temp_connection(
            "UPDATE users SET name='a' WHERE id = 1"
        ));
    }

    // ============================================================
    // is_all_readonly 测试
    // ============================================================

    #[test]
    fn test_is_all_readonly_all_select() {
        let stmts = vec![
            "SELECT * FROM users".to_string(),
            "SELECT * FROM orders".to_string(),
            "WITH cte AS (SELECT 1) SELECT * FROM cte".to_string(),
        ];
        assert!(SqlExecutionService::is_all_readonly(&stmts));
    }

    #[test]
    fn test_is_all_readonly_mixed() {
        let stmts = vec![
            "SELECT * FROM users".to_string(),
            "INSERT INTO logs VALUES(1)".to_string(),
        ];
        assert!(!SqlExecutionService::is_all_readonly(&stmts));
    }

    // ============================================================
    // contains_write_operation 测试
    // ============================================================

    #[test]
    fn test_contains_write_insert_select() {
        let stmts = vec![
            "INSERT INTO t VALUES(1)".to_string(),
            "SELECT * FROM t".to_string(),
        ];
        assert!(SqlExecutionService::contains_write_operation(&stmts));
    }

    #[test]
    fn test_contains_write_only_select() {
        let stmts = vec![
            "SELECT * FROM users".to_string(),
            "PRAGMA table_info(users)".to_string(),
        ];
        assert!(!SqlExecutionService::contains_write_operation(&stmts));
    }

    // ============================================================
    // contains_write_operation：覆盖常见写语句
    // ============================================================

    #[test]
    fn test_contains_write_operation_covers_all_write_kinds() {
        let cases = [
            "INSERT INTO t VALUES(1)",
            "UPDATE t SET a = 1",
            "DELETE FROM t WHERE 1=1",
            "DROP TABLE users",
            "CREATE TABLE new_t(id INT)",
            "ALTER TABLE t ADD COLUMN c INT",
            "TRUNCATE TABLE t",
            "REPLACE INTO t VALUES(1)",
        ];
        for stmt in cases.iter() {
            let stmts = vec![stmt.to_string()];
            assert!(
                SqlExecutionService::contains_write_operation(&stmts),
                "should flag as write: {}",
                stmt
            );
        }
    }

    #[test]
    fn test_contains_write_operation_mixed_batch_with_select() {
        // 整批含一条写语句也应判定为写操作批次
        let stmts = vec![
            "SELECT 1".to_string(),
            "SELECT 2".to_string(),
            "UPDATE t SET a=1".to_string(),
        ];
        assert!(SqlExecutionService::contains_write_operation(&stmts));
        assert!(!SqlExecutionService::is_all_readonly(&stmts));
    }

    #[test]
    fn test_contains_write_operation_empty_or_readonly_batch() {
        // 空批不会出现，但作为防御性检查
        let empty: Vec<String> = Vec::new();
        assert!(!SqlExecutionService::contains_write_operation(&empty));

        // 仅只读语句
        let read_only = vec![
            "SELECT * FROM users".to_string(),
            "WITH cte AS (SELECT 1) SELECT * FROM cte".to_string(),
            "EXPLAIN SELECT * FROM users".to_string(),
            "PRAGMA table_info(users)".to_string(),
        ];
        assert!(!SqlExecutionService::contains_write_operation(&read_only));
        assert!(SqlExecutionService::is_all_readonly(&read_only));
    }

    // ============================================================
    // is_all_readonly / contains_write_operation 首字母大小写 & 空白
    // ============================================================

    #[test]
    fn test_is_all_readonly_case_and_whitespace() {
        assert!(SqlExecutionService::is_all_readonly(&[
            "   select * from users".to_string(),
            "\nSELECT 1".to_string(),
        ]));
        assert!(!SqlExecutionService::is_all_readonly(&[
            "SELECT 1".to_string(),
            "   insert into t values(1)".to_string(),
        ]));
    }
}

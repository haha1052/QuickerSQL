//! SQL 执行相关 Tauri 命令
//!
//! 本层只做参数校验 + 连接获取 + 调用 service + 返回结果包装。
//! 业务逻辑（SQL 拆分、DuckDB 路由、临时连接回退、查询历史等）
//! 下沉到 [`crate::services::SqlExecutionService`]。
//!
//! M7.2 新增：只读查询缓存（LRU + TTL，默认开启）。
//! - 单条 SELECT/PRAGMA/WITH：快路径直接查缓存
//! - 多条 SELECT：逐条查缓存，**全命中**才返回（提前短路，节省时间）
//! - 多语句部分命中：交由 `execute_sql_batch` 内部分句处理
//! - 写操作（INSERT/UPDATE/DELETE/DROP 等）：由 `execute_sql_batch` 内部触发全量失效
//! - 新增命令：`get_query_cache_stats`（命中率监控）、`configure_query_cache`（动态配置）

use crate::TauriAppState;
use crate::models::database::BatchExecuteResult;
use crate::models::database::SqlStatementResult;
use crate::models::sql_snippet::SqlSnippet;
use crate::services::SqlExecutionService;
use crate::services::SqlSnippetService;
use crate::services::query_cache_service::{CacheStrategy, CacheStats, is_cacheable, make_cache_key};
use tauri::State;
use super::ApiResponse;

/// SQL 执行前的输入参数校验（commands 层边界检查）
///
/// 校验规则：
/// - 拒绝空 SQL（含纯空白）
/// - 拒绝包含 NULL 字符（`\0`）的 SQL
/// - 多语句 SQL 由下游 `execute_sql_batch` 安全处理（分句、路由、写操作检测均在 service 层完成）
///
/// 返回 `Ok(())` 表示通过校验；`Err(String)` 表示参数非法。
fn validate_sql_input(sql: &str) -> Result<(), String> {
    if sql.trim().is_empty() {
        return Err("SQL 不能为空".to_string());
    }
    if sql.contains('\0') {
        return Err("SQL 包含非法 NULL 字符".to_string());
    }
    Ok(())
}

#[tauri::command]
pub async fn execute_sql(
    state: State<'_, TauriAppState>,
    sql: String,
) -> Result<BatchExecuteResult, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    validate_sql_input(&sql)?;

    // Phase 16: 获取信号量许可（SQL 查询并发控制）
    // 注意：必须在获取数据库连接（MutexGuard，非 Send）之前 await，
    // 否则持有非 Send 值跨越 await 会导致 future 不满足 Send 约束。
    let _permit = state.query_semaphore.acquire().await.map_err(|e| {
        log::error!("[execute_sql] 获取查询信号量失败: error={}", e);
        "系统繁忙，请稍后重试".to_string()
    })?;

    // 同时获取 SQLite（系统表/元数据）与 DuckDB（业务数据）连接
    let sqlite_conn = state
        .db_manager
        .get_connection()
        .map_err(|e| {
            log::error!("[execute_sql] 获取 SQLite 连接失败: error={}", e);
            "数据库连接异常，请重新打开数据库".to_string()
        })?;

    let duckdb_conn = state
        .duckdb_manager
        .get_connection()
        .map_err(|e| {
            log::error!("[execute_sql] 获取 DuckDB 连接失败: error={}", e);
            "DuckDB 连接异常，请重新打开项目".to_string()
        })?;

    let cache_enabled = state.query_cache.is_enabled();

    // ========== 缓存命中快路径（多语句全命中 / 单语句命中） ==========
    // 业务数据统一走 DuckDB，缓存引擎标记为 duckdb
    if cache_enabled {
        let stmts = SqlExecutionService::split_sql_statements(&sql);

        if stmts.len() > 1 {
            // 仅当所有语句都是只读，才尝试整批查缓存
            if SqlExecutionService::is_all_readonly(&stmts) {
                let mut cached_results: Vec<SqlStatementResult> = Vec::new();
                let mut all_hit = true;
                for stmt in &stmts {
                    let key = make_cache_key(stmt, &[]);
                    match state.query_cache.get(&key) {
                        Some(qr) => cached_results.push(SqlStatementResult {
                            statement: stmt.clone(),
                            success: true,
                            error: None,
                            columns: Some(qr.columns),
                            rows: Some(qr.rows),
                            affected_rows: None,
                            engine: Some("duckdb".to_string()),
                            execution_time_ms: Some(0),
                        }),
                        None => {
                            all_hit = false;
                            break;
                        }
                    }
                }
                if all_hit && cached_results.len() == stmts.len() {
                    log::debug!(
                        "[查询缓存] 多语句全命中，{} 条 SQL 直接返回",
                        cached_results.len()
                    );
                    return Ok(BatchExecuteResult {
                        success_count: cached_results.len(),
                        fail_count: 0,
                        results: cached_results,
                    });
                }
            }
        } else if let Some(stmt) = stmts.first() {
            // 单语句快路径：保持与原逻辑一致
            if is_cacheable(stmt) {
                let cache_key = make_cache_key(stmt, &[]);
                if let Some(cached_result) = state.query_cache.get(&cache_key) {
                    log::debug!(
                        "[查询缓存] 命中，SQL 长度: {}, 行数: {}, 列数: {}",
                        sql.len(),
                        cached_result.rows.len(),
                        cached_result.columns.len()
                    );
                    return Ok(BatchExecuteResult {
                        results: vec![SqlStatementResult {
                            statement: sql.clone(),
                            success: true,
                            error: None,
                            columns: Some(cached_result.columns),
                            rows: Some(cached_result.rows),
                            affected_rows: None,
                            engine: Some("duckdb".to_string()),
                            execution_time_ms: Some(0),
                        }],
                        success_count: 1,
                        fail_count: 0,
                    });
                }
            }
        }
    }

    // ========== 实际执行（部分命中场景交由 batch 内部逐句处理） ==========
    let query_cache_ref: Option<&crate::services::query_cache_service::QueryCacheService> =
        if cache_enabled { Some(&state.query_cache) } else { None };

    SqlExecutionService::execute_sql_batch(
        &sqlite_conn,
        &duckdb_conn,
        &state.db_manager,
        &sql,
        query_cache_ref,
    )
}

/// 获取当前查询缓存的统计快照（容量/条目数/命中/未命中/命中率/开关）
///
/// 用于前端"查询缓存"卡片展示。
#[tauri::command]
pub fn get_query_cache_stats(state: State<'_, TauriAppState>) -> CacheStats {
    state.query_cache.stats()
}

/// 动态调整查询缓存配置（容量/TTL/开关/策略）
///
/// - `capacity`: 缓存容量上限（至少 1）
/// - `ttl_seconds`: 单条缓存有效期（秒，至少 5）
/// - `enabled`: 是否启用缓存
/// - `strategy`: 缓存策略（"lru" 或 "none"）
///
/// 返回 `true` 表示配置已成功更新。
#[tauri::command]
pub fn configure_query_cache(
    state: State<'_, TauriAppState>,
    capacity: usize,
    ttl_seconds: u64,
    enabled: bool,
    strategy: Option<String>,
) -> bool {
    let cache_strategy = strategy.as_deref().map(CacheStrategy::from);
    state.query_cache.configure(capacity, ttl_seconds, enabled, cache_strategy);
    true
}

/// 手动清空查询缓存（重置 hits/misses/entries）
///
/// 返回清空后的新统计快照，便于前端面板立即刷新显示。
#[tauri::command]
pub fn clear_query_cache(state: State<'_, TauriAppState>) -> CacheStats {
    state.query_cache.invalidate_all();
    log::info!("查询缓存已清空（手动触发）");
    state.query_cache.stats()
}

/// 失效指定 key 对应的单条查询缓存
///
/// 用于精确失效某条 SQL 的缓存而不影响其他条目（例如某表结构变更后
/// 仅刷新相关查询）。返回 `data: true` 表示命中并删除，`false` 表示 key 不存在。
///
/// 参数：
/// - `key`: 缓存键（前端通常需先通过相同 SQL 重新生成 key，或由后端暴露）
#[tauri::command]
pub fn invalidate_query_cache(
    key: String,
    state: State<'_, TauriAppState>,
) -> Result<ApiResponse<bool>, String> {
    if key.trim().is_empty() {
        return Ok(ApiResponse {
            success: false,
            message: "缓存 key 不能为空".into(),
            data: Some(false),
        });
    }
    let removed = state.query_cache.invalidate(&key);
    log::info!(
        "[查询缓存] 单 key 失效：key_len={}, removed={}",
        key.len(),
        removed
    );
    Ok(ApiResponse {
        success: true,
        message: if removed {
            "缓存条目已失效".into()
        } else {
            "缓存 key 不存在".into()
        },
        data: Some(removed),
    })
}

#[tauri::command]
pub fn list_sql_snippets(
    state: State<'_, TauriAppState>,
    category: Option<String>,
) -> Result<Vec<SqlSnippet>, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[sql] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;
    SqlSnippetService::list_snippets(&conn, category.as_deref())
}

#[tauri::command]
pub fn get_sql_snippet(
    state: State<'_, TauriAppState>,
    id: String,
) -> Result<Option<SqlSnippet>, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[sql] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;
    SqlSnippetService::get_snippet(&conn, &id)
}

#[tauri::command]
pub fn create_sql_snippet(
    state: State<'_, TauriAppState>,
    name: String,
    sql: String,
    description: Option<String>,
    category: Option<String>,
    tags: Option<String>,
) -> Result<SqlSnippet, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    if name.trim().is_empty() {
        return Err("片段名称不能为空".to_string());
    }
    if sql.trim().is_empty() {
        return Err("SQL 内容不能为空".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[sql] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;
    SqlSnippetService::create_snippet(
        &conn,
        &name,
        &sql,
        description.as_deref(),
        category.as_deref(),
        tags.as_deref(),
    )
}

// TODO(2026-07-17): Tauri command 参数 8 个，参数由前端 invoke 反序列化，
// 重构成 struct 会改变前端调用契约，留待 v24.0 统一引入 UpdateSqlSnippetParams
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn update_sql_snippet(
    state: State<'_, TauriAppState>,
    id: String,
    name: String,
    sql: String,
    description: Option<String>,
    category: Option<String>,
    tags: Option<String>,
    is_favorite: Option<bool>,
) -> Result<SqlSnippet, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    if name.trim().is_empty() {
        return Err("片段名称不能为空".to_string());
    }
    if sql.trim().is_empty() {
        return Err("SQL 内容不能为空".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[sql] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;
    SqlSnippetService::update_snippet(
        &conn,
        &id,
        &name,
        &sql,
        description.as_deref(),
        category.as_deref(),
        tags.as_deref(),
        is_favorite,
    )
}

#[tauri::command]
pub fn delete_sql_snippet(
    state: State<'_, TauriAppState>,
    id: String,
) -> Result<(), String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[sql] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;
    SqlSnippetService::delete_snippet(&conn, &id)
}

#[tauri::command]
pub fn toggle_snippet_favorite(
    state: State<'_, TauriAppState>,
    id: String,
) -> Result<bool, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let conn = state.db_manager.get_connection().map_err(|e| {
        log::error!("[sql] 获取数据库连接失败: error={}", e);
        "数据库连接异常，请重新打开数据库".to_string()
    })?;
    SqlSnippetService::toggle_favorite(&conn, &id)
}

#[tauri::command]
pub fn preload_duckdb(
    state: State<'_, TauriAppState>,
    _app: tauri::AppHandle,
) -> Result<ApiResponse<String>, String> {
    // DuckDB 已改为文件连接（data.duckdb），项目打开时自动连接，无需预加载。
    // 保留命令签名以兼容前端调用。
    if !state.duckdb_manager.is_connected() {
        return Ok(ApiResponse {
            success: false,
            message: "DuckDB 未连接".into(),
            data: None,
        });
    }

    log::debug!("[preload_duckdb] DuckDB 已通过文件连接就绪，无需预加载");
    Ok(ApiResponse {
        success: true,
        message: "DuckDB 已就绪".into(),
        data: Some("ready".into()),
    })
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

#[cfg(test)]
mod tests {
    use super::*;

    /// 空 SQL 字符串应被拒绝，不应 panic
    #[test]
    fn test_validate_sql_empty_rejected() {
        let result = validate_sql_input("");
        assert!(result.is_err(), "空 SQL 应返回错误");
        let msg = result.unwrap_err();
        assert!(msg.contains("不能为空"), "错误信息应提示空值，实际: {}", msg);
    }

    /// 纯空白 SQL 应被拒绝（与空字符串等价）
    #[test]
    fn test_validate_sql_whitespace_only_rejected() {
        let result = validate_sql_input("   \n\t  ");
        assert!(result.is_err(), "纯空白 SQL 应返回错误");
    }

    /// 包含 NULL 字符（`\0`）的 SQL 应被拒绝，不应 panic
    #[test]
    fn test_validate_sql_null_char_rejected() {
        let result = validate_sql_input("SELECT 1\0");
        assert!(result.is_err(), "包含 NULL 字符的 SQL 应返回错误");
        let msg = result.unwrap_err();
        assert!(msg.contains("NULL"), "错误信息应提示 NULL 字符，实际: {}", msg);
    }

    /// 多语句 SQL 应通过校验（由 execute_sql_batch 处理分句和路由）
    #[test]
    fn test_validate_sql_multi_statement_allowed() {
        let result = validate_sql_input("SELECT 1; SELECT 2;");
        assert!(result.is_ok(), "多语句 SQL 应通过校验（由下游安全处理）");
    }

    /// 超长 SQL（10KB+）应正常处理（返回 Ok），不应 panic
    #[test]
    fn test_validate_sql_long_input_no_panic() {
        // 构造 10KB+ 的单条 SELECT 语句
        let big_literal = "a".repeat(10 * 1024);
        let sql = format!("SELECT '{}' AS col", big_literal); // safe_sql: 测试用 SQL 字面量，不执行
        assert!(sql.len() > 10 * 1024, "测试 SQL 长度应超过 10KB");

        let result = validate_sql_input(&sql);
        assert!(result.is_ok(), "超长但合法的单条 SQL 应通过校验，实际: {:?}", result);
    }

    /// 单条语句带末尾分号应通过校验（不算多语句）
    #[test]
    fn test_validate_sql_trailing_semicolon_ok() {
        let result = validate_sql_input("SELECT 1;");
        assert!(result.is_ok(), "单条语句带末尾分号应通过校验");
    }

    /// 合法的单条 SELECT 应通过校验
    #[test]
    fn test_validate_sql_valid_simple() {
        let result = validate_sql_input("SELECT 1");
        assert!(result.is_ok(), "合法单条 SQL 应通过校验");
    }

    /// 超长 SQL（1MB）应正常处理（返回 Ok），不应 panic 也不应 OOM
    ///
    /// 验证校验逻辑对超大输入的健壮性：仅做轻量字符串检查，
    /// 不应因输入体积大而崩溃或显著阻塞。
    #[test]
    fn test_validate_sql_1mb_input_no_panic() {
        // 构造 1MB 的单条 SELECT 语句（字面量约 1MB）
        let big_literal = "a".repeat(1024 * 1024);
        let sql = format!("SELECT '{}' AS col", big_literal); // safe_sql: 测试用 SQL 字面量，不执行
        assert!(sql.len() >= 1024 * 1024, "测试 SQL 长度应达到 1MB");

        let result = validate_sql_input(&sql);
        assert!(result.is_ok(), "1MB 合法单条 SQL 应通过校验，实际: {:?}", result);
    }

    /// 纯注释 SQL（仅含行注释，无实际语句）不应 panic
    ///
    /// 当前 validate_sql_input 仅做空白/NULL/多语句校验，
    /// 纯注释能通过校验（由后续执行层处理），此处验证不 panic 即可。
    #[test]
    fn test_validate_sql_pure_line_comment_no_panic() {
        let result = validate_sql_input("-- this is a pure comment");
        // 纯注释非空、无 NULL、单语句 → 通过校验
        assert!(result.is_ok(), "纯行注释 SQL 不应导致 panic");
    }

    /// 纯块注释 SQL 不应 panic
    #[test]
    fn test_validate_sql_pure_block_comment_no_panic() {
        let result = validate_sql_input("/* 多行\n块注释 */");
        assert!(result.is_ok(), "纯块注释 SQL 不应导致 panic");
    }

    /// 含行内注释的 SQL 应通过校验（注释不影响语句本身合法性）
    #[test]
    fn test_validate_sql_with_inline_comment_ok() {
        let result = validate_sql_input("SELECT 1 -- 查询常量");
        assert!(result.is_ok(), "含行内注释的单条 SQL 应通过校验");
    }

    /// 含块注释的 SQL 应通过校验
    #[test]
    fn test_validate_sql_with_block_comment_ok() {
        let result = validate_sql_input("SELECT /* 注释 */ 1");
        assert!(result.is_ok(), "含块注释的单条 SQL 应通过校验");
    }

    /// 注释 + 多语句的混合应通过校验（多语句由 execute_sql_batch 处理）
    #[test]
    fn test_validate_sql_comment_with_multi_statement_ok() {
        let result = validate_sql_input("SELECT 1 -- comment\n; SELECT 2");
        assert!(result.is_ok(), "含注释的多语句 SQL 应通过校验（由下游安全处理）");
    }
}
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
use crate::services::SqlExecutionService;
use crate::services::query_cache_service::{CacheStats, is_cacheable, make_cache_key};
use tauri::State;

#[tauri::command]
pub fn execute_sql(
    state: State<'_, TauriAppState>,
    sql: String,
) -> Result<BatchExecuteResult, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let sqlite_conn = state
        .db_manager
        .get_connection()
        .map_err(|e| e.to_string())?;

    let duckdb_opt = match state.get_duckdb_connection() {
        Ok(arc) => Some(arc),
        Err(e) => {
            log::warn!("DuckDB not initialized, using SQLite: {}", e);
            None
        }
    };

    let cache_enabled = state.query_cache.is_enabled();

    // ========== 缓存命中快路径（多语句全命中 / 单语句命中） ==========
    // 说明：这里仅做"全命中直接短路"的优化；部分命中场景交给 `execute_sql_batch`
    // 内部按句处理缓存/执行/写回。
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

    let result = SqlExecutionService::execute_sql_batch(
        &sqlite_conn,
        duckdb_opt,
        &state.db_manager,
        &sql,
        query_cache_ref,
    );

    result
}

/// 获取当前查询缓存的统计快照（容量/条目数/命中/未命中/命中率/开关）
///
/// 用于前端"查询缓存"卡片展示。
#[tauri::command]
pub fn get_query_cache_stats(state: State<'_, TauriAppState>) -> CacheStats {
    state.query_cache.stats()
}

/// 动态调整查询缓存配置（容量/TTL/开关）
///
/// - `capacity`: 缓存容量上限（至少 1）
/// - `ttl_seconds`: 单条缓存有效期（秒，至少 5）
/// - `enabled`: 是否启用缓存
///
/// 返回 `true` 表示配置已成功更新。
#[tauri::command]
pub fn configure_query_cache(
    state: State<'_, TauriAppState>,
    capacity: usize,
    ttl_seconds: u64,
    enabled: bool,
) -> bool {
    state.query_cache.configure(capacity, ttl_seconds, enabled);
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

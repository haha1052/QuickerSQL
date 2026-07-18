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
use tauri::Emitter;
use super::ApiResponse;

#[tauri::command]
pub async fn execute_sql(
    state: State<'_, TauriAppState>,
    sql: String,
) -> Result<BatchExecuteResult, String> {
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    let duckdb_opt = {
        let sqlite_conn = state
            .db_manager
            .get_connection()
            .map_err(|e| {
                log::error!("[execute_sql] 获取数据库连接失败: error={}", e);
                "数据库连接异常，请重新打开数据库".to_string()
            })?;

        // Phase 16: 获取信号量许可（SQL 查询并发控制）
        // 注意：sqlite_conn 在此块结束时被 drop，之后的 await 不会跨越 MutexGuard
        let duckdb_result = state.get_duckdb_connection();
        drop(sqlite_conn);

        let _permit = state.query_semaphore.acquire().await.map_err(|e| {
            log::error!("[execute_sql] 获取查询信号量失败: error={}", e);
            "系统繁忙，请稍后重试".to_string()
        })?;

        match duckdb_result {
            Ok(arc) => Some(arc),
            Err(e) => {
                log::warn!("DuckDB not initialized, using SQLite: {}", e);
                None
            }
        }
    };

    let cache_enabled = state.query_cache.is_enabled();

    // ========== 缓存命中快路径（多语句全命中 / 单语句命中） ==========
    let sqlite_conn = state
        .db_manager
        .get_connection()
        .map_err(|e| {
            log::error!("[execute_sql] 获取数据库连接失败（缓存检查阶段）: error={}", e);
            "数据库连接异常，请重新打开数据库".to_string()
        })?;
    // 说明：这里仅做"全命中直接短路"的优化；部分命中场景交给 `execute_sql_batch`
    // 内部按句处理缓存/执行/写回。
    if cache_enabled {
        let stmts = SqlExecutionService::split_sql_statements(&sql);

        if stmts.len() > 1 {
            // 仅当所有语句都是只读，才尝试整批查缓存
            if SqlExecutionService::is_all_readonly(&stmts) {
                let mut cached_results: Vec<SqlStatementResult> = Vec::new();
                let mut all_hit = true;
                let cache_engine = if duckdb_opt.is_some() { "duckdb" } else { "sqlite" };
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
                            engine: Some(cache_engine.to_string()),
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
                    let cache_engine = if duckdb_opt.is_some() { "duckdb" } else { "sqlite" };
                    return Ok(BatchExecuteResult {
                        results: vec![SqlStatementResult {
                            statement: sql.clone(),
                            success: true,
                            error: None,
                            columns: Some(cached_result.columns),
                            rows: Some(cached_result.rows),
                            affected_rows: None,
                            engine: Some(cache_engine.to_string()),
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
        duckdb_opt,
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
    app: tauri::AppHandle,
) -> Result<ApiResponse<String>, String> {
    if !state.db_manager.is_connected() {
        return Ok(ApiResponse {
            success: false,
            message: "未连接到数据库".into(),
            data: None,
        });
    }

    let db_manager = state.db_manager.clone();
    let db_path = {
        let guard = state.db_path.lock().map_err(|e| {
            log::error!("[preload_duckdb] 获取数据库路径锁失败: error={}", e);
            "数据库状态异常，请重试".to_string()
        })?;
        guard.clone()
    };
    let duckdb_conn = state.duckdb_conn.clone();
    let app_handle = app.clone();

    std::thread::spawn(move || {
        let t0 = std::time::Instant::now();
        log::info!("[DuckDB] 预加载开始");
        
        let table_names = match db_manager.get_connection() {
            Ok(sqlite_conn) => {
                match crate::database::meta::list_user_table_names(&sqlite_conn) {
                    Ok(names) => names,
                    Err(e) => {
                        log::warn!("[DuckDB] 从 SQLite 获取表名失败: {}", e);
                        Vec::new()
                    }
                }
            }
            Err(e) => {
                log::warn!("[DuckDB] 获取 SQLite 连接失败: {}", e);
                Vec::new()
            }
        };

        log::info!("[DuckDB] 预加载：从 SQLite 获取到 {} 个用户表", table_names.len());

        let driver = crate::database::duckdb::DuckDbDriver::new();

        match driver.connect_memory() {
            Ok(conn) => {
                let _ = conn.execute("LOAD sqlite;", &[]);

                let sqlite_path_str = db_path.to_string_lossy().replace("'", "''");
                let attach_sql = format!("ATTACH '{}' AS sqlite_db (TYPE SQLITE);", sqlite_path_str);

                if conn.execute(&attach_sql, &[]).is_ok() {
                    let mut success_count = 0;
                    for table_name in &table_names {
                        if crate::database::SqlIdentifier::is_safe_identifier(table_name) {
                            let create_view_sql = if let Ok(sqlite_conn) = db_manager.get_connection() {
                                build_view_sql_with_type_casts(&sqlite_conn, table_name)
                            } else {
                                let quoted_table = crate::database::SqlIdentifier::quote_identifier(table_name);
                                format!(
                                    "CREATE OR REPLACE VIEW {} AS SELECT * FROM sqlite_db.{}",
                                    quoted_table, quoted_table
                                )
                            };
                            if conn.execute(&create_view_sql, &[]).is_ok() {
                                success_count += 1;
                            }
                        }
                    }

                    let _ = conn.execute("SET preserve_insertion_order = false;", &[]);

                    if let Ok(mut guard) = duckdb_conn.lock() {
                        *guard = Some(std::sync::Arc::new(std::sync::Mutex::new(conn)));
                        let duration_ms = t0.elapsed().as_millis() as i64;
                        log::info!("[DuckDB] 预加载完成，已创建 {}/{} 个 VIEW，耗时 {}ms", success_count, table_names.len(), duration_ms);
                        
                        let status = crate::models::DuckDbInitStatus {
                            success: true,
                            view_count: success_count,
                            total_tables: table_names.len() as i32,
                            duration_ms,
                            trigger: "preload".to_string(),
                        };
                        let _ = app_handle.emit("duckdb_init_completed", status);
                    } else {
                        log::warn!("[DuckDB] 预加载完成，但无法保存连接（Mutex poison）");
                        
                        let status = crate::models::DuckDbInitStatus {
                            success: false,
                            view_count: 0,
                            total_tables: table_names.len() as i32,
                            duration_ms: t0.elapsed().as_millis() as i64,
                            trigger: "preload".to_string(),
                        };
                        let _ = app_handle.emit("duckdb_init_completed", status);
                    }
                } else {
                    log::warn!("[DuckDB] 预加载失败：ATTACH SQLite 失败");
                    
                    let status = crate::models::DuckDbInitStatus {
                        success: false,
                        view_count: 0,
                        total_tables: table_names.len() as i32,
                        duration_ms: t0.elapsed().as_millis() as i64,
                        trigger: "preload".to_string(),
                    };
                    let _ = app_handle.emit("duckdb_init_completed", status);
                }
            }
            Err(e) => {
                log::warn!("[DuckDB] 预加载失败：创建内存连接失败: {}", e);
                
                let status = crate::models::DuckDbInitStatus {
                    success: false,
                    view_count: 0,
                    total_tables: table_names.len() as i32,
                    duration_ms: t0.elapsed().as_millis() as i64,
                    trigger: "preload".to_string(),
                };
                let _ = app_handle.emit("duckdb_init_completed", status);
            }
        }
    });

    Ok(ApiResponse {
        success: true,
        message: "DuckDB 预加载已启动".into(),
        data: Some("preloading".into()),
    })
}

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

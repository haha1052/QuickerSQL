use std::path::{Path, PathBuf};
use std::sync::{Mutex, Arc};

pub mod database;
pub mod services;
pub mod models;
pub mod commands;
pub mod utils;

use services::ProjectService;
use database::{DatabaseManager, SqliteDriver, DuckDbDriver, DatabaseError, SharedDatabaseManager};
use tauri::Manager;
use tauri::Emitter;
use tokio::sync::Semaphore;

// 类型从 models/database.rs 导入
pub use models::database::{DatabaseStatus, SqlStatementResult, BatchExecuteResult, ProjectInfo, SheetInfo, ExcelPreview, CsvPreview, FieldMeta, ImportRequest, ImportRequestV2, DatabaseInfo, TableInfo, ColumnInfo};

/// 系统表 ensure 函数签名：接收数据库连接，返回 Result<(), String>
type EnsureFn = fn(&crate::database::MutexGuardConnection<'_>) -> Result<(), String>;

/// DuckDB 连接的共享句柄类型（外层 Option 表示懒加载，None=尚未初始化）
type DuckDbConnHandle = Arc<Mutex<Option<Arc<Mutex<Box<dyn database::DatabaseConnection>>>>>>;

/// 包装函数：确保 __projects_registry 表存在（位于独立的 projects.db）
///
/// 注意：__projects_registry 表不在主应用 DB 中，而在 <data_dir>/quickersql/projects.db。
/// ProjectService::ensure_projects_registry_table_exists 的签名是
/// `fn(&rusqlite::Connection) -> Result<(), String>`，与 EnsureFn 不兼容，
/// 因此用此包装器调用 ProjectService::ensure_registry() 完成实际创建。
/// ensure_registry() 内部会打开 projects.db 并建表，幂等可重复调用。
fn ensure_projects_registry_wrapper(_conn: &crate::database::MutexGuardConnection<'_>) -> Result<(), String> {
    crate::services::ProjectService::ensure_registry().map(|_| ())
}

/// 包装函数：占位 __project_info 表（每个项目的 meta.db 中）
///
/// 注意：__project_info 表位于每个项目的 meta.db，非主应用 DB。
/// ProjectService::ensure_project_info_table_exists 的签名是
/// `fn(&rusqlite::Connection) -> Result<(), String>`，与 EnsureFn 不兼容。
/// 此表在项目创建/打开时由 ProjectService 自动创建，启动时无需在主 DB 上操作。
/// 此处仅占位以保持 SYSTEM_TABLE_ENSURE_FNS 数组对 17 张表的完整覆盖。
fn ensure_project_info_wrapper(_conn: &crate::database::MutexGuardConnection<'_>) -> Result<(), String> {
    Ok(())
}

/// 系统表 ensure 函数表：(ensure 函数, 表描述)
/// 用于在应用启动时统一初始化 17 张系统表（15 张在主应用 DB，2 张在独立 DB）
const SYSTEM_TABLE_ENSURE_FNS: &[(EnsureFn, &str)] = &[
    (crate::services::AuditLogService::ensure_audit_log_table_exists, "审计日志表"),
    (crate::services::TrashService::ensure_trash_table_exists, "回收站表"),
    (crate::services::SettingsService::ensure_settings_table_exists, "设置表"),
    (crate::services::QueryHistoryService::ensure_query_history_table_exists, "查询历史表"),
    (crate::services::TaskService::ensure_tables_exists, "自动化任务表"),
    (crate::services::DashboardService::ensure_tables_exist, "仪表盘/图表表"),
    (crate::services::AppStateService::ensure_app_state_table_exists, "应用状态表"),
    (crate::services::AppStateService::ensure_workspace_tables_exist, "工作区表"),
    (crate::services::SqlSnippetService::ensure_table_exists, "SQL 片段表"),
    (ensure_projects_registry_wrapper, "项目注册表（独立 DB）"),
    (ensure_project_info_wrapper, "项目信息表（独立 DB）"),
];

pub struct TauriAppState {
    pub db_manager: SharedDatabaseManager,
    db_path: Mutex<PathBuf>,
    duckdb_conn: DuckDbConnHandle,
    pub init_timestamp_ms: i64,
    // v9.3: Rust 初始化各阶段耗时（毫秒，Option<f64>，None = 未记录）
    pub app_init_ms: Mutex<Option<f64>>,          // TauriAppState::new() 总耗时
    pub system_tables_init_ms: Mutex<Option<f64>>, // 系统表初始化耗时
    pub sqlite_connect_ms: Mutex<Option<f64>>,     // SQLite 建立连接耗时
    // M7.2: 只读查询缓存服务（LRU + TTL，默认开启，容量 100，TTL 5 分钟）
    pub query_cache: Arc<crate::services::QueryCacheService>,
    // Phase 16: 并发控制信号量
    pub query_semaphore: Arc<Semaphore>,  // SQL 查询并发控制
    pub task_semaphore: Arc<Semaphore>,   // 任务并发控制
    // DuckDB 初始化通知：用于发送 Tauri 事件
    app_handle: Arc<Mutex<Option<tauri::AppHandle>>>,
}

impl TauriAppState {
    /// 暴露内部 db_manager（用于 commands 层）
    pub fn db_manager(&self) -> &SharedDatabaseManager {
        &self.db_manager
    }

    /// 暴露内部 db_path（用于需要路径信息的场景）
    pub fn db_path(&self) -> &Mutex<PathBuf> {
        &self.db_path
    }
}

impl TauriAppState {
    fn new() -> Self {
        let t0 = std::time::Instant::now();
        let mut db_manager = DatabaseManager::new();
        db_manager.register_driver(Box::new(SqliteDriver::new()));
        let t1 = std::time::Instant::now();

        // 旧版项目目录迁移（升级时自动执行，幂等）
        // 必须在 get_default_db_path() 之前执行：
        // get_default_db_path() 会调用 find_project_by_name("default")，
        // 若旧 "default" 目录未先迁移，会创建新的 UUID 项目，导致旧目录被跳过。
        // 迁移失败不阻塞应用启动（只记日志）。
        match crate::services::ProjectService::migrate_legacy_projects() {
            Ok(count) => {
                if count > 0 {
                    log::info!("旧版项目迁移完成，共迁移 {} 个项目", count);
                }
            }
            Err(e) => {
                log::warn!("旧版项目迁移失败: {}", e);
            }
        }

        let db_path = match ProjectService::get_default_db_path() {
            Ok(path) => path,
            Err(_) => std::env::temp_dir().join("quickersql_temp.db"),
        };
        let t2 = std::time::Instant::now();

        let manager = Arc::new(db_manager);
        let query_cache = Arc::new(crate::services::QueryCacheService::new());
        
        // Phase 16: 并发控制信号量初始化
        // 初始值为 1，连接数据库后从设置读取实际值并 add_permits 调整
        // 注意：tokio Semaphore 不支持减少许可，若设置值 < 默认值需重启生效
        let query_semaphore = Arc::new(Semaphore::new(1));
        let task_semaphore = Arc::new(Semaphore::new(3));
        
        let state = TauriAppState {
            db_manager: manager.clone(),
            db_path: Mutex::new(db_path.clone()),
            duckdb_conn: Arc::new(Mutex::new(None)),
            init_timestamp_ms: chrono::Utc::now().timestamp_millis(),
            app_init_ms: Mutex::new(None),
            system_tables_init_ms: Mutex::new(None),
            sqlite_connect_ms: Mutex::new(None),
            query_cache: query_cache.clone(),
            query_semaphore,
            task_semaphore,
            app_handle: Arc::new(Mutex::new(None)),
        };

        // 处理 Mutex poison：如果 db_path 被 poison，回退到 poison 前的值继续初始化
        let _ = match state.db_path.lock() {
            Ok(guard) => Self::connect_default_db(&manager, &guard),
            Err(poisoned) => {
                log::warn!("db_path Mutex 已 poison，使用 poison 前的值继续初始化");
                Self::connect_default_db(&manager, &poisoned.into_inner())
            }
        };
        let t3 = std::time::Instant::now();

        // 集中初始化系统表：包在单个事务内以减少 fsync 次数
        if let Ok(conn) = state.db_manager.get_connection() {
            // 1) 先运行旧表名迁移
            if let Err(e) = crate::services::MigrationService::run_legacy_table_migrations(&conn) {
                log::warn!("旧表名迁移失败: {}", e);
            }

            // 2) 批量 ensure 所有系统表
            let ensure_fns = SYSTEM_TABLE_ENSURE_FNS;

            if conn.begin_transaction().is_ok() {
                let mut all_ok = true;
                for (f, name) in ensure_fns.iter() {
                    if let Err(e) = f(&conn) {
                        log::warn!("初始化 {} 失败: {}", name, e);
                        all_ok = false;
                    }
                }
                if all_ok {
                    if let Err(e) = conn.commit_transaction() {
                        log::warn!("系统表初始化事务提交失败: {}", e);
                        let _ = conn.rollback_transaction();
                    }
                } else {
                    let _ = conn.rollback_transaction();
                    for (f, name) in ensure_fns.iter() {
                        let _ = f(&conn).map_err(|e| log::warn!("(非事务重试) 初始化 {} 失败: {}", name, e));
                    }
                }
            } else {
                for (f, name) in ensure_fns.iter() {
                    let _ = f(&conn).map_err(|e| log::warn!("初始化 {} 失败: {}", name, e));
                }
            }

            // M7.2 性能优化：为系统表创建业务索引（幂等，重复执行无副作用）
            // 注意：必须在系统表初始化完成后调用，否则索引创建会失败
            if let Err(e) = crate::services::MigrationService::apply_optimization_indexes(&conn) {
                log::warn!("M7.2 索引优化执行失败（不影响核心功能）：{}", e);
            }
        }

        // 回收站自动清理（尽力而为，失败不影响启动）
        if let Ok(conn) = state.db_manager.get_connection() {
            match crate::services::TrashService::auto_cleanup(&conn) {
                Ok(count) => {
                    if count > 0 {
                        log::info!("启动时回收站自动清理完成，共清理 {} 个项目", count);
                    } else {
                        log::info!("启动时回收站自动清理检查完成，无需清理");
                    }
                }
                Err(e) => {
                    log::warn!("启动时回收站自动清理失败：{}（不影响应用启动）", e);
                }
            }

            // 从设置读取 maxConcurrentQueries 并调整查询信号量
            // 信号量初始为 1，这里 add_permits(N-1) 达到 N 个许可
            // 注意：若设置值小于当前许可数，不做减少（tokio Semaphore 不支持），下次启动生效
            match crate::services::SettingsService::get_setting(&conn, "advanced", "maxConcurrentQueries") {
                Ok(Some(setting)) => {
                    if let Ok(permits) = setting.value.parse::<usize>() {
                        let clamped = permits.clamp(1, 100);
                        if clamped > 1 {
                            state.query_semaphore.add_permits(clamped - 1);
                        }
                        log::info!("已加载 maxConcurrentQueries 设置: {}", clamped);
                    } else {
                        state.query_semaphore.add_permits(9);
                        log::warn!("maxConcurrentQueries 设置值无效，使用默认值 10");
                    }
                }
                _ => {
                    state.query_semaphore.add_permits(9);
                    log::info!("未设置 maxConcurrentQueries，使用默认值 10");
                }
            }
        }

        // autoConnect: 启动时自动连接上次使用的数据库
        // 注意：这里只读取设置并记录日志，实际切换由前端启动时处理
        // 前端会根据 get_startup_status 返回的 current_db_path 决定是否切换
        if let Ok(conn) = state.db_manager.get_connection() {
            let auto_connect = crate::services::SettingsService::get_setting(&conn, "database", "autoConnect")
                .ok()
                .flatten()
                .map(|s| !s.value.eq_ignore_ascii_case("false"))
                .unwrap_or(true);

            if auto_connect {
                // 记录日志，前端启动时会检查并执行切换
                log::info!("autoConnect 已启用，前端启动时将自动连接上次使用的数据库");
            } else {
                log::info!("autoConnect 已禁用，不自动连接数据库");
            }
        }

        // 审计日志自动清理（尽力而为，失败不影响启动）
        if let Ok(conn) = state.db_manager.get_connection() {
            // 读取审计日志保留天数设置
            let retention_days = match crate::services::SettingsService::get_setting(&conn, "security", "auditLogRetentionDays") {
                Ok(Some(setting)) => {
                    setting.value.parse::<i64>().unwrap_or(90)
                }
                _ => 90, // 默认90天
            };
            match crate::services::AuditLogService::cleanup_expired_logs(&conn, retention_days) {
                Ok(count) => {
                    if count > 0 {
                        log::info!("启动时审计日志自动清理完成，共清理 {} 条记录", count);
                    } else {
                        log::debug!("启动时审计日志自动清理检查完成，无需清理");
                    }
                }
                Err(e) => {
                    log::warn!("启动时审计日志自动清理失败：{}（不影响应用启动）", e);
                }
            }
        }

        let t4 = std::time::Instant::now();

        // v9.3: 记录 Rust 初始化总耗时（毫秒，保留 2 位小数）
        //        供前端 startup: get_startup_status 读取，让计时真正覆盖全链路
        let app_init_ms = (t4 - t0).as_secs_f64() * 1000.0;
        // 用 match 模式处理 Mutex PoisonError（替代 unwrap()，避免 panic 导致崩溃）
        match state.app_init_ms.lock() {
            Ok(mut guard) => *guard = Some(app_init_ms),
            Err(poisoned) => {
                log::warn!("app_init_ms Mutex poisoned，使用前值");
                *poisoned.into_inner() = Some(app_init_ms);
            }
        }
        match state.system_tables_init_ms.lock() {
            Ok(mut guard) => *guard = Some((t4 - t3).as_secs_f64() * 1000.0),
            Err(poisoned) => {
                log::warn!("system_tables_init_ms Mutex poisoned，使用前值");
                *poisoned.into_inner() = Some((t4 - t3).as_secs_f64() * 1000.0);
            }
        }
        match state.sqlite_connect_ms.lock() {
            Ok(mut guard) => *guard = Some((t3 - t2).as_secs_f64() * 1000.0),
            Err(poisoned) => {
                log::warn!("sqlite_connect_ms Mutex poisoned，使用前值");
                *poisoned.into_inner() = Some((t3 - t2).as_secs_f64() * 1000.0);
            }
        }

        log::info!(
            "[启动计时] TauriAppState 总耗时: {:.2} ms (DB driver: {:.2} | path: {:.2} | SQLite connect: {:.2} | 系统表 init: {:.2})",
            app_init_ms,
            (t1 - t0).as_secs_f64() * 1000.0,
            (t2 - t1).as_secs_f64() * 1000.0,
            (t3 - t2).as_secs_f64() * 1000.0,
            (t4 - t3).as_secs_f64() * 1000.0
        );
        log::info!("[启动计时] DuckDB 已推迟到首次使用时懒加载（用户首次 SQL 时才启动）");
        log::info!(
            "[查询缓存] 默认已启用：capacity={}, ttl={}s（可通过 settings 项 cache.enabled/cache.capacity/cache.ttl 调整）",
            query_cache.stats().capacity,
            300
        );

        state
    }

    fn connect_default_db(db_manager: &SharedDatabaseManager, db_path: &Path) -> Result<(), String> {
        match db_manager.connect("sqlite", db_path) {
            Ok(_) => Ok(()),
            Err(DatabaseError::FileNotFound) => {
                db_manager.create_and_connect("sqlite", db_path).map_err(|e| e.to_string())
            }
            Err(e) => Err(e.to_string()),
        }
    }

    fn set_db_path(&self, new_path: PathBuf) -> Result<(), String> {
        // 1. 清理旧的 DuckDB 连接（内存模式，直接丢弃即可）
        {
            let mut duckdb_guard = self.duckdb_conn.lock()
                .map_err(|e| format!("获取连接锁失败: {}", e))?;
            *duckdb_guard = None;
        }
        
        // 2. 更新路径
        let mut path = self.db_path.lock().map_err(|e| format!("获取路径锁失败: {}", e))?;
        *path = new_path.clone();
        drop(path);

        // 3. 初始化新连接（懒加载，这里不立即初始化，首次查询时才初始化）
        Ok(())
    }

    fn init_duckdb(&self, sqlite_path: &Path, table_names: &[String]) -> Result<(), String> {
        let driver = DuckDbDriver::new();

        // 使用内存模式（数据通过 ATTACH 从 SQLite 读取，不需要持久化）
        let conn = driver.connect_memory()
            .map_err(|e| format!("创建 DuckDB 内存连接失败: {}", e))?;

        // 0. 加载 SQLite 扩展（DuckDB 1.x 需要显式加载才能 ATTACH SQLite）
        // 注意：INSTALL/LOAD 命令可能返回结果，使用 query 而不是 execute
        if conn.execute("LOAD sqlite;", &[]).is_err() {
            log::info!("[DuckDB] 直接 LOAD sqlite 失败，尝试 INSTALL...");
            
            // INSTALL 可能返回结果，使用 query 并忽略结果
            let _ = conn.query("INSTALL sqlite;", &[]);
            
            // LOAD 也可能返回结果
            let _ = conn.query("LOAD sqlite;", &[]);
        }

        // 1. ATTACH SQLite 数据库
        // 路径中的单引号需要转义（SQL 标准：' → ''），反斜杠不需要转义
        let sqlite_path_str = sqlite_path.to_string_lossy().replace("'", "''");
        let attach_sql = format!("ATTACH '{}' AS sqlite_db (TYPE SQLITE);", sqlite_path_str);

        conn.execute(&attach_sql, &[])
            .map_err(|e| format!("ATTACH SQLite 失败: {}", e))?;

        // 3. 为每个表创建 VIEW（表名从 SQLite 获取，不依赖 DuckDB 的元数据系统）
        let mut success_count = 0;
        for table_name in table_names {
            use crate::database::SqlIdentifier;
            
            // 验证表名安全
            if !SqlIdentifier::is_safe_identifier(table_name) {
                log::warn!("[DuckDB] 跳过不安全的表名: {}", table_name);
                continue;
            }
            
            // 创建 VIEW 的 SQL
            let quoted_table = SqlIdentifier::quote_identifier(table_name);
            let create_view_sql = format!(
                "CREATE OR REPLACE VIEW {} AS SELECT * FROM sqlite_db.{}",
                quoted_table,
                quoted_table
            );
            
            // 执行创建 VIEW
            if let Err(e) = conn.execute(&create_view_sql, &[]) {
                log::warn!("[DuckDB] 为表 '{}' 创建 VIEW 失败: {}", table_name, e);
            } else {
                log::debug!("[DuckDB] 为表 '{}' 成功创建 VIEW", table_name);
                success_count += 1;
            }
        }

        // 4. 设置其他配置
        conn.execute("SET preserve_insertion_order = false;", &[])
            .map_err(|e| format!("设置 DuckDB 配置失败: {}", e))?;

        // 5. 保存连接（内存模式不需要临时文件）
        *self.duckdb_conn.lock().map_err(|e| format!("获取锁失败: {}", e))? = Some(Arc::new(Mutex::new(conn)));

        log::info!(
            "[DuckDB] 初始化完成（内存模式），已 ATTACH SQLite 并创建 {}/{} 个 VIEW: {}",
            success_count, table_names.len(), sqlite_path.display()
        );
        Ok(())
    }

    fn get_duckdb_connection(&self) -> Result<Arc<Mutex<Box<dyn database::DatabaseConnection>>>, String> {
        // P0 优化：懒加载。只有当用户实际需要 DuckDB 时才初始化
        let needs_init = {
            let duckdb_opt = self.duckdb_conn.lock()
                .map_err(|e| format!("获取锁失败: {}", e))?;
            duckdb_opt.is_none()
        };

        if needs_init {
            let t0 = std::time::Instant::now();
            let db_path_guard = self.db_path.lock()
                .map_err(|e| format!("获取 db_path 锁失败: {}", e))?;
            let current_path = db_path_guard.clone();
            drop(db_path_guard);

            log::info!("[DuckDB] 首次使用，开始懒初始化...");

            // 从 SQLite 获取表名（不依赖 DuckDB 的元数据系统）
            let table_names = match self.db_manager.get_connection() {
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

            log::info!("[DuckDB] 从 SQLite 获取到 {} 个用户表", table_names.len());

            self.init_duckdb(&current_path, &table_names)
                .map_err(|e| format!("DuckDB 懒初始化失败: {}", e))?;
            let elapsed = t0.elapsed();
            let duration_ms = elapsed.as_millis() as i64;
            log::info!("[DuckDB] 懒初始化完成，耗时 {}ms", duration_ms);

            let app_handle_opt = self.app_handle.lock().ok().and_then(|g| g.clone());
            if let Some(app_handle) = app_handle_opt {
                let status = crate::models::DuckDbInitStatus {
                    success: true,
                    view_count: table_names.len() as i32,
                    total_tables: table_names.len() as i32,
                    duration_ms,
                    trigger: "lazy_load".to_string(),
                };
                let _ = app_handle.emit("duckdb_init_completed", status);
            }
        }

        let duckdb_opt = self.duckdb_conn.lock()
            .map_err(|e| format!("获取锁失败: {}", e))?;
        duckdb_opt.clone().ok_or_else(|| "DuckDB 连接未初始化".into())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 初始化日志（开发环境默认 info 级别，可通过 RUST_LOG 环境变量覆盖）
    let _ = env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .format_timestamp_millis()
        .try_init();

    // 保留一条 stdout 信号以便在终端直观观察到 Rust 端启动
    println!("[RUST] QuickerSQL 启动中...");
    let app_boot_t0 = std::time::Instant::now();
    tauri::Builder::default()
        .manage({
            log::info!("正在创建 TauriAppState...");
            let s = TauriAppState::new();
            log::info!("TauriAppState 创建完成");
            s
        })
        .invoke_handler(tauri::generate_handler![
            // 数据库命令
            commands::database::list_databases,
            commands::database::get_database_status,
            commands::database::get_all_database_status,
            commands::database::list_tables,
            commands::database::get_table_columns,
            commands::database::delete_table,
            commands::database::rename_table,
            commands::database::get_table_meta,
            commands::database::get_table_row_count,
            commands::database::get_duckdb_diagnostics,
            // 文件命令
            commands::file::load_csv,
            commands::file::load_txt,
            commands::file::load_parquet,
            commands::file::get_excel_sheets,
            commands::file::load_excel_sheet,
            commands::file::import_data_v2,
            commands::file::write_text_file,
            commands::file::get_file_metadata,
            // SQL 命令
            commands::sql::execute_sql,
            commands::sql::list_sql_snippets,
            commands::sql::get_sql_snippet,
            commands::sql::create_sql_snippet,
            commands::sql::update_sql_snippet,
            commands::sql::delete_sql_snippet,
            commands::sql::toggle_snippet_favorite,
            commands::sql::preload_duckdb,
            // 项目命令
            commands::project::create_project,
            commands::project::open_project,
            commands::project::list_projects,
            commands::project::delete_project,
            commands::project::rename_project,
            commands::project::switch_project,
            commands::project::open_database_from_path,
            commands::project::export_database,
            commands::project::get_current_db_path,
            commands::project::export_selected_projects,
            commands::project::duplicate_project,
            commands::project::import_project,
            commands::project::export_project,
            commands::project::get_current_project_id,
            // 回收站命令
            commands::trash::get_trash_list,
            commands::trash::move_to_trash,
            commands::trash::restore_from_trash,
            commands::trash::permanent_delete,
            // 查询历史命令
            commands::query_history::get_query_history,
            commands::query_history::record_query_history,
            commands::query_history::update_query_favorite,
            commands::query_history::delete_query_history,
            commands::query_history::cleanup_old_history,
            // 图表命令
            commands::chart::get_recommended_chart_types,
            commands::chart::generate_chart_config,
            commands::chart::save_chart_image,
            // 设置命令
            commands::settings::get_settings_meta_cmd,
            commands::settings::get_all_settings_cmd,
            commands::settings::get_setting_cmd,
            commands::settings::update_setting_cmd,
            commands::settings::batch_update_settings_cmd,
            commands::settings::reset_settings_cmd,
            commands::settings::export_settings_cmd,
            commands::settings::import_settings_cmd,
            // 审计日志命令
            commands::audit_log::record_audit_log_cmd,
            commands::audit_log::query_audit_logs_cmd,
            commands::audit_log::cleanup_expired_audit_logs_cmd,
            commands::audit_log::count_audit_logs_cmd,
            commands::audit_log::clear_all_audit_logs_cmd,
            // 应用状态命令
            commands::app_state::get_app_state_cmd,
            commands::app_state::get_app_states_by_category_cmd,
            commands::app_state::update_app_state_cmd,
            commands::app_state::save_workspace_cmd,
            commands::app_state::load_workspace_cmd,
            commands::app_state::restart_app,
            // 启动状态汇总命令（P0-2 优化：合并 5+ 次 IPC 为 1 次）
            commands::startup::get_startup_status,
            // 仪表盘命令
            commands::dashboard::get_saved_charts,
            commands::dashboard::create_saved_chart,
            commands::dashboard::update_saved_chart,
            commands::dashboard::delete_saved_chart,
            commands::dashboard::get_saved_query,
            commands::dashboard::get_dashboards,
            commands::dashboard::get_dashboard,
            commands::dashboard::create_dashboard,
            commands::dashboard::update_dashboard,
            commands::dashboard::delete_dashboard,
            commands::dashboard::add_chart_to_dashboard,
            commands::dashboard::update_dashboard_item,
            commands::dashboard::remove_chart_from_dashboard,
            commands::dashboard::save_dashboard_layout,
            commands::profile::profile_table,
            commands::profile::profile_result,
            // 自动化任务命令
            commands::sql::get_query_cache_stats,
            commands::sql::configure_query_cache,
            commands::sql::clear_query_cache,
            commands::automation::list_automation_tasks,
            commands::automation::get_automation_task,
            commands::automation::create_automation_task,
            commands::automation::update_automation_task,
            commands::automation::delete_automation_task,
            commands::automation::enable_automation_task,
            commands::automation::disable_automation_task,
            commands::automation::run_automation_task_now,
            commands::automation::get_automation_task_runs,
            commands::automation::ensure_automation_tables,
            commands::automation::list_task_dependencies,
            commands::automation::add_task_dependency,
            commands::automation::update_task_dependency,
            commands::automation::delete_task_dependency,
            commands::automation::replace_task_dependencies,
            // 启动辅助命令
            commands::startup::window_resize_to_main,
            commands::startup::get_startup_diagnostics,
        ])
        .plugin(tauri_plugin_dialog::init())
        .setup(move |app| {
            log::info!("setup hook 启动");

            // 保存 AppHandle 到状态，用于发送 DuckDB 初始化完成事件
            let handle = app.handle();
            let state: tauri::State<'_, TauriAppState> = handle.state();
            if let Ok(mut guard) = state.app_handle.lock() {
                *guard = Some(handle.clone());
            }

            // 启动自动化任务调度器（后台线程，应用关闭时通过 AtomicBool 停止）
            let db_manager = state.db_manager.clone();
            let shutdown = Arc::new(std::sync::atomic::AtomicBool::new(false));
            crate::services::TaskScheduleEngine::run_forever(db_manager, shutdown);
            log::info!("自动化任务调度器已启动（独立线程）");

            // ==== v13：用 WebviewWindowBuilder 代码驱动创建透明窗口 ====
            //
            // ★ 根因修复：tauri.conf.json 中的 backgroundColor: "#00000000"
            // 无法确保 WebView2 控件层面的背景完全透明。
            // WebView2 初始化时有默认白色背景，CSS 的 transparent 仅能
            // 覆盖 html/body/#root 元素，无法触及 WebView2 底层控件的默认底色。
            //
            // 解决方案：用代码显式调用 with_background_color(None) 让
            // Tauri 把 WebView2 的 DefaultBackgroundColor 设置为全透明，
            // 再配合 DwmExtendFrameIntoClientArea(-1) 消除 Win32 边框。
            let window = tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::default()
            )
                .title("QuickerSQL")
                .inner_size(400.0, 400.0)
                .center()
                .decorations(false)
                .transparent(true)
                .shadow(false)
                .resizable(false)
                // ★ 核心修复：显式告知 Tauri 让 WebView2 背景完全透明
                // Color(u8, u8, u8, u8) = (r, g, b, a)；a=0 表示完全透明
                .background_color(tauri::utils::config::Color(0, 0, 0, 0))
                .build()
                .map_err(|e| format!("创建主窗口失败: {}", e))?;

            // ==== 透明窗口边框消除（Win32 层面） ====
            #[cfg(windows)]
            {
                match window.hwnd() {
                    Ok(hwnd) => {
                        let hwnd_ptr = hwnd.0;
                        log::info!("[透明窗口] 获取到 HWND: {:?}, 立即应用 DWM 扩展帧", hwnd);
                        commands::startup::apply_borderless_to_hwnd(hwnd_ptr);
                    }
                    Err(e) => {
                        log::warn!("[透明窗口] 获取 HWND 失败: {}, 退化到 GetForegroundWindow", e);
                        commands::startup::apply_borderless();
                    }
                }
            }

            // 窗口置顶短时间（确保 splash 阶段可见）
            let _ = window.set_always_on_top(true);
            let w = window.clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(300));
                let _ = w.set_always_on_top(false);
            });

            // 延迟 150ms 二次边框消除（应对 webview 初始化后样式位回填）
            #[cfg(windows)]
            {
                let w2 = window.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(150));
                    if let Ok(hwnd) = w2.hwnd() {
                        let hwnd_ptr = hwnd.0;
                        // P2-2: 二次应用使用 silent 变体（日志降级到 debug），避免启动时重复 info 日志
                        commands::startup::apply_borderless_to_hwnd_reapply(hwnd_ptr);
                        log::debug!("[透明窗口] 延迟二次边框消除完成");
                    }
                });
            }

            match window.url() {
                Ok(url) => {
                    let elapsed = app_boot_t0.elapsed();
                    log::info!(
                        "[启动计时] webview 窗口已启动，URL: {}（距 Rust 启动 {:.2} ms）",
                        url,
                        elapsed.as_secs_f64() * 1000.0
                    );
                }
                Err(e) => log::warn!("webview 窗口 URL 获取失败: {}", e),
            }

            Ok(())
        })
        // 安全理由：Tauri 应用运行时若失败则程序无法继续执行，此处 panic 是合理的
        // 这是应用主入口点，运行失败属于致命错误，应当立即终止并报错
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
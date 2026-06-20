use std::path::PathBuf;
use std::sync::{Mutex, Arc};

pub mod database;
pub mod services;
pub mod models;
pub mod commands;
pub mod utils;

use services::ProjectService;
use database::{DatabaseManager, SqliteDriver, DuckDbDriver, DatabaseError, SharedDatabaseManager};
use database::traits::DatabaseDriver;
use tauri::Manager;

// 类型从 models/database.rs 导入
pub use models::database::{DatabaseStatus, SqlStatementResult, BatchExecuteResult, ProjectInfo, SheetInfo, ExcelPreview, CsvPreview, FieldMeta, ImportRequest, ImportRequestV2, DatabaseInfo, TableInfo, ColumnInfo};

pub struct TauriAppState {
    db_manager: SharedDatabaseManager,
    db_path: Mutex<PathBuf>,
    duckdb_conn: Mutex<Option<Arc<Mutex<Box<dyn database::DatabaseConnection>>>>>,
    temp_file: Mutex<Option<tempfile::NamedTempFile>>,
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

        let db_path = match ProjectService::get_default_db_path() {
            Ok(path) => path,
            Err(_) => std::env::temp_dir().join("quickersql_temp.db"),
        };
        let t2 = std::time::Instant::now();

        let manager = Arc::new(db_manager);
        let state = TauriAppState {
            db_manager: manager.clone(),
            db_path: Mutex::new(db_path.clone()),
            duckdb_conn: Mutex::new(None),
            temp_file: Mutex::new(None),
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
            let ensure_fns: &[(fn(&crate::database::MutexGuardConnection<'_>) -> Result<(), String>, &str)] = &[
                (crate::services::AuditLogService::ensure_audit_log_table_exists, "审计日志表"),
                (crate::services::TrashService::ensure_trash_table_exists, "回收站表"),
                (crate::services::SettingsService::ensure_settings_table_exists, "设置表"),
                (crate::services::QueryHistoryService::ensure_query_history_table_exists, "查询历史表"),
                (crate::services::TaskService::ensure_tables_exists, "自动化任务表"),
                (crate::services::DashboardService::ensure_tables_exist, "仪表盘/图表表"),
                (crate::services::AppStateService::ensure_app_state_table_exists, "应用状态表"),
                (crate::services::AppStateService::ensure_workspace_tables_exist, "工作区表"),
            ];

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
        }
        let t4 = std::time::Instant::now();

        log::info!(
            "[启动计时] TauriAppState 总耗时: {:.2} ms (DB driver: {:.2} | path: {:.2} | SQLite connect: {:.2} | 系统表 init: {:.2})",
            (t4 - t0).as_secs_f64() * 1000.0,
            (t1 - t0).as_secs_f64() * 1000.0,
            (t2 - t1).as_secs_f64() * 1000.0,
            (t3 - t2).as_secs_f64() * 1000.0,
            (t4 - t3).as_secs_f64() * 1000.0
        );
        log::info!("[启动计时] DuckDB 已推迟到首次使用时懒加载（用户首次 SQL 时才启动）");

        state
    }

    fn connect_default_db(db_manager: &SharedDatabaseManager, db_path: &PathBuf) -> Result<(), String> {
        match db_manager.connect("sqlite", db_path) {
            Ok(_) => Ok(()),
            Err(DatabaseError::FileNotFound) => {
                db_manager.create_and_connect("sqlite", db_path).map_err(|e| e.to_string())
            }
            Err(e) => Err(e.to_string()),
        }
    }

    fn set_db_path(&self, new_path: PathBuf) -> Result<(), String> {
        // 1. 清理旧的连接和临时文件
        {
            let mut duckdb_guard = self.duckdb_conn.lock()
                .map_err(|e| format!("获取连接锁失败: {}", e))?;
            let mut temp_guard = self.temp_file.lock()
                .map_err(|e| format!("获取临时文件锁失败: {}", e))?;
            
            *duckdb_guard = None;
            *temp_guard = None;
        }
        
        // 2. 更新路径
        let mut path = self.db_path.lock().map_err(|e| format!("获取路径锁失败: {}", e))?;
        *path = new_path.clone();
        drop(path);

        // 3. 初始化新连接
        match self.init_duckdb(&new_path) {
            Ok(_) => Ok(()),
            Err(e) => {
                log::warn!("初始化 DuckDB 失败: {}, 将继续使用 SQLite", e);
                // 确保清理
                {
                    let mut duckdb_guard = self.duckdb_conn.lock()
                        .map_err(|e| format!("获取连接锁失败: {}", e))?;
                    let mut temp_guard = self.temp_file.lock()
                        .map_err(|e| format!("获取临时文件锁失败: {}", e))?;
                    *duckdb_guard = None;
                    *temp_guard = None;
                }
                Ok(())
            }
        }
    }

    fn init_duckdb(&self, sqlite_path: &PathBuf) -> Result<(), String> {
        use tempfile::NamedTempFile;

        let temp_file = NamedTempFile::new()
            .map_err(|e| format!("创建临时文件失败: {}", e))?;
        let driver = DuckDbDriver::new();

        let conn = driver.create_database(temp_file.path())
            .map_err(|e| format!("创建 DuckDB 连接失败: {}", e))?;

        // 1. ATTACH SQLite 数据库
        let sqlite_path_str = sqlite_path.to_string_lossy().replace("\\", "\\\\");
        let attach_sql = format!("ATTACH '{}' AS sqlite_db (TYPE SQLITE);", sqlite_path_str);

        conn.execute(&attach_sql, &[])
            .map_err(|e| format!("ATTACH SQLite 失败: {}", e))?;

        // 2. 获取所有表名
        let get_tables_sql = "
            SELECT name 
            FROM sqlite_db.sqlite_master 
            WHERE type='table' 
            AND name NOT LIKE 'sqlite_%'
            AND name NOT LIKE 'duckdb_%'
        ";
        
        let table_names: Vec<String> = match conn.query(get_tables_sql, &[]) {
            Ok(result) => result.rows.into_iter()
                .filter(|row| !row.is_empty())
                .map(|row| row[0].clone())
                .collect(),
            Err(e) => {
                log::warn!("获取表名失败: {}", e);
                Vec::new()
            }
        };

        // 3. 为每个表创建 VIEW
        let mut success_count = 0;
        for table_name in &table_names {
            use crate::database::SqlIdentifier;
            
            // 验证表名安全
            if !SqlIdentifier::is_safe_identifier(table_name) {
                log::warn!("跳过不安全的表名: {}", table_name);
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
                log::warn!("为表 '{}' 创建 VIEW 失败: {}", table_name, e);
            } else {
                log::debug!("为表 '{}' 成功创建 VIEW", table_name);
                success_count += 1;
            }
        }

        // 4. 设置其他配置
        conn.execute("SET preserve_insertion_order = false;", &[])
            .map_err(|e| format!("设置 DuckDB 配置失败: {}", e))?;

        // 5. 保存临时文件和连接
        *self.temp_file.lock().map_err(|e| format!("获取锁失败: {}", e))? = Some(temp_file);
        *self.duckdb_conn.lock().map_err(|e| format!("获取锁失败: {}", e))? = Some(Arc::new(Mutex::new(conn)));

        log::info!(
            "DuckDB 初始化完成，已 ATTACH SQLite 并创建 {}/{} 个 VIEW: {}",
            success_count, table_names.len(), sqlite_path.display()
        );
        Ok(())
    }

    fn get_duckdb_connection(&self) -> Result<Arc<Mutex<Box<dyn database::DatabaseConnection>>>, String> {
        // P0 优化：懒加载。只有当用户实际需要 DuckDB 时才初始化
        let duckdb_opt = self.duckdb_conn.lock()
            .map_err(|e| format!("获取锁失败: {}", e))?;

        if duckdb_opt.is_none() {
            let t0 = std::time::Instant::now();
            let db_path_guard = self.db_path.lock()
                .map_err(|e| format!("获取 db_path 锁失败: {}", e))?;
            let current_path = db_path_guard.clone();
            drop(db_path_guard);

            log::info!("[DuckDB] 首次使用，开始懒初始化...");
            self.init_duckdb(&current_path)
                .map_err(|e| format!("DuckDB 懒初始化失败: {}", e))?;
            let elapsed = t0.elapsed();
            log::info!("[DuckDB] 懒初始化完成，耗时 {:.2} ms", elapsed.as_secs_f64() * 1000.0);

            // 重新获取（init_duckdb 已写入 duckdb_conn）
            let refreshed = self.duckdb_conn.lock()
                .map_err(|e| format!("获取锁失败: {}", e))?;
            if let Some(conn) = &*refreshed {
                return Ok(conn.clone());
            }
            return Err("DuckDB 连接初始化后为空".into());
        }

        duckdb_opt.clone().ok_or_else(|| "DuckDB 连接未初始化".into())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
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
            // 文件命令
            commands::file::load_csv,
            commands::file::get_excel_sheets,
            commands::file::load_excel_sheet,
            commands::file::import_data,
            commands::file::import_data_v2,
            commands::file::write_text_file,
            // SQL 命令
            commands::sql::execute_sql,
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
            // 自动化任务命令
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
        ])
        .plugin(tauri_plugin_dialog::init())
        .setup(move |app| {
            log::info!("setup hook 启动");
            // 启动自动化任务调度器（后台线程，应用关闭时通过 AtomicBool 停止）
            // P0 优化：调度器独立线程，不阻塞窗口第一帧显示
            let handle = app.handle();
            let state: tauri::State<'_, TauriAppState> = handle.state();
            let db_manager = state.db_manager.clone();
            let shutdown = Arc::new(std::sync::atomic::AtomicBool::new(false));
            crate::services::TaskScheduleEngine::run_forever(db_manager, shutdown);
            log::info!("自动化任务调度器已启动（独立线程）");

            if let Some(window) = app.get_webview_window("main") {
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
            } else {
                let elapsed = app_boot_t0.elapsed();
                log::warn!(
                    "未找到 webview 窗口名为 'main'（距 Rust 启动 {:.2} ms），可能尚未完成初始化",
                    elapsed.as_secs_f64() * 1000.0
                );
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
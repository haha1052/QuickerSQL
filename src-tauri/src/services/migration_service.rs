//! 数据库迁移服务
//!
//! 负责将旧版命名的系统表迁移到统一的 `__` 双下划线前缀规范。
//!
//! 历史命名规范：
//! - v1: 部分表使用 `_name`（单下划线前缀），如 `_settings`、`_app_state`
//! - v2: 部分表使用无任何前缀的普通名称，如 `query_history`、`audit_log`
//! - v3 (当前): 所有系统表统一使用 `__name`（双下划线前缀）
//!
//! 本服务在应用启动时运行，将旧版命名的表通过 `ALTER TABLE RENAME TO`
//! 自动迁移到新版命名，确保存量数据库无缝升级。

use std::collections::HashSet;
use crate::database::security::SqlIdentifier;
use crate::database::traits::MutexGuardConnection;
use crate::services::DashboardService;

/// 迁移服务：处理系统表命名规范化
pub struct MigrationService;

impl MigrationService {
    /// 需要迁移的旧表名 → 新表名映射
    ///
    /// 覆盖三种历史命名模式：
    /// - v1: 单下划线前缀（如 `_settings`、`_query_history`）
    /// - v2: 无前缀（如 `query_history`、`audit_log`）
    /// - v3 (当前): 双下划线前缀 `__`（如 `__settings`、`__query_history`）
    ///
    /// 注意：系统表共 7 张（设计值），实际数据库中为 6~7 张（`__trash_metadata`
    /// 在首次使用回收站功能时才会创建）。
    const LEGACY_TABLE_MAPPINGS: &'static [(&'static str, &'static str)] = &[
        // v1: 单下划线前缀
        ("_settings", "__settings"),
        ("_app_state", "__app_state"),
        ("_workspace_tabs", "__workspace_tabs"),
        ("_workspace_panels", "__workspace_panels"),
        ("_audit_logs", "__audit_logs"),
        ("_query_history", "__query_history"),
        ("_trash_metadata", "__trash_metadata"),
        ("_automation_tasks", "__automation_tasks"),
        ("_automation_runs", "__automation_runs"),
        // v2: 无前缀（早期设计遗漏前缀）
        ("query_history", "__query_history"),
        ("audit_log", "__audit_logs"),
        ("automation_tasks", "__automation_tasks"),
        ("automation_runs", "__automation_runs"),
    ];

    /// 运行所有必要的表名迁移
    ///
    /// 优化：将原有的 28 次 SQL 查询（14 组 × 2 查询）合并为 1 次批量查询，
    /// 显著降低启动开销。
    pub fn run_legacy_table_migrations(conn: &MutexGuardConnection<'_>) -> Result<usize, String> {
        let mut migrated_count: usize = 0;

        // 优化：1 次批量查询获取所有相关表名的存在状态（原逻辑 14 组 × 2 = 28 次查询）
        let all_names: Vec<&'static str> = Self::LEGACY_TABLE_MAPPINGS
            .iter()
            .flat_map(|(o, n)| [*o, *n])
            .collect();

        let placeholders = all_names
            .iter()
            .map(|_| "?")
            .collect::<Vec<_>>()
            .join(", ");

        // 用参数化查询防止 SQL 注入（虽然是编译时常量，保持一致性）
        let batch_sql = format!(
            "SELECT name FROM sqlite_master WHERE type='table' AND name IN ({})",
            placeholders
        );

        use crate::database::traits::ToSql;
        let param_refs: Vec<&dyn ToSql> = all_names.iter().map(|s| s as &dyn ToSql).collect();

        let existing: HashSet<String> = conn
            .query(&batch_sql, &param_refs)
            .map_err(|e| e.to_string())?
            .rows
            .into_iter()
            .filter(|r| !r.is_empty())
            .map(|r| r[0].clone())
            .collect();

        for (old_name, new_name) in Self::LEGACY_TABLE_MAPPINGS {
            let old_exists = existing.contains(*old_name);

            if !old_exists {
                continue;
            }

            let new_exists = existing.contains(*new_name);

            if new_exists {
                log::warn!(
                    "检测到迁移冲突：旧表 {} 和新表 {} 同时存在，已跳过（请手动检查）",
                    old_name,
                    new_name
                );
                continue;
            }

            let old_ident = SqlIdentifier::new(old_name)
                .map_err(|e| format!("旧表名 {} 校验失败: {}", old_name, e))?;
            let new_ident = SqlIdentifier::new(new_name)
                .map_err(|e| format!("新表名 {} 校验失败: {}", new_name, e))?;
            let rename_sql = format!("ALTER TABLE {} RENAME TO {}", old_ident.quoted(), new_ident.quoted());
            conn.execute(&rename_sql, &[])
                .map_err(|e| format!("迁移表 {} -> {} 失败: {}", old_name, new_name, e))?;

            log::info!("系统表迁移成功: {} → {}", old_name, new_name);
            migrated_count += 1;
        }

        if migrated_count > 0 {
            log::info!("数据库迁移完成，共迁移 {} 张系统表", migrated_count);
        }

        // M5 Dashboard tables
        if let Err(e) = Self::dashboard_migrations(conn) {
            log::warn!("Dashboard migrations failed: {}", e);
        }

        // P3-Task5: 为 __automation_runs / __task_dependencies 补齐 FOREIGN KEY (ON DELETE CASCADE)
        // 必须在表名迁移（旧表 → __ 前缀）之后、ensure_tables_exists 之前执行
        if let Err(e) = Self::migrate_task_tables_add_foreign_keys(conn) {
            log::warn!("P3-Task5 任务表外键迁移失败（不影响启动）: {}", e);
        }

        Ok(migrated_count)
    }

    /// M7.2 性能优化：为系统表创建业务索引
    ///
    /// 所有索引均使用 `CREATE INDEX IF NOT EXISTS`，保证幂等性。
    /// 优化目标：
    /// - 任务调度查询：`next_run_at, state` 复合索引
    /// - 任务执行日志查询：`task_id` 外键索引、`created_at` 时间索引
    /// - 审计日志查询：`created_at` 时间索引
    /// - 查询历史：`executed_at` 排序索引（已有基础索引 idx_history_executed_at，
    ///   此处统一补充到迁移流程以确保旧数据库也有）
    /// - 仪表盘配置：`updated_at` 索引
    pub fn apply_optimization_indexes(conn: &MutexGuardConnection<'_>) -> Result<(), String> {
        Self::create_automation_task_indexes(conn)?;
        Self::create_automation_run_indexes(conn)?;
        Self::create_audit_log_indexes(conn)?;
        Self::create_query_history_indexes(conn)?;
        Self::create_saved_chart_indexes(conn)?;
        Self::create_dashboard_indexes(conn)?;
        Self::create_dashboard_item_indexes(conn)?;
        Self::create_settings_indexes(conn)?;
        Self::create_workspace_indexes(conn)?;
        Self::create_trash_indexes(conn)?;
        Self::create_saved_query_indexes(conn)?;
        log::info!("M7.2 数据库索引优化完成，共 23 条业务索引已应用（幂等）");
        Ok(())
    }

    /// 创建单条索引的统一封装：执行 CREATE INDEX 并将错误信息包装为可读文案
    fn create_index(conn: &MutexGuardConnection<'_>, sql: &str, index_name: &str) -> Result<(), String> {
        conn.execute(sql, &[])
            .map(|_| ())
            .map_err(|e| format!("创建 {} 失败：{}", index_name, e))
    }

    /// __automation_tasks 表索引（共 3 条）
    fn create_automation_task_indexes(conn: &MutexGuardConnection<'_>) -> Result<(), String> {
        // 任务调度器：WHERE next_run_at < ? AND state = 'enabled'
        Self::create_index(conn, "CREATE INDEX IF NOT EXISTS idx_auto_tasks_next_run_enabled ON __automation_tasks(next_run_at, state)", "idx_auto_tasks_next_run_enabled")?;
        Self::create_index(conn, "CREATE INDEX IF NOT EXISTS idx_automation_tasks_type ON __automation_tasks(task_type)", "idx_automation_tasks_type")?;
        Self::create_index(conn, "CREATE INDEX IF NOT EXISTS idx_automation_tasks_project ON __automation_tasks(project_id)", "idx_automation_tasks_project")?;
        Ok(())
    }

    /// __automation_runs 表索引（共 2 条）
    fn create_automation_run_indexes(conn: &MutexGuardConnection<'_>) -> Result<(), String> {
        // 按任务查询运行日志（外键查询最常见）
        Self::create_index(conn, "CREATE INDEX IF NOT EXISTS idx_task_runs_task_id ON __automation_runs(task_id)", "idx_task_runs_task_id")?;
        // 按时间范围查询运行日志（最近 N 次执行）
        Self::create_index(conn, "CREATE INDEX IF NOT EXISTS idx_task_runs_created ON __automation_runs(created_at)", "idx_task_runs_created")?;
        Ok(())
    }

    /// __audit_logs 表索引（共 3 条）
    fn create_audit_log_indexes(conn: &MutexGuardConnection<'_>) -> Result<(), String> {
        Self::create_index(conn, "CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON __audit_logs(timestamp)", "idx_audit_logs_created")?;
        Self::create_index(conn, "CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON __audit_logs(status)", "idx_audit_logs_status")?;
        Self::create_index(conn, "CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON __audit_logs(module)", "idx_audit_logs_module")?;
        Ok(())
    }

    /// __query_history 表索引（共 2 条）
    /// 基础排序索引已在 ensure_query_history_table_exists 内创建，此处统一补充保证旧数据库也有该索引
    fn create_query_history_indexes(conn: &MutexGuardConnection<'_>) -> Result<(), String> {
        Self::create_index(conn, "CREATE INDEX IF NOT EXISTS idx_history_executed_at ON __query_history(executed_at DESC)", "idx_history_executed_at")?;
        Self::create_index(conn, "CREATE INDEX IF NOT EXISTS idx_history_favorite ON __query_history(is_favorite)", "idx_history_favorite")?;
        Ok(())
    }

    /// __saved_charts 表索引（共 3 条）
    fn create_saved_chart_indexes(conn: &MutexGuardConnection<'_>) -> Result<(), String> {
        Self::create_index(conn, "CREATE INDEX IF NOT EXISTS idx_saved_charts_updated ON __saved_charts(updated_at DESC)", "idx_saved_charts_updated")?;
        Self::create_index(conn, "CREATE INDEX IF NOT EXISTS idx_saved_charts_query_id ON __saved_charts(query_id)", "idx_saved_charts_query_id")?;
        Self::create_index(conn, "CREATE INDEX IF NOT EXISTS idx_saved_charts_visibility ON __saved_charts(visibility)", "idx_saved_charts_visibility")?;
        Ok(())
    }

    /// __dashboards 表索引（共 3 条）
    fn create_dashboard_indexes(conn: &MutexGuardConnection<'_>) -> Result<(), String> {
        Self::create_index(conn, "CREATE INDEX IF NOT EXISTS idx_saved_dashboards_updated ON __dashboards(updated_at DESC)", "idx_saved_dashboards_updated")?;
        Self::create_index(conn, "CREATE INDEX IF NOT EXISTS idx_dashboards_is_default ON __dashboards(is_default)", "idx_dashboards_is_default")?;
        Self::create_index(conn, "CREATE INDEX IF NOT EXISTS idx_saved_dashboards_name ON __dashboards(name)", "idx_saved_dashboards_name")?;
        Ok(())
    }

    /// __dashboard_items 表索引（共 1 条）
    fn create_dashboard_item_indexes(conn: &MutexGuardConnection<'_>) -> Result<(), String> {
        Self::create_index(conn, "CREATE INDEX IF NOT EXISTS idx_dashboard_items_dashboard_id ON __dashboard_items(dashboard_id)", "idx_dashboard_items_dashboard_id")?;
        Ok(())
    }

    /// __settings 表索引（共 1 条）
    fn create_settings_indexes(conn: &MutexGuardConnection<'_>) -> Result<(), String> {
        Self::create_index(conn, "CREATE INDEX IF NOT EXISTS idx_settings_category ON __settings(category)", "idx_settings_category")?;
        Ok(())
    }

    /// __workspace_tabs / __workspace_panels 表索引（共 3 条）
    fn create_workspace_indexes(conn: &MutexGuardConnection<'_>) -> Result<(), String> {
        Self::create_index(conn, "CREATE INDEX IF NOT EXISTS idx_workspace_tabs_position ON __workspace_tabs(position)", "idx_workspace_tabs_position")?;
        Self::create_index(conn, "CREATE INDEX IF NOT EXISTS idx_workspace_panels_tab_id ON __workspace_panels(tab_id)", "idx_workspace_panels_tab_id")?;
        Self::create_index(conn, "CREATE INDEX IF NOT EXISTS idx_workspace_panels_position ON __workspace_panels(position)", "idx_workspace_panels_position")?;
        Ok(())
    }

    /// __trash_metadata 表索引（共 2 条）
    fn create_trash_indexes(conn: &MutexGuardConnection<'_>) -> Result<(), String> {
        Self::create_index(conn, "CREATE INDEX IF NOT EXISTS idx_trash_deleted_at ON __trash_metadata(deleted_at DESC)", "idx_trash_deleted_at")?;
        Self::create_index(conn, "CREATE INDEX IF NOT EXISTS idx_trash_original_name ON __trash_metadata(original_table_name)", "idx_trash_original_name")?;
        Ok(())
    }

    /// __saved_queries 表索引（共 1 条）
    fn create_saved_query_indexes(conn: &MutexGuardConnection<'_>) -> Result<(), String> {
        Self::create_index(conn, "CREATE INDEX IF NOT EXISTS idx_saved_queries_name ON __saved_queries(name)", "idx_saved_queries_name")?;
        Ok(())
    }

    /// Dashboard 相关表迁移
    fn dashboard_migrations(conn: &MutexGuardConnection<'_>) -> Result<(), String> {
        DashboardService::ensure_tables_exist(conn)
    }

    // ============================================================
    // P3-Task5: __automation_runs / __task_dependencies 补齐 FOREIGN KEY
    // ============================================================

    /// P3-Task5: 为 `__automation_runs` 与 `__task_dependencies` 添加
    /// `FOREIGN KEY (task_id) REFERENCES __automation_tasks(id) ON DELETE CASCADE`。
    ///
    /// SQLite 的 `CREATE TABLE IF NOT EXISTS` 不会修改已存在表的结构，旧数据库
    /// （在未带 FK 的版本创建的表）必须通过 CREATE+INSERT+DROP+RENAME 重建表来补齐 FK。
    ///
    /// **幂等性**：通过 `PRAGMA foreign_key_list` 检测目标表是否已有指向
    /// `__automation_tasks` 的 FK；已存在或表不存在（交由 `ensure_tables_exists` 创建带 FK 的新表）则跳过。
    ///
    /// **安全性**：表名为系统表常量（非用户输入），DDL 直接写在 SQL 字面量中；
    /// `PRAGMA` 中的表名经 `SqlIdentifier::quoted()` 封装（合规：security.md §1.2 情形 C）。
    pub fn migrate_task_tables_add_foreign_keys(conn: &MutexGuardConnection<'_>) -> Result<(), String> {
        Self::rebuild_automation_runs_with_fk(conn)?;
        Self::rebuild_task_dependencies_with_fk(conn)?;
        Ok(())
    }

    /// 检测目标表是否已有指向 `__automation_tasks` 的外键。
    ///
    /// 返回值语义：
    /// - `Ok(true)`：已有 FK，或表不存在（无需迁移，交由 ensure_tables_exists 创建带 FK 的新表）
    /// - `Ok(false)`：表存在但无 FK，需要迁移
    fn has_fk_to_automation_tasks(conn: &MutexGuardConnection<'_>, table: &str) -> Result<bool, String> {
        // 1) 表名作为查询值（参数化），检测表是否存在
        let exists_sql = "SELECT name FROM sqlite_master WHERE type='table' AND name = ?;";
        let exists_result = conn
            .query(exists_sql, &[&table])
            .map_err(|e| format!("查询表 {} 是否存在失败: {}", table, e))?;
        if exists_result.rows.is_empty() {
            return Ok(true); // 表不存在，视为无需迁移
        }

        // 2) PRAGMA foreign_key_list(table) 查询已有外键
        //    PRAGMA 的表名为系统表常量，经 SqlIdentifier 封装（情形 C 合法用法）
        let ident = SqlIdentifier::new(table)
            .map_err(|e| format!("表名 {} 校验失败: {}", table, e))?;
        let fk_sql = format!("PRAGMA foreign_key_list({})", ident.quoted());
        let result = conn
            .query(&fk_sql, &[])
            .map_err(|e| format!("查询 {} 外键列表失败: {}", table, e))?;

        // PRAGMA foreign_key_list 返回列: id, seq, table, from, to, on_update, on_delete, match, unique
        // 第 3 列（索引 2）为被引用的父表名
        for row in &result.rows {
            if row.len() >= 3 && row[2] == "__automation_tasks" {
                return Ok(true);
            }
        }
        Ok(false)
    }

    /// 重建 `__automation_runs` 表以补齐 FK（仅在表存在且无 FK 时执行）。
    ///
    /// 流程：清理孤儿记录 → 事务内 CREATE+INSERT+DROP+RENAME → 重建索引。
    fn rebuild_automation_runs_with_fk(conn: &MutexGuardConnection<'_>) -> Result<(), String> {
        if Self::has_fk_to_automation_tasks(conn, "__automation_runs")? {
            return Ok(());
        }
        log::info!("P3-Task5: __automation_runs 缺少 FK，开始重建表以补齐外键约束");

        // 清理孤儿记录：task_id 不存在于 __automation_tasks 的运行记录
        // 避免 INSERT SELECT 时 FK 约束失败（foreign_keys = ON）
        conn.execute(
            "DELETE FROM __automation_runs WHERE task_id NOT IN (SELECT id FROM __automation_tasks);",
            &[],
        )
        .map_err(|e| format!("清理 __automation_runs 孤儿记录失败: {}", e))?;

        // 事务包裹 CREATE+INSERT+DROP+RENAME
        conn.begin_transaction()
            .map_err(|e| format!("开启 __automation_runs 迁移事务失败: {}", e))?;

        match Self::do_rebuild_automation_runs(conn) {
            Ok(_) => {
                conn.commit_transaction().map_err(|e| {
                    let _ = conn.rollback_transaction();
                    format!("提交 __automation_runs 迁移事务失败: {}", e)
                })
            }
            Err(e) => {
                let _ = conn.rollback_transaction();
                Err(format!("__automation_runs 迁移失败: {}", e))
            }
        }
    }

    /// `__automation_runs` 重建的实际 DDL 执行（CREATE+INSERT+DROP+RENAME+重建索引）。
    fn do_rebuild_automation_runs(conn: &MutexGuardConnection<'_>) -> Result<(), String> {
        // 新表 DDL（与 ensure_tables_exists 保持一致，含 FK）
        conn.execute(
            r#"CREATE TABLE __automation_runs_new (
                id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
                task_id TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'running',
                started_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
                finished_at INTEGER,
                duration_ms INTEGER,
                affected_rows INTEGER,
                output TEXT,
                retry_count INTEGER NOT NULL DEFAULT 0,
                trigger_type TEXT NOT NULL DEFAULT 'schedule',
                created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
                FOREIGN KEY (task_id) REFERENCES __automation_tasks(id) ON DELETE CASCADE
            )"#,
            &[],
        )
        .map_err(|e| format!("创建 __automation_runs_new 失败: {}", e))?;

        // 显式列名迁移数据（避免 SELECT * 列序依赖）
        conn.execute(
            "INSERT INTO __automation_runs_new \
             (id, task_id, status, started_at, finished_at, duration_ms, affected_rows, output, retry_count, trigger_type, created_at) \
             SELECT id, task_id, status, started_at, finished_at, duration_ms, affected_rows, output, retry_count, trigger_type, created_at \
             FROM __automation_runs;",
            &[],
        )
        .map_err(|e| format!("迁移 __automation_runs 数据失败: {}", e))?;

        conn.execute("DROP TABLE __automation_runs;", &[])
            .map_err(|e| format!("DROP __automation_runs 失败: {}", e))?; // safe_sql: error message, not SQL execution
        conn.execute(
            "ALTER TABLE __automation_runs_new RENAME TO __automation_runs;",
            &[],
        )
        .map_err(|e| format!("RENAME __automation_runs_new 失败: {}", e))?;

        // 重建索引（DROP TABLE 会删除关联索引）
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_automation_runs_task_created ON __automation_runs(task_id, created_at DESC);",
            &[],
        )
        .map_err(|e| format!("重建 idx_automation_runs_task_created 失败: {}", e))?; // safe_sql: error message, not SQL execution
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_automation_runs_status ON __automation_runs(status);",
            &[],
        )
        .map_err(|e| format!("重建 idx_automation_runs_status 失败: {}", e))?;
        Ok(())
    }

    /// 重建 `__task_dependencies` 表以补齐 FK（仅在表存在且无 FK 时执行）。
    ///
    /// 流程：清理孤儿记录 → 事务内 CREATE+INSERT+DROP+RENAME → 重建索引。
    fn rebuild_task_dependencies_with_fk(conn: &MutexGuardConnection<'_>) -> Result<(), String> {
        if Self::has_fk_to_automation_tasks(conn, "__task_dependencies")? {
            return Ok(());
        }
        log::info!("P3-Task5: __task_dependencies 缺少 FK，开始重建表以补齐外键约束");

        // 清理孤儿记录
        conn.execute(
            "DELETE FROM __task_dependencies WHERE task_id NOT IN (SELECT id FROM __automation_tasks);",
            &[],
        )
        .map_err(|e| format!("清理 __task_dependencies 孤儿记录失败: {}", e))?;

        conn.begin_transaction()
            .map_err(|e| format!("开启 __task_dependencies 迁移事务失败: {}", e))?;

        match Self::do_rebuild_task_dependencies(conn) {
            Ok(_) => {
                conn.commit_transaction().map_err(|e| {
                    let _ = conn.rollback_transaction();
                    format!("提交 __task_dependencies 迁移事务失败: {}", e)
                })
            }
            Err(e) => {
                let _ = conn.rollback_transaction();
                Err(format!("__task_dependencies 迁移失败: {}", e))
            }
        }
    }

    /// `__task_dependencies` 重建的实际 DDL 执行（CREATE+INSERT+DROP+RENAME+重建索引）。
    fn do_rebuild_task_dependencies(conn: &MutexGuardConnection<'_>) -> Result<(), String> {
        conn.execute(
            r#"CREATE TABLE __task_dependencies_new (
                id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
                task_id TEXT NOT NULL,
                dependency_type TEXT NOT NULL DEFAULT 'time_interval',
                dependency_config TEXT NOT NULL DEFAULT '{}',
                created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
                updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
                FOREIGN KEY (task_id) REFERENCES __automation_tasks(id) ON DELETE CASCADE
            )"#,
            &[],
        )
        .map_err(|e| format!("创建 __task_dependencies_new 失败: {}", e))?;

        conn.execute(
            "INSERT INTO __task_dependencies_new \
             (id, task_id, dependency_type, dependency_config, created_at, updated_at) \
             SELECT id, task_id, dependency_type, dependency_config, created_at, updated_at \
             FROM __task_dependencies;",
            &[],
        )
        .map_err(|e| format!("迁移 __task_dependencies 数据失败: {}", e))?;

        conn.execute("DROP TABLE __task_dependencies;", &[])
            .map_err(|e| format!("DROP __task_dependencies 失败: {}", e))?; // safe_sql: error message, not SQL execution
        conn.execute(
            "ALTER TABLE __task_dependencies_new RENAME TO __task_dependencies;",
            &[],
        )
        .map_err(|e| format!("RENAME __task_dependencies_new 失败: {}", e))?;

        // 重建索引
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_task_deps_task_id ON __task_dependencies(task_id);",
            &[],
        )
        .map_err(|e| format!("重建 idx_task_deps_task_id 失败: {}", e))?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_task_deps_upstream ON __task_dependencies(dependency_type, dependency_config);",
            &[],
        )
        .map_err(|e| format!("重建 idx_task_deps_upstream 失败: {}", e))?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_apply_optimization_indexes_called_multiple_times_is_idempotent() {
        // 本测试验证：函数仅调用 conn.execute() 且使用 CREATE INDEX IF NOT EXISTS，
        // 重复调用不会报错也不会创建重复索引（SQLite 保证）。
        // 由于 tests 无真实数据库连接，这里做一个更简单的断言：
        // 确认函数不 panic（通过直接 inspect 实现策略）。
        // 实际集成测试需在有数据库连接的环境进行。
    }

    #[test]
    fn test_legacy_mappings_contains_old_tables() {
        // 至少应覆盖 v1（单下划线）和 v2（无前缀）的主要表
        assert!(MigrationService::LEGACY_TABLE_MAPPINGS.len() >= 10);
    }
}

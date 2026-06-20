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
    /// 对每个 `(旧表名, 新表名)` 映射：
    /// - 如果旧表存在且新表不存在 → `ALTER TABLE 旧表 RENAME TO 新表`
    /// - 如果旧表和新表都存在 → 保留新表，不做操作（避免数据丢失）
    /// - 如果旧表不存在 → 跳过（已经是新版或从未创建）
    ///
    /// 返回：成功迁移的表数量
    pub fn run_legacy_table_migrations(conn: &MutexGuardConnection<'_>) -> Result<usize, String> {
        let mut migrated_count: usize = 0;

        for (old_name, new_name) in Self::LEGACY_TABLE_MAPPINGS {
            // 检查旧表是否存在
            let check_old_sql = format!(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='{}'",
                old_name
            );
            let old_exists = Self::query_count(conn, &check_old_sql)? > 0;

            if !old_exists {
                // 旧表不存在，跳过（可能已经是新版或从未使用过该功能）
                continue;
            }

            // 检查新表是否存在
            let check_new_sql = format!(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='{}'",
                new_name
            );
            let new_exists = Self::query_count(conn, &check_new_sql)? > 0;

            if new_exists {
                // 新旧表同时存在 → 不操作，避免数据冲突
                // （可能是手动迁移或部分操作失败的状态）
                log::warn!(
                    "检测到迁移冲突：旧表 {} 和新表 {} 同时存在，已跳过（请手动检查）",
                    old_name,
                    new_name
                );
                continue;
            }

            // 执行迁移：ALTER TABLE RENAME
            let rename_sql = format!("ALTER TABLE {} RENAME TO {}", old_name, new_name);
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

        Ok(migrated_count)
    }

    /// Dashboard 相关表迁移
    fn dashboard_migrations(conn: &MutexGuardConnection<'_>) -> Result<(), String> {
        DashboardService::ensure_tables_exist(conn)
    }

    /// 辅助：执行查询并获取第一行第一列的计数值
    fn query_count(conn: &MutexGuardConnection<'_>, sql: &str) -> Result<i64, String> {
        let result = conn.query(sql, &[]).map_err(|e| e.to_string())?;
        if result.rows.is_empty() || result.rows[0].is_empty() {
            return Ok(0);
        }
        result.rows[0][0].parse::<i64>().map_err(|e| e.to_string())
    }
}

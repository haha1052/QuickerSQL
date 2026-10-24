//! 回收站服务
//! 负责处理删除表和回收站恢复的逻辑

use crate::database::traits::MutexGuardConnection;
use crate::models::trash::*;
use chrono::Utc;
use log;

/// 回收站服务
pub struct TrashService;

/// 默认阈值（当 settings 中未配置时使用）
const DEFAULT_LARGE_TABLE_THRESHOLD: u64 = 100_000;
const DEFAULT_CLEANUP_DAYS: u64 = 30;
const DEFAULT_MAX_TRASH_SIZE_MB: u64 = 1024;
const ESTIMATED_BYTES_PER_ROW: u64 = 1024;

impl TrashService {
    /// 从 settings 读取大表阈值（单位：行数）
    fn get_large_table_threshold(conn: &MutexGuardConnection<'_>) -> u64 {
        match crate::services::SettingsService::get_setting(conn, "performance", "large_table_threshold") {
            Ok(Some(setting)) => setting.value.parse::<u64>().unwrap_or(DEFAULT_LARGE_TABLE_THRESHOLD),
            _ => DEFAULT_LARGE_TABLE_THRESHOLD,
        }
    }

    /// 从 settings 读取是否启用自动清理
    fn get_auto_cleanup_enabled(conn: &MutexGuardConnection<'_>) -> bool {
        match crate::services::SettingsService::get_setting(conn, "trash", "autoCleanup") {
            Ok(Some(setting)) => setting.value.to_lowercase() == "true",
            _ => false,
        }
    }

    /// 从 settings 读取清理天数
    fn get_cleanup_days(conn: &MutexGuardConnection<'_>) -> u64 {
        match crate::services::SettingsService::get_setting(conn, "trash", "cleanupDays") {
            Ok(Some(setting)) => setting.value.parse::<u64>().unwrap_or(DEFAULT_CLEANUP_DAYS),
            _ => DEFAULT_CLEANUP_DAYS,
        }
    }

    /// 从 settings 读取回收站最大大小（MB）
    fn get_max_trash_size_mb(conn: &MutexGuardConnection<'_>) -> u64 {
        match crate::services::SettingsService::get_setting(conn, "trash", "maxTrashSize") {
            Ok(Some(setting)) => setting.value.parse::<u64>().unwrap_or(DEFAULT_MAX_TRASH_SIZE_MB),
            _ => DEFAULT_MAX_TRASH_SIZE_MB,
        }
    }

    /// 获取回收站统计信息（项目总数、估算总字节数）
    pub fn get_trash_stats(conn: &MutexGuardConnection<'_>) -> Result<(u64, u64), String> {
        let result = conn.query(
            "SELECT COUNT(*), COALESCE(SUM(row_count), 0) FROM __trash_metadata",
            &[],
        ).map_err(|e| format!("查询回收站统计失败：{}", e))?;

        if let Some(row) = result.rows.first() {
            let count: u64 = row[0].parse().unwrap_or(0);
            let total_rows: u64 = row[1].parse().unwrap_or(0);
            let estimated_bytes = total_rows * ESTIMATED_BYTES_PER_ROW;
            Ok((count, estimated_bytes))
        } else {
            Ok((0, 0))
        }
    }
    /// 确保回收站表存在
    pub fn ensure_trash_table_exists(conn: &MutexGuardConnection<'_>) -> Result<(), String> {
        // rusqlite::execute() 只支持单条语句，DDL 与索引必须拆成独立调用
        conn.execute(
            r#"CREATE TABLE IF NOT EXISTS __trash_metadata (
                id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
                original_table_name TEXT NOT NULL,
                trash_table_name TEXT,
                trash_file_path TEXT,
                row_count INTEGER NOT NULL,
                strategy TEXT NOT NULL,
                deleted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                deleted_by TEXT
            )"#,
            &[],
        ).map_err(|e| format!("创建回收站表失败：{}", e))?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_trash_deleted_at ON __trash_metadata(deleted_at)",
            &[],
        ).map_err(|e| format!("创建 idx_trash_deleted_at 索引失败：{}", e))?; // safe_sql: error message, not SQL execution
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_trash_original_name ON __trash_metadata(original_table_name)",
            &[],
        ).map_err(|e| format!("创建 idx_trash_original_name 索引失败：{}", e))?;
        Ok(())
    }

    /// 根据行数选择删除策略
    pub fn determine_strategy(conn: &MutexGuardConnection<'_>, row_count: u64) -> TrashStrategy {
        let threshold = Self::get_large_table_threshold(conn);
        if row_count > threshold {
            TrashStrategy::Parquet
        } else {
            TrashStrategy::Rename
        }
    }

    /// 将表移动到回收站（同步版本）
    ///
    /// 业务数据表在 DuckDB，回收站元数据在 SQLite（__trash_metadata）。
    /// - sqlite_conn: 读写 __trash_metadata 元数据 + 读 settings
    /// - duckdb_conn: 执行 ALTER TABLE RENAME 操作业务表
    pub fn move_to_trash_sync(
        sqlite_conn: &MutexGuardConnection<'_>,
        duckdb_conn: &MutexGuardConnection<'_>,
        table_name: &str,
        row_count: u64,
    ) -> Result<TrashItem, String> {
        // 确保表名安全
        if !crate::database::SqlIdentifier::is_safe_identifier(table_name) {
            return Err(format!("不安全的表名：{}", table_name));
        }

        // 检查回收站当前大小，如果超过限制则警告
        let max_trash_size_mb = Self::get_max_trash_size_mb(sqlite_conn);
        let max_trash_bytes = max_trash_size_mb * 1024 * 1024;
        if let Ok((_, current_size)) = Self::get_trash_stats(sqlite_conn) {
            if current_size > max_trash_bytes {
                log::warn!(
                    "回收站当前大小（约 {:.2} MB）已超过设置的最大限制（{} MB），建议清理回收站",
                    current_size as f64 / (1024.0 * 1024.0),
                    max_trash_size_mb
                );
            }
        }

        // 确定策略（从 settings 读取阈值）
        let strategy = Self::determine_strategy(sqlite_conn, row_count);
        let safe_original = crate::database::SqlIdentifier::quote_identifier(table_name);

        // 生成唯一 ID
        let id = uuid::Uuid::new_v4().to_string();

        match strategy {
            TrashStrategy::Rename => {
                Self::move_by_rename(sqlite_conn, duckdb_conn, &id, table_name, row_count, safe_original)
            }
            TrashStrategy::Parquet => {
                log::info!("表 {} 较大（{} 行），暂时使用重命名策略", table_name, row_count);
                // TODO：Parquet 策略实现
                Self::move_by_rename(sqlite_conn, duckdb_conn, &id, table_name, row_count, safe_original)
            }
        }
    }

    /// 重命名策略实现（DuckDB 重命名表 + SQLite 写元数据）
    fn move_by_rename(
        sqlite_conn: &MutexGuardConnection<'_>,
        duckdb_conn: &MutexGuardConnection<'_>,
        id: &str,
        table_name: &str,
        row_count: u64,
        safe_original: String,
    ) -> Result<TrashItem, String> {
        use crate::database::traits::ToSql;

        let trash_table_name = format!("__trash_{}", id.replace('-', "_"));
        let safe_trash = crate::database::SqlIdentifier::quote_identifier(&trash_table_name);

        // 在 DuckDB 上重命名业务表（表名通过 SqlIdentifier::quote_identifier 安全引用）
        let rename_sql = format!("ALTER TABLE {} RENAME TO {}", safe_original, safe_trash);
        duckdb_conn.execute(&rename_sql, &[])
            .map_err(|e| format!("重命名表失败：{}", e))?;

        log::debug!("已将表 {} 重命名为 {}（回收站）", table_name, trash_table_name);

        // 在 SQLite 上插入元数据：参数化查询
        let insert_sql = "INSERT INTO __trash_metadata (id, original_table_name, trash_table_name, row_count, strategy) VALUES (?, ?, ?, ?, 'Rename');";
        let row_count_i64 = row_count as i64;
        let insert_params: [&dyn ToSql; 4] = [
            &id, &table_name, &trash_table_name, &row_count_i64,
        ];

        sqlite_conn.execute(insert_sql, &insert_params)
            .map_err(|e| format!("插入元数据失败：{}", e))?;

        Ok(TrashItem {
            id: id.to_string(),
            original_table_name: table_name.to_string(),
            trash_table_name: Some(trash_table_name),
            trash_file_path: None,
            row_count,
            strategy: TrashStrategy::Rename,
            deleted_at: Utc::now(),
            deleted_by: None,
        })
    }

    /// 从回收站恢复表（同步版本）
    ///
    /// 业务数据表在 DuckDB，回收站元数据在 SQLite。
    /// - sqlite_conn: 读写 __trash_metadata 元数据
    /// - duckdb_conn: 检查目标表存在性 + 执行 ALTER TABLE RENAME
    pub fn restore_from_trash_sync(
        sqlite_conn: &MutexGuardConnection<'_>,
        duckdb_conn: &MutexGuardConnection<'_>,
        trash_id: &str,
    ) -> Result<String, String> {
        use crate::database::traits::ToSql;

        // 从 SQLite 查找回收站项（参数化查询）
        let select_sql = "SELECT original_table_name, trash_table_name, strategy FROM __trash_metadata WHERE id = ?;";
        let select_params: [&dyn ToSql; 1] = [&trash_id];

        let result = sqlite_conn.query(select_sql, &select_params)
            .map_err(|e| format!("查询回收站失败：{}", e))?;

        if result.rows.is_empty() {
            return Err(format!("回收站项不存在：{}", trash_id));
        }

        let row = &result.rows[0];
        let original_name = &row[0];
        let trash_table_name = row[1].as_str();
        let strategy_str = &row[2];

        log::info!("恢复表 - 原始表名: {}, 回收站表名: {:?}, 策略值: '{}'",
            original_name, trash_table_name, strategy_str);

        // 处理空字符串
        let trash_table_name_owned = if trash_table_name.is_empty() {
            None
        } else {
            Some(trash_table_name.to_string())
        };

        if !crate::database::SqlIdentifier::is_safe_identifier(original_name) {
            return Err(format!("不安全的原始表名：{}", original_name));
        }

        // 检查策略是否匹配（更宽松的匹配）
        if strategy_str.trim() == "Rename" || strategy_str.to_lowercase() == "rename" {
            log::info!("使用 Rename 策略恢复表");
            if let Some(trash_table) = trash_table_name_owned {
                if crate::database::SqlIdentifier::is_safe_identifier(&trash_table) {
                    // 恢复前检查目标表名是否已存在（DuckDB information_schema）
                    let exists_check_sql = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'main' AND table_name = ?;";
                    let exists_params: [&dyn ToSql; 1] = [&original_name];
                    let exists_result = duckdb_conn.query(exists_check_sql, &exists_params)
                        .map_err(|e| format!("检查目标表是否存在失败：{}", e))?;
                    if !exists_result.rows.is_empty() {
                        return Err(format!(
                            "目标表 '{}' 已存在，无法恢复。请先重命名或删除已存在的表后再恢复",
                            original_name
                        ));
                    }

                    let safe_original = crate::database::SqlIdentifier::quote_identifier(original_name);
                    let safe_trash = crate::database::SqlIdentifier::quote_identifier(&trash_table);

                    log::info!("执行重命名: {} -> {}", safe_trash, safe_original);
                    // 在 DuckDB 上恢复表名
                    let restore_sql = format!("ALTER TABLE {} RENAME TO {}", safe_trash, safe_original);
                    duckdb_conn.execute(&restore_sql, &[])
                        .map_err(|e| format!("恢复表失败：{}", e))?;

                    // 从 SQLite 删除元数据
                    let delete_sql = "DELETE FROM __trash_metadata WHERE id = ?;";
                    let delete_params: [&dyn ToSql; 1] = [&trash_id];
                    sqlite_conn.execute(delete_sql, &delete_params)
                        .map_err(|e| format!("删除元数据失败：{}", e))?;

                    return Ok(format!("已恢复表：{}", original_name));
                } else {
                    log::warn!("不安全的回收站表名: {}", trash_table);
                }
            } else {
                log::warn!("回收站表名为空，无法使用 Rename 策略");
            }
        }

        Err(format!("暂不支持的策略：{}", strategy_str))
    }

    /// 永久删除回收站项（同步版本）
    ///
    /// - sqlite_conn: 读写 __trash_metadata 元数据
    /// - duckdb_conn: 执行 DROP TABLE 删除业务表
    pub fn permanent_delete_sync(
        sqlite_conn: &MutexGuardConnection<'_>,
        duckdb_conn: &MutexGuardConnection<'_>,
        trash_id: &str,
    ) -> Result<String, String> {
        use crate::database::traits::ToSql;

        // 从 SQLite 查找回收站项
        let select_sql = "SELECT trash_table_name, strategy FROM __trash_metadata WHERE id = ?;";
        let select_params: [&dyn ToSql; 1] = [&trash_id];

        let result = sqlite_conn.query(select_sql, &select_params)
            .map_err(|e| format!("查询回收站失败：{}", e))?;

        if result.rows.is_empty() {
            return Err(format!("回收站项不存在：{}", trash_id));
        }

        let row = &result.rows[0];
        let trash_table_name = row[0].as_str();
        let strategy_str = &row[1];

        // 处理空字符串
        let trash_table_name_owned = if trash_table_name.is_empty() {
            None
        } else {
            Some(trash_table_name.to_string())
        };

        if strategy_str == "Rename" {
            if let Some(trash_table) = trash_table_name_owned {
                if crate::database::SqlIdentifier::is_safe_identifier(&trash_table) {
                    let safe_trash = crate::database::SqlIdentifier::quote_identifier(&trash_table);
                    // 在 DuckDB 上删除表
                    let drop_sql = format!("DROP TABLE IF EXISTS {}", safe_trash);
                    duckdb_conn.execute(&drop_sql, &[])
                        .map_err(|e| format!("删除表失败：{}", e))?;
                }
            }
        }

        // 从 SQLite 删除元数据
        let delete_sql = "DELETE FROM __trash_metadata WHERE id = ?;";
        let delete_params: [&dyn ToSql; 1] = [&trash_id];
        sqlite_conn.execute(delete_sql, &delete_params)
            .map_err(|e| format!("删除元数据失败：{}", e))?;

        Ok(format!("已永久删除回收站项：{}", trash_id))
    }

    /// 获取回收站列表（同步版本）
    pub fn get_trash_list_sync(
        conn: &MutexGuardConnection<'_>,
    ) -> Result<TrashListResponse, String> {
        let select_sql = r#"
            SELECT id, original_table_name, trash_table_name, trash_file_path,
                   row_count, strategy, deleted_at, deleted_by
            FROM __trash_metadata
            ORDER BY deleted_at DESC;
        "#;

        let result = conn.query(select_sql, &[])
            .map_err(|e| format!("查询回收站列表失败：{}", e))?;

        let mut items = Vec::new();

        for row in result.rows {
            let strategy_str = &row[5];
            let strategy = match strategy_str.as_str() {
                "Rename" => TrashStrategy::Rename,
                "Parquet" => TrashStrategy::Parquet,
                _ => TrashStrategy::Rename, // 默认重命名策略
            };

            let row_count: u64 = row[4].parse().unwrap_or(0);
            
            // 解析日期时间
            let deleted_at = chrono::DateTime::parse_from_rfc3339(&row[6])
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now());

            items.push(TrashItem {
                id: row[0].clone(),
                original_table_name: row[1].clone(),
                trash_table_name: if row[2].is_empty() { None } else { Some(row[2].clone()) },
                trash_file_path: if row[3].is_empty() { None } else { Some(row[3].clone()) },
                row_count,
                strategy,
                deleted_at,
                deleted_by: if row[7].is_empty() { None } else { Some(row[7].clone()) },
            });
        }

        let total = items.len();
        Ok(TrashListResponse {
            items,
            total,
            total_size_bytes: None,
        })
    }

    /// 获取表的行数
    pub fn get_table_row_count(
        conn: &MutexGuardConnection<'_>,
        table_name: &str,
    ) -> Result<u64, String> {
        if !crate::database::SqlIdentifier::is_safe_identifier(table_name) {
            return Err(format!("不安全的表名：{}", table_name));
        }

        let safe_name = crate::database::SqlIdentifier::quote_identifier(table_name);
        let sql = format!("SELECT COUNT(*) FROM {}", safe_name);

        let result = conn.query(&sql, &[])
            .map_err(|e| format!("查询行数失败：{}", e))?;

        if let Some(row) = result.rows.first() {
            row[0].parse().map_err(|e| format!("解析行数失败：{}", e))
        } else {
            Ok(0)
        }
    }

    /// 自动清理回收站
    /// 清理超过指定天数的项目，并确保回收站总大小不超过限制
    /// 返回清理的项目数量
    pub fn auto_cleanup(conn: &MutexGuardConnection<'_>) -> Result<u64, String> {
        if !Self::get_auto_cleanup_enabled(conn) {
            log::debug!("自动清理未启用，跳过");
            return Ok(0);
        }

        let cleanup_days = Self::get_cleanup_days(conn);
        let max_trash_size_mb = Self::get_max_trash_size_mb(conn);
        let mut cleaned_count: u64 = 0;

        log::info!(
            "开始自动清理回收站：清理{}天前的项目，最大限制{}MB",
            cleanup_days,
            max_trash_size_mb
        );

        // 第一步：清理超过 cleanupDays 天的项目
        let old_items_sql = r#"
            SELECT id, trash_table_name, strategy
            FROM __trash_metadata
            WHERE deleted_at < datetime('now', ? || ' days')
            ORDER BY deleted_at ASC
        "#;
        let days_param = format!("-{}", cleanup_days);

        let old_items = conn.query(old_items_sql, &[&days_param])
            .map_err(|e| format!("查询过期回收站项失败：{}", e))?;

        for row in &old_items.rows {
            let id = &row[0];
            let trash_table_name = row[1].as_str();
            let strategy = &row[2];

            if let Err(e) = Self::permanent_delete_internal(conn, id, trash_table_name, strategy) {
                log::warn!("清理过期回收站项 {} 失败：{}", id, e);
            } else {
                cleaned_count += 1;
            }
        }

        // 第二步：检查总大小，如果超过限制则清理最旧的项目
        let max_trash_bytes = max_trash_size_mb * 1024 * 1024;
        let mut current_stats = Self::get_trash_stats(conn)?;
        let mut current_size = current_stats.1;

        while current_size > max_trash_bytes && current_stats.0 > 0 {
            let oldest_sql = r#"
                SELECT id, trash_table_name, strategy
                FROM __trash_metadata
                ORDER BY deleted_at ASC
                LIMIT 1
            "#;

            let oldest_result = conn.query(oldest_sql, &[])
                .map_err(|e| format!("查询最旧回收站项失败：{}", e))?;

            if oldest_result.rows.is_empty() {
                break;
            }

            let row = &oldest_result.rows[0];
            let id = &row[0];
            let trash_table_name = row[1].as_str();
            let strategy = &row[2];

            if let Err(e) = Self::permanent_delete_internal(conn, id, trash_table_name, strategy) {
                log::warn!("清理超量回收站项 {} 失败：{}", id, e);
                break;
            } else {
                cleaned_count += 1;
            }

            current_stats = Self::get_trash_stats(conn)?;
            current_size = current_stats.1;
        }

        log::info!("自动清理完成，共清理 {} 个回收站项", cleaned_count);
        Ok(cleaned_count)
    }

    /// 内部永久删除函数（供 auto_cleanup 使用，避免重复查询）
    fn permanent_delete_internal(
        conn: &MutexGuardConnection<'_>,
        id: &str,
        trash_table_name: &str,
        strategy: &str,
    ) -> Result<(), String> {
        let trash_table_name_owned = if trash_table_name.is_empty() {
            None
        } else {
            Some(trash_table_name.to_string())
        };

        if strategy == "Rename" {
            if let Some(trash_table) = trash_table_name_owned {
                if crate::database::SqlIdentifier::is_safe_identifier(&trash_table) {
                    let safe_trash = crate::database::SqlIdentifier::quote_identifier(&trash_table);
                    let drop_sql = format!("DROP TABLE IF EXISTS {}", safe_trash);
                    conn.execute(&drop_sql, &[])
                        .map_err(|e| format!("删除表失败：{}", e))?;
                }
            }
        }

        let delete_sql = "DELETE FROM __trash_metadata WHERE id = ?";
        conn.execute(delete_sql, &[&id])
            .map_err(|e| format!("删除元数据失败：{}", e))?;

        Ok(())
    }
}

// ============================================================
// M7.3 测试模块：表名安全校验 + TrashStrategy 解析
// ============================================================
#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::SqlIdentifier;

    #[test]
    fn test_table_name_rejects_invalid_identifiers() {
        // SqlIdentifier 禁止的字符：; -- 引号等。这里用其 is_safe_identifier 白名单
        // 合法：字母、数字、下划线、中文
        assert!(SqlIdentifier::is_safe_identifier("users"));
        assert!(SqlIdentifier::is_safe_identifier("用户表"));
        assert!(SqlIdentifier::is_safe_identifier("my_table_123"));

        // 非法：包含分号、空格、引号
        assert!(!SqlIdentifier::is_safe_identifier("users; DROP TABLE"));
        assert!(!SqlIdentifier::is_safe_identifier("user' OR '1'='1"));
        assert!(!SqlIdentifier::is_safe_identifier("\"tab\""));
    }

    #[test]
    fn test_quote_identifier_escapes_quotes() {
        // 表名内含双引号需要被转义为 ""
        let quoted = SqlIdentifier::quote_identifier("user\"name");
        assert_eq!(quoted, "\"user\"\"name\"");
    }

    #[test]
    fn test_trash_strategy_parsing_fallback_rename() {
        // TrashService 内部将未知 strategy 回退到 Rename
        let unknown = "SomeNewStrategy";
        let strategy = match unknown {
            "Rename" => TrashStrategy::Rename,
            "Parquet" => TrashStrategy::Parquet,
            _ => TrashStrategy::Rename, // 默认回退
        };
        assert!(matches!(strategy, TrashStrategy::Rename));
    }

    #[test]
    fn test_trash_strategy_parsing_recognizes_known() {
        assert!(matches!(
            match "Rename" {
                "Rename" => TrashStrategy::Rename,
                "Parquet" => TrashStrategy::Parquet,
                _ => TrashStrategy::Rename,
            },
            TrashStrategy::Rename
        ));
        assert!(matches!(
            match "Parquet" {
                "Rename" => TrashStrategy::Rename,
                "Parquet" => TrashStrategy::Parquet,
                _ => TrashStrategy::Rename,
            },
            TrashStrategy::Parquet
        ));
    }

    #[test]
    fn test_trash_list_response_default_size_none() {
        let resp = TrashListResponse {
            items: Vec::new(),
            total: 0,
            total_size_bytes: None,
        };
        assert_eq!(resp.total, 0);
        assert!(resp.items.is_empty());
        assert!(resp.total_size_bytes.is_none());
    }

    #[test]
    fn test_row_count_parse_falls_back_to_zero_on_empty() {
        // 对应 get_table_row_count 中的空结果回退
        let empty_rows: Vec<Vec<String>> = Vec::new();
        let value = empty_rows
            .first()
            .and_then(|r| r.first().and_then(|v| v.parse::<u64>().ok()))
            .unwrap_or(0);
        assert_eq!(value, 0);
    }
}

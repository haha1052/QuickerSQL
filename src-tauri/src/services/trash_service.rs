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

impl TrashService {
    /// 从 settings 读取大表阈值（单位：行数）
    fn get_large_table_threshold(conn: &MutexGuardConnection<'_>) -> u64 {
        match crate::services::SettingsService::get_setting(conn, "performance", "large_table_threshold") {
            Ok(Some(setting)) => setting.value.parse::<u64>().unwrap_or(DEFAULT_LARGE_TABLE_THRESHOLD),
            _ => DEFAULT_LARGE_TABLE_THRESHOLD,
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
        ).map_err(|e| format!("创建 idx_trash_deleted_at 索引失败：{}", e))?;
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
    pub fn move_to_trash_sync(
        conn: &MutexGuardConnection<'_>,
        table_name: &str,
        row_count: u64,
    ) -> Result<TrashItem, String> {
        // 确保表名安全
        if !crate::database::SqlIdentifier::is_safe_identifier(table_name) {
            return Err(format!("不安全的表名：{}", table_name));
        }

        // 确定策略（从 settings 读取阈值）
        let strategy = Self::determine_strategy(conn, row_count);
        let safe_original = crate::database::SqlIdentifier::quote_identifier(table_name);

        // 生成唯一 ID
        let id = uuid::Uuid::new_v4().to_string();

        match strategy {
            TrashStrategy::Rename => {
                Self::move_by_rename(conn, &id, table_name, row_count, safe_original)
            }
            TrashStrategy::Parquet => {
                log::info!("表 {} 较大（{} 行），暂时使用重命名策略", table_name, row_count);
                // TODO：Parquet 策略实现
                Self::move_by_rename(conn, &id, table_name, row_count, safe_original)
            }
        }
    }

    /// 重命名策略实现
    fn move_by_rename(
        conn: &MutexGuardConnection<'_>,
        id: &str,
        table_name: &str,
        row_count: u64,
        safe_original: String,
    ) -> Result<TrashItem, String> {
        let trash_table_name = format!("__trash_{}", id.replace('-', "_"));
        let safe_trash = crate::database::SqlIdentifier::quote_identifier(&trash_table_name);

        // 重命名表
        let rename_sql = format!("ALTER TABLE {} RENAME TO {}", safe_original, safe_trash);
        conn.execute(&rename_sql, &[])
            .map_err(|e| format!("重命名表失败：{}", e))?;

        log::debug!("已将表 {} 重命名为 {}（回收站）", table_name, trash_table_name);

        // 插入元数据（直接嵌入值）
        let insert_sql = format!(
            "INSERT INTO __trash_metadata (id, original_table_name, trash_table_name, row_count, strategy) VALUES ('{}', '{}', '{}', {}, 'Rename');",
            id.replace("'", "''"),
            table_name.replace("'", "''"),
            trash_table_name.replace("'", "''"),
            row_count
        );

        conn.execute(&insert_sql, &[])
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
    pub fn restore_from_trash_sync(
        conn: &MutexGuardConnection<'_>,
        trash_id: &str,
    ) -> Result<String, String> {
        // 查找回收站项
        let select_sql = format!(
            "SELECT original_table_name, trash_table_name, strategy FROM __trash_metadata WHERE id = '{}';",
            trash_id.replace("'", "''")
        );

        let result = conn.query(&select_sql, &[])
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
                    let safe_original = crate::database::SqlIdentifier::quote_identifier(original_name);
                    let safe_trash = crate::database::SqlIdentifier::quote_identifier(&trash_table);

                    log::info!("执行重命名: {} -> {}", safe_trash, safe_original);
                    let restore_sql = format!("ALTER TABLE {} RENAME TO {}", safe_trash, safe_original);
                    conn.execute(&restore_sql, &[])
                        .map_err(|e| format!("恢复表失败：{}", e))?;

                    // 删除元数据
                    let delete_sql = format!(
                        "DELETE FROM __trash_metadata WHERE id = '{}';",
                        trash_id.replace("'", "''")
                    );
                    conn.execute(&delete_sql, &[])
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
    pub fn permanent_delete_sync(
        conn: &MutexGuardConnection<'_>,
        trash_id: &str,
    ) -> Result<String, String> {
        let select_sql = format!(
            "SELECT trash_table_name, strategy FROM __trash_metadata WHERE id = '{}';",
            trash_id.replace("'", "''")
        );

        let result = conn.query(&select_sql, &[])
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
                    let drop_sql = format!("DROP TABLE IF EXISTS {}", safe_trash);
                    conn.execute(&drop_sql, &[])
                        .map_err(|e| format!("删除表失败：{}", e))?;
                }
            }
        }

        let delete_sql = format!(
            "DELETE FROM __trash_metadata WHERE id = '{}';",
            trash_id.replace("'", "''")
        );
        conn.execute(&delete_sql, &[])
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
}

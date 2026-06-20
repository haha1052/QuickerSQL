//! 查询历史服务
//! 负责处理查询历史的记录、查询、更新等逻辑

use crate::database::traits::MutexGuardConnection;
use crate::models::query_history::*;
use chrono::Utc;

/// 查询历史服务
pub struct QueryHistoryService;

impl QueryHistoryService {
    /// 确保查询历史表存在
    pub fn ensure_query_history_table_exists(conn: &MutexGuardConnection<'_>) -> Result<(), String> {
        // rusqlite::execute() 只支持单条语句，DDL 与索引必须拆成独立调用
        conn.execute(
            r#"CREATE TABLE IF NOT EXISTS __query_history (
                id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
                sql TEXT NOT NULL,
                name TEXT,
                executed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                execution_time_ms INTEGER,
                row_count INTEGER,
                success BOOLEAN NOT NULL,
                error_message TEXT,
                is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
                tags TEXT
            )"#,
            &[],
        ).map_err(|e| format!("创建查询历史表失败：{}", e))?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_history_executed_at ON __query_history(executed_at DESC)",
            &[],
        ).map_err(|e| format!("创建 idx_history_executed_at 索引失败：{}", e))?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_history_favorite ON __query_history(is_favorite)",
            &[],
        ).map_err(|e| format!("创建 idx_history_favorite 索引失败：{}", e))?;
        Ok(())
    }

    /// 记录查询历史
    pub fn record_query_sync(
        conn: &MutexGuardConnection<'_>,
        request: RecordQueryHistoryRequest,
    ) -> Result<QueryHistoryItem, String> {
        let id = uuid::Uuid::new_v4().to_string();
        let executed_at = Utc::now();
        
        // 先保存需要的引用
        let name_clone = request.name.clone();
        let error_message_clone = request.error_message.clone();

        // 插入记录（直接嵌入值）
        let insert_sql = format!(
            "INSERT INTO __query_history (id, sql, name, executed_at, execution_time_ms, row_count, success, error_message, is_favorite, tags) 
             VALUES ('{}', '{}', {}, '{}', {}, {}, {}, {}, FALSE, NULL);",
            id.replace("'", "''"),
            request.sql.replace("'", "''"),
            request.name.map(|n| format!("'{}'", n.replace("'", "''"))).unwrap_or_else(|| "NULL".to_string()),
            executed_at.to_rfc3339(),
            request.execution_time_ms.map(|v| v.to_string()).unwrap_or_else(|| "NULL".to_string()),
            request.row_count.map(|v| v.to_string()).unwrap_or_else(|| "NULL".to_string()),
            if request.success { "TRUE" } else { "FALSE" },
            request.error_message.map(|e| format!("'{}'", e.replace("'", "''"))).unwrap_or_else(|| "NULL".to_string())
        );

        conn.execute(&insert_sql, &[])
            .map_err(|e| format!("记录查询历史失败：{}", e))?;

        Ok(QueryHistoryItem {
            id,
            sql: request.sql,
            name: name_clone,
            executed_at,
            execution_time_ms: request.execution_time_ms,
            row_count: request.row_count,
            success: request.success,
            error_message: error_message_clone,
            is_favorite: false,
            tags: None,
        })
    }

    /// 获取查询历史列表
    pub fn get_history_sync(
        conn: &MutexGuardConnection<'_>,
        request: QueryHistoryListRequest,
    ) -> Result<QueryHistoryListResponse, String> {
        let mut where_clauses = Vec::new();

        if let Some(search) = &request.search {
            let search_pattern = format!("%{}%", search.replace("'", "''"));
            where_clauses.push(format!("(sql LIKE '{}' OR name LIKE '{}')", search_pattern, search_pattern));
        }

        if let Some(true) = request.only_favorites {
            where_clauses.push("is_favorite = TRUE".to_string());
        }

        let where_clause = if where_clauses.is_empty() {
            "".to_string()
        } else {
            format!("WHERE {}", where_clauses.join(" AND "))
        };

        let limit = request.limit.unwrap_or(50);
        let offset = request.offset.unwrap_or(0);

        // 查询数据
        let select_sql = format!(
            "SELECT id, sql, name, executed_at, execution_time_ms, row_count, success, error_message, is_favorite, tags 
             FROM __query_history {} ORDER BY executed_at DESC LIMIT {} OFFSET {};",
            where_clause, limit, offset
        );

        let result = conn.query(&select_sql, &[])
            .map_err(|e| format!("查询历史失败：{}", e))?;

        let mut items = Vec::new();
        for row in result.rows {
            items.push(Self::row_to_history_item(&row)?);
        }

        // 查询总数
        let count_sql = format!(
            "SELECT COUNT(*) as total FROM __query_history {};",
            where_clause
        );

        let count_result = conn.query(&count_sql, &[])
            .map_err(|e| format!("查询历史总数失败：{}", e))?;

        let total = if !count_result.rows.is_empty() {
            count_result.rows[0][0].clone().parse::<i64>().unwrap_or(0)
        } else {
            0
        };

        Ok(QueryHistoryListResponse { items, total })
    }

    /// 更新收藏状态
    pub fn update_favorite_sync(
        conn: &MutexGuardConnection<'_>,
        request: UpdateFavoriteRequest,
    ) -> Result<(), String> {
        let update_sql = format!(
            "UPDATE __query_history SET is_favorite = {} WHERE id = '{}';",
            if request.is_favorite { "TRUE" } else { "FALSE" },
            request.id.replace("'", "''")
        );

        conn.execute(&update_sql, &[])
            .map_err(|e| format!("更新收藏状态失败：{}", e))?;

        Ok(())
    }

    /// 删除历史记录
    pub fn delete_history_sync(
        conn: &MutexGuardConnection<'_>,
        id: &str,
    ) -> Result<(), String> {
        let delete_sql = format!(
            "DELETE FROM __query_history WHERE id = '{}';",
            id.replace("'", "''")
        );

        conn.execute(&delete_sql, &[])
            .map_err(|e| format!("删除历史记录失败：{}", e))?;

        Ok(())
    }

    /// 清理旧的历史记录
    pub fn cleanup_old_history_sync(
        conn: &MutexGuardConnection<'_>,
        keep_days: Option<i64>,
    ) -> Result<i64, String> {
        let days = keep_days.unwrap_or(90);
        let delete_sql = format!(
            "DELETE FROM __query_history WHERE executed_at < datetime('now', '-{} days') AND is_favorite = FALSE;",
            days
        );

        let result = conn.execute(&delete_sql, &[])
            .map_err(|e| format!("清理历史记录失败：{}", e))?;

        Ok(result as i64)
    }

    /// 从查询结果行解析历史记录项
    fn row_to_history_item(row: &[String]) -> Result<QueryHistoryItem, String> {
        if row.len() < 10 {
            return Err("查询结果列数不足".to_string());
        }

        Ok(QueryHistoryItem {
            id: row[0].clone(),
            sql: row[1].clone(),
            name: if row[2].is_empty() { None } else { Some(row[2].clone()) },
            executed_at: {
                let s = &row[3];
                chrono::DateTime::parse_from_rfc3339(s)
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or_else(|_| Utc::now())
            },
            execution_time_ms: row[4].parse::<i64>().ok(),
            row_count: row[5].parse::<i64>().ok(),
            success: row[6].to_lowercase() == "true" || row[6] == "1",
            error_message: if row[7].is_empty() || row[7].eq_ignore_ascii_case("null") { None } else { Some(row[7].clone()) },
            is_favorite: row[8].to_lowercase() == "true" || row[8] == "1",
            tags: if row[9].is_empty() { None } else { Some(row[9].clone()) },
        })
    }
}

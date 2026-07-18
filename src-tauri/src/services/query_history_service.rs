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
            .map_err(|e| {
                log::error!("记录查询历史失败: sql长度={}, success={}", request.sql.len(), request.success);
                format!("记录查询历史失败：{}", e)
            })?;

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
            .map_err(|e| {
                log::warn!("更新收藏状态失败: id={}, is_favorite={}", request.id, request.is_favorite);
                format!("更新收藏状态失败：{}", e)
            })?;

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
            .map_err(|e| {
                log::warn!("删除历史记录失败: id={}", id);
                format!("删除历史记录失败：{}", e)
            })?;

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
            .map_err(|e| {
                log::warn!("清理历史记录失败: days={}", days);
                format!("清理历史记录失败：{}", e)
            })?;

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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::traits::*;
    use crate::database::sqlite::SqliteDriver;
    use tempfile::tempdir;

    fn create_test_db_connection() -> (MutexGuardConnection<'static>, tempfile::TempDir) {
        let temp_dir = tempdir().expect("创建临时目录失败");
        let db_path = temp_dir.path().join("test_query_history.db");
        
        let driver = SqliteDriver::new();
        let mut db_manager = DatabaseManager::new();
        db_manager.register_driver(Box::new(driver));
        db_manager.create_and_connect("sqlite", &db_path).expect("创建测试数据库失败");
        
        let leaked_manager: &'static DatabaseManager = Box::leak(Box::new(db_manager));
        let conn = leaked_manager.get_connection().expect("获取连接失败");
        
        (conn, temp_dir)
    }

    #[test]
    fn test_record_query_sync_normal() {
        let (conn, _temp_dir) = create_test_db_connection();
        QueryHistoryService::ensure_query_history_table_exists(&conn).unwrap();
        
        let request = RecordQueryHistoryRequest {
            sql: "SELECT * FROM users".to_string(),
            name: Some("测试查询".to_string()),
            execution_time_ms: Some(100),
            row_count: Some(5),
            success: true,
            error_message: None,
        };
        
        let item = QueryHistoryService::record_query_sync(&conn, request).unwrap();
        assert_eq!(item.sql, "SELECT * FROM users");
        assert_eq!(item.name, Some("测试查询".to_string()));
        assert_eq!(item.execution_time_ms, Some(100));
        assert_eq!(item.row_count, Some(5));
        assert!(item.success);
        assert!(!item.is_favorite);
    }

    #[test]
    fn test_record_query_sync_empty_sql() {
        let (conn, _temp_dir) = create_test_db_connection();
        QueryHistoryService::ensure_query_history_table_exists(&conn).unwrap();
        
        let request = RecordQueryHistoryRequest {
            sql: "".to_string(),
            name: None,
            execution_time_ms: None,
            row_count: Some(0),
            success: false,
            error_message: Some("SQL 不能为空".to_string()),
        };
        
        let item = QueryHistoryService::record_query_sync(&conn, request).unwrap();
        assert_eq!(item.sql, "");
        assert!(!item.success);
        assert_eq!(item.error_message, Some("SQL 不能为空".to_string()));
    }

    #[test]
    fn test_record_query_sync_long_sql() {
        let (conn, _temp_dir) = create_test_db_connection();
        QueryHistoryService::ensure_query_history_table_exists(&conn).unwrap();
        
        let long_sql = "SELECT ".to_string() + &"a, ".repeat(5000);
        let request = RecordQueryHistoryRequest {
            sql: long_sql.clone(),
            name: Some("超长 SQL".to_string()),
            execution_time_ms: Some(5000),
            row_count: Some(10000),
            success: true,
            error_message: None,
        };
        
        let item = QueryHistoryService::record_query_sync(&conn, request).unwrap();
        assert_eq!(item.sql, long_sql);
    }

    #[test]
    fn test_get_history_sync_normal() {
        let (conn, _temp_dir) = create_test_db_connection();
        QueryHistoryService::ensure_query_history_table_exists(&conn).unwrap();
        
        for i in 0..3 {
            let request = RecordQueryHistoryRequest {
                sql: format!("SELECT {} FROM dual", i),
                name: Some(format!("查询{}", i)),
                execution_time_ms: Some(10 * i),
                row_count: Some(i),
                success: true,
                error_message: None,
            };
            QueryHistoryService::record_query_sync(&conn, request).unwrap();
        }
        
        let request = QueryHistoryListRequest {
            search: None,
            only_favorites: None,
            limit: Some(10),
            offset: Some(0),
        };
        
        let response = QueryHistoryService::get_history_sync(&conn, request).unwrap();
        assert_eq!(response.items.len(), 3, "应返回 3 条记录");
        assert_eq!(response.total, 3);
    }

    #[test]
    fn test_get_history_sync_pagination() {
        let (conn, _temp_dir) = create_test_db_connection();
        QueryHistoryService::ensure_query_history_table_exists(&conn).unwrap();
        
        for i in 0..5 {
            let request = RecordQueryHistoryRequest {
                sql: format!("SELECT {} FROM dual", i),
                name: None,
                execution_time_ms: None,
                row_count: None,
                success: true,
                error_message: None,
            };
            QueryHistoryService::record_query_sync(&conn, request).unwrap();
        }
        
        let request = QueryHistoryListRequest {
            search: None,
            only_favorites: None,
            limit: Some(2),
            offset: Some(0),
        };
        let result = QueryHistoryService::get_history_sync(&conn, request).unwrap();
        assert_eq!(result.items.len(), 2, "limit=2 应返回 2 条");
        assert_eq!(result.total, 5, "总数仍为 5");
        
        let request = QueryHistoryListRequest {
            search: None,
            only_favorites: None,
            limit: Some(10),
            offset: Some(3),
        };
        let result = QueryHistoryService::get_history_sync(&conn, request).unwrap();
        assert_eq!(result.items.len(), 2, "offset=3 应返回剩余 2 条");
    }

    #[test]
    fn test_get_history_sync_empty() {
        let (conn, _temp_dir) = create_test_db_connection();
        QueryHistoryService::ensure_query_history_table_exists(&conn).unwrap();
        
        let request = QueryHistoryListRequest {
            search: None,
            only_favorites: None,
            limit: Some(10),
            offset: Some(0),
        };
        
        let response = QueryHistoryService::get_history_sync(&conn, request).unwrap();
        assert!(response.items.is_empty(), "应返回空列表");
        assert_eq!(response.total, 0);
    }

    #[test]
    fn test_update_favorite_sync_set_true() {
        let (conn, _temp_dir) = create_test_db_connection();
        QueryHistoryService::ensure_query_history_table_exists(&conn).unwrap();
        
        let request = RecordQueryHistoryRequest {
            sql: "SELECT 1".to_string(),
            name: None,
            execution_time_ms: None,
            row_count: None,
            success: true,
            error_message: None,
        };
        let item = QueryHistoryService::record_query_sync(&conn, request).unwrap();
        
        let update_request = UpdateFavoriteRequest {
            id: item.id.clone(),
            is_favorite: true,
        };
        QueryHistoryService::update_favorite_sync(&conn, update_request).unwrap();
        
        let list_request = QueryHistoryListRequest {
            search: None,
            only_favorites: Some(true),
            limit: Some(10),
            offset: Some(0),
        };
        let response = QueryHistoryService::get_history_sync(&conn, list_request).unwrap();
        assert_eq!(response.items.len(), 1);
        assert!(response.items[0].is_favorite);
    }

    #[test]
    fn test_update_favorite_sync_set_false() {
        let (conn, _temp_dir) = create_test_db_connection();
        QueryHistoryService::ensure_query_history_table_exists(&conn).unwrap();
        
        let request = RecordQueryHistoryRequest {
            sql: "SELECT 1".to_string(),
            name: None,
            execution_time_ms: None,
            row_count: None,
            success: true,
            error_message: None,
        };
        let item = QueryHistoryService::record_query_sync(&conn, request).unwrap();
        
        let update_request = UpdateFavoriteRequest {
            id: item.id.clone(),
            is_favorite: true,
        };
        QueryHistoryService::update_favorite_sync(&conn, update_request).unwrap();
        
        let update_request = UpdateFavoriteRequest {
            id: item.id.clone(),
            is_favorite: false,
        };
        QueryHistoryService::update_favorite_sync(&conn, update_request).unwrap();
        
        let list_request = QueryHistoryListRequest {
            search: None,
            only_favorites: Some(true),
            limit: Some(10),
            offset: Some(0),
        };
        let response = QueryHistoryService::get_history_sync(&conn, list_request).unwrap();
        assert!(response.items.is_empty(), "取消后不应在收藏列表中");
    }

    #[test]
    fn test_update_favorite_sync_nonexistent_id() {
        let (conn, _temp_dir) = create_test_db_connection();
        QueryHistoryService::ensure_query_history_table_exists(&conn).unwrap();
        
        let update_request = UpdateFavoriteRequest {
            id: "nonexistent_id_12345".to_string(),
            is_favorite: true,
        };
        let result = QueryHistoryService::update_favorite_sync(&conn, update_request);
        assert!(result.is_ok(), "更新不存在的 ID 应返回成功（0 行受影响）");
    }

    #[test]
    fn test_cleanup_old_history_sync_normal() {
        let (conn, _temp_dir) = create_test_db_connection();
        QueryHistoryService::ensure_query_history_table_exists(&conn).unwrap();
        
        for i in 0..3 {
            let request = RecordQueryHistoryRequest {
                sql: format!("SELECT {}", i),
                name: None,
                execution_time_ms: None,
                row_count: None,
                success: true,
                error_message: None,
            };
            QueryHistoryService::record_query_sync(&conn, request).unwrap();
        }
        
        let count = QueryHistoryService::cleanup_old_history_sync(&conn, Some(90)).unwrap();
        assert_eq!(count, 0, "刚插入的记录不应被清理");
        
        let list_request = QueryHistoryListRequest {
            search: None,
            only_favorites: None,
            limit: Some(10),
            offset: Some(0),
        };
        let response = QueryHistoryService::get_history_sync(&conn, list_request).unwrap();
        assert_eq!(response.total, 3);
    }

    #[test]
    fn test_cleanup_old_history_sync_no_history() {
        let (conn, _temp_dir) = create_test_db_connection();
        QueryHistoryService::ensure_query_history_table_exists(&conn).unwrap();
        
        let count = QueryHistoryService::cleanup_old_history_sync(&conn, Some(90)).unwrap();
        assert_eq!(count, 0, "无历史时应清理 0 条");
    }

    #[test]
    fn test_cleanup_old_history_sync_empty_db() {
        let (conn, _temp_dir) = create_test_db_connection();
        let result = QueryHistoryService::cleanup_old_history_sync(&conn, Some(90));
        assert!(result.is_err(), "表不存在时清理应返回错误");
    }

    #[test]
    fn test_cleanup_old_history_sync_with_favorites_preserved() {
        let (conn, _temp_dir) = create_test_db_connection();
        QueryHistoryService::ensure_query_history_table_exists(&conn).unwrap();
        
        let request1 = RecordQueryHistoryRequest {
            sql: "SELECT favorite".to_string(),
            name: None,
            execution_time_ms: None,
            row_count: None,
            success: true,
            error_message: None,
        };
        let item1 = QueryHistoryService::record_query_sync(&conn, request1).unwrap();
        
        let request2 = RecordQueryHistoryRequest {
            sql: "SELECT not_favorite".to_string(),
            name: None,
            execution_time_ms: None,
            row_count: None,
            success: true,
            error_message: None,
        };
        QueryHistoryService::record_query_sync(&conn, request2).unwrap();
        
        let update_request = UpdateFavoriteRequest {
            id: item1.id.clone(),
            is_favorite: true,
        };
        QueryHistoryService::update_favorite_sync(&conn, update_request).unwrap();
        
        let count = QueryHistoryService::cleanup_old_history_sync(&conn, Some(10000)).unwrap();
        assert_eq!(count, 0, "刚插入的记录不应被清理");
        
        let list_request = QueryHistoryListRequest {
            search: None,
            only_favorites: None,
            limit: Some(10),
            offset: Some(0),
        };
        let response = QueryHistoryService::get_history_sync(&conn, list_request).unwrap();
        assert_eq!(response.total, 2, "所有记录应仍在");
        
        let fav_request = QueryHistoryListRequest {
            search: None,
            only_favorites: Some(true),
            limit: Some(10),
            offset: Some(0),
        };
        let fav_response = QueryHistoryService::get_history_sync(&conn, fav_request).unwrap();
        assert_eq!(fav_response.total, 1, "收藏记录应保留");
        assert_eq!(fav_response.items[0].id, item1.id, "收藏记录 ID 应匹配");
    }

    #[test]
    fn test_get_favorites_via_get_history() {
        let (conn, _temp_dir) = create_test_db_connection();
        QueryHistoryService::ensure_query_history_table_exists(&conn).unwrap();
        
        for i in 0..3 {
            let request = RecordQueryHistoryRequest {
                sql: format!("SELECT {}", i),
                name: None,
                execution_time_ms: None,
                row_count: None,
                success: true,
                error_message: None,
            };
            let item = QueryHistoryService::record_query_sync(&conn, request).unwrap();
            
            if i == 1 {
                let update_request = UpdateFavoriteRequest {
                    id: item.id,
                    is_favorite: true,
                };
                QueryHistoryService::update_favorite_sync(&conn, update_request).unwrap();
            }
        }
        
        let request = QueryHistoryListRequest {
            search: None,
            only_favorites: Some(true),
            limit: Some(10),
            offset: Some(0),
        };
        let result = QueryHistoryService::get_history_sync(&conn, request).unwrap();
        assert_eq!(result.items.len(), 1, "应只有 1 条收藏");
        assert!(result.items[0].is_favorite);
    }

    #[test]
    fn test_get_favorites_empty() {
        let (conn, _temp_dir) = create_test_db_connection();
        QueryHistoryService::ensure_query_history_table_exists(&conn).unwrap();
        
        let request = RecordQueryHistoryRequest {
            sql: "SELECT 1".to_string(),
            name: None,
            execution_time_ms: None,
            row_count: None,
            success: true,
            error_message: None,
        };
        QueryHistoryService::record_query_sync(&conn, request).unwrap();
        
        let request = QueryHistoryListRequest {
            search: None,
            only_favorites: Some(true),
            limit: Some(10),
            offset: Some(0),
        };
        let result = QueryHistoryService::get_history_sync(&conn, request).unwrap();
        assert!(result.items.is_empty(), "无收藏时应返回空列表");
        assert_eq!(result.total, 0);
    }
}

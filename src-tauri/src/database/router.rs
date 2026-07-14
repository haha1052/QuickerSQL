use super::traits::*;

/// 查询路由器 - 自动将 SQL 路由到合适的数据库引擎
pub struct QueryRouter;

impl QueryRouter {
    /// 判断是否应该使用 DuckDB（分析查询）
    /// 返回 true 表示使用 DuckDB，false 表示使用 SQLite
    pub fn should_use_duckdb(sql: &str) -> bool {
        let upper = sql.trim().to_uppercase();
        
        if upper.is_empty() {
            return false;
        }
        
        // Strip EXPLAIN / EXPLAIN QUERY PLAN prefix before analyzing the underlying query
        let core_sql = if let Some(stripped) = upper.strip_prefix("EXPLAIN QUERY PLAN ") {
            stripped
        } else if let Some(stripped) = upper.strip_prefix("EXPLAIN ") {
            stripped
        } else {
            &upper
        };
        
        let write_keywords = [
            "INSERT", "UPDATE", "DELETE",
            "CREATE", "DROP", "ALTER",
            "PRAGMA", "VACUUM", "REINDEX",
            "ATTACH", "DETACH", "BEGIN", "COMMIT", "ROLLBACK"
        ];
        
        for kw in write_keywords.iter() {
            if core_sql.starts_with(kw) {
                log::debug!("SQL contains write keyword '{}', routing to SQLite", kw);
                return false;
            }
        }
        
        let analytical_keywords = [
            "GROUP BY", "HAVING",
            "OVER", "WINDOW",
            "ROW_NUMBER", "RANK", "DENSE_RANK", "LAG", "LEAD",
            "CUME_DIST", "NTILE", "PERCENT_RANK",
            "ARRAY_AGG", "JSON_AGG", "STRING_AGG",
            "COUNT(DISTINCT", "AVG(", "SUM(", "MIN(", "MAX(",
            "CORR(", "COVAR(", "REGR_",
            "SELECT DISTINCT", " JOIN "
        ];
        
        for kw in analytical_keywords.iter() {
            if core_sql.contains(kw) {
                log::debug!("SQL contains analytical keyword '{}', routing to DuckDB", kw);
                return true;
            }
        }
        
        false
    }

    /// 自动路由表名（VIEW 机制）
    /// 在 VIEW 机制下，SQL 查询不需要任何修改，直接返回即可
    pub fn route_table_names(sql: &str, _table_names: &[&str]) -> Result<String> {
        // VIEW 机制下，SQL 查询不需要任何修改
        // 因为已经为每个表创建了同名的 VIEW，会自动路由到 sqlite_db.xxx
        log::trace!("VIEW routing: passing SQL through unchanged: {}", sql);
        Ok(sql.to_string())
    }

    /// 从 SQLite 获取当前数据库的所有表名
    pub fn get_table_names(conn: &MutexGuardConnection) -> Vec<String> {
        match crate::database::meta::list_user_table_names(conn) {
            Ok(names) => names,
            Err(e) => {
                log::warn!("Failed to get table names: {}", e);
                Vec::new()
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_should_use_duckdb_write_operations() {
        assert!(!QueryRouter::should_use_duckdb("INSERT INTO users VALUES (1)"));
        assert!(!QueryRouter::should_use_duckdb("UPDATE users SET name = 'test'"));
        assert!(!QueryRouter::should_use_duckdb("DELETE FROM users"));
        assert!(!QueryRouter::should_use_duckdb("CREATE TABLE test (id INTEGER)"));
        assert!(!QueryRouter::should_use_duckdb("DROP TABLE test"));
        assert!(!QueryRouter::should_use_duckdb("PRAGMA journal_mode"));
    }

    #[test]
    fn test_should_use_duckdb_analytical_queries() {
        assert!(QueryRouter::should_use_duckdb("SELECT COUNT(*) FROM users GROUP BY category"));
        assert!(QueryRouter::should_use_duckdb("SELECT AVG(price) FROM orders"));
        assert!(QueryRouter::should_use_duckdb("SELECT ROW_NUMBER() OVER (ORDER BY id) FROM users"));
        assert!(QueryRouter::should_use_duckdb("SELECT * FROM orders JOIN users ON orders.user_id = users.id"));
        assert!(QueryRouter::should_use_duckdb("SELECT DISTINCT category FROM products"));
    }

    #[test]
    fn test_should_use_duckdb_simple_queries() {
        assert!(!QueryRouter::should_use_duckdb("SELECT * FROM users WHERE id = 1"));
        assert!(!QueryRouter::should_use_duckdb("SELECT name FROM users"));
    }

    #[test]
    fn test_should_use_duckdb_explain_prefix_stripping() {
        // EXPLAIN on analytical query should route to DuckDB (prefix stripped, then analyzed)
        assert!(QueryRouter::should_use_duckdb("EXPLAIN SELECT COUNT(*) FROM users GROUP BY category"));
        assert!(QueryRouter::should_use_duckdb("EXPLAIN SELECT AVG(price) FROM orders"));
        assert!(QueryRouter::should_use_duckdb("EXPLAIN SELECT * FROM orders JOIN users ON orders.user_id = users.id"));
        assert!(QueryRouter::should_use_duckdb("EXPLAIN SELECT DISTINCT category FROM products"));
        assert!(QueryRouter::should_use_duckdb("EXPLAIN QUERY PLAN SELECT COUNT(*) FROM users GROUP BY category"));

        // EXPLAIN on simple query should still route to SQLite (no analytical keywords after prefix)
        assert!(!QueryRouter::should_use_duckdb("EXPLAIN SELECT * FROM users WHERE id = 1"));
        assert!(!QueryRouter::should_use_duckdb("EXPLAIN SELECT name FROM users LIMIT 10"));
        assert!(!QueryRouter::should_use_duckdb("EXPLAIN QUERY PLAN SELECT * FROM users WHERE id = 1"));
    }

    #[test]
    fn test_route_table_names_safe() {
        let tables = ["users", "orders"];
        
        // 在 VIEW 机制下，SQL 不应该被修改
        let result = QueryRouter::route_table_names("SELECT * FROM users", &tables);
        assert!(result.is_ok());
        let result_str = result.unwrap();
        // SQL 保持不变，因为 VIEW 会自动处理
        assert_eq!(result_str, "SELECT * FROM users");
        
        let result = QueryRouter::route_table_names(
            "SELECT * FROM users JOIN orders ON users.id = orders.user_id",
            &tables
        );
        assert!(result.is_ok());
        let result_str = result.unwrap();
        // SQL 保持不变
        assert_eq!(result_str, "SELECT * FROM users JOIN orders ON users.id = orders.user_id");
    }
    
    #[test]
    fn test_route_table_names_invalid() {
        // 在 VIEW 机制下，表名验证在创建 VIEW 时完成，路由时不再验证
        // 因为 route_table_names() 不再处理的表名列表现在只是通过
        let tables = ["users; DROP TABLE"];
        
        let result = QueryRouter::route_table_names("SELECT * FROM users; DROP TABLE", &tables);
        // 现在直接通过（因为验证逻辑移到了 VIEW 创建时）
        assert!(result.is_ok());
    }
    
    #[test]
    fn test_route_table_names_with_prefix() {
        let tables = ["users", "user_profiles"];
        
        let result = QueryRouter::route_table_names("SELECT * FROM user_profiles", &tables);
        assert!(result.is_ok());
        let result_str = result.unwrap();
        assert_eq!(result_str, "SELECT * FROM user_profiles");
        // VIEW 机制会正确工作，不需要任何替换
    }
}

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
        
        let write_keywords = [
            "INSERT", "UPDATE", "DELETE",
            "CREATE", "DROP", "ALTER",
            "PRAGMA", "VACUUM", "REINDEX",
            "ATTACH", "DETACH", "BEGIN", "COMMIT", "ROLLBACK"
        ];
        
        for kw in write_keywords.iter() {
            if upper.starts_with(kw) {
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
            if upper.contains(kw) {
                log::debug!("SQL contains analytical keyword '{}', routing to DuckDB", kw);
                return true;
            }
        }
        
        false
    }

    /// 自动路由表名
    /// 将用户写的表名（如 orders）转换为 DuckDB 中的限定名（sqlite_db.orders）
    pub fn route_table_names(sql: &str, table_names: &[&str]) -> String {
        let mut result = sql.to_string();
        
        for table_name in table_names {
            result = result.replace(&format!(" FROM {} ", table_name), &format!(" FROM sqlite_db.{} ", table_name));
            result = result.replace(&format!(" FROM {}", table_name), &format!(" FROM sqlite_db.{}", table_name));
            result = result.replace(&format!(" JOIN {} ", table_name), &format!(" JOIN sqlite_db.{} ", table_name));
            result = result.replace(&format!(" JOIN {}", table_name), &format!(" JOIN sqlite_db.{}", table_name));
            result = result.replace(&format!(" {} AS ", table_name), &format!(" sqlite_db.{} AS ", table_name));
            result = result.replace(&format!(", {}", table_name), &format!(", sqlite_db.{}", table_name));
        }
        
        log::trace!("Table name routing completed: {} -> {}", sql, result);
        result
    }

    /// 从 SQLite 获取当前数据库的所有表名
    pub fn get_table_names(conn: &MutexGuardConnection) -> Vec<String> {
        match conn.query(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
            &[]
        ) {
            Ok(result) => result.rows.into_iter()
                .filter(|row| !row.is_empty())
                .map(|row| row[0].clone())
                .collect(),
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
    fn test_route_table_names() {
        let tables = ["users", "orders"];
        
        let result = QueryRouter::route_table_names("SELECT * FROM users", &tables);
        assert!(result.contains("sqlite_db.users"));
        
        let result = QueryRouter::route_table_names(
            "SELECT * FROM users JOIN orders ON users.id = orders.user_id",
            &tables
        );
        assert!(result.contains("sqlite_db.users"));
        assert!(result.contains("sqlite_db.orders"));
    }
}
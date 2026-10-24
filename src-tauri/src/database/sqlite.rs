use std::path::Path;
use std::sync::{Arc, Mutex};
use rusqlite::{Connection, OpenFlags};
use super::security::SqlIdentifier;
use super::traits::*;

pub struct SqliteDriver;

impl Default for SqliteDriver {
    fn default() -> Self {
        Self::new()
    }
}

impl SqliteDriver {
    pub fn new() -> Self {
        SqliteDriver
    }
}

impl DatabaseDriver for SqliteDriver {
    fn get_driver_name(&self) -> &'static str {
        "sqlite"
    }

    fn is_available(&self) -> bool {
        true
    }

    fn connect(&self, path: &Path) -> Result<Box<dyn DatabaseConnection>> {
        if !path.exists() {
            return Err(DatabaseError::FileNotFound);
        }

        let flags = OpenFlags::SQLITE_OPEN_READ_WRITE
            | OpenFlags::SQLITE_OPEN_NO_MUTEX;

        let conn = Connection::open_with_flags(path, flags)
            .map_err(|e| DatabaseError::ConnectionFailed(e.to_string()))?;

        // SQLite 连接配置
        // busy_timeout 设置为 30 秒（对应 connectionTimeout 默认值）
        // 这个值控制数据库被锁定时等待的时间
        conn.execute_batch(
            "PRAGMA journal_mode=WAL;
             PRAGMA synchronous=NORMAL;
             PRAGMA cache_size=-20000;
             PRAGMA temp_store=MEMORY;
             PRAGMA busy_timeout=30000;
             PRAGMA foreign_keys = ON;"
        ).map_err(|e| DatabaseError::ConfigurationFailed(e.to_string()))?;

        Ok(Box::new(SqliteConnection {
            conn: Arc::new(Mutex::new(conn)),
        }))
    }

    fn create_database(&self, path: &Path) -> Result<Box<dyn DatabaseConnection>> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| DatabaseError::ConfigurationFailed(e.to_string()))?;
        }

        let flags = OpenFlags::SQLITE_OPEN_READ_WRITE 
            | OpenFlags::SQLITE_OPEN_CREATE
            | OpenFlags::SQLITE_OPEN_NO_MUTEX;

        let conn = Connection::open_with_flags(path, flags)
            .map_err(|e| DatabaseError::ConnectionFailed(e.to_string()))?;

        // SQLite 连接配置
        // busy_timeout 设置为 30 秒（对应 connectionTimeout 默认值）
        conn.execute_batch(
            "PRAGMA journal_mode=WAL;
             PRAGMA synchronous=NORMAL;
             PRAGMA cache_size=-20000;
             PRAGMA temp_store=MEMORY;
             PRAGMA busy_timeout=30000;
             PRAGMA foreign_keys = ON;"
        ).map_err(|e| DatabaseError::ConfigurationFailed(e.to_string()))?;

        Ok(Box::new(SqliteConnection {
            conn: Arc::new(Mutex::new(conn)),
        }))
    }

    fn supports_wal(&self) -> bool {
        true
    }
}

pub struct SqliteConnection {
    conn: Arc<Mutex<Connection>>,
}

impl DatabaseConnection for SqliteConnection {
    fn get_database_type(&self) -> &'static str {
        "sqlite"
    }

    fn execute(&self, sql: &str, params: &[&dyn ToSql]) -> Result<u64> {
        let conn = self.conn.lock().map_err(|e| DatabaseError::ConnectionFailed(e.to_string()))?;
        let sqlite_params: Vec<String> = params.iter().map(|p| p.to_sql()).collect();
        let result = conn.execute(sql, rusqlite::params_from_iter(sqlite_params.iter()))
            .map_err(|e| DatabaseError::QueryFailed(e.to_string()))?;
        Ok(result as u64)
    }

    fn query(&self, sql: &str, params: &[&dyn ToSql]) -> Result<QueryResult> {
        let conn = self.conn.lock().map_err(|e| DatabaseError::ConnectionFailed(e.to_string()))?;
        let mut stmt = conn.prepare(sql)
            .map_err(|e| DatabaseError::PrepareFailed(e.to_string()))?;

        let column_names: Vec<String> = stmt.column_names().iter()
            .map(|s| s.to_string())
            .collect();

        let sqlite_params: Vec<String> = params.iter().map(|p| p.to_sql()).collect();
        let mut rows = Vec::new();
        let mut query_result = stmt.query(rusqlite::params_from_iter(sqlite_params.iter()))
            .map_err(|e| DatabaseError::QueryFailed(e.to_string()))?;

        while let Ok(Some(row)) = query_result.next() {
            let mut row_data = Vec::new();
            for i in 0..column_names.len() {
                let value: String = match row.get_ref(i) {
                    Ok(val) => {
                        match val {
                            rusqlite::types::ValueRef::Null => String::from("NULL"),
                            rusqlite::types::ValueRef::Integer(i) => i.to_string(),
                            rusqlite::types::ValueRef::Real(f) => f.to_string(),
                            rusqlite::types::ValueRef::Text(s) => String::from_utf8_lossy(s).to_string(),
                            rusqlite::types::ValueRef::Blob(b) => format!("[BLOB: {} bytes]", b.len()),
                        }
                    }
                    Err(_) => {
                        log::warn!("Failed to get value at column index {}", i);
                        String::from("NULL")
                    }
                };
                row_data.push(value);
            }
            rows.push(row_data);
        }

        Ok(QueryResult { columns: column_names, rows, affected_rows: None })
    }

    fn begin_transaction(&self) -> Result<()> {
        let conn = self.conn.lock().map_err(|e| DatabaseError::ConnectionFailed(e.to_string()))?;
        conn.execute("BEGIN TRANSACTION", [])
            .map_err(|e| DatabaseError::TransactionFailed(e.to_string()))?;
        Ok(())
    }

    fn commit_transaction(&self) -> Result<()> {
        let conn = self.conn.lock().map_err(|e| DatabaseError::ConnectionFailed(e.to_string()))?;
        conn.execute("COMMIT", [])
            .map_err(|e| DatabaseError::TransactionFailed(e.to_string()))?;
        Ok(())
    }

    fn rollback_transaction(&self) -> Result<()> {
        let conn = self.conn.lock().map_err(|e| DatabaseError::ConnectionFailed(e.to_string()))?;
        conn.execute("ROLLBACK", [])
            .map_err(|e| DatabaseError::TransactionFailed(e.to_string()))?;
        Ok(())
    }

    fn is_open(&self) -> bool {
        self.conn.lock().is_ok()
    }

    fn close(&self) {
        // P1-3: 显式记录关闭事件。
        // rusqlite::Connection::close(self) 会消费连接，而此处连接存储在 Arc<Mutex<>> 内，
        // 无法通过 &self 取出。实际连接释放发生在 Arc 引用计数归零时（Drop 会自动关闭）。
        // 此日志用于诊断连接生命周期，确认 close() 被调用。
        log::info!("[SQLite] close() called — 连接将在 Arc<Mutex> 释放时自动关闭");
    }
    
    fn batch_insert(&self, table: &SqlIdentifier, columns: &[&str], rows: &[Vec<String>], _batch_size: usize) -> Result<u64> {
        let conn = self.conn.lock().map_err(|e| DatabaseError::ConnectionFailed(e.to_string()))?;

        let mut total_count = 0u64;

        // 列名同样需要经 SqlIdentifier 校验后引用，避免列名注入
        let mut quoted_cols = Vec::with_capacity(columns.len());
        for col in columns {
            let col_ident = SqlIdentifier::new(col)
                .map_err(|e| DatabaseError::Unknown(format!("无效的列名 '{}': {}", col, e)))?;
            quoted_cols.push(col_ident.quoted());
        }

        let placeholders: Vec<&str> = (0..columns.len()).map(|_| "?").collect();
        // 表名已由 SqlIdentifier 校验，使用 quoted() 安全拼装；值仍走 ? 参数化
        let insert_sql = format!(
            "INSERT INTO {} ({}) VALUES ({})",
            table.quoted(),
            quoted_cols.join(", "),
            placeholders.join(", ")
        );

        conn.execute("BEGIN TRANSACTION", [])
            .map_err(|e| DatabaseError::TransactionFailed(e.to_string()))?;

        let mut stmt = conn.prepare(&insert_sql)
            .map_err(|e| DatabaseError::PrepareFailed(e.to_string()))?;

        for row in rows {
            let params: Vec<&dyn rusqlite::ToSql> = row.iter().map(|s| s as &dyn rusqlite::ToSql).collect();
            stmt.execute(rusqlite::params_from_iter(params))
                .map_err(|e| {
                    let _ = conn.execute("ROLLBACK", []);
                    DatabaseError::QueryFailed(e.to_string())
                })?;

            total_count += 1;
        }

        conn.execute("COMMIT", [])
            .map_err(|e| DatabaseError::TransactionFailed(e.to_string()))?;

        Ok(total_count)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::traits::{DatabaseConnection, DatabaseDriver};

    /// 创建基于临时文件的测试连接，返回 (连接, 临时目录)
    /// 保留临时目录以防止数据库文件被提前删除
    /// 注：使用临时文件而非 :memory: 以避免 Windows 上 :memory: 路径解析问题，
    /// 并与 dashboard_service.rs 既有测试风格保持一致
    fn create_test_connection() -> (Box<dyn DatabaseConnection>, tempfile::TempDir) {
        let temp_dir = tempfile::tempdir().expect("创建临时目录失败");
        let db_path = temp_dir.path().join("test_fk.db");
        let driver = SqliteDriver::new();
        let conn = driver.create_database(&db_path).expect("创建测试数据库失败");
        (conn, temp_dir)
    }

    /// 辅助：查询标量值（COUNT / PRAGMA 等单列单行结果）
    fn query_scalar(conn: &Box<dyn DatabaseConnection>, sql: &str) -> String {
        let result = conn.query(sql, &[]).expect("查询失败");
        assert!(!result.rows.is_empty(), "查询应至少返回一行: {}", sql);
        assert!(!result.rows[0].is_empty(), "查询应至少返回一列: {}", sql);
        result.rows[0][0].clone()
    }

    // ============================================================
    // PRAGMA foreign_keys 默认开启验证
    // ============================================================

    #[test]
    fn test_pragma_foreign_keys_enabled_by_default() {
        let (conn, _temp_dir) = create_test_connection();
        // PRAGMA foreign_keys; 返回 1 表示 ON，0 表示 OFF
        let value = query_scalar(&conn, "PRAGMA foreign_keys;");
        assert_eq!(
            value, "1",
            "SqliteDriver 应在 connect/create_database 初始化时开启 foreign_keys = ON"
        );
    }

    // ============================================================
    // foreign_keys 启用后级联删除生效
    // 插入 dashboard + dashboard_item，删除 dashboard，验证 dashboard_items 自动被删
    // ============================================================

    #[test]
    fn test_foreign_keys_cascade_delete() {
        let (conn, _temp_dir) = create_test_connection();

        // 创建父表 __dashboards
        conn.execute(
            r#"CREATE TABLE __dashboards (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL
            )"#,
            &[],
        )
        .expect("创建 __dashboards 表失败");

        // 创建父表 __saved_charts（dashboard_items 的 chart_id 外键依赖此表）
        conn.execute(
            r#"CREATE TABLE __saved_charts (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL
            )"#,
            &[],
        )
        .expect("创建 __saved_charts 表失败");

        // 创建子表 __dashboard_items，带 ON DELETE CASCADE 外键（与 dashboard_service 一致）
        conn.execute(
            r#"CREATE TABLE __dashboard_items (
                id TEXT PRIMARY KEY,
                dashboard_id TEXT NOT NULL,
                chart_id TEXT NOT NULL,
                FOREIGN KEY (dashboard_id) REFERENCES __dashboards(id) ON DELETE CASCADE,
                FOREIGN KEY (chart_id) REFERENCES __saved_charts(id) ON DELETE CASCADE
            )"#,
            &[],
        )
        .expect("创建 __dashboard_items 表失败");

        // 插入父记录：dashboard + chart
        conn.execute(
            "INSERT INTO __dashboards (id, name) VALUES ('d1', 'test_dashboard');",
            &[],
        )
        .expect("插入 dashboard 失败");
        conn.execute(
            "INSERT INTO __saved_charts (id, name) VALUES ('c1', 'test_chart');",
            &[],
        )
        .expect("插入 chart 失败");

        // 插入子记录（引用已存在的父记录，FK 约束通过）
        conn.execute(
            "INSERT INTO __dashboard_items (id, dashboard_id, chart_id) VALUES ('i1', 'd1', 'c1');",
            &[],
        )
        .expect("插入 dashboard_item 失败");

        // 验证子记录存在
        assert_eq!(
            query_scalar(&conn, "SELECT COUNT(*) FROM __dashboard_items;"),
            "1"
        );

        // 删除父记录 dashboard，应触发级联删除
        conn.execute("DELETE FROM __dashboards WHERE id = 'd1';", &[])
            .expect("删除 dashboard 失败");

        // 验证子记录被级联删除
        let count = query_scalar(&conn, "SELECT COUNT(*) FROM __dashboard_items;");
        assert_eq!(
            count, "0",
            "foreign_keys = ON 应使 __dashboard_items 随父记录级联删除"
        );
    }

    // ============================================================
    // 孤儿记录清理逻辑
    // 先关闭 foreign_keys 插入孤儿，开启后调用清理 SQL，验证孤儿被删除
    // ============================================================

    #[test]
    fn test_orphan_cleanup_sql() {
        let (conn, _temp_dir) = create_test_connection();

        // 创建与 dashboard_service::ensure_tables_exist 相同结构的三张表
        conn.execute(
            r#"CREATE TABLE __dashboards (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL
            )"#,
            &[],
        )
        .expect("创建 __dashboards 表失败");
        conn.execute(
            r#"CREATE TABLE __saved_charts (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL
            )"#,
            &[],
        )
        .expect("创建 __saved_charts 表失败");
        conn.execute(
            r#"CREATE TABLE __dashboard_items (
                id TEXT PRIMARY KEY,
                dashboard_id TEXT NOT NULL,
                chart_id TEXT NOT NULL,
                FOREIGN KEY (dashboard_id) REFERENCES __dashboards(id) ON DELETE CASCADE,
                FOREIGN KEY (chart_id) REFERENCES __saved_charts(id) ON DELETE CASCADE
            )"#,
            &[],
        )
        .expect("创建 __dashboard_items 表失败");

        // 关闭 foreign_keys 以插入孤儿记录（模拟开启 FK 前的历史数据）
        conn.execute("PRAGMA foreign_keys = OFF;", &[])
            .expect("关闭 foreign_keys 失败");

        // 插入孤儿记录：dashboard_id 和 chart_id 均不存在于父表
        conn.execute(
            "INSERT INTO __dashboard_items (id, dashboard_id, chart_id) \
             VALUES ('orphan1', 'nonexistent_dash', 'nonexistent_chart');",
            &[],
        )
        .expect("插入孤儿记录失败");

        // 重新开启 foreign_keys（SQLite 不会回溯校验已有数据，孤儿记录仍留存）
        conn.execute("PRAGMA foreign_keys = ON;", &[])
            .expect("开启 foreign_keys 失败");

        // 验证清理前孤儿记录存在
        assert_eq!(
            query_scalar(&conn, "SELECT COUNT(*) FROM __dashboard_items;"),
            "1",
            "清理前应有 1 条孤儿记录"
        );

        // 执行与 dashboard_service::ensure_tables_exist 相同的清理 SQL
        let orphan_cleanup_sql = r#"
            DELETE FROM __dashboard_items
            WHERE dashboard_id NOT IN (SELECT id FROM __dashboards)
               OR chart_id NOT IN (SELECT id FROM __saved_charts);
        "#;
        conn.execute(orphan_cleanup_sql, &[])
            .expect("执行孤儿清理 SQL 失败");

        // 验证孤儿记录已被删除
        let count = query_scalar(&conn, "SELECT COUNT(*) FROM __dashboard_items;");
        assert_eq!(count, "0", "清理后应无孤儿记录");
    }
}
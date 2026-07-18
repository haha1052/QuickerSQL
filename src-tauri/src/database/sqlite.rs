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
             PRAGMA busy_timeout=30000;"
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
             PRAGMA busy_timeout=30000;"
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

        Ok(QueryResult { columns: column_names, rows })
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
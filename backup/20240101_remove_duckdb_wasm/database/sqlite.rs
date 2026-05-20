use std::path::Path;
use std::sync::{Arc, Mutex};
use rusqlite::{Connection, OpenFlags};
use super::traits::*;

pub struct SqliteDriver;

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

        conn.execute_batch(
            "PRAGMA journal_mode=WAL;
             PRAGMA synchronous=NORMAL;
             PRAGMA cache_size=-20000;
             PRAGMA temp_store=MEMORY;"
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

        conn.execute_batch(
            "PRAGMA journal_mode=WAL;
             PRAGMA synchronous=NORMAL;
             PRAGMA cache_size=-20000;
             PRAGMA temp_store=MEMORY;"
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

    fn execute(&self, sql: &str, _params: &[&dyn ToSql]) -> Result<u64> {
        let conn = self.conn.lock().map_err(|e| DatabaseError::ConnectionFailed(e.to_string()))?;
        let result = conn.execute(sql, [])
            .map_err(|e| DatabaseError::QueryFailed(e.to_string()))?;
        Ok(result as u64)
    }

    fn query(&self, sql: &str, _params: &[&dyn ToSql]) -> Result<QueryResult> {
        let conn = self.conn.lock().map_err(|e| DatabaseError::ConnectionFailed(e.to_string()))?;
        let mut stmt = conn.prepare(sql)
            .map_err(|e| DatabaseError::PrepareFailed(e.to_string()))?;

        let column_names: Vec<String> = stmt.column_names().iter()
            .map(|s| s.to_string())
            .collect();

        let mut rows = Vec::new();
        let mut query_result = stmt.query([])
            .map_err(|e| DatabaseError::QueryFailed(e.to_string()))?;

        while let Ok(Some(row)) = query_result.next() {
            let mut row_data = Vec::new();
            for i in 0..column_names.len() {
                match row.get(i) {
                    Ok(val) => row_data.push(val),
                    Err(_) => row_data.push(String::from("NULL")),
                }
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
}
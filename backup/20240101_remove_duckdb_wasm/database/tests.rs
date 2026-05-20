use super::traits::*;
use super::sqlite::SqliteDriver;
use super::duckdb::DuckDbDriver;
use std::path::PathBuf;
use tempfile::tempdir;

#[test]
fn test_database_manager_register_driver() {
    let mut db_manager = DatabaseManager::new();
    db_manager.register_driver(Box::new(SqliteDriver::new()));
    
    let drivers = db_manager.get_available_drivers();
    assert_eq!(drivers.len(), 1);
    assert_eq!(drivers[0].get_driver_name(), "sqlite");
}

#[test]
fn test_sqlite_driver_connect() {
    let temp_dir = tempdir().expect("创建临时目录失败");
    let db_path = temp_dir.path().join("test.db");
    
    let driver = SqliteDriver::new();
    let result = driver.create_database(&db_path);
    
    assert!(result.is_ok());
    assert!(db_path.exists());
}

#[test]
fn test_sqlite_driver_connect_nonexistent() {
    let temp_dir = tempdir().expect("创建临时目录失败");
    let db_path = temp_dir.path().join("nonexistent.db");
    
    let driver = SqliteDriver::new();
    let result = driver.connect(&db_path);
    
    assert!(matches!(result.err(), Some(DatabaseError::FileNotFound)));
}

#[test]
fn test_database_connection_execute() {
    let temp_dir = tempdir().expect("创建临时目录失败");
    let db_path = temp_dir.path().join("test_execute.db");
    
    let driver = SqliteDriver::new();
    let conn = driver.create_database(&db_path).unwrap();
    
    let result = conn.execute("CREATE TABLE test (id INTEGER)", &[]);
    assert!(result.is_ok());
    
    let result = conn.execute("INSERT INTO test VALUES (1)", &[]);
    assert!(result.is_ok());
    assert_eq!(result.unwrap(), 1);
}

#[test]
fn test_database_connection_query() {
    let temp_dir = tempdir().expect("创建临时目录失败");
    let db_path = temp_dir.path().join("test_query.db");
    
    let driver = SqliteDriver::new();
    let conn = driver.create_database(&db_path).unwrap();
    
    conn.execute("CREATE TABLE test (id INTEGER, name TEXT)", &[]).unwrap();
    conn.execute("INSERT INTO test VALUES (1, 'test')", &[]).unwrap();
    
    let result = conn.query("SELECT * FROM test", &[]);
    assert!(result.is_ok());
    
    let query_result = result.unwrap();
    assert_eq!(query_result.columns, vec!["id", "name"]);
    assert_eq!(query_result.rows.len(), 1);
    assert_eq!(query_result.rows[0][1], "test");
}

#[test]
fn test_database_connection_transaction() {
    let temp_dir = tempdir().expect("创建临时目录失败");
    let db_path = temp_dir.path().join("test_transaction.db");
    
    let driver = SqliteDriver::new();
    let conn = driver.create_database(&db_path).unwrap();
    
    conn.execute("CREATE TABLE test (id INTEGER)", &[]).unwrap();
    
    conn.begin_transaction().unwrap();
    conn.execute("INSERT INTO test VALUES (1)", &[]).unwrap();
    conn.execute("INSERT INTO test VALUES (2)", &[]).unwrap();
    conn.commit_transaction().unwrap();
    
    let result = conn.query("SELECT COUNT(*) FROM test", &[]);
    assert!(result.is_ok());
    
    conn.begin_transaction().unwrap();
    conn.execute("INSERT INTO test VALUES (3)", &[]).unwrap();
    conn.rollback_transaction().unwrap();
    
    let result = conn.query("SELECT COUNT(*) FROM test", &[]);
    assert!(result.is_ok());
}

#[test]
fn test_database_manager_connect() {
    let temp_dir = tempdir().expect("创建临时目录失败");
    let db_path = temp_dir.path().join("test_manager.db");
    
    let mut db_manager = DatabaseManager::new();
    db_manager.register_driver(Box::new(SqliteDriver::new()));
    
    let result = db_manager.create_and_connect("sqlite", &db_path);
    assert!(result.is_ok());
    
    assert!(db_manager.is_connected());
    
    let conn = db_manager.get_connection().unwrap();
    assert_eq!(conn.get_database_type(), "sqlite");
}

#[test]
fn test_database_manager_connect_invalid_driver() {
    let db_manager = DatabaseManager::new();
    let db_path = PathBuf::from("/tmp/test.db");
    
    let result = db_manager.connect("nonexistent", &db_path);
    assert!(matches!(result.err(), Some(DatabaseError::ConnectionFailed(msg)) if msg.contains("未找到驱动")));
}

#[test]
fn test_database_manager_close_connection() {
    let temp_dir = tempdir().expect("创建临时目录失败");
    let db_path = temp_dir.path().join("test_close.db");
    
    let mut db_manager = DatabaseManager::new();
    db_manager.register_driver(Box::new(SqliteDriver::new()));
    
    db_manager.create_and_connect("sqlite", &db_path).unwrap();
    assert!(db_manager.is_connected());
    
    db_manager.close_connection();
    assert!(!db_manager.is_connected());
}

#[test]
fn test_database_manager_get_connection_not_connected() {
    let db_manager = DatabaseManager::new();

    let result = db_manager.get_connection();
    assert!(matches!(result.err(), Some(DatabaseError::DatabaseClosed)));
}

#[test]
fn test_sqlite_driver_connect_enables_wal() {
    use rusqlite::Connection;

    let temp_dir = tempdir().expect("创建临时目录失败");
    let db_path = temp_dir.path().join("test_wal_connect.db");

    let driver = SqliteDriver::new();

    driver.create_database(&db_path).expect("创建数据库失败");

    let conn = driver.connect(&db_path).expect("连接数据库失败");

    let check_wal: String = {
        let conn_internal = Connection::open(&db_path).expect("打开数据库失败");
        conn_internal
            .query_row("PRAGMA journal_mode", [], |row| row.get(0))
            .expect("查询 WAL 模式失败")
    };

    assert_eq!(check_wal, "wal", "connect() 应该启用 WAL 模式");

    drop(conn);
}

#[test]
fn test_sqlite_driver_connect_wal_persists() {
    use rusqlite::Connection;

    let temp_dir = tempdir().expect("创建临时目录失败");
    let db_path = temp_dir.path().join("test_wal_persist.db");

    let driver = SqliteDriver::new();

    driver.create_database(&db_path).expect("创建数据库失败");

    {
        let _conn = driver.connect(&db_path).expect("第一次连接失败");
    }

    {
        let _conn = driver.connect(&db_path).expect("第二次连接失败");

        let check_wal: String = {
            let conn_internal = Connection::open(&db_path).expect("打开数据库失败");
            conn_internal
                .query_row("PRAGMA journal_mode", [], |row| row.get(0))
                .expect("查询 WAL 模式失败")
        };

        assert_eq!(check_wal, "wal", "多次连接后 WAL 模式应该保持");
    }
}

#[test]
fn test_duckdb_driver_connect() {
    let temp_dir = tempdir().expect("创建临时目录失败");
    let db_path = temp_dir.path().join("test_duckdb.db");
    
    let driver = DuckDbDriver::new();
    let result = driver.create_database(&db_path);
    
    assert!(result.is_ok());
    assert!(db_path.exists());
}

#[test]
fn test_duckdb_driver_connect_nonexistent() {
    let temp_dir = tempdir().expect("创建临时目录失败");
    let db_path = temp_dir.path().join("nonexistent.db");
    
    let driver = DuckDbDriver::new();
    let result = driver.connect(&db_path);
    
    assert!(matches!(result.err(), Some(DatabaseError::FileNotFound)));
}

#[test]
fn test_duckdb_driver_create_database() {
    let temp_dir = tempdir().expect("创建临时目录失败");
    let db_path = temp_dir.path().join("test_create.db");
    
    let driver = DuckDbDriver::new();
    let result = driver.create_database(&db_path);
    
    assert!(result.is_ok());
    assert!(db_path.exists());
    
    let conn = result.unwrap();
    assert_eq!(conn.get_database_type(), "duckdb");
}

#[test]
fn test_duckdb_connection_execute() {
    let temp_dir = tempdir().expect("创建临时目录失败");
    let db_path = temp_dir.path().join("test_execute.db");
    
    let driver = DuckDbDriver::new();
    let conn = driver.create_database(&db_path).unwrap();
    
    let result = conn.execute("CREATE TABLE test (id INTEGER, name TEXT)", &[]);
    assert!(result.is_ok());
    
    let result = conn.execute("INSERT INTO test VALUES (1, 'test')", &[]);
    assert!(result.is_ok());
    assert_eq!(result.unwrap(), 1);
}

#[test]
fn test_duckdb_connection_query() {
    let temp_dir = tempdir().expect("创建临时目录失败");
    let db_path = temp_dir.path().join("test_query.db");
    
    let driver = DuckDbDriver::new();
    let conn = driver.create_database(&db_path).unwrap();
    
    conn.execute("CREATE TABLE test (id INTEGER, name TEXT)", &[]).unwrap();
    conn.execute("INSERT INTO test VALUES (1, 'test')", &[]).unwrap();
    conn.execute("INSERT INTO test VALUES (2, 'hello')", &[]).unwrap();
    
    let result = conn.query("SELECT * FROM test", &[]);
    assert!(result.is_ok());
    
    let query_result = result.unwrap();
    assert_eq!(query_result.columns, vec!["id", "name"]);
    assert_eq!(query_result.rows.len(), 2);
    assert_eq!(query_result.rows[0][1], "test");
    assert_eq!(query_result.rows[1][1], "hello");
}

#[test]
fn test_duckdb_connection_transaction() {
    let temp_dir = tempdir().expect("创建临时目录失败");
    let db_path = temp_dir.path().join("test_transaction.db");
    
    let driver = DuckDbDriver::new();
    let conn = driver.create_database(&db_path).unwrap();
    
    conn.execute("CREATE TABLE test (id INTEGER)", &[]).unwrap();
    
    conn.begin_transaction().unwrap();
    conn.execute("INSERT INTO test VALUES (1)", &[]).unwrap();
    conn.execute("INSERT INTO test VALUES (2)", &[]).unwrap();
    conn.commit_transaction().unwrap();
    
    let result = conn.query("SELECT COUNT(*) FROM test", &[]);
    assert!(result.is_ok());
    
    conn.begin_transaction().unwrap();
    conn.execute("INSERT INTO test VALUES (3)", &[]).unwrap();
    conn.rollback_transaction().unwrap();
    
    let result = conn.query("SELECT COUNT(*) FROM test", &[]);
    assert!(result.is_ok());
}

#[test]
fn test_duckdb_sqlite_scanner() {
    let temp_dir = tempdir().expect("创建临时目录失败");
    let sqlite_path = temp_dir.path().join("test_sqlite.db");
    let duckdb_path = temp_dir.path().join("test_duckdb_scanner.db");
    
    let sqlite_driver = SqliteDriver::new();
    let sqlite_conn = sqlite_driver.create_database(&sqlite_path).unwrap();
    
    sqlite_conn.execute("CREATE TABLE test_data (id INTEGER, name TEXT)", &[]).unwrap();
    sqlite_conn.execute("INSERT INTO test_data VALUES (1, 'sqlite_data')", &[]).unwrap();
    
    drop(sqlite_conn);
    
    let duckdb_driver = DuckDbDriver::new();
    let duckdb_conn = duckdb_driver.create_database(&duckdb_path).unwrap();
    
    let attach_sql = format!(
        "ATTACH '{}' AS sqlite_db (TYPE SQLITE);",
        sqlite_path.to_string_lossy()
    );
    let result = duckdb_conn.execute(&attach_sql, &[]);
    assert!(result.is_ok());
    
    let result = duckdb_conn.query("SELECT * FROM sqlite_db.test_data", &[]);
    assert!(result.is_ok());
    
    let query_result = result.unwrap();
    assert_eq!(query_result.columns, vec!["id", "name"]);
    assert_eq!(query_result.rows.len(), 1);
    assert_eq!(query_result.rows[0][1], "sqlite_data");
}

#[test]
fn test_database_manager_with_duckdb() {
    let temp_dir = tempdir().expect("创建临时目录失败");
    let db_path = temp_dir.path().join("test_manager_duckdb.db");
    
    let mut db_manager = DatabaseManager::new();
    db_manager.register_driver(Box::new(DuckDbDriver::new()));
    
    let result = db_manager.create_and_connect("duckdb", &db_path);
    assert!(result.is_ok());
    
    assert!(db_manager.is_connected());
    
    let conn = db_manager.get_connection().unwrap();
    assert_eq!(conn.get_database_type(), "duckdb");
}

#[test]
fn test_duckdb_driver_supports_wal() {
    let driver = DuckDbDriver::new();
    assert!(!driver.supports_wal());
}
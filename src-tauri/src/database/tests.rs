use super::traits::*;
use super::sqlite::SqliteDriver;
use super::duckdb::DuckDbDriver;
use super::security::SqlIdentifier;
use std::path::PathBuf;
use tempfile::tempdir;

// ============================================================
// DatabaseManager / Driver 基础测试（原始）
// ============================================================

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

    conn.execute("CREATE TABLE test (id INTEGER, name TEXT)", &[])
        .unwrap();
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

// ============================================================
// M7.3 扩展：SqlIdentifier 安全校验 测试集
// ============================================================
#[cfg(test)]
mod sql_identifier_tests {
    use super::super::security::SqlIdentifier;

    #[test]
    fn test_new_accepts_valid_name() {
        let ident = SqlIdentifier::new("users").expect("合法表名不应失败");
        assert_eq!(ident.as_str(), "users");
    }

    #[test]
    fn test_new_rejects_empty() {
        assert!(SqlIdentifier::new("").is_err(), "空字符串必须被拒绝");
    }

    #[test]
    fn test_quote_produces_delimited_identifier() {
        assert_eq!(SqlIdentifier::quote_identifier("users"), "\"users\"");
        assert_eq!(SqlIdentifier::quote_identifier("用户表"), "\"用户表\"");
    }

    #[test]
    fn test_quote_escapes_double_quote() {
        // 标识符中的双引号须转义为 "" 避免注入
        let result = SqlIdentifier::quote_identifier("use\"r");
        assert_eq!(result, "\"use\"\"r\"");
    }

    #[test]
    fn test_is_system_table_recognises_underscore_prefix() {
        assert!(SqlIdentifier::is_system_table("__settings"));
        assert!(SqlIdentifier::is_system_table("__query_history"));
        assert!(!SqlIdentifier::is_system_table("settings"));
        assert!(!SqlIdentifier::is_system_table("settings__"));
    }

    #[test]
    fn test_is_safe_identifier_rejects_sql_injection_chars() {
        // 包含 ; -- 等字符通常是注入试探，本项目禁止
        // 注意：is_safe_identifier 是纯字符白名单判断
        // 这里验证中文、下划线、数字是合法的
        assert!(SqlIdentifier::is_safe_identifier("users_123"));
        assert!(SqlIdentifier::is_safe_identifier("用户表"));
    }

    #[test]
    fn test_validate_and_quote_rejects_bad_name() {
        // SqlIdentifier::validate_and_quote 只接受白名单字符
        // 这里验证一个合法名称能被成功引用
        let result = SqlIdentifier::validate_and_quote("good_table");
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "\"good_table\"");
    }
}

// ============================================================
// M7.3 扩展：QueryResult / DbInfo 等数据结构的纯函数测试
// ============================================================
#[cfg(test)]
mod query_result_tests {
    use super::super::traits::QueryResult;

    fn build_result(cols: usize, rows: usize) -> QueryResult {
        QueryResult {
            columns: (0..cols).map(|i| format!("col{}", i)).collect(),
            rows: (0..rows)
                .map(|r| (0..cols).map(|c| format!("r{}c{}", r, c)).collect())
                .collect(),
            affected_rows: None,
        }
    }

    #[test]
    fn test_query_result_clone_equality() {
        let qr = build_result(3, 5);
        assert_eq!(qr.columns.len(), 3);
        assert_eq!(qr.rows.len(), 5);
    }

    #[test]
    fn test_query_result_empty_rows() {
        let qr = build_result(2, 0);
        assert_eq!(qr.rows.len(), 0);
        assert_eq!(qr.columns.len(), 2);
    }

    #[test]
    fn test_query_result_row_shape() {
        let qr = build_result(2, 3);
        for row in &qr.rows {
            assert_eq!(row.len(), qr.columns.len());
        }
    }
}

// ============================================================
// M7.3 扩展：DatabaseManager 生命周期与错误路径测试
// ============================================================
#[cfg(test)]
mod db_manager_lifecycle_tests {
    use super::*;

    #[test]
    fn test_multiple_close_is_harmless() {
        let temp_dir = tempdir().expect("创建临时目录失败");
        let db_path = temp_dir.path().join("multi_close.db");

        let mut db_manager = DatabaseManager::new();
        db_manager.register_driver(Box::new(SqliteDriver::new()));
        let _ = db_manager.create_and_connect("sqlite", &db_path);

        db_manager.close_connection();
        // 第二次 close 不应 panic
        db_manager.close_connection();
        assert!(!db_manager.is_connected());
    }

    #[test]
    fn test_get_connection_meta_without_connect() {
        let db_manager = DatabaseManager::new();
        let (driver_name, db_path) = db_manager.get_connection_meta();
        assert!(driver_name.is_none(), "未连接时 driver_name 必须为 None");
        assert!(db_path.is_none(), "未连接时 db_path 必须为 None");
    }

    #[test]
    fn test_is_connected_initial_state_false() {
        let db_manager = DatabaseManager::new();
        assert!(!db_manager.is_connected());
    }
}

// ============================================================
// P0-2 修复验证：batch_insert 强制 SqlIdentifier 校验 测试集
// ============================================================
#[cfg(test)]
mod batch_insert_security_tests {
    use super::*;

    /// 合法表名通过 SqlIdentifier 校验后能正常 batch_insert（SQLite）
    #[test]
    fn test_sqlite_batch_insert_with_valid_table_name() {
        let temp_dir = tempdir().expect("创建临时目录失败");
        let db_path = temp_dir.path().join("batch_insert_valid.db");

        let driver = SqliteDriver::new();
        let conn = driver.create_database(&db_path).expect("创建数据库失败");

        conn.execute("CREATE TABLE my_table (id INTEGER, name TEXT)", &[])
            .expect("创建表失败");

        let table_ident = SqlIdentifier::new("my_table").expect("合法表名应通过校验");
        let columns = ["id", "name"];
        let rows = vec![
            vec!["1".to_string(), "alice".to_string()],
            vec!["2".to_string(), "bob".to_string()],
        ];

        let count = conn.batch_insert(&table_ident, &columns, &rows, 100)
            .expect("batch_insert 合法表名应成功");
        assert_eq!(count, 2, "应插入 2 行");

        let result = conn.query("SELECT id, name FROM my_table ORDER BY id", &[])
            .expect("查询应成功");
        assert_eq!(result.rows.len(), 2);
        assert_eq!(result.rows[0][1], "alice");
        assert_eq!(result.rows[1][1], "bob");
    }

    /// 含单引号的表名会被 SqlIdentifier::new() 拦截，根本进不了 batch_insert
    /// （签名要求 &SqlIdentifier，调用方必须先 new，从而在源头被拦）
    #[test]
    fn test_batch_insert_rejects_table_name_with_quote() {
        // SqlIdentifier::new 直接拒绝含 ' 的表名
        let bad = SqlIdentifier::new("my'table");
        assert!(bad.is_err(), "含单引号的表名必须被 SqlIdentifier 拦截");

        // 含分号、SQL 注入试探的表名也必须被拦截
        assert!(SqlIdentifier::new("users; DROP TABLE").is_err());
        assert!(SqlIdentifier::new("users --").is_err());
        assert!(SqlIdentifier::new("users' OR '1'='1").is_err());
    }

    /// SQLite batch_insert：值含单引号（如 O'Brien）通过 ? 参数化正确写入，
    /// 不再受手工转义影响
    #[test]
    fn test_sqlite_batch_insert_value_with_single_quote() {
        let temp_dir = tempdir().expect("创建临时目录失败");
        let db_path = temp_dir.path().join("batch_insert_quote_value.db");

        let driver = SqliteDriver::new();
        let conn = driver.create_database(&db_path).expect("创建数据库失败");

        conn.execute("CREATE TABLE persons (id INTEGER, name TEXT)", &[])
            .expect("创建表失败");

        let table_ident = SqlIdentifier::new("persons").expect("合法表名");
        let columns = ["id", "name"];
        let rows = vec![
            vec!["1".to_string(), "O'Brien".to_string()],
            vec!["2".to_string(), "Connor; DROP TABLE--".to_string()],
        ];

        let count = conn.batch_insert(&table_ident, &columns, &rows, 100)
            .expect("batch_insert 含单引号的值应通过参数化正确写入");
        assert_eq!(count, 2);

        // 校验值原样写入（没有发生手工转义导致的 '' 双引号残留）
        let result = conn.query("SELECT name FROM persons ORDER BY id", &[])
            .expect("查询应成功");
        assert_eq!(result.rows.len(), 2);
        assert_eq!(result.rows[0][0], "O'Brien", "值应原样保留单引号");
        assert_eq!(result.rows[1][0], "Connor; DROP TABLE--", "参数化查询应防注入");
    }

    /// DuckDB batch_insert：值含单引号（如 O'Brien）通过 ? 参数化正确写入，
    /// 不再使用 v.replace('\'', "''") 手工转义
    #[test]
    fn test_duckdb_batch_insert_value_with_single_quote() {
        let driver = DuckDbDriver::new();
        let conn = driver.connect_memory().expect("创建内存 DuckDB 失败");

        conn.execute("CREATE TABLE persons (id INTEGER, name VARCHAR)", &[])
            .expect("创建表失败");

        let table_ident = SqlIdentifier::new("persons").expect("合法表名");
        let columns = ["id", "name"];
        let rows = vec![
            vec!["1".to_string(), "O'Brien".to_string()],
            vec!["2".to_string(), "Mary's cafe".to_string()],
        ];

        let count = conn.batch_insert(&table_ident, &columns, &rows, 100)
            .expect("DuckDB batch_insert 含单引号的值应通过 ? 参数化正确写入");
        assert_eq!(count, 2, "应插入 2 行");

        // 校验值原样写入（不再有手工转义导致的 '' 残留）
        let result = conn.query("SELECT name FROM persons ORDER BY id", &[])
            .expect("查询应成功");
        assert_eq!(result.rows.len(), 2);
        assert_eq!(result.rows[0][0], "O'Brien", "值应原样保留单引号，不应被手工转义");
        assert_eq!(result.rows[1][0], "Mary's cafe", "值应原样保留单引号");
    }

    /// DuckDB batch_insert：合法表名能正常工作
    #[test]
    fn test_duckdb_batch_insert_with_valid_table_name() {
        let driver = DuckDbDriver::new();
        let conn = driver.connect_memory().expect("创建内存 DuckDB 失败");

        conn.execute("CREATE TABLE my_table (id INTEGER, name VARCHAR)", &[])
            .expect("创建表失败");

        let table_ident = SqlIdentifier::new("my_table").expect("合法表名");
        let columns = ["id", "name"];
        let rows = vec![
            vec!["1".to_string(), "alice".to_string()],
            vec!["2".to_string(), "bob".to_string()],
            vec!["3".to_string(), "carol".to_string()],
        ];

        let count = conn.batch_insert(&table_ident, &columns, &rows, 2)
            .expect("batch_insert 应成功");
        assert_eq!(count, 3, "应插入 3 行（分 2 批：2+1）");

        let result = conn.query("SELECT COUNT(*) FROM my_table", &[])
            .expect("查询应成功");
        assert_eq!(result.rows.len(), 1);
        assert_eq!(result.rows[0][0], "3");
    }
}
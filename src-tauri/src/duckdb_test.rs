// DuckDB 兼容性测试
// 运行命令: cd src-tauri && cargo test --test duckdb_test -- --nocapture

use duckdb::Connection;

#[test]
fn test_duckdb_basic() {
    println!("[Test] 开始创建 DuckDB 连接...");
    let conn = Connection::open_in_memory().expect("无法创建 DuckDB 连接");
    println!("[Test] DuckDB 连接创建成功");

    println!("[Test] 执行简单查询...");
    let result: i32 = conn.query_row("SELECT 42 as num", [], |row| row.get(0))
        .expect("查询失败");
    println!("[Test] 查询结果: {}", result);
    assert_eq!(result, 42);
    println!("[Test] 测试通过!");
}
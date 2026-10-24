use super::traits::MutexGuardConnection;

/// 查询所有用户表名（排除系统表 __xxx）
///
/// 根据连接的数据库类型走不同的系统表查询：
/// - DuckDB: `information_schema.tables WHERE table_schema = 'main'`
/// - SQLite: `sqlite_master WHERE type='table'`
/// 两边都过滤 `__` 前缀的系统表。
pub fn list_user_table_names(conn: &MutexGuardConnection<'_>) -> Result<Vec<String>, String> {
    let db_type = conn.get_database_type();
    let result = if db_type.eq_ignore_ascii_case("duckdb") {
        conn.query(
            "SELECT table_name FROM information_schema.tables \
             WHERE table_schema = 'main' AND table_name NOT LIKE ? \
             ORDER BY table_name",
            &[&"\\_\\_%"],
        )
    } else {
        conn.query(
            "SELECT name FROM sqlite_master \
             WHERE type = 'table' AND name NOT LIKE ? \
             ORDER BY name",
            &[&"\\_\\_%"],
        )
    }.map_err(|e| format!("查询用户表名失败: {}", e))?;

    Ok(result
        .rows
        .iter()
        .map(|row| row.first().cloned().unwrap_or_default())
        .collect())
}
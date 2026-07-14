use super::traits::MutexGuardConnection;

/// 查询所有用户表名（排除系统表）
///
/// - 在 SQL 内通过 `NOT LIKE` 过滤 `__%` / `sqlite_%`
/// - 使用 `ESCAPE '\'` 确保 `_` 被当作字面量而非 LIKE 通配符
/// - 按 name 排序
pub fn list_user_table_names(conn: &MutexGuardConnection<'_>) -> Result<Vec<String>, String> {
    let result = conn
        .query(
            "SELECT name FROM sqlite_master WHERE type = 'table' \
             AND name NOT LIKE ? ESCAPE '\\' AND name NOT LIKE ? ORDER BY name",
            &[&"\\_\\_%", &"sqlite_%"],
        )
        .map_err(|e| format!("查询用户表名失败: {}", e))?;

    Ok(result
        .rows
        .iter()
        .map(|row| row.first().cloned().unwrap_or_default())
        .collect())
}

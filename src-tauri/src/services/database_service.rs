//! 表元信息查询服务
//!
//! 提供数据库表的列表（含行数/列数/是否系统表）、
//! 列元信息查询等基础业务逻辑。
//!
//! 所有 SQL 操作均通过 [`crate::database::SqlIdentifier`] 做安全校验，
//! 避免拼接标识符导致的 SQL 注入。

use crate::database::{SqlIdentifier, MutexGuardConnection};
use crate::models::database::{ColumnInfo, TableInfo, TableMetaInfo};

/// 数据库表元信息服务
pub struct DatabaseService;

impl DatabaseService {
    /// 查询数据库中所有表的基本信息
    ///
    /// 返回结果包含每张表的 `name / row_count / column_count / is_system_table`，
    /// 可直接序列化到前端渲染列表。
    pub fn list_tables_with_meta(
        conn: &MutexGuardConnection,
    ) -> Result<Vec<TableInfo>, String> {
        let result = conn
            .query(
                "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
                &[],
            )
            .map_err(|e| format!("获取表列表失败: {}", e))?;

        let names: Vec<String> = result
            .rows
            .into_iter()
            .filter(|row| !row.is_empty())
            .map(|row| row[0].clone())
            .filter(|name| !name.starts_with("__trash_") && !name.starts_with("sqlite_"))
            .collect();

        let mut tables = Vec::with_capacity(names.len());

        for name in names {
            // 系统表判断（与 SqlIdentifier::is_system_table 保持一致）
            let is_system_table = SqlIdentifier::is_system_table(&name);

            // 行/列数查询—— 失败时降级为 0，不中断整体列表返回
            let row_count =
                Self::get_row_count_safe(conn, &name).unwrap_or(0);
            let column_count =
                Self::get_column_count_safe(conn, &name).unwrap_or(0);

            tables.push(TableInfo {
                name,
                row_count,
                column_count,
                is_system_table,
            });
        }

        Ok(tables)
    }

    /// 查询指定表的列元信息（`PRAGMA table_info`）
    pub fn get_columns(
        conn: &MutexGuardConnection,
        table_name: &str,
    ) -> Result<Vec<ColumnInfo>, String> {
        let ident = SqlIdentifier::new(table_name)?;
        let sql = format!("PRAGMA table_info({})", ident.quoted());

        let result = conn
            .query(&sql, &[])
            .map_err(|e| format!("查询列信息失败: {}", e))?;

        let columns: Vec<ColumnInfo> = result
            .rows
            .into_iter()
            .filter(|row| row.len() >= 6)
            .map(|row| {
                // PRAGMA table_info 返回: cid | name | type | notnull | dflt_value | pk
                let position = row[0].parse::<i64>().unwrap_or(0);
                let name = row[1].clone();
                let data_type = if row[2].is_empty() {
                    "UNKNOWN".to_string()
                } else {
                    row[2].clone()
                };
                let notnull_raw = row[3].clone();
                let nullable = !(notnull_raw == "1" || notnull_raw.to_uppercase() == "TRUE");
                let default_value = if row[4].is_empty() {
                    None
                } else {
                    Some(row[4].clone())
                };
                let pk_raw = row[5].clone();
                let is_primary_key = pk_raw == "1" || pk_raw.to_uppercase() == "TRUE";

                ColumnInfo {
                    name,
                    data_type,
                    nullable,
                    default_value,
                    is_primary_key,
                    position,
                }
            })
            .collect();

        Ok(columns)
    }

    /// 获取表行数（内部使用 —— 单条失败时吞掉错误并返回 0，保证列表不中断）
    fn get_row_count_safe(conn: &MutexGuardConnection, table_name: &str) -> Result<i64, ()> {
        if !SqlIdentifier::is_safe_identifier(table_name) {
            return Err(());
        }
        let safe_name = SqlIdentifier::quote_identifier(table_name);
        let sql = format!("SELECT COUNT(*) FROM {}", safe_name);

        conn.query(&sql, &[])
            .ok()
            .and_then(|r| r.rows.first().and_then(|row| row[0].parse::<i64>().ok()))
            .ok_or(())
    }

    /// 获取表列数（内部使用 —— 单条失败时吞掉错误并返回 0）
    fn get_column_count_safe(conn: &MutexGuardConnection, table_name: &str) -> Result<i64, ()> {
        if !SqlIdentifier::is_safe_identifier(table_name) {
            return Err(());
        }
        let safe_name = SqlIdentifier::quote_identifier(table_name);
        let sql = format!("PRAGMA table_info({})", safe_name);

        conn.query(&sql, &[])
            .ok()
            .map(|r| r.rows.len() as i64)
            .ok_or(())
    }

    // ============================================================
    // A-3: 启动汇总辅助方法（Startup 聚合调用）
    // ============================================================

    /// 获取数据库状态的精简版（仅 sqlite_master 表类型计数）
    ///
    /// - 使用参数化查询（SQL 字面量 `'table'` 直接写入，无拼接）
    /// - 返回 `(is_connected, path, table_count)`
    pub fn get_database_status_lite(
        conn: &MutexGuardConnection,
        db_path: &str,
    ) -> Result<(bool, String, i64), String> {
        let table_count = conn
            .query(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = ?",
                &[&"table"],
            )
            .map_err(|e| format!("查询数据库状态失败: {}", e))?
            .rows
            .first()
            .and_then(|row| row.first())
            .and_then(|s| s.parse::<i64>().ok())
            .unwrap_or(0);

        Ok((true, db_path.to_string(), table_count))
    }

    /// 查询所有用户表名（排除系统表）
    ///
    /// - 在 SQL 内通过 `NOT LIKE` 过滤 `__%` / `sqlite_%`
    /// - 按 name 排序
    pub fn list_user_tables(
        conn: &MutexGuardConnection,
    ) -> Result<Vec<String>, String> {
        let result = conn
            .query(
                "SELECT name FROM sqlite_master WHERE type = 'table' \
                 AND name NOT LIKE ? AND name NOT LIKE ? ORDER BY name",
                &[&"__%", &"sqlite_%"],
            )
            .map_err(|e| format!("查询用户表名失败: {}", e))?;

        Ok(result.rows.iter().map(|row| row.first().cloned().unwrap_or_default()).collect())
    }

    // ============================================================
    // B-1: 表管理方法集
    // ============================================================

    /// 查询指定表的行数（`SELECT COUNT(*)`）。
    ///
    /// 表名会经过 [`SqlIdentifier::new`] 校验并通过 `quote_identifier` 引用。
    pub fn get_row_count(
        conn: &MutexGuardConnection,
        table_name: &str,
    ) -> Result<i64, String> {
        let ident = SqlIdentifier::new(table_name)?;
        let sql = format!("SELECT COUNT(*) FROM {}", ident.quoted());
        let result = conn
            .query(&sql, &[])
            .map_err(|e| format!("查询行数失败: {}", e))?;

        result
            .rows
            .first()
            .and_then(|row| row[0].parse::<i64>().ok())
            .ok_or_else(|| "未获取到行数".to_string())
    }

    /// 查询指定表的列数（`PRAGMA table_info`）。
    pub fn get_column_count(
        conn: &MutexGuardConnection,
        table_name: &str,
    ) -> Result<i64, String> {
        let ident = SqlIdentifier::new(table_name)?;
        let sql = format!("PRAGMA table_info({})", ident.quoted());
        let result = conn
            .query(&sql, &[])
            .map_err(|e| format!("查询列数失败: {}", e))?;
        Ok(result.rows.len() as i64)
    }

    /// 查询指定表的列元信息（返回 [`ColumnInfo`] 列表）。
    ///
    /// 与 [`get_columns`](Self::get_columns) 等价，用于命名统一。
    pub fn get_table_columns(
        conn: &MutexGuardConnection,
        table_name: &str,
    ) -> Result<Vec<ColumnInfo>, String> {
        Self::get_columns(conn, table_name)
    }

    /// 查询指定表的元信息（行数+列数+是否系统表）。
    pub fn get_table_meta(
        conn: &MutexGuardConnection,
        table_name: &str,
    ) -> Result<TableInfo, String> {
        let ident = SqlIdentifier::new(table_name)?;
        let row_count = Self::get_row_count(conn, ident.as_str()).unwrap_or(0);
        let column_count = Self::get_column_count(conn, ident.as_str()).unwrap_or(0);
        Ok(TableInfo {
            name: ident.as_str().to_string(),
            row_count,
            column_count,
            is_system_table: ident.is_system(),
        })
    }

    /// 查询表的扩展元信息（索引数量 + 估算存储大小）。
    ///
    /// 大小估算逻辑：`page_size × (page_count − freelist_count) ÷ table_count`
    /// （每张表平均占用的磁盘字节数，粗粒度估算）。
    pub fn get_table_performance_info(
        conn: &MutexGuardConnection,
        table_name: &str,
    ) -> Result<TableMetaInfo, String> {
        let ident = SqlIdentifier::new(table_name)?;

        // 1) 索引数量：PRAGMA index_list
        let index_sql = format!("PRAGMA index_list({})", ident.quoted());
        let index_count = match conn.query(&index_sql, &[]) {
            Ok(result) => result.rows.len() as i64,
            Err(_) => 0,
        };

        // 2) 估算大小：数据库实际使用空间 / 表数量的粗略平均值
        let size_bytes = {
            let page_size = conn
                .query("PRAGMA page_size", &[])
                .ok()
                .and_then(|r| r.rows.first().and_then(|row| row[0].parse::<i64>().ok()))
                .unwrap_or(4096);
            let page_count = conn
                .query("PRAGMA page_count", &[])
                .ok()
                .and_then(|r| r.rows.first().and_then(|row| row[0].parse::<i64>().ok()))
                .unwrap_or(0);
            let freelist_count = conn
                .query("PRAGMA freelist_count", &[])
                .ok()
                .and_then(|r| r.rows.first().and_then(|row| row[0].parse::<i64>().ok()))
                .unwrap_or(0);

            let used_pages = page_count.saturating_sub(freelist_count);
            let total_used_size = page_size.saturating_mul(used_pages);

            let table_count = conn
                .query("SELECT COUNT(*) FROM sqlite_master WHERE type='table'", &[])
                .ok()
                .and_then(|r| r.rows.first().and_then(|row| row[0].parse::<i64>().ok()))
                .unwrap_or(1);
            if table_count > 0 {
                total_used_size / table_count.max(1)
            } else {
                0
            }
        };

        Ok(TableMetaInfo { index_count, size_bytes })
    }

    /// 删除表（返回表名+删除前记录的行数）。
    ///
    /// - 系统表禁止删除
    /// - 先执行 `SELECT COUNT(*)` 记录行数（用于审计日志）
    /// - 再执行 `DROP TABLE`
    pub fn drop_table_safe(
        conn: &MutexGuardConnection,
        table_name: &str,
    ) -> Result<(String, i64), String> {
        let ident = SqlIdentifier::new(table_name)?;
        if ident.is_system() {
            return Err(format!("系统表 '{}' 不允许删除或修改", ident.as_str()));
        }

        // 先记录行数
        let row_count = Self::get_row_count(conn, ident.as_str()).unwrap_or(0);

        let drop_sql = format!("DROP TABLE {}", ident.quoted());
        conn.execute(&drop_sql, &[])
            .map_err(|e| format!("删除表失败: {}", e))?;

        Ok((ident.as_str().to_string(), row_count))
    }

    /// 重命名表（`ALTER TABLE ... RENAME TO ...`）。
    ///
    /// - 两个名字均经 [`SqlIdentifier::new`] 校验
    /// - 旧表必须存在，新表必须不存在
    pub fn rename_table_safe(
        conn: &MutexGuardConnection,
        old_name: &str,
        new_name: &str,
    ) -> Result<(), String> {
        let old_ident = SqlIdentifier::new(old_name)?;
        let new_ident = SqlIdentifier::new(new_name)?;

        // 旧表必须存在
        let exists_sql = format!(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name = ?"
        );
        let old_name_str = old_ident.as_str().to_string();
        let params_old: [&dyn crate::database::ToSql; 1] = [&old_name_str];
        let exists_result = conn
            .query(&exists_sql, &params_old)
            .map_err(|e| format!("检查表存在失败: {}", e))?;
        let old_exists = exists_result
            .rows
            .first()
            .and_then(|row| row[0].parse::<i64>().ok())
            .unwrap_or(0)
            > 0;
        if !old_exists {
            return Err(format!("表 '{}' 不存在", old_ident.as_str()));
        }

        // 新表必须不存在
        let new_name_str = new_ident.as_str().to_string();
        let params_new: [&dyn crate::database::ToSql; 1] = [&new_name_str];
        let new_exists_result = conn
            .query(&exists_sql, &params_new)
            .map_err(|e| format!("检查表冲突失败: {}", e))?;
        let new_exists = new_exists_result
            .rows
            .first()
            .and_then(|row| row[0].parse::<i64>().ok())
            .unwrap_or(0)
            > 0;
        if new_exists {
            return Err(format!("表 '{}' 已存在，请使用其他名称", new_ident.as_str()));
        }

        let rename_sql = format!(
            "ALTER TABLE {} RENAME TO {}",
            old_ident.quoted(),
            new_ident.quoted()
        );
        conn.execute(&rename_sql, &[])
            .map_err(|e| format!("重命名表失败: {}", e))?;
        Ok(())
    }

    /// 创建视图（`CREATE VIEW <view_name> AS <source_sql>`）。
    ///
    /// - `view_name` 必须通过 [`SqlIdentifier::new`] 校验
    /// - `source_sql` 是用户提供的完整 SELECT 查询定义，直接字符串拼接
    ///   （因为它是视图定义而非参数绑定）
    pub fn create_view(
        conn: &MutexGuardConnection,
        view_name: &str,
        source_sql: &str,
    ) -> Result<(), String> {
        let ident = SqlIdentifier::new(view_name)?;
        let sql = format!("CREATE VIEW {} AS {}", ident.quoted(), source_sql);
        conn.execute(&sql, &[])
            .map_err(|e| format!("创建视图失败: {}", e))?;
        Ok(())
    }

    // ============================================================
    // B-2: 文件导入相关 DDL 方法
    // ============================================================

    /// `DROP TABLE IF EXISTS <table_name>`
    pub fn drop_table_if_exists(
        conn: &MutexGuardConnection,
        table_name: &str,
    ) -> Result<(), String> {
        let ident = SqlIdentifier::new(table_name)?;
        let sql = format!("DROP TABLE IF EXISTS {}", ident.quoted());
        conn.execute(&sql, &[])
            .map_err(|e| format!("删除表失败: {}", e))?;
        Ok(())
    }

    /// 根据 `(column_name, data_type)` 元组列表创建表。
    ///
    /// - 所有列名均经 [`SqlIdentifier::new`] 校验
    /// - 数据类型走白名单检查（TEXT / INTEGER / REAL / BLOB / VARCHAR(n) /
    ///   DATE / DATETIME / DECIMAL(p,s) / BOOLEAN，大小写不敏感）
    pub fn create_table_from_schema(
        conn: &MutexGuardConnection,
        table_name: &str,
        columns: &[(String, String)],
    ) -> Result<(), String> {
        let table_ident = SqlIdentifier::new(table_name)?;

        let mut col_defs = Vec::with_capacity(columns.len());
        for (col_name, col_type) in columns {
            let col_ident = SqlIdentifier::new(col_name)
                .map_err(|e| format!("无效的列名 '{}': {}", col_name, e))?;
            let normalized_type = validate_data_type(col_type)
                .ok_or_else(|| format!("不支持的数据类型: {}", col_type))?;
            col_defs.push(format!("{} {}", col_ident.quoted(), normalized_type));
        }

        let sql = format!(
            "CREATE TABLE {} ({})",
            table_ident.quoted(),
            col_defs.join(", ")
        );
        conn.execute(&sql, &[])
            .map_err(|e| format!("创建表失败: {}", e))?;
        Ok(())
    }

    /// 执行批量 INSERT：每一行都使用参数绑定（`?` 占位符）。
    ///
    /// 返回成功插入的总行数（等于 `rows.len()`，否则返回 Err）。
    pub fn batch_insert_rows(
        conn: &MutexGuardConnection,
        table_name: &str,
        columns: &[String],
        rows: &[Vec<String>],
    ) -> Result<usize, String> {
        let table_ident = SqlIdentifier::new(table_name)?;

        let mut quoted_cols = Vec::with_capacity(columns.len());
        for col in columns {
            let col_ident = SqlIdentifier::new(col)
                .map_err(|e| format!("无效的列名 '{}': {}", col, e))?;
            quoted_cols.push(col_ident.quoted());
        }

        if rows.is_empty() {
            return Ok(0);
        }

        // 验证所有行的列数一致
        for (idx, row) in rows.iter().enumerate() {
            if row.len() != columns.len() {
                return Err(format!(
                    "第 {} 行数据列数 {} 与目标列数 {} 不匹配",
                    idx + 1,
                    row.len(),
                    columns.len()
                ));
            }
        }

        // 使用批量插入：一次插入多行，显著提升性能
        let batch_size = 100;
        let mut total = 0usize;

        for batch in rows.chunks(batch_size) {
            // 构建批量插入的 SQL: INSERT INTO table (cols) VALUES (row1), (row2), ...
            let row_placeholders: Vec<String> = std::iter::repeat(format!(
                "({})",
                std::iter::repeat("?").take(columns.len()).collect::<Vec<_>>().join(", ")
            ))
            .take(batch.len())
            .collect();

            let sql = format!(
                "INSERT INTO {} ({}) VALUES {}",
                table_ident.quoted(),
                quoted_cols.join(", "),
                row_placeholders.join(", ")
            );

            // 扁平化参数
            let params: Vec<&dyn crate::database::ToSql> = batch
                .iter()
                .flat_map(|row| row.iter().map(|s| s as &dyn crate::database::ToSql))
                .collect();

            conn.execute(&sql, &params)
                .map_err(|e| format!("批量插入失败: {}", e))?;
            total += batch.len();
        }

        Ok(total)
    }

    /// 使用 DuckDB COPY 命令快速导入 CSV 文件
    /// 
    /// COPY 命令是 DuckDB 原生支持的最快导入方式，直接从文件读取数据，无需先加载到内存
    pub fn fast_import_csv(
        conn: &MutexGuardConnection,
        table_name: &str,
        file_path: &str,
        has_header: bool,
    ) -> Result<usize, String> {
        let table_ident = SqlIdentifier::new(table_name)?;
        
        // 处理 Windows 路径（需要转义反斜杠）
        let escaped_path = file_path.replace('\\', "\\\\");
        
        // DuckDB COPY 命令格式
        // COPY table_name FROM 'file_path' WITH (FORMAT CSV, HEADER, DELIMITER ',')
        let sql = if has_header {
            format!(
                "COPY {} FROM '{}' WITH (FORMAT CSV, HEADER, DELIMITER ',', QUOTE '\"', ESCAPE '\"')",
                table_ident.quoted(),
                escaped_path
            )
        } else {
            format!(
                "COPY {} FROM '{}' WITH (FORMAT CSV, DELIMITER ',', QUOTE '\"', ESCAPE '\"')",
                table_ident.quoted(),
                escaped_path
            )
        };
        
        log::info!("执行 COPY 命令: {}", sql);
        
        conn.execute(&sql, &[])
            .map_err(|e| format!("COPY 命令执行失败: {}", e))?;
        
        // 获取插入的行数
        Self::get_row_count(conn, table_name)
            .map(|count| count as usize)
            .map_err(|e| format!("获取行数失败: {}", e))
    }
}

/// 数据类型白名单检查
///
/// 允许：`TEXT` / `INTEGER` / `REAL` / `BLOB` / `VARCHAR(n)` /
/// `DATE` / `DATETIME` / `DECIMAL(p,s)` / `BOOLEAN`（大小写不敏感）
fn validate_data_type(raw: &str) -> Option<String> {
    let upper = raw.trim().to_uppercase();
    if upper.is_empty() {
        return None;
    }

    // 纯关键字
    let simple = matches!(
        upper.as_str(),
        "TEXT" | "INTEGER" | "INT" | "REAL" | "FLOAT" | "DOUBLE"
            | "BLOB" | "DATE" | "DATETIME" | "TIMESTAMP" | "BOOLEAN" | "BOOL"
            | "NUMERIC" | "CHAR" | "NCHAR" | "CLOB" | "VARCHAR" | "NVARCHAR"
    );
    if simple {
        return Some(upper);
    }

    // VARCHAR(n) / CHAR(n) / DECIMAL(p,s) / NUMERIC(p,s)
    if let Some(inner) = upper.strip_prefix("VARCHAR")
        .or_else(|| upper.strip_prefix("NVARCHAR"))
        .or_else(|| upper.strip_prefix("CHAR"))
        .or_else(|| upper.strip_prefix("NCHAR"))
    {
        let trimmed = inner.trim();
        if trimmed.starts_with('(') && trimmed.ends_with(')') {
            let inside = &trimmed[1..trimmed.len() - 1];
            if inside.split(',').all(|part| part.trim().parse::<u32>().is_ok()) {
                return Some(upper);
            }
        }
        return None;
    }
    if let Some(inner) = upper.strip_prefix("DECIMAL")
        .or_else(|| upper.strip_prefix("NUMERIC"))
    {
        let trimmed = inner.trim();
        if trimmed.starts_with('(') && trimmed.ends_with(')') {
            let inside = &trimmed[1..trimmed.len() - 1];
            let parts: Vec<&str> = inside.split(',').map(|p| p.trim()).collect();
            if parts.len() <= 2 && parts.iter().all(|p| p.parse::<u32>().is_ok()) {
                return Some(upper);
            }
        }
        return None;
    }

    None
}

#[cfg(test)]
mod tests {
    use super::validate_data_type;

    #[test]
    fn test_validate_data_type_simple() {
        assert!(validate_data_type("TEXT").is_some());
        assert!(validate_data_type("INTEGER").is_some());
        assert!(validate_data_type("integer").is_some());
        assert!(validate_data_type("BOOLEAN").is_some());
        assert!(validate_data_type("DATE").is_some());
        assert!(validate_data_type("DATETIME").is_some());
        assert!(validate_data_type("BLOB").is_some());
        assert!(validate_data_type("REAL").is_some());
    }

    #[test]
    fn test_validate_data_type_param() {
        assert!(validate_data_type("VARCHAR(255)").is_some());
        assert!(validate_data_type("CHAR(10)").is_some());
        assert!(validate_data_type("DECIMAL(10,2)").is_some());
        assert!(validate_data_type("NUMERIC(5)").is_some());
    }

    #[test]
    fn test_validate_data_type_negative() {
        assert!(validate_data_type("").is_none());
        assert!(validate_data_type("INT); DROP TABLE").is_none());
        assert!(validate_data_type("VARCHAR(abc)").is_none());
        assert!(validate_data_type("VARCHAR(1,2,3)").is_some());
        assert!(validate_data_type("DECIMAL").is_none());
    }
}
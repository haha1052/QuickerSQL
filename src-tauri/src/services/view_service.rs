//! VIEW 同步服务
//! 负责在导入或删除表时，自动同步 DuckDB 的 VIEW

use crate::database::{SqlIdentifier, DatabaseConnection};
use log;

/// ViewService，管理 DuckDB VIEW 的同步
pub struct ViewService;

impl ViewService {
    /// 为指定的单个表创建或更新 VIEW
    /// 
    /// # Arguments
    /// * `conn` - DuckDB 数据库连接
    /// * `table_name` - 需要创建 VIEW 的表名
    /// 
    /// # Returns
    /// * `Result<(), String>` - 成功返回 Ok，失败返回错误信息
    pub fn refresh_single_view(
        conn: &Box<dyn DatabaseConnection>,
        table_name: &str,
    ) -> Result<(), String> {
        // 验证表名安全
        if !SqlIdentifier::is_safe_identifier(table_name) {
            log::warn!("跳过不安全的表名: {}", table_name);
            return Err(format!("不安全的表名: {}", table_name));
        }

        // 创建 VIEW 的 SQL
        let quoted_table = SqlIdentifier::quote_identifier(table_name);
        let create_view_sql = format!(
            "CREATE OR REPLACE VIEW {} AS SELECT * FROM sqlite_db.{}",
            quoted_table,
            quoted_table
        );

        // 执行创建 VIEW
        conn.execute(&create_view_sql, &[])
            .map_err(|e| {
                log::warn!("为表 '{}' 创建 VIEW 失败: {}", table_name, e);
                format!("创建 VIEW 失败: {}", e)
            })?;

        log::debug!("为表 '{}' 成功更新 VIEW", table_name);
        Ok(())
    }

    /// 删除指定表的 VIEW
    /// 
    /// # Arguments
    /// * `conn` - DuckDB 数据库连接
    /// * `table_name` - 需要删除 VIEW 的表名
    /// 
    /// # Returns
    /// * `Result<(), String>` - 成功返回 Ok，失败返回错误信息
    pub fn drop_single_view(
        conn: &Box<dyn DatabaseConnection>,
        table_name: &str,
    ) -> Result<(), String> {
        // 验证表名安全
        if !SqlIdentifier::is_safe_identifier(table_name) {
            log::warn!("跳过不安全的表名: {}", table_name);
            return Err(format!("不安全的表名: {}", table_name));
        }

        let quoted_table = SqlIdentifier::quote_identifier(table_name);
        let drop_view_sql = format!("DROP VIEW IF EXISTS {}", quoted_table);

        conn.execute(&drop_view_sql, &[])
            .map_err(|e| {
                log::warn!("为表 '{}' 删除 VIEW 失败: {}", table_name, e);
                format!("删除 VIEW 失败: {}", e)
            })?;

        log::debug!("为表 '{}' 成功删除 VIEW", table_name);
        Ok(())
    }

    /// 重新同步所有表的 VIEW（完整刷新）
    /// 
    /// # Arguments
    /// * `conn` - DuckDB 数据库连接
    /// * `table_names` - 从 SQLite 获取的表名列表（避免依赖 DuckDB 的元数据系统）
    /// 
    /// # Returns
    /// * `Result<usize, String>` - 成功返回成功创建的 VIEW 数量
    pub fn refresh_all_views(
        conn: &Box<dyn DatabaseConnection>,
        table_names: &[String],
    ) -> Result<usize, String> {
        let mut success_count = 0;
        for table_name in table_names {
            if Self::refresh_single_view(conn, table_name).is_ok() {
                success_count += 1;
            }
        }

        log::info!("VIEW 刷新完成，成功创建 {}/{} 个 VIEW", success_count, table_names.len());
        Ok(success_count)
    }
}

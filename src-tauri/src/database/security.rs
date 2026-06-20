use super::traits::DatabaseError;

/// SQL 标识符安全处理
///
/// 通过 [`SqlIdentifier::new`] 构造实例，
/// 通过 [`quote_identifier`](SqlIdentifier::quote_identifier) 获取已引用字符串，
/// 通过 [`is_system_table`](SqlIdentifier::is_system_table) 判断是否系统表。
pub struct SqlIdentifier {
    name: String,
}

impl SqlIdentifier {
    /// 构造一个已完成安全校验的标识符实例
    ///
    /// - 空字符串 → Err
    /// - 包含非安全字符（';'、'--'、空白、引号等）→ Err
    pub fn new(name: &str) -> Result<Self, String> {
        if name.is_empty() {
            return Err("标识符不能为空".to_string());
        }
        if !Self::is_safe_identifier(name) {
            return Err(format!("无效的表/列名: {}", name));
        }
        Ok(SqlIdentifier { name: name.to_string() })
    }

    /// 返回原始（未被引用）的名称
    pub fn as_str(&self) -> &str {
        &self.name
    }

    /// 验证表名是否安全
    pub fn is_safe_identifier(name: &str) -> bool {
        if name.is_empty() {
            return false;
        }

        // 检查是否只包含安全字符
        name.chars().all(|c| {
            c.is_ascii_alphanumeric() || c == '_' || c == '.' || c == '-' ||
            (c >= '\u{4e00}' && c <= '\u{9fff}') // 中文字符
        })
    }

    /// 判断是否为系统表
    ///
    /// **统一规则**：系统表必须以 `__`（双下划线）开头，或为 SQLite 内置表（`sqlite_` 前缀）。
    /// 所有系统功能表（设置、应用状态、工作区、回收站、审计日志、查询历史）都必须遵循 `__` 前缀规范。
    pub fn is_system_table(name: &str) -> bool {
        let trimmed = name.trim().trim_matches(|c: char| c == '"' || c == '\'');
        trimmed.starts_with("__") || trimmed.starts_with("sqlite_")
    }

    /// 判断当前标识符是否为系统表
    pub fn is_system(&self) -> bool {
        Self::is_system_table(&self.name)
    }

    /// 安全引用标识符（DuckDB/SQLite 兼容）（关联方法）
    pub fn quote_identifier(name: &str) -> String {
        format!("\"{}\"", name.replace('\"', "\"\""))
    }

    /// 返回当前标识符被引用后的形式（实例方法）
    pub fn quoted(&self) -> String {
        Self::quote_identifier(&self.name)
    }

    /// 验证并引用标识符
    pub fn validate_and_quote(name: &str) -> Result<String, DatabaseError> {
        if !Self::is_safe_identifier(name) {
            return Err(DatabaseError::Unknown(
                format!("Invalid table/column name: {}", name)
            ));
        }
        Ok(Self::quote_identifier(name))
    }
}

impl From<SqlIdentifier> for String {
    fn from(value: SqlIdentifier) -> Self {
        value.name
    }
}

impl AsRef<str> for SqlIdentifier {
    fn as_ref(&self) -> &str {
        &self.name
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_safe_identifiers() {
        assert!(SqlIdentifier::is_safe_identifier("users"));
        assert!(SqlIdentifier::is_safe_identifier("user_table_123"));
        assert!(SqlIdentifier::is_safe_identifier("用户表"));
        assert!(SqlIdentifier::is_safe_identifier("_table"));
    }
    
    #[test]
    fn test_unsafe_identifiers() {
        assert!(!SqlIdentifier::is_safe_identifier(""));
        assert!(!SqlIdentifier::is_safe_identifier("users; DROP TABLE"));
        assert!(!SqlIdentifier::is_safe_identifier("users --"));
        assert!(!SqlIdentifier::is_safe_identifier("users' OR '1'='1"));
        assert!(!SqlIdentifier::is_safe_identifier("users\" OR \"1\"=\"1"));
    }
    
    #[test]
    fn test_quote_identifier() {
        assert_eq!(SqlIdentifier::quote_identifier("users"), "\"users\"");
        assert_eq!(SqlIdentifier::quote_identifier("user\"table"), "\"user\"\"table\"");
        assert_eq!(SqlIdentifier::quote_identifier("用户表"), "\"用户表\"");
    }

    #[test]
    fn test_is_system_table() {
        // 标准系统表（__ 前缀）
        assert!(SqlIdentifier::is_system_table("__settings"));
        assert!(SqlIdentifier::is_system_table("__app_state"));
        assert!(SqlIdentifier::is_system_table("__workspace_tabs"));
        assert!(SqlIdentifier::is_system_table("__workspace_panels"));
        assert!(SqlIdentifier::is_system_table("__trash_metadata"));
        assert!(SqlIdentifier::is_system_table("__trash_123"));
        assert!(SqlIdentifier::is_system_table("__audit_logs"));
        assert!(SqlIdentifier::is_system_table("__query_history"));

        // SQLite 内置表
        assert!(SqlIdentifier::is_system_table("sqlite_master"));
        assert!(SqlIdentifier::is_system_table("sqlite_sequence"));

        // 带引号的表名
        assert!(SqlIdentifier::is_system_table("\"__settings\""));

        // 旧版命名（无前缀或单下划线）：现在统一视为普通用户表
        // 这些表在应用启动时通过迁移机制自动重命名为 __ 前缀版本
        assert!(!SqlIdentifier::is_system_table("query_history"));
        assert!(!SqlIdentifier::is_system_table("audit_log"));
        assert!(!SqlIdentifier::is_system_table("_settings"));
        assert!(!SqlIdentifier::is_system_table("_app_state"));
        assert!(!SqlIdentifier::is_system_table("_workspace_tabs"));

        // 普通用户表
        assert!(!SqlIdentifier::is_system_table("users"));
        assert!(!SqlIdentifier::is_system_table("my_table"));
        assert!(!SqlIdentifier::is_system_table("销售数据"));
        assert!(!SqlIdentifier::is_system_table("_my_custom_table"));
    }
}

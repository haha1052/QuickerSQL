use super::traits::DatabaseError;

/// SQL 标识符安全处理
pub struct SqlIdentifier;

impl SqlIdentifier {
    /// 验证表名是否安全
    pub fn is_safe_identifier(name: &str) -> bool {
        if name.is_empty() {
            return false;
        }
        
        // 检查是否只包含安全字符
        name.chars().all(|c| {
            c.is_ascii_alphanumeric() || c == '_' || 
            (c >= '\u{4e00}' && c <= '\u{9fff}') // 中文字符
        })
    }
    
    /// 安全引用标识符（DuckDB/SQLite 兼容）
    pub fn quote_identifier(name: &str) -> String {
        format!("\"{}\"", name.replace('\"', "\"\""))
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
}

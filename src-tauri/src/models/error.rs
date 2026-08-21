//! 应用级错误码机制
//!
//! 设计目标：避免后端硬编码中文错误消息，支持前端按用户语言渲染。
//! 后端返回 error_code + params（序列化为 JSON 字符串放入 `Result::Err(String)`），
//! 前端用 `errorMapping.ts` 解析 JSON 并映射为本地化消息。
//!
//! 向后兼容：`AppError` 是新增的并行机制，不修改现有 `String` 错误返回。
//! 剩余 ~190 条错误消息标记为"逐步迁移"。

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt;

/// 应用级错误码（用于前端 i18n 映射）
///
/// 后端返回 error_code + params，前端用 errorMapping.ts 映射为本地化消息。
/// 序列化为 JSON 字符串后放入 `Result::Err(String)`，前端通过 `JSON.parse` 解析。
/// JSON 以 `{` 开头，可与普通错误消息区分。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    /// 错误码（如 "dashboard.not_found"、"dashboard.create_failed"）
    pub error_code: String,
    /// 错误参数（用于 i18n 模板变量替换，如 {"id": "abc"}）
    #[serde(default)]
    pub params: HashMap<String, String>,
    /// 后备英文消息（前端 i18n key 缺失时显示）
    pub message: String,
}

impl AppError {
    /// 创建一个新的 AppError
    ///
    /// # 参数
    /// - `code`: 错误码（如 "dashboard.not_found"）
    /// - `message`: 后备英文消息
    pub fn new(code: &str, message: &str) -> Self {
        Self {
            error_code: code.to_string(),
            params: HashMap::new(),
            message: message.to_string(),
        }
    }

    /// 链式添加错误参数（用于 i18n 模板变量替换）
    ///
    /// # 参数
    /// - `key`: 参数名（如 "id"、"name"）
    /// - `value`: 参数值
    pub fn with_param(mut self, key: &str, value: &str) -> Self {
        self.params.insert(key.to_string(), value.to_string());
        self
    }

    /// 将 AppError 序列化为 JSON 字符串，用于放入 `Result::Err(String)`
    ///
    /// 序列化失败时回退到 message 字段，确保不抛出 panic。
    /// JSON 以 `{` 开头，前端可据此区分 AppError 与普通错误消息。
    pub fn to_error_string(&self) -> String {
        serde_json::to_string(self).unwrap_or_else(|_| self.message.clone())
    }
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}: {}", self.error_code, self.message)
    }
}

impl std::error::Error for AppError {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_error_new_creates_with_code_and_message() {
        let err = AppError::new("dashboard.not_found", "Dashboard not found");
        assert_eq!(err.error_code, "dashboard.not_found");
        assert_eq!(err.message, "Dashboard not found");
        assert!(err.params.is_empty());
    }

    #[test]
    fn app_error_with_param_adds_param() {
        let err = AppError::new("dashboard.not_found", "Dashboard not found")
            .with_param("id", "abc-123");
        assert_eq!(err.params.get("id"), Some(&"abc-123".to_string()));
    }

    #[test]
    fn app_error_with_param_chains_multiple_params() {
        let err = AppError::new("dashboard.update_failed", "Update failed")
            .with_param("id", "abc")
            .with_param("reason", "db locked");
        assert_eq!(err.params.get("id"), Some(&"abc".to_string()));
        assert_eq!(err.params.get("reason"), Some(&"db locked".to_string()));
    }

    #[test]
    fn app_error_to_error_string_produces_valid_json() {
        let err = AppError::new("dashboard.not_found", "Dashboard not found")
            .with_param("id", "abc-123");
        let json = err.to_error_string();
        assert!(json.starts_with('{'), "JSON should start with '{{'");

        let parsed: serde_json::Value = serde_json::from_str(&json).expect("JSON should parse");
        assert_eq!(parsed["errorCode"], "dashboard.not_found");
        assert_eq!(parsed["params"]["id"], "abc-123");
        assert_eq!(parsed["message"], "Dashboard not found");
    }

    #[test]
    fn app_error_to_error_string_uses_camel_case() {
        let err = AppError::new("test.code", "test message");
        let json = err.to_error_string();
        // 确保序列化使用 camelCase（errorCode 而非 error_code）
        assert!(json.contains("errorCode"), "should contain camelCase errorCode");
        assert!(!json.contains("error_code"), "should NOT contain snake_case error_code");
    }

    #[test]
    fn app_error_to_error_string_empty_params() {
        let err = AppError::new("test.code", "test message");
        let json = err.to_error_string();
        let parsed: serde_json::Value = serde_json::from_str(&json).expect("JSON should parse");
        assert!(parsed["params"].is_object());
        assert!(parsed["params"].as_object().unwrap().is_empty());
    }

    #[test]
    fn app_error_display_shows_code_and_message() {
        let err = AppError::new("dashboard.not_found", "Dashboard not found");
        let display = format!("{}", err);
        assert_eq!(display, "dashboard.not_found: Dashboard not found");
    }

    #[test]
    fn app_error_implements_std_error() {
        let err = AppError::new("test.code", "test");
        // 验证 AppError 实现了 std::error::Error（可作为 trait object）
        let _: &dyn std::error::Error = &err;
    }

    #[test]
    fn app_error_clone_creates_equal_copy() {
        let err = AppError::new("test.code", "test")
            .with_param("key", "value");
        let cloned = err.clone();
        assert_eq!(cloned.error_code, err.error_code);
        assert_eq!(cloned.message, err.message);
        assert_eq!(cloned.params.get("key"), err.params.get("key"));
    }

    #[test]
    fn app_error_serialize_deserialize_roundtrip() {
        let original = AppError::new("dashboard.create_failed", "Create failed")
            .with_param("reason", "constraint violation");
        let json = serde_json::to_string(&original).expect("serialize failed");
        let deserialized: AppError = serde_json::from_str(&json).expect("deserialize failed");
        assert_eq!(deserialized.error_code, original.error_code);
        assert_eq!(deserialized.message, original.message);
        assert_eq!(deserialized.params, original.params);
    }
}

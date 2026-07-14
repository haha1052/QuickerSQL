//! 设置系统集成测试
//! 
//! 测试设置 CRUD 完整流程，包括：
//! - 设置的创建、读取、更新、删除
//! - 批量操作
//! - 分类管理

#[cfg(test)]
mod tests {
    use crate::database::traits::*;
    use crate::database::sqlite::SqliteDriver;
    use crate::services::settings_service::SettingsService;
    use crate::models::settings::*;
    use tempfile::tempdir;

    /// 创建测试数据库连接的辅助函数
    fn create_test_db_connection() -> (MutexGuardConnection<'static>, tempfile::TempDir) {
        let temp_dir = tempdir().expect("创建临时目录失败");
        let db_path = temp_dir.path().join("test_settings.db");
        
        let driver = SqliteDriver::new();
        let mut db_manager = DatabaseManager::new();
        db_manager.register_driver(Box::new(driver));
        db_manager.create_and_connect("sqlite", &db_path).expect("创建测试数据库失败");
        
        let leaked_manager: &'static DatabaseManager = Box::leak(Box::new(db_manager));
        let conn = leaked_manager.get_connection().expect("获取连接失败");
        
        (conn, temp_dir)
    }

    /// 初始化设置表
    fn init_settings_table(conn: &MutexGuardConnection<'static>) {
        SettingsService::ensure_settings_table_exists(conn).expect("创建设置表失败");
    }

    // ========== CRUD 完整流程测试 ==========

    #[test]
    fn test_settings_crud_complete_workflow() {
        let (conn, _temp_dir) = create_test_db_connection();
        init_settings_table(&conn);

        // Create - 创建设置
        let create_request = CreateSettingRequest {
            category: "test_category".to_string(),
            key: "test_key".to_string(),
            value: "test_value".to_string(),
            value_type: SettingValueType::Text,
            options: None,
            description: Some("测试设置项".to_string()),
        };

        let created = SettingsService::create_setting_sync(&conn, create_request).expect("创建设置失败");
        assert_eq!(created.category, "test_category");
        assert_eq!(created.key, "test_key");
        assert_eq!(created.value, "test_value");

        // Read - 读取设置
        let read_result = SettingsService::get_setting_sync(&conn, "test_category", "test_key").expect("读取设置失败");
        assert!(read_result.is_some());
        let read_item = read_result.unwrap();
        assert_eq!(read_item.value, "test_value");

        // Update - 更新设置
        let update_request = UpdateSettingRequest {
            category: "test_category".to_string(),
            key: "test_key".to_string(),
            value: "updated_value".to_string(),
            description: Some("更新后的测试设置".to_string()),
        };

        let updated = SettingsService::update_setting_sync(&conn, update_request).expect("更新设置失败");
        assert_eq!(updated.value, "updated_value");

        // Verify update - 验证更新
        let verify_result = SettingsService::get_setting_sync(&conn, "test_category", "test_key").expect("验证设置失败");
        assert!(verify_result.is_some());
        assert_eq!(verify_result.unwrap().value, "updated_value");

        // Delete - 删除设置
        let delete_result = SettingsService::delete_setting_sync(&conn, "test_category", "test_key").expect("删除设置失败");
        assert!(delete_result);

        // Verify delete - 验证删除
        let verify_delete = SettingsService::get_setting_sync(&conn, "test_category", "test_key").expect("验证删除失败");
        assert!(verify_delete.is_none());
    }

    #[test]
    fn test_settings_batch_operations() {
        let (conn, _temp_dir) = create_test_db_connection();
        init_settings_table(&conn);

        // 批量创建设置
        let categories = vec!["category_a", "category_b", "category_c"];
        let keys = vec!["key_1", "key_2", "key_3"];
        let values = vec!["value_1", "value_2", "value_3"];

        for i in 0..3 {
            let create_request = CreateSettingRequest {
                category: categories[i].to_string(),
                key: keys[i].to_string(),
                value: values[i].to_string(),
                value_type: SettingValueType::Text,
                options: None,
                description: None,
            };
            SettingsService::create_setting_sync(&conn, create_request).expect("批量创建失败");
        }

        // 批量读取验证
        for i in 0..3 {
            let result = SettingsService::get_setting_sync(&conn, categories[i], keys[i]).expect("批量读取失败");
            assert!(result.is_some());
            assert_eq!(result.unwrap().value, values[i]);
        }

        // 获取所有设置
        let all_settings = SettingsService::get_all_settings_sync(&conn).expect("获取所有设置失败");
        assert_eq!(all_settings.len(), 3);
    }

    #[test]
    fn test_settings_update_and_verify() {
        let (conn, _temp_dir) = create_test_db_connection();
        init_settings_table(&conn);

        // 创建布尔类型设置
        let create_request = CreateSettingRequest {
            category: "settings".to_string(),
            key: "boolean_setting".to_string(),
            value: "true".to_string(),
            value_type: SettingValueType::Boolean,
            options: None,
            description: Some("布尔类型设置".to_string()),
        };
        SettingsService::create_setting_sync(&conn, create_request).expect("创建设置失败");

        // 更新为 false
        let update_request = UpdateSettingRequest {
            category: "settings".to_string(),
            key: "boolean_setting".to_string(),
            value: "false".to_string(),
            description: None,
        };
        let updated = SettingsService::update_setting_sync(&conn, update_request).expect("更新失败");
        assert_eq!(updated.value, "false");

        // 更新数值类型设置
        let num_create = CreateSettingRequest {
            category: "settings".to_string(),
            key: "number_setting".to_string(),
            value: "100".to_string(),
            value_type: SettingValueType::Number,
            options: None,
            description: None,
        };
        SettingsService::create_setting_sync(&conn, num_create).expect("创建数值设置失败");

        let num_update = UpdateSettingRequest {
            category: "settings".to_string(),
            key: "number_setting".to_string(),
            value: "200".to_string(),
            description: None,
        };
        let num_updated = SettingsService::update_setting_sync(&conn, num_update).expect("更新数值设置失败");
        assert_eq!(num_updated.value, "200");
    }

    #[test]
    fn test_settings_delete_and_confirm() {
        let (conn, _temp_dir) = create_test_db_connection();
        init_settings_table(&conn);

        // 创建设置
        let create_request = CreateSettingRequest {
            category: "delete_test".to_string(),
            key: "to_delete".to_string(),
            value: "will_be_deleted".to_string(),
            value_type: SettingValueType::Text,
            options: None,
            description: None,
        };
        SettingsService::create_setting_sync(&conn, create_request).expect("创建设置失败");

        // 确认存在
        let before_delete = SettingsService::get_setting_sync(&conn, "delete_test", "to_delete").expect("删除前检查失败");
        assert!(before_delete.is_some());

        // 删除
        let delete_result = SettingsService::delete_setting_sync(&conn, "delete_test", "to_delete").expect("删除失败");
        assert!(delete_result);

        // 确认不存在
        let after_delete = SettingsService::get_setting_sync(&conn, "delete_test", "to_delete").expect("删除后检查失败");
        assert!(after_delete.is_none());

        // 重复删除应该返回 false
        let delete_again = SettingsService::delete_setting_sync(&conn, "delete_test", "to_delete").expect("重复删除失败");
        assert!(!delete_again);
    }

    #[test]
    fn test_settings_not_found_handling() {
        let (conn, _temp_dir) = create_test_db_connection();
        init_settings_table(&conn);

        // 查询不存在的设置应该返回 None
        let result = SettingsService::get_setting_sync(&conn, "nonexistent", "key").expect("查询不存在设置失败");
        assert!(result.is_none());

        // 更新不存在的设置应该返回错误
        let update_request = UpdateSettingRequest {
            category: "nonexistent".to_string(),
            key: "key".to_string(),
            value: "value".to_string(),
            description: None,
        };
        let update_result = SettingsService::update_setting_sync(&conn, update_request);
        assert!(update_result.is_err());

        // 删除不存在的设置应该返回 false
        let delete_result = SettingsService::delete_setting_sync(&conn, "nonexistent", "key").expect("删除不存在设置失败");
        assert!(!delete_result);
    }

    #[test]
    fn test_settings_categories_list() {
        let (conn, _temp_dir) = create_test_db_connection();
        init_settings_table(&conn);

        // 创建不同分类的设置
        let categories = vec!["cat1", "cat2", "cat3"];
        for (i, cat) in categories.iter().enumerate() {
            let create_request = CreateSettingRequest {
                category: cat.to_string(),
                key: "key".to_string(),
                value: format!("value_{}", i),
                value_type: SettingValueType::Text,
                options: None,
                description: None,
            };
            SettingsService::create_setting_sync(&conn, create_request).expect("创建设置失败");
        }

        // 验证分类数量
        let all_settings = SettingsService::get_all_settings_sync(&conn).expect("获取所有设置失败");
        let unique_categories: std::collections::HashSet<_> = all_settings.iter().map(|s| &s.category).collect();
        assert_eq!(unique_categories.len(), 3);
    }

    #[test]
    fn test_settings_get_all_categories() {
        let (conn, _temp_dir) = create_test_db_connection();
        init_settings_table(&conn);

        // 获取所有分类
        let categories = SettingsService::get_all_categories_sync(&conn).expect("获取分类失败");
        
        // 应该有默认分类
        assert!(!categories.is_empty());
        
        // 验证分类格式
        for category in &categories {
            assert!(!category.id.is_empty());
            assert!(!category.name.is_empty());
        }
    }

    // ========== 边界条件测试 ==========

    #[test]
    fn test_settings_empty_value() {
        let (conn, _temp_dir) = create_test_db_connection();
        init_settings_table(&conn);

        // 创建空值设置
        let create_request = CreateSettingRequest {
            category: "empty_test".to_string(),
            key: "empty_value".to_string(),
            value: "".to_string(),
            value_type: SettingValueType::Text,
            options: None,
            description: None,
        };
        let created = SettingsService::create_setting_sync(&conn, create_request).expect("创建空值设置失败");
        assert_eq!(created.value, "");

        // 读取验证
        let result = SettingsService::get_setting_sync(&conn, "empty_test", "empty_value").expect("读取空值设置失败");
        assert!(result.is_some());
        assert_eq!(result.unwrap().value, "");
    }

    #[test]
    fn test_settings_special_characters() {
        let (conn, _temp_dir) = create_test_db_connection();
        init_settings_table(&conn);

        // 测试特殊字符值
        let special_values = vec![
            "hello world",
            "中文测试",
            "emoji 🎉",
            "特殊符号: !@#$%^&*()",
            "换行符\n第二行",
            "制表符\t",
        ];

        for (i, value) in special_values.iter().enumerate() {
            let create_request = CreateSettingRequest {
                category: "special_chars".to_string(),
                key: format!("key_{}", i),
                value: value.to_string(),
                value_type: SettingValueType::Text,
                options: None,
                description: None,
            };
            SettingsService::create_setting_sync(&conn, create_request).expect(&format!("创建特殊字符设置失败: {}", value));
        }

        // 验证所有特殊字符设置
        for (i, value) in special_values.iter().enumerate() {
            let result = SettingsService::get_setting_sync(&conn, "special_chars", &format!("key_{}", i)).expect("读取特殊字符设置失败");
            assert!(result.is_some());
            assert_eq!(result.unwrap().value, *value);
        }
    }
}

//! 仪表盘系统集成测试
//! 
//! 测试仪表盘和图表的完整流程，包括：
//! - 图表的创建、读取、更新、删除
//! - 仪表盘的创建、添加图表、布局、保存
//! - 组合业务流程测试

#[cfg(test)]
mod tests {
    use crate::database::traits::*;
    use crate::database::sqlite::SqliteDriver;
    use crate::services::dashboard_service::DashboardService;
    use crate::models::dashboard::*;
    use tempfile::tempdir;

    /// 创建测试数据库连接的辅助函数
    fn create_test_db_connection() -> (MutexGuardConnection<'static>, tempfile::TempDir) {
        let temp_dir = tempdir().expect("创建临时目录失败");
        let db_path = temp_dir.path().join("test_dashboard.db");
        
        let driver = SqliteDriver::new();
        let mut db_manager = DatabaseManager::new();
        db_manager.register_driver(Box::new(driver));
        db_manager.create_and_connect("sqlite", &db_path).expect("创建测试数据库失败");
        
        let leaked_manager: &'static DatabaseManager = Box::leak(Box::new(db_manager));
        let conn = leaked_manager.get_connection().expect("获取连接失败");
        
        (conn, temp_dir)
    }

    /// 初始化仪表盘表
    fn init_tables(conn: &MutexGuardConnection<'static>) {
        DashboardService::ensure_tables_exist(conn).expect("初始化表失败");
    }

    // ========== 图表 CRUD 测试 ==========

    #[test]
    fn test_chart_crud_workflow() {
        let (conn, _temp_dir) = create_test_db_connection();
        init_tables(&conn);

        // Create - 创建图表
        let chart_request = CreateSavedChartRequest {
            name: "Test Chart".to_string(),
            query_id: "query_001".to_string(),
            sql: "SELECT * FROM users".to_string(),
            chart_type: "bar".to_string(),
            x_axis: "name".to_string(),
            y_axis: vec!["count".to_string()],
            title: Some("用户统计".to_string()),
            filters: vec![],
            tags: vec![],
            description: Some("测试图表".to_string()),
            config: None,
            visibility: "all".to_string(),
            authorized_dashboard_ids: vec![],
        };

        let created = DashboardService::create_saved_chart(&conn, chart_request).expect("创建图表失败");
        assert!(!created.id.is_empty());
        assert_eq!(created.name, "Test Chart");
        assert_eq!(created.chart_type, "bar");

        // Read - 读取图表
        let read_chart = DashboardService::get_saved_chart(&conn, &created.id).expect("读取图表失败");
        assert_eq!(read_chart.name, "Test Chart");
        assert_eq!(read_chart.chart_type, "bar");

        // Update - 更新图表
        let update_request = UpdateSavedChartRequest {
            id: created.id.clone(),
            name: Some("Updated Chart".to_string()),
            chart_type: Some("line".to_string()),
            x_axis: Some("date".to_string()),
            y_axis: Some(vec!["value".to_string()]),
            title: Some("更新的图表".to_string()),
            description: Some("更新后的描述".to_string()),
            visibility: Some("all".to_string()),
            authorized_dashboard_ids: None,
        };

        let updated = DashboardService::update_saved_chart(&conn, update_request).expect("更新图表失败");
        assert_eq!(updated.name, "Updated Chart");
        assert_eq!(updated.chart_type, "line");

        // Delete - 删除图表
        DashboardService::delete_saved_chart(&conn, &created.id).expect("删除图表失败");

        // 验证删除
        let deleted_chart = DashboardService::get_saved_chart(&conn, &created.id);
        assert!(deleted_chart.is_err());
    }

    #[test]
    fn test_chart_list_and_filter() {
        let (conn, _temp_dir) = create_test_db_connection();
        init_tables(&conn);

        // 创建多个图表
        let chart_types = vec!["bar", "line", "pie", "scatter"];
        for (i, chart_type) in chart_types.iter().enumerate() {
            let request = CreateSavedChartRequest {
                name: format!("Chart {}", i),
                query_id: format!("query_{}", i),
                sql: format!("SELECT * FROM table_{}", i), // safe_sql: test data
                chart_type: chart_type.to_string(),
                x_axis: "x".to_string(),
                y_axis: vec!["y".to_string()],
                title: None,
                filters: vec![],
                tags: vec![],
                description: None,
                config: None,
                visibility: "all".to_string(),
                authorized_dashboard_ids: vec![],
            };
            DashboardService::create_saved_chart(&conn, request).expect("创建图表失败");
        }

        // 获取所有图表
        let charts = DashboardService::get_saved_charts(&conn, GetSavedChartsRequest::default()).expect("获取图表列表失败");
        assert_eq!(charts.len(), 4);

        // 获取简洁列表
        let lite_charts = DashboardService::list_saved_charts_lite(&conn).expect("获取简洁图表列表失败");
        assert_eq!(lite_charts.len(), 4);
    }

    // ========== 仪表盘 CRUD 测试 ==========

    #[test]
    fn test_dashboard_crud_workflow() {
        let (conn, _temp_dir) = create_test_db_connection();
        init_tables(&conn);

        // Create - 创建仪表盘
        let dashboard_request = CreateDashboardRequest {
            name: "Test Dashboard".to_string(),
            description: Some("测试仪表盘".to_string()),
            layout: vec![],
            filters: vec![],
            refresh_interval_secs: 0,
            is_default: false,
            created_by: "test_user".to_string(),
            background_color: None,
            background_image: None,
            canvas_width: 1200,
            canvas_height: 800,
            padding: 16,
            grid_gap: 16,
            row_height: 80,
            snap_to_grid: true,
        };

        let created = DashboardService::create_dashboard(&conn, dashboard_request).expect("创建仪表盘失败");
        assert!(!created.id.is_empty());
        assert_eq!(created.name, "Test Dashboard");

        // Read - 读取仪表盘
        let read_dashboard = DashboardService::get_dashboard(&conn, &created.id).expect("读取仪表盘失败");
        assert_eq!(read_dashboard.name, "Test Dashboard");
        assert_eq!(read_dashboard.canvas_width, 1200);

        // Update - 更新仪表盘
        let update_request = UpdateDashboardRequest {
            id: created.id.clone(),
            name: Some("Updated Dashboard".to_string()),
            description: Some("更新后的仪表盘".to_string()),
            refresh_interval_secs: Some(300),
            is_default: Some(true),
        };

        let updated = DashboardService::update_dashboard(&conn, update_request).expect("更新仪表盘失败");
        assert_eq!(updated.name, "Updated Dashboard");
        assert_eq!(updated.refresh_interval_secs, 300);
        assert!(updated.is_default);

        // Delete - 删除仪表盘
        DashboardService::delete_dashboard(&conn, &created.id).expect("删除仪表盘失败");

        // 验证删除
        let deleted = DashboardService::get_dashboard(&conn, &created.id);
        assert!(deleted.is_err());
    }

    #[test]
    fn test_dashboard_list() {
        let (conn, _temp_dir) = create_test_db_connection();
        init_tables(&conn);

        // 创建多个仪表盘
        for i in 0..3 {
            let request = CreateDashboardRequest {
                name: format!("Dashboard {}", i),
                description: Some(format!("Description {}", i)),
                layout: vec![],
                filters: vec![],
                refresh_interval_secs: 0,
                is_default: false,
                created_by: "test".to_string(),
                background_color: None,
                background_image: None,
                canvas_width: 1200,
                canvas_height: 800,
                padding: 16,
                grid_gap: 16,
                row_height: 80,
                snap_to_grid: true,
            };
            DashboardService::create_dashboard(&conn, request).expect("创建仪表盘失败");
        }

        // 获取所有仪表盘
        let dashboards = DashboardService::get_dashboards(&conn).expect("获取仪表盘列表失败");
        assert_eq!(dashboards.len(), 3);

        // 获取简洁列表
        let lite_dashboards = DashboardService::list_dashboards_lite(&conn).expect("获取简洁仪表盘列表失败");
        assert_eq!(lite_dashboards.len(), 3);
    }

    // ========== 组合业务流程测试 ==========

    #[test]
    fn test_dashboard_with_charts() {
        let (conn, _temp_dir) = create_test_db_connection();
        init_tables(&conn);

        // 创建仪表盘
        let dashboard_request = CreateDashboardRequest {
            name: "Analytics Dashboard".to_string(),
            description: Some("数据分析仪表盘".to_string()),
            layout: vec![],
            filters: vec![],
            refresh_interval_secs: 60,
            is_default: false,
            created_by: "analyst".to_string(),
            background_color: None,
            background_image: None,
            canvas_width: 1920,
            canvas_height: 1080,
            padding: 24,
            grid_gap: 16,
            row_height: 100,
            snap_to_grid: true,
        };

        let dashboard = DashboardService::create_dashboard(&conn, dashboard_request).expect("创建仪表盘失败");

        // 创建多个图表
        let mut chart_ids = vec![];
        for i in 0..4 {
            let chart_request = CreateSavedChartRequest {
                name: format!("Chart {}", i),
                query_id: format!("query_{}", i),
                sql: format!("SELECT * FROM data_{}", i), // safe_sql: test data
                chart_type: if i % 2 == 0 { "bar".to_string() } else { "line".to_string() },
                x_axis: "x".to_string(),
                y_axis: vec!["y".to_string()],
                title: Some(format!("图表 {}", i)),
                filters: vec![],
                tags: vec![],
                description: None,
                config: None,
                visibility: "all".to_string(),
                authorized_dashboard_ids: vec![],
            };
            let chart = DashboardService::create_saved_chart(&conn, chart_request).expect("创建图表失败");
            chart_ids.push(chart.id);
        }

        // 将图表添加到仪表盘
        let layout_items = vec![
            DashboardItemLayout {
                chart_id: chart_ids[0].clone(),
                x: 0,
                y: 0,
                w: 6,
                h: 2,
            },
            DashboardItemLayout {
                chart_id: chart_ids[1].clone(),
                x: 6,
                y: 0,
                w: 6,
                h: 2,
            },
            DashboardItemLayout {
                chart_id: chart_ids[2].clone(),
                x: 0,
                y: 2,
                w: 12,
                h: 3,
            },
        ];

        for layout in &layout_items {
            let add_request = AddChartToDashboardRequest {
                dashboard_id: dashboard.id.clone(),
                chart_id: layout.chart_id.clone(),
                x: layout.x,
                y: layout.y,
                w: layout.w,
                h: layout.h,
            };
            DashboardService::add_chart_to_dashboard(&conn, add_request).expect("添加图表到仪表盘失败");
        }

        // 获取仪表盘的所有图表
        let items = DashboardService::get_dashboard_items(&conn, &dashboard.id).expect("获取仪表盘图表失败");
        assert_eq!(items.len(), 3);

        // 更新布局
        if let Some(item) = items.first() {
            let update_request = UpdateDashboardItemRequest {
                id: item.id.clone(),
                x: Some(0),
                y: Some(0),
                w: Some(12),
                h: Some(4),
            };
            DashboardService::update_dashboard_item(&conn, update_request).expect("更新布局失败");
        }

        // 验证更新后的布局
        let updated_items = DashboardService::get_dashboard_items(&conn, &dashboard.id).expect("获取更新后的布局失败");
        assert_eq!(updated_items.len(), 3);

        // 移除一个图表
        DashboardService::remove_chart_from_dashboard(&conn, &items[0].id).expect("移除图表失败");
        
        let final_items = DashboardService::get_dashboard_items(&conn, &dashboard.id).expect("获取最终布局失败");
        assert_eq!(final_items.len(), 2);
    }

    // ========== 边界条件测试 ==========

    #[test]
    fn test_dashboard_not_found_handling() {
        let (conn, _temp_dir) = create_test_db_connection();
        init_tables(&conn);

        // 查询不存在的仪表盘
        let result = DashboardService::get_dashboard(&conn, "nonexistent_id");
        assert!(result.is_err());

        // 查询不存在的图表
        let chart_result = DashboardService::get_saved_chart(&conn, "nonexistent_id");
        assert!(chart_result.is_err());

        // 删除不存在的仪表盘
        let delete_result = DashboardService::delete_dashboard(&conn, "nonexistent_id");
        assert!(delete_result.is_err());

        // 删除不存在的图表
        let chart_delete = DashboardService::delete_saved_chart(&conn, "nonexistent_id");
        assert!(chart_delete.is_err());
    }

    #[test]
    fn test_chart_with_special_characters() {
        let (conn, _temp_dir) = create_test_db_connection();
        init_tables(&conn);

        // 测试特殊字符
        let special_names = vec![
            "图表 测试",
            "Chart 🎨",
            "仪表盘 (special)",
            "测试-下划线_name",
        ];

        for name in special_names {
            let request = CreateSavedChartRequest {
                name: name.to_string(),
                query_id: "query_001".to_string(),
                sql: "SELECT 1".to_string(),
                chart_type: "bar".to_string(),
                x_axis: "x".to_string(),
                y_axis: vec!["y".to_string()],
                title: Some(name.to_string()),
                filters: vec![],
                tags: vec![],
                description: None,
                config: None,
                visibility: "all".to_string(),
                authorized_dashboard_ids: vec![],
            };
            let chart = DashboardService::create_saved_chart(&conn, request).expect("创建图表失败");
            
            // 验证能正确读取
            let read = DashboardService::get_saved_chart(&conn, &chart.id).expect("读取图表失败");
            assert_eq!(read.name, name);
        }
    }
}

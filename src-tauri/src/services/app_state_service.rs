//! 应用状态服务
//! 负责处理应用级状态的读写（如是否首次启动、版本号、工作区布局等）
//!
//! 与 SettingsService 的区别：
//! - SettingsService: 用户可更改的偏好设置（主题、字体大小等）
//! - AppStateService: 系统级状态（首次启动检测、版本号等）

use crate::database::traits::MutexGuardConnection;
use crate::models::app_state::*;
use chrono::Utc;

/// 应用状态服务
pub struct AppStateService;

/// 默认应用状态
fn default_app_states() -> Vec<(String, String, String, Option<String>)> {
    vec![
        // 系统信息
        ("system".to_string(), "version".to_string(), "1.0.0".to_string(), Some("应用版本号".to_string())),
        ("system".to_string(), "first_launch_at".to_string(), "".to_string(), Some("首次启动时间".to_string())),

        // 欢迎页状态
        ("welcome".to_string(), "has_launched".to_string(), "false".to_string(), Some("是否已启动过".to_string())),
        ("welcome".to_string(), "last_launched_at".to_string(), "".to_string(), Some("上次启动时间".to_string())),
        ("welcome".to_string(), "launch_count".to_string(), "0".to_string(), Some("累计启动次数".to_string())),

        // 工作区状态
        ("workspace".to_string(), "saved_at".to_string(), "".to_string(), Some("工作区布局最后保存时间".to_string())),

        // 最近使用的项目（用于 autoConnect 功能）
        ("project".to_string(), "last_project_name".to_string(), "".to_string(), Some("上次使用的项目名称".to_string())),
    ]
}

impl AppStateService {
    /// 确保应用状态表存在
    pub fn ensure_app_state_table_exists(conn: &MutexGuardConnection<'_>) -> Result<(), String> {
        // rusqlite::execute() 只支持单条语句，DDL 与索引必须拆成独立调用
        conn.execute(
            r#"CREATE TABLE IF NOT EXISTS __app_state (
                id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
                category TEXT NOT NULL,
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                description TEXT,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(category, key)
            )"#,
            &[],
        ).map_err(|e| format!("创建应用状态表失败：{}", e))?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_app_state_category ON __app_state(category)",
            &[],
        ).map_err(|e| format!("创建 idx_app_state_category 索引失败：{}", e))?;

        // 初始化默认应用状态
        Self::initialize_default_app_states(conn)?;

        Ok(())
    }

    /// 初始化默认应用状态（参数化查询，避免 SQL 注入风险）
    fn initialize_default_app_states(conn: &MutexGuardConnection<'_>) -> Result<(), String> {
        use crate::database::traits::ToSql;
        let defaults = default_app_states();

        for (category, key, default_value, description) in defaults {
            // 参数化查询：检查是否已存在
            let check_sql = "SELECT id FROM __app_state WHERE category = ? AND key = ?";
            let check_params: [&dyn ToSql; 2] = [&category, &key];
            let result = conn.query(check_sql, &check_params)
                .map_err(|e| format!("检查应用状态失败：{}", e))?;

            if result.rows.is_empty() {
                // 参数化查询：插入默认状态
                let id = uuid::Uuid::new_v4().to_string();
                let description_str = description.clone().unwrap_or_default();

                let insert_sql = "INSERT INTO __app_state (id, category, key, value, description) VALUES (?, ?, ?, ?, ?);";
                let insert_params: [&dyn ToSql; 5] = [&id, &category, &key, &default_value, &description_str];

                conn.execute(insert_sql, &insert_params)
                    .map_err(|e| format!("插入默认应用状态失败：{}", e))?;
            }
        }

        Ok(())
    }

    /// 获取单个应用状态（参数化查询）
    pub fn get_app_state(
        conn: &MutexGuardConnection<'_>,
        category: &str,
        key: &str,
    ) -> Result<Option<AppStateResponse>, String> {
        use crate::database::traits::ToSql;
        let select_sql = "SELECT category, key, value FROM __app_state WHERE category = ? AND key = ?";
        let params: [&dyn ToSql; 2] = [&category, &key];
        let result = conn.query(select_sql, &params)
            .map_err(|e| format!("获取应用状态失败：{}", e))?;

        if result.rows.is_empty() {
            return Ok(None);
        }

        let row = &result.rows[0];
        Ok(Some(AppStateResponse {
            category: row[0].clone(),
            key: row[1].clone(),
            value: row[2].clone(),
        }))
    }

    /// 按分类获取所有应用状态（参数化查询）
    pub fn get_app_states_by_category(
        conn: &MutexGuardConnection<'_>,
        category: &str,
    ) -> Result<Vec<AppStateResponse>, String> {
        use crate::database::traits::ToSql;
        let select_sql = "SELECT category, key, value FROM __app_state WHERE category = ? ORDER BY key";
        let params: [&dyn ToSql; 1] = [&category];
        let result = conn.query(select_sql, &params)
            .map_err(|e| format!("获取应用状态失败：{}", e))?;

        let mut items = Vec::new();
        for row in &result.rows {
            items.push(AppStateResponse {
                category: row[0].clone(),
                key: row[1].clone(),
                value: row[2].clone(),
            });
        }

        Ok(items)
    }

    /// 更新应用状态（不存在则创建，参数化查询）
    pub fn update_app_state(
        conn: &MutexGuardConnection<'_>,
        category: &str,
        key: &str,
        value: &str,
        description: Option<&str>,
    ) -> Result<(), String> {
        use crate::database::traits::ToSql;
        // 参数化查询：先检查是否已存在
        let check_sql = "SELECT id FROM __app_state WHERE category = ? AND key = ?";
        let check_params: [&dyn ToSql; 2] = [&category, &key];
        let result = conn.query(check_sql, &check_params)
            .map_err(|e| format!("检查应用状态失败：{}", e))?;

        if result.rows.is_empty() {
            // 参数化查询：插入新记录
            let id = uuid::Uuid::new_v4().to_string();
            let desc_str = description.unwrap_or("").to_string();

            let insert_sql = "INSERT INTO __app_state (id, category, key, value, description) VALUES (?, ?, ?, ?, ?);";
            let insert_params: [&dyn ToSql; 5] = [&id, &category, &key, &value, &desc_str];

            conn.execute(insert_sql, &insert_params)
                .map_err(|e| format!("插入应用状态失败：{}", e))?;
        } else {
            // 参数化查询：更新现有记录
            let update_sql = "UPDATE __app_state SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE category = ? AND key = ?";
            let update_params: [&dyn ToSql; 3] = [&value, &category, &key];

            conn.execute(update_sql, &update_params)
                .map_err(|e| format!("更新应用状态失败：{}", e))?;
        }

        Ok(())
    }

    // ============ 工作区持久化 ============

    /// 确保工作区表存在
    pub fn ensure_workspace_tables_exist(conn: &MutexGuardConnection<'_>) -> Result<(), String> {
        // rusqlite::execute() 只支持单条语句，DDL 与索引必须拆成独立调用
        conn.execute(
            r#"CREATE TABLE IF NOT EXISTS __workspace_tabs (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                tab_type TEXT NOT NULL DEFAULT 'sql',
                position INTEGER NOT NULL DEFAULT 0,
                is_active BOOLEAN NOT NULL DEFAULT FALSE,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )"#,
            &[],
        ).map_err(|e| format!("创建工作区Tab表失败：{}", e))?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_workspace_tabs_position ON __workspace_tabs(position)",
            &[],
        ).map_err(|e| format!("创建 idx_workspace_tabs_position 索引失败：{}", e))?;

        conn.execute(
            r#"CREATE TABLE IF NOT EXISTS __workspace_panels (
                id TEXT PRIMARY KEY,
                tab_id TEXT NOT NULL,
                panel_type TEXT NOT NULL,
                title TEXT NOT NULL,
                size INTEGER NOT NULL DEFAULT 100,
                sql_content TEXT,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                position INTEGER NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (tab_id) REFERENCES __workspace_tabs(id) ON DELETE CASCADE
            )"#,
            &[],
        ).map_err(|e| format!("创建工作区Panel表失败：{}", e))?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_workspace_panels_tab_id ON __workspace_panels(tab_id)",
            &[],
        ).map_err(|e| format!("创建 idx_workspace_panels_tab_id 索引失败：{}", e))?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_workspace_panels_position ON __workspace_panels(position)",
            &[],
        ).map_err(|e| format!("创建 idx_workspace_panels_position 索引失败：{}", e))?;

        Ok(())
    }

    /// 保存工作区布局（整体替换）
    pub fn save_workspace(conn: &MutexGuardConnection<'_>, tabs: &[WorkspaceTab]) -> Result<(), String> {
        // 第一步：清空旧数据
        conn.execute("DELETE FROM __workspace_panels", &[])
            .map_err(|e| format!("删除旧面板数据失败：{}", e))?;

        conn.execute("DELETE FROM __workspace_tabs", &[])
            .map_err(|e| format!("删除旧Tab数据失败：{}", e))?;

        // 第二步：插入新数据
        for tab in tabs {
            // 插入 Tab
            let insert_tab_sql = format!(
                "INSERT INTO __workspace_tabs (id, title, tab_type, position, is_active)
                 VALUES ('{}', '{}', '{}', {}, {});",
                tab.id.replace("'", "''"),
                tab.title.replace("'", "''"),
                tab.tab_type.replace("'", "''"),
                tab.position,
                if tab.is_active { 1 } else { 0 }
            );

            conn.execute(&insert_tab_sql, &[])
                .map_err(|e| format!("插入工作区Tab失败：{}", e))?;

            // 插入 Panels
            for panel in &tab.panels {
                let sql_content_str = panel.sql_content.clone().unwrap_or_default();

                let insert_panel_sql = format!(
                    "INSERT INTO __workspace_panels (id, tab_id, panel_type, title, size, sql_content, is_active, position)
                     VALUES ('{}', '{}', '{}', '{}', {}, '{}', {}, {});",
                    panel.id.replace("'", "''"),
                    tab.id.replace("'", "''"),
                    panel.panel_type.replace("'", "''"),
                    panel.title.replace("'", "''"),
                    panel.size,
                    sql_content_str.replace("'", "''"),
                    if panel.is_active { 1 } else { 0 },
                    panel.position
                );

                conn.execute(&insert_panel_sql, &[])
                    .map_err(|e| format!("插入工作区Panel失败：{}", e))?;
            }
        }

        // 第三步：更新 saved_at 状态
        let now = Utc::now().to_rfc3339();
        Self::update_app_state(conn, "workspace", "saved_at", &now, Some("工作区布局最后保存时间"))?;

        Ok(())
    }

    /// 加载工作区布局
    pub fn load_workspace(conn: &MutexGuardConnection<'_>) -> Result<Vec<WorkspaceTab>, String> {
        // 先确保表存在
        Self::ensure_workspace_tables_exist(conn)?;

        // 获取所有 Tab
        let tabs_sql = "SELECT id, title, tab_type, position, is_active FROM __workspace_tabs ORDER BY position";
        let tabs_result = conn.query(tabs_sql, &[])
            .map_err(|e| format!("获取工作区Tab失败：{}", e))?;

        if tabs_result.rows.is_empty() {
            return Ok(vec![]);
        }

        let mut tabs = Vec::new();
        for row in &tabs_result.rows {
            let tab_id = row[0].clone();

            // 参数化查询：获取该 Tab 的所有面板
            let panels_sql = "SELECT id, panel_type, title, size, sql_content, is_active, position
                              FROM __workspace_panels WHERE tab_id = ? ORDER BY position";
            let panels_params: [&dyn crate::database::traits::ToSql; 1] = [&tab_id];
            let panels_result = conn.query(panels_sql, &panels_params)
                .map_err(|e| format!("获取工作区Panel失败：{}", e))?;

            let mut panels = Vec::new();
            for panel_row in &panels_result.rows {
                let sql_content = if panel_row[4].is_empty() { None } else { Some(panel_row[4].clone()) };

                panels.push(WorkspacePanel {
                    id: panel_row[0].clone(),
                    panel_type: panel_row[1].clone(),
                    title: panel_row[2].clone(),
                    size: panel_row[3].parse().unwrap_or(100),
                    sql_content,
                    is_active: panel_row[5].parse().unwrap_or(true),
                    position: panel_row[6].parse().unwrap_or(0),
                    created_at: Utc::now(),
                    updated_at: Utc::now(),
                });
            }

            tabs.push(WorkspaceTab {
                id: tab_id,
                title: row[1].clone(),
                tab_type: row[2].clone(),
                position: row[3].parse().unwrap_or(0),
                is_active: row[4].parse().unwrap_or(false),
                panels,
                created_at: Utc::now(),
                updated_at: Utc::now(),
            });
        }

        Ok(tabs)
    }

    /// 高效加载工作区布局：2 查询 + 应用层聚合
    /// 替代原 load_workspace 的 1+N 查询，仅在启动路径使用
    pub fn load_workspace_fast(conn: &MutexGuardConnection<'_>) -> Result<Vec<WorkspaceTab>, String> {
        use crate::database::traits::ToSql;

        let empty_params: [&dyn ToSql; 0] = [];

        // 查询 1：获取所有 Tab
        let tabs_result = conn.query(
            "SELECT id, title, tab_type, position, is_active FROM __workspace_tabs ORDER BY position",
            &empty_params
        ).map_err(|e| format!("获取工作区Tab失败: {}", e))?;

        if tabs_result.rows.is_empty() {
            return Ok(vec![]);
        }

        // 收集所有 tab_id，用于第 2 次批量查询 panels
        let tab_ids: Vec<String> = tabs_result.rows.iter().map(|r| r[0].clone()).collect();

        // 查询 2：一次查询所有 Tab 的所有 panels（用 tab_id 关联）
        // 构建占位符 ?, ?, ?...
        let placeholders: Vec<String> = tab_ids.iter().map(|_| "?".to_string()).collect();
        let panels_sql = format!(
            "SELECT tab_id, id, panel_type, title, size, sql_content, is_active, position
             FROM __workspace_panels WHERE tab_id IN ({}) ORDER BY tab_id, position",
            placeholders.join(", ")
        );

        // 将 tab_ids 转为参数引用
        let param_refs: Vec<&dyn ToSql> = tab_ids.iter().map(|id| id as &dyn ToSql).collect();
        let panels_result = conn.query(&panels_sql, &param_refs)
            .map_err(|e| format!("获取工作区Panels失败: {}", e))?;

        // 应用层聚合：按 tab_id 分组 panels
        let mut panels_by_tab: std::collections::HashMap<String, Vec<WorkspacePanel>> = std::collections::HashMap::new();
        for panel_row in &panels_result.rows {
            if panel_row.len() < 8 { continue; }
            let tab_id = panel_row[0].clone();
            let panel = WorkspacePanel {
                id: panel_row[1].clone(),
                panel_type: panel_row[2].clone(),
                title: panel_row[3].clone(),
                size: panel_row[4].parse().unwrap_or(100),
                sql_content: if panel_row[5].is_empty() { None } else { Some(panel_row[5].clone()) },
                is_active: panel_row[6].parse().unwrap_or(true),
                position: panel_row[7].parse().unwrap_or(0),
                created_at: Utc::now(),
                updated_at: Utc::now(),
            };
            panels_by_tab.entry(tab_id).or_default().push(panel);
        }

        // 组装最终结果（保持 Tab 的顺序）
        let mut tabs = Vec::new();
        for row in &tabs_result.rows {
            if row.len() < 5 { continue; }
            let tab_id = row[0].clone();
            let panels = panels_by_tab.remove(&tab_id).unwrap_or_default();
            tabs.push(WorkspaceTab {
                id: tab_id,
                title: row[1].clone(),
                tab_type: row[2].clone(),
                position: row[3].parse().unwrap_or(0),
                is_active: row[4].parse().unwrap_or(false),
                panels,
                created_at: Utc::now(),
                updated_at: Utc::now(),
            });
        }
        Ok(tabs)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::sqlite::SqliteDriver;
    use crate::database::traits::DatabaseManager;
    use chrono::Utc;

    // ============================================================
    // 测试辅助函数
    // ============================================================

    /// 创建测试数据库连接（使用临时文件，Windows 兼容性更好）
    /// 返回 (连接, 数据库管理器静态引用, 临时目录)
    /// 参考 dashboard_service.rs 测试模块的同名辅助函数写法
    fn create_test_db_connection() -> (
        MutexGuardConnection<'static>,
        &'static DatabaseManager,
        tempfile::TempDir,
    ) {
        let temp_dir = tempfile::tempdir().expect("创建临时目录失败");
        let db_path = temp_dir.path().join("test_app_state.db");

        let mut db_manager = DatabaseManager::new();
        db_manager.register_driver(Box::new(SqliteDriver::new()));
        db_manager
            .create_and_connect("sqlite", &db_path)
            .expect("连接测试数据库失败");

        // 使用 Box::leak 将 db_manager 泄漏到堆上，使其永远存在
        // 这样 MutexGuardConnection 可获得 'static 生命周期，便于并发测试
        let db_manager: &'static DatabaseManager = Box::leak(Box::new(db_manager));

        let conn = db_manager.get_connection().expect("获取连接失败");
        (conn, db_manager, temp_dir)
    }

    // ============================================================
    // 1. ensure_*_table_exists 幂等性
    // ============================================================

    #[test]
    fn test_ensure_app_state_table_idempotent() {
        let (conn, _db_manager, _temp_dir) = create_test_db_connection();

        // 第一次调用应成功（建表 + 初始化默认行）
        let r1 = AppStateService::ensure_app_state_table_exists(&conn);
        assert!(
            r1.is_ok(),
            "第一次 ensure_app_state_table_exists 应成功: {:?}",
            r1.err()
        );

        // 第二次调用也应成功（CREATE TABLE IF NOT EXISTS 幂等 + UNIQUE 去重默认行）
        let r2 = AppStateService::ensure_app_state_table_exists(&conn);
        assert!(
            r2.is_ok(),
            "第二次 ensure_app_state_table_exists 应成功: {:?}",
            r2.err()
        );
    }

    #[test]
    fn test_ensure_workspace_tables_idempotent() {
        let (conn, _db_manager, _temp_dir) = create_test_db_connection();

        let r1 = AppStateService::ensure_workspace_tables_exist(&conn);
        assert!(
            r1.is_ok(),
            "第一次 ensure_workspace_tables_exist 应成功: {:?}",
            r1.err()
        );

        let r2 = AppStateService::ensure_workspace_tables_exist(&conn);
        assert!(
            r2.is_ok(),
            "第二次 ensure_workspace_tables_exist 应成功: {:?}",
            r2.err()
        );
    }

    // ============================================================
    // 2. app_state CRUD（update_app_state 走 insert / update 双路径 + get）
    // ============================================================

    #[test]
    fn test_app_state_update_and_get() {
        let (conn, _db_manager, _temp_dir) = create_test_db_connection();
        AppStateService::ensure_app_state_table_exists(&conn)
            .expect("初始化 __app_state 表失败");

        // 初始不存在
        let before = AppStateService::get_app_state(&conn, "test_cat", "test_key")
            .expect("get_app_state 失败");
        assert!(before.is_none(), "初始应不存在该状态");

        // insert 路径：新键值
        AppStateService::update_app_state(
            &conn,
            "test_cat",
            "test_key",
            "value1",
            Some("测试描述"),
        )
        .expect("插入 app_state 失败");

        let after_insert = AppStateService::get_app_state(&conn, "test_cat", "test_key")
            .expect("get_app_state 失败")
            .expect("插入后应能查到");
        assert_eq!(after_insert.value, "value1");
        assert_eq!(after_insert.category, "test_cat");
        assert_eq!(after_insert.key, "test_key");

        // update 路径：已存在的键
        AppStateService::update_app_state(&conn, "test_cat", "test_key", "value2", None)
            .expect("更新 app_state 失败");
        let after_update = AppStateService::get_app_state(&conn, "test_cat", "test_key")
            .expect("get_app_state 失败")
            .expect("更新后应存在");
        assert_eq!(after_update.value, "value2", "更新后值应为 value2");
    }

    #[test]
    fn test_app_state_get_by_category() {
        let (conn, _db_manager, _temp_dir) = create_test_db_connection();
        AppStateService::ensure_app_state_table_exists(&conn)
            .expect("初始化 __app_state 表失败");

        // ensure 会插入默认 "system" 分类，至少包含 version
        let items = AppStateService::get_app_states_by_category(&conn, "system")
            .expect("get_app_states_by_category 失败");
        assert!(!items.is_empty(), "system 分类下应有默认项");
        assert!(
            items.iter().any(|i| i.key == "version"),
            "应有 version 项"
        );

        // 不存在的分类应返回空 Vec
        let empty =
            AppStateService::get_app_states_by_category(&conn, "non_existent_category_xx")
                .expect("查询空分类失败");
        assert!(empty.is_empty(), "不存在的分类应返回空列表");
    }

    // ============================================================
    // 3. workspace_tabs CRUD（通过 save_workspace + load_workspace）
    // 说明：AppStateService 未暴露单条 tab 的 insert/list/update/delete，
    // 仅提供 save_workspace（整体替换）和 load_workspace（整体读取）。
    // 此测试通过整体保存/读取覆盖 CRUD 行为。
    // ============================================================

    #[test]
    fn test_workspace_tab_crud_roundtrip() {
        let (conn, _db_manager, _temp_dir) = create_test_db_connection();
        // save_workspace 内部会调用 update_app_state，因此必须先建好 __app_state 表
        AppStateService::ensure_app_state_table_exists(&conn)
            .expect("初始化 __app_state 表失败");
        AppStateService::ensure_workspace_tables_exist(&conn)
            .expect("初始化 workspace 表失败");

        // list 验证初始为 0 条
        let initial = AppStateService::load_workspace(&conn).expect("load_workspace 失败");
        assert!(initial.is_empty(), "初始 workspace 应为空");

        // insert 一个 tab
        let tab = WorkspaceTab {
            id: "tab-crud-1".to_string(),
            title: "查询1".to_string(),
            tab_type: "sql".to_string(),
            position: 0,
            is_active: true,
            panels: vec![],
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        AppStateService::save_workspace(&conn, std::slice::from_ref(&tab))
            .expect("save_workspace 插入失败");

        // list 验证返回 1 条
        let loaded = AppStateService::load_workspace(&conn).expect("load_workspace 失败");
        assert_eq!(loaded.len(), 1, "应有 1 个 tab");
        assert_eq!(loaded[0].id, "tab-crud-1");
        assert_eq!(loaded[0].title, "查询1");
        assert_eq!(loaded[0].tab_type, "sql");
        assert_eq!(loaded[0].position, 0);

        // update 该 tab（修改 title / position）
        let mut updated_tab = loaded[0].clone();
        updated_tab.title = "查询1-已更新".to_string();
        updated_tab.position = 5;
        AppStateService::save_workspace(&conn, std::slice::from_ref(&updated_tab))
            .expect("save_workspace 更新失败");

        let after_update = AppStateService::load_workspace(&conn).expect("load_workspace 失败");
        assert_eq!(after_update.len(), 1, "更新后仍应只有 1 个 tab");
        assert_eq!(after_update[0].title, "查询1-已更新", "title 应已更新");
        assert_eq!(after_update[0].position, 5, "position 应已更新");

        // delete 该 tab（save 空列表会清空所有 tab 和 panel）
        AppStateService::save_workspace(&conn, &[]).expect("save_workspace 删除失败");

        // list 验证返回 0 条
        let after_delete = AppStateService::load_workspace(&conn).expect("load_workspace 失败");
        assert_eq!(after_delete.len(), 0, "删除后应为空");
    }

    // ============================================================
    // 4. workspace_panels CRUD（通过 tab.panels 整体保存/读取）
    // ============================================================

    /// 保留说明（> 80 行）：本测试为单条端到端 CRUD 圆环测试，顺序覆盖
    /// insert → load → update → load → delete → load 三个阶段，依赖连续状态
    /// （loaded_tab / updated_tab / after_panel_delete）。拆分为多个子测试会引入
    /// 跨函数状态传递与共享 fixture，反而降低测试可读性。
    /// 按 P2-4 验收标准"保留项须有注释说明保留理由"保留为单函数（83 行）。
    #[test]
    fn test_workspace_panel_crud_roundtrip() {
        let (conn, _db_manager, _temp_dir) = create_test_db_connection();
        // save_workspace 内部会调用 update_app_state，因此必须先建好 __app_state 表
        AppStateService::ensure_app_state_table_exists(&conn)
            .expect("初始化 __app_state 表失败");
        AppStateService::ensure_workspace_tables_exist(&conn)
            .expect("初始化 workspace 表失败");

        // insert 一个带 panel 的 tab
        let panel = WorkspacePanel {
            id: "panel-crud-1".to_string(),
            panel_type: "sql_editor".to_string(),
            title: "SQL 编辑器".to_string(),
            size: 50,
            sql_content: Some("SELECT 1".to_string()),
            is_active: true,
            position: 0,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        let tab = WorkspaceTab {
            id: "tab-panel-crud".to_string(),
            title: "Tab with panel".to_string(),
            tab_type: "sql".to_string(),
            position: 0,
            is_active: true,
            panels: vec![panel],
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        AppStateService::save_workspace(&conn, std::slice::from_ref(&tab))
            .expect("save_workspace 失败");

        // list 验证返回 1 个 panel
        let loaded = AppStateService::load_workspace(&conn).expect("load_workspace 失败");
        assert_eq!(loaded.len(), 1, "应有 1 个 tab");
        assert_eq!(loaded[0].panels.len(), 1, "应有 1 个 panel");
        let loaded_panel = &loaded[0].panels[0];
        assert_eq!(loaded_panel.id, "panel-crud-1");
        assert_eq!(loaded_panel.panel_type, "sql_editor");
        assert_eq!(loaded_panel.title, "SQL 编辑器");
        assert_eq!(loaded_panel.size, 50);
        assert_eq!(loaded_panel.position, 0);
        assert_eq!(
            loaded_panel.sql_content.as_deref(),
            Some("SELECT 1"),
            "sql_content 应正确持久化"
        );

        // update 该 panel（修改 sql_content / size / title）
        let mut updated_tab = loaded[0].clone();
        updated_tab.panels[0].sql_content = Some("SELECT 2".to_string());
        updated_tab.panels[0].size = 75;
        updated_tab.panels[0].title = "已更新标题".to_string();
        AppStateService::save_workspace(&conn, std::slice::from_ref(&updated_tab))
            .expect("save_workspace 更新失败");

        let after_update = AppStateService::load_workspace(&conn).expect("load_workspace 失败");
        let updated_panel = &after_update[0].panels[0];
        assert_eq!(updated_panel.sql_content.as_deref(), Some("SELECT 2"));
        assert_eq!(updated_panel.size, 75);
        assert_eq!(updated_panel.title, "已更新标题");

        // delete 该 panel（保存 tab 但 panels 为空列表）
        let tab_no_panels = WorkspaceTab {
            id: "tab-panel-crud".to_string(),
            title: "Tab with panel".to_string(),
            tab_type: "sql".to_string(),
            position: 0,
            is_active: true,
            panels: vec![],
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        AppStateService::save_workspace(&conn, std::slice::from_ref(&tab_no_panels))
            .expect("save_workspace 删除 panel 失败");

        // list 验证返回 0 个 panel
        let after_panel_delete =
            AppStateService::load_workspace(&conn).expect("load_workspace 失败");
        assert_eq!(after_panel_delete.len(), 1, "tab 仍应存在");
        assert_eq!(after_panel_delete[0].panels.len(), 0, "panel 应已删除");
    }

    // ============================================================
    // 5. load_workspace_fast 与 load_workspace 一致性
    // 验证 2-查询 + 应用层聚合的快路径与 1+N 慢路径结果一致
    // ============================================================

    #[test]
    fn test_load_workspace_fast_matches_load_workspace() {
        let (conn, _db_manager, _temp_dir) = create_test_db_connection();
        // save_workspace 内部会调用 update_app_state，因此必须先建好 __app_state 表
        AppStateService::ensure_app_state_table_exists(&conn)
            .expect("初始化 __app_state 表失败");
        AppStateService::ensure_workspace_tables_exist(&conn)
            .expect("初始化 workspace 表失败");

        // 保存 2 个 tab：第一个带 1 个 panel，第二个无 panel
        let tabs = vec![
            WorkspaceTab {
                id: "fast-t1".to_string(),
                title: "Tab 1".to_string(),
                tab_type: "sql".to_string(),
                position: 0,
                is_active: true,
                panels: vec![WorkspacePanel {
                    id: "fast-p1".to_string(),
                    panel_type: "sql_editor".to_string(),
                    title: "Editor 1".to_string(),
                    size: 100,
                    sql_content: Some("SELECT 1".to_string()),
                    is_active: true,
                    position: 0,
                    created_at: Utc::now(),
                    updated_at: Utc::now(),
                }],
                created_at: Utc::now(),
                updated_at: Utc::now(),
            },
            WorkspaceTab {
                id: "fast-t2".to_string(),
                title: "Tab 2".to_string(),
                tab_type: "sql".to_string(),
                position: 1,
                is_active: false,
                panels: vec![],
                created_at: Utc::now(),
                updated_at: Utc::now(),
            },
        ];
        AppStateService::save_workspace(&conn, &tabs).expect("save_workspace 失败");

        let slow = AppStateService::load_workspace(&conn).expect("load_workspace 失败");
        let fast = AppStateService::load_workspace_fast(&conn).expect("load_workspace_fast 失败");

        assert_eq!(slow.len(), fast.len(), "两种加载方式 tab 数量应一致");
        for (s, f) in slow.iter().zip(fast.iter()) {
            assert_eq!(s.id, f.id, "tab id 应一致");
            assert_eq!(s.title, f.title, "tab title 应一致");
            assert_eq!(s.panels.len(), f.panels.len(), "panel 数量应一致");
            for (sp, fp) in s.panels.iter().zip(f.panels.iter()) {
                assert_eq!(sp.id, fp.id, "panel id 应一致");
                assert_eq!(
                    sp.sql_content, fp.sql_content,
                    "panel sql_content 应一致"
                );
            }
        }
    }

    // ============================================================
    // 6. 并发读（可选：多线程并发 load_workspace_fast 不冲突）
    // 验证 Mutex 互斥能正确串行化多个线程的读请求
    // ============================================================

    #[test]
    fn test_concurrent_load_workspace_fast() {
        let (conn, db_manager, _temp_dir) = create_test_db_connection();
        // save_workspace 内部会调用 update_app_state，因此必须先建好 __app_state 表
        AppStateService::ensure_app_state_table_exists(&conn)
            .expect("初始化 __app_state 表失败");
        AppStateService::ensure_workspace_tables_exist(&conn)
            .expect("初始化 workspace 表失败");

        // 先写入一个 tab 供并发读取
        let tab = WorkspaceTab {
            id: "concurrent-tab".to_string(),
            title: "并发测试".to_string(),
            tab_type: "sql".to_string(),
            position: 0,
            is_active: true,
            panels: vec![],
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        AppStateService::save_workspace(&conn, std::slice::from_ref(&tab))
            .expect("save_workspace 失败");
        // 显式释放主连接的 Mutex 锁，让子线程可以获取
        drop(conn);

        // 多线程并发读取
        // db_manager 是 &'static DatabaseManager，可安全跨线程共享
        let thread_count = 4u32;
        let handles: Vec<std::thread::JoinHandle<Result<Vec<WorkspaceTab>, String>>> = (0
            ..thread_count)
            .map(|_| {
                std::thread::spawn(move || {
                    let thread_conn = db_manager
                        .get_connection()
                        .expect("子线程获取连接失败");
                    AppStateService::load_workspace_fast(&thread_conn)
                })
            })
            .collect();

        for (i, h) in handles.into_iter().enumerate() {
            let result = match h.join() {
                Ok(r) => r,
                Err(_) => panic!("线程 {} join 失败", i),
            };
            assert!(
                result.is_ok(),
                "线程 {} load_workspace_fast 失败: {:?}",
                i,
                result.err()
            );
            let tabs = result.unwrap();
            assert_eq!(tabs.len(), 1, "线程 {} 应读到 1 个 tab", i);
            assert_eq!(tabs[0].id, "concurrent-tab", "线程 {} 读到错误 tab id", i);
        }
    }
}

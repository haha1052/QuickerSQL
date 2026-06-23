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

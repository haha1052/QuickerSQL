//! 仪表盘服务
//! 负责处理仪表盘、保存的图表等数据的存储和读取

use crate::database::traits::MutexGuardConnection;
use crate::models::dashboard::*;
use crate::models::error::AppError;
use chrono::Utc;

/// 仪表盘服务
pub struct DashboardService;

impl DashboardService {
    /// 安全地转义 SQL 字符串字面量
    pub(in crate::services) fn escape_sql_string(s: &str) -> String {
        s.replace('\'', "''")
    }

    /// 将可选的字符串转为 SQL 值（带引号或 NULL）
    /// 为将来参数化查询预留的辅助函数，当前未直接调用。
    #[allow(dead_code)]
    pub(in crate::services) fn to_sql_value(opt: Option<&str>) -> String {
        match opt {
            Some(s) => format!("'{}'", Self::escape_sql_string(s)),
            None => "NULL".to_string(),
        }
    }

    /// 确保仪表盘相关的表存在
    pub fn ensure_tables_exist(conn: &MutexGuardConnection<'_>) -> Result<(), String> {
        // ⚠️ rusqlite::execute() 只支持单条语句，必须把 DDL 与索引拆成独立调用
        // 创建 __saved_queries 表
        conn.execute(
            r#"CREATE TABLE IF NOT EXISTS __saved_queries (
                id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
                name TEXT NOT NULL,
                sql TEXT NOT NULL,
                params TEXT NOT NULL DEFAULT '[]',
                cache_ttl_secs INTEGER NOT NULL DEFAULT 300,
                last_result TEXT,
                last_run_at INTEGER,
                created_by TEXT NOT NULL DEFAULT '',
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
            )"#,
            &[],
        ).map_err(|e| format!("创建 __saved_queries 表失败：{}", e))?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_saved_queries_name ON __saved_queries(name)",
            &[],
        ).map_err(|e| format!("创建 idx_saved_queries_name 索引失败：{}", e))?;

        // 创建 __saved_charts 表
        conn.execute(
            r#"CREATE TABLE IF NOT EXISTS __saved_charts (
                id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
                name TEXT NOT NULL,
                query_id TEXT NOT NULL,
                sql TEXT NOT NULL DEFAULT '',
                chart_type TEXT NOT NULL DEFAULT 'bar',
                x_axis TEXT NOT NULL DEFAULT '',
                y_axis TEXT NOT NULL DEFAULT '[]',
                title TEXT NOT NULL DEFAULT '',
                filters TEXT NOT NULL DEFAULT '[]',
                tags TEXT NOT NULL DEFAULT '[]',
                description TEXT NOT NULL DEFAULT '',
                thumbnail TEXT,
                config TEXT,
                visibility TEXT NOT NULL DEFAULT 'all',
                authorized_dashboard_ids TEXT NOT NULL DEFAULT '[]',
                created_by TEXT NOT NULL DEFAULT '',
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
            )"#,
            &[],
        ).map_err(|e| format!("创建 __saved_charts 表失败：{}", e))?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_saved_charts_query_id ON __saved_charts(query_id)",
            &[],
        ).map_err(|e| format!("创建 idx_saved_charts_query_id 索引失败：{}", e))?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_saved_charts_visibility ON __saved_charts(visibility)",
            &[],
        ).map_err(|e| format!("创建 idx_saved_charts_visibility 索引失败：{}", e))?;

        // 向后兼容：确保 sql 字段存在（旧数据库可能没有这个字段）
        let add_sql_column_sql = "ALTER TABLE __saved_charts ADD COLUMN sql TEXT NOT NULL DEFAULT '';";
        if let Err(e) = conn.execute(add_sql_column_sql, &[]) {
            log::debug!("__saved_charts.sql 列可能已存在: {}", e);
        }

        // 自动化任务缓存列：存储最近一次查询结果 JSON 和运行时间
        let add_last_result_sql = "ALTER TABLE __saved_charts ADD COLUMN last_result TEXT;";
        if let Err(e) = conn.execute(add_last_result_sql, &[]) {
            log::debug!("__saved_charts.last_result 列可能已存在: {}", e);
        }
        let add_last_run_at_sql = "ALTER TABLE __saved_charts ADD COLUMN last_run_at INTEGER;";
        if let Err(e) = conn.execute(add_last_run_at_sql, &[]) {
            log::debug!("__saved_charts.last_run_at 列可能已存在: {}", e);
        }

        // 向后兼容：授权范围字段 —— visibility 控制图表对哪些仪表盘可见
        // "all" = 所有仪表盘可用; "restricted" = 仅 authorized_dashboard_ids 中列出的可用
        let add_visibility_column_sql = "ALTER TABLE __saved_charts ADD COLUMN visibility TEXT NOT NULL DEFAULT 'all';";
        if let Err(e) = conn.execute(add_visibility_column_sql, &[]) {
            log::debug!("__saved_charts.visibility 列可能已存在: {}", e);
        }
        let add_auth_dashboards_column_sql = "ALTER TABLE __saved_charts ADD COLUMN authorized_dashboard_ids TEXT NOT NULL DEFAULT '[]';";
        if let Err(e) = conn.execute(add_auth_dashboards_column_sql, &[]) {
            log::debug!("__saved_charts.authorized_dashboard_ids 列可能已存在: {}", e);
        }

        // 关键修复：回填旧图表的 sql 字段 —— 从 __saved_queries 表同步 SQL
        // 这解决了旧数据库中图表没有 sql 字段导致渲染失败的问题
        let backfill_sql = r#"
            UPDATE __saved_charts 
            SET sql = (SELECT sql FROM __saved_queries WHERE __saved_queries.id = __saved_charts.query_id)
            WHERE sql = '' AND query_id IS NOT NULL AND query_id != '';
        "#;
        if let Err(e) = conn.execute(backfill_sql, &[]) {
            log::warn!("回填 __saved_charts.sql 失败（非致命，旧图表仍可从 __saved_queries 查询）: {}", e);
        }

        // 创建 __dashboards 表
        conn.execute(
            r#"CREATE TABLE IF NOT EXISTS __dashboards (
                id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                layout TEXT NOT NULL DEFAULT '[]',
                filters TEXT NOT NULL DEFAULT '[]',
                refresh_interval_secs INTEGER NOT NULL DEFAULT 0,
                is_default BOOLEAN NOT NULL DEFAULT FALSE,
                created_by TEXT NOT NULL DEFAULT '',
                background_color TEXT,
                background_image TEXT,
                canvas_width INTEGER NOT NULL DEFAULT 0,
                canvas_height INTEGER NOT NULL DEFAULT 0,
                padding INTEGER NOT NULL DEFAULT 0,
                grid_gap INTEGER NOT NULL DEFAULT 16,
                row_height INTEGER NOT NULL DEFAULT 80,
                snap_to_grid BOOLEAN NOT NULL DEFAULT TRUE,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
            )"#,
            &[],
        ).map_err(|e| format!("创建 __dashboards 表失败：{}", e))?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_dashboards_name ON __dashboards(name)",
            &[],
        ).map_err(|e| format!("创建 idx_dashboards_name 索引失败：{}", e))?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_dashboards_is_default ON __dashboards(is_default)",
            &[],
        ).map_err(|e| format!("创建 idx_dashboards_is_default 索引失败：{}", e))?;

        // 向后兼容：背景设置列（老数据库可能没有这些字段）
        let add_bg_color_sql = "ALTER TABLE __dashboards ADD COLUMN background_color TEXT;";
        if let Err(e) = conn.execute(add_bg_color_sql, &[]) {
            log::debug!("__dashboards.background_color 列可能已存在: {}", e);
        }
        let add_bg_image_sql = "ALTER TABLE __dashboards ADD COLUMN background_image TEXT;";
        if let Err(e) = conn.execute(add_bg_image_sql, &[]) {
            log::debug!("__dashboards.background_image 列可能已存在: {}", e);
        }
        let add_canvas_width_sql = "ALTER TABLE __dashboards ADD COLUMN canvas_width INTEGER NOT NULL DEFAULT 0;";
        if let Err(e) = conn.execute(add_canvas_width_sql, &[]) {
            log::debug!("__dashboards.canvas_width 列可能已存在: {}", e);
        }
        let add_canvas_height_sql = "ALTER TABLE __dashboards ADD COLUMN canvas_height INTEGER NOT NULL DEFAULT 0;";
        if let Err(e) = conn.execute(add_canvas_height_sql, &[]) {
            log::debug!("__dashboards.canvas_height 列可能已存在: {}", e);
        }
        let add_padding_sql = "ALTER TABLE __dashboards ADD COLUMN padding INTEGER NOT NULL DEFAULT 0;";
        if let Err(e) = conn.execute(add_padding_sql, &[]) {
            log::debug!("__dashboards.padding 列可能已存在: {}", e);
        }
        let add_grid_gap_sql = "ALTER TABLE __dashboards ADD COLUMN grid_gap INTEGER NOT NULL DEFAULT 16;";
        if let Err(e) = conn.execute(add_grid_gap_sql, &[]) {
            log::debug!("__dashboards.grid_gap 列可能已存在: {}", e);
        }
        let add_row_height_sql = "ALTER TABLE __dashboards ADD COLUMN row_height INTEGER NOT NULL DEFAULT 80;";
        if let Err(e) = conn.execute(add_row_height_sql, &[]) {
            log::debug!("__dashboards.row_height 列可能已存在: {}", e);
        }
        let add_snap_to_grid_sql = "ALTER TABLE __dashboards ADD COLUMN snap_to_grid BOOLEAN NOT NULL DEFAULT TRUE;";
        if let Err(e) = conn.execute(add_snap_to_grid_sql, &[]) {
            log::debug!("__dashboards.snap_to_grid 列可能已存在: {}", e);
        }

        // 创建 __dashboard_items 表
        conn.execute(
            r#"CREATE TABLE IF NOT EXISTS __dashboard_items (
                id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
                dashboard_id TEXT NOT NULL,
                chart_id TEXT NOT NULL,
                x REAL NOT NULL DEFAULT 0,
                y REAL NOT NULL DEFAULT 0,
                width REAL NOT NULL DEFAULT 1,
                height REAL NOT NULL DEFAULT 1,
                config_overrides TEXT,
                position INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (dashboard_id) REFERENCES __dashboards(id) ON DELETE CASCADE,
                FOREIGN KEY (chart_id) REFERENCES __saved_charts(id) ON DELETE CASCADE
            )"#,
            &[],
        ).map_err(|e| format!("创建 __dashboard_items 表失败：{}", e))?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_dashboard_items_dashboard_id ON __dashboard_items(dashboard_id)",
            &[],
        ).map_err(|e| format!("创建 idx_dashboard_items_dashboard_id 索引失败：{}", e))?;

        // 孤儿记录清理：删除 __dashboard_items 中引用了不存在 dashboard/chart 的记录
        // 这是开启 foreign_keys = ON 前的兜底处理，防止历史数据导致约束启用失败
        let orphan_cleanup_sql = r#"
            DELETE FROM __dashboard_items
            WHERE dashboard_id NOT IN (SELECT id FROM __dashboards)
               OR chart_id NOT IN (SELECT id FROM __saved_charts);
        "#;
        match conn.execute(orphan_cleanup_sql, &[]) {
            Ok(_) => log::debug!("__dashboard_items 孤儿记录清理完成"),
            Err(e) => log::warn!("__dashboard_items 孤儿记录清理失败（非致命）: {}", e),
        }

        Ok(())
    }

    // ============ SavedChart CRUD ============

    /// 创建保存的图表
    /// 关键设计：SQL直接保存到图表记录中，不依赖查询记录
    pub fn create_saved_chart(
        conn: &MutexGuardConnection<'_>,
        name: String,
        query_id: String,
        query_sql: String,
        chart_type: String,
        x_axis: String,
        y_axis: Vec<String>,
        title: Option<String>,
        tags: Option<Vec<String>>,
        description: Option<String>,
        config: Option<serde_json::Value>,
        visibility: Option<String>,
        authorized_dashboard_ids: Option<Vec<String>>,
    ) -> Result<SavedChart, String> {
        use crate::database::traits::ToSql;

        let id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now().timestamp();
        let title = title.unwrap_or_default();
        let description = description.unwrap_or_default();
        let y_axis_json = serde_json::to_string(&y_axis).unwrap_or_else(|_| "[]".to_string());
        let tags_json = serde_json::to_string(&tags.unwrap_or_default()).unwrap_or_else(|_| "[]".to_string());
        let filters_json = "[]".to_string();
        let config_json = config.and_then(|c| serde_json::to_string(&c).ok());
        let visibility = visibility.unwrap_or_else(|| "all".to_string());
        let auth_ids = authorized_dashboard_ids.unwrap_or_default();
        let auth_ids_json = serde_json::to_string(&auth_ids).unwrap_or_else(|_| "[]".to_string());

        // 同时创建查询记录（供未来复用查询使用）—— 参数化查询
        let query_check_sql = "SELECT id FROM __saved_queries WHERE id = ?;";
        let query_check_params: [&dyn ToSql; 1] = [&query_id];
        let query_exists = conn.query(query_check_sql, &query_check_params)
            .map_err(|e| format!("检查查询失败：{}", e))?
            .rows
            .len() > 0;

        if !query_exists {
            // 参数化插入 __saved_queries（config 为空、cache_ttl_secs 默认 300）
            let insert_query_sql = "INSERT INTO __saved_queries (id, name, sql, params, cache_ttl_secs, last_result, last_run_at, created_by, created_at, updated_at) VALUES (?, ?, ?, '[]', 300, NULL, NULL, '', ?, ?);";
            let insert_query_params: [&dyn ToSql; 5] = [
                &query_id, &name, &query_sql, &now, &now,
            ];
            if let Err(e) = conn.execute(insert_query_sql, &insert_query_params) {
                log::warn!("写入 __saved_queries 查询记录失败（非致命，图表仍可用）: {}", e);
            }
        }

        // 创建图表记录（核心：SQL直接保存到图表记录中；同时记录授权范围）
        // 参数化插入：config 可能为 NULL，分两种 SQL 模板
        // 列顺序：id, name, query_id, sql, chart_type, x_axis, y_axis, title, filters, tags,
        //        description, thumbnail(NULL), config(?/NULL), visibility, authorized_dashboard_ids,
        //        created_by(''), created_at, updated_at
        let insert_sql = if config_json.is_some() {
            "INSERT INTO __saved_charts (id, name, query_id, sql, chart_type, x_axis, y_axis, title, filters, tags, description, thumbnail, config, visibility, authorized_dashboard_ids, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, '', ?, ?);"
        } else {
            "INSERT INTO __saved_charts (id, name, query_id, sql, chart_type, x_axis, y_axis, title, filters, tags, description, thumbnail, config, visibility, authorized_dashboard_ids, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, '', ?, ?);"
        };

        // 统一参数顺序（不含 config，由模板决定是否占位）
        let mut params: Vec<Box<dyn ToSql>> = Vec::with_capacity(17);
        params.push(Box::new(id.clone()));
        params.push(Box::new(name));
        params.push(Box::new(query_id));
        params.push(Box::new(query_sql));
        params.push(Box::new(chart_type));
        params.push(Box::new(x_axis));
        params.push(Box::new(y_axis_json));
        params.push(Box::new(title));
        params.push(Box::new(filters_json));
        params.push(Box::new(tags_json));
        params.push(Box::new(description));
        if let Some(c) = config_json {
            params.push(Box::new(c));
        }
        params.push(Box::new(visibility));
        params.push(Box::new(auth_ids_json));
        params.push(Box::new(now));
        params.push(Box::new(now));

        let params_refs: Vec<&dyn ToSql> = params.iter().map(|p| p.as_ref()).collect();
        conn.execute(insert_sql, params_refs.as_slice())
            .map_err(|e| format!("创建保存的图表失败：{}", e))?;

        Self::get_saved_chart(conn, &id)
    }

    /// 获取保存的图表列表（按列名解析，彻底消除索引错位）
    pub fn get_saved_charts(
        conn: &MutexGuardConnection<'_>,
        query_id: Option<String>,
        tags: Option<Vec<String>>,
    ) -> Result<Vec<SavedChart>, String> {
        use crate::database::traits::ToSql;

        // 明确列出所有列名，避免 SELECT * 带来的不确定性
        // 注意：sql 列对图表的自洽渲染至关重要；visibility / authorized_dashboard_ids 控制图表授权范围
        // last_result / last_run_at 由自动化任务刷新图表时写入，供前端跳过查询直接使用缓存
        let select_sql = if query_id.is_some() {
            "SELECT id, name, query_id, sql, chart_type, x_axis, y_axis, title, filters, tags, description, thumbnail, config, visibility, authorized_dashboard_ids, last_result, last_run_at, created_by, created_at, updated_at FROM __saved_charts WHERE query_id = ? ORDER BY updated_at DESC;"
        } else {
            "SELECT id, name, query_id, sql, chart_type, x_axis, y_axis, title, filters, tags, description, thumbnail, config, visibility, authorized_dashboard_ids, last_result, last_run_at, created_by, created_at, updated_at FROM __saved_charts ORDER BY updated_at DESC;"
        };

        let result = if let Some(qid) = query_id {
            let params: [&dyn ToSql; 1] = [&qid];
            conn.query(select_sql, &params)
                .map_err(|e| format!("获取保存的图表列表失败：{}", e))?
        } else {
            conn.query(select_sql, &[])
                .map_err(|e| format!("获取保存的图表列表失败：{}", e))?
        };

        let columns = result.columns;
        let mut charts = Vec::new();
        for row in result.rows {
            charts.push(Self::row_to_saved_chart_by_name(&columns, &row)?);
        }

        // 过滤标签
        if let Some(ref filter_tags) = tags {
            charts.retain(|chart| {
                filter_tags.iter().any(|tag| chart.tags.contains(tag))
            });
        }

        Ok(charts)
    }

    /// 获取单个保存的图表（按列名解析）
    pub fn get_saved_chart(conn: &MutexGuardConnection<'_>, id: &str) -> Result<SavedChart, String> {
        use crate::database::traits::ToSql;

        let select_sql = "SELECT id, name, query_id, sql, chart_type, x_axis, y_axis, title, filters, tags, description, thumbnail, config, visibility, authorized_dashboard_ids, last_result, last_run_at, created_by, created_at, updated_at FROM __saved_charts WHERE id = ?;";
        let params: [&dyn ToSql; 1] = [&id];

        let result = conn.query(select_sql, &params)
            .map_err(|e| format!("获取保存的图表失败：{}", e))?;

        if result.rows.is_empty() {
            return Err("图表不存在".to_string());
        }

        Self::row_to_saved_chart_by_name(&result.columns, &result.rows[0])
    }

    /// 获取保存的查询（按列名解析）
    pub fn get_saved_query(conn: &MutexGuardConnection<'_>, id: &str) -> Result<SavedQuery, String> {
        use crate::database::traits::ToSql;

        let select_sql = "SELECT id, name, sql, params, cache_ttl_secs, last_result, last_run_at, created_by, created_at, updated_at FROM __saved_queries WHERE id = ?;";
        let params: [&dyn ToSql; 1] = [&id];

        let result = conn.query(select_sql, &params)
            .map_err(|e| format!("获取保存的查询失败：{}", e))?;

        if result.rows.is_empty() {
            return Err("查询不存在".to_string());
        }

        Self::row_to_saved_query_by_name(&result.columns, &result.rows[0])
    }

    /// 更新保存的图表
    pub fn update_saved_chart(
        conn: &MutexGuardConnection<'_>,
        id: &str,
        name: Option<String>,
        chart_type: Option<String>,
        x_axis: Option<String>,
        y_axis: Option<Vec<String>>,
        title: Option<String>,
        tags: Option<Vec<String>>,
        description: Option<String>,
        config: Option<serde_json::Value>,
        visibility: Option<String>,
        authorized_dashboard_ids: Option<Vec<String>>,
        // 同时允许更新 SQL（若前端重新生成了结果，需要同步保存）
        sql: Option<String>,
    ) -> Result<SavedChart, String> {
        use crate::database::traits::ToSql;

        let now = Utc::now().timestamp();
        let mut updates: Vec<String> = vec!["updated_at = ?".into()];
        let mut params: Vec<Box<dyn ToSql>> = vec![Box::new(now)];

        if let Some(n) = name {
            updates.push("name = ?".into());
            params.push(Box::new(n));
        }
        if let Some(ct) = chart_type {
            updates.push("chart_type = ?".into());
            params.push(Box::new(ct));
        }
        if let Some(xa) = x_axis {
            updates.push("x_axis = ?".into());
            params.push(Box::new(xa));
        }
        if let Some(ya) = y_axis {
            let ya_json = serde_json::to_string(&ya).unwrap_or_else(|_| "[]".to_string());
            updates.push("y_axis = ?".into());
            params.push(Box::new(ya_json));
        }
        if let Some(t) = title {
            updates.push("title = ?".into());
            params.push(Box::new(t));
        }
        if let Some(tg) = tags {
            let tg_json = serde_json::to_string(&tg).unwrap_or_else(|_| "[]".to_string());
            updates.push("tags = ?".into());
            params.push(Box::new(tg_json));
        }
        if let Some(desc) = description {
            updates.push("description = ?".into());
            params.push(Box::new(desc));
        }
        if let Some(cfg) = config {
            let cfg_json = serde_json::to_string(&cfg).unwrap_or_else(|_| "{}".to_string());
            updates.push("config = ?".into());
            params.push(Box::new(cfg_json));
        }
        if let Some(vis) = visibility {
            updates.push("visibility = ?".into());
            params.push(Box::new(vis));
        }
        if let Some(auth_ids) = authorized_dashboard_ids {
            let auth_ids_json = serde_json::to_string(&auth_ids).unwrap_or_else(|_| "[]".to_string());
            updates.push("authorized_dashboard_ids = ?".into());
            params.push(Box::new(auth_ids_json));
        }
        if let Some(sql_str) = sql {
            updates.push("sql = ?".into());
            params.push(Box::new(sql_str));
        }

        let update_sql = format!(
            "UPDATE __saved_charts SET {} WHERE id = ?;",
            updates.join(", ")
        );
        params.push(Box::new(id.to_string()));

        let params_refs: Vec<&dyn ToSql> = params.iter().map(|p| p.as_ref()).collect();
        conn.execute(&update_sql, params_refs.as_slice())
            .map_err(|e| format!("更新保存的图表失败：{}", e))?;

        Self::get_saved_chart(conn, id)
    }

    /// 刷新图表查询结果（供自动化任务 refresh_chart 调用）
    /// 执行图表自身的 SQL，将结果序列化为 JSON 写回 last_result，同时更新 last_run_at 和 updated_at
    pub fn refresh_saved_chart(
        conn: &MutexGuardConnection<'_>,
        id: &str,
    ) -> Result<i64, String> {
        // 1. 读取图表记录
        let chart = Self::get_saved_chart(conn, id)?;
        if chart.sql.trim().is_empty() {
            return Err(format!("图表 {} 的 SQL 为空，无法刷新", id));
        }

        // 2. 执行 SQL 取第一条语句（防止多语句出错）
        let first_statement = chart
            .sql
            .split(';')
            .next()
            .map(|s| s.trim().to_string())
            .unwrap_or_default();
        if first_statement.is_empty() {
            return Err("图表 SQL 解析后为空".to_string());
        }
        let result = conn.query(&first_statement, &[])
            .map_err(|e| format!("刷新图表失败：{}", e))?;

        // 3. 序列化查询结果为 JSON（用最小集合：列名 + 二维数据）
        let result_json = serde_json::to_string(&serde_json::json!({
            "columns": result.columns,
            "rows": result.rows,
        })).unwrap_or_else(|_| "{}".to_string());

        let now = Utc::now().timestamp();

        // 参数化写回缓存，避免 format! + replace 单引号转义
        let update_sql = "UPDATE __saved_charts SET last_result = ?, last_run_at = ?, updated_at = ? WHERE id = ?;";
        let update_params: [&dyn crate::database::traits::ToSql; 4] = [
            &result_json, &now, &now, &id,
        ];
        conn.execute(update_sql, &update_params)
            .map_err(|e| format!("写回图表缓存失败：{}", e))?;

        // 返回行数
        Ok(result.rows.len() as i64)
    }

    /// 删除保存的图表
    pub fn delete_saved_chart(conn: &MutexGuardConnection<'_>, id: &str) -> Result<(), String> {
        use crate::database::traits::ToSql;

        let delete_sql = "DELETE FROM __saved_charts WHERE id = ?;";
        let params: [&dyn ToSql; 1] = [&id];

        conn.execute(delete_sql, &params)
            .map_err(|e| format!("删除保存的图表失败：{}", e))?;

        Ok(())
    }

    /// 按列名从查询结果行解析保存的图表（彻底避免索引错位问题）
    /// 无论 SELECT 语句的列顺序如何变化、无论老数据库的 ALTER TABLE
    /// 把新列追加到末尾，此方法都能正确解析。
    fn row_to_saved_chart_by_name(
        columns: &[String],
        row: &[String],
    ) -> Result<SavedChart, String> {
        // 构建列名 -> 索引的映射
        let col_index: std::collections::HashMap<&str, usize> = columns
            .iter()
            .enumerate()
            .map(|(i, name)| (name.as_str(), i))
            .collect();

        // 安全获取指定列的值，缺失时返回空字符串
        let get = |name: &str| -> String {
            col_index
                .get(name)
                .and_then(|&idx| row.get(idx))
                .cloned()
                .unwrap_or_default()
        };

        // 可选列（可能为 NULL）
        let get_opt = |name: &str| -> Option<String> {
            let val = get(name);
            if val.is_empty() || val == "NULL" {
                None
            } else {
                Some(val)
            }
        };

        let y_axis: Vec<String> =
            serde_json::from_str(&get("y_axis")).unwrap_or_default();
        let filters: Vec<ChartFilter> =
            serde_json::from_str(&get("filters")).unwrap_or_default();
        let tags: Vec<String> =
            serde_json::from_str(&get("tags")).unwrap_or_default();
        let config: Option<serde_json::Value> = get_opt("config")
            .and_then(|s| serde_json::from_str(&s).ok());
        // 授权范围: "all" = 所有仪表盘可用; "restricted" = 仅指定仪表盘
        let visibility = get("visibility");
        let visibility = if visibility.is_empty() { "all".to_string() } else { visibility };
        let authorized_dashboard_ids: Vec<String> =
            serde_json::from_str(&get("authorized_dashboard_ids")).unwrap_or_default();
        // 自动化任务缓存：last_result 存储上次执行 SQL 得到的查询结果 JSON
        let last_result: Option<crate::models::dashboard::QueryResult> = get_opt("last_result")
            .and_then(|s| serde_json::from_str(&s).ok());
        let last_run_at: Option<i64> = get_opt("last_run_at").and_then(|s| s.parse::<i64>().ok());

        Ok(SavedChart {
            id: get("id"),
            name: get("name"),
            query_id: get("query_id"),
            sql: get("sql"),
            chart_type: get("chart_type"),
            x_axis: get("x_axis"),
            y_axis,
            title: get("title"),
            filters,
            tags,
            description: get("description"),
            thumbnail: get_opt("thumbnail"),
            config,
            visibility,
            authorized_dashboard_ids,
            last_result,
            last_run_at,
            created_by: get("created_by"),
            created_at: get("created_at").parse::<i64>().unwrap_or(0),
            updated_at: get("updated_at").parse::<i64>().unwrap_or(0),
        })
    }

    /// 按列名从查询结果行解析保存的查询
    fn row_to_saved_query_by_name(
        columns: &[String],
        row: &[String],
    ) -> Result<SavedQuery, String> {
        let col_index: std::collections::HashMap<&str, usize> = columns
            .iter()
            .enumerate()
            .map(|(i, name)| (name.as_str(), i))
            .collect();

        let get = |name: &str| -> String {
            col_index
                .get(name)
                .and_then(|&idx| row.get(idx))
                .cloned()
                .unwrap_or_default()
        };

        let get_opt = |name: &str| -> Option<String> {
            let val = get(name);
            if val.is_empty() || val == "NULL" {
                None
            } else {
                Some(val)
            }
        };

        let params: Vec<QueryParam> =
            serde_json::from_str(&get("params")).unwrap_or_default();
        let last_result: Option<QueryResult> = get_opt("last_result")
            .and_then(|s| serde_json::from_str(&s).ok());

        Ok(SavedQuery {
            id: get("id"),
            name: get("name"),
            sql: get("sql"),
            params,
            cache_ttl_secs: get("cache_ttl_secs").parse::<i64>().unwrap_or(300),
            last_result,
            last_run_at: get_opt("last_run_at").and_then(|s| s.parse::<i64>().ok()),
            created_by: get("created_by"),
            created_at: get("created_at").parse::<i64>().unwrap_or(0),
            updated_at: get("updated_at").parse::<i64>().unwrap_or(0),
        })
    }

    /// 从查询结果行解析保存的查询
    /// 当前由 row_to_saved_query_by_name 内部调用；为将来独立查询保留的辅助函数。
    #[allow(dead_code)]
    fn row_to_saved_query(row: &[String]) -> Result<SavedQuery, String> {
        if row.len() < 10 {
            return Err("查询结果列数不足".to_string());
        }

        let params: Vec<QueryParam> = serde_json::from_str(&row[3]).unwrap_or_else(|_| Vec::new());
        let last_result: Option<QueryResult> = if row[5].is_empty() || row[5] == "null" {
            None
        } else {
            serde_json::from_str(&row[5]).ok()
        };

        Ok(SavedQuery {
            id: row[0].clone(),
            name: row[1].clone(),
            sql: row[2].clone(),
            params,
            cache_ttl_secs: row[4].parse::<i64>().unwrap_or(300),
            last_result,
            last_run_at: if row[6].is_empty() { None } else { row[6].parse::<i64>().ok() },
            created_by: row[7].clone(),
            created_at: row[8].parse::<i64>().unwrap_or(0),
            updated_at: row[9].parse::<i64>().unwrap_or(0),
        })
    }

    // ============ Dashboard CRUD ============

    /// 创建仪表盘
    pub fn create_dashboard(
        conn: &MutexGuardConnection<'_>,
        name: String,
        description: Option<String>,
    ) -> Result<Dashboard, String> {
        use crate::database::traits::ToSql;

        let id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now().timestamp();
        let description = description.unwrap_or_default();
        let layout_json = "[]".to_string();
        let filters_json = "[]".to_string();

        // 参数化插入：避免 format! + replace 单引号转义
        let insert_sql = "INSERT INTO __dashboards (id, name, description, layout, filters, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?);";
        let params: [&dyn ToSql; 7] = [
            &id, &name, &description, &layout_json, &filters_json, &now, &now,
        ];

        conn.execute(insert_sql, &params)
            .map_err(|e| {
                // P3-7: 错误码示范 — dashboard.create_failed（params: { reason }）
                AppError::new("dashboard.create_failed", "Failed to create dashboard")
                    .with_param("reason", &e.to_string())
                    .to_error_string()
            })?;

        Self::get_dashboard(conn, &id)
    }

    /// 获取仪表盘列表
    pub fn get_dashboards(conn: &MutexGuardConnection<'_>) -> Result<Vec<Dashboard>, String> {
        let select_sql = "SELECT id, name, description, layout, filters, refresh_interval_secs, is_default, created_by, background_color, background_image, canvas_width, canvas_height, padding, grid_gap, row_height, snap_to_grid, created_at, updated_at FROM __dashboards ORDER BY updated_at DESC;";

        let result = conn.query(select_sql, &[])
            .map_err(|e| format!("获取仪表盘列表失败：{}", e))?;

        let columns = result.columns;
        let mut dashboards = Vec::new();
        for row in result.rows {
            dashboards.push(Self::row_to_dashboard_by_name(conn, &columns, &row)?);
        }

        Ok(dashboards)
    }

    /// 获取单个仪表盘
    pub fn get_dashboard(conn: &MutexGuardConnection<'_>, id: &str) -> Result<Dashboard, String> {
        use crate::database::traits::ToSql;

        let select_sql = "SELECT id, name, description, layout, filters, refresh_interval_secs, is_default, created_by, background_color, background_image, canvas_width, canvas_height, padding, grid_gap, row_height, snap_to_grid, created_at, updated_at FROM __dashboards WHERE id = ?;";

        let params: Vec<Box<dyn ToSql>> = vec![Box::new(id.to_string())];
        let params_refs: Vec<&dyn ToSql> = params.iter().map(|p| p.as_ref()).collect();

        let result = conn.query(select_sql, params_refs.as_slice())
            .map_err(|e| format!("获取仪表盘失败：{}", e))?;

        if result.rows.is_empty() {
            // P3-7: 错误码示范 — dashboard.not_found（params: { id }）
            return Err(AppError::new("dashboard.not_found", "Dashboard not found")
                .with_param("id", id)
                .to_error_string());
        }

        Self::row_to_dashboard_by_name(conn, &result.columns, &result.rows[0])
    }

    /// 更新仪表盘
    pub fn update_dashboard(
        conn: &MutexGuardConnection<'_>,
        id: &str,
        name: Option<String>,
        description: Option<String>,
        layout: Option<Vec<DashboardItem>>,
        filters: Option<Vec<DashboardFilter>>,
        refresh_interval_secs: Option<i64>,
        background_color: Option<String>,
        background_image: Option<String>,
        canvas_width: Option<i64>,
        canvas_height: Option<i64>,
        padding: Option<i64>,
        grid_gap: Option<i64>,
        row_height: Option<i64>,
        snap_to_grid: Option<bool>,
    ) -> Result<Dashboard, String> {
        use crate::database::traits::ToSql;

        let now = Utc::now().timestamp();
        let mut updates: Vec<String> = vec!["updated_at = ?".into()];
        let mut params: Vec<Box<dyn ToSql>> = vec![Box::new(now)];

        if let Some(n) = name {
            updates.push("name = ?".into());
            params.push(Box::new(n));
        }
        if let Some(d) = description {
            updates.push("description = ?".into());
            params.push(Box::new(d));
        }
        if let Some(l) = layout {
            let l_json = serde_json::to_string(&l).unwrap_or_else(|_| "[]".to_string());
            updates.push("layout = ?".into());
            params.push(Box::new(l_json));
        }
        if let Some(f) = filters {
            let f_json = serde_json::to_string(&f).unwrap_or_else(|_| "[]".to_string());
            updates.push("filters = ?".into());
            params.push(Box::new(f_json));
        }
        if let Some(r) = refresh_interval_secs {
            updates.push("refresh_interval_secs = ?".into());
            params.push(Box::new(r));
        }
        if let Some(bc) = background_color {
            updates.push("background_color = ?".into());
            params.push(Box::new(bc));
        }
        if let Some(bi) = background_image {
            updates.push("background_image = ?".into());
            params.push(Box::new(bi));
        }
        if let Some(cw) = canvas_width {
            updates.push("canvas_width = ?".into());
            params.push(Box::new(cw));
        }
        if let Some(ch) = canvas_height {
            updates.push("canvas_height = ?".into());
            params.push(Box::new(ch));
        }
        if let Some(p) = padding {
            updates.push("padding = ?".into());
            params.push(Box::new(p));
        }
        if let Some(gg) = grid_gap {
            updates.push("grid_gap = ?".into());
            params.push(Box::new(gg));
        }
        if let Some(rh) = row_height {
            updates.push("row_height = ?".into());
            params.push(Box::new(rh));
        }
        if let Some(stg) = snap_to_grid {
            updates.push("snap_to_grid = ?".into());
            params.push(Box::new(stg));
        }

        let update_sql = format!(
            "UPDATE __dashboards SET {} WHERE id = ?;",
            updates.join(", ")
        );
        params.push(Box::new(id.to_string()));

        let params_refs: Vec<&dyn ToSql> = params.iter().map(|p| p.as_ref()).collect();
        conn.execute(&update_sql, params_refs.as_slice())
            .map_err(|e| {
                // P3-7: 错误码示范 — dashboard.update_failed（params: { id, reason }）
                AppError::new("dashboard.update_failed", "Failed to update dashboard")
                    .with_param("id", id)
                    .with_param("reason", &e.to_string())
                    .to_error_string()
            })?;

        Self::get_dashboard(conn, id)
    }

    /// 删除仪表盘
    ///
    /// 使用事务保证 dashboard_items 与 dashboards 两条 DELETE 语句的原子性：
    /// 任一失败则回滚，避免出现"items 已删除但 dashboard 还在"的孤儿状态。
    pub fn delete_dashboard(conn: &MutexGuardConnection<'_>, id: &str) -> Result<(), String> {
        use crate::database::traits::ToSql;

        let params: Vec<Box<dyn ToSql>> = vec![Box::new(id.to_string())];
        let params_refs: Vec<&dyn ToSql> = params.iter().map(|p| p.as_ref()).collect();

        // 开启事务，保证两条 DELETE 的原子性
        conn.begin_transaction()
            .map_err(|e| format!("开启事务失败：{}", e))?;

        // 先删除关联的 dashboard_items
        let result = conn.execute(
            "DELETE FROM __dashboard_items WHERE dashboard_id = ?;",
            params_refs.as_slice()
        )
            .map_err(|e| format!("删除仪表盘项目失败：{}", e));

        if let Err(e) = result {
            let _ = conn.rollback_transaction();
            return Err(e);
        }

        // 再删除 dashboard 本身
        match conn.execute(
            "DELETE FROM __dashboards WHERE id = ?;",
            params_refs.as_slice()
        ) {
            Ok(_) => {
                if let Err(e) = conn.commit_transaction() {
                    let _ = conn.rollback_transaction();
                    return Err(format!("提交事务失败：{}", e));
                }
                Ok(())
            }
            Err(e) => {
                let _ = conn.rollback_transaction();
                // P3-7: 错误码示范 — dashboard.delete_failed（params: { id, reason }）
                Err(AppError::new("dashboard.delete_failed", "Failed to delete dashboard")
                    .with_param("id", id)
                    .with_param("reason", &e.to_string())
                    .to_error_string())
            }
        }
    }

    /// 按列名从查询结果行解析仪表盘（彻底避免索引错位问题）
    /// 无论 SELECT 语句的列顺序如何变化、无论老数据库的 ALTER TABLE
    /// 把新列追加到末尾，此方法都能正确解析。
    fn row_to_dashboard_by_name(
        conn: &MutexGuardConnection<'_>,
        columns: &[String],
        row: &[String],
    ) -> Result<Dashboard, String> {
        // 构建列名 -> 索引的映射
        let col_index: std::collections::HashMap<&str, usize> = columns
            .iter()
            .enumerate()
            .map(|(i, name)| (name.as_str(), i))
            .collect();

        // 安全获取指定列的值，缺失时返回空字符串
        let get = |name: &str| -> String {
            col_index
                .get(name)
                .and_then(|&idx| row.get(idx))
                .cloned()
                .unwrap_or_default()
        };

        // 可选列（可能为 NULL）
        let get_opt = |name: &str| -> Option<String> {
            let val = get(name);
            if val.is_empty() || val == "NULL" {
                None
            } else {
                Some(val)
            }
        };

        // 整数列（解析失败时返回 0）
        let get_i64 = |name: &str| -> i64 {
            get(name).parse::<i64>().unwrap_or(0)
        };

        // 可选整数列
        let get_opt_i64 = |name: &str| -> Option<i64> {
            let val = get(name);
            if val.is_empty() || val == "NULL" {
                None
            } else {
                val.parse::<i64>().ok()
            }
        };

        let dashboard_id = get("id");
        let filters: Vec<DashboardFilter> = serde_json::from_str(&get("filters")).unwrap_or_else(|_| Vec::new());
        let refresh_interval_secs = get_i64("refresh_interval_secs");
        let is_default = get("is_default").to_lowercase() == "true" || get("is_default") == "1";

        // 直接从 __dashboard_items 表读取该仪表盘的所有项目
        let full_layout = match Self::get_dashboard_items(conn, &dashboard_id) {
            Ok(items) => items,
            Err(e) => {
                log::warn!("获取仪表盘 {} 的项目失败: {}", dashboard_id, e);
                Vec::new()
            }
        };

        Ok(Dashboard {
            id: dashboard_id,
            name: get("name"),
            description: get("description"),
            layout: full_layout,
            filters,
            refresh_interval_secs,
            is_default,
            created_by: get("created_by"),
            created_at: get_i64("created_at"),
            updated_at: get_i64("updated_at"),
            // 背景设置（向后兼容，没有则使用默认值）
            background_color: get_opt("background_color"),
            background_image: get_opt("background_image"),
            canvas_width: get_opt_i64("canvas_width"),
            canvas_height: get_opt_i64("canvas_height"),
            padding: get_opt_i64("padding"),
            grid_gap: {
                let val = get_opt_i64("grid_gap");
                val.unwrap_or(16)
            },
            row_height: {
                let val = get_opt_i64("row_height");
                val.unwrap_or(80)
            },
            snap_to_grid: get("snap_to_grid").to_lowercase() == "true" || get("snap_to_grid") == "1",
        })
    }

    // ============ DashboardItem CRUD ============

    /// 添加图表到仪表盘
    ///
    /// 服务端可见性校验：若图表的 `visibility='restricted'`，则要求目标
    /// `dashboard_id` 必须在图表的 `authorized_dashboard_ids` 列表中；
    /// 否则拒绝添加并返回用户友好的错误，避免前端绕过授权。
    pub fn add_chart_to_dashboard(
        conn: &MutexGuardConnection<'_>,
        dashboard_id: String,
        chart_id: String,
        x: f64,
        y: f64,
        width: f64,
        height: f64,
    ) -> Result<DashboardItem, String> {
        use crate::database::traits::ToSql;

        // 服务端可见性校验：restricted 图表只能加到授权的 dashboard
        let chart = Self::get_saved_chart(conn, &chart_id)?;
        if chart.visibility == "restricted" {
            if !chart.authorized_dashboard_ids.iter().any(|d| d == &dashboard_id) {
                // P3-7: 错误码示范 — dashboard.invalid_params（params: { field, reason }）
                let reason = format!(
                    "chart '{}' is restricted and not authorized for dashboard '{}'",
                    chart_id, dashboard_id
                );
                return Err(AppError::new("dashboard.invalid_params", "Invalid parameters")
                    .with_param("field", "visibility")
                    .with_param("reason", &reason)
                    .to_error_string());
            }
        }

        let id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now().timestamp();

        let position_params: Vec<Box<dyn ToSql>> = vec![Box::new(dashboard_id.clone())];
        let position_params_refs: Vec<&dyn ToSql> = position_params.iter().map(|p| p.as_ref()).collect();
        let position_result = conn.query(
            "SELECT COALESCE(MAX(position), -1) + 1 FROM __dashboard_items WHERE dashboard_id = ?;",
            position_params_refs.as_slice()
        )
            .map_err(|e| format!("获取位置失败：{}", e))?;
        let position: i32 = if position_result.rows.is_empty() || position_result.rows[0].is_empty() {
            0
        } else {
            position_result.rows[0][0].parse::<i32>().unwrap_or(0)
        };

        let insert_params: Vec<Box<dyn ToSql>> = vec![
            Box::new(id.clone()),
            Box::new(dashboard_id.clone()),
            Box::new(chart_id.clone()),
            Box::new(x),
            Box::new(y),
            Box::new(width),
            Box::new(height),
            Box::new(position),
            Box::new(now),
            Box::new(now),
        ];
        let insert_params_refs: Vec<&dyn ToSql> = insert_params.iter().map(|p| p.as_ref()).collect();

        conn.execute(
            "INSERT INTO __dashboard_items (id, dashboard_id, chart_id, x, y, width, height, position, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);",
            insert_params_refs.as_slice()
        )
            .map_err(|e| format!("添加图表到仪表盘失败：{}", e))?;

        Self::get_dashboard_item(conn, &id)
    }

    /// 获取仪表盘项目
    pub fn get_dashboard_item(conn: &MutexGuardConnection<'_>, id: &str) -> Result<DashboardItem, String> {
        use crate::database::traits::ToSql;

        let params: Vec<Box<dyn ToSql>> = vec![Box::new(id.to_string())];
        let params_refs: Vec<&dyn ToSql> = params.iter().map(|p| p.as_ref()).collect();

        let result = conn.query(
            "SELECT id, dashboard_id, chart_id, x, y, width, height, config_overrides, position, created_at, updated_at FROM __dashboard_items WHERE id = ?;",
            params_refs.as_slice()
        )
            .map_err(|e| format!("获取仪表盘项目失败：{}", e))?;

        if result.rows.is_empty() {
            return Err("仪表盘项目不存在".to_string());
        }

        Self::row_to_dashboard_item(&result.rows[0])
    }

    /// 获取仪表盘的所有项目
    pub fn get_dashboard_items(conn: &MutexGuardConnection<'_>, dashboard_id: &str) -> Result<Vec<DashboardItem>, String> {
        use crate::database::traits::ToSql;

        let params: Vec<Box<dyn ToSql>> = vec![Box::new(dashboard_id.to_string())];
        let params_refs: Vec<&dyn ToSql> = params.iter().map(|p| p.as_ref()).collect();

        let result = conn.query(
            "SELECT id, dashboard_id, chart_id, x, y, width, height, config_overrides, position, created_at, updated_at FROM __dashboard_items WHERE dashboard_id = ? ORDER BY position;",
            params_refs.as_slice()
        )
            .map_err(|e| format!("获取仪表盘项目列表失败：{}", e))?;

        let mut items = Vec::new();
        for row in result.rows {
            items.push(Self::row_to_dashboard_item(&row)?);
        }

        Ok(items)
    }

    /// 更新仪表盘项目
    pub fn update_dashboard_item(
        conn: &MutexGuardConnection<'_>,
        id: &str,
        x: Option<f64>,
        y: Option<f64>,
        width: Option<f64>,
        height: Option<f64>,
        config_overrides: Option<serde_json::Value>,
    ) -> Result<DashboardItem, String> {
        use crate::database::traits::ToSql;

        let now = Utc::now().timestamp();
        let mut updates: Vec<String> = vec!["updated_at = ?".into()];
        let mut params: Vec<Box<dyn ToSql>> = vec![Box::new(now)];

        if let Some(x_val) = x {
            updates.push("x = ?".into());
            params.push(Box::new(x_val));
        }
        if let Some(y_val) = y {
            updates.push("y = ?".into());
            params.push(Box::new(y_val));
        }
        if let Some(w) = width {
            updates.push("width = ?".into());
            params.push(Box::new(w));
        }
        if let Some(h) = height {
            updates.push("height = ?".into());
            params.push(Box::new(h));
        }
        if let Some(co) = config_overrides {
            let co_json = serde_json::to_string(&co).unwrap_or_else(|_| "{}".to_string());
            updates.push("config_overrides = ?".into());
            params.push(Box::new(co_json));
        }

        let update_sql = format!(
            "UPDATE __dashboard_items SET {} WHERE id = ?;",
            updates.join(", ")
        );
        params.push(Box::new(id.to_string()));

        let params_refs: Vec<&dyn ToSql> = params.iter().map(|p| p.as_ref()).collect();
        conn.execute(&update_sql, params_refs.as_slice())
            .map_err(|e| format!("更新仪表盘项目失败：{}", e))?;

        Self::get_dashboard_item(conn, id)
    }

    /// 批量保存仪表盘布局（事务性更新）
    /// 一次性更新多个仪表盘项的位置/尺寸，确保原子性
    pub fn save_dashboard_layout(
        conn: &MutexGuardConnection<'_>,
        dashboard_id: &str,
        layout_updates: Vec<DashboardItemLayoutUpdate>,
    ) -> Result<Dashboard, String> {
        use crate::database::traits::ToSql;

        // 开始事务
        conn.begin_transaction()
            .map_err(|e| format!("开启事务失败：{}", e))?;

        let now = Utc::now().timestamp();

        let result = (|| -> Result<Dashboard, String> {
            for item in &layout_updates {
                let mut updates: Vec<String> = vec!["updated_at = ?".into()];
                let mut params: Vec<Box<dyn ToSql>> = vec![Box::new(now)];

                if let Some(x_val) = item.x {
                    updates.push("x = ?".into());
                    params.push(Box::new(x_val));
                }
                if let Some(y_val) = item.y {
                    updates.push("y = ?".into());
                    params.push(Box::new(y_val));
                }
                if let Some(w) = item.width {
                    updates.push("width = ?".into());
                    params.push(Box::new(w));
                }
                if let Some(h) = item.height {
                    updates.push("height = ?".into());
                    params.push(Box::new(h));
                }

                let update_sql = format!(
                    "UPDATE __dashboard_items SET {} WHERE id = ? AND dashboard_id = ?;",
                    updates.join(", ")
                );
                params.push(Box::new(item.id.clone()));
                params.push(Box::new(dashboard_id.to_string()));

                let params_refs: Vec<&dyn ToSql> = params.iter().map(|p| p.as_ref()).collect();
                conn.execute(&update_sql, params_refs.as_slice())
                    .map_err(|e| format!("更新仪表盘项 {} 失败：{}", item.id, e))?;
            }

            // 更新仪表盘的 updated_at
            conn.execute(
                "UPDATE __dashboards SET updated_at = ? WHERE id = ?;",
                &[&now as &dyn ToSql, &dashboard_id as &dyn ToSql],
            ).map_err(|e| format!("更新仪表盘时间戳失败：{}", e))?;

            // 返回更新后的仪表盘
            Self::get_dashboard(conn, dashboard_id)
        })();

        match result {
            Ok(dashboard) => {
                conn.commit_transaction()
                    .map_err(|e| format!("提交事务失败：{}", e))?;
                Ok(dashboard)
            }
            Err(e) => {
                let _ = conn.rollback_transaction();
                Err(e)
            }
        }
    }

    /// 从仪表盘移除图表
    pub fn remove_chart_from_dashboard(conn: &MutexGuardConnection<'_>, item_id: &str) -> Result<(), String> {
        use crate::database::traits::ToSql;

        let params: Vec<Box<dyn ToSql>> = vec![Box::new(item_id.to_string())];
        let params_refs: Vec<&dyn ToSql> = params.iter().map(|p| p.as_ref()).collect();

        conn.execute(
            "DELETE FROM __dashboard_items WHERE id = ?;",
            params_refs.as_slice()
        )
            .map_err(|e| format!("从仪表盘移除图表失败：{}", e))?;

        Ok(())
    }

    /// 从查询结果行解析仪表盘项目
    fn row_to_dashboard_item(row: &[String]) -> Result<DashboardItem, String> {
        if row.len() < 11 {
            return Err("查询结果列数不足".to_string());
        }

        let config_overrides: Option<serde_json::Value> = if row[7].is_empty() || row[7] == "null" {
            None
        } else {
            serde_json::from_str(&row[7]).ok()
        };

        Ok(DashboardItem {
            id: row[0].clone(),
            dashboard_id: row[1].clone(),
            chart_id: row[2].clone(),
            x: row[3].parse::<f64>().unwrap_or(0.0),
            y: row[4].parse::<f64>().unwrap_or(0.0),
            width: row[5].parse::<f64>().unwrap_or(1.0),
            height: row[6].parse::<f64>().unwrap_or(1.0),
            config_overrides,
            position: row[8].parse::<i32>().unwrap_or(0),
            created_at: row[9].parse::<i64>().unwrap_or(0),
            updated_at: row[10].parse::<i64>().unwrap_or(0),
        })
    }

    /// 精简查询：获取所有仪表盘的基本信息（启动聚合返回用）
    /// 不加载 layout 和 filters 的 JSON 解析，仅取基础字段
    pub fn list_dashboards_lite(conn: &MutexGuardConnection<'_>) -> Result<Vec<DashboardLite>, String> {
        use crate::database::traits::ToSql;
        let empty_params: [&dyn ToSql; 0] = [];
        let rows = conn.query(
            "SELECT id, name, description, refresh_interval_secs, is_default, created_at, updated_at
             FROM __dashboards ORDER BY updated_at DESC",
            &empty_params
        ).map_err(|e| format!("获取仪表盘精简列表失败: {}", e))?;

        let mut result = Vec::new();
        for row in rows.rows {
            if row.len() < 7 { continue; }
            result.push(DashboardLite {
                id: row[0].clone(),
                name: row[1].clone(),
                description: row[2].clone(),
                refresh_interval_secs: row[3].parse().unwrap_or(0),
                is_default: row[4].parse::<i64>().unwrap_or(0) != 0,
                created_at: row[5].parse().unwrap_or(0),
                updated_at: row[6].parse().unwrap_or(0),
            });
        }
        Ok(result)
    }

    /// 精简查询：获取所有图表的基本信息（启动聚合返回用）
    /// 不解析 config / last_result 等大字段
    pub fn list_saved_charts_lite(conn: &MutexGuardConnection<'_>) -> Result<Vec<SavedChartLite>, String> {
        use crate::database::traits::ToSql;
        let empty_params: [&dyn ToSql; 0] = [];
        let rows = conn.query(
            "SELECT id, name, chart_type, x_axis, y_axis, title, tags, description, visibility, authorized_dashboard_ids, created_at, updated_at
             FROM __saved_charts ORDER BY updated_at DESC",
            &empty_params
        ).map_err(|e| format!("获取图表精简列表失败: {}", e))?;

        let mut result = Vec::new();
        for row in rows.rows {
            if row.len() < 12 { continue; }
            let y_axis: Vec<String> = serde_json::from_str(&row[4]).unwrap_or_default();
            let tags: Vec<String> = serde_json::from_str(&row[6]).unwrap_or_default();
            let authorized_dashboard_ids: Vec<String> = serde_json::from_str(&row[9]).unwrap_or_default();
            result.push(SavedChartLite {
                id: row[0].clone(),
                name: row[1].clone(),
                chart_type: row[2].clone(),
                x_axis: row[3].clone(),
                y_axis,
                title: row[5].clone(),
                tags,
                description: row[7].clone(),
                visibility: row[8].clone(),
                authorized_dashboard_ids,
                created_at: row[10].parse().unwrap_or(0),
                updated_at: row[11].parse().unwrap_or(0),
            });
        }
        Ok(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::traits::DatabaseManager;
    use crate::database::sqlite::SqliteDriver;

    // ============================================================
    // escape_sql_string 单引号转义
    // ============================================================

    #[test]
    fn escape_sql_string_basic_single_quote() {
        assert_eq!(DashboardService::escape_sql_string("O'Neil"), "O''Neil");
    }

    #[test]
    fn escape_sql_string_empty_and_plain_string() {
        assert_eq!(DashboardService::escape_sql_string(""), "");
        assert_eq!(DashboardService::escape_sql_string("hello world"), "hello world");
    }

    #[test]
    fn escape_sql_string_multiple_single_quotes() {
        assert_eq!(
            DashboardService::escape_sql_string("it's a 'test' string"),
            "it''s a ''test'' string"
        );
    }

    #[test]
    fn escape_sql_string_consecutive_single_quotes() {
        // 连续的单引号也应正确转义
        assert_eq!(DashboardService::escape_sql_string("''''"), "''''''''");
    }

    #[test]
    fn escape_sql_string_other_quotes_untouched() {
        // 双引号 / 反引号不应被此函数转义
        assert_eq!(
            DashboardService::escape_sql_string("\"test\" `col`"),
            "\"test\" `col`"
        );
    }

    #[test]
    fn escape_sql_string_unicode_input_no_panic() {
        let s = "用户'的内容 测试";
        assert_eq!(DashboardService::escape_sql_string(s), "用户''的内容 测试");
    }

    // ============================================================
    // to_sql_value 可选字符串 -> NULL / 字面量
    // ============================================================

    #[test]
    fn to_sql_value_none_returns_null() {
        assert_eq!(DashboardService::to_sql_value(None), "NULL");
    }

    #[test]
    fn to_sql_value_some_wraps_in_quotes() {
        assert_eq!(DashboardService::to_sql_value(Some("abc")), "'abc'");
    }

    #[test]
    fn to_sql_value_some_with_single_quote_gets_escaped() {
        // 内部单引号被 escape_sql_string 转义
        assert_eq!(DashboardService::to_sql_value(Some("O'Neil")), "'O''Neil'");
    }

    #[test]
    fn to_sql_value_empty_some_returns_empty_literal() {
        // 空字符串不是 NULL，应当产生 ''
        assert_eq!(DashboardService::to_sql_value(Some("")), "''");
    }

    // ============================================================
    // DDL / SQL 文本拼装（仅验证纯字符串行为）
    // ============================================================

    #[test]
    fn ddl_string_concatenation_produces_valid_substring() {
        // 不实际连数据库，仅确认字符串拼接能正确产生所需片段
        let table = "__test_charts";
        let escaped = DashboardService::escape_sql_string("it's a chart");
        let sql = format!("INSERT INTO {} (name) VALUES ('{}');", table, escaped); // safe_sql: test data
        assert!(sql.contains(table));
        assert!(sql.contains("'it''s a chart'"));
    }

    #[test]
    fn to_sql_value_inside_dynamic_dml() {
        let name_sql = DashboardService::to_sql_value(Some("chart-1"));
        let desc_sql = DashboardService::to_sql_value(None);
        let dml = format!("INSERT INTO t (name, description) VALUES ({}, {});", name_sql, desc_sql); // safe_sql: test data
        assert_eq!(dml, "INSERT INTO t (name, description) VALUES ('chart-1', NULL);");
    }

    // ============================================================
    // SavedChart / Dashboard 等结构体字段可独立构造
    // ============================================================

    #[test]
    fn saved_chart_constructible_without_db() {
        let chart = SavedChart {
            id: "c1".to_string(),
            name: "sales".to_string(),
            query_id: "q1".to_string(),
            sql: "SELECT 1".to_string(),
            chart_type: "bar".to_string(),
            x_axis: "month".to_string(),
            y_axis: vec!["revenue".to_string(), "profit".to_string()],
            title: "月度销售".to_string(),
            filters: vec![],
            tags: vec!["sales".to_string(), "monthly".to_string()],
            description: String::new(),
            thumbnail: None,
            config: None,
            visibility: "all".to_string(),
            authorized_dashboard_ids: vec![],
            last_result: None,
            last_run_at: None,
            created_by: String::new(),
            created_at: 1_700_000_000,
            updated_at: 1_700_000_000,
        };
        assert_eq!(chart.y_axis.len(), 2);
        assert_eq!(chart.visibility, "all");
        assert!(chart.last_result.is_none());
    }

    #[test]
    fn dashboard_constructible_without_db() {
        let dashboard = Dashboard {
            id: "d1".to_string(),
            name: "main".to_string(),
            description: "主仪表盘".to_string(),
            layout: vec![],
            filters: vec![],
            refresh_interval_secs: 60,
            is_default: true,
            created_by: String::new(),
            created_at: 1_700_000_000,
            updated_at: 1_700_000_000,
            background_color: None,
            background_image: None,
            canvas_width: None,
            canvas_height: None,
            padding: None,
            grid_gap: 16,
            row_height: 80,
            snap_to_grid: true,
        };
        assert!(dashboard.is_default);
        assert_eq!(dashboard.refresh_interval_secs, 60);
        assert!(dashboard.layout.is_empty());
    }

    #[test]
    fn dashboard_item_geometry_fields_round_trip() {
        let item = DashboardItem {
            id: "i1".to_string(),
            dashboard_id: "d1".to_string(),
            chart_id: "c1".to_string(),
            x: 1.0,
            y: 2.0,
            width: 3.0,
            height: 4.0,
            config_overrides: None,
            position: 7,
            created_at: 1_700_000_000,
            updated_at: 1_700_000_000,
        };
        assert_eq!(item.x, 1.0);
        assert_eq!(item.width, 3.0);
        assert_eq!(item.position, 7);
    }

    #[test]
    fn chart_filter_list_parses_from_json_vectors() {
        // y_axis / tags 是 Vec<String>，可由列表构造并能正确访问字段
        let y_axis: Vec<String> = vec!["a".to_string(), "b".to_string()];
        let tags: Vec<String> = vec!["tag1".to_string()];
        assert_eq!(y_axis.len(), 2);
        assert_eq!(tags[0], "tag1");
    }

    #[test]
    fn tags_y_axis_constructed_from_split() {
        // 字符串 split 得到 iter -> Vec<String>，可直接用于构造 SavedChart
        let raw_tags = "sales,monthly,2024";
        let tags: Vec<String> = raw_tags.split(',').map(|s| s.to_string()).collect();
        assert_eq!(tags, vec!["sales", "monthly", "2024"]);

        let raw_y = "revenue|profit|cost";
        let y_axis: Vec<String> = raw_y.split('|').map(|s| s.to_string()).collect();
        assert_eq!(y_axis.len(), 3);
    }

    #[test]
    fn y_axis_empty_json_is_empty_vec() {
        // 空的 y_axis JSON 应当解析为空 Vec，不 panic
        let y_axis: Vec<String> = serde_json::from_str("[]").unwrap_or_default();
        assert!(y_axis.is_empty());
    }

    // ============================================================
    // DashboardLite / SavedChartLite 构造
    // ============================================================

    #[test]
    fn dashboard_lite_and_saved_chart_lite_round_trip_fields() {
        let dl = DashboardLite {
            id: "d1".to_string(),
            name: "main".to_string(),
            description: String::new(),
            is_default: true,
            refresh_interval_secs: 120,
            created_at: 1,
            updated_at: 2,
        };
        assert!(dl.is_default);

        let cl = SavedChartLite {
            id: "c1".to_string(),
            name: "chart".to_string(),
            chart_type: "bar".to_string(),
            x_axis: "day".to_string(),
            y_axis: vec!["count".to_string()],
            title: String::new(),
            tags: vec![],
            description: String::new(),
            visibility: "all".to_string(),
            authorized_dashboard_ids: vec![],
            created_at: 1,
            updated_at: 2,
        };
        assert_eq!(cl.y_axis.len(), 1);
        assert_eq!(cl.visibility, "all");
    }

    // ============================================================
    // QueryResult / QueryParam 数据结构
    // ============================================================

    #[test]
    fn query_result_constructible_with_columns_and_rows() {
        let columns = vec!["id".to_string(), "name".to_string()];
        let rows = vec![
            vec!["1".to_string(), "a".to_string()],
            vec!["2".to_string(), "b".to_string()],
        ];
        let qr = QueryResult {
            columns: columns.clone(),
            rows: rows.clone(),
        };
        assert_eq!(qr.columns, columns);
        assert_eq!(qr.rows.len(), 2);
    }

    #[test]
    fn query_param_struct_fields_held_correctly() {
        let qp = QueryParam {
            name: "limit".to_string(),
            param_type: "integer".to_string(),
            default: "100".to_string(),
            options: None,
            label: "Limit".to_string(),
        };
        assert_eq!(qp.name, "limit");
        assert!(qp.options.is_none());

        let qp2 = QueryParam {
            options: Some(vec!["a".to_string(), "b".to_string()]),
            ..qp.clone()
        };
        assert_eq!(qp2.options.unwrap().len(), 2);
    }

    // ============================================================
    // ChartFilter / DashboardFilter 数据结构
    // ============================================================

    #[test]
    fn chart_filter_holds_field_operator_value() {
        let f = ChartFilter {
            field: "status".to_string(),
            operator: "=".to_string(),
            value: "active".to_string(),
        };
        assert_eq!(f.field, "status");
        assert_eq!(f.operator, "=");
        assert_eq!(f.value, "active");
    }

    #[test]
    fn dashboard_filter_default_value_serialization() {
        let df = DashboardFilter {
            id: "f1".to_string(),
            field: "status".to_string(),
            label: "Status".to_string(),
            filter_type: "select".to_string(),
            default_value: serde_json::json!("active"),
            options: Some(vec!["active".to_string(), "inactive".to_string()]),
        };
        assert_eq!(df.default_value, serde_json::json!("active"));
        assert!(df.options.is_some());
        assert_eq!(df.options.unwrap().len(), 2);
    }

    // ============================================================
    // DashboardService CRUD 集成测试
    // 使用临时 SQLite 数据库验证真实数据库操作
    // ============================================================

    /// 创建测试数据库连接，返回 (连接, 数据库管理器引用, 临时目录)
    fn create_test_db_connection() -> (MutexGuardConnection<'static>, &'static DatabaseManager, tempfile::TempDir) {
        let temp_dir = tempfile::tempdir().expect("创建临时目录失败");
        let db_path = temp_dir.path().join("test_dashboard.db");

        let mut db_manager = DatabaseManager::new();
        db_manager.register_driver(Box::new(SqliteDriver::new()));
        db_manager.create_and_connect("sqlite", &db_path).expect("连接测试数据库失败");

        // 使用 Box::leak 将 db_manager 泄漏到堆上，使其永远存在
        let db_manager: &'static DatabaseManager = Box::leak(Box::new(db_manager));

        // 获取连接并初始化表
        let conn = db_manager.get_connection().expect("获取连接失败");
        DashboardService::ensure_tables_exist(&conn).expect("初始化表失败");

        (conn, db_manager, temp_dir)
    }

    #[test]
    fn test_create_dashboard_normal() {
        let (conn, _db_manager, _temp_dir) = create_test_db_connection();

        let result = DashboardService::create_dashboard(
            &conn,
            "测试仪表盘".to_string(),
            Some("这是一个测试描述".to_string()),
        );

        assert!(result.is_ok(), "创建仪表盘应该成功: {:?}", result.err());
        let dashboard = result.unwrap();
        assert_eq!(dashboard.name, "测试仪表盘");
        assert_eq!(dashboard.description, "这是一个测试描述");
        assert!(!dashboard.id.is_empty());
        assert!(dashboard.layout.is_empty());
        assert!(dashboard.filters.is_empty());
    }

    #[test]
    fn test_create_dashboard_with_empty_description() {
        let (conn, _db_manager, _temp_dir) = create_test_db_connection();

        let result = DashboardService::create_dashboard(
            &conn,
            "无描述仪表盘".to_string(),
            None,
        );

        assert!(result.is_ok());
        let dashboard = result.unwrap();
        assert_eq!(dashboard.name, "无描述仪表盘");
        assert_eq!(dashboard.description, "");
    }

    #[test]
    fn test_create_dashboard_duplicate_name_allowed() {
        let (conn, _db_manager, _temp_dir) = create_test_db_connection();

        let result1 = DashboardService::create_dashboard(&conn, "同名仪表盘".to_string(), None);
        assert!(result1.is_ok());
        let id1 = result1.unwrap().id;

        let result2 = DashboardService::create_dashboard(&conn, "同名仪表盘".to_string(), None);
        assert!(result2.is_ok());
        let id2 = result2.unwrap().id;

        // 两个仪表盘应该有不同的 ID
        assert_ne!(id1, id2);
    }

    #[test]
    fn test_get_dashboard_exists() {
        let (conn, _db_manager, _temp_dir) = create_test_db_connection();

        // 先创建一个仪表盘
        let created = DashboardService::create_dashboard(
            &conn,
            "查找测试".to_string(),
            Some("用于查找测试的描述".to_string()),
        ).expect("创建仪表盘失败");
        let id = created.id.clone();

        // 通过 ID 获取
        let result = DashboardService::get_dashboard(&conn, &id);

        assert!(result.is_ok(), "查找存在的仪表盘应该成功: {:?}", result.err());
        let dashboard = result.unwrap();
        assert_eq!(dashboard.id, id);
        assert_eq!(dashboard.name, "查找测试");
        assert_eq!(dashboard.description, "用于查找测试的描述");
    }

    #[test]
    fn test_get_dashboard_not_exists() {
        let (conn, _db_manager, _temp_dir) = create_test_db_connection();

        let result = DashboardService::get_dashboard(&conn, "不存在的ID12345");

        assert!(result.is_err(), "查找不存在的仪表盘应该返回错误");
        assert!(result.as_ref().unwrap_err().contains("不存在"));
    }

    #[test]
    fn test_update_dashboard_normal() {
        let (conn, _db_manager, _temp_dir) = create_test_db_connection();

        // 先创建一个仪表盘
        let created = DashboardService::create_dashboard(&conn, "原名称".to_string(), None)
            .expect("创建仪表盘失败");
        let id = created.id.clone();

        // 更新仪表盘（15个参数）
        let result = DashboardService::update_dashboard(
            &conn,
            &id,
            Some("新名称".to_string()),
            Some("新描述".to_string()),
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
        );

        assert!(result.is_ok(), "更新仪表盘应该成功: {:?}", result.err());
        let updated = result.unwrap();
        assert_eq!(updated.name, "新名称");
        assert_eq!(updated.description, "新描述");
    }

    #[test]
    fn test_update_dashboard_partial() {
        let (conn, _db_manager, _temp_dir) = create_test_db_connection();

        // 先创建一个仪表盘
        let created = DashboardService::create_dashboard(
            &conn,
            "原名称".to_string(),
            Some("原描述".to_string()),
        ).expect("创建仪表盘失败");
        let id = created.id.clone();

        // 只更新名称，不更新描述
        let result = DashboardService::update_dashboard(
            &conn,
            &id,
            Some("仅更新名称".to_string()),
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
        );

        assert!(result.is_ok());
        let updated = result.unwrap();
        assert_eq!(updated.name, "仅更新名称");
        assert_eq!(updated.description, "原描述"); // 描述应该保持不变
    }

    #[test]
    fn test_update_dashboard_not_exists() {
        let (conn, _db_manager, _temp_dir) = create_test_db_connection();

        let result = DashboardService::update_dashboard(
            &conn,
            "不存在的ID",
            Some("新名称".to_string()),
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
        );

        assert!(result.is_err());
        let err_msg = result.as_ref().unwrap_err();
        assert!(err_msg.contains("不存在") || err_msg.contains("失败"));
    }

    #[test]
    fn test_delete_dashboard_normal() {
        let (conn, _db_manager, _temp_dir) = create_test_db_connection();

        // 先创建一个仪表盘
        let created = DashboardService::create_dashboard(&conn, "待删除".to_string(), None)
            .expect("创建仪表盘失败");
        let id = created.id.clone();

        // 验证创建成功
        assert!(DashboardService::get_dashboard(&conn, &id).is_ok());

        // 删除仪表盘
        let result = DashboardService::delete_dashboard(&conn, &id);

        assert!(result.is_ok(), "删除仪表盘应该成功: {:?}", result.err());

        // 验证删除后查找失败
        let get_result = DashboardService::get_dashboard(&conn, &id);
        assert!(get_result.is_err(), "删除后查找应该失败");
    }

    #[test]
    fn test_delete_dashboard_not_exists() {
        let (conn, _db_manager, _temp_dir) = create_test_db_connection();

        // 删除不存在的记录仍然返回成功（这是 delete 语句的实际行为）
        let result = DashboardService::delete_dashboard(&conn, "不存在的ID");
        assert!(result.is_ok(), "删除不存在的记录也应返回 Ok");

        // 验证数据库中确实没有这个记录
        let get_result = DashboardService::get_dashboard(&conn, "不存在的ID");
        assert!(get_result.is_err(), "查询不存在的记录应该返回错误");
    }

    #[test]
    fn test_get_saved_charts_empty_query_id() {
        let (conn, _db_manager, _temp_dir) = create_test_db_connection();

        // 不指定 query_id，应该返回所有图表（当前为空）
        let result = DashboardService::get_saved_charts(&conn, None, None);

        assert!(result.is_ok());
        let charts = result.unwrap();
        assert!(charts.is_empty(), "初始应该没有图表");
    }

    #[test]
    fn test_get_saved_charts_with_query_id_filter() {
        let (conn, _db_manager, _temp_dir) = create_test_db_connection();

        // 创建一个图表
        let chart_result = DashboardService::create_saved_chart(
            &conn,
            "测试图表".to_string(),
            "query-123".to_string(),
            "SELECT 1".to_string(),
            "bar".to_string(),
            "x".to_string(),
            vec!["y".to_string()],
            Some("标题".to_string()),
            Some(vec!["tag1".to_string()]),
            None,
            None,
            None,
            None,
        );

        assert!(chart_result.is_ok(), "创建图表应该成功: {:?}", chart_result.err());

        // 按 query_id 过滤查找
        let result = DashboardService::get_saved_charts(&conn, Some("query-123".to_string()), None);

        assert!(result.is_ok());
        let charts = result.unwrap();
        assert_eq!(charts.len(), 1);
        assert_eq!(charts[0].name, "测试图表");
        assert_eq!(charts[0].query_id, "query-123");
    }

    #[test]
    fn test_get_saved_charts_multiple_charts() {
        let (conn, _db_manager, _temp_dir) = create_test_db_connection();

        // 创建多个图表
        DashboardService::create_saved_chart(
            &conn, "图表1".to_string(), "q1".to_string(), "SELECT 1".to_string(),
            "bar".to_string(), "x".to_string(), vec!["y".to_string()],
            None, None, None, None, None, None,
        ).expect("创建图表1失败");

        DashboardService::create_saved_chart(
            &conn, "图表2".to_string(), "q2".to_string(), "SELECT 2".to_string(),
            "line".to_string(), "x".to_string(), vec!["y".to_string()],
            None, None, None, None, None, None,
        ).expect("创建图表2失败");

        // 获取所有图表
        let result = DashboardService::get_saved_charts(&conn, None, None);

        assert!(result.is_ok());
        let charts = result.unwrap();
        assert_eq!(charts.len(), 2);
    }

    #[test]
    fn test_create_and_get_saved_chart_roundtrip() {
        let (conn, _db_manager, _temp_dir) = create_test_db_connection();

        let chart = DashboardService::create_saved_chart(
            &conn,
            "圆形图表".to_string(),
            "pie-query".to_string(),
            "SELECT status, COUNT(*) FROM orders GROUP BY status".to_string(),
            "pie".to_string(),
            "status".to_string(),
            vec!["count".to_string()],
            Some("订单状态分布".to_string()),
            Some(vec!["orders".to_string(), "pie".to_string()]),
            Some("订单状态分布图".to_string()),
            None,
            None,
            None,
        ).expect("创建图表失败");

        assert_eq!(chart.name, "圆形图表");
        assert_eq!(chart.chart_type, "pie");
        assert_eq!(chart.title, "订单状态分布");

        // 通过 ID 获取
        let retrieved = DashboardService::get_saved_chart(&conn, &chart.id)
            .expect("获取图表失败");
        assert_eq!(retrieved.id, chart.id);
        assert_eq!(retrieved.name, "圆形图表");
    }

    #[test]
    fn test_update_saved_chart() {
        let (conn, _db_manager, _temp_dir) = create_test_db_connection();

        let created = DashboardService::create_saved_chart(
            &conn,
            "原名称".to_string(),
            "update-test-query".to_string(),
            "SELECT 1".to_string(),
            "bar".to_string(),
            "x".to_string(),
            vec!["y".to_string()],
            None, None, None, None, None, None,
        ).expect("创建图表失败");

        let updated = DashboardService::update_saved_chart(
            &conn,
            &created.id,
            Some("更新后的名称".to_string()),
            Some("line".to_string()),
            None,
            None,
            Some("新标题".to_string()),
            None,
            None,
            None,
            None,
            None,
            None,
        ).expect("更新图表失败");

        assert_eq!(updated.name, "更新后的名称");
        assert_eq!(updated.chart_type, "line");
        assert_eq!(updated.title, "新标题");
    }

    #[test]
    fn test_delete_saved_chart() {
        let (conn, _db_manager, _temp_dir) = create_test_db_connection();

        let created = DashboardService::create_saved_chart(
            &conn,
            "待删除图表".to_string(),
            "delete-test-query".to_string(),
            "SELECT 1".to_string(),
            "bar".to_string(),
            "x".to_string(),
            vec!["y".to_string()],
            None, None, None, None, None, None,
        ).expect("创建图表失败");

        let id = created.id.clone();

        // 验证存在
        assert!(DashboardService::get_saved_chart(&conn, &id).is_ok());

        // 删除
        DashboardService::delete_saved_chart(&conn, &id).expect("删除图表失败");

        // 验证删除
        assert!(DashboardService::get_saved_chart(&conn, &id).is_err());
    }
}

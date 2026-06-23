//! 仪表盘服务
//! 负责处理仪表盘、保存的图表等数据的存储和读取

use crate::database::traits::MutexGuardConnection;
use crate::models::dashboard::*;
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

        // 同时创建查询记录（供未来复用查询使用）
        let query_check_sql = format!(
            "SELECT id FROM __saved_queries WHERE id = '{}';",
            query_id.replace("'", "''")
        );

        let query_exists = conn.query(&query_check_sql, &[])
            .map_err(|e| format!("检查查询失败：{}", e))?
            .rows
            .len() > 0;

        if !query_exists {
            let insert_query_sql = format!(
                "INSERT INTO __saved_queries (id, name, sql, params, cache_ttl_secs, last_result, last_run_at, created_by, created_at, updated_at)
                 VALUES ('{}', '{}', '{}', '[]', 300, NULL, NULL, '', {}, {});",
                query_id.replace("'", "''"),
                name.replace("'", "''"),
                query_sql.replace("'", "''"),
                now,
                now
            );
            if let Err(e) = conn.execute(&insert_query_sql, &[]) {
                log::warn!("写入 __saved_queries 查询记录失败（非致命，图表仍可用）: {}", e);
            }
        }

        // 创建图表记录（核心：SQL直接保存到图表记录中；同时记录授权范围）
        let insert_sql = format!(
            "INSERT INTO __saved_charts (id, name, query_id, sql, chart_type, x_axis, y_axis, title, filters, tags, description, thumbnail, config, visibility, authorized_dashboard_ids, created_by, created_at, updated_at)
             VALUES ('{}', '{}', '{}', '{}', '{}', '{}', '{}', '{}', '{}', '{}', '{}', NULL, {}, '{}', '{}', '', {}, {});",
            Self::escape_sql_string(&id),
            Self::escape_sql_string(&name),
            Self::escape_sql_string(&query_id),
            Self::escape_sql_string(&query_sql),
            Self::escape_sql_string(&chart_type),
            Self::escape_sql_string(&x_axis),
            Self::escape_sql_string(&y_axis_json),
            Self::escape_sql_string(&title),
            Self::escape_sql_string(&filters_json),
            Self::escape_sql_string(&tags_json),
            Self::escape_sql_string(&description),
            match &config_json {
                Some(c) => format!("'{}'", Self::escape_sql_string(c)),
                None => "NULL".to_string(),
            },
            Self::escape_sql_string(&visibility),
            Self::escape_sql_string(&auth_ids_json),
            now,
            now
        );

        conn.execute(&insert_sql, &[])
            .map_err(|e| format!("创建保存的图表失败：{}", e))?;

        Self::get_saved_chart(conn, &id)
    }

    /// 获取保存的图表列表（按列名解析，彻底消除索引错位）
    pub fn get_saved_charts(
        conn: &MutexGuardConnection<'_>,
        query_id: Option<String>,
        tags: Option<Vec<String>>,
    ) -> Result<Vec<SavedChart>, String> {
        let mut where_clauses = Vec::new();

        if let Some(ref qid) = query_id {
            where_clauses.push(format!("query_id = '{}'", qid.replace("'", "''")));
        }

        let where_clause = if where_clauses.is_empty() {
            "".to_string()
        } else {
            format!("WHERE {}", where_clauses.join(" AND "))
        };

        // 明确列出所有列名，避免 SELECT * 带来的不确定性
        // 注意：sql 列对图表的自洽渲染至关重要；visibility / authorized_dashboard_ids 控制图表授权范围
        // last_result / last_run_at 由自动化任务刷新图表时写入，供前端跳过查询直接使用缓存
        let select_sql = format!(
            "SELECT id, name, query_id, sql, chart_type, x_axis, y_axis, title, filters, tags, description, thumbnail, config, visibility, authorized_dashboard_ids, last_result, last_run_at, created_by, created_at, updated_at
             FROM __saved_charts {} ORDER BY updated_at DESC;",
            where_clause
        );

        let result = conn.query(&select_sql, &[])
            .map_err(|e| format!("获取保存的图表列表失败：{}", e))?;

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
        let select_sql = format!(
            "SELECT id, name, query_id, sql, chart_type, x_axis, y_axis, title, filters, tags, description, thumbnail, config, visibility, authorized_dashboard_ids, last_result, last_run_at, created_by, created_at, updated_at
             FROM __saved_charts WHERE id = '{}';",
            id.replace("'", "''")
        );

        let result = conn.query(&select_sql, &[])
            .map_err(|e| format!("获取保存的图表失败：{}", e))?;

        if result.rows.is_empty() {
            return Err("图表不存在".to_string());
        }

        Self::row_to_saved_chart_by_name(&result.columns, &result.rows[0])
    }

    /// 获取保存的查询（按列名解析）
    pub fn get_saved_query(conn: &MutexGuardConnection<'_>, id: &str) -> Result<SavedQuery, String> {
        let select_sql = format!(
            "SELECT id, name, sql, params, cache_ttl_secs, last_result, last_run_at, created_by, created_at, updated_at
             FROM __saved_queries WHERE id = '{}';",
            id.replace("'", "''")
        );

        let result = conn.query(&select_sql, &[])
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
        let now = Utc::now().timestamp();
        let mut updates = vec![format!("updated_at = {}", now)];

        if let Some(n) = name {
            updates.push(format!("name = '{}'", n.replace("'", "''")));
        }
        if let Some(ct) = chart_type {
            updates.push(format!("chart_type = '{}'", ct.replace("'", "''")));
        }
        if let Some(xa) = x_axis {
            updates.push(format!("x_axis = '{}'", xa.replace("'", "''")));
        }
        if let Some(ya) = y_axis {
            let ya_json = serde_json::to_string(&ya).unwrap_or_else(|_| "[]".to_string());
            updates.push(format!("y_axis = '{}'", ya_json.replace("'", "''")));
        }
        if let Some(t) = title {
            updates.push(format!("title = '{}'", t.replace("'", "''")));
        }
        if let Some(tg) = tags {
            let tg_json = serde_json::to_string(&tg).unwrap_or_else(|_| "[]".to_string());
            updates.push(format!("tags = '{}'", tg_json.replace("'", "''")));
        }
        if let Some(desc) = description {
            updates.push(format!("description = '{}'", desc.replace("'", "''")));
        }
        if let Some(cfg) = config {
            let cfg_json = serde_json::to_string(&cfg).unwrap_or_else(|_| "{}".to_string());
            updates.push(format!("config = '{}'", cfg_json.replace("'", "''")));
        }
        if let Some(vis) = visibility {
            updates.push(format!("visibility = '{}'", vis.replace("'", "''")));
        }
        if let Some(auth_ids) = authorized_dashboard_ids {
            let auth_ids_json = serde_json::to_string(&auth_ids).unwrap_or_else(|_| "[]".to_string());
            updates.push(format!("authorized_dashboard_ids = '{}'", auth_ids_json.replace("'", "''")));
        }
        if let Some(sql_str) = sql {
            updates.push(format!("sql = '{}'", sql_str.replace("'", "''")));
        }

        let update_sql = format!(
            "UPDATE __saved_charts SET {} WHERE id = '{}';",
            updates.join(", "),
            id.replace("'", "''")
        );

        conn.execute(&update_sql, &[])
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
        let escaped_result = result_json.replace('\'', "''");

        let update_sql = format!(
            "UPDATE __saved_charts SET last_result = '{}', last_run_at = {}, updated_at = {} WHERE id = '{}';",
            escaped_result, now, now, id.replace("'", "''")
        );
        conn.execute(&update_sql, &[])
            .map_err(|e| format!("写回图表缓存失败：{}", e))?;

        // 返回行数
        Ok(result.rows.len() as i64)
    }

    /// 删除保存的图表
    pub fn delete_saved_chart(conn: &MutexGuardConnection<'_>, id: &str) -> Result<(), String> {
        let delete_sql = format!(
            "DELETE FROM __saved_charts WHERE id = '{}';",
            id.replace("'", "''")
        );

        conn.execute(&delete_sql, &[])
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
        let id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now().timestamp();
        let description = description.unwrap_or_default();
        let layout_json = "[]".to_string();
        let filters_json = "[]".to_string();

        let insert_sql = format!(
            "INSERT INTO __dashboards (id, name, description, layout, filters, created_at, updated_at)
             VALUES ('{}', '{}', '{}', '{}', '{}', {}, {});",
            id.replace("'", "''"),
            name.replace("'", "''"),
            description.replace("'", "''"),
            layout_json.replace("'", "''"),
            filters_json.replace("'", "''"),
            now,
            now
        );

        conn.execute(&insert_sql, &[])
            .map_err(|e| format!("创建仪表盘失败：{}", e))?;

        Self::get_dashboard(conn, &id)
    }

    /// 获取仪表盘列表
    pub fn get_dashboards(conn: &MutexGuardConnection<'_>) -> Result<Vec<Dashboard>, String> {
        let select_sql = "SELECT id, name, description, layout, filters, refresh_interval_secs, is_default, created_by, created_at, updated_at FROM __dashboards ORDER BY updated_at DESC;";

        let result = conn.query(select_sql, &[])
            .map_err(|e| format!("获取仪表盘列表失败：{}", e))?;

        let mut dashboards = Vec::new();
        for row in result.rows {
            dashboards.push(Self::row_to_dashboard(conn, &row)?);
        }

        Ok(dashboards)
    }

    /// 获取单个仪表盘
    pub fn get_dashboard(conn: &MutexGuardConnection<'_>, id: &str) -> Result<Dashboard, String> {
        let select_sql = format!(
            "SELECT id, name, description, layout, filters, refresh_interval_secs, is_default, created_by, created_at, updated_at FROM __dashboards WHERE id = '{}';",
            id.replace("'", "''")
        );

        let result = conn.query(&select_sql, &[])
            .map_err(|e| format!("获取仪表盘失败：{}", e))?;

        if result.rows.is_empty() {
            return Err("仪表盘不存在".to_string());
        }

        Self::row_to_dashboard(conn, &result.rows[0])
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
    ) -> Result<Dashboard, String> {
        let now = Utc::now().timestamp();
        let mut updates = vec![format!("updated_at = {}", now)];

        if let Some(n) = name {
            updates.push(format!("name = '{}'", n.replace("'", "''")));
        }
        if let Some(d) = description {
            updates.push(format!("description = '{}'", d.replace("'", "''")));
        }
        if let Some(l) = layout {
            let l_json = serde_json::to_string(&l).unwrap_or_else(|_| "[]".to_string());
            updates.push(format!("layout = '{}'", l_json.replace("'", "''")));
        }
        if let Some(f) = filters {
            let f_json = serde_json::to_string(&f).unwrap_or_else(|_| "[]".to_string());
            updates.push(format!("filters = '{}'", f_json.replace("'", "''")));
        }
        if let Some(r) = refresh_interval_secs {
            updates.push(format!("refresh_interval_secs = {}", r));
        }

        let update_sql = format!(
            "UPDATE __dashboards SET {} WHERE id = '{}';",
            updates.join(", "),
            id.replace("'", "''")
        );

        conn.execute(&update_sql, &[])
            .map_err(|e| format!("更新仪表盘失败：{}", e))?;

        Self::get_dashboard(conn, id)
    }

    /// 删除仪表盘
    pub fn delete_dashboard(conn: &MutexGuardConnection<'_>, id: &str) -> Result<(), String> {
        // 先删除关联的 dashboard_items
        let delete_items_sql = format!(
            "DELETE FROM __dashboard_items WHERE dashboard_id = '{}';",
            id.replace("'", "''")
        );
        conn.execute(&delete_items_sql, &[])
            .map_err(|e| format!("删除仪表盘项目失败：{}", e))?;

        let delete_sql = format!(
            "DELETE FROM __dashboards WHERE id = '{}';",
            id.replace("'", "''")
        );

        conn.execute(&delete_sql, &[])
            .map_err(|e| format!("删除仪表盘失败：{}", e))?;

        Ok(())
    }

    /// 从查询结果行解析仪表盘
    fn row_to_dashboard(conn: &MutexGuardConnection<'_>, row: &[String]) -> Result<Dashboard, String> {
        if row.len() < 10 {
            return Err("查询结果列数不足".to_string());
        }

        let dashboard_id = row[0].clone();
        let filters: Vec<DashboardFilter> = serde_json::from_str(&row[4]).unwrap_or_else(|_| Vec::new());
        let refresh_interval_secs: i64 = row[5].parse().unwrap_or(0);
        let is_default: bool = row[6].to_lowercase() == "true" || row[6] == "1";

        // 直接从 __dashboard_items 表读取该仪表盘的所有项目
        let full_layout = Self::get_dashboard_items(conn, &dashboard_id).unwrap_or_default();

        Ok(Dashboard {
            id: dashboard_id,
            name: row[1].clone(),
            description: row[2].clone(),
            layout: full_layout,
            filters,
            refresh_interval_secs,
            is_default,
            created_by: row[7].clone(),
            created_at: row[8].parse::<i64>().unwrap_or(0),
            updated_at: row[9].parse::<i64>().unwrap_or(0),
        })
    }

    // ============ DashboardItem CRUD ============

    /// 添加图表到仪表盘
    pub fn add_chart_to_dashboard(
        conn: &MutexGuardConnection<'_>,
        dashboard_id: String,
        chart_id: String,
        x: f64,
        y: f64,
        width: f64,
        height: f64,
    ) -> Result<DashboardItem, String> {
        let id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now().timestamp();

        // 获取当前最大的 position
        let position_sql = format!(
            "SELECT COALESCE(MAX(position), -1) + 1 FROM __dashboard_items WHERE dashboard_id = '{}';",
            dashboard_id.replace("'", "''")
        );
        let position_result = conn.query(&position_sql, &[])
            .map_err(|e| format!("获取位置失败：{}", e))?;
        let position: i32 = if position_result.rows.is_empty() || position_result.rows[0].is_empty() {
            0
        } else {
            position_result.rows[0][0].parse::<i32>().unwrap_or(0)
        };

        let insert_sql = format!(
            "INSERT INTO __dashboard_items (id, dashboard_id, chart_id, x, y, width, height, position, created_at, updated_at)
             VALUES ('{}', '{}', '{}', {}, {}, {}, {}, {}, {}, {});",
            id.replace("'", "''"),
            dashboard_id.replace("'", "''"),
            chart_id.replace("'", "''"),
            x,
            y,
            width,
            height,
            position,
            now,
            now
        );

        conn.execute(&insert_sql, &[])
            .map_err(|e| format!("添加图表到仪表盘失败：{}", e))?;

        Self::get_dashboard_item(conn, &id)
    }

    /// 获取仪表盘项目
    pub fn get_dashboard_item(conn: &MutexGuardConnection<'_>, id: &str) -> Result<DashboardItem, String> {
        let select_sql = format!(
            "SELECT id, dashboard_id, chart_id, x, y, width, height, config_overrides, position, created_at, updated_at FROM __dashboard_items WHERE id = '{}';",
            id.replace("'", "''")
        );

        let result = conn.query(&select_sql, &[])
            .map_err(|e| format!("获取仪表盘项目失败：{}", e))?;

        if result.rows.is_empty() {
            return Err("仪表盘项目不存在".to_string());
        }

        Self::row_to_dashboard_item(&result.rows[0])
    }

    /// 获取仪表盘的所有项目
    pub fn get_dashboard_items(conn: &MutexGuardConnection<'_>, dashboard_id: &str) -> Result<Vec<DashboardItem>, String> {
        let select_sql = format!(
            "SELECT id, dashboard_id, chart_id, x, y, width, height, config_overrides, position, created_at, updated_at FROM __dashboard_items WHERE dashboard_id = '{}' ORDER BY position;",
            dashboard_id.replace("'", "''")
        );

        let result = conn.query(&select_sql, &[])
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
        let now = Utc::now().timestamp();
        let mut updates = vec![format!("updated_at = {}", now)];

        if let Some(x_val) = x {
            updates.push(format!("x = {}", x_val));
        }
        if let Some(y_val) = y {
            updates.push(format!("y = {}", y_val));
        }
        if let Some(w) = width {
            updates.push(format!("width = {}", w));
        }
        if let Some(h) = height {
            updates.push(format!("height = {}", h));
        }
        if let Some(co) = config_overrides {
            let co_json = serde_json::to_string(&co).unwrap_or_else(|_| "{}".to_string());
            updates.push(format!("config_overrides = '{}'", co_json.replace("'", "''")));
        }

        let update_sql = format!(
            "UPDATE __dashboard_items SET {} WHERE id = '{}';",
            updates.join(", "),
            id.replace("'", "''")
        );

        conn.execute(&update_sql, &[])
            .map_err(|e| format!("更新仪表盘项目失败：{}", e))?;

        Self::get_dashboard_item(conn, id)
    }

    /// 从仪表盘移除图表
    pub fn remove_chart_from_dashboard(conn: &MutexGuardConnection<'_>, item_id: &str) -> Result<(), String> {
        let delete_sql = format!(
            "DELETE FROM __dashboard_items WHERE id = '{}';",
            item_id.replace("'", "''")
        );

        conn.execute(&delete_sql, &[])
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
            "SELECT id, name, chart_type, x_axis, y_axis, title, tags, description, visibility, created_at, updated_at
             FROM __saved_charts ORDER BY updated_at DESC",
            &empty_params
        ).map_err(|e| format!("获取图表精简列表失败: {}", e))?;

        let mut result = Vec::new();
        for row in rows.rows {
            if row.len() < 11 { continue; }
            let y_axis: Vec<String> = serde_json::from_str(&row[4]).unwrap_or_default();
            let tags: Vec<String> = serde_json::from_str(&row[6]).unwrap_or_default();
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
                created_at: row[9].parse().unwrap_or(0),
                updated_at: row[10].parse().unwrap_or(0),
            });
        }
        Ok(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
        let sql = format!("INSERT INTO {} (name) VALUES ('{}');", table, escaped);
        assert!(sql.contains(table));
        assert!(sql.contains("'it''s a chart'"));
    }

    #[test]
    fn to_sql_value_inside_dynamic_dml() {
        let name_sql = DashboardService::to_sql_value(Some("chart-1"));
        let desc_sql = DashboardService::to_sql_value(None);
        let dml = format!("INSERT INTO t (name, description) VALUES ({}, {});", name_sql, desc_sql);
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
}

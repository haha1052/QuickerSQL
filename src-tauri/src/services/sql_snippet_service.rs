//! SQL 片段服务
//! 负责处理 SQL 片段的增删改查等逻辑

use crate::database::traits::MutexGuardConnection;
use crate::models::sql_snippet::SqlSnippet;
use chrono::Utc;

pub struct SqlSnippetService;

impl SqlSnippetService {
    /// 确保 SQL 片段系统表 `__sql_snippets` 存在。
    ///
    /// - 参数 `conn`：数据库连接
    /// - 行为：幂等创建表 + name/category/is_favorite 三个索引
    /// - 返回：成功返回 `Ok(())`；任一 DDL 失败时返回带具体名称的错误信息
    pub fn ensure_table_exists(conn: &MutexGuardConnection<'_>) -> Result<(), String> {
        conn.execute(
            r#"CREATE TABLE IF NOT EXISTS __sql_snippets (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                sql TEXT NOT NULL,
                description TEXT,
                category TEXT,
                tags TEXT,
                is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )"#,
            &[],
        ).map_err(|e| format!("创建 SQL 片段表失败：{}", e))?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_snippets_name ON __sql_snippets(name)",
            &[],
        ).map_err(|e| format!("创建 idx_snippets_name 索引失败：{}", e))?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_snippets_category ON __sql_snippets(category)",
            &[],
        ).map_err(|e| format!("创建 idx_snippets_category 索引失败：{}", e))?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_snippets_favorite ON __sql_snippets(is_favorite)",
            &[],
        ).map_err(|e| format!("创建 idx_snippets_favorite 索引失败：{}", e))?;
        Ok(())
    }

    /// 列出 SQL 片段（可选按 category 过滤）。
    ///
    /// - 参数 `conn`：数据库连接
    /// - 参数 `category`：可选分类过滤；None 表示返回全部
    /// - 返回：`Vec<SqlSnippet>`，按 `updated_at DESC` 排序；空表返回空 Vec
    pub fn list_snippets(conn: &MutexGuardConnection<'_>, category: Option<&str>) -> Result<Vec<SqlSnippet>, String> {
        let result = if let Some(cat) = category {
            let sql = "SELECT id, name, sql, description, category, tags, is_favorite, created_at, updated_at 
                       FROM __sql_snippets WHERE category = ?1 ORDER BY updated_at DESC";
            conn.query(sql, &[&cat as &dyn crate::database::traits::ToSql])
        } else {
            let sql = "SELECT id, name, sql, description, category, tags, is_favorite, created_at, updated_at 
                       FROM __sql_snippets ORDER BY updated_at DESC";
            conn.query(sql, &[])
        }.map_err(|e| format!("查询 SQL 片段列表失败：{}", e))?;

        let mut snippets = Vec::new();
        for row in result.rows {
            snippets.push(Self::row_to_snippet(&row)?);
        }
        Ok(snippets)
    }

    /// 按 ID 查询单个 SQL 片段。
    ///
    /// - 参数 `conn`：数据库连接
    /// - 参数 `id`：片段 ID
    /// - 返回：`Ok(Some(snippet))` 存在；`Ok(None)` 不存在；查询失败返回 Err
    pub fn get_snippet(conn: &MutexGuardConnection<'_>, id: &str) -> Result<Option<SqlSnippet>, String> {
        let sql = "SELECT id, name, sql, description, category, tags, is_favorite, created_at, updated_at
                   FROM __sql_snippets WHERE id = ?1";

        let result = conn.query(sql, &[&id])
            .map_err(|e| format!("查询 SQL 片段失败：{}", e))?;

        if result.rows.is_empty() {
            Ok(None)
        } else {
            Ok(Some(Self::row_to_snippet(&result.rows[0])?))
        }
    }

    /// 创建新的 SQL 片段。
    ///
    /// - 参数 `conn`：数据库连接
    /// - 参数 `name`：片段名称（无 UNIQUE 约束，允许重名）
    /// - 参数 `sql`：SQL 文本（原样存储，支持特殊字符/多语句）
    /// - 参数 `description`/`category`/`tags`：可选元信息；None 时存空字符串但返回 None
    /// - 返回：新建的 `SqlSnippet`（is_favorite 默认 false）
    pub fn create_snippet(
        conn: &MutexGuardConnection<'_>,
        name: &str,
        sql: &str,
        description: Option<&str>,
        category: Option<&str>,
        tags: Option<&str>,
    ) -> Result<SqlSnippet, String> {
        let id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();

        let desc_param = description.unwrap_or("");
        let cat_param = category.unwrap_or("");
        let tags_param = tags.unwrap_or("");

        conn.execute(
            "INSERT INTO __sql_snippets (id, name, sql, description, category, tags, is_favorite, created_at, updated_at) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, FALSE, ?7, ?8)",
            &[&id as &dyn crate::database::traits::ToSql, &name, &sql, &desc_param, &cat_param, &tags_param, &now, &now],
        ).map_err(|e| format!("创建 SQL 片段失败：{}", e))?;

        Ok(SqlSnippet {
            id,
            name: name.to_string(),
            sql: sql.to_string(),
            description: if description.is_some() { Some(desc_param.to_string()) } else { None },
            category: if category.is_some() { Some(cat_param.to_string()) } else { None },
            tags: if tags.is_some() { Some(tags_param.to_string()) } else { None },
            is_favorite: false,
            created_at: now.clone(),
            updated_at: now,
        })
    }

    /// 更新 SQL 片段（全字段替换式更新；is_favorite=None 时保留原值）。
    ///
    /// - 参数 `conn`：数据库连接
    /// - 参数 `id`：片段 ID
    /// - 参数 `name`/`sql`：必填，直接覆盖
    /// - 参数 `description`/`category`/`tags`：可选；未传时按原值保留逻辑处理
    /// - 参数 `is_favorite`：可选；None 时沿用原值
    /// - 返回：更新后的 `SqlSnippet`（created_at 不变，updated_at 刷新）
    /// - 错误：片段不存在、UPDATE 失败时返回 Err
    // TODO(2026-07-17): 参数 8 个，与 commands/sql.rs::update_sql_snippet 一一对应，
    // 重构需同步前端调用契约，留待 v24.0 统一引入 UpdateSnippetParams struct
    #[allow(clippy::too_many_arguments)]
    pub fn update_snippet(
        conn: &MutexGuardConnection<'_>,
        id: &str,
        name: &str,
        sql: &str,
        description: Option<&str>,
        category: Option<&str>,
        tags: Option<&str>,
        is_favorite: Option<bool>,
    ) -> Result<SqlSnippet, String> {
        let now = Utc::now().to_rfc3339();

        let current = Self::get_snippet(conn, id)?
            .ok_or_else(|| format!("SQL 片段不存在：{}", id))?;

        let new_name = name;
        let new_sql = sql;
        let new_desc = description.unwrap_or("");
        let new_cat = category.unwrap_or("");
        let new_tags = tags.unwrap_or("");
        let new_favorite = is_favorite.unwrap_or(current.is_favorite);

        conn.execute(
            "UPDATE __sql_snippets SET name = ?1, sql = ?2, description = ?3, category = ?4, tags = ?5, is_favorite = ?6, updated_at = ?7 WHERE id = ?8",
            &[
                &new_name as &dyn crate::database::traits::ToSql,
                &new_sql,
                &new_desc,
                &new_cat,
                &new_tags,
                &new_favorite,
                &now,
                &id,
            ],
        ).map_err(|e| format!("更新 SQL 片段失败：{}", e))?;

        Ok(SqlSnippet {
            id: id.to_string(),
            name: new_name.to_string(),
            sql: new_sql.to_string(),
            description: if description.is_some() || current.description.is_some() {
                if new_desc.is_empty() { None } else { Some(new_desc.to_string()) }
            } else { None },
            category: if category.is_some() || current.category.is_some() {
                if new_cat.is_empty() { None } else { Some(new_cat.to_string()) }
            } else { None },
            tags: if tags.is_some() || current.tags.is_some() {
                if new_tags.is_empty() { None } else { Some(new_tags.to_string()) }
            } else { None },
            is_favorite: new_favorite,
            created_at: current.created_at,
            updated_at: now,
        })
    }

    /// 按 ID 删除 SQL 片段。
    ///
    /// - 参数 `conn`：数据库连接
    /// - 参数 `id`：片段 ID
    /// - 返回：成功返回 `Ok(())`；SQLite 对不存在的 ID 也返回 Ok，调用方需自行检查影响行数
    pub fn delete_snippet(conn: &MutexGuardConnection<'_>, id: &str) -> Result<(), String> {
        conn.execute(
            "DELETE FROM __sql_snippets WHERE id = ?1",
            &[&id as &dyn crate::database::traits::ToSql],
        ).map_err(|e| format!("删除 SQL 片段失败：{}", e))?;
        Ok(())
    }

    /// 切换 SQL 片段的收藏状态（true <-> false）。
    ///
    /// - 参数 `conn`：数据库连接
    /// - 参数 `id`：片段 ID
    /// - 返回：切换后的最新收藏状态（true=已收藏，false=未收藏）
    /// - 错误：片段不存在时返回带 ID 的错误信息
    pub fn toggle_favorite(conn: &MutexGuardConnection<'_>, id: &str) -> Result<bool, String> {
        let current = Self::get_snippet(conn, id)?
            .ok_or_else(|| format!("SQL 片段不存在：{}", id))?;

        let new_favorite = !current.is_favorite;
        let now = Utc::now().to_rfc3339();

        conn.execute(
            "UPDATE __sql_snippets SET is_favorite = ?1, updated_at = ?2 WHERE id = ?3",
            &[
                &new_favorite as &dyn crate::database::traits::ToSql,
                &now,
                &id,
            ],
        ).map_err(|e| format!("切换收藏状态失败：{}", e))?;

        Ok(new_favorite)
    }

    fn row_to_snippet(row: &[String]) -> Result<SqlSnippet, String> {
        if row.len() < 9 {
            return Err("查询结果列数不足".to_string());
        }

        Ok(SqlSnippet {
            id: row[0].clone(),
            name: row[1].clone(),
            sql: row[2].clone(),
            description: if row[3].is_empty() || row[3].eq_ignore_ascii_case("null") { None } else { Some(row[3].clone()) },
            category: if row[4].is_empty() || row[4].eq_ignore_ascii_case("null") { None } else { Some(row[4].clone()) },
            tags: if row[5].is_empty() || row[5].eq_ignore_ascii_case("null") { None } else { Some(row[5].clone()) },
            is_favorite: row[6].to_lowercase() == "true" || row[6] == "1",
            created_at: row[7].clone(),
            updated_at: row[8].clone(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::traits::DatabaseManager;
    use crate::database::sqlite::SqliteDriver;

    // ============================================================
    // 测试辅助函数：建立临时 SQLite 连接并初始化 __sql_snippets 表
    // 参考 dashboard_service.rs 测试模块的写法
    // ============================================================

    /// 创建测试数据库连接，返回 (连接, 数据库管理器引用, 临时目录)
    /// 通过 Box::leak 让 db_manager 拥有 'static 生命周期，匹配 MutexGuardConnection<'static>
    fn create_test_db_connection() -> (MutexGuardConnection<'static>, &'static DatabaseManager, tempfile::TempDir) {
        let temp_dir = tempfile::tempdir().expect("创建临时目录失败");
        let db_path = temp_dir.path().join("test_sql_snippet.db");

        let mut db_manager = DatabaseManager::new();
        db_manager.register_driver(Box::new(SqliteDriver::new()));
        db_manager.create_and_connect("sqlite", &db_path).expect("连接测试数据库失败");

        // 使用 Box::leak 将 db_manager 泄漏到堆上，使其永远存在
        let db_manager: &'static DatabaseManager = Box::leak(Box::new(db_manager));

        // 获取连接并初始化表
        let conn = db_manager.get_connection().expect("获取连接失败");
        SqlSnippetService::ensure_table_exists(&conn).expect("初始化 __sql_snippets 表失败");

        (conn, db_manager, temp_dir)
    }

    // ============================================================
    // TC-1: create_snippet + get_snippet 往返一致性
    // ============================================================

    #[test]
    fn test_create_and_get_snippet_roundtrip() {
        let (conn, _db_manager, _temp_dir) = create_test_db_connection();

        // 创建一个带全部可选字段的片段
        let created = SqlSnippetService::create_snippet(
            &conn,
            "月度销售查询",
            "SELECT month, revenue FROM sales ORDER BY month DESC",
            Some("按月汇总销售收入"),
            Some("reporting"),
            Some("monthly,sales"),
        ).expect("创建 SQL 片段失败");

        // 验证返回值字段一致
        assert_eq!(created.name, "月度销售查询");
        assert_eq!(created.sql, "SELECT month, revenue FROM sales ORDER BY month DESC");
        assert_eq!(created.description.as_deref(), Some("按月汇总销售收入"));
        assert_eq!(created.category.as_deref(), Some("reporting"));
        assert_eq!(created.tags.as_deref(), Some("monthly,sales"));
        assert!(!created.is_favorite, "新建片段默认不收藏");
        assert!(!created.id.is_empty(), "ID 应非空");
        assert!(!created.created_at.is_empty());
        assert_eq!(created.created_at, created.updated_at);

        // 按 id 查询验证
        let fetched = SqlSnippetService::get_snippet(&conn, &created.id)
            .expect("查询 SQL 片段失败");
        let fetched = fetched.expect("刚创建的片段应能查到");
        assert_eq!(fetched.id, created.id);
        assert_eq!(fetched.name, "月度销售查询");
        assert_eq!(fetched.sql, "SELECT month, revenue FROM sales ORDER BY month DESC");
        assert_eq!(fetched.description.as_deref(), Some("按月汇总销售收入"));
        assert_eq!(fetched.category.as_deref(), Some("reporting"));
        assert_eq!(fetched.tags.as_deref(), Some("monthly,sales"));
        assert!(!fetched.is_favorite);
    }

    // ============================================================
    // TC-2: create_snippet 可选字段为 None 时，返回值与 DB 行均为 None
    // ============================================================

    #[test]
    fn test_create_snippet_without_optional_fields() {
        let (conn, _db_manager, _temp_dir) = create_test_db_connection();

        let created = SqlSnippetService::create_snippet(
            &conn,
            "简单查询",
            "SELECT 1",
            None,
            None,
            None,
        ).expect("创建无可选字段的片段失败");

        assert!(created.description.is_none(), "未传 description 时应返回 None");
        assert!(created.category.is_none(), "未传 category 时应返回 None");
        assert!(created.tags.is_none(), "未传 tags 时应返回 None");

        // 数据库读取后也应为 None（row_to_snippet 把空串映射回 None）
        let fetched = SqlSnippetService::get_snippet(&conn, &created.id)
            .expect("查询失败")
            .expect("片段应存在");
        assert!(fetched.description.is_none());
        assert!(fetched.category.is_none());
        assert!(fetched.tags.is_none());
    }

    // ============================================================
    // TC-3: list_snippets 空表返回空 Vec
    // ============================================================

    #[test]
    fn test_list_snippets_empty() {
        let (conn, _db_manager, _temp_dir) = create_test_db_connection();

        let all = SqlSnippetService::list_snippets(&conn, None)
            .expect("空表查询应成功");
        assert!(all.is_empty(), "空表 list 应返回空 Vec");
    }

    // ============================================================
    // TC-4: list_snippets 多条记录数量 + 排序（按 updated_at DESC）
    // ============================================================

    #[test]
    fn test_list_snippets_multiple_and_order() {
        let (conn, _db_manager, _temp_dir) = create_test_db_connection();

        // 顺序创建 3 个片段
        let s1 = SqlSnippetService::create_snippet(
            &conn, "first", "SELECT 1", None, Some("cat-a"), None,
        ).expect("创建片段 1 失败");
        // 让 updated_at 拉开差距（chrono::Utc::now 精度到纳秒，一般够用；这里 sleep 一下更稳）
        std::thread::sleep(std::time::Duration::from_millis(10));
        let s2 = SqlSnippetService::create_snippet(
            &conn, "second", "SELECT 2", None, Some("cat-b"), None,
        ).expect("创建片段 2 失败");
        std::thread::sleep(std::time::Duration::from_millis(10));
        let s3 = SqlSnippetService::create_snippet(
            &conn, "third", "SELECT 3", None, Some("cat-a"), None,
        ).expect("创建片段 3 失败");

        // 全量查询
        let all = SqlSnippetService::list_snippets(&conn, None)
            .expect("list 全量查询失败");
        assert_eq!(all.len(), 3, "应有 3 条记录");

        // ORDER BY updated_at DESC —— 最后创建的应排在最前
        assert_eq!(all[0].id, s3.id, "最新创建的应排第一");
        assert_eq!(all[1].id, s2.id);
        assert_eq!(all[2].id, s1.id, "最早创建的应排最后");
    }

    // ============================================================
    // TC-5: list_snippets 按 category 过滤
    // ============================================================

    #[test]
    fn test_list_snippets_with_category_filter() {
        let (conn, _db_manager, _temp_dir) = create_test_db_connection();

        SqlSnippetService::create_snippet(
            &conn, "r1", "SELECT 1", None, Some("reporting"), None,
        ).expect("创建 r1 失败");
        SqlSnippetService::create_snippet(
            &conn, "r2", "SELECT 2", None, Some("reporting"), None,
        ).expect("创建 r2 失败");
        SqlSnippetService::create_snippet(
            &conn, "d1", "SELECT 3", None, Some("dml"), None,
        ).expect("创建 d1 失败");

        // 过滤 reporting
        let reporting = SqlSnippetService::list_snippets(&conn, Some("reporting"))
            .expect("按 category 过滤查询失败");
        assert_eq!(reporting.len(), 2, "reporting 类别应有 2 条");
        assert!(reporting.iter().all(|s| s.category.as_deref() == Some("reporting")));

        // 过滤 dml
        let dml = SqlSnippetService::list_snippets(&conn, Some("dml"))
            .expect("按 category 过滤查询失败");
        assert_eq!(dml.len(), 1, "dml 类别应有 1 条");
        assert_eq!(dml[0].name, "d1");

        // 过滤不存在的 category
        let none_cat = SqlSnippetService::list_snippets(&conn, Some("not-exists"))
            .expect("查询不存在的 category 应返回空 Vec 而非错误");
        assert!(none_cat.is_empty());
    }

    // ============================================================
    // TC-6: update_snippet 更新 name / sql / description / category / tags / is_favorite
    // ============================================================

    #[test]
    fn test_update_snippet_all_fields() {
        let (conn, _db_manager, _temp_dir) = create_test_db_connection();

        let created = SqlSnippetService::create_snippet(
            &conn, "原名", "SELECT 1", None, None, None,
        ).expect("创建片段失败");
        let original_created_at = created.created_at.clone();

        // 全字段更新
        let updated = SqlSnippetService::update_snippet(
            &conn,
            &created.id,
            "新名",
            "SELECT 2",
            Some("新描述"),
            Some("new-cat"),
            Some("t1,t2"),
            Some(true),
        ).expect("更新片段失败");

        assert_eq!(updated.id, created.id);
        assert_eq!(updated.name, "新名");
        assert_eq!(updated.sql, "SELECT 2");
        assert_eq!(updated.description.as_deref(), Some("新描述"));
        assert_eq!(updated.category.as_deref(), Some("new-cat"));
        assert_eq!(updated.tags.as_deref(), Some("t1,t2"));
        assert!(updated.is_favorite, "is_favorite 应被更新为 true");
        assert_eq!(updated.created_at, original_created_at, "created_at 不应被改变");
        // updated_at 应改变（至少不会早于 created_at）
        assert!(updated.updated_at >= original_created_at);

        // 从 DB 重新查询，验证持久化
        let fetched = SqlSnippetService::get_snippet(&conn, &created.id)
            .expect("查询失败")
            .expect("片段应存在");
        assert_eq!(fetched.name, "新名");
        assert_eq!(fetched.sql, "SELECT 2");
        assert_eq!(fetched.description.as_deref(), Some("新描述"));
        assert_eq!(fetched.category.as_deref(), Some("new-cat"));
        assert_eq!(fetched.tags.as_deref(), Some("t1,t2"));
        assert!(fetched.is_favorite);
    }

    // ============================================================
    // TC-7: update_snippet 不存在的 id 返回错误
    // ============================================================

    #[test]
    fn test_update_snippet_not_exists() {
        let (conn, _db_manager, _temp_dir) = create_test_db_connection();

        let result = SqlSnippetService::update_snippet(
            &conn,
            "nonexistent-id-xyz",
            "name",
            "SELECT 1",
            None,
            None,
            None,
            None,
        );

        assert!(result.is_err(), "更新不存在的片段应返回错误");
        assert!(result.as_ref().unwrap_err().contains("不存在"),
            "错误信息应包含'不存在'，实际: {}", result.as_ref().unwrap_err());
    }

    // ============================================================
    // TC-8: update_snippet is_favorite=None 时保留原值
    // ============================================================

    #[test]
    fn test_update_snippet_preserves_favorite_when_none() {
        let (conn, _db_manager, _temp_dir) = create_test_db_connection();

        // 创建默认（is_favorite=false）的片段
        let created = SqlSnippetService::create_snippet(
            &conn, "n", "SELECT 1", None, None, None,
        ).expect("创建片段失败");
        assert!(!created.is_favorite);

        // 先 toggle 到 true
        let new_fav = SqlSnippetService::toggle_favorite(&conn, &created.id)
            .expect("toggle_favorite 失败");
        assert!(new_fav, "首次 toggle 应返回 true");

        // update_snippet 不传 is_favorite（None），应保留 true
        let updated = SqlSnippetService::update_snippet(
            &conn,
            &created.id,
            "n2",
            "SELECT 2",
            None,
            None,
            None,
            None, // is_favorite = None
        ).expect("更新失败");
        assert!(updated.is_favorite, "is_favorite 应保留为 true");
    }

    // ============================================================
    // TC-9: delete_snippet 删除后 get_snippet 返回 None
    // ============================================================

    #[test]
    fn test_delete_snippet_then_get_returns_none() {
        let (conn, _db_manager, _temp_dir) = create_test_db_connection();

        let created = SqlSnippetService::create_snippet(
            &conn, "待删除", "SELECT 1", None, None, None,
        ).expect("创建片段失败");
        let id = created.id.clone();

        // 验证存在
        let before = SqlSnippetService::get_snippet(&conn, &id)
            .expect("删除前查询失败");
        assert!(before.is_some(), "删除前应能查到");

        // 删除
        SqlSnippetService::delete_snippet(&conn, &id).expect("删除应成功");

        // 删除后查询应返回 Ok(None)
        let after = SqlSnippetService::get_snippet(&conn, &id)
            .expect("删除后查询不应返回 Err");
        assert!(after.is_none(), "删除后应返回 None");

        // list 也应不再包含该片段
        let all = SqlSnippetService::list_snippets(&conn, None)
            .expect("list 查询失败");
        assert!(all.iter().all(|s| s.id != id), "list 中不应再包含已删除的 id");
    }

    // ============================================================
    // TC-10: delete_snippet 不存在的 id 返回 Ok（delete 语句的实际行为）
    // ============================================================

    #[test]
    fn test_delete_snippet_not_exists_returns_ok() {
        let (conn, _db_manager, _temp_dir) = create_test_db_connection();

        // SQLite 的 DELETE 对不存在的行也返回成功
        let result = SqlSnippetService::delete_snippet(&conn, "nonexistent-id");
        assert!(result.is_ok(), "删除不存在的 id 也应返回 Ok");
    }

    // ============================================================
    // TC-11: toggle_favorite 来回切换 true <-> false
    // ============================================================

    #[test]
    fn test_toggle_favorite_back_and_forth() {
        let (conn, _db_manager, _temp_dir) = create_test_db_connection();

        let created = SqlSnippetService::create_snippet(
            &conn, "t", "SELECT 1", None, None, None,
        ).expect("创建片段失败");
        assert!(!created.is_favorite);

        // 第一次 toggle: false -> true
        let f1 = SqlSnippetService::toggle_favorite(&conn, &created.id)
            .expect("第一次 toggle 失败");
        assert!(f1, "false -> true 应返回 true");

        // 第二次 toggle: true -> false
        let f2 = SqlSnippetService::toggle_favorite(&conn, &created.id)
            .expect("第二次 toggle 失败");
        assert!(!f2, "true -> false 应返回 false");

        // 从 DB 读取验证最终状态
        let fetched = SqlSnippetService::get_snippet(&conn, &created.id)
            .expect("查询失败")
            .expect("片段应存在");
        assert!(!fetched.is_favorite, "最终 is_favorite 应为 false");
    }

    // ============================================================
    // TC-12: toggle_favorite 不存在的 id 返回错误
    // ============================================================

    #[test]
    fn test_toggle_favorite_not_exists() {
        let (conn, _db_manager, _temp_dir) = create_test_db_connection();

        let result = SqlSnippetService::toggle_favorite(&conn, "nonexistent-id");
        assert!(result.is_err(), "对不存在的片段 toggle 应返回错误");
        assert!(result.as_ref().unwrap_err().contains("不存在"));
    }

    // ============================================================
    // TC-13: 同名片段允许创建（表无 UNIQUE 约束，仅有 idx_snippets_name 索引）
    // 说明：若未来给 __sql_snippets.name 加上 UNIQUE 约束，此测试应改为期望 Err
    // ============================================================

    #[test]
    fn test_create_snippet_duplicate_name_allowed() {
        let (conn, _db_manager, _temp_dir) = create_test_db_connection();

        let s1 = SqlSnippetService::create_snippet(
            &conn, "same-name", "SELECT 1", None, None, None,
        ).expect("第一次创建同名片段应成功");

        let s2 = SqlSnippetService::create_snippet(
            &conn, "same-name", "SELECT 2", None, None, None,
        ).expect("第二次创建同名片段应成功（无 UNIQUE 约束）");

        assert_ne!(s1.id, s2.id, "两个片段应有不同的 ID");

        // 验证两条记录都在
        let all = SqlSnippetService::list_snippets(&conn, None)
            .expect("list 失败");
        assert_eq!(all.len(), 2);
        assert_eq!(all.iter().filter(|s| s.name == "same-name").count(), 2);
    }

    // ============================================================
    // TC-14: SQL 内容含特殊字符（单引号、分号）也能正确存取
    // 验证参数化查询正确处理特殊字符
    // ============================================================

    #[test]
    fn test_create_snippet_with_special_chars_in_sql() {
        let (conn, _db_manager, _temp_dir) = create_test_db_connection();

        // SQL 内含单引号（字符串字面量）和分号（多语句分隔符的常见字符）
        let sql_with_special = "SELECT * FROM users WHERE name = 'O''Neil'; -- comment";
        let created = SqlSnippetService::create_snippet(
            &conn,
            "含特殊字符",
            sql_with_special,
            Some("desc with ' quote"),
            None,
            None,
        ).expect("创建含特殊字符的片段失败");

        let fetched = SqlSnippetService::get_snippet(&conn, &created.id)
            .expect("查询失败")
            .expect("片段应存在");
        assert_eq!(fetched.sql, sql_with_special, "sql 字段应原样往返");
        assert_eq!(fetched.description.as_deref(), Some("desc with ' quote"));
        assert_eq!(fetched.name, "含特殊字符");
    }
}

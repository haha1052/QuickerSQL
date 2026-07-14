//! SQL 片段服务
//! 负责处理 SQL 片段的增删改查等逻辑

use crate::database::traits::MutexGuardConnection;
use crate::models::sql_snippet::SqlSnippet;
use chrono::Utc;

pub struct SqlSnippetService;

impl SqlSnippetService {
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

    pub fn delete_snippet(conn: &MutexGuardConnection<'_>, id: &str) -> Result<(), String> {
        conn.execute(
            "DELETE FROM __sql_snippets WHERE id = ?1",
            &[&id as &dyn crate::database::traits::ToSql],
        ).map_err(|e| format!("删除 SQL 片段失败：{}", e))?;
        Ok(())
    }

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

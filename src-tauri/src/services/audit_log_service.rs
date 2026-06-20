//! 审计日志服务
//! 负责处理审计日志的记录、查询、清理等逻辑

use crate::database::traits::MutexGuardConnection;
use crate::models::audit_log::*;
use chrono::Utc;

/// 审计日志服务
pub struct AuditLogService;

impl AuditLogService {
    /// 确保审计日志表存在
    pub fn ensure_audit_log_table_exists(conn: &MutexGuardConnection<'_>) -> Result<(), String> {
        // rusqlite::execute() 只支持单条语句，DDL 与索引必须拆成独立调用
        conn.execute(
            r#"CREATE TABLE IF NOT EXISTS __audit_logs (
                id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
                timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                module TEXT NOT NULL,
                action TEXT NOT NULL,
                description TEXT,
                status TEXT,
                duration_ms INTEGER,
                details TEXT
            )"#,
            &[],
        ).map_err(|e| format!("创建审计日志表失败：{}", e))?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON __audit_logs(timestamp DESC)",
            &[],
        ).map_err(|e| format!("创建 idx_audit_timestamp 索引失败：{}", e))?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_audit_module ON __audit_logs(module)",
            &[],
        ).map_err(|e| format!("创建 idx_audit_module 索引失败：{}", e))?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_audit_status ON __audit_logs(status)",
            &[],
        ).map_err(|e| format!("创建 idx_audit_status 索引失败：{}", e))?;
        Ok(())
    }

    /// 记录审计日志
    pub fn record_audit_log(
        conn: &MutexGuardConnection<'_>,
        request: RecordAuditLogRequest,
    ) -> Result<AuditLogItem, String> {
        let id = uuid::Uuid::new_v4().to_string();
        let timestamp = Utc::now();

        let insert_sql = format!(
            "INSERT INTO __audit_logs (id, timestamp, module, action, description, status, duration_ms, details) \
             VALUES ('{}', '{}', '{}', '{}', '{}', '{}', {}, {});",
            id.replace("'", "''"),
            timestamp.to_rfc3339(),
            request.module.replace("'", "''"),
            request.action.replace("'", "''"),
            request.description.replace("'", "''"),
            request.status.replace("'", "''"),
            request.duration_ms.map(|v| v.to_string()).unwrap_or_else(|| "NULL".to_string()),
            request.details.as_ref().map(|d| format!("'{}'", d.replace("'", "''"))).unwrap_or_else(|| "NULL".to_string())
        );

        conn.execute(&insert_sql, &[])
            .map_err(|e| format!("记录审计日志失败：{}", e))?;

        Ok(AuditLogItem {
            id,
            timestamp,
            module: request.module,
            action: request.action,
            description: request.description,
            status: request.status,
            duration_ms: request.duration_ms,
            details: request.details,
        })
    }

    /// 查询审计日志列表
    pub fn query_audit_logs(
        conn: &MutexGuardConnection<'_>,
        request: QueryAuditLogsRequest,
    ) -> Result<AuditLogsListResponse, String> {
        let mut where_clauses = Vec::new();

        if let Some(module) = &request.module {
            where_clauses.push(format!("module = '{}'", module.replace("'", "''")));
        }

        if let Some(status) = &request.status {
            where_clauses.push(format!("status = '{}'", status.replace("'", "''")));
        }

        if let Some(start_time) = &request.start_time {
            where_clauses.push(format!("timestamp >= '{}'", start_time.replace("'", "''")));
        }

        if let Some(end_time) = &request.end_time {
            where_clauses.push(format!("timestamp <= '{}'", end_time.replace("'", "''")));
        }

        let where_clause = if where_clauses.is_empty() {
            "".to_string()
        } else {
            format!("WHERE {}", where_clauses.join(" AND "))
        };

        let limit = request.limit.unwrap_or(100);
        let offset = request.offset.unwrap_or(0);

        let select_sql = format!(
            "SELECT id, timestamp, module, action, description, status, duration_ms, details \
             FROM __audit_logs {} ORDER BY timestamp DESC LIMIT {} OFFSET {};",
            where_clause, limit, offset
        );

        let result = conn.query(&select_sql, &[])
            .map_err(|e| format!("查询审计日志失败：{}", e))?;

        let mut items = Vec::new();
        for row in result.rows {
            items.push(Self::row_to_audit_log_item(&row)?);
        }

        let count_sql = format!(
            "SELECT COUNT(*) as total FROM __audit_logs {};",
            where_clause
        );

        let count_result = conn.query(&count_sql, &[])
            .map_err(|e| format!("查询审计日志总数失败：{}", e))?;

        let total = if !count_result.rows.is_empty() {
            count_result.rows[0][0].clone().parse::<i64>().unwrap_or(0)
        } else {
            0
        };

        Ok(AuditLogsListResponse { items, total })
    }

    /// 清理过期的审计日志
    pub fn cleanup_expired_logs(
        conn: &MutexGuardConnection<'_>,
        retention_days: i64,
    ) -> Result<i64, String> {
        let delete_sql = format!(
            "DELETE FROM __audit_logs WHERE timestamp < datetime('now', '-{} days');",
            retention_days
        );

        let result = conn.execute(&delete_sql, &[])
            .map_err(|e| format!("清理过期审计日志失败：{}", e))?;

        Ok(result as i64)
    }

    /// 获取审计日志总数
    pub fn count_audit_logs(
        conn: &MutexGuardConnection<'_>,
    ) -> Result<i64, String> {
        let count_sql = "SELECT COUNT(*) as total FROM __audit_logs;";

        let count_result = conn.query(count_sql, &[])
            .map_err(|e| format!("查询审计日志总数失败：{}", e))?;

        let total = if !count_result.rows.is_empty() {
            count_result.rows[0][0].clone().parse::<i64>().unwrap_or(0)
        } else {
            0
        };

        Ok(total)
    }

    /// 清空所有审计日志
    pub fn clear_all_audit_logs(
        conn: &MutexGuardConnection<'_>,
    ) -> Result<(), String> {
        let delete_sql = "DELETE FROM __audit_logs;";

        conn.execute(delete_sql, &[])
            .map_err(|e| format!("清空审计日志失败：{}", e))?;

        Ok(())
    }

    /// 从查询结果行解析审计日志项
    fn row_to_audit_log_item(row: &[String]) -> Result<AuditLogItem, String> {
        if row.len() < 8 {
            return Err("查询结果列数不足".to_string());
        }

        Ok(AuditLogItem {
            id: row[0].clone(),
            timestamp: {
                let s = &row[1];
                chrono::DateTime::parse_from_rfc3339(s)
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or_else(|_| Utc::now())
            },
            module: row[2].clone(),
            action: row[3].clone(),
            description: row[4].clone(),
            status: row[5].clone(),
            duration_ms: if row[6].is_empty() || row[6].eq_ignore_ascii_case("null") { None } else { row[6].parse::<i64>().ok() },
            details: if row[7].is_empty() || row[7].eq_ignore_ascii_case("null") { None } else { Some(row[7].clone()) },
        })
    }
}

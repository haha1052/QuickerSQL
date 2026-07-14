//! 自动化任务服务
//! 负责任务的 CRUD、运行、调度
//! 系统表: __automation_tasks, __automation_runs
//!
//! 关键改进：长 SQL 任务执行时通过独立临时连接运行用户 SQL，
//! 避免长期持有主连接锁阻塞前端短命令。

use crate::database::traits::{MutexGuardConnection, ToSql};
use crate::database::SharedDatabaseManager;
use crate::models::automation::*;
use crate::utils::schedule::compute_next_run;
use serde_json::Value as JsonValue;
use std::sync::{Arc, atomic::{AtomicBool, Ordering}};

/// 自动化任务服务
pub struct TaskService;

impl TaskService {
    // ============================================================
    // 初始化：确保系统表存在
    // ============================================================

    pub fn ensure_tables_exists(conn: &MutexGuardConnection<'_>) -> Result<(), String> {
        let statements: &[&str] = &[
            // ============================================================
            // 1) __automation_tasks（任务定义表）
            // ============================================================
            r#"CREATE TABLE IF NOT EXISTS __automation_tasks (
                id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
                name TEXT NOT NULL,
                description TEXT DEFAULT '',
                task_type TEXT NOT NULL DEFAULT 'sql',
                payload TEXT NOT NULL DEFAULT '{}',
                schedule_mode TEXT NOT NULL DEFAULT 'interval',
                schedule_value TEXT NOT NULL DEFAULT '3600',
                timezone TEXT NOT NULL DEFAULT 'local',
                state TEXT NOT NULL DEFAULT 'enabled',
                project_id TEXT DEFAULT '',
                next_run_at INTEGER,
                last_run_at INTEGER,
                last_run_status TEXT,
                last_run_duration_ms INTEGER,
                total_runs INTEGER NOT NULL DEFAULT 0,
                success_runs INTEGER NOT NULL DEFAULT 0,
                failed_runs INTEGER NOT NULL DEFAULT 0,
                retry_on_fail INTEGER NOT NULL DEFAULT 0,
                retry_interval_secs INTEGER NOT NULL DEFAULT 60,
                timeout_secs INTEGER NOT NULL DEFAULT 300,
                notify_on_success INTEGER NOT NULL DEFAULT 0,
                notify_on_failure INTEGER NOT NULL DEFAULT 1,
                tags TEXT NOT NULL DEFAULT '[]',
                created_by TEXT NOT NULL DEFAULT '',
                created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
                updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
            )"#,
            "CREATE INDEX IF NOT EXISTS idx_automation_tasks_next_state ON __automation_tasks(next_run_at, state)",
            "CREATE INDEX IF NOT EXISTS idx_automation_tasks_type ON __automation_tasks(task_type)",
            "CREATE INDEX IF NOT EXISTS idx_automation_tasks_project ON __automation_tasks(project_id)",
            // ============================================================
            // 2) __automation_runs（运行记录表）
            // ============================================================
            r#"CREATE TABLE IF NOT EXISTS __automation_runs (
                id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
                task_id TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'running',
                started_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
                finished_at INTEGER,
                duration_ms INTEGER,
                affected_rows INTEGER,
                output TEXT,
                retry_count INTEGER NOT NULL DEFAULT 0,
                trigger_type TEXT NOT NULL DEFAULT 'schedule',
                created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
            )"#,
            "CREATE INDEX IF NOT EXISTS idx_automation_runs_task_created ON __automation_runs(task_id, created_at DESC)",
            "CREATE INDEX IF NOT EXISTS idx_automation_runs_status ON __automation_runs(status)",
            // ============================================================
            // 3) __task_dependencies（任务依赖表）
            // ============================================================
            r#"CREATE TABLE IF NOT EXISTS __task_dependencies (
                id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
                task_id TEXT NOT NULL,
                dependency_type TEXT NOT NULL DEFAULT 'time_interval',
                dependency_config TEXT NOT NULL DEFAULT '{}',
                created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
                updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
            )"#,
            "CREATE INDEX IF NOT EXISTS idx_task_deps_task_id ON __task_dependencies(task_id)",
            "CREATE INDEX IF NOT EXISTS idx_task_deps_upstream ON __task_dependencies(dependency_type, dependency_config)",
        ];

        // ⚠️ rusqlite::execute() 只支持单条语句，因此必须把每条 DDL 拆成独立调用
        for (i, stmt) in statements.iter().enumerate() {
            if let Err(e) = conn.execute(stmt, &[]) {
                return Err(format!("创建自动化任务系统表失败（第{}条）：{}", i + 1, e));
            }
        }

        // ============================================================
        // 旧数据自动迁移：将 schedule_mode 为 interval/cron 的任务迁移为依赖记录
        // ============================================================
        if let Err(e) = Self::migrate_schedule_to_dependencies(conn) {
            log::warn!("迁移任务调度数据到依赖表失败: {}", e);
        }

        Ok(())
    }

    /// 旧数据迁移：将 schedule_mode 为 interval/cron 的任务迁移为依赖记录
    /// 迁移幂等：通过检查该任务是否已有依赖来判断是否已迁移
    fn migrate_schedule_to_dependencies(conn: &MutexGuardConnection<'_>) -> Result<(), String> {
        // 查询所有 schedule_mode IN ('interval', 'cron') 且该任务没有任何依赖记录的任务
        let sql = "SELECT t.id, t.schedule_mode, t.schedule_value \
             FROM __automation_tasks t \
             WHERE t.schedule_mode IN ('interval', 'cron') \
             AND NOT EXISTS (SELECT 1 FROM __task_dependencies d WHERE d.task_id = t.id);";
        
        let result = conn.query(sql, &[]).map_err(|e| format!("查询待迁移任务失败: {}", e))?;

        for row in &result.rows {
            if row.len() < 3 { continue; }
            let task_id = &row[0];
            let schedule_mode = &row[1];
            let schedule_value = &row[2];

            let (dep_type, dep_config) = match schedule_mode.as_str() {
                "interval" => {
                    let config = serde_json::json!({
                        "intervalSeconds": schedule_value
                    });
                    ("time_interval", config.to_string())
                }
                "cron" => {
                    let config = serde_json::json!({
                        "expression": schedule_value,
                        "timezone": "local"
                    });
                    ("cron", config.to_string())
                }
                _ => continue,
            };

            let insert_sql = "INSERT INTO __task_dependencies (task_id, dependency_type, dependency_config) \
                 VALUES (?, ?, ?);";
            let params: [&dyn ToSql; 3] = [&task_id, &dep_type, &dep_config];
            if let Err(e) = conn.execute(insert_sql, &params) {
                log::warn!("为任务 {} 创建依赖记录失败: {}", task_id, e);
            }
        }

        Ok(())
    }

    // ============================================================
    // CRUD
    // ============================================================

    pub fn create_task(
        conn: &MutexGuardConnection<'_>,
        req: CreateTaskRequest,
    ) -> Result<Task, String> {
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().timestamp();

        let state = req.state.unwrap_or_else(|| "enabled".to_string());
        let description = req.description.unwrap_or_default();

        // 从设置读取默认值（用户未指定时使用）
        let default_retry_on_fail: i64 = crate::services::SettingsService::get_setting(conn, "automation", "defaultRetryOnFail")
            .ok()
            .flatten()
            .and_then(|s| s.value.parse::<i64>().ok())
            .filter(|&v| v >= 0 && v <= 10)
            .unwrap_or(0);
        let default_timeout_secs: i64 = crate::services::SettingsService::get_setting(conn, "automation", "defaultTimeoutSecs")
            .ok()
            .flatten()
            .and_then(|s| s.value.parse::<i64>().ok())
            .filter(|&v| v >= 1 && v <= 86400)
            .unwrap_or(300);

        let retry_on_fail = req.retry_on_fail.unwrap_or(default_retry_on_fail);
        let timeout_secs = req.timeout_secs.unwrap_or(default_timeout_secs);

        // 计算 next_run_at
        let next_run_at = if state == "enabled" {
            compute_next_run(now, &req.schedule_mode, &req.schedule_value)
        } else {
            None
        };

        // next_run_at 是唯一的可选整数列；NULL 通过在 SQL 文本中写 NULL 处理
        let next_run_at_sql = match next_run_at {
            Some(_) => "?",
            None => "NULL",
        };

        let insert_sql = format!(
            "INSERT INTO __automation_tasks \
             (id, name, description, task_type, payload, schedule_mode, schedule_value, timezone, state, project_id, next_run_at, retry_on_fail, retry_interval_secs, timeout_secs, notify_on_success, notify_on_failure, tags, created_by, created_at, updated_at) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, {}, ?, ?, ?, ?, ?, ?, ?, ?, ?);",
            next_run_at_sql
        );

        let mut params: Vec<String> = Vec::new();
        params.push(id.clone());
        params.push(req.name.clone());
        params.push(description.clone());
        params.push(req.task_type.clone());
        params.push(req.payload.clone());
        params.push(req.schedule_mode.clone());
        params.push(req.schedule_value.clone());
        params.push("local".to_string());
        params.push(state.clone());
        params.push(String::new());
        if let Some(v) = next_run_at {
            params.push(v.to_string());
        }
        params.push(retry_on_fail.to_string());
        params.push(60i64.to_string());
        params.push(timeout_secs.to_string());
        params.push(0i64.to_string());
        params.push(1i64.to_string());
        params.push("[]".to_string());
        params.push(String::new());
        params.push(now.to_string());
        params.push(now.to_string());

        let param_refs: Vec<&dyn ToSql> = params.iter().map(|p| p as &dyn ToSql).collect();
        conn.execute(&insert_sql, &param_refs)
            .map_err(|e| format!("创建任务失败：{}", e))?;

        Self::get_task(conn, &id)
    }

    pub fn get_task(conn: &MutexGuardConnection<'_>, id: &str) -> Result<Task, String> {
        let sql = "SELECT id, name, description, task_type, payload, schedule_mode, schedule_value, timezone, state, project_id, next_run_at, last_run_at, last_run_status, last_run_duration_ms, total_runs, success_runs, failed_runs, retry_on_fail, retry_interval_secs, timeout_secs, notify_on_success, notify_on_failure, tags, created_by, created_at, updated_at \
             FROM __automation_tasks WHERE id = ?;";
        let params: [&dyn ToSql; 1] = [&id];
        let result = conn.query(sql, &params).map_err(|e| format!("查询任务失败：{}", e))?;
        if result.rows.is_empty() {
            return Err("任务不存在".to_string());
        }
        Self::row_to_task(&result.rows[0])
    }

    pub fn list_tasks(
        conn: &MutexGuardConnection<'_>,
        filter_state: Option<String>,
        filter_type: Option<String>,
        keyword: Option<String>,
    ) -> Result<TaskListResponse, String> {
        let mut wheres: Vec<String> = Vec::new();
        let mut params: Vec<String> = Vec::new();
        if let Some(s) = &filter_state {
            if !s.is_empty() {
                wheres.push("state = ?".to_string());
                params.push(s.clone());
            }
        }
        if let Some(t) = &filter_type {
            if !t.is_empty() {
                wheres.push("task_type = ?".to_string());
                params.push(t.clone());
            }
        }
        if let Some(kw) = &keyword {
            if !kw.is_empty() {
                wheres.push("(name LIKE ? OR description LIKE ?)".to_string());
                params.push(format!("%{}%", kw));
                params.push(format!("%{}%", kw));
            }
        }

        let where_sql = if wheres.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", wheres.join(" AND "))
        };

        let sql = format!(
            "SELECT id, name, description, task_type, payload, schedule_mode, schedule_value, timezone, state, project_id, next_run_at, last_run_at, last_run_status, last_run_duration_ms, total_runs, success_runs, failed_runs, retry_on_fail, retry_interval_secs, timeout_secs, notify_on_success, notify_on_failure, tags, created_by, created_at, updated_at \
             FROM __automation_tasks {} ORDER BY updated_at DESC LIMIT 500;",
            where_sql
        );

        let param_refs: Vec<&dyn ToSql> = params.iter().map(|p| p as &dyn ToSql).collect();
        let result = conn.query(&sql, &param_refs).map_err(|e| format!("查询任务列表失败：{}", e))?;

        let mut tasks: Vec<Task> = Vec::new();
        let mut enabled_count: i64 = 0;
        let mut failed_count: i64 = 0;
        for row in &result.rows {
            let task = Self::row_to_task(row)?;
            if task.state == "enabled" {
                enabled_count += 1;
            }
            if let Some(ref s) = task.last_run_status {
                if s == "failed" { failed_count += 1; }
            }
            tasks.push(task);
        }

        Ok(TaskListResponse {
            total: tasks.len() as i64,
            enabled_count,
            failed_tasks_count: failed_count,
            tasks,
        })
    }

    pub fn update_task(
        conn: &MutexGuardConnection<'_>,
        id: &str,
        patch: UpdateTaskRequest,
    ) -> Result<Task, String> {
        let now = chrono::Utc::now().timestamp();
        let mut sets: Vec<String> = Vec::new();
        let mut params: Vec<String> = Vec::new();
        if let Some(n) = patch.name {
            sets.push("name = ?".to_string());
            params.push(n);
        }
        if let Some(d) = patch.description {
            sets.push("description = ?".to_string());
            params.push(d);
        }
        if let Some(p) = patch.payload {
            sets.push("payload = ?".to_string());
            params.push(p);
        }
        let mut recompute_next = false;
        if let Some(m) = patch.schedule_mode {
            sets.push("schedule_mode = ?".to_string());
            params.push(m);
            recompute_next = true;
        }
        if let Some(v) = patch.schedule_value {
            sets.push("schedule_value = ?".to_string());
            params.push(v);
            recompute_next = true;
        }
        let mut new_state: Option<String> = None;
        if let Some(s) = patch.state {
            sets.push("state = ?".to_string());
            params.push(s.clone());
            new_state = Some(s);
            recompute_next = true;
        }
        if let Some(r) = patch.retry_on_fail {
            sets.push("retry_on_fail = ?".to_string());
            params.push(r.to_string());
        }
        if let Some(t) = patch.timeout_secs {
            sets.push("timeout_secs = ?".to_string());
            params.push(t.to_string());
        }
        sets.push("updated_at = ?".to_string());
        params.push(now.to_string());

        let update_sql = format!(
            "UPDATE __automation_tasks SET {} WHERE id = ?;",
            sets.join(", ")
        );
        params.push(id.to_string());

        let param_refs: Vec<&dyn ToSql> = params.iter().map(|p| p as &dyn ToSql).collect();
        conn.execute(&update_sql, &param_refs).map_err(|e| format!("更新任务失败：{}", e))?;

        // 重新计算 next_run_at
        if recompute_next {
            let task = Self::get_task(conn, id)?;
            let state_val = new_state.as_deref().unwrap_or(&task.state);
            let next_at = match state_val.as_ref() as &str {
                "enabled" => compute_next_run(now, &task.schedule_mode, &task.schedule_value),
                _ => None,
            };
            let next_at_sql = match next_at {
                Some(_) => "?",
                None => "NULL",
            };
            let sql2 = format!(
                "UPDATE __automation_tasks SET next_run_at = {} WHERE id = ?;",
                next_at_sql
            );
            let mut params2: Vec<String> = Vec::new();
            if let Some(v) = next_at {
                params2.push(v.to_string());
            }
            params2.push(id.to_string());
            let param_refs2: Vec<&dyn ToSql> = params2.iter().map(|p| p as &dyn ToSql).collect();
            if let Err(e) = conn.execute(&sql2, &param_refs2) {
                log::warn!("更新任务 next_run_at 失败，调度时间可能不准确: {}", e);
            }
        }

        Self::get_task(conn, id)
    }

    pub fn delete_task(conn: &MutexGuardConnection<'_>, id: &str) -> Result<(), String> {
        let sql1 = "DELETE FROM __automation_runs WHERE task_id = ?;";
        let sql2 = "DELETE FROM __automation_tasks WHERE id = ?;";

        // 用事务确保 runs 和 tasks 的删除要么同时成功，要么同时回滚
        conn.begin_transaction().map_err(|e| format!("开启事务失败: {}", e))?;

        let params1: [&dyn ToSql; 1] = [&id];
        if let Err(e) = conn.execute(sql1, &params1) {
            log::warn!("删除 task 关联的 runs 失败: {}", e);
            let _ = conn.rollback_transaction();
            return Err(format!("删除任务运行记录失败: {}", e));
        }

        let params2: [&dyn ToSql; 1] = [&id];
        match conn.execute(sql2, &params2) {
            Ok(_) => {
                // 事务提交失败必须返回错误：否则调用方会认为删除成功，
                // 但实际上事务被回滚或仍挂起，这是数据一致性风险。
                if let Err(e) = conn.commit_transaction() {
                    log::warn!("提交事务失败: {}", e);
                    let _ = conn.rollback_transaction();
                    return Err(format!("提交事务失败: {}", e));
                }
                Ok(())
            }
            Err(e) => {
                let _ = conn.rollback_transaction();
                Err(format!("删除任务失败：{}", e))
            }
        }
    }

    pub fn enable_task(conn: &MutexGuardConnection<'_>, id: &str) -> Result<Task, String> {
        Self::update_task(conn, id, UpdateTaskRequest {
            name: None,
            description: None,
            payload: None,
            schedule_mode: None,
            schedule_value: None,
            state: Some("enabled".to_string()),
            retry_on_fail: None,
            timeout_secs: None,
        })
    }

    pub fn disable_task(conn: &MutexGuardConnection<'_>, id: &str) -> Result<Task, String> {
        Self::update_task(conn, id, UpdateTaskRequest {
            name: None,
            description: None,
            payload: None,
            schedule_mode: None,
            schedule_value: None,
            state: Some("disabled".to_string()),
            retry_on_fail: None,
            timeout_secs: None,
        })
    }

    // ============================================================
    // 执行任务
    // ============================================================

    pub fn run_task_now(
        db_manager: &SharedDatabaseManager,
        id: &str,
    ) -> Result<TaskRun, String> {
        let conn = db_manager
            .get_connection()
            .map_err(|e| format!("获取数据库连接失败: {}", e))?;
        // 手动触发：直接用主连接执行，不启用临时连接避免阻塞前端
        Self::execute_inner(db_manager, &conn, id, "manual", false)
    }

    /// 主入口：支持临时连接。
    /// 当 `use_temp_conn=true` 且 `task_type="sql"` 时，用户 SQL 会通过独立的临时连接执行，
    /// 避免长期持有主连接锁。系统表（run/tasks）读写仍使用主连接以保证一致性。
    pub fn execute(
        db_manager: &SharedDatabaseManager,
        id: &str,
        trigger_type: &str,
        use_temp_conn: bool,
    ) -> Result<TaskRun, String> {
        let conn = db_manager
            .get_connection()
            .map_err(|e| format!("获取数据库连接失败: {}", e))?;
        Self::execute_inner(db_manager, &conn, id, trigger_type, use_temp_conn)
    }

    /// 真正的业务逻辑：持有主连接 `primary_conn` 读写系统表；
    /// 当 `use_temp_conn=true` 时，用户 SQL 通过临时连接执行。
    fn execute_inner(
        db_manager: &SharedDatabaseManager,
        primary_conn: &MutexGuardConnection<'_>,
        id: &str,
        trigger_type: &str,
        use_temp_conn: bool,
    ) -> Result<TaskRun, String> {
        // ============================================================
        // 非事务化执行：INSERT run（立即可见）→ dispatch → UPDATE run+tasks
        //
        // 为什么不用事务：
        //   之前对 execute_core 的结果做 Err → rollback 会导致：
        //   - run 记录被撤销 → 用户看不到失败记录
        //   - tasks 状态/next_run_at 未更新 → 调度器永不触发
        //   现在改为"无论成功失败，都把 run 记录 + 任务状态/调度时间写回"。
        // ============================================================

        let start_unix = chrono::Utc::now().timestamp();
        let run_id = uuid::Uuid::new_v4().to_string();

        // 1. 读取任务
        let task = Self::get_task(primary_conn, id)?;

        // 2. 写入一条 status='running' 的 run 记录（始终用主连接写系统表）
        let insert_run_sql = "INSERT INTO __automation_runs (id, task_id, status, started_at, trigger_type) \
             VALUES (?, ?, 'running', ?, ?);";
        let params_run: [&dyn ToSql; 4] = [&run_id, &id, &start_unix.to_string(), &trigger_type];
        if let Err(e) = primary_conn.execute(insert_run_sql, &params_run) {
            log::warn!("写入 run 记录失败: {}", e);
            return Err(format!("写入 run 记录失败: {}", e));
        }

        // 3. 根据 task_type 分派执行
        //    - sql 任务：如果 use_temp_conn=true，则用独立临时连接，避免长查询占主锁
        //    - 其他任务：始终用主连接（都是短操作）
        let exec_result = Self::dispatch(db_manager, primary_conn, &task, use_temp_conn);

        let now = chrono::Utc::now().timestamp();
        let duration_ms = (now - start_unix).max(0) * 1000;

        // 4. 无论成功失败：都把 run 记录 + 任务状态 + next_run_at 写回
        let final_run = match &exec_result {
            Ok((affected_rows, output_opt)) => {
                // 成功：更新 runs + tasks
                let output_str = output_opt.clone().unwrap_or_default();
                // affected_rows 可能为 None（NULL）或 Some(i64)
                let affected_sql = match affected_rows {
                    Some(_) => "?",
                    None => "NULL",
                };
                let update_run_sql = format!(
                    "UPDATE __automation_runs SET status='success', finished_at=?, duration_ms=?, affected_rows={}, output=? WHERE id=?;",
                    affected_sql
                );
                let mut params: Vec<String> = Vec::new();
                params.push(now.to_string());
                params.push(duration_ms.to_string());
                if let Some(v) = affected_rows {
                    params.push(v.to_string());
                }
                params.push(output_str.clone());
                params.push(run_id.clone());
                let param_refs: Vec<&dyn ToSql> = params.iter().map(|p| p as &dyn ToSql).collect();
                if let Err(e) = primary_conn.execute(&update_run_sql, &param_refs) {
                    log::warn!("更新 run success 失败: {}", e);
                }

                let next_at = if task.state == "enabled" {
                    let deps = Self::list_dependencies(primary_conn, &task.id).unwrap_or_default();
                    if !deps.is_empty() {
                        Self::compute_next_run_from_deps(now, &deps)
                    } else {
                        compute_next_run(now, &task.schedule_mode, &task.schedule_value)
                    }
                } else {
                    None
                };

                // next_run_at 可能为 None（NULL）或 Some(i64)
                let next_at_sql = match next_at {
                    Some(_) => "?",
                    None => "NULL",
                };
                let update_task_sql = format!(
                    "UPDATE __automation_tasks SET last_run_at=?, last_run_status='success', last_run_duration_ms=?, total_runs=total_runs+1, success_runs=success_runs+1, next_run_at={}, updated_at=? WHERE id=?;",
                    next_at_sql
                );
                let mut params2: Vec<String> = Vec::new();
                params2.push(now.to_string());
                params2.push(duration_ms.to_string());
                if let Some(v) = next_at {
                    params2.push(v.to_string());
                }
                params2.push(now.to_string());
                params2.push(id.to_string());
                let param_refs2: Vec<&dyn ToSql> = params2.iter().map(|p| p as &dyn ToSql).collect();
                if let Err(e) = primary_conn.execute(&update_task_sql, &param_refs2) {
                    log::warn!("更新 task 成功状态失败: {}", e);
                }

                TaskRun {
                    id: run_id.clone(),
                    task_id: id.to_string(),
                    status: "success".to_string(),
                    started_at: start_unix,
                    finished_at: Some(now),
                    duration_ms: Some(duration_ms),
                    affected_rows: *affected_rows,
                    output: if output_opt.as_ref().map(|s| s.is_empty()).unwrap_or(true) { None } else { output_opt.clone() },
                    retry_count: 0,
                    trigger_type: trigger_type.to_string(),
                    created_at: start_unix,
                }
            }
            Err(user_msg) => {
                // 失败：更新 run 为 failed + output=用户消息；同时更新 tasks 的 next_run_at
                let update_run_sql = "UPDATE __automation_runs SET status='failed', finished_at=?, duration_ms=?, output=? WHERE id=?;";
                let params: [&dyn ToSql; 4] = [
                    &now.to_string(),
                    &duration_ms.to_string(),
                    &user_msg.as_str(),
                    &run_id.as_str(),
                ];
                if let Err(e) = primary_conn.execute(update_run_sql, &params) {
                    log::warn!("更新 run failed 失败: {}", e);
                }

                // 失败策略：若还有重试额度，则 next_run_at = now + retry_interval_secs
                let exceeded_retry_limit = task.failed_runs >= task.retry_on_fail.max(0);

                if exceeded_retry_limit && task.retry_on_fail > 0 {
                    let update_task_sql = "UPDATE __automation_tasks SET state='disabled', last_run_at=?, last_run_status='failed', last_run_duration_ms=?, total_runs=total_runs+1, failed_runs=failed_runs+1, updated_at=? WHERE id=?;";
                    let params: [&dyn ToSql; 4] = [
                        &now.to_string(),
                        &duration_ms.to_string(),
                        &now.to_string(),
                        &id,
                    ];
                    if let Err(e) = primary_conn.execute(update_task_sql, &params) {
                        log::warn!("更新 task disabled 失败: {}", e);
                    }
                } else {
                    let next_at = if task.state == "enabled" && task.retry_on_fail > 0 {
                        // 允许重试
                        Some(now + task.retry_interval_secs.max(10))
                    } else if task.state == "enabled" {
                        // 不重试，按依赖或原调度继续
                        let deps = Self::list_dependencies(primary_conn, &task.id).unwrap_or_default();
                        if !deps.is_empty() {
                            Self::compute_next_run_from_deps(now, &deps)
                        } else {
                            compute_next_run(now, &task.schedule_mode, &task.schedule_value)
                        }
                    } else {
                        None
                    };
                    let next_at_sql = match next_at {
                        Some(_) => "?",
                        None => "NULL",
                    };
                    let update_task_sql = format!(
                        "UPDATE __automation_tasks SET last_run_at=?, last_run_status='failed', last_run_duration_ms=?, total_runs=total_runs+1, failed_runs=failed_runs+1, next_run_at={}, updated_at=? WHERE id=?;",
                        next_at_sql
                    );
                    let mut params: Vec<String> = Vec::new();
                    params.push(now.to_string());
                    params.push(duration_ms.to_string());
                    if let Some(v) = next_at {
                        params.push(v.to_string());
                    }
                    params.push(now.to_string());
                    params.push(id.to_string());
                    let param_refs: Vec<&dyn ToSql> = params.iter().map(|p| p as &dyn ToSql).collect();
                    if let Err(e) = primary_conn.execute(&update_task_sql, &param_refs) {
                        log::warn!("更新 task failed 失败: {}", e);
                    }
                }

                TaskRun {
                    id: run_id.clone(),
                    task_id: id.to_string(),
                    status: "failed".to_string(),
                    started_at: start_unix,
                    finished_at: Some(now),
                    duration_ms: Some(duration_ms),
                    affected_rows: None,
                    output: Some(user_msg.clone()),
                    retry_count: 0,
                    trigger_type: trigger_type.to_string(),
                    created_at: start_unix,
                }
            }
        };

        // 5. 任务完成后触发下游任务（仅触发一层，后续由调度器自然处理）
        let is_success = exec_result.is_ok();
        if let Err(e) = Self::trigger_downstream_tasks(primary_conn, id, is_success, now) {
            log::warn!("触发下游任务失败: {}", e);
        }

        // 对前端返回：任务已执行（不论成功/失败），都返回 TaskRun 让 UI 正确渲染
        // 仅在"读任务 / 写 run 记录"阶段失败时才返回 Err（这些是真正的系统级失败）
        match exec_result {
            Ok(_) => Ok(final_run),
            Err(user_msg) => Err(user_msg),  // dispatch 失败的用户友好消息
        }
    }

    /// 根据 task_type 分派执行，返回 (affected_rows, output_msg)
    fn dispatch(
        db_manager: &SharedDatabaseManager,
        primary_conn: &MutexGuardConnection<'_>,
        task: &Task,
        use_temp_conn: bool,
    ) -> Result<(Option<i64>, Option<String>), String> {
        // 解析 payload JSON
        let payload_json: JsonValue = serde_json::from_str(&task.payload).unwrap_or(JsonValue::Object(serde_json::Map::new()));

        match task.task_type.as_str() {
            "sql" => {
                let sql = payload_json
                    .get("sql")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| "payload.sql 为空".to_string())?;
                let statements = split_sql_statements(sql);
                let mut last_affected: Option<i64> = None;
                let mut out_lines: Vec<String> = Vec::new();

                // 🔑 长 SQL 任务：如果配置了 use_temp_conn，则通过独立的临时连接
                // 执行用户 SQL，避免长期持有主连接锁。系统表读写始终走 primary_conn。
                let temp_conn_result = if use_temp_conn {
                    match db_manager.open_temporary_connection() {
                        Ok(c) => Some(c),
                        Err(e) => {
                            log::warn!("打开临时连接失败（退回主连接）: {}", e);
                            None
                        }
                    }
                } else {
                    None
                };

                for (idx, stmt) in statements.iter().enumerate() {
                    let trimmed = stmt.trim();
                    if trimmed.is_empty() { continue; }

                    let upper = trimmed.to_uppercase();
                    let is_query_like = upper.starts_with("SELECT")
                        || upper.starts_with("SHOW")
                        || upper.starts_with("EXPLAIN")
                        || upper.starts_with("PRAGMA")
                        || upper.starts_with("WITH");

                    let exec_result: Result<i64, String> = if let Some(temp_conn) = &temp_conn_result {
                        if is_query_like {
                            match temp_conn.query(trimmed, &[]) {
                                Ok(result) => {
                                    let rows = result.rows.len() as i64;
                                    out_lines.push(format!("语句 #{} 查询成功（返回{}行）", idx + 1, rows));
                                    Ok(rows)
                                }
                                Err(e) => {
                                    let raw = e.to_string();
                                    log::warn!("SQL 查询失败 [task={}, stmt={:?}, raw={}", task.id, trimmed, raw);
                                    Err(format!("第{}条 SQL 执行失败：{}", idx + 1, simplify_sql_error(&raw)))
                                }
                            }
                        } else {
                            match temp_conn.execute(trimmed, &[]) {
                                Ok(n) => {
                                    out_lines.push(format!("语句 #{} 成功（影响{}行）", idx + 1, n));
                                    Ok(n as i64)
                                }
                                Err(e) => {
                                    let raw = e.to_string();
                                    log::warn!("SQL 执行失败 [task={}, stmt={:?}, raw={}]", task.id, trimmed, raw);
                                    Err(format!("第{}条 SQL 执行失败：{}", idx + 1, simplify_sql_error(&raw)))
                                }
                            }
                        }
                    } else {
                        if is_query_like {
                            match primary_conn.query(trimmed, &[]) {
                                Ok(result) => {
                                    let rows = result.rows.len() as i64;
                                    out_lines.push(format!("语句 #{} 查询成功（返回{}行）", idx + 1, rows));
                                    Ok(rows)
                                }
                                Err(e) => {
                                    let raw = e.to_string();
                                    log::warn!("SQL 查询失败 [task={}, stmt={:?}, raw={}", task.id, trimmed, raw);
                                    Err(format!("第{}条 SQL 执行失败：{}", idx + 1, simplify_sql_error(&raw)))
                                }
                            }
                        } else {
                            match primary_conn.execute(trimmed, &[]) {
                                Ok(n) => {
                                    out_lines.push(format!("语句 #{} 成功（影响{}行）", idx + 1, n));
                                    Ok(n as i64)
                                }
                                Err(e) => {
                                    let raw = e.to_string();
                                    log::warn!("SQL 执行失败 [task={}, stmt={:?}, raw={}]", task.id, trimmed, raw);
                                    Err(format!("第{}条 SQL 执行失败：{}", idx + 1, simplify_sql_error(&raw)))
                                }
                            }
                        }
                    };

                    match exec_result {
                        Ok(n) => { last_affected = Some(n); }
                        Err(user_msg) => return Err(user_msg),
                    }
                }
                Ok((last_affected, Some(out_lines.join("\n"))))
            }
            "refresh_chart" => {
                let chart_id = payload_json
                    .get("chartId")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| "payload.chartId 为空".to_string())?;
                let rows = crate::services::DashboardService::refresh_saved_chart(primary_conn, chart_id)
                    .map_err(|e| format!("刷新图表 {} 失败：{}", chart_id, e))?;
                Ok((Some(rows), Some(format!("图表 {} 已刷新（{} 行）", chart_id, rows))))
            }
            "refresh_dashboard" => {
                let dashboard_id = payload_json
                    .get("dashboardId")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| "payload.dashboardId 为空".to_string())?;
                let chart_sql = "SELECT DISTINCT chart_id FROM __dashboard_items WHERE dashboard_id=?;";
                let params: [&dyn ToSql; 1] = [&dashboard_id];
                let chart_result = primary_conn.query(chart_sql, &params)
                    .map_err(|e| format!("读取仪表盘图表失败：{}", e))?;
                let mut refreshed: i64 = 0;
                let mut total_rows: i64 = 0;
                for row in &chart_result.rows {
                    if row.is_empty() { continue; }
                    let cid = &row[0];
                    if cid.is_empty() { continue; }
                    match crate::services::DashboardService::refresh_saved_chart(primary_conn, cid) {
                        Ok(r) => {
                            refreshed += 1;
                            total_rows += r;
                        }
                        Err(_) => continue,
                    }
                }
                Ok((Some(refreshed), Some(format!("仪表盘 {} 已刷新{}张图表（合计{}行）", dashboard_id, refreshed, total_rows))))
            }
            "export_csv" => {
                let sql = payload_json.get("sql").and_then(|v| v.as_str()).unwrap_or("");
                let output_path = payload_json.get("outputPath").and_then(|v| v.as_str()).unwrap_or("");
                if sql.is_empty() { return Err("payload.sql 为空".to_string()); }
                let result = primary_conn.query(sql, &[])
                    .map_err(|e| format!("导出CSV查询失败：{}", e))?;
                if output_path.is_empty() {
                    return Ok((Some(result.rows.len() as i64), Some(format!("查询成功：{} 行 × {} 列（未指定输出路径）", result.rows.len(), result.columns.len()))));
                }
                let mut csv = String::new();
                csv.push_str(&result.columns.join(","));
                csv.push('\n');
                for row in &result.rows {
                    let parts: Vec<String> = row.iter().map(|cell| {
                        let needs_quote = cell.contains(',') || cell.contains('"') || cell.contains('\n');
                        if needs_quote {
                            format!("\"{}\"", cell.replace('"', "\"\""))
                        } else {
                            cell.clone()
                        }
                    }).collect();
                    csv.push_str(&parts.join(","));
                    csv.push('\n');
                }
                std::fs::write(output_path, &csv)
                    .map_err(|e| format!("写入 CSV 失败：{}", e))?;
                Ok((Some(result.rows.len() as i64), Some(format!("已导出 {} 行 × {} 列 → {}", result.rows.len(), result.columns.len(), output_path))))
            }
            other => Err(format!("未知的任务类型：{}", other)),
        }
    }

    // ============================================================
    // 运行日志
    // ============================================================

    pub fn get_task_runs(
        conn: &MutexGuardConnection<'_>,
        task_id: &str,
        limit: Option<i64>,
    ) -> Result<Vec<TaskRun>, String> {
        let limit_val = limit.unwrap_or(50).max(1).min(500);
        let sql = "SELECT id, task_id, status, started_at, finished_at, duration_ms, affected_rows, output, retry_count, trigger_type, created_at \
             FROM __automation_runs WHERE task_id=? ORDER BY created_at DESC LIMIT ?;";
        let limit_str = limit_val.to_string();
        let params: [&dyn ToSql; 2] = [&task_id, &limit_str];
        let result = conn.query(sql, &params).map_err(|e| format!("查询任务运行日志失败：{}", e))?;
        let mut runs: Vec<TaskRun> = Vec::new();
        for row in &result.rows {
            if row.len() < 11 { continue; }
            runs.push(TaskRun {
                id: row[0].clone(),
                task_id: row[1].clone(),
                status: row[2].clone(),
                started_at: row[3].parse().unwrap_or(0),
                finished_at: row[4].parse().ok(),
                duration_ms: row[5].parse().ok(),
                affected_rows: row[6].parse().ok(),
                output: if row[7].is_empty() { None } else { Some(row[7].clone()) },
                retry_count: row[8].parse().unwrap_or(0),
                trigger_type: row[9].clone(),
                created_at: row[10].parse().unwrap_or(0),
            });
        }
        Ok(runs)
    }

    // ============================================================
    // 行 -> Task
    // ============================================================

    fn row_to_task(row: &[String]) -> Result<Task, String> {
        if row.len() < 26 {
            return Err("任务行数据不完整".to_string());
        }
        Ok(Task {
            id: row[0].clone(),
            name: row[1].clone(),
            description: row[2].clone(),
            task_type: row[3].clone(),
            payload: row[4].clone(),
            schedule_mode: row[5].clone(),
            schedule_value: row[6].clone(),
            timezone: row[7].clone(),
            state: row[8].clone(),
            project_id: row[9].clone(),
            next_run_at: row[10].parse().ok(),
            last_run_at: row[11].parse().ok(),
            last_run_status: if row[12].is_empty() { None } else { Some(row[12].clone()) },
            last_run_duration_ms: row[13].parse().ok(),
            total_runs: row[14].parse().unwrap_or(0),
            success_runs: row[15].parse().unwrap_or(0),
            failed_runs: row[16].parse().unwrap_or(0),
            retry_on_fail: row[17].parse().unwrap_or(0),
            retry_interval_secs: row[18].parse().unwrap_or(60),
            timeout_secs: row[19].parse().unwrap_or(300),
            notify_on_success: row[20].parse::<i64>().unwrap_or(0) != 0,
            notify_on_failure: row[21].parse::<i64>().unwrap_or(1) != 0,
            tags: row[22].clone(),
            created_by: row[23].clone(),
            created_at: row[24].parse().unwrap_or(0),
            updated_at: row[25].parse().unwrap_or(0),
        })
    }

    /// 精简查询：获取所有任务的基本信息（启动聚合返回用）
    pub fn list_tasks_lite(conn: &MutexGuardConnection<'_>) -> Result<Vec<TaskLite>, String> {
        use crate::database::traits::ToSql;
        let empty_params: [&dyn ToSql; 0] = [];
        let rows = conn.query(
            "SELECT id, name, description, task_type, schedule_mode, schedule_value, state, next_run_at,
                    last_run_status, last_run_duration_ms, total_runs, success_runs, failed_runs, created_at, updated_at
             FROM __automation_tasks ORDER BY updated_at DESC",
            &empty_params
        ).map_err(|e| format!("获取任务精简列表失败: {}", e))?;

        let mut result = Vec::new();
        for row in rows.rows {
            if row.len() < 15 { continue; }
            result.push(TaskLite {
                id: row[0].clone(),
                name: row[1].clone(),
                description: row[2].clone(),
                task_type: row[3].clone(),
                schedule_mode: row[4].clone(),
                schedule_value: row[5].clone(),
                state: row[6].clone(),
                next_run_at: row[7].parse().ok(),
                last_run_status: if row[8].is_empty() { None } else { Some(row[8].clone()) },
                last_run_duration_ms: row[9].parse().ok(),
                total_runs: row[10].parse().unwrap_or(0),
                success_runs: row[11].parse().unwrap_or(0),
                failed_runs: row[12].parse().unwrap_or(0),
                created_at: row[13].parse().unwrap_or(0),
                updated_at: row[14].parse().unwrap_or(0),
            });
        }
        Ok(result)
    }

    // ============================================================
    // 任务依赖 CRUD
    // ============================================================

    /// 查询某个任务的所有依赖，按 created_at 排序
    pub fn list_dependencies(
        conn: &MutexGuardConnection<'_>,
        task_id: &str,
    ) -> Result<Vec<TaskDependency>, String> {
        let sql = "SELECT id, task_id, dependency_type, dependency_config, created_at, updated_at \
             FROM __task_dependencies WHERE task_id = ? ORDER BY created_at ASC;";
        let params: [&dyn ToSql; 1] = [&task_id];
        let result = conn.query(sql, &params).map_err(|e| format!("查询任务依赖失败: {}", e))?;
        let mut deps = Vec::new();
        for row in &result.rows {
            if row.len() < 6 { continue; }
            deps.push(Self::row_to_dependency(row)?);
        }
        Ok(deps)
    }

    /// 新增一条依赖，返回创建后的对象
    pub fn add_dependency(
        conn: &MutexGuardConnection<'_>,
        task_id: &str,
        dep_type: &str,
        dep_config: &str,
    ) -> Result<TaskDependency, String> {
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().timestamp();

        let insert_sql = "INSERT INTO __task_dependencies (id, task_id, dependency_type, dependency_config, created_at, updated_at) \
             VALUES (?, ?, ?, ?, ?, ?);";
        let now_str = now.to_string();
        let params: [&dyn ToSql; 6] = [&id, &task_id, &dep_type, &dep_config, &now_str, &now_str];
        conn.execute(insert_sql, &params).map_err(|e| format!("创建任务依赖失败: {}", e))?;

        Self::get_dependency(conn, &id)
    }

    /// 根据 ID 查询依赖
    fn get_dependency(
        conn: &MutexGuardConnection<'_>,
        id: &str,
    ) -> Result<TaskDependency, String> {
        let sql = "SELECT id, task_id, dependency_type, dependency_config, created_at, updated_at \
             FROM __task_dependencies WHERE id = ?;";
        let params: [&dyn ToSql; 1] = [&id];
        let result = conn.query(sql, &params).map_err(|e| format!("查询任务依赖失败: {}", e))?;
        if result.rows.is_empty() {
            return Err("任务依赖不存在".to_string());
        }
        Self::row_to_dependency(&result.rows[0])
    }

    /// 更新依赖配置，返回更新后的对象
    pub fn update_dependency(
        conn: &MutexGuardConnection<'_>,
        dep_id: &str,
        dep_config: &str,
    ) -> Result<TaskDependency, String> {
        let now = chrono::Utc::now().timestamp();
        let now_str = now.to_string();

        let update_sql = "UPDATE __task_dependencies SET dependency_config = ?, updated_at = ? WHERE id = ?;";
        let params: [&dyn ToSql; 3] = [&dep_config, &now_str, &dep_id];
        conn.execute(update_sql, &params).map_err(|e| format!("更新任务依赖失败: {}", e))?;

        Self::get_dependency(conn, dep_id)
    }

    /// 删除依赖，返回是否成功
    pub fn delete_dependency(
        conn: &MutexGuardConnection<'_>,
        dep_id: &str,
    ) -> Result<bool, String> {
        let sql = "DELETE FROM __task_dependencies WHERE id = ?;";
        let params: [&dyn ToSql; 1] = [&dep_id];
        match conn.execute(sql, &params) {
            Ok(rows) => Ok(rows > 0),
            Err(e) => Err(format!("删除任务依赖失败: {}", e)),
        }
    }

    /// 全量替换某个任务的所有依赖（先删后插，事务内完成）
    pub fn replace_dependencies(
        conn: &MutexGuardConnection<'_>,
        task_id: &str,
        deps: Vec<(String, String)>,
    ) -> Result<Vec<TaskDependency>, String> {
        conn.begin_transaction().map_err(|e| format!("开启事务失败: {}", e))?;

        let delete_sql = "DELETE FROM __task_dependencies WHERE task_id = ?;";
        let delete_params: [&dyn ToSql; 1] = [&task_id];
        if let Err(e) = conn.execute(delete_sql, &delete_params) {
            let _ = conn.rollback_transaction();
            return Err(format!("删除旧依赖失败: {}", e));
        }

        let now = chrono::Utc::now().timestamp();
        let now_str = now.to_string();
        let mut result = Vec::new();

        for (dep_type, dep_config) in &deps {
            let id = uuid::Uuid::new_v4().to_string();
            let insert_sql = "INSERT INTO __task_dependencies (id, task_id, dependency_type, dependency_config, created_at, updated_at) \
                 VALUES (?, ?, ?, ?, ?, ?);";
            let params: [&dyn ToSql; 6] = [&id, &task_id, &dep_type.as_str(), &dep_config.as_str(), &now_str, &now_str];
            if let Err(e) = conn.execute(insert_sql, &params) {
                let _ = conn.rollback_transaction();
                return Err(format!("创建依赖失败: {}", e));
            }
            match Self::get_dependency(conn, &id) {
                Ok(dep) => result.push(dep),
                Err(e) => {
                    let _ = conn.rollback_transaction();
                    return Err(e);
                }
            }
        }

        if let Err(e) = conn.commit_transaction() {
            let _ = conn.rollback_transaction();
            return Err(format!("提交事务失败: {}", e));
        }

        Ok(result)
    }

    /// 查询所有依赖于某个前置任务的后置任务
    /// 条件：dependency_type IN ('task_success', 'task_completed')
    /// 需要解析 dependency_config JSON 中的 upstreamTaskId 字段来匹配
    pub fn get_downstream_tasks(
        conn: &MutexGuardConnection<'_>,
        upstream_task_id: &str,
    ) -> Result<Vec<(TaskDependency, Task)>, String> {
        let sql = "SELECT d.id, d.task_id, d.dependency_type, d.dependency_config, d.created_at, d.updated_at, \
                          t.id, t.name, t.description, t.task_type, t.payload, t.schedule_mode, t.schedule_value, \
                          t.timezone, t.state, t.project_id, t.next_run_at, t.last_run_at, t.last_run_status, \
                          t.last_run_duration_ms, t.total_runs, t.success_runs, t.failed_runs, t.retry_on_fail, \
                          t.retry_interval_secs, t.timeout_secs, t.notify_on_success, t.notify_on_failure, \
                          t.tags, t.created_by, t.created_at, t.updated_at \
             FROM __task_dependencies d \
             JOIN __automation_tasks t ON d.task_id = t.id \
             WHERE d.dependency_type IN ('task_success', 'task_completed');";

        let result = conn.query(sql, &[]).map_err(|e| format!("查询下游任务失败: {}", e))?;
        let mut downstream = Vec::new();

        for row in &result.rows {
            if row.len() < 32 { continue; }

            let dep_row: Vec<String> = row.iter().take(6).cloned().collect();
            let task_row: Vec<String> = row.iter().skip(6).cloned().collect();

            let dep = match Self::row_to_dependency(&dep_row) {
                Ok(d) => d,
                Err(_) => continue,
            };

            let dep_config: serde_json::Value = match serde_json::from_str(&dep.dependency_config) {
                Ok(v) => v,
                Err(_) => continue,
            };

            let config_upstream_id = dep_config
                .get("upstreamTaskId")
                .and_then(|v| v.as_str())
                .unwrap_or("");

            if config_upstream_id == upstream_task_id {
                match Self::row_to_task(&task_row) {
                    Ok(task) => downstream.push((dep, task)),
                    Err(_) => continue,
                }
            }
        }

        Ok(downstream)
    }

    /// 触发下游任务（仅一层，避免循环依赖问题）
    /// - task_success: 仅当前任务成功时触发
    /// - task_completed: 无论成功失败都触发
    /// 下游任务状态必须是 enabled 才会被触发
    /// 从 dependency_config 读取 delaySeconds（默认 0），计算触发时间
    /// 更新下游任务的 next_run_at 为触发时间（取较小值）
    fn trigger_downstream_tasks(
        conn: &MutexGuardConnection<'_>,
        upstream_task_id: &str,
        is_success: bool,
        now: i64,
    ) -> Result<(), String> {
        let downstream = Self::get_downstream_tasks(conn, upstream_task_id)?;

        for (dep, task) in downstream {
            // 检查依赖类型是否满足触发条件
            let should_trigger = match dep.dependency_type {
                DependencyType::TaskSuccess => is_success,
                DependencyType::TaskCompleted => true,
                _ => false,
            };

            if !should_trigger {
                continue;
            }

            // 下游任务状态不是 enabled 则跳过
            if task.state != "enabled" {
                continue;
            }

            // 解析 dependency_config，读取 delaySeconds
            let config: serde_json::Value = serde_json::from_str(&dep.dependency_config)
                .unwrap_or(serde_json::Value::Object(serde_json::Map::new()));
            let delay_seconds = config
                .get("delaySeconds")
                .and_then(|v| v.as_i64())
                .unwrap_or(0)
                .max(0);

            // 计算触发时间
            let trigger_time = now + delay_seconds;

            // 决定是否更新 next_run_at
            // 如果当前 next_run_at 为 None，或者 trigger_time 更早，则更新
            let should_update = match task.next_run_at {
                None => true,
                Some(current) => trigger_time < current,
            };

            if should_update {
                let update_sql = "UPDATE __automation_tasks SET next_run_at = ?, updated_at = ? WHERE id = ?;";
                let trigger_time_str = trigger_time.to_string();
                let now_str = now.to_string();
                let params: [&dyn ToSql; 3] = [&trigger_time_str, &now_str, &task.id];
                if let Err(e) = conn.execute(update_sql, &params) {
                    log::warn!("更新下游任务 {} next_run_at 失败: {}", task.id, e);
                }
            }
        }

        Ok(())
    }

    /// 根据依赖列表计算下次运行时间
    /// 遍历所有 time_interval 和 cron 类型的依赖，返回最早的触发时间
    /// 如果没有时间依赖，返回 None
    pub fn compute_next_run_from_deps(now: i64, deps: &[TaskDependency]) -> Option<i64> {
        let mut earliest: Option<i64> = None;

        for dep in deps {
            let next_time = match dep.dependency_type {
                DependencyType::TimeInterval => {
                    let config: serde_json::Value = serde_json::from_str(&dep.dependency_config)
                        .unwrap_or(serde_json::Value::Object(serde_json::Map::new()));
                    let interval_secs = config
                        .get("intervalSeconds")
                        .and_then(|v| v.as_str())
                        .and_then(|s| s.parse::<i64>().ok())
                        .unwrap_or(3600)
                        .max(10);
                    Some(now + interval_secs)
                }
                DependencyType::Cron => {
                    let config: serde_json::Value = serde_json::from_str(&dep.dependency_config)
                        .unwrap_or(serde_json::Value::Object(serde_json::Map::new()));
                    let expression = config
                        .get("expression")
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    compute_next_run(now, "cron", expression)
                }
                _ => None,
            };

            if let Some(t) = next_time {
                earliest = match earliest {
                    Some(e) => Some(e.min(t)),
                    None => Some(t),
                };
            }
        }

        earliest
    }

    /// 行 -> TaskDependency
    fn row_to_dependency(row: &[String]) -> Result<TaskDependency, String> {
        if row.len() < 6 {
            return Err("任务依赖行数据不完整".to_string());
        }
        Ok(TaskDependency {
            id: row[0].clone(),
            task_id: row[1].clone(),
            dependency_type: DependencyType::from(row[2].as_str()),
            dependency_config: row[3].clone(),
            created_at: row[4].parse().unwrap_or(0),
            updated_at: row[5].parse().unwrap_or(0),
        })
    }
}

// ============================================================
// 调度器
// ============================================================

pub struct TaskScheduleEngine;

impl TaskScheduleEngine {
    /// 在独立线程中运行，根据 settings 中的扫描间隔（默认 30 秒）扫描到期任务并执行
    pub fn run_forever(
        db_manager: SharedDatabaseManager,
        shutdown: Arc<AtomicBool>,
    ) {
        std::thread::spawn(move || {
            log::info!("自动化任务调度器线程启动");
            // P1-2 优化：应用启动前 5 秒内不与前端争抢数据库锁，
            // 让前端顺利完成启动阶段的 IPC 调用。
            let startup_grace_ms = 5_000u64;
            let sleep_until = std::time::Instant::now()
                + std::time::Duration::from_millis(startup_grace_ms);
            log::info!(
                "调度器进入启动宽限期：等待 {} ms 后再开始轮询任务",
                startup_grace_ms
            );
            while std::time::Instant::now() < sleep_until {
                if shutdown.load(Ordering::Relaxed) {
                    log::info!("宽限期内收到停止信号，提前退出调度器");
                    return;
                }
                std::thread::sleep(std::time::Duration::from_millis(200));
            }

            loop {
                if shutdown.load(Ordering::Relaxed) {
                    log::info!("自动化任务调度器收到停止信号，退出");
                    return;
                }

                // ============================================================
                // 关键架构修复：把"获取 DB 连接 + 做所有 DB 工作"
                // 限定在 scheduler_do_one_pass 函数内：
                //   - `conn` 是函数局部变量，函数返回时自动 drop → 锁释放
                //   - 锁释放后，外层 loop 才能进入 sleep，不再阻塞前端命令
                // 之前的写法把 `conn` 定义在 loop 外层 scope，导致 sleep 期间
                // 仍持有全局 DB Mutex → 前端所有 DB 命令阻塞 → 界面卡在 "Loading..."。
                // ============================================================
                let effective_interval_secs =
                    Self::scheduler_do_one_pass(&db_manager, &shutdown);

                log::debug!("调度器本轮结束，将 sleep {} 秒", effective_interval_secs);

                // ↓↓ 在此处 DB 锁肯定已释放（conn 的 scope 在
                // scheduler_do_one_pass 内已结束）
                std::thread::sleep(std::time::Duration::from_secs(effective_interval_secs));
            }
        });
    }

    /// 执行一个调度扫描周期
    ///
    /// **架构契约**：本函数调用返回时，DB Mutex 必须已释放。
    /// 方式：在函数内部 let conn = ... ；函数返回时 conn 被 drop → 锁释放。
    /// 这样外层 loop 可以在无锁状态下 sleep，不会阻塞前端 tauri 命令。
    fn scheduler_do_one_pass(
        db_manager: &Arc<crate::database::DatabaseManager>,
        shutdown: &Arc<std::sync::atomic::AtomicBool>,
    ) -> u64 {
        // ---- 此处还没有锁持有 ----

        // 尝试获取 DB 连接（持有全局 Mutex）
        let conn = match db_manager.get_connection() {
            Ok(c) => c,
            Err(_) => {
                // 获取失败：退避 30 秒，无任何锁
                return 30;
            }
        };
        // ---- 从这里开始持有全局 Mutex 锁 ----

        // 1) 确保系统表存在（首次启动时可能还没创建）
        if let Err(e) = TaskService::ensure_tables_exists(&conn) {
            log::warn!("确保自动化任务系统表失败: {}", e);
            return 30;
        }

        // 2) 读取 settings（读取失败使用默认值，不影响运行）
        use crate::services::SettingsService;
        let engine_enabled = SettingsService::get_setting(&conn, "automation", "engineEnabled")
            .ok()
            .flatten()
            .map(|s| !s.value.eq_ignore_ascii_case("false"))
            .unwrap_or(true);
        let scan_interval_secs: u64 = SettingsService::get_setting(&conn, "automation", "scheduleIntervalSecs")
            .ok()
            .flatten()
            .and_then(|s| s.value.parse::<u64>().ok())
            .filter(|&v| (10..=3600).contains(&v))
            .unwrap_or(30);
        let log_retention_days: i64 = SettingsService::get_setting(&conn, "automation", "logRetentionDays")
            .ok()
            .flatten()
            .and_then(|s| s.value.parse::<i64>().ok())
            .filter(|&v| (1..=3650).contains(&v))
            .unwrap_or(30);

        // 读取自动化任务相关设置
        // 注意：defaultRetryOnFail 和 defaultTimeoutSecs 在 create_task 中使用
        // notifyOnFailure 在 run_automation_task_now 命令中使用
        // 这里只读取 maxConcurrentTasks
        let max_concurrent_tasks: i64 = SettingsService::get_setting(&conn, "automation", "maxConcurrentTasks")
            .ok()
            .flatten()
            .and_then(|s| s.value.parse::<i64>().ok())
            .filter(|&v| (1..=20).contains(&v))
            .unwrap_or(3);

        // 3) 引擎开关关闭时：不做任务执行，但仍按配置间隔扫描
        if !engine_enabled {
            return scan_interval_secs;
        }

        // 4) 日志清理
        // 4.1) 清理自动化任务运行日志（超过 log_retention_days 的旧日志）
        let cutoff = chrono::Utc::now().timestamp() - log_retention_days * 86400;
        let cleanup_sql = "DELETE FROM __automation_runs WHERE created_at < ?;";
        let cutoff_str = cutoff.to_string();
        let params_cleanup: [&dyn ToSql; 1] = [&cutoff_str];
        if let Err(e) = conn.execute(cleanup_sql, &params_cleanup) {
            log::warn!("清理过期运行日志失败: {}", e);
        }

        // 4.2) 清理审计日志（如果 auditLogAutoClean 开启）
        let audit_log_auto_clean = SettingsService::get_setting(&conn, "security", "auditLogAutoClean")
            .ok()
            .flatten()
            .map(|s| !s.value.eq_ignore_ascii_case("false"))
            .unwrap_or(false);
        if audit_log_auto_clean {
            let audit_log_max_size_mb: i64 = SettingsService::get_setting(&conn, "security", "auditLogMaxSizeMB")
                .ok()
                .flatten()
                .and_then(|s| s.value.parse::<i64>().ok())
                .filter(|&v| (10..=10000).contains(&v))
                .unwrap_or(100); // 默认 100MB

            use crate::services::AuditLogService;
            if let Err(e) = AuditLogService::cleanup_by_size(&conn, audit_log_max_size_mb) {
                log::warn!("按大小清理审计日志失败: {}", e);
            }
        }

        // 5) 扫描到期任务（使用 max_concurrent_tasks 限制每次扫描的任务数量）
        let now = chrono::Utc::now().timestamp();
        let limit_str = max_concurrent_tasks.to_string();
        let scan_sql = "SELECT id FROM __automation_tasks \
             WHERE state='enabled' AND next_run_at IS NOT NULL AND next_run_at <= ? \
             AND last_run_status != 'running' \
             ORDER BY next_run_at ASC LIMIT ?;";
        let now_str = now.to_string();
        let params_scan: [&dyn ToSql; 2] = [&now_str, &limit_str];

        let candidate_ids = match conn.query(scan_sql, &params_scan) {
            Ok(result) => result.rows.into_iter().map(|r| r.into_iter().next().unwrap_or_default()).collect::<Vec<_>>(),
            Err(_) => Vec::new(),
        };

        // ---- 主动释放全局 DB Mutex：扫描完成后不再需要长期持锁 ----
        //      这样后面的任务执行循环期间不会阻塞前端的 DB 命令。
        drop(conn);

        for cid in candidate_ids {
            if cid.is_empty() { continue; }
            if shutdown.load(std::sync::atomic::Ordering::Relaxed) {
                return scan_interval_secs;
            }
            // 调度器启动的任务：用独立连接 + 启用临时连接（sql 任务不阻塞主连接）
            match TaskService::execute(db_manager, &cid, "schedule", true) {
                Ok(_run) => {
                    log::debug!("任务 {} 执行成功", cid);
                }
                Err(e) => {
                    log::warn!("任务 {} 执行失败：{}", cid, e);
                }
            }
            // 任务间的 200ms 间隔（此时已不持有锁，不阻塞前端）
            std::thread::sleep(std::time::Duration::from_millis(200));
        }

        scan_interval_secs
        // ---- 锁已在执行循环前释放 ----
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::utils::schedule::compute_next_run;

    // ============================================================
    // compute_next_run 行为覆盖
    // ============================================================

    #[test]
    fn compute_next_run_interval_adds_value_to_now() {
        let now = 1_700_000_000i64;
        let result = compute_next_run(now, "interval", "3600");
        assert_eq!(result, Some(now + 3600));
    }

    #[test]
    fn compute_next_run_interval_min_floor_is_10_seconds() {
        // 低于最小间隔 10 秒的值应当被夹到 10，避免过于频繁触发
        let now = 1_700_000_000i64;
        let result = compute_next_run(now, "interval", "1");
        assert_eq!(result, Some(now + 10));
    }

    #[test]
    fn compute_next_run_interval_invalid_value_falls_back_to_3600() {
        let now = 1_700_000_000i64;
        let result = compute_next_run(now, "interval", "not-a-number");
        assert_eq!(result, Some(now + 3600));
    }

    #[test]
    fn compute_next_run_manual_returns_none() {
        assert_eq!(compute_next_run(0, "manual", ""), None);
        assert_eq!(compute_next_run(1_700_000_000, "manual", "anything"), None);
    }

    #[test]
    fn compute_next_run_unknown_mode_returns_none() {
        assert_eq!(compute_next_run(0, "daily", "0 0 * * *"), None);
        assert_eq!(compute_next_run(0, "cronn", "* * * * *"), None);
        assert_eq!(compute_next_run(0, "", ""), None);
    }

    #[test]
    fn compute_next_run_cron_valid_returns_some() {
        // 标准 5 字段 cron 表达式应当在可搜索窗口内找到下一次时间
        let now = 1_700_000_000i64;
        let result = compute_next_run(now, "cron", "0 * * * *");
        assert!(result.is_some());
        assert!(result.unwrap() > now);
    }

    #[test]
    fn compute_next_run_cron_invalid_field_count_returns_none() {
        // 非 5 字段 cron 表达式应当返回 None 而不是 panic
        let now = 1_700_000_000i64;
        assert_eq!(compute_next_run(now, "cron", "0 *"), None);
        assert_eq!(compute_next_run(now, "cron", ""), None);
        assert_eq!(compute_next_run(now, "cron", "0 0 0 0 0 0"), None);
    }

    #[test]
    fn compute_next_run_does_not_panic_on_garbage_input() {
        // 各种异常输入都应优雅返回 None / Some，而不是 panic
        let now = 1_700_000_000i64;
        let cases = [
            ("interval", "99999999999999999999"),
            ("interval", "-100"),
            ("interval", ""),
            ("cron", "a b c d e"),
            ("cron", "*/0 * * * *"),
        ];
        for (mode, value) in cases.iter() {
            let _ = compute_next_run(now, mode, value);
        }
    }

    // ============================================================
    // Task 结构体字段可独立构造
    // ============================================================

    #[test]
    fn task_struct_constructible_without_db() {
        let task = Task {
            id: "t1".to_string(),
            name: "test".to_string(),
            description: String::new(),
            task_type: "sql".to_string(),
            payload: "{}".to_string(),
            schedule_mode: "interval".to_string(),
            schedule_value: "3600".to_string(),
            timezone: "local".to_string(),
            state: "enabled".to_string(),
            project_id: String::new(),
            next_run_at: None,
            last_run_at: None,
            last_run_status: None,
            last_run_duration_ms: None,
            total_runs: 0,
            success_runs: 0,
            failed_runs: 0,
            retry_on_fail: 2,
            retry_interval_secs: 60,
            timeout_secs: 300,
            notify_on_success: false,
            notify_on_failure: true,
            tags: "[]".to_string(),
            created_by: String::new(),
            created_at: 1_700_000_000,
            updated_at: 1_700_000_000,
        };
        assert_eq!(task.id, "t1");
        assert_eq!(task.state, "enabled");
        assert_eq!(task.total_runs, 0);
        assert!(task.next_run_at.is_none());
    }

    #[test]
    fn task_state_and_schedule_mode_combinations_no_panic() {
        // 确认对各种 state / schedule_mode 组合构造 Task 不会 panic
        let states = ["enabled", "disabled", "paused", ""];
        let modes = ["interval", "manual", "cron", "daily", ""];
        for s in states.iter() {
            for m in modes.iter() {
                let task = Task {
                    id: "x".to_string(),
                    name: "x".to_string(),
                    description: String::new(),
                    task_type: "sql".to_string(),
                    payload: "{}".to_string(),
                    schedule_mode: m.to_string(),
                    schedule_value: "3600".to_string(),
                    timezone: "local".to_string(),
                    state: s.to_string(),
                    project_id: String::new(),
                    next_run_at: None,
                    last_run_at: None,
                    last_run_status: None,
                    last_run_duration_ms: None,
                    total_runs: 0,
                    success_runs: 0,
                    failed_runs: 0,
                    retry_on_fail: 0,
                    retry_interval_secs: 60,
                    timeout_secs: 300,
                    notify_on_success: false,
                    notify_on_failure: true,
                    tags: "[]".to_string(),
                    created_by: String::new(),
                    created_at: 0,
                    updated_at: 0,
                };
                assert_eq!(task.state, s.to_string());
                assert_eq!(task.schedule_mode, m.to_string());
            }
        }
    }

    // ============================================================
    // CreateTaskRequest / UpdateTaskRequest 构造
    // ============================================================

    #[test]
    fn create_task_request_default_state_and_retry() {
        let req = CreateTaskRequest {
            name: "backup".to_string(),
            description: None,
            task_type: "sql".to_string(),
            payload: r#"{"sql":"SELECT 1"}"#.to_string(),
            schedule_mode: "interval".to_string(),
            schedule_value: "3600".to_string(),
            state: None,
            retry_on_fail: None,
            timeout_secs: None,
        };
        assert_eq!(req.name, "backup");
        assert!(req.state.is_none());
        assert!(req.retry_on_fail.is_none());
        assert!(req.timeout_secs.is_none());
        assert!(req.payload.contains("SELECT 1"));
    }

    #[test]
    fn create_task_request_with_empty_and_long_name() {
        // 空字符串 / 长字符串都应可被 struct 接收，不产生 panic
        let req = CreateTaskRequest {
            name: "".to_string(),
            description: Some("A".repeat(10_000)),
            task_type: "sql".to_string(),
            payload: "{}".to_string(),
            schedule_mode: "interval".to_string(),
            schedule_value: "100".to_string(),
            state: Some("disabled".to_string()),
            retry_on_fail: Some(3),
            timeout_secs: Some(120),
        };
        assert_eq!(req.state.as_deref(), Some("disabled"));
        assert_eq!(req.retry_on_fail, Some(3));
        assert_eq!(req.timeout_secs, Some(120));
    }

    #[test]
    fn update_task_request_partial_fields() {
        let patch = UpdateTaskRequest {
            name: Some("new".to_string()),
            description: None,
            payload: Some(r#"{"sql":"SELECT 2"}"#.to_string()),
            schedule_mode: None,
            schedule_value: None,
            state: Some("disabled".to_string()),
            retry_on_fail: Some(0),
            timeout_secs: Some(60),
        };
        assert_eq!(patch.name.as_deref(), Some("new"));
        assert!(patch.description.is_none());
        assert_eq!(patch.retry_on_fail, Some(0));
        assert_eq!(patch.timeout_secs, Some(60));
    }

    // ============================================================
    // TaskLite / TaskRun 构造
    // ============================================================

    #[test]
    fn task_lite_constructible_and_fields_match() {
        let lite = TaskLite {
            id: "abc".to_string(),
            name: "hello".to_string(),
            description: String::new(),
            task_type: "sql".to_string(),
            schedule_mode: "interval".to_string(),
            schedule_value: "60".to_string(),
            state: "enabled".to_string(),
            next_run_at: Some(1_700_000_060),
            last_run_status: Some("success".to_string()),
            last_run_duration_ms: Some(100),
            total_runs: 5,
            success_runs: 5,
            failed_runs: 0,
            created_at: 1_700_000_000,
            updated_at: 1_700_000_000,
        };
        assert_eq!(lite.id, "abc");
        assert!(lite.next_run_at.is_some());
        assert_eq!(lite.failed_runs, 0);
    }

    #[test]
    fn task_run_constructible_with_success_and_failed_state() {
        let run_success = TaskRun {
            id: "r1".to_string(),
            task_id: "t1".to_string(),
            status: "success".to_string(),
            started_at: 1_700_000_000,
            finished_at: Some(1_700_000_001),
            duration_ms: Some(1000),
            affected_rows: Some(5),
            output: None,
            retry_count: 0,
            trigger_type: "manual".to_string(),
            created_at: 1_700_000_000,
        };
        assert_eq!(run_success.status, "success");
        assert_eq!(run_success.affected_rows, Some(5));

        let run_failed = TaskRun {
            id: "r2".to_string(),
            task_id: "t1".to_string(),
            status: "failed".to_string(),
            started_at: 1_700_000_000,
            finished_at: Some(1_700_000_001),
            duration_ms: Some(200),
            affected_rows: None,
            output: Some("some error".to_string()),
            retry_count: 1,
            trigger_type: "schedule".to_string(),
            created_at: 1_700_000_000,
        };
        assert_eq!(run_failed.status, "failed");
        assert!(run_failed.output.is_some());
    }

    // ============================================================
    // TaskListResponse 构造
    // ============================================================

    #[test]
    fn task_list_response_sums_total_and_enabled() {
        let task_a = Task {
            id: "a".to_string(),
            name: "A".to_string(),
            description: String::new(),
            task_type: "sql".to_string(),
            payload: "{}".to_string(),
            schedule_mode: "interval".to_string(),
            schedule_value: "3600".to_string(),
            timezone: "local".to_string(),
            state: "enabled".to_string(),
            project_id: String::new(),
            next_run_at: None,
            last_run_at: None,
            last_run_status: None,
            last_run_duration_ms: None,
            total_runs: 0,
            success_runs: 0,
            failed_runs: 0,
            retry_on_fail: 0,
            retry_interval_secs: 60,
            timeout_secs: 300,
            notify_on_success: false,
            notify_on_failure: true,
            tags: "[]".to_string(),
            created_by: String::new(),
            created_at: 0,
            updated_at: 0,
        };
        let mut task_b = task_a.clone();
        task_b.id = "b".to_string();
        task_b.state = "disabled".to_string();

        let tasks = vec![task_a.clone(), task_b.clone()];
        let enabled_count = tasks.iter().filter(|t| t.state == "enabled").count() as i64;
        let failed_count = tasks
            .iter()
            .filter(|t| t.last_run_status.as_deref() == Some("failed"))
            .count() as i64;

        let resp = TaskListResponse {
            total: tasks.len() as i64,
            enabled_count,
            failed_tasks_count: failed_count,
            tasks,
        };
        assert_eq!(resp.total, 2);
        assert_eq!(resp.enabled_count, 1);
        assert_eq!(resp.failed_tasks_count, 0);
    }

    // ============================================================
    // simplify_sql_error / split_sql_statements 纯函数行为
    // ============================================================

    #[test]
    fn simplify_sql_error_maps_known_patterns() {
        assert_eq!(simplify_sql_error("table test already exists"), "表已存在".to_string());
        assert_eq!(simplify_sql_error("no such table: foo"), "表不存在".to_string());
        assert_eq!(simplify_sql_error("no such column: x"), "列不存在".to_string());
        assert_eq!(simplify_sql_error("syntax error near abc"), "SQL 语法错误".to_string());
        assert_eq!(simplify_sql_error("unique constraint failed"), "约束冲突（重复主键或唯一键冲突）".to_string());
        assert_eq!(simplify_sql_error("unable to open database file"), "数据库不可用".to_string());
        assert_eq!(simplify_sql_error("database is locked"), "数据库被占用，请稍后重试".to_string());
        assert_eq!(simplify_sql_error("out of memory"), "内存不足".to_string());
        assert_eq!(simplify_sql_error("something else entirely"), "SQL 执行失败".to_string());
    }

    #[test]
    fn simplify_sql_error_empty_and_unicode_input_no_panic() {
        assert_eq!(simplify_sql_error(""), "SQL 执行失败".to_string());
        // Unicode 输入不应导致 panic
        let result = simplify_sql_error("错误：表 x 不存在 😀");
        assert!(!result.is_empty());
    }

    #[test]
    fn split_sql_statements_single_no_trailing_semicolon() {
        let r = split_sql_statements("SELECT 1");
        assert_eq!(r, vec!["SELECT 1"]);
    }

    #[test]
    fn split_sql_statements_multiple_splits_correctly() {
        let r = split_sql_statements("SELECT 1; SELECT 2; SELECT 3;");
        assert_eq!(r, vec!["SELECT 1", "SELECT 2", "SELECT 3"]);
    }

    #[test]
    fn split_sql_statements_quote_content_not_split() {
        let r = split_sql_statements("INSERT INTO t VALUES ('a;b'); SELECT * FROM t;");
        assert_eq!(r, vec!["INSERT INTO t VALUES ('a;b')", "SELECT * FROM t"]);
    }

    #[test]
    fn split_sql_statements_empty_and_whitespace_returns_empty() {
        assert!(split_sql_statements("").is_empty());
        assert!(split_sql_statements("   \n\t  ").is_empty());
        assert!(split_sql_statements(";;;").is_empty());
    }

    #[test]
    fn split_sql_statements_double_quote_also_preserved() {
        // 在 SQLite 中双引号常用于标识符，但 split 函数同样需要处理
        let r = split_sql_statements("SELECT \"a;b\" FROM t; SELECT 2;");
        assert_eq!(r, vec!["SELECT \"a;b\" FROM t", "SELECT 2"]);
    }
}

// 辅助函数：将 SQLite 底层错误消息转换为用户友好的描述
// 底层错误只记日志不给用户，以免误导。
fn simplify_sql_error(raw: &str) -> String {
    let lower = raw.to_lowercase();
    if lower.contains("no such table") {
        "表不存在".to_string()
    } else if lower.contains("no such column") {
        "列不存在".to_string()
    } else if lower.contains("syntax error") {
        "SQL 语法错误".to_string()
    } else if lower.contains("constraint failed") || lower.contains("unique constraint") {
        "约束冲突（重复主键或唯一键冲突）".to_string()
    } else if lower.contains("returned results") || lower.contains("did you mean to call query") {
        "语句返回结果集（请改用 SELECT 查询）".to_string()
    } else if lower.contains("unable to open database") {
        "数据库不可用".to_string()
    } else if lower.contains("database is locked") {
        "数据库被占用，请稍后重试".to_string()
    } else if lower.contains("out of memory") {
        "内存不足".to_string()
    } else if lower.contains("table") && lower.contains("already exists") {
        "表已存在".to_string()
    } else {
        "SQL 执行失败".to_string()
    }
}

// 与 commands/sql.rs 保持一致的 SQL 分割
fn split_sql_statements(sql: &str) -> Vec<String> {
    let mut result = Vec::new();
    let mut current = String::new();
    let mut in_single_quote = false;
    let mut in_double_quote = false;

    for c in sql.chars() {
        match c {
            '\'' if !in_double_quote => {
                in_single_quote = !in_single_quote;
                current.push(c);
            }
            '"' if !in_single_quote => {
                in_double_quote = !in_double_quote;
                current.push(c);
            }
            ';' if !in_single_quote && !in_double_quote => {
                let trimmed = current.trim().to_string();
                if !trimmed.is_empty() {
                    result.push(trimmed);
                }
                current.clear();
            }
            _ => current.push(c),
        }
    }

    let trimmed = current.trim().to_string();
    if !trimmed.is_empty() {
        result.push(trimmed);
    }
    result
}

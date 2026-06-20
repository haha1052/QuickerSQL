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
        ];

        // ⚠️ rusqlite::execute() 只支持单条语句，因此必须把每条 DDL 拆成独立调用
        for (i, stmt) in statements.iter().enumerate() {
            if let Err(e) = conn.execute(stmt, &[]) {
                return Err(format!("创建自动化任务系统表失败（第{}条）：{}", i + 1, e));
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
        let retry_on_fail = req.retry_on_fail.unwrap_or(2);
        let timeout_secs = req.timeout_secs.unwrap_or(300);

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
                    compute_next_run(now, &task.schedule_mode, &task.schedule_value)
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
                        // 不重试，按原调度继续（失败后仍然计算下次调度时间）
                        compute_next_run(now, &task.schedule_mode, &task.schedule_value)
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
            .map(|s| s.value.to_ascii_lowercase() != "false")
            .unwrap_or(true);
        let scan_interval_secs: u64 = SettingsService::get_setting(&conn, "automation", "scheduleIntervalSecs")
            .ok()
            .flatten()
            .and_then(|s| s.value.parse::<u64>().ok())
            .filter(|&v| v >= 10 && v <= 3600)
            .unwrap_or(30);
        let log_retention_days: i64 = SettingsService::get_setting(&conn, "automation", "logRetentionDays")
            .ok()
            .flatten()
            .and_then(|s| s.value.parse::<i64>().ok())
            .filter(|&v| v >= 1 && v <= 3650)
            .unwrap_or(30);

        // 3) 引擎开关关闭时：不做任务执行，但仍按配置间隔扫描
        if !engine_enabled {
            return scan_interval_secs;
        }

        // 4) 日志清理（超过 log_retention_days 的旧日志）
        let cutoff = chrono::Utc::now().timestamp() - log_retention_days * 86400;
        let cleanup_sql = "DELETE FROM __automation_runs WHERE created_at < ?;";
        let cutoff_str = cutoff.to_string();
        let params_cleanup: [&dyn ToSql; 1] = [&cutoff_str];
        if let Err(e) = conn.execute(cleanup_sql, &params_cleanup) {
            log::warn!("清理过期运行日志失败: {}", e);
        }

        // 5) 扫描到期任务
        let now = chrono::Utc::now().timestamp();
        let scan_sql = "SELECT id FROM __automation_tasks \
             WHERE state='enabled' AND next_run_at IS NOT NULL AND next_run_at <= ? \
             AND last_run_status != 'running' \
             ORDER BY next_run_at ASC LIMIT ?;";
        let now_str = now.to_string();
        let limit_5 = "5".to_string();
        let params_scan: [&dyn ToSql; 2] = [&now_str, &limit_5];

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

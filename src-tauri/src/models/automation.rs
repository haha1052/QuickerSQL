//! 自动化任务模块
//! 包含定时任务的核心数据结构
use serde::{Deserialize, Serialize};

/// 跨端字段对照表：
///   Rust (snake_case)        ↔  TypeScript (camelCase)
///   id                       ↔  id
///   name                     ↔  name
///   description              ↔  description
///   task_type                ↔  taskType
///   payload                  ↔  payload
///   schedule_mode            ↔  scheduleMode
///   schedule_value           ↔  scheduleValue
///   timezone                 ↔  timezone
///   state                    ↔  state
///   project_id               ↔  projectId
///   next_run_at              ↔  nextRunAt
///   last_run_at              ↔  lastRunAt
///   last_run_status          ↔  lastRunStatus
///   last_run_duration_ms     ↔  lastRunDurationMs
///   total_runs               ↔  totalRuns
///   success_runs             ↔  successRuns
///   failed_runs              ↔  failedRuns
///   retry_on_fail            ↔  retryOnFail
///   retry_interval_secs      ↔  retryIntervalSecs
///   timeout_secs             ↔  timeoutSecs
///   notify_on_success        ↔  notifyOnSuccess
///   notify_on_failure        ↔  notifyOnFailure
///   tags                     ↔  tags
///   created_by               ↔  createdBy
///   created_at               ↔  createdAt
///   updated_at               ↔  updatedAt
///
/// 任务核心结构（对应 __automation_tasks 表）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub name: String,
    pub description: String,
    pub task_type: String,
    pub payload: String,
    pub schedule_mode: String,
    pub schedule_value: String,
    pub timezone: String,
    pub state: String,
    pub project_id: String,
    pub next_run_at: Option<i64>,
    pub last_run_at: Option<i64>,
    pub last_run_status: Option<String>,
    pub last_run_duration_ms: Option<i64>,
    pub total_runs: i64,
    pub success_runs: i64,
    pub failed_runs: i64,
    pub retry_on_fail: i64,
    pub retry_interval_secs: i64,
    pub timeout_secs: i64,
    pub notify_on_success: bool,
    pub notify_on_failure: bool,
    pub tags: String,
    pub created_by: String,
    pub created_at: i64,
    pub updated_at: i64,
}

/// 任务运行记录（对应 __automation_runs 表）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskRun {
    pub id: String,
    pub task_id: String,
    pub status: String,
    pub started_at: i64,
    pub finished_at: Option<i64>,
    pub duration_ms: Option<i64>,
    pub affected_rows: Option<i64>,
    pub output: Option<String>,
    pub retry_count: i64,
    pub trigger_type: String,
    pub created_at: i64,
}

/// 创建任务的请求结构
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTaskRequest {
    pub name: String,
    pub description: Option<String>,
    pub task_type: String,
    pub payload: String,
    pub schedule_mode: String,
    pub schedule_value: String,
    pub state: Option<String>,
    pub retry_on_fail: Option<i64>,
    pub timeout_secs: Option<i64>,
}

/// 更新任务的请求结构
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTaskRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub payload: Option<String>,
    pub schedule_mode: Option<String>,
    pub schedule_value: Option<String>,
    pub state: Option<String>,
    pub retry_on_fail: Option<i64>,
    pub timeout_secs: Option<i64>,
}

/// 任务列表响应（带统计信息）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskListResponse {
    pub tasks: Vec<Task>,
    pub total: i64,
    pub enabled_count: i64,
    pub failed_tasks_count: i64,
}

/// Task 精简信息（用于启动聚合返回，供前端 TaskCenter 页面首屏展示）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskLite {
    pub id: String,
    pub name: String,
    pub description: String,
    pub task_type: String,
    pub schedule_mode: String,
    pub schedule_value: String,
    pub state: String,
    pub next_run_at: Option<i64>,
    pub last_run_status: Option<String>,
    pub last_run_duration_ms: Option<i64>,
    pub total_runs: i64,
    pub success_runs: i64,
    pub failed_runs: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

/// 任务依赖类型
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DependencyType {
    TimeInterval,
    Cron,
    TaskSuccess,
    TaskCompleted,
}

impl From<&str> for DependencyType {
    fn from(s: &str) -> Self {
        match s {
            "time_interval" => DependencyType::TimeInterval,
            "cron" => DependencyType::Cron,
            "task_success" => DependencyType::TaskSuccess,
            "task_completed" => DependencyType::TaskCompleted,
            _ => DependencyType::TimeInterval,
        }
    }
}

/// 任务依赖（对应 __task_dependencies 表）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskDependency {
    pub id: String,
    pub task_id: String,
    pub dependency_type: DependencyType,
    pub dependency_config: String,
    pub created_at: i64,
    pub updated_at: i64,
}

/// 创建任务依赖的请求结构
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTaskDependencyRequest {
    pub dependency_type: String,
    pub dependency_config: String,
}

/// 更新任务依赖的请求结构
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTaskDependencyRequest {
    pub dependency_config: Option<String>,
}

// 自动化任务模块 - 类型定义
export type TaskType = 'sql' | 'refresh_chart' | 'refresh_dashboard' | 'export_csv';
export type ScheduleMode = 'interval' | 'cron' | 'manual';
export type TaskState = 'enabled' | 'disabled' | 'paused';
export type TaskRunStatus = 'running' | 'success' | 'failed' | 'skipped';
export type DependencyType = 'time_interval' | 'cron' | 'task_success' | 'task_completed';

export interface Task {
  id: string;
  name: string;
  description: string;
  taskType: TaskType;
  payload: string;               // JSON字符串，由 taskType 决定内容
  scheduleMode: ScheduleMode;
  scheduleValue: string;         // interval=秒数字符串；cron=5字段表达式
  timezone: string;
  state: TaskState;
  projectId: string;
  nextRunAt: number | null;      // unix 秒
  lastRunAt: number | null;
  lastRunStatus: TaskRunStatus | null;
  lastRunDurationMs: number | null;
  totalRuns: number;
  successRuns: number;
  failedRuns: number;
  retryOnFail: number;
  retryIntervalSecs: number;
  timeoutSecs: number;
  notifyOnSuccess: boolean;
  notifyOnFailure: boolean;
  tags: string;                  // JSON字符串数组
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  dependencies?: TaskDependency[];
}

export interface TaskRun {
  id: string;
  taskId: string;
  status: TaskRunStatus;
  startedAt: number;
  finishedAt: number | null;
  durationMs: number | null;
  affectedRows: number | null;
  output: string | null;
  retryCount: number;
  triggerType: 'manual' | 'schedule';
  createdAt: number;
}

export interface CreateTaskPayload {
  name: string;
  description?: string;
  taskType: TaskType;
  payload: string;
  scheduleMode: ScheduleMode;
  scheduleValue: string;
  state?: TaskState;
  retryOnFail?: number;
  timeoutSecs?: number;
}

export interface UpdateTaskPayload {
  name?: string;
  description?: string;
  payload?: string;
  scheduleMode?: ScheduleMode;
  scheduleValue?: string;
  state?: TaskState;
}

export interface TaskListResponse {
  tasks: Task[];
  total: number;
  enabledCount: number;
  failedTasksCount: number;
}

// Payload 内部类型（供前端展示/编辑时使用）
export interface SqlTaskPayload { sql: string; outputMode?: string; }
export interface RefreshChartPayload { chartId: string; }
export interface RefreshDashboardPayload { dashboardId: string; }
export interface ExportCsvPayload { sql: string; outputPath: string; delimiter?: string; withHeader?: boolean; }

export type TaskPayloadInner =
  | SqlTaskPayload
  | RefreshChartPayload
  | RefreshDashboardPayload
  | ExportCsvPayload;

export interface TaskDependency {
  id: string;
  taskId: string;
  dependencyType: DependencyType;
  dependencyConfig: string;
  createdAt: number;
  updatedAt: number;
}

export interface TimeIntervalConfig {
  intervalSeconds: number;
}

export interface CronConfig {
  expression: string;
  timezone?: string;
}

export interface TaskSuccessConfig {
  upstreamTaskId: string;
  delaySeconds?: number;
}

export interface TaskCompletedConfig {
  upstreamTaskId: string;
  delaySeconds?: number;
}

export type DependencyConfig = TimeIntervalConfig | CronConfig | TaskSuccessConfig | TaskCompletedConfig;

export function parseDependencyConfig(configStr: string): DependencyConfig | null {
  try {
    const parsed = JSON.parse(configStr);
    return parsed as DependencyConfig;
  } catch {
    return null;
  }
}

export function serializeDependencyConfig(config: DependencyConfig): string {
  return JSON.stringify(config);
}

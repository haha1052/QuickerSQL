# QuickerSQL API 参考文档

> 本文档涵盖 QuickerSQL 核心 Tauri 命令的 API 参考。
> 版本：v11.0 | 更新日期：2026-06-28

---

## 目录

- [数据库相关命令](#数据库相关命令)
- [设置相关命令](#设置相关命令)
- [仪表盘相关命令](#仪表盘相关命令)
- [自动化任务相关命令](#自动化任务相关命令)
- [工作区相关命令](#工作区相关命令)
- [查询历史相关命令](#查询历史相关命令)

---

## 数据库相关命令

### list_databases

获取所有可用的数据库连接。

**命令名称**：`list_databases`

**参数**：无

**返回值**：
```typescript
interface DatabaseInfo {
  id: string;           // 数据库唯一标识
  name: string;         // 数据库名称
  dbType: string;       // 数据库类型 (sqlite/duckdb)
  path: string;          // 数据库文件路径
  size: number;         // 数据库大小（字节）
  isDefault: boolean;    // 是否为默认数据库
  createdAt: string;     // 创建时间
}
type ApiResponse<DatabaseInfo[]>
```

**示例**：
```typescript
const response = await invokeCommand<DatabaseInfo[]>('list_databases');
if (response.success) {
  console.log('数据库列表:', response.data);
}
```

---

### execute_sql

执行 SQL 查询。

**命令名称**：`execute_sql`

**参数**：
```typescript
interface ExecuteSqlRequest {
  dbId: string;         // 数据库 ID
  sql: string;          // SQL 语句
  limit?: number;        // 结果行数限制
  timeout?: number;      // 超时时间（秒）
}
```

**返回值**：
```typescript
interface ExecuteSqlResponse {
  columns: string[];           // 列名列表
  rows: Record<string, any>[]; // 结果行
  rowCount: number;           // 返回行数
  executionTime: number;       // 执行时间（毫秒）
  affectedRows?: number;      // 受影响行数（INSERT/UPDATE/DELETE）
}
type ApiResponse<ExecuteSqlResponse>
```

**示例**：
```typescript
const response = await invokeCommand<ExecuteSqlResponse>('execute_sql', {
  dbId: 'default',
  sql: 'SELECT * FROM users LIMIT 10',
  limit: 10
});
```

---

### list_tables

列出数据库中的所有表。

**命令名称**：`list_tables`

**参数**：
```typescript
interface ListTablesRequest {
  dbId: string;         // 数据库 ID
  includeSystem?: boolean; // 是否包含系统表
}
```

**返回值**：
```typescript
interface TableInfo {
  name: string;          // 表名
  type: string;          // 表类型 (table/view)
  rowCount: number;      // 行数
  size: number;          // 表大小（字节）
}
type ApiResponse<TableInfo[]>
```

---

### get_table_schema

获取表的结构信息。

**命令名称**：`get_table_schema`

**参数**：
```typescript
interface GetTableSchemaRequest {
  dbId: string;          // 数据库 ID
  tableName: string;     // 表名
}
```

**返回值**：
```typescript
interface ColumnInfo {
  name: string;          // 列名
  dataType: string;      // 数据类型
  nullable: boolean;     // 是否可为空
  primaryKey: boolean;   // 是否为主键
  defaultValue?: string; // 默认值
}
type ApiResponse<ColumnInfo[]>
```

---

## 设置相关命令

### get_all_settings

获取所有设置项。

**命令名称**：`get_all_settings`

**参数**：无

**返回值**：
```typescript
interface SettingItem {
  id: number;            // 设置项 ID
  category: string;      // 分类
  key: string;          // 键名
  value: string;        // 值
  valueType: string;    // 值类型 (text/number/boolean/json)
  options?: string;      // 可选值
  description?: string;  // 描述
  updatedAt: string;     // 更新时间
}
type ApiResponse<SettingItem[]>
```

---

### get_setting

获取单个设置项的值。

**命令名称**：`get_setting`

**参数**：
```typescript
interface GetSettingRequest {
  category: string;      // 分类
  key: string;           // 键名
}
```

**返回值**：
```typescript
interface SettingValue {
  value: string;         // 设置值
  valueType: string;     // 值类型
}
type ApiResponse<SettingValue | null>
```

---

### update_setting

更新设置项。

**命令名称**：`update_setting`

**参数**：
```typescript
interface UpdateSettingRequest {
  category: string;      // 分类
  key: string;           // 键名
  value: string;        // 新值
  description?: string;  // 可选描述
}
```

**返回值**：
```typescript
interface SettingItem {
  // 同 get_all_settings 返回值
}
type ApiResponse<SettingItem>
```

---

### reset_settings

重置设置为默认值。

**命令名称**：`reset_settings`

**参数**：无

**返回值**：
```typescript
type ApiResponse<{ success: boolean; message: string }>
```

---

## 仪表盘相关命令

### get_dashboards

获取所有仪表盘。

**命令名称**：`get_dashboards`

**参数**：无

**返回值**：
```typescript
interface Dashboard {
  id: string;           // 仪表盘 ID
  name: string;          // 仪表盘名称
  description?: string;  // 描述
  layout: DashboardItem[]; // 布局项
  refreshIntervalSecs: number; // 刷新间隔
  isDefault: boolean;    // 是否为默认
  createdBy: string;     // 创建者
  createdAt: string;     // 创建时间
  updatedAt: string;     // 更新时间
}
type ApiResponse<Dashboard[]>
```

---

### create_dashboard

创建新仪表盘。

**命令名称**：`create_dashboard`

**参数**：
```typescript
interface CreateDashboardRequest {
  name: string;          // 仪表盘名称
  description?: string;  // 描述
  layout?: DashboardItem[]; // 初始布局
  refreshIntervalSecs?: number; // 刷新间隔
  isDefault?: boolean;   // 是否为默认
  createdBy?: string;   // 创建者
}
```

**返回值**：
```typescript
type ApiResponse<Dashboard>
```

---

### update_dashboard

更新仪表盘。

**命令名称**：`update_dashboard`

**参数**：
```typescript
interface UpdateDashboardRequest {
  id: string;            // 仪表盘 ID
  name?: string;         // 新名称
  description?: string;  // 新描述
  layout?: DashboardItem[]; // 新布局
  refreshIntervalSecs?: number; // 新刷新间隔
  isDefault?: boolean;   // 是否为默认
}
```

**返回值**：
```typescript
type ApiResponse<Dashboard>
```

---

### delete_dashboard

删除仪表盘。

**命令名称**：`delete_dashboard`

**参数**：
```typescript
interface DeleteDashboardRequest {
  id: string;            // 仪表盘 ID
}
```

**返回值**：
```typescript
type ApiResponse<{ success: boolean }>
```

---

## 自动化任务相关命令

### list_tasks

获取所有自动化任务。

**命令名称**：`list_tasks`

**参数**：
```typescript
interface ListTasksRequest {
  page?: number;         // 页码
  pageSize?: number;     // 每页数量
  status?: string;       // 状态筛选
  taskType?: string;     // 类型筛选
}
```

**返回值**：
```typescript
interface TaskListResponse {
  items: Task[];         // 任务列表
  total: number;         // 总数
  page: number;          // 当前页
  pageSize: number;       // 每页大小
}
type ApiResponse<TaskListResponse>
```

---

### create_task

创建新任务。

**命令名称**：`create_task`

**参数**：
```typescript
interface CreateTaskRequest {
  name: string;          // 任务名称
  description?: string;  // 描述
  taskType: string;     // 任务类型 (query/export/import)
  scheduleMode: string;  // 调度模式 (manual/cron/interval)
  sql?: string;          // SQL 语句（查询任务）
  notificationConfig?: NotificationConfig; // 通知配置
  retryConfig?: RetryConfig; // 重试配置
}
```

**返回值**：
```typescript
type ApiResponse<Task>
```

---

### run_task_now

立即运行任务。

**命令名称**：`run_task_now`

**参数**：
```typescript
interface RunTaskNowRequest {
  taskId: string;        // 任务 ID
}
```

**返回值**：
```typescript
interface TaskRunResult {
  runId: string;         // 运行记录 ID
  status: string;        // 状态 (success/failed/running)
  startedAt: string;     // 开始时间
  completedAt?: string;  // 完成时间
  output?: string;       // 输出结果
  error?: string;        // 错误信息
}
type ApiResponse<TaskRunResult>
```

---

### get_task_runs

获取任务运行记录。

**命令名称**：`get_task_runs`

**参数**：
```typescript
interface GetTaskRunsRequest {
  taskId: string;        // 任务 ID
  page?: number;         // 页码
  pageSize?: number;     // 每页数量
  status?: string;       // 状态筛选
}
```

**返回值**：
```typescript
interface TaskRunListResponse {
  taskId: string;
  items: TaskRun[];      // 运行记录列表
  total: number;
}
type ApiResponse<TaskRunListResponse>
```

---

## 工作区相关命令

### list_workspace_tabs

获取工作区标签页列表。

**命令名称**：`list_workspace_tabs`

**参数**：无

**返回值**：
```typescript
interface WorkspaceTab {
  id: string;            // 标签页 ID
  name: string;          // 名称
  tabType: string;       // 类型 (query/dashboard/settings)
  isActive: boolean;     // 是否激活
  order: number;         // 排序
}
type ApiResponse<WorkspaceTab[]>
```

---

### create_workspace_tab

创建工作区标签页。

**命令名称**：`create_workspace_tab`

**参数**：
```typescript
interface CreateWorkspaceTabRequest {
  name: string;          // 标签页名称
  tabType: string;      // 类型
}
```

**返回值**：
```typescript
type ApiResponse<WorkspaceTab>
```

---

### reorder_workspace_tabs

重新排序工作区标签页。

**命令名称**：`reorder_workspace_tabs`

**参数**：
```typescript
interface ReorderTabsRequest {
  tabIds: string[];      // 按新顺序排列的标签页 ID 列表
}
```

**返回值**：
```typescript
type ApiResponse<{ success: boolean }>
```

---

## 查询历史相关命令

### get_query_history

获取查询历史。

**命令名称**：`get_query_history`

**参数**：
```typescript
interface GetQueryHistoryRequest {
  search?: string;       // 搜索关键词
  onlyFavorites?: boolean; // 只显示收藏
  limit?: number;        // 返回数量
  offset?: number;       // 偏移量
}
```

**返回值**：
```typescript
interface QueryHistoryListResponse {
  items: QueryHistoryItem[]; // 历史记录列表
  total: number;         // 总数
}
type ApiResponse<QueryHistoryListResponse>
```

---

### toggle_favorite

切换查询历史的收藏状态。

**命令名称**：`toggle_favorite`

**参数**：
```typescript
interface ToggleFavoriteRequest {
  id: string;            // 历史记录 ID
  isFavorite: boolean;   // 是否收藏
}
```

**返回值**：
```typescript
type ApiResponse<{ success: boolean }>
```

---

### delete_query_history

删除查询历史记录。

**命令名称**：`delete_query_history`

**参数**：
```typescript
interface DeleteHistoryRequest {
  id: string;            // 历史记录 ID
}
```

**返回值**：
```typescript
type ApiResponse<{ success: boolean }>
```

---

## 通用类型定义

### ApiResponse

所有命令的返回值包装类型。

```typescript
interface ApiResponse<T> {
  success: boolean;      // 是否成功
  data?: T;             // 响应数据
  error?: string;        // 错误信息
  code?: string;         // 错误码
}
```

### DashboardItem

仪表盘布局项。

```typescript
interface DashboardItem {
  id: string;            // 项 ID
  chartId: string;       // 关联图表 ID
  x: number;            // X 坐标
  y: number;            // Y 坐标
  w: number;            // 宽度
  h: number;            // 高度
}
```

### Task

自动化任务。

```typescript
interface Task {
  id: string;            // 任务 ID
  name: string;          // 任务名称
  description?: string;  // 描述
  taskType: string;      // 任务类型
  scheduleMode: string;  // 调度模式
  state: string;         // 状态 (enabled/disabled/paused)
  nextRunAt?: string;   // 下次运行时间
  lastRunAt?: string;   // 上次运行时间
  createdAt: string;    // 创建时间
  updatedAt: string;    // 更新时间
}
```

### TaskRun

任务运行记录。

```typescript
interface TaskRun {
  id: string;            // 运行记录 ID
  taskId: string;        // 任务 ID
  status: string;        // 状态 (success/failed/running)
  startedAt: string;    // 开始时间
  completedAt?: string; // 完成时间
  executionTimeMs?: number; // 执行时间
  output?: string;      // 输出结果
  error?: string;        // 错误信息
}
```

---

## 错误码

| 错误码 | 说明 |
|--------|------|
| `DB_NOT_FOUND` | 数据库未找到 |
| `TABLE_NOT_FOUND` | 表未找到 |
| `INVALID_SQL` | SQL 语法错误 |
| `QUERY_TIMEOUT` | 查询超时 |
| `PERMISSION_DENIED` | 权限不足 |
| `TASK_NOT_FOUND` | 任务未找到 |
| `TASK_RUNNING` | 任务正在运行 |
| `NETWORK_ERROR` | 网络错误 |
| `UNKNOWN_ERROR` | 未知错误 |

---

## 调用示例

### 完整的命令调用流程

```typescript
import { invokeCommand } from '@/services/tauri';

// 1. 获取数据库列表
const dbResponse = await invokeCommand('list_databases');
if (!dbResponse.success) {
  console.error('获取数据库列表失败:', dbResponse.error);
  return;
}

// 2. 执行查询
const queryResponse = await invokeCommand('execute_sql', {
  dbId: dbResponse.data[0].id,
  sql: 'SELECT COUNT(*) as cnt FROM sqlite_master'
});
if (queryResponse.success) {
  console.log('查询结果:', queryResponse.data.rows);
}

// 3. 创建仪表盘
const dashboardResponse = await invokeCommand('create_dashboard', {
  name: '我的仪表盘',
  description: '测试仪表盘'
});
if (dashboardResponse.success) {
  console.log('创建成功:', dashboardResponse.data.id);
}
```

# QuickerSQL API 设计方案

**版本：** v1.0  
**日期：** 2026-05-31  
**作者：** QuickerSQL 开发团队  
**范围：** Tauri 命令 API、前后端接口规范、数据类型

---

## 目录

1. [API 架构概述](#1)
2. [核心命令 API](#2)
3. [数据类型定义](#3)
4. [错误处理规范](#4)
5. [调用示例](#5)

---

<a id="1"></a>
## 1. API 架构概述

### 1.1 技术栈

```
前端 (React + TypeScript)
    ↓
Tauri 调用层 (invoke)
    ↓
后端 (Rust)
    ├── commands/       # Tauri 命令定义
    ├── services/       # 业务逻辑
    └── repositories/   # 数据访问
```

### 1.2 API 设计原则

- **简单性**: 命令命名清晰，职责单一
- **类型安全**: TypeScript 与 Rust 类型完全对应
- **错误处理**: 统一的错误格式和语义化错误码
- **向后兼容**: 新增功能保持现有 API 稳定
- **版本化**: 所有 API 都包含版本标识，支持渐进式升级

### 1.3 API 版本化策略

#### 1.3.1 版本命名规范

使用语义化版本号（Semantic Versioning）：
- **主版本号（v1、v2）**：不兼容的 API 变更
- **次版本号**：向下兼容的功能性新增
- **修订号**：向下兼容的问题修正

#### 1.3.2 版本标识方式

```typescript
// 方案 1：命令名前缀（推荐）
invoke('v1/query:execute', { sql })
invoke('v2/query:execute', { sql, options })

// 方案 2：参数中包含版本
invoke('query:execute', { 
  apiVersion: 'v1',
  sql 
})
```

**推荐使用方案 1（命令名前缀）**，因为：
- 版本信息清晰可见
- 便于路由和日志追踪
- Tauri 命令天然支持这种命名方式

#### 1.3.3 版本兼容性策略

| 变更类型 | 处理方式 | 示例 |
|---------|---------|------|
| 新增参数 | ✅ 向后兼容，设为可选 | `v1/query:execute` → `v1.1/query:execute` |
| 修改参数名 | ❌ 不兼容，需升级主版本 | `v1/query:execute` → `v2/query:execute` |
| 删除参数 | ❌ 不兼容，需升级主版本 | `v1/query:execute` → `v2/query:execute` |
| 修改返回结构 | ❌ 不兼容，需升级主版本 | `v1/query:execute` → `v2/query:execute` |

#### 1.3.4 多版本共存策略

```rust
// commands/mod.rs
mod v1 {
    pub mod query;
    pub mod import;
}

mod v2 {
    pub mod query;  // 新版本实现
    pub mod import;
}

// 同时注册多个版本
#[tauri::command]
fn v1_query_execute(...) { ... }

#[tauri::command]
fn v2_query_execute(...) { ... }
```

#### 1.3.5 废弃 API 处理流程

```
1. 标记废弃（Deprecation）
   - 在文档中标注 @deprecated
   - 代码中添加警告日志
   - 建议迁移时间（通常 3 个月）

2. 继续维护（Maintenance）
   - 修复关键 bug
   - 不添加新功能
   - 保留至少一个主版本周期

3. 最终移除（Removal）
   - 在下一个主版本中移除
   - 提前发布迁移指南
```

#### 1.3.6 版本化 API 示例

```typescript
// v1 版本（当前）
invoke('v1/query:execute', {
  sql: 'SELECT * FROM users',
  useCache: true
})

// v2 版本（未来，新增功能）
invoke('v2/query:execute', {
  sql: 'SELECT * FROM users',
  options: {
    useCache: true,
    timeout: 30000,
    explain: false
  }
})
```

---

<a id="2"></a>
## 2. 核心命令 API

### 2.1 工作区相关

#### 2.1.1 `workspace:select`

选择或创建工作区目录。

**参数:**
```typescript
{
  path?: string;  // 可选，指定路径，否则弹出文件选择对话框
}
```

**返回:**
```typescript
{
  success: boolean;
  path: string;
  alreadyInitialized?: boolean;
}
```

#### 2.1.2 `workspace:getInfo`

获取当前工作区信息。

**参数:** 无

**返回:**
```typescript
{
  path: string;
  tableCount: number;
  queryCount: number;
  dashboardCount: number;
  sizeBytes: number;
}
```

---

### 2.2 查询相关

#### 2.2.1 `query:execute`

执行 SQL 查询（核心命令）。

**参数:**
```typescript
{
  sql: string;
  useCache?: boolean;        // 默认 true
  cacheTtlSeconds?: number;  // 默认 3600
}
```

**返回:**
```typescript
{
  success: boolean;
  columns: string[];
  data: any[][];
  executionTimeMs: number;
  rowCount: number;
  fromCache?: boolean;
  error?: string;
}
```

#### 2.2.2 `query:history`

获取查询历史。

**参数:**
```typescript
{
  limit?: number;          // 默认 50
  offset?: number;         // 默认 0
  onlyFavorites?: boolean; // 默认 false
  searchQuery?: string;
  tags?: string[];
}
```

**返回:**
```typescript
{
  items: Array<{
    id: string;
    sql: string;
    executedAt: string;
    executionTimeMs: number;
    rowCount: number;
    success: boolean;
    isFavorite: boolean;
    tags?: string[];
  }>;
  total: number;
}
```

#### 2.2.3 `query:toggleFavorite`

收藏/取消收藏查询。

**参数:**
```typescript
{
  id: string;
  isFavorite: boolean;
}
```

**返回:**
```typescript
{
  success: boolean;
}
```

#### 2.2.4 `query:delete`

删除历史查询。

**参数:**
```typescript
{
  id: string;
}
```

**返回:**
```typescript
{
  success: boolean;
}
```

---

### 2.3 数据表相关

#### 2.3.1 `table:list`

获取所有数据表列表。

**参数:** 无

**返回:**
```typescript
{
  items: Array<{
    id: string;
    name: string;
    displayName?: string;
    rowCount: number;
    columnCount: number;
    createdAt: string;
    updatedAt: string;
  }>;
}
```

#### 2.3.2 `table:getSchema`

获取表结构。

**参数:**
```typescript
{
  name: string;
}
```

**返回:**
```typescript
{
  name: string;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
  }>;
}
```

#### 2.3.3 `table:preview`

预览表数据（前 N 行）。

**参数:**
```typescript
{
  name: string;
  limit?: number; // 默认 100
}
```

**返回:**
```typescript
{
  columns: string[];
  data: any[][];
}
```

#### 2.3.4 `table:delete`

删除数据表（移到回收站或永久删除）。

**参数:**
```typescript
{
  name: string;
  confirm?: boolean; // 默认 false
  permanently?: boolean; // 默认 false：移到回收站；true：永久删除
}
```

**返回:**
```typescript
{
  success: boolean;
}
```

---

### 2.8 回收站相关

#### 2.8.1 `trash:list`

获取回收站内容列表。

**参数:** 无

**返回:**
```typescript
{
  items: Array<{
    id: string;
    original_name: string;
    display_name?: string;
    row_count: number;
    column_count: number;
    source_file_type?: string;
    trashed_at: string; // ISO 8601 日期
    trash_expires_at: string; // ISO 8601 日期
    trash_file_path?: string;
    strategy: "small" | "large"; // 删除策略
    days_remaining: number; // 剩余天数
  }>;
}
```

#### 2.8.2 `trash:restore`

从回收站恢复表。

**参数:**
```typescript
{
  table_id: string;
}
```

**返回:**
```typescript
{
  success: boolean;
}
```

#### 2.8.3 `trash:delete`

永久删除回收站中的表。

**参数:**
```typescript
{
  table_id: string;
}
```

**返回:**
```typescript
{
  success: boolean;
}
```

#### 2.8.4 `trash:clean_expired`

清理所有过期的回收站项。

**参数:** 无

**返回:**
```typescript
{
  success: boolean;
  cleaned_count: number;
}
```

#### 2.8.5 `trash:empty`

清空回收站（永久删除所有项）。

**参数:** 无

**返回:**
```typescript
{
  success: boolean;
  deleted_count: number;
}
```

---

### 2.4 数据导入相关

#### 2.4.1 `import:start`

开始导入流程。

**参数:**
```typescript
{
  filePath?: string;       // 可选，不指定则弹出文件选择
  fileType: 'csv' | 'excel' | 'json' | 'parquet';
}
```

**返回:**
```typescript
{
  importId: string;
  step: 'select_file' | 'preview' | 'configure' | 'complete';
  preview?: {
    columns: string[];
    data: any[][];
  };
}
```

#### 2.4.2 `import:configure`

配置导入选项。

**参数:**
```typescript
{
  importId: string;
  tableName: string;
  hasHeader?: boolean;
  delimiter?: string;
  encoding?: string;
}
```

**返回:**
```typescript
{
  importId: string;
  step: 'configure' | 'complete';
  isValid: boolean;
  errors?: string[];
}
```

#### 2.4.3 `import:execute`

执行导入。

**参数:**
```typescript
{
  importId: string;
}
```

**返回:**
```typescript
{
  success: boolean;
  tableName: string;
  rowsImported: number;
  durationMs: number;
  errors?: Array<{
    row: number;
    message: string;
  }>;
}
```

#### 2.4.4 `import:cancel`

取消导入。

**参数:**
```typescript
{
  importId: string;
}
```

**返回:**
```typescript
{
  success: boolean;
}
```

---

### 2.5 仪表盘相关

#### 2.5.1 `dashboard:list`

获取仪表盘列表。

**参数:**
```typescript
{
  onlyFavorites?: boolean;
  limit?: number;
}
```

**返回:**
```typescript
{
  items: Array<{
    id: string;
    name: string;
    description?: string;
    isFavorite: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
}
```

#### 2.5.2 `dashboard:get`

获取仪表盘详情。

**参数:**
```typescript
{
  id: string;
}
```

**返回:**
```typescript
{
  id: string;
  name: string;
  description?: string;
  layout: any; // 布局 JSON
  widgets: any[]; // 组件配置
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}
```

#### 2.5.3 `dashboard:create`

创建仪表盘。

**参数:**
```typescript
{
  name: string;
  description?: string;
}
```

**返回:**
```typescript
{
  id: string;
  success: boolean;
}
```

#### 2.5.4 `dashboard:update`

更新仪表盘。

**参数:**
```typescript
{
  id: string;
  name?: string;
  description?: string;
  layout?: any;
  widgets?: any[];
  isFavorite?: boolean;
}
```

**返回:**
```typescript
{
  success: boolean;
}
```

#### 2.5.5 `dashboard:delete`

删除仪表盘。

**参数:**
```typescript
{
  id: string;
}
```

**返回:**
```typescript
{
  success: boolean;
}
```

---

### 2.6 设置相关

#### 2.6.1 `settings:getAll`

获取所有设置。

**参数:** 无

**返回:**
```typescript
{
  // 外观设置
  appearance: {
    theme: 'light' | 'dark' | 'system' | 'high-contrast';
    colorScheme: string;
    accentColor: string;
    uiFont: string;
    uiFontSize: number;
    monospaceFont: string;
    monospaceFontSize: number;
    useSystemFontRendering: boolean;
    fontSmoothing: boolean;
    rememberWindowSize: boolean;
    disableHardwareAcceleration: boolean;
    windowScale: number;
  };

  // 编辑器设置
  editor: {
    showLineNumbers: boolean;
    showWhitespace: boolean;
    wordWrap: boolean;
    showRuler: boolean;
    rulerColumn: number;
    showIndentGuides: boolean;
    indentSize: number;
    tabSize: number;
    insertSpaces: boolean;
    autoSave: boolean;
    autoSaveIntervalSeconds: number;
    formatOnSave: boolean;
    autoCloseBrackets: boolean;
    autoCloseQuotes: boolean;
    autoIndent: boolean;
    formatOnPaste: boolean;
    smartIndent: boolean;
  };

  // SQL 查询设置
  query: {
    executeOnCtrlEnter: boolean;
    autoFocusResult: boolean;
    showExecutionTime: boolean;
    showRowCount: boolean;
    timeoutSeconds: number;
    cancelLongRunning: boolean;
    defaultResultView: 'table' | 'chart' | 'json' | 'plan';
    maxDisplayRows: number;
    showColumnTypes: boolean;
    showColumnNames: boolean;
    alternateRowColors: boolean;
    allowEditResult: boolean;
    datetimeFormat: string;
    numberFormat: string;
    historyEnabled: boolean;
    historyRetentionDays: number;
    historyRecordFailed: boolean;
    historyShowRecent: boolean;
    historyRecentCount: number;
  };

  // 数据导入设置
  import: {
    csvEncoding: string;
    csvDelimiter: string;
    csvTextQualifier: string;
    csvEscapeChar: string;
    csvHeaderRow: boolean;
    csvAutodetectTypes: boolean;
    csvTrimWhitespace: boolean;
    csvSkipEmptyRows: boolean;
    csvSkipNRows: number;
    csvMaxDetectRows: number;
    csvErrorHandling: 'stop' | 'continue_and_log' | 'skip_errors';
    csvSaveErrorLog: boolean;
    csvErrorLogPath: string;
    largeFileThresholdMb: number;
    largeFileStreaming: boolean;
    largeFileShowProgress: boolean;
  };

  // 数据可视化设置
  visualization: {
    defaultChartType: string;
    chartTheme: string;
    colorScheme: string;
    showDataLabels: boolean;
    showLegend: boolean;
    legendPosition: 'right' | 'bottom' | 'top' | 'left';
    showGridLines: boolean;
    enableAnimation: boolean;
    showAxisLabels: boolean;
    autoScaleRange: boolean;
    showUnits: boolean;
    yAxisPosition: 'left' | 'right';
    exportFormat: 'png' | 'jpg' | 'svg' | 'pdf';
    exportDpi: number;
    exportBackground: 'transparent' | 'white' | string;
  };

  // 回收站设置
  trash: {
    defaultRetentionDays: number;
    smallTableThresholdRows: number;
    autoCleanEnabled: boolean;
    autoCleanTime: string;
  };

  // 数据库设置
  database: {
    sqlitePageSize: number;
    sqliteCacheSizeKb: number;
    sqliteLockingMode: 'normal' | 'exclusive' | 'shared-cache';
    sqliteSynchronous: 'off' | 'normal' | 'full' | 'extra';
    sqliteJournalMode: 'DELETE' | 'TRUNCATE' | 'PERSIST' | 'MEMORY' | 'WAL' | 'OFF';
    sqliteForeignKeys: boolean;
    sqliteEnableTriggers: boolean;
    sqliteAutoAnalyze: boolean;
    sqliteAutoVacuum: boolean;
    sqliteAutoVacuumThresholdMb: number;
    sqliteBackupEnabled: boolean;
    sqliteBackupInterval: 'hourly' | 'daily' | 'weekly' | 'monthly';
    sqliteBackupRetentionDays: number;
    sqliteBackupPath: string;
    sqliteBackupCompress: boolean;
    duckdbMaxMemoryPercent: number;
    tempDirectory: string;
    cleanTempOnClose: boolean;
    limitTempSize: boolean;
    maxTempSizeMb: number;
  };

  // 缓存与性能设置
  cache: {
    queryEnabled: boolean;
    queryDefaultTtlSeconds: number;
    maxSizeMb: number;
    maxEntrySizeMb: number;
    evictionPolicy: 'LRU' | 'LFU' | 'FIFO';
    readonlyQueriesOnly: boolean;
    parameterizedQueries: boolean;
    startupLoadRecentWorkspace: boolean;
    startupOpenLastQuery: boolean;
    startupPromptSaveUnsaved: boolean;
    startupPreloadTables: boolean;
  };

  // 安全与隐私设置
  security: {
    blockDangerousQueries: boolean;
    showDangerousWarnings: boolean;
    confirmModifyQueries: boolean;
    enableAuditLog: boolean;
    logExecutionTime: boolean;
    logRetentionDays: number;
    hideSensitiveData: boolean;
    warnOnExportSensitive: boolean;
    noLogSensitiveParams: boolean;
    sensitiveWords: string[];
    autoCheckUpdates: boolean;
    updateChannel: 'stable' | 'beta' | 'nightly';
    verifyUpdateSignature: boolean;
    useHttpsForUpdates: boolean;
  };

  // 高级设置
  advanced: {
    showDeveloperMenu: boolean;
    enableDebugLog: boolean;
    logLevel: 'debug' | 'info' | 'warning' | 'error';
    logPath: string;
    enablePerformanceMonitoring: boolean;
    logQueryPlan: boolean;
    showMemoryUsage: boolean;
    showIoStats: boolean;
    enableExperimentalFeatures: boolean;
    experimentalCollaboration: boolean;
    experimentalAiSuggestions: boolean;
    experimentalDataLineage: boolean;
    experimentalAutoReports: boolean;
  };

  // 键盘快捷键设置
  shortcuts: {
    scheme: string;
    newQuery: string;
    openQuery: string;
    saveQuery: string;
    executeQuery: string;
    stopQuery: string;
    formatQuery: string;
    toggleComment: string;
    find: string;
    replace: string;
    queryHistory: string;
    tableList: string;
    newImport: string;
    exportResult: string;
    toggleTheme: string;
    showSettings: string;
    [key: string]: string;
  };

  // 语言与区域设置
  locale: {
    language: string;
    restartToApply: boolean;
    region: string;
    shortDateFormat: string;
    longDateFormat: string;
    timeFormat: string;
    thousandsSeparator: string;
    decimalSeparator: string;
    currencySymbol: string;
    firstDayOfWeek: string;
    sendUsageData: boolean;
    sendCrashReports: boolean;
  };
}
```

#### 2.6.2 `settings:get`

获取单个或多个设置。

**参数:**
```typescript
{
  keys?: string[]; // 可选，指定要获取的设置键，不指定则获取所有
  prefix?: string; // 可选，按前缀筛选（如 'appearance'）
}
```

**返回:**
```typescript
{
  [key: string]: any;
}
```

#### 2.6.3 `settings:set`

更新单个或多个设置。

**参数:**
```typescript
{
  settings: {
    [key: string]: any;
  };
}
```

**返回:**
```typescript
{
  success: boolean;
  updatedKeys: string[];
}
```

#### 2.6.4 `settings:reset`

重置设置为默认值。

**参数:**
```typescript
{
  keys?: string[]; // 可选，指定要重置的设置键，不指定则重置所有
  prefix?: string; // 可选，按前缀重置（如 'appearance'）
}
```

**返回:**
```typescript
{
  success: boolean;
  resetKeys: string[];
}
```

#### 2.6.5 `settings:export`

导出所有设置为 JSON 文件。

**参数:**
```typescript
{
  filePath?: string; // 可选，不指定则弹出文件保存对话框
}
```

**返回:**
```typescript
{
  success: boolean;
  filePath?: string;
}
```

#### 2.6.6 `settings:import`

从 JSON 文件导入设置。

**参数:**
```typescript
{
  filePath?: string; // 可选，不指定则弹出文件选择对话框
  overrideExisting?: boolean; // 默认 true
}
```

**返回:**
```typescript
{
  success: boolean;
  importedKeys: string[];
}
```

#### 2.6.7 `settings:clearCache`

清除设置缓存（强制从数据库重新读取）。

**参数:** 无

**返回:**
```typescript
{
  success: boolean;
}
```

---

### 2.8 自动化任务相关

#### 2.8.1 `automation:listTasks`

获取所有自动化任务列表。

**参数:**
```typescript
{
  task_type?: "scheduled" | "file_watch" | "manual";
  is_enabled?: boolean;
}
```

**返回:**
```typescript
{
  tasks: AutomationTask[];
  total: number;
}
```

#### 2.8.2 `automation:getTask`

获取单个任务详情。

**参数:**
```typescript
{
  task_id: string;
}
```

**返回:**
```typescript
{
  task: AutomationTask;
}
```

#### 2.8.3 `automation:createTask`

创建新的自动化任务。

**参数:**
```typescript
{
  name: string;
  description?: string;
  task_type: "scheduled" | "file_watch" | "manual";
  trigger_config: any;
  steps_json: any;
  notification_config?: any;
  is_enabled?: boolean;
}
```

**返回:**
```typescript
{
  success: boolean;
  task_id: string;
}
```

#### 2.8.4 `automation:updateTask`

更新现有任务配置。

**参数:**
```typescript
{
  task_id: string;
  updates: Partial<AutomationTask>;
}
```

**返回:**
```typescript
{
  success: boolean;
}
```

#### 2.8.5 `automation:deleteTask`

删除任务。

**参数:**
```typescript
{
  task_id: string;
}
```

**返回:**
```typescript
{
  success: boolean;
}
```

#### 2.8.6 `automation:runTask`

立即手动运行任务。

**参数:**
```typescript
{
  task_id: string;
}
```

**返回:**
```typescript
{
  success: boolean;
  execution_id: string;
}
```

#### 2.8.7 `automation:toggleTask`

启用或禁用任务。

**参数:**
```typescript
{
  task_id: string;
  enabled: boolean;
}
```

**返回:**
```typescript
{
  success: boolean;
}
```

#### 2.8.8 `automation:getExecutionHistory`

获取任务执行历史。

**参数:**
```typescript
{
  task_id: string;
  limit?: number;
  offset?: number;
}
```

**返回:**
```typescript
{
  history: TaskExecutionHistory[];
  total: number;
}
```

#### 2.8.9 `automation:getExecutionDetail`

获取单个执行详情。

**参数:**
```typescript
{
  execution_id: string;
}
```

**返回:**
```typescript
{
  execution: TaskExecutionHistory;
  logs: string[];
}
```

### 2.9 外部数据源相关

#### 2.9.1 `datasource:list`

获取所有外部数据源列表。

**参数:**
```typescript
{
  source_type?: "file" | "database" | "api";
  is_enabled?: boolean;
}
```

**返回:**
```typescript
{
  sources: ExternalDataSource[];
  total: number;
}
```

#### 2.9.2 `datasource:create`

创建新的外部数据源。

**参数:**
```typescript
{
  name: string;
  description?: string;
  source_type: "file" | "database" | "api";
  connection_config: any;
  is_enabled?: boolean;
}
```

**返回:**
```typescript
{
  success: boolean;
  source_id: string;
}
```

#### 2.9.3 `datasource:update`

更新数据源配置。

**参数:**
```typescript
{
  source_id: string;
  updates: Partial<ExternalDataSource>;
}
```

**返回:**
```typescript
{
  success: boolean;
}
```

#### 2.9.4 `datasource:delete`

删除数据源。

**参数:**
```typescript
{
  source_id: string;
}
```

**返回:**
```typescript
{
  success: boolean;
}
```

#### 2.9.5 `datasource:testConnection`

测试数据源连接。

**参数:**
```typescript
{
  source_id: string;
}
```

**返回:**
```typescript
{
  success: boolean;
  message?: string;
}
```

### 2.10 任务模板相关

#### 2.10.1 `template:list`

获取任务模板列表。

**参数:**
```typescript
{
  category?: "data_import" | "reporting" | "dashboard_update" | "custom";
  is_preset?: boolean;
}
```

**返回:**
```typescript
{
  templates: TaskTemplate[];
  total: number;
}
```

#### 2.10.2 `template:createFrom`

从模板创建任务。

**参数:**
```typescript
{
  template_id: string;
  name: string;
  config?: any;
}
```

**返回:**
```typescript
{
  success: boolean;
  task_id: string;
}
```

---

### 2.11 缓存相关

#### 2.11.1 `cache:clear`

清理查询缓存。

**参数:** 无

**返回:**
```typescript
{
  success: boolean;
  clearedCount: number;
}
```

---

<a id="3"></a>
## 3. 数据类型定义

### 3.1 TypeScript 类型

```typescript
// 基础类型
interface QueryResult {
  columns: string[];
  data: any[][];
  executionTimeMs: number;
  rowCount: number;
}

interface QueryHistoryItem {
  id: string;
  sql: string;
  executedAt: string;
  executionTimeMs: number;
  rowCount: number;
  success: boolean;
  isFavorite: boolean;
  tags?: string[];
  notes?: string;
  errorMessage?: string;
}

interface TableInfo {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  rowCount: number;
  columnCount: number;
  createdAt: string;
  updatedAt: string;
  sourceFilePath?: string;
  sourceFileType?: string;
}

interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
}

interface DashboardInfo {
  id: string;
  name: string;
  description?: string;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

// 回收站相关
interface TrashItem {
  id: string;
  original_name: string;
  display_name?: string;
  row_count: number;
  column_count: number;
  source_file_type?: string;
  trashed_at: string;
  trash_expires_at: string;
  trash_file_path?: string;
  strategy: "small" | "large";
  days_remaining: number;
}

interface TrashConfig {
  small_table_threshold_rows: number;
  default_retention_days: number;
  auto_clean_enabled: boolean;
  auto_clean_time: string;
}

// 自动化任务相关
interface AutomationTask {
  id: string;
  name: string;
  description?: string;
  is_enabled: boolean;
  task_type: "scheduled" | "file_watch" | "manual";
  trigger_config: any;
  steps_json: any;
  notification_config?: any;
  last_run_at?: string;
  last_run_status?: "success" | "failed" | "skipped";
  last_run_error?: string;
  next_run_at?: string;
  total_runs: number;
  success_runs: number;
  failed_runs: number;
  avg_execution_time_ms?: number;
  created_at: string;
  updated_at: string;
}

interface TaskExecutionHistory {
  id: string;
  task_id: string;
  task_name: string;
  started_at: string;
  completed_at?: string;
  execution_time_ms?: number;
  status: "pending" | "running" | "success" | "failed" | "skipped" | "cancelled";
  error_message?: string;
  error_stack?: string;
  output_files?: string[];
  output_charts?: any[];
  trigger_type: "schedule" | "manual" | "file_watch";
  triggered_by?: string;
  peak_memory_used_bytes?: number;
  disk_io_bytes_read?: number;
  disk_io_bytes_written?: number;
}

interface ExternalDataSource {
  id: string;
  name: string;
  description?: string;
  source_type: "file" | "database" | "api";
  is_enabled: boolean;
  connection_config: any;
  last_test_at?: string;
  last_test_status?: "success" | "failed";
  last_test_error?: string;
  created_at: string;
  updated_at: string;
}

interface TaskTemplate {
  id: string;
  name: string;
  description?: string;
  category: "data_import" | "reporting" | "dashboard_update" | "custom";
  is_preset: boolean;
  steps_json: any;
  default_config?: any;
  ui_schema?: any;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

// 导入流程状态
type ImportStep = 'select_file' | 'preview' | 'configure' | 'complete';
type FileType = 'csv' | 'excel' | 'json' | 'parquet';
```

### 3.2 Rust 类型

```rust
// src-tauri/src/models/mod.rs
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryResult {
    pub columns: Vec<String>,
    pub data: Vec<Vec<String>>,
    pub execution_time_ms: u64,
    pub row_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryHistoryItem {
    pub id: String,
    pub sql: String,
    pub executed_at: String,
    pub execution_time_ms: Option<u64>,
    pub row_count: Option<usize>,
    pub success: bool,
    pub is_favorite: bool,
    pub tags: Option<Vec<String>>,
    pub notes: Option<String>,
    pub error_message: Option<String>,
}

// ... 其他类型
```

---

<a id="4"></a>
## 4. 错误处理规范

### 4.1 错误格式

```typescript
// 统一错误响应
{
  success: false;
  error: {
    code: string;        // 错误码
    message: string;     // 用户友好信息
    details?: string;    // 技术详情（开发环境显示）
  }
}
```

### 4.2 错误码

| 错误码 | 含义 | HTTP 状态码（类比） |
|-------|------|-------------------|
| `VALIDATION_ERROR` | 输入参数验证失败 | 400 |
| `NOT_FOUND` | 资源不存在 | 404 |
| `FORBIDDEN` | 禁止的操作 | 403 |
| `DATABASE_ERROR` | 数据库错误 | 500 |
| `IMPORT_ERROR` | 导入失败 | 500 |
| `INTERNAL_ERROR` | 内部错误 | 500 |
| `NOT_INITIALIZED` | 工作区未初始化 | 400 |

---

<a id="5"></a>
## 5. 调用示例

### 5.1 前端调用示例 (TypeScript)

```typescript
import { invoke } from '@tauri-apps/api/tauri';
import { queryClient } from './queryClient';

// 1. 执行查询
export async function executeQuery(
  sql: string,
  useCache = true
): Promise<QueryResult> {
  const result = await invoke<{
    success: boolean;
    columns: string[];
    data: any[][];
    executionTimeMs: number;
    rowCount: number;
    error?: string;
  }>('query:execute', { sql, useCache });

  if (!result.success) {
    throw new Error(result.error || '查询失败');
  }

  return {
    columns: result.columns,
    data: result.data,
    executionTimeMs: result.executionTimeMs,
    rowCount: result.rowCount,
  };
}

// 2. 获取查询历史
export async function getQueryHistory(
  limit = 50,
  offset = 0
): Promise<{ items: QueryHistoryItem[]; total: number }> {
  return invoke('query:history', { limit, offset });
}

// 3. 开始导入
export async function startImport(
  fileType: FileType,
  filePath?: string
): Promise<{ importId: string; step: ImportStep }> {
  return invoke('import:start', { fileType, filePath });
}
```

### 5.2 后端实现示例 (Rust)

```rust
// src-tauri/src/commands/query.rs
use crate::state::AppState;
use crate::services::QueryService;
use crate::error::AppError;
use tauri::State;

#[tauri::command]
pub async fn execute(
  sql: String,
  use_cache: Option<bool>,
  state: State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
  let result = QueryService::execute(
    &state,
    &sql,
    use_cache.unwrap_or(true)
  )?;

  Ok(serde_json::json!({
    "success": true,
    "columns": result.columns,
    "data": result.data,
    "executionTimeMs": result.execution_time_ms,
    "rowCount": result.row_count,
  }))
}

#[tauri::command]
pub async fn history(
  limit: Option<u32>,
  offset: Option<u32>,
  state: State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
  let items = QueryService::get_history(
    &state,
    limit.unwrap_or(50),
    offset.unwrap_or(0)
  )?;

  Ok(serde_json::json!({
    "items": items,
    "total": items.len()
  }))
}

// ... 其他命令
```

---

## 总结

本 API 设计方案提供了：
- ✅ 完整的 Tauri 命令定义
- ✅ 类型安全的 TypeScript 与 Rust 类型映射
- ✅ 统一的错误处理规范
- ✅ 详细的调用示例
- ✅ 与前端和后端方案一致的架构


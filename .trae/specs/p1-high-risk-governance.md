# QuickerSQL v8.1 — P1 高风险项治理方案（多角色 SubAgent 分工）

> **版本**: v8.1 Plan
> **生成日期**: 2026-06-20
> **角色**: @架构 Agent（仅输出 SPEC，不修改任何代码文件）
> **范围**: 5 项 P1 高风险项（T39 / T40 / T41 / T62 / T63）

---

## 一、5 项 P1 风险的问题定位与严重度评估

### T39: `open_temporary_connection` 已实现但未被调用
- **位置**: [database/traits.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/database/traits.rs#L231-L245) 已实现，但全局代码搜索 `open_temporary_connection` → 0 处调用
- **问题**: 长 SQL（用户查询 / 自动化任务）与前端短命令争用同一条 Mutex 连接，存在已知的"长查询阻塞 UI"风险
- **严重度**: **高**（一旦用户执行 3 秒以上查询，整个 UI 冻结直到完成）
- **根因**: 调度器用 `get_connection()` 拿主连接；`commands/sql.rs` 也用主连接；没有路径让长 SQL 走独立连接

### T40: commands 层直接拼接 SQL（违反分层架构 + 安全风险）
- **位置**: [commands/database.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/commands/database.rs)（27 处 `format!` + `conn.execute/query`，涉及 DROP TABLE / ALTER TABLE / CREATE VIEW / PRAGMA / SELECT COUNT）+ [commands/file.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/commands/file.rs)（30+ 处 `format!` + `conn.execute/query` 拼接 DDL）
- **问题**: 架构约定 commands 仅做 "参数解析 + 调用 Service"，但这两个文件直接实现数据库 DDL/DQL
- **严重度**: **高**（`format!("DROP TABLE IF EXISTS {}", quoted_table_name)` 虽然用了 SqlIdentifier，但 `quoted_table_name` 进入 format! 属于标识符拼接；CREATE TABLE 的列定义动态拼接，难以审计）；同时违反分层架构

### T41: 前端 `any` 类型泛滥（~30 处）
- **位置**: `components/chart/ChartRenderer.tsx` (3 处)、`components/chart/ChartPanel.tsx` (5 处)、`components/common/Toolbar.tsx` (10+ 处)、`store/queryStore.ts`、`store/workspaceStore.ts`、`components/sql/hooks/useQueryCopy.ts` (7 处)、`components/import/DataImport.tsx`
- **问题**: 失去类型检查；重构时易出错；违反 coding.md 命名与类型安全约定
- **严重度**: **中~高**（类型安全缺失 = 潜在运行时错误）

### T62: `dashboardStore.refreshCharts` no-op 反模式
- **位置**: [store/dashboardStore.ts](file:///e:/LA_DUCK/la-duck/src/store/dashboardStore.ts) 中 `refreshCharts: () => set((state) => ({ ...state }))`
- **问题**: 无意义深拷贝，强制触发所有订阅组件重渲染；语义上"刷新"应该是重新拉取图表数据
- **严重度**: **中**（性能浪费 + 语义误导）

### T63: `store/index.ts` 未导出 `useTaskStore` / `useToastStore`
- **位置**: [store/index.ts](file:///e:/LA_DUCK/la-duck/src/store/index.ts)（只导出 7 个 stores，缺 taskStore 和 toastStore）
- **问题**: 其他文件不得不 `import { useTaskStore } from '../store/taskStore'` 绕过统一入口；新开发者会从 index.ts 找不到 taskStore
- **严重度**: **中**（统一入口缺失 = 维护成本）

---

## 二、总体策略

```
┌────────────────────────────────────────────────────────────────────────────┐
│  阶段 1: @后端 Agent — 把 commands 层的 SQL 下沉到 DatabaseService          │
│    (T39 + T40: 建立长 SQL 隔离路径 + 把 DDL 移到 Service 层统一参数化)       │
├────────────────────────────────────────────────────────────────────────────┤
│  阶段 2: @前端 Agent — 类型治理 + 状态逻辑修复                              │
│    (T41 + T62 + T63: 消除 any + 修复 refreshCharts 语义 + 补全 index.ts 导出)│
└────────────────────────────────────────────────────────────────────────────┘
```

**为什么这样分工？**
- T39 和 T40 都是后端 Rust 分层架构问题，由同一个子任务执行效率最高（因为 DatabaseService 需要新增方法，commands 层需要把 SQL 调用替换为 Service 调用）
- T41/T62/T63 都是前端 TypeScript 状态/类型问题，集中由前端 Agent 一次性解决

**不涉及的 Tier-1 文件**：`tauri.conf.json`、`capabilities/default.json`、`Cargo.toml`（无新增命令/依赖）→ 无文件锁冲突风险

**可能涉及的 Tier-1 文件**：`src-tauri/src/lib.rs`（如果 DatabaseService 需要新的命令注册，则追加命令；当前评估：现有命令入口不动，只改内部实现）

---

## 三、角色任务详细分配（@后端 Agent）

### 角色: @后端 Agent
**允许目录**: `src-tauri/src/services/`、`src-tauri/src/commands/`、`src-tauri/src/database/`、`src-tauri/src/models/`、`src-tauri/src/utils/`

**禁止目录**: `src/`、`tauri.conf.json`、`capabilities/default.json`、`Cargo.toml`

**必须遵守**: security.md（参数化查询）、coding.md（snake_case + 错误处理）、file-lock.md

**子任务清单**:

---

#### 任务 B-1: `DatabaseService` 新增表管理方法集（对应 T40 — 把 commands/database.rs 的 SQL 下沉）

**目标**: `commands/database.rs` 只做参数解析 + 调用 `DatabaseService::xxx`，不再出现 `conn.execute(format!(...))`

**新增方法（全部写在 `services/database_service.rs`）**:

| 新方法 | 替换原 commands 中的 SQL | 参数化方式 |
|--------|------------------------|-----------|
| `get_row_count(conn, table_name) -> Result<i64, String>` | `get_database_status` 中的 `format!("SELECT COUNT(*) FROM \"{}\"", table)` | `table_name` 经 `SqlIdentifier::new()` 校验 + `quote_identifier()` 输出；SQL 固定文本 `SELECT COUNT(*) FROM ?` 不可行 → 用安全标识符拼接 |
| `list_tables_with_row_count(conn) -> Result<Vec<TableInfo>, String>` | `get_database_status` 的 for 循环（逐表 COUNT） | 同上；循环内每次调用 `get_row_count` |
| `get_table_column_count(conn, table_name) -> Result<i64, String>` | `list_tables` 中的 `PRAGMA table_info(...)` | `table_name` 经 `SqlIdentifier`；`PRAGMA table_info(quoted_name)` 用安全标识符 |
| `get_table_meta(conn, table_name) -> Result<TableMeta, String>` | `get_table_meta` 命令中的 `PRAGMA table_info` / `PRAGMA index_list` | 同上 |
| `drop_table_safe(conn, table_name) -> Result<(String, i64), String>` | `delete_table` 中的 `DROP TABLE` + `SELECT COUNT(*)` | `table_name` 经 `SqlIdentifier::new()` + `is_system_table()` 检查后拒绝系统表；返回 (table_name, row_count) |
| `rename_table_safe(conn, old_name, new_name) -> Result<(), String>` | `rename_table` 中的 `ALTER TABLE ... RENAME TO ...` | old/new 分别经 `SqlIdentifier`；检查 old 存在 + new 不存在 |
| `create_view(conn, view_name, source_sql) -> Result<(), String>` | `rename_table` 中的 `CREATE VIEW` 备份 | view_name 经 `SqlIdentifier`；source_sql 作为参数绑定 |

**安全检查**: 以上所有方法在进入 DDL 前必须调用:
```rust
let safe = SqlIdentifier::new(table_name)?;  // 非法字符 / 系统表检查
let quoted = safe.quote_identifier();         // 加引号的安全标识符
```
**禁止直接**: `format!("DROP TABLE {}", table_name)` — 必须走 `quote_identifier()`。

**然后**: `commands/database.rs` 中每个命令替换为调用上述 `DatabaseService::xxx(conn, ...)` 方法，command 函数只做参数校验 + 错误包装为 `ApiResponse<T>`。

**交付物**:
- 修改 `services/database_service.rs`：新增 7 个方法（含完整 JSDoc / Rust doc comment）
- 修改 `commands/database.rs`：所有 `conn.execute(format!())` 替换为 `DatabaseService::xxx()`
- `cargo check` 0 errors

---

#### 任务 B-2: `DatabaseService` 新增文件导入 DDL 方法（对应 T40 — file.rs SQL 下沉）

**目标**: `commands/file.rs` 不再直接执行 CREATE TABLE / DROP TABLE / INSERT BATCH

**新增方法**:

| 新方法 | 替换 | 关键点 |
|--------|------|--------|
| `drop_table_if_exists(conn, table_name) -> Result<(), String>` | `file.rs` 的 `DROP TABLE IF EXISTS` | SqlIdentifier 校验 |
| `create_table_from_schema(conn, table_name, columns: Vec<(String, String)>) -> Result<(), String>` | `file.rs` 的 `CREATE TABLE ... (...)` | column 名逐字段 SqlIdentifier；type 白名单 (TEXT/INTEGER/REAL/BLOB) |
| `batch_insert_rows(conn, table_name, columns: &[String], rows: &[Vec<String>]) -> Result<usize, String>` | `file.rs` 的批量 INSERT | 表名 + 列名经 SqlIdentifier；数据值通过 `?` 参数绑定 |

**然后**: `commands/file.rs` 的 `import_data` / `import_data_v2` 重写为:
1. 校验 table_name → `SqlIdentifier::new()`
2. 校验 file 大小（保持不变）
3. 调用 `DatabaseService::drop_table_if_exists` / `create_table_from_schema` / `batch_insert_rows`

**交付物**:
- 修改 `services/database_service.rs`：新增上述 3 个方法
- 修改 `commands/file.rs`：SQL 操作全部替换为 Service 调用
- `cargo check` 0 errors

---

#### 任务 B-3: 长 SQL 走独立连接（对应 T39 — 激活 open_temporary_connection）

**目标**: `execute_sql` 命令和 `TaskService::execute` 中的 SQL 分支不再持有全局连接，改走独立临时连接

**改动点**:

1. **`commands/sql.rs::execute_sql`**:
   - 替换 `let conn = state.db_manager.get_connection()?;`
   - 改为 `let mut temp_conn = state.db_manager.open_temporary_connection()?;`
   - SQL 执行在 `temp_conn` 上进行
   - 函数退出时 `temp_conn` 自动 drop（RAII）

2. **`services/task_service.rs::execute` 的 sql 分支**:
   - 替换 `let conn = state.db_manager.get_connection()?;`（当前实现）
   - 需要把 `db_manager` 作为参数传入 `execute`（或者把 execute 的签名调整为接收 `&DatabaseManager` 而非 `MutexGuardConnection`）
   - **更优方案**: 把 `execute` 签名从 `execute(conn: &MutexGuardConnection, task_id, trigger_type)` 改为 `execute(db: &DatabaseManager, task_id, trigger_type, use_temp_conn: bool)`，内部根据 task_type 判断是否需要临时连接
   - SQL 任务 (`task_type == "sql"`) → `open_temporary_connection()` + 执行
   - 其他任务（refresh_chart 等短操作）→ 继续 `get_connection()`（短命令，不值得新开连接）

3. **调度器循环**:
   - 当前: `scheduler_do_one_pass` 中 `get_connection()` → 扫描任务 → 逐个 `drop(conn)` → `get_connection()` → execute → drop
   - 问题: 扫描时拿的是主连接，但 execute 内部如果再去拿 `open_temporary_connection` 是没问题的（它不依赖 Mutex 锁）
   - 调整: 保持现状，但在 sql 分支强制用临时连接

**风险控制**:
- `open_temporary_connection` 在无连接时会报错（"尚未建立连接"），此为正常行为，在前端提示"请先选择/打开数据库"
- 临时连接是独立的，无法看到其他连接上的未提交事务（本项目 auto-commit，无问题）

**交付物**:
- 修改 `commands/sql.rs`：使用 `open_temporary_connection()`
- 修改 `services/task_service.rs`：重写 `execute` 签名 + 内部 SQL 分支用临时连接
- `cargo check` 0 errors

---

#### 任务 B-4: 编译 + 回归检查（所有 P1 风险修改后的门禁）

- `cargo check` → 0 errors
- `cargo test` → 0 failing（含 database/tests.rs）
- 人工核查: `grep -rn 'format!("' --include='*.rs' src-tauri/src/commands | grep -i 'select\|insert\|update\|delete\|create\|drop\|alter'` → **应返回 0**

---

## 四、角色任务详细分配（@前端 Agent）

### 角色: @前端 Agent
**允许目录**: `src/components/`、`src/store/`、`src/services/`、`src/types/`、`src/utils/`、`src/styles/`

**禁止目录**: `src-tauri/`、`package.json`（除非确实需要 echarts 类型定义 — 见下评估）

**必须遵守**: coding.md（camelCase + 类型安全）、security.md（前端禁拼接 SQL）

**子任务清单**:

---

#### 任务 F-1: `store/index.ts` 补全导出（T63 — 低复杂度优先）

**目标**: 从统一入口能拿到全部 stores

**改动**: [store/index.ts](file:///e:/LA_DUCK/la-duck/src/store/index.ts)

```typescript
export { useAppStore } from './appStore';
export { useProjectStore } from './projectStore';
export { useImportStore } from './importStore';
export { useQueryStore } from './queryStore';
export { useWorkspaceStore, SIDEBAR_MIN_WIDTH, SIDEBAR_DEFAULT_WIDTH, SIDEBAR_MAX_WIDTH } from './workspaceStore';
export { useSettingsStore } from './settingsStore';
export { useDashboardStore } from './dashboardStore';
// 新增:
export { useTaskStore } from './taskStore';
export { useToastStore } from './toastStore';
```

**交付物**: 修改 index.ts 1 文件；`tsc --noEmit` 0 errors

---

#### 任务 F-2: `dashboardStore.refreshCharts` 改为有意义实现（T62）

**目标**: `refreshCharts()` 真正触发图表数据刷新，而非无意义深拷贝

**改动思路**:
- 方案 A（推荐）: 改为 `set((state) => ({ refreshChartsVersion: state.refreshChartsVersion + 1 }))` — 新增一个递增版本号，DashboardItem.tsx useEffect 订阅此版本号触发重绘 / 重新查询
- 方案 B: 改为重新调用 `loadSavedCharts()` 拉取最新图表配置（更简单，但网络开销略大）

**选择方案 A**（更轻量，且语义清晰）:
1. 在 `DashboardStore` interface 中新增 `refreshChartsVersion: number;`
2. `refreshCharts: () => set((state) => ({ refreshChartsVersion: state.refreshChartsVersion + 1 }))`
3. `DashboardItem.tsx` 的 useEffect 依赖中添加 `[..., dashboardStoreState.refreshChartsVersion]`（如果 DashboardItem 读取此 store）

**交付物**:
- 修改 `store/dashboardStore.ts`：删除 no-op 实现，替换为版本号方案
- 修改 `components/dashboard/DashboardItem.tsx`（若它依赖此 store 的图表配置）：添加 version 到 useEffect deps
- `tsc --noEmit` 0 errors

---

#### 任务 F-3: `any` 类型治理（T41 — 分批次替换）

**目标**: 所有显式 `: any` → 替换为具体类型

**策略**: 分 3 类场景，每类独立处理：

| 类别 | 文件 | 当前写法 | 替换为 |
|------|------|---------|--------|
| **图表配置对象** | `components/chart/ChartRenderer.tsx` | `config: any`、`echartsConfig: any` | `echarts.EChartsOption`（echarts 自带类型） |
| **getOption 返回值** | `components/chart/ChartPanel.tsx` | `option: any` + xAxis/yAxis/legend 遍历时 `x: any` | `Partial<echarts.EChartsOption>` + 内部 typed |
| **查询结果 / 行数据** | `components/sql/hooks/useQueryCopy.ts` | `rowData?: any` / `cellValue?: any` / `r: any` / `v: any` | `type QueryRow = Record<string, string | number | boolean | null>` + `cellValue: unknown` 配合类型断言 |
| **查询历史 / Tab 状态** | `components/common/Toolbar.tsx` | `s: any`、`q: any`、`result: any` | 从 `types/index.ts` 中 `QueryHistoryItem` + `SqlStatementResult` 复用 |
| **Excel Sheet 元数据** | `components/import/DataImport.tsx`、`Toolbar.tsx` | `s: any` | `type SheetInfo = { name: string }`（从 models 同步） |
| **Store 内部工具函数** | `store/workspaceStore.ts`、`store/queryStore.ts` | `tabsFromBackendFormat(tabs: any[])`、`batchResults: any[]` | 定义 `BackendWorkspaceTab` / `BackendWorkspacePanel` 类型；`batchResults: QueryResultItem[]` |

**新增类型文件建议**（统一管理复杂类型）:
- `types/chart.ts`：图表相关类型（`ChartConfig` 等，来自 dashboard 已有类型复用）
- 不需新建文件，优先复用 `types/dashboard.ts` 中的 `SavedChart`、`types/index.ts` 中的 `SqlStatementResult`

**echarts 类型注意**:
- `import * as echarts from 'echarts'` 已存在
- `echarts.EChartsOption` 是官方类型，开箱即用
- `echarts.ECharts` 是实例类型

**交付物**:
- 修改 ~8 个文件（见上表），替换所有 `: any`
- `tsc --noEmit` 0 errors
- `grep -n ': any\b' --include='*.tsx' --include='*.ts' src/` → 应返回 0 条

---

## 五、执行顺序与文件锁协调

### 执行顺序（串行，避免冲突）

```
1. @后端 B-1: DatabaseService 表管理方法集
2. @后端 B-2: DatabaseService 文件导入 DDL 方法
3. @后端 B-3: 长 SQL 临时连接改造
4. @后端 B-4: 编译 + 回归检查
5. @前端 F-1: store/index.ts 补全导出
6. @前端 F-2: dashboardStore.refreshCharts 修复
7. @前端 F-3: any 类型治理
8. @前端 最终 tsc --noEmit 验证
```

### 文件锁声明

| 会修改的文件 | 角色 | 冲突风险 |
|------------|------|---------|
| `src-tauri/src/services/database_service.rs` | @后端 | 🟡 中（仅后端子任务） |
| `src-tauri/src/commands/database.rs` | @后端 | 🟡 中 |
| `src-tauri/src/commands/file.rs` | @后端 | 🟡 中 |
| `src-tauri/src/commands/sql.rs` | @后端 | 🟡 中 |
| `src-tauri/src/services/task_service.rs` | @后端 | 🟡 中 |
| `src/store/index.ts` | @前端 | 🟢 低（仅 2 行追加） |
| `src/store/dashboardStore.ts` | @前端 | 🟡 中 |
| `src/components/dashboard/DashboardItem.tsx` | @前端 | 🟡 中 |
| `src/components/chart/ChartRenderer.tsx` | @前端 | 🟡 中 |
| `src/components/chart/ChartPanel.tsx` | @前端 | 🟡 中 |
| `src/components/common/Toolbar.tsx` | @前端 | 🟡 中 |
| `src/components/sql/hooks/useQueryCopy.ts` | @前端 | 🟡 中 |
| `src/components/import/DataImport.tsx` | @前端 | 🟡 中 |
| `src/store/workspaceStore.ts` | @前端 | 🟡 中 |
| `src/store/queryStore.ts` | @前端 | 🟡 中 |

**协调策略**:
- **阶段 1 与阶段 2 串行执行**（后端全部完成后再进入前端）→ 无跨角色文件冲突
- **阶段 1 内部**: B-1/B-2 都修改 `database_service.rs`，须串行；B-3 修改 `task_service.rs`（独立文件），可与 B-2 并行但建议串行以确保 B-2 的 DatabaseService 方法对 B-3 可见
- **阶段 2 内部**: F-1 独立低风险；F-2 修改 store+dashboardItem；F-3 跨多个文件但互无冲突 → 建议按 F-1 → F-2 → F-3 顺序

---

## 六、对 architecture.md / security.md 的同步更新

**更新 `security.md`**（@架构 完成代码修改后同步）:
- 在"参数化查询唯一合法路径模板"中新增: **DDL（CREATE TABLE / DROP TABLE / ALTER TABLE）也必须经 DatabaseService 层**，禁止 commands 层直接 `conn.execute(format!(...))`
- 新增 grep 门禁命令: `grep -rn 'format!("' --include='*.rs' src-tauri/src/commands | grep -i 'select\|insert\|update\|delete\|create\|drop\|alter'` → 0 条

**更新 `architecture.md`**（@架构 同步）:
- 在"分层架构约束"章节中补充示例: `commands/file.rs::import_data → DatabaseService::create_table_from_schema` 展示正确调用链

---

## 七、修改完成后的强制验证清单

每项任务执行完毕后，必须:

| 验证项 | 命令 / 检查方式 | 期望结果 |
|--------|----------------|---------|
| 后端编译 | `cd src-tauri && cargo check` | 0 errors |
| 前端类型检查 | `npx tsc --noEmit` | 0 errors |
| commands 层 SQL 门禁 | `grep -rn 'format!("' --include='*.rs' src-tauri/src/commands \| grep -iE 'select\|insert\|update\|delete\|create\|drop\|alter'` | 0 条结果 |
| `any` 类型门禁 | `grep -rn ': any\b' --include='*.ts' --include='*.tsx' src/` | 0 条结果 |
| no-op 门禁 | `grep -n 'set((state) => ({ \.\.\.state }))' src/store/*.ts` | 0 条结果 |
| stores 导出完整 | `grep -n 'useTaskStore\|useToastStore' src/store/index.ts` | 均存在 |
| `open_temporary_connection` 已被调用 | `grep -rn 'open_temporary_connection' src-tauri/src/` | ≥ 2 处（sql.rs + task_service.rs） |

---

## 八、下一步

- 本 SPEC 经用户确认后，**由 @架构 Agent（或主 Agent）驱动** 按第五章顺序发起子任务
- 阶段 1（B-1~B-4）完成后输出《架构合规性报告 - 后端部分》
- 阶段 2（F-1~F-3）完成后输出《架构合规性报告 - 前端部分》
- 全部完成后更新 [docs/架构现状.md](file:///e:/LA_DUCK/la-duck/docs/架构现状.md) 的 v8.1 章节

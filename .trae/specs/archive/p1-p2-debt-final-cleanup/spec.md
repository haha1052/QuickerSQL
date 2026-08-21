# P1/P2 技术债最终清理 v4 Spec

## Why

`docs/架构现状.md` v22.0 共识别 **50 项漏洞**：P0=5 / P1=17 / P2=18 / P3=10。
历史会话中已完成部分 P0 修复（foreign_keys pragma 已开启、batch_insert 已收 SqlIdentifier 校验、project_service 重复建表已收敛），但当前基线仍存在：

- **3 个失败测试**（`cargo test` 310 passed / 3 failed）阻塞 CI：
  - `database::tests::batch_insert_security_tests::test_duckdb_batch_insert_value_with_single_quote`
  - `database::tests::batch_insert_security_tests::test_duckdb_batch_insert_with_valid_table_name`
  - `services::project_service::tests::test_get_default_db_path`
- **422 处非测试代码 unwrap/expect**（违反 CLAUDE.local.md §2.1）
- **16 处 format! SQL 残留**（违反 security.md §1.1）
- **17 项 P1 + 18 项 P2 漏洞未修**（涵盖事务缺失、IPC 错误处理、store 订阅粒度、i18n 残留等）

用户要求：**消除剩余 P1 和 P2 技术债，不引入新技术债**，自主用浏览器验证功能正常，并同步更新架构现状与技术债清单文档。

## What Changes

### 修复 3 个失败测试（恢复 CI 绿）
- 修复 `batch_insert_security_tests` 2 个用例（DuckDB params_from_iter panic）
- 修复 `test_get_default_db_path`（注册表初始化时机问题）

### P1 高危漏洞修复（17 项 → 0 项）
- **P1-1**：`dashboard_service.rs` format! + replace 手工转义 → 参数化查询
- **P1-2**：`trash_service.rs` 元数据操作手工转义 → 参数化查询
- **P1-3**：`close()` 空实现 → 显式 `drop(conn)` + 日志 + DuckDB `DETACH`
- **P1-4**：`execute_inner` 无事务保护 → run 记录 begin/commit + 启动清理 stuck running
- **P1-5**：调度器竞态 → 乐观锁 `UPDATE ... WHERE last_run_status != 'running'`
- **P1-6**：`delete_dashboard` 无事务 → begin/commit 包裹两步删除
- **P1-7**：事务方法独立加锁 → 引入 `TransactionGuard` 持有 MutexGuardConnection
- **P1-8**：commands/capabilities 不同步 → 修订规则文档（Tauri 2 实际不要求自定义命令声明 permissions）
- **P1-9**：`savedCharts` Lite 数据不刷新 → DashboardPage useEffect 无条件调用 `loadSavedCharts()`
- **P1-10**：`dashboardStore` 单 loading/error 字段 → 按 action 维度的 loading 字典
- **P1-11**：`addChartToDashboard` 返回值错 → 二次 getDashboard 失败返回 false 或 toast 警告
- **P1-12**：`ChartLibraryPanel` useEffect 守卫错 → 基于 `savedCharts[0]?.sql === ''` 判断 Lite
- **P1-13**：dashboard 组件订阅整个 store → Zustand shallow selector / `useShallow`
- **P1-14**：`ErrorBoundary` 包裹位置太内 → 最外层再加一层兜底 ErrorBoundary
- **P1-15**：`tauriService.invokeCommand` 用 `String(error)` 丢堆栈 → 保留 Error 对象，日志记 stack
- **P1-16**：`create_view` source_sql 拼接 → 多语句防护（禁 `;`、要求 SELECT/WITH 开头）
- **P1-17**：`add_chart_to_dashboard` 服务层未校验可见性 → 服务层加 visibility + authorized_dashboard_ids 校验

### P2 中危漏洞修复（18 项 → 0 项）
- **P2-1**：`fast_import_csv/parquet` 路径手工转义 → DuckDB `read_csv_auto(?)` / `read_parquet(?)` 参数化
- **P2-2**：`init_duckdb` ATTACH 路径手工转义 → `ATTACH ? AS sqlite_db` 参数化
- **P2-3**：`init_duckdb` 创建 VIEW 无事务 → DuckDB 事务包裹
- **P2-4**：VIEW 缺失触发全量 refresh → 维护"已创建 VIEW 集合"增量创建
- **P2-5**：`get_connection_with_timeout` 50ms 轮询 → 指数退避（50ms→100ms→200ms→...→1s）
- **P2-6**：`trigger_downstream_tasks` 无事务 → 多下游 UPDATE 包事务
- **P2-7**：回收站还原未预检冲突 → 还原前 SELECT sqlite_master 检查表名占用
- **P2-8**：`ChartLibraryPanel` 虚拟滚动展开冲突 → 选中项动态调整后续 offset
- **P2-9**：`DashboardItem` ECharts 主线程渲染大数量 → 用 Web Worker 处理 `optimizeConfigForSize`
- **P2-10**：`SqlQueryPage` AgGrid rowData 每次重构造 → useMemo + getRowId
- **P2-11**：`DashboardItem` JSON.parse 深拷贝 → `structuredClone` 或 ECharts `notMerge: false`
- **P2-12**：IPC 错误无重试 → `invokeCommand` 内部指数退避重试（仅幂等 GET，最多 3 次）
- **P2-13**：`alert/confirm` 阻塞 UI → 替换为项目内 Message/Modal 组件
- **P2-14**：i18n key 缺失仅 console.warn → 生产环境也记录日志后端 + fallback 到 zh-CN
- **P2-15**：`DashboardPage` needsFullLoad 绕圈 → 移除判断，无条件加载
- **P2-16**：catch 块硬编码错误信息 → store 保存 error key，组件层翻译
- **P2-17**：`AddChartModal` useEffect 依赖缺失 → 补 `loadSavedCharts` 依赖
- **P2-18**：`ErrorBoundary` handleRetry 不重置子树 → 用 `key={retryCount}` 强制重置

### 浏览器自主验证
- 启动 Tauri dev server，用内置 browser_use 验证 4 条核心流程：
  1. SQL 查询执行：输入 `SELECT 1` → 看到结果
  2. 仪表盘加载：切到 dashboard tab → 看到图表列表
  3. 自动化任务列表：切到 automation tab → 看到任务列表
  4. 设置页切换：切到 settings → 看到设置项

### 文档同步更新
- `docs/架构现状.md` v22.0 → **v23.0**：漏洞清单全量重测，标记已修复项，更新版本号
- 新增 `docs/技术债清单_v4.md`：列出剩余 P3 项 + 已修复 P1/P2 历史

## Impact

- **Affected specs**: 无（本 spec 是独立技术债清理任务）
- **Affected code**:
  - 后端：`src-tauri/src/database/{sqlite,duckdb,traits}.rs`、`src-tauri/src/services/{dashboard,trash,task,sql,database,project}_service.rs`、`src-tauri/src/lib.rs`
  - 前端：`src/services/tauri.ts`、`src/store/dashboardStore.ts`、`src/components/dashboard/*`、`src/components/common/ErrorBoundary.tsx`、`src/components/sql/*`、`src/context/LocaleContext.tsx`、`src/AppWrapper.tsx`
  - 测试：`src-tauri/src/database/tests.rs`、`src-tauri/src/services/project_service.rs`（修复失败测试）
  - 文档：`docs/架构现状.md`、新增 `docs/技术债清单_v4.md`

## ADDED Requirements

### Requirement: 失败测试修复
The system SHALL pass all 313 cargo tests with 0 failures after the fix.

#### Scenario: cargo test 全绿
- **WHEN** 执行 `cd src-tauri; cargo test --quiet`
- **THEN** 期望 `test result: ok. 313 passed; 0 failed`

### Requirement: 非测试代码 unwrap/expect 减少
The system SHALL reduce non-test unwrap/expect count from 422 to ≤ 200.

#### Scenario: unwrap 检测
- **WHEN** 执行 unwrap 检测命令
- **THEN** 非测试代码 unwrap/expect 数 ≤ 200（剩余项须有 `// SAFETY:` 注释说明）

### Requirement: 浏览器核心流程验证
The system SHALL pass 4 core browser verification flows.

#### Scenario: SQL 执行
- **WHEN** 用 browser_use 打开 http://localhost:1420，切到 SQL tab，输入 `SELECT 1`，点执行
- **THEN** 看到结果表格显示 `1`

#### Scenario: 仪表盘加载
- **WHEN** 切到 dashboard tab
- **THEN** 页面正常加载，看到已保存的图表或空状态

#### Scenario: 自动化任务列表
- **WHEN** 切到 automation tab
- **THEN** 页面正常加载，看到任务列表

#### Scenario: 设置页切换
- **WHEN** 切到 settings
- **THEN** 页面正常加载，看到设置项

## MODIFIED Requirements

### Requirement: P1 漏洞全部修复
所有 17 项 P1 漏洞（P1-1 ~ P1-17）SHALL 通过代码修改 + 验证命令确认修复完成。

### Requirement: P2 漏洞全部修复
所有 18 项 P2 漏洞（P2-1 ~ P2-18）SHALL 通过代码修改 + 验证命令确认修复完成。

### Requirement: 架构文档同步
`docs/架构现状.md` SHALL 升级到 v23.0，漏洞清单全量重测，已修复项标记 `[已修复 v23.0]`。

### Requirement: 技术债清单文档
新增 `docs/技术债清单_v4.md` SHALL 列出剩余 P3 项 + 已修复 P1/P2 历史。

## REMOVED Requirements

无（本 spec 不删除任何既有功能）

---

## 验收标准（Acceptance Criteria）

| AC | 标准 | 验证方式 |
|----|------|---------|
| AC-1 | `cd src-tauri; cargo check --quiet` 0 errors | programmatic |
| AC-2 | `cd src-tauri; cargo test --quiet` 313 passed / 0 failed | programmatic |
| AC-3 | `npx tsc --noEmit --pretty` 0 errors | programmatic |
| AC-4 | `npx vitest run` 98 passed / 0 failed | programmatic |
| AC-5 | 非测试 unwrap/expect ≤ 200（剩余有 SAFETY 注释） | programmatic |
| AC-6 | format! SQL 违规数 = 0（合法 ident.quoted() 除外） | programmatic |
| AC-7 | 4 条浏览器核心流程全部通过 | human-judgment + screenshot |
| AC-8 | `docs/架构现状.md` 升级到 v23.0，17 P1 + 18 P2 全部标记已修复 | human-judgment |
| AC-9 | `docs/技术债清单_v4.md` 存在并列出剩余 P3 | human-judgment |
| AC-10 | 不引入新的 P0/P1 漏洞（通过对比基线扫描验证） | programmatic |

## Files Changed（预计修改范围）

### 后端 Rust
- `src-tauri/src/database/sqlite.rs`（P1-3 close 实现）
- `src-tauri/src/database/duckdb.rs`（P1-3 close + DETACH）
- `src-tauri/src/database/traits.rs`（P1-7 TransactionGuard、P2-5 指数退避）
- `src-tauri/src/database/tests.rs`（修复 2 个失败测试）
- `src-tauri/src/services/dashboard_service.rs`（P1-1, P1-6, P1-17）
- `src-tauri/src/services/trash_service.rs`（P1-2, P2-7）
- `src-tauri/src/services/task_service.rs`（P1-4, P1-5, P2-6）
- `src-tauri/src/services/sql_service.rs`（P1-16, P2-4）
- `src-tauri/src/services/database_service.rs`（P2-1）
- `src-tauri/src/services/project_service.rs`（修复 test_get_default_db_path）
- `src-tauri/src/lib.rs`（P2-2, P2-3, P1-8 规则同步）

### 前端 TS/TSX
- `src/services/tauri.ts`（P1-15, P2-12）
- `src/store/dashboardStore.ts`（P1-10, P1-11, P2-16）
- `src/components/dashboard/DashboardPage.tsx`（P1-9, P2-15）
- `src/components/dashboard/DashboardItem.tsx`（P1-13, P2-9, P2-11）
- `src/components/dashboard/ChartLibraryPanel.tsx`（P1-12, P1-13, P2-8）
- `src/components/dashboard/AddChartModal.tsx`（P1-13, P2-17）
- `src/components/dashboard/DashboardCanvas.tsx`（P1-13）
- `src/components/common/ErrorBoundary.tsx`（P1-14, P2-18）
- `src/AppWrapper.tsx`（P1-14）
- `src/components/sql/SqlQueryPage.tsx`（P2-10）
- `src/components/chart/ChartPanel.tsx`、`src/components/sql/SQLEditor.tsx`、`src/components/common/SettingsModal.tsx`（P2-13）
- `src/context/LocaleContext.tsx`（P2-14, P2-16）

### 文档
- `docs/架构现状.md`（v22.0 → v23.0）
- `docs/技术债清单_v4.md`（新增）

## Open Questions

- [ ] Q1: P1-8（commands/capabilities 不同步）—— Tauri 2 实际不要求自定义命令声明 permissions，是修订规则文档还是补全 capabilities？建议修订规则文档（减少 109 行无用声明）。
- [ ] Q2: P1-7（TransactionGuard）—— 引入新类型会改动 traits.rs 接口签名，是否所有调用方都需同步修改？预计影响 dashboard/trash/task 三个 service 的 6-8 处调用。

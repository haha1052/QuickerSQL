# QuickerSQL 代码规范 v10.0

> 优先级：高（仅次于 security.md / architecture.md）
> 适用：Rust 与 TS 两部分代码；子 Agent 在任何"代码生成/修改"任务中必须遵循本文件。
> 版本：**v11.0**（2026-06-22，与 AGENTS.md 同步；新增 MCP 工具验证命令，异常处理/命名规范可程序化验证）。版本变更记录仅在 [AGENTS.md](file:///e:/LA_DUCK/la-duck/AGENTS.md) 中维护。

---

## 一、命名规范

### 1.1 后端 Rust

| 类型 | 规则 | 正确示例 | 错误示例 |
|------|------|---------|---------|
| 目录名 | `snake_case` | `services/`、`task_service.rs` | `TaskService/`、`taskService.rs` |
| 结构体 / 枚举 | `PascalCase` | `SavedChart`、`TaskRun` | `savedChart`、`saved_chart` |
| 函数 / 方法 | `snake_case` | `create_task()`、`list_tasks()` | `createTask()`、`CreateTask()` |
| 常量 | `SCREAMING_SNAKE_CASE` | `MAX_TASK_NAME_LEN` | `maxTaskNameLen` |
| 变量 / 参数 | `snake_case` | `task_id`、`query_params` | `taskId`（但 serde rename 除外） |
| 特征 (trait) | `PascalCase`（动词/形容词） | `DatabaseConnection`、`Runnable` | — |

**serde 字段映射强制：**
- Rust 字段写 `snake_case`，加 `#[serde(rename = "camelCase")]` 对齐前端
- 禁止直接写 `taskId: String` 省略 rename
- 反向：`#[serde(rename_all = "camelCase")]` 可整 struct 声明，优先使用

### 1.2 前端 TS

| 类型 | 规则 | 正确示例 | 错误示例 |
|------|------|---------|---------|
| 目录 / 文件名 | 组件 `PascalCase.tsx`，其他 `camelCase.ts` | `TaskRunLogsPanel.tsx`、`taskStore.ts` | `task-run-logs-panel.tsx`、`TaskStore.ts` |
| 组件 / 类 | `PascalCase` | `DashboardItem` | `dashboardItem` |
| 函数 / Hook | `camelCase`（Hook 以 `use` 开头） | `useQueryExecution()`、`loadTasks()` | `LoadTasks()` |
| 变量 / 参数 | `camelCase` | `taskId`、`chartConfig` | `task_id` |
| 常量 | `camelCase`（项目内常用风格）或 `SCREAMING_SNAKE_CASE`（全应用常量） | — | — |
| interface / type | `PascalCase` | `Task`、`ApiResponse<T>` | `task`、`TaskTypeResponse` |
| 枚举 | `PascalCase`，成员 `PascalCase` | `enum TaskState { Enabled, Disabled }` | `TASK_STATE.ENABLED` |

### 1.3 前后端字段映射强制

- Rust 字段：`snake_case` + `#[serde(rename = "camelCase")]` 对齐 TS
- TS interface：`camelCase` 字段名
- 两端必须一致；字段增减必须两端同步改

---

## 二、异常处理规范

### 2.1 后端 Rust

- ✅ 所有 `#[tauri::command]` 函数签名必须返回 `Result<ApiResponse<T>, String>`
- ✅ Service 层函数返回 `Result<T, Box<dyn std::error::Error>>` 或自定义 `Result<T, String>`
- ✅ 数据库层函数使用 `rusqlite::Result<T>` / `duckdb::Result<T>`，向上层传播时转化为可读 error message
- ✅ **禁止** `unwrap()` / `expect()` 在非测试代码中使用（初始化/测试代码例外，须加注释说明为何安全）
- ✅ **禁止** `let _ = conn.execute(...)` 静默吞错；必须 `if let Err(e) = ... { log::warn!(...); }`
- ✅ Mutex `lock().unwrap()` 必须改为 `lock().map_err(|e| format!(...))` 或 `match + PoisonError::into_inner()`
- ✅ 错误信息须"用户可读" + "开发可定位"两段：给前端 `ApiResponse { success:false, message:"执行失败" }`，日志里写完整 stack/上下文

### 2.2 前端 TS

- ✅ 所有 `tauriService.invokeCommand<T>()` 返回 `Promise<ApiResponse<T>>`，调用方用 `try/catch` 或 `.then().catch()`
- ✅ `useEffect` 内的异步代码必须包裹 `try/catch/finally`（参考 DashboardItem.tsx v6.3 的模式）
- ✅ 错误分三级：(1) 用户可读消息（toast/inline）(2) `console.error`（开发定位）(3) `toastStore.error()`（全局通知）
- ✅ **禁止** `any` 类型（详见 security.md §3）
- ✅ **禁止** `// @ts-ignore`、`// eslint-disable-next-line`（须加充分注释且仅临时使用）

---

## 三、注释规范

- ✅ 公共函数 / 结构体 / interface 必须有 JSDoc 或 Rust doc comment（`///`）
- ✅ 业务复杂函数至少包含：输入参数含义、返回值含义、副作用、异常情况
- ✅ 正则表达式、复杂 SQL 模板、复杂算法必须附带行内注释解释意图
- ✅ `TODO:` 注释须加负责人/日期，如 `// TODO(2026-06-20): 重构为参数化查询`
- ❌ 禁止注释掉的代码长期保留（可在 git 历史中恢复）
- ✅ **console 规则**：`console.error` / `console.warn` 用于错误诊断允许保留；生产代码中出现 `console.log` 时须加一行注释说明"为什么需要这条 log"（PowerShell 检测：`Get-ChildItem -Path src -Include *.ts,*.tsx -Recurse | Select-String -Pattern 'console\.log' | Select-String -NotMatch '//' -Context 1`）

---

## 四、设计模式强制约束

### 4.1 Service 模式（唯一入口）

- 每个业务领域有一个 `*_service.rs`，commands 层唯一入口
- Service 之间可互相调用，但禁止循环依赖（检测：`grep -rn "use.*_service" src-tauri/src/services/`）

### 4.2 Repository/DAO 模式

- 数据库访问集中在 `database/` 层 + `services/*_service.rs` 内部
- 所有 SQL 操作必须通过参数化查询（详见 security.md）

### 4.3 前端 Store 模式（Zustand）

- 组件层仅读取 `use*Store()`，不直接处理异步副作用
- 副作用 / loading 管理在 `*Store.ts` 中通过 store action 实现
- 新增领域状态必须新建 `{domain}Store.ts`，禁止把所有 state 塞入 `appStore.ts`

### 4.4 前端通信层封装

- 所有 `invoke()` 必须经 `src/services/tauri.ts::invokeCommand` 统一封装
- 禁止组件 / pages 中直接 `import { invoke } from "@tauri-apps/api/core"`

---

## 五、代码可读性约束

- ✅ 函数体长度建议 ≤ 80 行；超过需拆分为多个有意义的子函数
- ✅ 嵌套层级建议 ≤ 4 层；超过通过 early return / match 优化
- ✅ 魔法数字 / 字符串必须提取为常量/枚举
- ✅ 复杂条件判断须提取为命名布尔变量，如 `const taskIsRunnable = state === "enabled" && !suspended;`
- ✅ TS 类型声明避免 `string` 万能类型；尽可能使用 `TaskState | null` 等联合类型

---

## 六、补充：代码提交前自检清单（简化版）

| 检查项 | 验证方式 |
|--------|---------|
| `cargo check --quiet` 通过 | 在 `src-tauri/` 目录执行 |
| `npx tsc --noEmit --pretty` 通过 | 项目根目录执行 |
| 敏感字符串检测通过 | 执行 AGENTS.md §4 中的 PowerShell 检测命令 |
| 无 `console.log` 调试残留 | 执行前述 coding.md §3 中的 PowerShell 检测命令 |
| 新增命令/依赖已同步更新 capabilities / Cargo.toml | 自查文件变更记录 |

---

### 七、如何用 MCP 工具验证本规则

| 验证项 | 命令（PowerShell 环境） | 期望结果 |
|--------|------------------------|---------|
| Rust 无 unwrap/expect | `Get-ChildItem -Path src-tauri/src -Include *.rs -Recurse \| Select-String -Pattern "\.unwrap\(\)\|\.expect\(" \| Select-Object -First 20` | 0 个匹配（除初始化/测试代码外） |
| TS 无 @ts-ignore | `Get-ChildItem -Path src -Include *.ts,*.tsx -Recurse \| Select-String -Pattern "@ts-ignore" \| Select-Object -First 20` | 0 个匹配或有详细注释说明 |
| TS 无 any 类型 | `Get-ChildItem -Path src -Include *.ts,*.tsx -Recurse \| Select-String -Pattern ": any\|as any" \| Select-Object -First 20` | 0 个匹配 |
| Rust 函数体过长 | `Get-ChildItem -Path src-tauri/src -Include *.rs -Recurse \| ForEach-Object { $content = Get-Content $_.FullName; $content.Length } \| Sort-Object -Descending \| Select-Object -First 5` | 不超过 300 行/文件；单函数建议 ≤ 80 行 |
| TS 调试 console.log | `Get-ChildItem -Path src -Include *.ts,*.tsx -Recurse \| Select-String -Pattern "console\.log" \| Select-String -NotMatch "//" \| Select-Object -First 20` | 0 个或有注释说明 |
| Rust 敏感字符串 | `Get-ChildItem -Path src-tauri/src -Include *.rs -Recurse \| Select-String -Pattern 'sk-|Bearer |ghp_|eyJ|password:' \| Select-Object -First 20` | 0 个匹配 |

> 版本变更记录：见 [AGENTS.md](file:///e:/LA_DUCK/la-duck/AGENTS.md)。

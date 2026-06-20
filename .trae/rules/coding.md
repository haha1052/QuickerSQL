# QuickerSQL 代码规范 v7.0

> 优先级：高（仅次于 security.md / architecture.md）
> 适用：Rust 与 TS 两部分代码；子 Agent 在任何"代码生成/修改"任务中必须遵循本文件。

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
- ❌ 禁止 `console.log` 调试残留生产代码（`console.error` / `console.warn` 用于故障诊断可接受）

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

## 六、版本与变更记录

| 版本 | 日期 | 变更内容 |
|------|------|---------|
| v7.0 | 2026-06-20 | 初版。命名规范（snake_case / camelCase 强制 + serde rename）、异常处理（unwrap 禁止 + 静默吞错禁止 + Mutex PoisonError 处理）、注释规范、设计模式（Service / Store / 统一 invokeCommand）、可读性约束 |

# QuickerSQL 架构守护规则 v10.0

> 优先级：高。代码修改任务须阅读本文件 + [AGENTS.md](file:///e:/LA_DUCK/la-duck/AGENTS.md) 了解整体规则。
> 生效范围：所有 Trae Agent（主 Agent 与所有子 Agent）。
> 版本：**v12.0**（2026-07-17，与 AGENTS.md 同步版本号；系统表清单对齐代码现状（17 张），前端架构新增上下文层）。版本变更记录仅在 [AGENTS.md](file:///e:/LA_DUCK/la-duck/AGENTS.md) 中维护。

---

## 一、分层架构约束（强制执行）

### 1.1 后端三层架构（Rust · src-tauri/src）

```
commands/  ─────┐
                 │  单向调用  ──▶ database/（持久化层）
 services/  ─────┘                 │
   ▲                              ┌─┴─┐
   │ SQL 只能出现在                │  ▼
   │ database/ 与 services/       models/（数据定义，禁止运行时代码）
   │                             ┌─┴─┐
   └──── 禁止 commands/ 直接写 SQL ───┘
```

| 层级 | 目录 | 职责 | 禁止事项 |
|------|------|------|---------|
| **接口层** | `src-tauri/src/commands/*.rs` | 仅负责参数校验、Service 调用、`ApiResponse<T>` 包装、日志 | ❌ 禁止直接拼接 SQL；❌ 禁止实现业务逻辑；❌ 禁止跨 commands 直接调用（经 Service） |
| **业务层** | `src-tauri/src/services/*_service.rs` | 编排业务流程、事务边界、Service 间调用 | ❌ 禁止硬编码 SQL 文本（允许"SELECT/INSERT 文本"，但必须用参数化查询，详见 security.md）；❌ 禁止跨模块硬编码依赖其他 Service 内部实现 |
| **数据层** | `src-tauri/src/database/` | DuckDB/SQLite 连接管理、`SqlIdentifier` 安全封装、多语句禁止、参数化查询路由 | ❌ 禁止暴露 `conn.execute(format!(...))` 形式的 API |
| **模型层** | `src-tauri/src/models/*.rs` | 数据结构定义 + `#[serde(rename = "camelCase")]` 对齐前端字段 | ❌ 禁止业务逻辑；❌ 禁止直接连接数据库 |
| **工具层** | `src-tauri/src/utils/` | 通用工具（schedule 解析等） | ❌ 禁止直接操作数据库 |

### 1.2 前端三层架构（React · src/）

```
components/ ────┐
                 │  只读访问
 store/     ─────┴──▶ services/ ──▶ Tauri IPC
   ▲                      ▲
   │ State 变更           │ 通信封装，禁止业务逻辑
   │                      │
types/（类型定义，禁止逻辑）
```

| 层级 | 目录 | 职责 | 禁止事项 |
|------|------|------|---------|
| **组件层** | `src/components/*/`、`src/pages/*/` | UI 渲染、事件绑定、样式 | ❌ 禁止直接 `invoke()`；❌ 禁止引入 `@tauri-apps/api/core` |
| **状态层** | `src/store/*Store.ts` | 业务状态管理、副作用调度、异步流程 | ❌ 禁止在组件层实现；❌ 禁止长逻辑在 `useEffect` 内写 |
| **通信层** | `src/services/tauri.ts` | 封装 `invoke()` 为统一 `invokeCommand`，返回 `ApiResponse<T>` | ❌ 禁止业务逻辑；❌ 禁止暴露原始 invoke 给组件 |
| **类型层** | `src/types/*.ts` | 前后端共享类型定义 | ❌ 禁止运行时代码 |
| **工具层** | `src/utils/` | 纯函数工具（gridLayout、echartsNormalize 等） | ❌ 禁止 IPC / 副作用 |
| **上下文层** | `src/context/*/`、`src/styles/`、`src/pages/` | React Context（Settings/Theme/Locale 等）、全局样式、页面级组件 | ❌ 禁止在 context 内直接 invoke()；❌ 禁止在 styles 内放业务逻辑 |

### 1.3 跨层调用验证表（任何修改后自检）

| 调用方向 | 允许 | 禁止样例 |
|---------|------|---------|
| commands → services | ✅ | `commands/database.rs` 直接 `conn.execute(format!("SELECT ..."))` |
| services → database | ✅ | — |
| services → models | ✅（实例化/序列化） | 业务逻辑放在 models 内 |
| database → models | ✅（行→结构体） | database 层直接写业务判断 |
| components → store | ✅ | `DashboardItem.tsx` 内 `invoke("execute_sql")` |
| components → services | ✅（通过 tauriService） | `DashboardItem.tsx` 内 `import { invoke }` |
| store → services | ✅ | store 内拼接 SQL 字符串 |
| types / utils → 其他 | ✅（仅纯函数/类型） | 无 |

---

## 二、模块白名单机制（根治 AI 乱改代码）

> 任何子 Agent 只能修改其任务声明对应的目录。超出以下白名单范围的修改，**必须在修改前向用户提问确认**。
> "子 Agent 允许修改目录"规则也适用于主 Agent，即主 Agent 也必须按任务性质选择目录。

### 2.1 按任务类型映射目录（门禁表）

| 任务类型 | 允许修改目录（递归） | 禁止修改目录 |
|---------|---------------------|--------------|
| 后端 Rust 业务（service/automation/chart/settings 等） | `src-tauri/src/services/`、`src-tauri/src/commands/`、`src-tauri/src/models/`、`src-tauri/src/database/`、`src-tauri/src/utils/`、`src-tauri/src/lib.rs` | `src/`（前端）、`docs/`（文档仅在文档任务允许） |
| 前端 React 业务（dashboard/chart/automation 组件修改） | `src/components/`、`src/store/`、`src/services/`、`src/types/`、`src/utils/`、`src/App.tsx`、`src/styles/` | `src-tauri/`（后端） |
| 数据库 / SQL 相关 | `src-tauri/src/database/`、`src-tauri/src/services/database_service.rs`、`src-tauri/src/commands/database.rs`、`src-tauri/src/commands/sql.rs` | 其他 service 层 |
| 文档生成 / 架构文档 | `docs/`、`README.md`、`AGENTS.md`（需用户确认）、`.trae/specs/` | `src/`、`src-tauri/` |
| 规则体系维护 | `.trae/rules/`、`.trae/specs/`、`AGENTS.md` | `src/`、`src-tauri/` |
| 测试编写 | `src-tauri/src/database/tests.rs`、`src-tauri/tests/`（新建需用户确认）、`src/__tests__/`（新建需用户确认） | 业务代码目录（除添加测试辅助函数） |
| 配置文件修改 | `src-tauri/capabilities/default.json`、`src-tauri/tauri.conf.json`、`package.json`、`tsconfig.json`、`Cargo.toml`（**须单独任务、禁止与业务任务混改**） | — |

### 2.2 核心文件白名单（任何任务均可读取，但修改须遵循 2.1）

| 文件路径 | 角色 | 修改门槛 |
|---------|------|---------|
| `AGENTS.md` | 项目级强约束入口 | ⚠️ 仅"规则维护"任务可修改 |
| `.trae/rules/*.md` | 分层规则 | ⚠️ 仅"规则维护"任务可修改 |
| `docs/架构现状.md` | 架构演进记录 | ⚠️ 仅"规则维护"或版本发布任务 |
| `src-tauri/src/database/security.rs` | SqlIdentifier 安全封装 | ⚠️ 须用户确认 |
| `src-tauri/src/database/traits.rs` | 数据库连接抽象 | ⚠️ 须用户确认 |
| `src-tauri/src/lib.rs` | Tauri 命令注册入口 | ⚠️ 须用户确认 |
| `src-tauri/capabilities/default.json` | Tauri 权限声明 | ⚠️ 仅涉及新命令/插件时 |
| `src-tauri/tauri.conf.json` | 应用配置 | ⚠️ 须用户确认 |
| `package.json` | 前端依赖 | ⚠️ 须用户确认 |
| `Cargo.toml` | Rust 依赖 | ⚠️ 须用户确认 |

### 2.3 文件/目录禁改清单（锁死项目骨架）

> 以下内容**禁止任何任务修改**，除非是用户明确发起的"项目结构重构"类任务。

| 路径 | 理由 |
|------|------|
| `src-tauri/src/commands/`、`services/`、`models/`、`database/`、`utils/` 五目录并列关系 | 三层架构骨架 |
| `src/components/`、`store/`、`services/`、`types/`、`utils/` 五目录并列关系 | 前端三层架构骨架 |
| `docs/` 目录存在与内部主题文件（如 `架构现状.md`） | 架构知识资产 |
| `.trae/rules/` 与 `.trae/specs/` 目录结构 | 规则体系骨架 |

---

## 三、系统表命名强制规范（继承 AGENTS.md，强化）

> 本项目系统表 = 应用内部使用、不展示给用户作为业务数据的表。

| 表名 | 用途 | 创建位置 |
|------|------|---------|
| `__settings` | 应用设置 | `services/settings_service.rs` |
| `__app_state` | 应用运行时状态 | `services/app_state_service.rs` |
| `__workspace_tabs` | 工作区标签页 | `services/app_state_service.rs` |
| `__workspace_panels` | 工作区面板 | `services/app_state_service.rs` |
| `__query_history` | SQL 查询历史 | `services/query_history_service.rs` |
| `__audit_logs` | 审计日志 | `services/audit_log_service.rs` |
| `__trash_metadata` | 回收站元数据 | `services/trash_service.rs` |
| `__automation_tasks` | 自动化任务定义 | `services/task_service.rs` |
| `__automation_runs` | 自动化任务运行记录 | `services/task_service.rs` |
| `__task_dependencies` | 任务依赖关系 | `services/task_service.rs` |
| `__saved_queries` | 已保存查询 | `services/dashboard_service.rs` |
| `__saved_charts` | 已保存图表配置 | `services/dashboard_service.rs` |
| `__dashboards` | 仪表盘定义 | `services/dashboard_service.rs` |
| `__dashboard_items` | 仪表盘条目 | `services/dashboard_service.rs` |
| `__projects_registry` | 项目注册表 | `services/project_service.rs` |
| `__project_info` | 项目元数据 | `services/project_service.rs` |
| `__sql_snippets` | SQL 代码片段 | `services/sql_snippet_service.rs` |

**约束强化：**
- ✅ 所有系统表必须以 `__`（双下划线）开头
- ✅ 新增系统表须同时在：(1) 本清单 (2) `docs/架构现状.md` 的系统表章节 (3) `AGENTS.md` 同步声明
- ✅ `SqlIdentifier::is_system_table()` 只认 `__` 前缀和 `sqlite_` 前缀
- ❌ 禁止 `_xxx`（单下划线）、`xxx`（无前缀）作为系统表名
- ❌ 禁止在用户表名中使用 `__` 前缀（SqlIdentifier 检测须拦截）

---

## 四、接口与文档前置

- 新增 Tauri 命令（`#[tauri::command]`）必须先在 `AGENTS.md` 或 `docs/API设计方案.md` 登记：命令名、输入/输出类型、权限声明
- 修改既有命令的签名须同步更新 `src-tauri/capabilities/default.json`
- 前端新增加 invokeCommand 封装须在 `services/tauri.ts` 统一添加

---

## 五、目录规范增补

### 5.1 新文件命名约束

| 场景 | 命名模板 | 示例 |
|------|---------|------|
| Rust commands | `src-tauri/src/commands/{domain}.rs` | `automation.rs`、`chart.rs` |
| Rust services | `src-tauri/src/services/{domain}_service.rs` | `task_service.rs` |
| Rust models | `src-tauri/src/models/{domain}.rs` | `automation.rs`、`dashboard.rs` |
| TS 组件 | `src/components/{domain}/{Feature}.tsx` | `automation/TaskRunLogsPanel.tsx` |
| TS store | `src/store/{domain}Store.ts` | `taskStore.ts` |
| TS 类型 | `src/types/{domain}.ts` | `automation.ts` |

### 5.2 禁止事项（硬约束）

- ❌ 禁止擅自新增顶层业务目录（如 `src-tauri/src/business/`、`src/pages/new-feature/` 这种打破既有结构的命名）
- ❌ 禁止删除现有功能模块
- ❌ 禁止跨模块硬编码依赖（如 `task_service.rs` 直接引用 `dashboard_service.rs` 的内部实现细节）
- ❌ 禁止在 Windows 路径中使用非 ASCII 字符作为新文件/目录名

---

## 六、规则优先级与冲突消解

优先级（从高到低）：

1. `CLAUDE.local.md`（本地私有，不提交 Git，见同目录模板）
2. `.trae/rules/security.md`（安全规则最高）
3. `.trae/rules/architecture.md`（架构分层）
4. `.trae/rules/coding.md`（代码风格）
5. `.trae/rules/test.md`（测试要求）
6. `.trae/rules/file-lock.md`（文件锁，并行修改冲突解决）
7. 根目录 `AGENTS.md`（历史兼容）
8. `docs/架构现状.md`（参考性文档，不替代规则）

**冲突消解原则：**
- 若上层规则与下层规则冲突，以上层为准
- 若同层规则文件冲突，以文件内最新版本号章节为准
- 若本文件与 `AGENTS.md` 内容冲突，以本文件为准（但须在 `AGENTS.md` 中同步记录本次修订）

---

## 七、补充：数据库迁移规范简要

### 7.1 迁移脚本命名

遵循 `V<序号>__<描述>.sql` 格式：

```
V001__create_settings_table.sql
V002__add_created_at_column.sql
```

### 7.2 迁移约束

- **新增系统表时必须先更新 AGENTS.md §3 系统表清单**
- **老数据库 NULL 场景必须有降级处理路径**（default value 或 safe fallback）
- **列名变更必须前后端 struct/interface 同步修改**（见 AGENTS.md §2.3）

### 7.3 规则文档引用表

| 主题 | 参考文档 |
|------|---------|
| 安全 / 参数化查询 | [security.md](file:///e:/LA_DUCK/la-duck/.trae/rules/security.md) |
| 代码规范 / 命名 | [coding.md](file:///e:/LA_DUCK/la-duck/.trae/rules/coding.md) |
| 测试要求 | [test.md](file:///e:/LA_DUCK/la-duck/.trae/rules/test.md) |
| 文件锁 / 核心文件 | [file-lock.md](file:///e:/LA_DUCK/la-duck/.trae/rules/file-lock.md) |
| MCP 工具使用 | [mcp.md](file:///e:/LA_DUCK/la-duck/.trae/rules/mcp.md) |
| 发布 / 依赖管理 | [release.md](file:///e:/LA_DUCK/la-duck/.trae/rules/release.md) |
| 完整规则入口 | [AGENTS.md](file:///e:/LA_DUCK/la-duck/AGENTS.md) |

---

### 7.4 如何用 MCP 工具验证本规则

> 每次修改代码后，以下命令必须通过。用 Windows CLI MCP 直接执行。

| 验证项 | 命令（PowerShell 环境） | 期望结果 |
|--------|------------------------|---------|
| Rust 目录结构完整 | `Get-ChildItem -Path src-tauri/src -Directory \| Select-Object Name` | 至少包含 commands/services/models/database/utils 5 个目录 |
| TS 目录结构完整 | `Get-ChildItem -Path src -Directory \| Select-Object Name` | 至少包含 components/store/services/types/utils 5 个目录 |
| commands 层不直接写 SQL | `Get-ChildItem -Path src-tauri/src/commands -Include *.rs -Recurse \| Select-String -Pattern "format!.*SELECT\|format!.*INSERT\|format!.*UPDATE\|conn.execute(format!" -CaseSensitive:$false` | 0 个匹配 |
| models 层没有业务逻辑 | `Get-ChildItem -Path src-tauri/src/models -Include *.rs -Recurse \| Select-String -Pattern "fn .*_service\|impl.*Service" -CaseSensitive:$false` | 0 个匹配 |
| 前后端字段名一致 | `Get-ChildItem -Path src-tauri/src/models -Include *.rs -Recurse \| Select-String -Pattern 'rename = "camelCase"' \| Measure-Object` | 每个 struct 至少有字段用 camelCase 映射 |
| 系统表命名规范 | `Get-ChildItem -Path src-tauri/src/services -Include *.rs -Recurse \| Select-String -Pattern '"__\w+"' \| Measure-Object` | 所有系统表名以双下划线开头 |

> 版本变更记录：见 [AGENTS.md](file:///e:/LA_DUCK/la-duck/AGENTS.md)。

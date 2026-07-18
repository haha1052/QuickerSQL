# QuickerSQL 项目强制规则 & 多角色 SubAgent 调度体系

> 优先级：最高。所有代码修改必须在提交前对照本清单自检。
> 生效范围：主 Agent 与所有通过 `general_purpose_task` 发起的子 Agent。
> 版本：**v12.0**（2026-07-17，系统表清单同步代码现状：10 张→17 张，与 `architecture.md §三`、`docs/架构现状.md §八` 完全对齐；补登 v11.0 变更记录（TD-4 修复）；上一版 v11.0（2026-06-22）规则体系全面升级：MCP 工具成为默认开发流程第一环，新增 Spec-MD 规格驱动开发流程；所有 `.trae/rules/*.md` 文件版本号同步更新为 v11.0）

---

## 第一部分：角色体系（SubAgent Roles）

> **设计原则**：角色 = 目录门禁 + 约束集 + 调用模板。
> TRAE 当前仅提供 `general_purpose_task` 和 `search` 两个 subagent 工具，因此角色通过**在子任务 prompt 中强制写入目录范围 + 约束引用**实现，而非绑定独立模型/工具。

| 角色 | 触发关键词 | 允许修改目录（递归） | 必须遵守的 `.trae/rules/` 规则 | 输出物类型 |
|------|-----------|---------------------|-------------------------------|-----------|
| **架构 Agent** | `@架构`、`@architecture`、"设计方案"、"SPEC" | `.trae/specs/`、`docs/`、`.trae/rules/`（需用户确认后可改） | `architecture.md`、`file-lock.md` | SPEC 文档、任务拆分清单、模块边界图 |
| **后端 Coder Agent** | `@后端`、`@backend`、"实现 X 命令/Service" | `src-tauri/src/commands/`、`src-tauri/src/services/`、`src-tauri/src/models/`、`src-tauri/src/database/`、`src-tauri/src/utils/` | `architecture.md`、`coding.md`、`security.md`、`file-lock.md` | Rust 代码、参数化查询、`cargo check` 验证 |
| **前端 Agent** | `@前端`、`@frontend`、"页面/组件/状态管理" | `src/components/`、`src/pages/`、`src/store/`、`src/services/`、`src/types/`、`src/utils/`、`src/styles/`、`src/App.tsx` | `architecture.md`、`coding.md`、`security.md` | TS/TSX 代码、Store、`tsc --noEmit` 验证 |
| **重构 Agent** | `@重构`、`@refactor`、"优化性能"、"清理技术债" | 与后端/前端角色相同，但**仅限既有文件修改，不允许新增文件命名** | 全部六份规则 + `docs/架构现状.md` v7 技术债清单 | 代码改动 + 性能度量前后对比 |
| **文档 Agent** | `@文档`、`@docs`、"写文档"、"更新 README" | `docs/`、`README.md`、`.trae/specs/` | 仅需目录约束，不强制代码规范 | Markdown 文档、任务记录、版本变更 |

### 1.1 角色的不可跨域硬约束（硬边界）

```
@架构        禁止写入 src/、src-tauri/src/ 的任何代码文件
@后端        禁止写入 src/ 的任何文件（即禁止直接写前端逻辑）
              禁止直接修改 src-tauri/tauri.conf.json / capabilities/default.json / Cargo.toml（属 file-lock Tier-1，必须通知主 Agent 协调）
@前端        禁止写入 src-tauri/ 的任何文件
              禁止在组件层直接拼接 SQL（security.md §2.1）
@重构        禁止变更系统表命名清单；禁止删除现有功能
@文档        禁止修改任何代码文件
```

### 1.2 主 Agent 与子 Agent 的职责分界线

| 谁来做 | 事项 |
|--------|------|
| **主 Agent（你当前对话的这个）** | 任务分解、角色指派、Tier-1 文件协调、最终回复用户、输出《架构合规性报告》 |
| **子 Agent（@后端/@前端等）** | 仅执行分派的单点任务，完成后立即释放锁，不与用户直接对话 |

### 1.3 调度语法（子任务 prompt 必须声明 3 件事）

每次通过 `general_purpose_task` 发起子任务时，在 query 开头必须声明以下 3 项，**缺一不可**：

| 声明项 | 内容 | 示例 |
|--------|------|------|
| **1. 修改范围** | 本任务会修改哪些目录/文件 | `修改 src-tauri/src/services/task_service.rs` |
| **2. 遵循规则** | 本任务必须遵守 `.trae/rules/` 下哪些具体规则文件 | `遵守 security.md §1、coding.md §1.1` |
| **3. Tier-1 标识** | 是否涉及 Tier-1 文件（即是否需要改 lib.rs / tauri.conf.json / capabilities / Cargo.toml / package.json / App.tsx 等） | `涉及 Tier-1：lib.rs` 或 `不涉及 Tier-1` |

**简化示例（直接这样写即可）：**

```
修改范围：src-tauri/src/services/
遵循规则：security.md §1（参数化查询）、coding.md §1.1（snake_case）
Tier-1 标识：不涉及
<任务正文...>
```

---

## 第二部分：分层架构与数据链路（继承自 v7，保留不变）

### 2.1 分层架构

| 层级 | 前端目录 | 后端目录 | 职责 | 禁止事项 |
|------|---------|---------|------|---------|
| **接口层** | `src/services/` | `src-tauri/src/commands/` | 封装通信、参数校验、`ApiResponse<T>` 包装 | 禁止实现业务逻辑；禁止直接拼接 SQL |
| **业务层** | `src/store/` | `src-tauri/src/services/` | 业务逻辑编排、Service 间调用 | 禁止硬编码 SQL 文本（允许参数化查询，见 security.md） |
| **数据层** | — | `src-tauri/src/database/` | DuckDB/SQLite 连接管理、参数化查询路由 | 禁止暴露 `conn.execute(format!(...))` 形式的 API |
| **模型层** | `src/types/` | `src-tauri/src/models/` | 数据结构定义 | 禁止业务逻辑；禁止直接连接数据库 |
| **工具层** | `src/utils/` | `src-tauri/src/utils/` | 纯函数工具 | 禁止副作用 / 直接操作数据库 |

### 2.2 系统表命名强制规范

**规则**：所有系统表**必须以 `__`（双下划线）**开头。

**当前系统表清单**（17 张，与 `architecture.md §三`、`docs/架构现状.md §八` 完全对齐，基于代码实测）：

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
| `__saved_charts` | 已保存图表配置 | `services/dashboard_service.rs` |
| `__dashboards` | 仪表盘定义 | `services/dashboard_service.rs` |
| `__dashboard_items` | 仪表盘子项 | `services/dashboard_service.rs` |
| `__saved_queries` | 已保存查询 | `services/dashboard_service.rs` |
| `__projects_registry` | 项目注册表（全局） | `services/project_service.rs` |
| `__project_info` | 项目内部信息（每项目 meta.db） | `services/project_service.rs` |
| `__sql_snippets` | SQL 片段 | `services/sql_snippet_service.rs` |

**约束**：
- ✅ 新增系统表必须先更新本表 + `docs/架构现状.md` + `.trae/rules/architecture.md §三`
- ✅ `SqlIdentifier::is_system_table()` 只认 `__` 前缀和 `sqlite_` 前缀
- ❌ 禁止 `_xxx`（单下划线）、`xxx`（无前缀）作为系统表名
- ❌ 禁止在用户表名中使用 `__` 前缀（SqlIdentifier 检测须拦截）
- 🔄 旧数据库迁移：通过 `services/migration_service.rs` 自动迁移到 `__xxx`

### 2.3 数据链路规范（基于仪表盘反复出问题的根因总结）

**核心原则：单表自洽、读写对称、索引列清、错误可分。**

#### 数据库层三件套检查清单

- [ ] 建表/迁移 SQL 含该列
- [ ] INSERT / UPDATE 含该列
- [ ] SELECT（单条与列表两条路径都算）含该列
- [ ] Rust struct 字段与 TS interface 字段同步
- [ ] `row_to_*(row: &[String])` 的索引注释与 SELECT 实际列数一致
- [ ] 新增字段后老数据库 NULL 场景有降级路径

#### 前后端类型对照清单

跨前后端共享的数据结构必须同时修改：
1. `src-tauri/src/models/*.rs`（Rust struct + `#[serde(rename = "camelCase")]`）
2. `src/types/*.ts`（TS interface）
3. `tauriService` 调用侧若用新字段同步更新

#### 组件层渲染约束

- 组件内调用后端链路 ≤ 2 步，优先 store 缓存
- 单个组件崩溃不得拉垮整个 tab（需错误边界 + 降级展示）
- 异常必须区分：数据缺失 / 执行失败 / 列名不匹配 / 生成失败

### 2.4 规格驱动开发流程（核心硬约束：所有开发任务先写 spec，再写代码）

> **为什么需要这个流程？**
> 传统开发（"我想到什么就改什么"）的问题是：没有明确边界，没有明确验收标准，容易引入回归 bug。
> Spec-MD 的流程是：**先定义"怎么才算完成"，再写代码** → 100% 有边界有验证。

**标准开发流程（必须按此顺序执行，禁止跳过任何一步）：**

```
Step 1 → 写 spec.md（如果是新功能/大修改）
  · 位置：.trae/specs/<版本号-任务名>/spec.md
  · 必须包含：Overview/Purpose/Goals/Non-Goals/Background/
            Functional Requirements/Non-Functional Requirements/
            Constraints/Acceptance Criteria（AC）
  · 关键：Acceptance Criteria 中必须写清楚"用什么命令验证"
        （programmatic = 能用 grep/cargo check 等命令验证；
         human-judgment = 需要人眼判断的视觉/交互效果）

Step 2 → 读文件（Filesystem MCP）
  · 读取相关文件，了解现有代码风格和结构
  · 确认改动范围，不超出 spec 中声明的 Files Changed

Step 3 → 写代码（按 architecture.md/coding.md/security.md 约束）
  · 一次不超过 ~50 行（除非是大功能且 spec 中已明确）
  · SQL 必须参数化（security.md §1）
  · 不写 unwrap/expect 在生产代码中（coding.md §2）

Step 4 → 工具验证（Windows CLI MCP）
  · cargo check --quiet（Rust 编译）
  · cargo test --quiet（Rust 测试）
  · npx tsc --noEmit --pretty（TS 类型检查）
  · 执行 Acceptance Criteria 中声明的 grep/检测命令
  · 敏感字符串检测（见 §4 PowerShell 命令）

Step 5 → 输出可验证变更清单（§6 格式）
  · 列出实际修改的文件
  · 附上 Step 4 的验证结果
  · 附本次变更说明

Step 6 → 用户确认
  · 用户根据可验证变更清单 + spec 验收标准确认是否通过
```

**spec.md 最小模板（每次写 spec 至少包含以下内容）：**

```
# <版本号> <任务名> — Product Requirement Document

## Overview
· Summary：一句话说明做什么、为什么做
· Purpose：3-5 条具体目的

## Goals（必须量化，不能模糊）
· G1：<具体目标，可用命令验证>
· G2：<具体目标...>

## Non-Goals（明确不做什么，禁止写"不引入新功能"这种空话）
· ❌ 不做 XXX
· ❌ 不修改 XXX

## Background & Context
· 当前架构现状
· 问题分析
· 改动范围（文件清单）

## Functional Requirements
· FR-1：<具体的功能需求 1>
· FR-2：<具体的功能需求 2>

## Non-Functional Requirements
· NFR-1：零新增技术债（grep 验证）
· NFR-2：cargo check --quiet 通过
· NFR-3：最小改动原则

## Acceptance Criteria（验收标准，必须写清用什么命令验证）
· AC-1：<标准内容，Verification: programmatic/human-judgment>
· AC-2：<标准内容...>

## Open Questions（未确定事项）
· [ ] Q1：...
```

---

## 第三部分：Tier-1 文件锁与并行约束（引用 file-lock.md）

> **完整清单见** [file-lock.md](file:///e:/LA_DUCK/la-duck/.trae/rules/file-lock.md)

### 3.1 Tier-1 核心文件清单（修改须谨慎）

| 文件 | 影响范围 |
|------|---------|
| `src-tauri/src/lib.rs` | Tauri 命令注册 / 状态初始化 |
| `src-tauri/tauri.conf.json` | 应用配置 / bundle ID / 窗口设置 |
| `src-tauri/capabilities/default.json` | Tauri 权限声明 |
| `src-tauri/Cargo.toml` | Rust 依赖 |
| `package.json` | 前端依赖 + npm scripts |
| `tsconfig.json` | TS 编译配置 |
| `src/App.tsx` | 顶层入口路由 |
| `src/store/appStore.ts` | 全局状态 |
| `src/services/tauri.ts` | 前端 invoke 统一封装 |
| `.trae/rules/architecture.md` / `coding.md` / `security.md` | 规则体系 |

### 3.2 修改 Tier-1 文件的唯一强制规则（唯一可执行规则）

> ❌ 禁止"只读取需要改写的那几行"就直接 Edit
> ✅ **修改 Tier-1 文件前必须先完整读取整个文件**

原因：如果只读几行，会丢失该文件其他人刚刚写入的内容，也会破坏整个文件的结构完整性。

### 3.3 其他实用规范

- 同一 Tier-1 文件，建议同一对话内串行修改（避免前一次编辑覆盖后一次的预期）
- 新 command 函数追加到 `lib.rs` 的列表末尾，不重排
- 新权限追加到 `capabilities/default.json` 的数组末尾，不重排

---

## 第四部分：命名与安全零容忍（引用 coding.md / security.md）

> **完整规范见** [coding.md](file:///e:/LA_DUCK/la-duck/.trae/rules/coding.md) 和 [security.md](file:///e:/LA_DUCK/la-duck/.trae/rules/security.md)

### 命名规范速查表

| 场景 | 约定 |
|------|------|
| Rust 函数/变量 | `snake_case` |
| Rust struct/enum | `PascalCase` |
| TS 组件/类 | `PascalCase` |
| TS 函数/hook | `camelCase` |
| Rust → TS 字段映射 | `#[serde(rename = "camelCase")]` 对齐 |
| 系统表名 | `__xxx`（双下划线前缀） |

### 安全零容忍（任何一条被触发 → 必须回退或重新设计）

| 禁止事项 | PowerShell 检测命令（Windows 环境） | 参考规则章节 |
|---------|--------------------------------|-------------|
| `format!("SELECT/INSERT/UPDATE/DELETE ...")` 拼接 SQL | `cd src-tauri; Select-String -Path "src\*.rs","src\**\*.rs" -Pattern 'format!' \| Select-String -Pattern 'select\|insert\|update\|delete' -CaseSensitive:$false` | [security.md §1.1](file:///e:/LA_DUCK/la-duck/.trae/rules/security.md) |
| 前端 `src/` 出现 SQL 拼接 | `Get-ChildItem -Path src -Include *.ts,*.tsx -Recurse \| Select-String -Pattern 'SELECT\|INSERT' -CaseSensitive:$false` | [security.md §2.1](file:///e:/LA_DUCK/la-duck/.trae/rules/security.md) |
| 源码中出现敏感字符串 `sk-`、`Bearer `、`password:`、`-----BEGIN PRIVATE KEY-----` | `Get-ChildItem -Recurse -Include *.rs,*.ts,*.tsx \| Select-String -Pattern 'sk-|password:|PRIVATE KEY|Bearer '` | [security.md §3.2](file:///e:/LA_DUCK/la-duck/.trae/rules/security.md) |

**参数化查询唯一合法路径模板**：
- **情形 A（最常见）**：固定 SQL + `?` 占位符 + params 数组
- **情形 B（动态 WHERE）**：SQL 片段只含列名/操作符，用户值只进 params
- **情形 C（动态表名/列名）**：用户输入必须经 `SqlIdentifier::new()` + `quote_identifier()`

---

## 第五部分：本地私有规则覆盖（CLAUDE.local.md）

> 模板见 [CLAUDE.local.md.template](file:///e:/LA_DUCK/la-duck/.trae/rules/CLAUDE.local.md.template)
> 实际文件 `CLAUDE.local.md` 不提交 Git（已在 `.gitignore` 排除）。

优先级：
1. `CLAUDE.local.md`（本地私有 override，最高）
2. `security.md`
3. `architecture.md`（即本文件的架构部分）
4. `coding.md`
5. `test.md`
6. `file-lock.md`

如果本地存在 `CLAUDE.local.md`，其中的规则覆盖本文件的同名条目。

---

## 第六部分：任务结束必须输出的"可验证变更清单"

> 每次任务结束必须在最终回复中按以下格式输出。**所有检查项必须有工具验证结果，不允许主观判断。**
> **重要：如果任务大于 50 行代码改动或涉及架构变更，必须先有 spec.md 文档（见 §2.4 规格驱动开发流程）。**

### 本次变更概要

| 项目 | 内容 |
|------|------|
| **本次修改的文件** | 列出实际变更的文件，如 `src-tauri/src/services/task_service.rs` |
| **是否涉及 Tier-1 文件** | 是 / 否（如果是，列出文件） |
| **是否有 spec.md** | 是 / 否（如果是，给出路径如 `.trae/specs/<版本号-任务名>/spec.md`） |
| **代码变更行数** | 大约行数（用于判断是否需要分阶段） |

### 工具验证结果（✅/❌，❌ 必须附报错内容）

| 验证项 | 结果 | 备注 |
|--------|------|------|
| `cargo check --quiet` 通过 | | 在 `src-tauri/` 目录执行 |
| `cargo test --quiet` 通过 | | 如果有 Rust 测试 |
| `npx tsc --noEmit --pretty` 通过 | | 如果有 TS 变更 |
| SQL 注入检测通过 | | 执行 §4 中的 PowerShell 检测命令 |
| 敏感字符串检测通过 | | 执行 §4 中的 PowerShell 检测命令 |
| 无调试残留的 `console.log` | | 如 `console.log` 是有意保留的，须在备注中说明原因 |
| spec.md 的 Acceptance Criteria 已验证 | | 如果有 spec，执行 spec 中 AC 声明的命令 |

### 本次变更说明（1-2 句话描述做了什么、为什么做）

---

## 第七部分：MCP 工具自动选择规则（Code/IDE 模式下开发时使用）

> **设计原则**：能用工具获取答案的，绝不凭经验回答。读文件 → 跑编译/测试 → 基于真实信息分析，是本节所有规则的总纲。
> 详细的每个工具使用指南见：[.trae/rules/mcp.md](file:///e:/LA_DUCK/la-duck/.trae/rules/mcp.md)

### 7.1 用户触发词（看到以下关键词/情形，必须自动调用对应 MCP 工具）

| 触发词 / 情形 | 应调用的 MCP | 禁止行为 |
|--------------|--------------|---------|
| "这个文件里写了什么" | `filesystem.read_file(path)` | 不要让用户把代码贴到对话里 |
| "某段代码出现在哪里" / "搜索" | `filesystem.search(dir, pattern)` | 不要自己猜文件名 |
| "某目录下有哪些文件" | `filesystem.list_directory(path)` | 不要推测目录结构 |
| "能编译过吗" / "有编译错误吗" | `windows_cli: cargo check --quiet` | 不要说"应该能编译过" |
| "跑一下测试" | `windows_cli: cargo test` 或 `npm test` | 不要凭代码内容断定测试能过 |
| "有 TypeScript 类型错误吗" | `windows_cli: npx tsc --noEmit --pretty` | 不要凭肉眼推断 |
| "帮我写规格 / 写 spec / 先写 spec 再改" | **Spec-MD**：按 §2.4 模板生成 spec.md | 不要跳过 spec 直接写代码 |
| "帮我实现某个功能 / 某个模块" | **Spec-MD**（先写 spec）→ Filesystem → Windows CLI（验证） | 不要不写边界就开始写代码 |
| "帮我重构 / 优化这段代码" | **Spec-MD**（先写重构 spec）→ Filesystem → Windows CLI（验证） | 不要重写超过 50 行不跟用户确认 |
| "帮我生成单元测试" | `filesystem.read_file(被测文件 + 同目录现有测试)` + `ollama_custom` | 不要凭空写不匹配项目风格的测试 |
| "帮我生成 SQL / 优化 SQL" | `filesystem.read_file(相关模型定义)` + `ollama_custom` | 不要遗漏参数化查询要求 |
| "帮我写文档 / 写注释" | `filesystem.read_file` + `ollama_custom` | 不要写废话；注释必须说"为什么"而不是"做了什么" |
| "最近 push 了什么 / 有哪些 commit" | `github` 或 `windows_cli: git log --oneline -10` | 不要凭空回答 |
| "页面看起来正常吗 / 打开应用看看" | `windows_cli` 启动开发服务器 + `browser_use` 截图 | 不要凭代码猜 UI |
| "数据库里有什么表 / 某条 SQL 的结果" | `windows_cli: sqlite3 路径.db "SELECT ..."` | 不要随便改数据库内容 |

### 7.2 工具选择优先级（当多个工具都可用时，按此顺序选择）

```
核心原则：MCP 工具是默认开发流程的一环，不是"可选辅助"

① Spec-MD  →  任何>50 行代码 / 架构变更 / 新功能，先写 spec.md
                （spec.md 包含 Goals/Non-Goals/Acceptance Criteria）
② filesystem  →  读代码 / 搜文件 / 列目录，获取真实上下文
③ windows_cli  →  编译检查 / 运行测试 / grep 验证 / 数据库查询 / git
④ ollama_custom  →  基于前两步的真实上下文做代码分析 / 代码生成 / 写文档
                （禁止不读文件就调用 ollama）
⑤ github / browser_use  →  仅在需要远程仓库或浏览器操作时使用
```

### 7.3 典型工作流模板（照着执行，不要自己发明流程）

#### 模板 A：用户问"这个函数/这段代码有什么问题"

```
第一步 filesystem.read_file(相关文件)
       ↓（必须真实读到代码内容）
第二步 windows_cli: cargo check --quiet 或 npx tsc --noEmit
       ↓（拿到真实的编译/类型错误）
第三步 基于读到的代码和编译结果，给用户具体的问题定位 + 修复建议
       ↓（如果要改代码）
第四步 ollama_custom: 基于代码风格上下文生成修复方案（可选）
```

#### 模板 B：用户问"帮我给某个函数写测试"

```
第一步 filesystem.read_file(被测函数所在文件)
       ↓
第二步 filesystem.read_file(同目录的现有测试文件，了解风格和命名)
       ↓
第三步 ollama_custom: 基于前两步的内容生成测试代码
       ↓
第四步 windows_cli: 跑一下新增的测试，验证能编译能通过
```

#### 模板 C：用户问"帮我跑这个项目 / 看看页面效果"

```
第一步 filesystem.read_file(package.json 或 Cargo.toml，了解启动命令)
       ↓
第二步 windows_cli: npm run tauri dev（或对应启动命令，后台运行）
       ↓
第三步 browser_use: 打开 http://localhost:1420 截图返回
```

#### 模板 D：用户问"这个模块/功能怎么设计"

```
第一步 filesystem.read_file(相关的现有模块，了解设计风格)
       ↓
第二步 ollama_custom: 基于已有设计风格给出方案建议
       ↓
第三步 把方案写成用户可读的列表/表格形式，让用户做选择
```

#### 模板 E：**规格驱动开发流程（核心模板，推荐所有 >50 行改动任务使用）**

```
第一步 Spec-MD：生成 spec.md 规格文档
  · 位置：.trae/specs/<版本号-任务名>/spec.md
  · 必须包含：Goals/Non-Goals/Background/FR/NFR/Acceptance Criteria
  · 关键：Acceptance Criteria 中必须写清楚"用什么命令验证"
       ↓（用户确认 spec 后才开始写代码）
第二步 Filesystem MCP：读取相关文件，了解代码结构和风格
  · 确认改动范围，不超出 spec 中声明的 Files Changed
       ↓
第三步 写代码（按 architecture.md/coding.md/security.md 约束）
  · 一次不超过 ~50 行（大功能分批推进）
  · SQL 必须参数化（security.md §1）
       ↓
第四步 Windows CLI MCP：工具验证
  · cargo check --quiet
  · cargo test --quiet（如有测试）
  · npx tsc --noEmit --pretty（如有 TS 变更）
  · 执行 spec 中 Acceptance Criteria 声明的 grep/检测命令
       ↓
第五步 输出"可验证变更清单"（见 §6 格式）
  · 列出修改文件
  · 附上 Step 4 的验证结果
  · 附本次变更说明
       ↓
第六步 用户确认（根据 spec 验收标准和验证结果）
```

#### 模板 F：**小修改流程（<50 行、明确任务、不涉及架构变更）**

```
第一步 Filesystem MCP：读取相关文件
       ↓
第二步 写代码（按 architecture.md/coding.md/security.md 约束）
       ↓
第三步 Windows CLI MCP：cargo check / npx tsc 验证
       ↓
第四步 输出"可验证变更清单"（见 §6 格式）
```

### 7.4 安全与约束

| 规则 | 具体约束 |
|------|---------|
| **读文件限制** | 单次对话最多读 ≤ 3 个大文件（> 300 行）；超过的话分多次，先给用户摘要 |
| **禁止破坏性操作** | `rm -rf` / `DROP TABLE` / 数据库 `DELETE` 无 `WHERE` 条件 → **一律先让用户确认** |
| **禁止硬编码敏感信息** | API Key / 数据库密码 / 路径中的用户名 → **不写进对话、不写进代码** |
| **git push 要确认** | 任何会产生外部副作用的操作（push、merge、发布）→ **先让用户确认** |
| **一次只改 ≤ 50 行** | 代码改动必须小步推进；重构另算但必须分阶段让用户确认 |
| **不凭空写代码** | ollama_custom 生成代码之前，必须先让 filesystem 读过上下文 |
| **不凭空回答编译结果** | 没跑 cargo check / tsc 之前，不许说"这样写没问题" |

### 7.5 对话中的简写触发词（用户用以下任一句开头即可）

用户无需每次都写一长串指令，只需用以下简写触发：

| 用户可写的触发词 | 含义 | AI 应执行的动作 |
|-----------------|------|----------------|
| "**用工具**：xxx" | 等同于"按 §7 的规则执行" | 自动选合适的 MCP 工具执行 |
| "**按 §7**：xxx" | 同上 | 同上 |
| "**读代码**：xxx 文件" | 专门读某个文件分析 | `filesystem.read_file` + `ollama_custom` |
| "**跑一下**：xxx" | 专门跑编译/测试 | `windows_cli: cargo check` 或对应命令 |
| "**查一下**：xxx" | 数据库查询 | `windows_cli: sqlite3 ...` |

### 7.6 禁止行为清单

- ❌ **不要**没读文件就凭印象分析代码（"我猜你那个函数里大概是……"）
- ❌ **不要**没跑编译就说"这样写没问题"
- ❌ **不要**一次重写超过 50 行代码而不让用户确认
- ❌ **不要**用 `rm -rf` / `DROP TABLE` / `DELETE` 无条件等破坏性操作
- ❌ **不要**把 API Key / 密码 / 用户路径等敏感信息写进对话或代码
- ❌ **不要**把超过 3 个大文件的内容同时塞进一次对话（容易 token 溢出）
- ❌ **不要**依赖 ollama_custom 凭空写代码而没有先让 filesystem 读到上下文
- ❌ **不要**在用户问"能跑起来吗"时只回答"应该能"，必须实际跑一下或让用户自己跑

### 7.7 失败时怎么办

如果某个 MCP 工具调用失败（例如 `ollama_custom` 的 server 没启动，或 `filesystem` 路径不存在），按以下降级顺序处理：

1. **立刻告诉用户**哪个工具失败了、报了什么错
2. **尝试用其他工具替代**：`ollama_custom` 失败就改用 `windows_cli: ollama run qwen2.5:7b`；`filesystem` 失败就用 `windows_cli: dir 路径` 或 `cat 路径`
3. **两个工具都失败**时，直接告诉用户"当前工具不可用，请先检查配置"，不要自己硬编答案

详细的每个工具参数、常见问题，见独立文档：[.trae/rules/mcp.md](file:///e:/LA_DUCK/la-duck/.trae/rules/mcp.md)

---

## 版本变更记录（本文件是唯一保留版本记录的文档）

| 版本 | 日期 | 变更内容 |
|------|------|---------|
| v7.0 | 历史 | 简单规范版（架构分层 + 系统表清单 + 数据链路） |
| v8.0 | 2026-06-20 | **多角色 SubAgent 调度体系**：第一部分角色定义 + 目录门禁；第三部分 Tier-1 文件锁流程；第四部分安全零容忍速查表；第五部分本地规则覆盖 |
| v9.0 | 2026-06-21 | **新增 MCP 工具自动选择规则（第七部分）**：filesystem / windows_cli / ollama_custom / github / browser_use 五工具的触发词、优先级、典型工作流；新增独立文档 `.trae/rules/mcp.md` |
| v10.0 | 2026-06-21 | **规则体系全面精简为"可验证/可执行规则"**：§1.3 调度语法从 7 行模板简化为 3 项声明；§3 文件锁从"会话锁/释放锁"等不可执行概念简化为"修改前必须完整读取"一条强制规则；§6 合规性报告从主观判断改为"工具验证结果"清单；§4 安全检测命令补充 PowerShell 语法；所有 `.trae/rules/*.md` 文件版本号同步更新为 v10.0，仅本文件保留版本变更记录；新增 `.trae/rules/release.md` 作为发布/依赖管理规范 |
| v11.0 | 2026-06-27 | 初版。从 security/architecture/coding/file-lock 中提炼核心约束，放在最高优先级文件确保被遵守 |
| v12.0 | 2026-07-17 | 系统表清单同步代码现状（10/11→17 张）；architecture.md §1.2 新增"上下文层"；test.md §一测试现状重写；security.md / CLAUDE.local.md / mcp.md SQL 注入检测命令修订为两段式（排除 ident.quoted() 合法用法） |

---

> 说明：从 v10.0 起，所有 `.trae/rules/` 目录下的规则文件与本文件版本号保持一致（当前 v12.0）。各规则文件末尾不再单独保留版本变更记录，统一在此处维护。

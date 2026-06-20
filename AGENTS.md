# QuickerSQL 项目强制规则 & 多角色 SubAgent 调度体系

> 优先级：最高。所有代码修改必须在提交前对照本清单自检。
> 生效范围：主 Agent 与所有通过 `general_purpose_task` 发起的子 Agent。
> 版本：v8.0（2026-06-20，v7 升级为多角色调度体系）

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

### 1.3 调度语法（用于主 Agent 发起子任务时的 prompt 模板）

每次通过 `general_purpose_task` 发起子任务时，**必须**在 `query` 参数的开头按以下模板写入。**禁止省略任何一行。**

```
【角色】@后端（或 @前端/@架构/@重构/@文档）
【任务简述】<1 句话说清要做什么>
【允许目录】<明确列出允许修改的目录，遵循 architecture.md 目录门禁>
【禁止目录】<明确列出绝对不能改的目录>
【必须遵守的规则】<引用 .trae/rules/ 下的具体文件名 + 章节号>
【交付物】<代码/SPEC/文档>
【编译验证】<是/否，要求 cargo check 或 tsc --noEmit>
【文件锁声明】<本任务会修改哪些 Tier-1 文件，如无则写"无">
```

**真实调用示例（禁止省略这些约束行）：**

```
【角色】@后端
【任务简述】在 task_service.rs 新增 create_task 的 SqlIdentifier 校验
【允许目录】src-tauri/src/services/
【禁止目录】src/、src-tauri/tauri.conf.json、src-tauri/capabilities/default.json
【必须遵守的规则】.trae/rules/security.md §1（参数化查询模板 C）；.trae/rules/coding.md §1.1（snake_case 命名）
【交付物】Rust 代码变更
【编译验证】必须执行 cargo check 并返回 0 errors
【文件锁声明】无（不修改 Tier-1 文件）
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

**当前系统表清单**：

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
| `__automation_task_runs` | 自动化任务运行记录 | `services/task_service.rs` |
| `__saved_charts` | 已保存图表配置 | `services/dashboard_service.rs` |
| `__saved_dashboards` | 仪表盘定义 | `services/dashboard_service.rs` |

**约束**：
- ✅ 新增系统表必须先更新本表 + `docs/架构现状.md`
- ❌ 禁止 `_xxx`（单下划线）、`xxx`（无前缀）作为系统表名
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

---

## 第三部分：Tier-1 文件锁与并行约束（引用 file-lock.md）

> **完整清单见** [file-lock.md](file:///e:/LA_DUCK/la-duck/.trae/rules/file-lock.md)

**Tier-1 文件（每次最多一个子任务修改）**：
- `src-tauri/src/lib.rs`、`src-tauri/tauri.conf.json`、`src-tauri/capabilities/default.json`、`src-tauri/Cargo.toml`
- `package.json`、`tsconfig.json`、`.gitignore`
- `src/App.tsx`、`src/store/appStore.ts`、`src/services/tauri.ts`
- `.trae/rules/architecture.md`、`coding.md`、`security.md`

**主 Agent 协调流程**：
1. 任务分解时，先在 TodoList 中声明每项会改的 Tier-1 文件
2. 若两项子任务都需要改同一 Tier-1 文件，必须**串行化**或**合并为单一任务**
3. 修改 Tier-1 文件前必须完整读取，禁止行号定位
4. 新功能追加到 `lib.rs` / `capabilities/default.json` 的列表末尾（追加不重排）

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

| 禁止事项 | 检测方式 | 参考规则章节 |
|---------|---------|-------------|
| `format!("SELECT/INSERT/UPDATE/DELETE ...")` 拼接 SQL | `grep -rn 'format!("' --include='*.rs' src-tauri/src \| grep -i 'select\|insert\|update\|delete'` | [security.md §1.1](file:///e:/LA_DUCK/la-duck/.trae/rules/security.md) |
| 前端 `src/` 出现 SQL 拼接 | `grep -rn 'SELECT\|INSERT' --include='*.ts' --include='*.tsx' src/` | [security.md §2.1](file:///e:/LA_DUCK/la-duck/.trae/rules/security.md) |
| 源码中出现敏感字符串 `sk-`、`Bearer `、`password:`、`-----BEGIN PRIVATE KEY-----` 等 | `grep -rn 'sk-\|password:\|PRIVATE KEY' --include='*.rs' --include='*.ts' --include='*.tsx' .` | [security.md §3.2](file:///e:/LA_DUCK/la-duck/.trae/rules/security.md) |

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

## 第六部分：任务结束强制输出

> 每次任务结束必须在最终回复中输出：
>
> **《本次修改架构合规性报告》**，逐项核对以下检查清单。

| 检查项 | 结果（✅/❌） | 备注 |
|--------|-------------|------|
| 架构分层：是否遵循 API → Service → Model，无跨层调用 | | |
| 目录约束：新增文件是否放入对应模块 | | |
| 命名规范：snake_case / camelCase / `__xxx` 系统表 | | |
| 安全零容忍：无 `format!("SELECT/...")` 拼接 SQL | | |
| 文件锁：是否遵循 Tier-1 文件串行修改 | | |
| 错误处理：`ApiResponse<T>` 包装；前端用户友好提示 | | |
| 类型安全：无 `any`；Rust/TS struct 同步 | | |
| 权限声明：新命令是否同步 `capabilities/default.json` | | |
| 组件职责：业务逻辑不在组件层 | | |
| 调试清理：无临时 `console.log` / 注释代码 | | |
| 编译验证：`cargo check` / `tsc --noEmit` 通过 | | |

---

## 版本变更记录

| 版本 | 日期 | 变更内容 |
|------|------|---------|
| v7.0 | 历史 | 简单规范版（架构分层 + 系统表清单 + 数据链路） |
| v8.0 | 2026-06-20 | **升级为多角色 SubAgent 调度体系**：新增第一部分 5 角色定义、调用模板语法、角色目录门禁；新增第三部分 Tier-1 文件锁协调流程；新增第四部分安全零容忍速查表；新增第五部分本地规则覆盖机制；角色调用模板要求每次通过 `general_purpose_task` 发起子任务时必须完整写入 prompt |

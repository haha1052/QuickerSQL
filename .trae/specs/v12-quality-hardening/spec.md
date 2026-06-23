# v12 架构质量加固 — Product Requirement Document

## Overview
- **Summary**: 在 v11.0 完成前后端分层 + 类型系统 + Store 中心化的基础上，v12 聚焦于 "核心质量加固"：后端 SQL 执行路径的可观测性与回归防护，前端 import 路径一致性与类型文件规范化。**不引入新功能**，不在本次改动中添加任何用户可见的新图表类型或组件。

- **Purpose**: 解决 v11.0 遗留的 4 个质量缺口：
  1. DuckDB panic / 常规错误的信息不进入审计日志，生产环境不可追溯
  2. `sql_service.rs` 中 3 个纯函数（SQL 分词、DROP 表名解析、连接策略判断）完全无单元测试，存在回归风险
  3. 前端 store 存在两种 import 模式（统一出口 vs 直接子文件），缺乏约定一致性
  4. settings 相关类型挤在 `types/index.ts` 中，未形成独立领域文件，与其他领域（chart/dashboard/workspace 等）的架构不一致

- **Target Users**: 开发者（主要）、运维 / 生产环境操作者（候选项 2 直接受益）

## Goals
- **G1（后端可观测性）**: 所有 DuckDB panic / DuckDB 常规错误，在回退到 SQLite 之前，必须将完整错误信息写入 `__audit_logs`
- **G2（后端回归防护）**: `sql_service.rs` 中 3 个纯函数（`split_sql_statements`、`parse_drop_table_table_name`、`should_use_temp_connection`）至少覆盖各 8+ 个测试用例，`cargo test` 通过
- **G3（前端架构一致性）**: 前端所有 store import 统一走 `src/store/index.ts`，不允许直接 `from '../../store/xxxStore'`
- **G4（前端类型文件规范）**: settings 领域类型从 `types/index.ts` 独立为 `types/settings.ts`，与 chart/dashboard/workspace 等领域架构一致
- **G5（零新增技术债）**: 本次所有改动不得引入新的 `any` 类型、新的跨层调用、新的 unwrap/expect

## Non-Goals (Out of Scope)
- ❌ 不实现新图表类型（热力图 / 瀑布图 / 漏斗图）—— 属于功能需求，需产品确认后另起 spec
- ❌ 不做 DatabaseExplorer 全量拆分（859 行 → 6 个子文件）—— 风险较大，建议作为独立后续任务
- ❌ 不全面治理 43 个组件文件中的内联 interface / any 类型 —— 范围过大，本次仅做"settings 独立文件"作为示范
- ❌ 不修改架构分层（commands/services/models 边界）—— v11.0 已完成，不重复
- ❌ 不修改 `lib.rs`、`capabilities/default.json`、`tauri.conf.json` —— Tier-1 文件，除非必要

## Background & Context

### 当前架构状态（v11.0 基线）
```
后端 Rust（src-tauri/src）：
├── commands/        (13 个文件，架构分层已完成)
├── services/        (14 个文件，sql_service.rs 新引入)
├── models/          (8 个领域文件)
├── database/        (安全封装 + 集成测试)
└── utils/           (通用工具)

前端 TS（src）：
├── components/      (多领域，已完成 tauriService 隔离)
├── store/           (11 个 store，有 index.ts 统一出口但约定未强制)
├── types/           (7 个领域文件，settings 缺失独立文件)
├── services/        (tauriService 统一封装)
└── pages/           (页面层)
```

### 审计日志系统（候选项 2 依赖）
- `__audit_logs` 表已存在，结构：`id / timestamp / module / action / description / status / duration_ms / details`
- `AuditLogService::record_audit_log(conn, request)` API 已可用，参数为 `RecordAuditLogRequest { module, action, description, status, duration_ms, details }`
- 当前问题：sql_service.rs 的 `catch_unwind` 路径中，panic payload 仅 `log::error!` 到 stderr，**不写入审计日志**

### sql_service.rs 纯函数（候选项 6 依赖）
- `split_sql_statements(sql: &str) -> Vec<String>` — 行 33-112，~70 行，处理注释/字符串/分号
- `parse_drop_table_table_name(stmt: &str) -> Option<String>` — 行 116-138，~22 行
- `should_use_temp_connection(sql: &str) -> bool` — 行 141-147，~7 行
- **完全无测试**，边界场景（注释内含分号、字符串内含分号、末尾无分号）存在回归风险

### store import 现状（候选项 4 依赖）
- `src/store/index.ts` 已存在并导出 9 个 store hook
- **约 19 处**直接 import 子文件（主要是 Dashboard 组件 9/10 处）
- **约 23 处**走统一出口（workspace/query/project/app 等领域遵循良好）
- 明显的混合模式，无 lint 规则约束

### types/settings 现状（候选项 3 依赖）
- `types/index.ts:226-268` 中存在 `SettingItem / SettingCategory / SettingsListResponse / UpdateSettingRequest` 等 43 行类型定义
- 其他领域（chart/dashboard/workspace/audit_log/table/task/project）均有独立 `types/xxx.ts` 文件
- **settings 是唯一未独立的主要领域**，与架构约定不一致

## Functional Requirements

### FR-1: DuckDB panic 审计日志记录
- 当 `sql_service.rs` 中 `catch_unwind(|| duckdb_conn_guard.query(...))` 返回 `Err(panic_payload)` 时，将以下信息写入 `__audit_logs`：
  - `module`: `"sql"`
  - `action`: `"query"`
  - `status`: `"failed"`
  - `description`: `"DuckDB panicked, fell back to SQLite"`
  - `details`: 包含 panic payload 的 JSON 序列化（若可转换为字符串）
- 当 DuckDB 正常返回 `Err(error)` 而非 panic 时，同样写入审计日志（`status: "failed"`, `description: "DuckDB execution failed, fell back to SQLite"`）
- 两种场景下，写入审计日志**不得阻塞回退逻辑**（即先记录日志，再执行 SQLite 回退，或并行但不影响回退）

### FR-2: sql_service.rs 单元测试覆盖
- 在 `src-tauri/src/services/sql_service.rs` 末尾新增 `#[cfg(test)] mod tests`
- 为 `split_sql_statements` 覆盖至少 8 个测试用例：
  - 单语句 + 分号
  - 多语句 + 多分号
  - `--` 行注释（注释内不拆分）
  - `/* */` 块注释（注释内不拆分）
  - 字符串内含分号（字符串内不拆分）
  - 末尾无分号（最后一条语句仍被识别）
  - 空字符串输入
  - 纯分号输入（空语句过滤）
- 为 `parse_drop_table_table_name` 覆盖至少 6 个测试用例：
  - `DROP TABLE foo`
  - `DROP TABLE IF EXISTS foo`
  - `DROP TABLE "quoted_foo"`（引号去除）
  - `DROP TABLE`（无表名 → None）
  - 非 DROP 语句（如 SELECT → None）
  - 多空格 / 大小写混合
- 为 `should_use_temp_connection` 覆盖至少 5 个测试用例：
  - `SELECT ...` → true
  - `WITH ...` → true
  - `EXPLAIN ...` → true
  - `PRAGMA ...` → true
  - `INSERT / DELETE / CREATE TABLE` → false

### FR-3: store/index.ts 统一出口强制执行
- 在 `src/store/index.ts` 中补全当前未从子文件 re-export 的所有公共 symbol（包括 `useTableStore`、各 store 中导出的常量如 `SIDEBAR_*` 等）
- 将所有组件文件中的 `from '../../store/xxxStore'`（19 处）改为 `from '../../store'`
- `grep -rn "from.*store/.*Store" src/` → 0 处直接 import 子文件

### FR-4: types/settings.ts 独立文件
- 新建 `src/types/settings.ts`，从 `types/index.ts` 迁移所有 settings 相关的 `SettingItem / SettingCategory / SettingsListResponse / UpdateSettingRequest / ExportSettingsResponse / ImportSettingsRequest` 类型定义（~43 行）
- 在 `types/index.ts` 中用 `export * from './settings'` 替代原有内联定义
- 所有现有组件 import settings 类型的路径保持不变或自动指向新文件（通过 `from '@/types'` 统一出口保持兼容）
- `tsc --noEmit` 0 errors

## Non-Functional Requirements

### NFR-1: 零新增技术债
- 本次所有代码变更后：
  - `grep -rn ": any[^a-zA-Z]" src/` → **数量不增加**（保持 0 处）
  - `grep -rn '\.unwrap()\|expect(' src-tauri/src/ --include='*.rs' | grep -v "#\[cfg(test)\]"` → **数量不增加**（v11.0 基线：仅 lib.rs 主入口 1 处合理保留）
  - `grep -rn 'conn\.\(query\|execute\)(' src-tauri/src/commands/ --include='*.rs'` → **数量不增加**

### NFR-2: cargo check 零警告
- 所有 Rust 代码变更后：
  - `cd src-tauri; cargo check --quiet` → 0 errors, 0 new warnings（即 warning 总数不超过 v11.0 基线：0）

### NFR-3: tsc --noEmit 零错误
- 所有 TS 代码变更后：
  - `tsc --noEmit` → 0 errors

### NFR-4: 最小变更原则
- 候选项 2（审计日志）：仅修改 `sql_service.rs`，**不修改** audit_log_service.rs、commands、models
- 候选项 6（单元测试）：仅在 `sql_service.rs` 末尾新增 `mod tests`，**不修改**生产函数
- 候选项 4（store 统一出口）：仅修改 `src/store/index.ts` + 组件 import 路径，**不修改** store 逻辑
- 候选项 3 第一步（settings 独立文件）：仅新建 `types/settings.ts` + 修改 `types/index.ts`，**不修改**组件逻辑

### NFR-5: 编译门禁
- 每个子任务完成后必须执行：
  - Rust 任务：`cd src-tauri; cargo check --quiet` + `cargo test --quiet -p quickersql --lib`
  - TS 任务：`tsc --noEmit`

## Constraints

- **Technical**: 继续使用 Rust + Tauri（后端）、React + Zustand + TypeScript（前端）、ECharts（图表渲染），不引入新框架
- **架构分层**: commands 层不得出现新的 `conn.query` / `conn.execute`；所有 DB 访问必须经 service 层
- **安全约束**: 不引入任何 `format!("SELECT/INSERT/UPDATE/DELETE")` 的 SQL 拼接；所有新增 DB 访问使用参数化查询
- **Tier-1 文件锁**: 不修改 `lib.rs`、`tauri.conf.json`、`capabilities/default.json`、`Cargo.toml`、`package.json`（除非被评估为必要，本次不修改）

## Assumptions

- `AuditLogService::record_audit_log` 签名在当前代码中稳定可用，参数支持 `details: Option<serde_json::Value>` 或等效的字符串字段
- `catch_unwind` 内可以安全地获取 sqlite_conn（在 panic 路径中，sqlite_conn 未被消耗）
- `types/index.ts` 中导出 settings 类型的方式与其他领域一致，组件使用 `from '@/types'` 路径访问
- 当前组件未直接 `from '@/types/index'` 或其他非统一路径访问 settings 类型（若有，在实施阶段发现并修复）

## Acceptance Criteria

### AC-1: DuckDB panic 信息进入审计日志
- **Given**: 用户在 SQL 查询界面提交一条会触发 DuckDB panic 的 SQL（如 `SELECT * FROM nonexistent_schema.nonexistent_table`）
- **When**: `sql_service.rs::execute_sql_batch` 执行 DuckDB 路径并触发 `catch_unwind` 的 `Err(panic_payload)` 分支
- **Then**:
  1. `__audit_logs` 表中新增一条 `module = "sql"`, `action = "query"`, `status = "failed"` 的记录
  2. 该记录的 `description` 字段包含 `"DuckDB panicked"` 字样
  3. 该记录的 `details` 字段包含 panic payload 的可阅读文本
  4. 查询流程继续正常回退到 SQLite，用户看到 SQLite 执行结果（或 SQLite 自身错误）
- **Verification**: `programmatic`（Rust 集成测试验证审计日志记录）+ `human-judgment`（人工触发 panic 验证日志面板显示）

### AC-2: DuckDB 常规错误信息进入审计日志
- **Given**: 用户提交一条 DuckDB 不支持的 SQL（如 `ALTER TABLE ...`）
- **When**: `sql_service.rs::execute_sql_batch` 的 DuckDB 路径返回 `Err(error)`
- **Then**:
  1. `__audit_logs` 表中新增一条 `module = "sql"`, `action = "query"`, `status = "failed"` 的记录
  2. `description` 字段包含 `"DuckDB execution failed"` 字样
  3. `details` 字段包含原始错误信息
  4. 查询流程正常回退到 SQLite
- **Verification**: `programmatic`（Rust 测试）

### AC-3: sql_service.rs 单元测试通过
- **Given**: 开发者在 `src-tauri/src/services/sql_service.rs` 末尾新增了 `#[cfg(test)] mod tests`
- **When**: 执行 `cd src-tauri; cargo test --quiet -p quickersql --lib services::sql_service::tests`
- **Then**:
  1. 所有测试用例（split_sql_statements ≥ 8、parse_drop_table_table_name ≥ 6、should_use_temp_connection ≥ 5）**全部通过**
  2. `cargo check` 无新增 warning
- **Verification**: `programmatic`

### AC-4: store import 路径统一
- **Given**: 开发者完成了 index.ts 补全 + 组件路径修改
- **When**: 执行 `grep -rn "from.*store/.*Store" src/`
- **Then**: 结果为 **0 处**匹配（所有 store import 均走 `from '../../store'` 或等效的统一路径）
- **Verification**: `programmatic`

### AC-5: types/settings.ts 独立文件创建且无编译错误
- **Given**: 开发者新建了 `types/settings.ts` 并从 `types/index.ts` 迁移了 settings 相关类型
- **When**: 执行 `tsc --noEmit`
- **Then**: 0 errors，无任何 TS 编译错误
- **Verification**: `programmatic`

### AC-6: 零新增技术债
- **Given**: v12 所有任务完成
- **When**: 执行以下验证命令
- **Then**:
  - `grep -rn ": any[^a-zA-Z]" src/` → 0 处（与 v11.0 相同）
  - `grep -rn '\.unwrap()\|expect(' src-tauri/src/ --include='*.rs'` → 除测试模块和 lib.rs 主入口外，0 处新增
  - `grep -rn 'format!("[A-Z ]*SELECT\|INSERT\|UPDATE\|DELETE\|ALTER\|CREATE' src-tauri/src/ --include='*.rs'` → 0 处新增
- **Verification**: `programmatic`

## Open Questions

- [ ] **Q1**: `AuditLogService::record_audit_log` 的签名是否支持 `details` 字段接受 `serde_json::Value`？如果仅接受字符串，需在 sql_service.rs 内手动 JSON 序列化。（实施前先阅读 audit_log_service.rs 确认签名）
- [ ] **Q2**: store/index.ts 是否导出了所有需要的 symbol？例如 `useTableStore` 是否在 index.ts 中 re-export？（实施前先阅读 index.ts 和各子 store 文件）
- [ ] **Q3**: 图表类型补齐（热力图/瀑布图/漏斗图）是否有产品需求？当前 v12 不纳入，如后续需要应另起独立 spec。（已确认：不纳入 v12）

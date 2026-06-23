# v12 架构质量加固 — The Implementation Plan (Decomposed and Prioritized Task List)

**总体执行顺序**（共 4 个任务，串行执行后端任务，并行执行前端任务）：
```
任务 1（后端，单元测试，不修改生产逻辑）
  ↓
任务 2（后端，审计日志，修改 sql_service.rs 生产代码）
  ↓
任务 3（前端，store 统一出口）
  ↓
任务 4（前端，types/settings.ts 独立文件）
```

---

## [ ] 任务 1：sql_service.rs 单元测试（纯函数回归防护）

- **Priority**: P0（核心质量加固，最高优先级，不修改生产逻辑，先搭好测试框架）
- **Depends On**: None（起始任务）
- **Description**:
  - 在 `src-tauri/src/services/sql_service.rs` 末尾新增 `#[cfg(test)] mod tests` 模块
  - 为 `split_sql_statements` 编写 ≥ 8 个测试用例
  - 为 `parse_drop_table_table_name` 编写 ≥ 6 个测试用例
  - 为 `should_use_temp_connection` 编写 ≥ 5 个测试用例
  - **不修改任何生产函数代码**（不修改 split_sql_statements、parse_drop_table_table_name、should_use_temp_connection 的实现）

- **关键实现细节 / 方法**:
  - 测试用例命名遵循 `test_<场景>_<期望结果>`（如 `test_split_sql_single_statement_success`）
  - 边界场景必须覆盖：空字符串、纯分号、字符串内含分号、`--` 注释、`/* */` 块注释、末尾无分号、多空格、大小写混合
  - 测试函数内部仅 `assert_eq!`、`assert!`，**不使用 unwrap()**（除测试辅助函数外）

- **Acceptance Criteria Addressed**: AC-3, AC-6（零新增技术债）

- **Test Requirements**:
  - `programmatic` TR-1.1: `cd src-tauri; cargo test --quiet -p quickersql --lib services::sql_service::tests` → **0 failing tests**
  - `programmatic` TR-1.2: `cd src-tauri; cargo check --quiet` → **0 errors, 0 warnings**
  - `programmatic` TR-1.3: `grep -rn 'pub fn.*split_sql_statements\|pub fn.*parse_drop_table\|pub fn.*should_use_temp' src-tauri/src/services/sql_service.rs` → **生产函数签名保持不变**（通过 git diff 确认）
  - `human-judgment` TR-1.4: `mod tests` 中的测试用例按函数分组，每组有清晰的注释

- **Notes**: 先完成此任务再做任务 2（审计日志）。因为单元测试不修改任何生产代码，风险为零，可以先确认测试框架能工作。

---

## [ ] 任务 2：sql_service.rs catch_unwind → 审计日志（DuckDB 错误可观测性）

- **Priority**: P0（核心质量加固，与任务 1 同优先级，但**依赖任务 1 完成**后才开始，避免同一文件并发冲突）
- **Depends On**: 任务 1（完成后才开始，因为两者都修改 `sql_service.rs`）
- **Description**:
  - 阅读 `src-tauri/src/services/audit_log_service.rs`，确认 `record_audit_log` 的完整签名（参数名、类型、返回值）
  - 在 `sql_service.rs` 的 `execute_sql_batch` 函数内，找到 `catch_unwind(|| duckdb_conn_guard.query(...))` 的 `Ok(Err(e))` 和 `Err(e)` 两个分支
  - 在两个分支的**现有回退逻辑执行前**，调用 `AuditLogService::record_audit_log(sqlite_conn, request)` 将错误信息写入 `__audit_logs`
  - 保持现有回退逻辑完全不变（即 panic/错误后仍会回退到 SQLite）
  - 错误写入审计日志的逻辑必须在 `catch_unwind` 分支内完成，**不得破坏错误恢复流**

- **关键实现细节 / 方法**:
  - `module = "sql"`, `action = "query"`, `status = "failed"`
  - `description` 区分两种路径：
    - panic 路径：`"DuckDB panicked, fell back to SQLite"`
    - 常规错误路径：`"DuckDB execution failed, fell back to SQLite"`
  - `details` 需要将 panic payload / error 信息序列化为可阅读的文本（JSON 或纯字符串）
  - 注意：panic payload 的类型是 `Box<dyn Any + Send>`，需要 `downcast_ref::<String>()` 或 `downcast_ref::<&str>()` 才能提取为字符串；若无法提取，用 `"panic payload could not be serialized"` 替代
  - 执行顺序：**先写审计日志 → 再执行 SQLite 回退**（这样即使 SQLite 回退也失败，至少 DuckDB 的错误已经被记录）

- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-6

- **Test Requirements**:
  - `programmatic` TR-2.1: `cd src-tauri; cargo check --quiet` → **0 errors, 0 warnings**
  - `programmatic` TR-2.2: `cd src-tauri; cargo test --quiet -p quickersql --lib services::sql_service::tests` → **0 failing tests**（任务 1 新增的测试不应被破坏）
  - `human-judgment` TR-2.3: 在应用中手动执行一条会触发 DuckDB 错误的 SQL（如 `ALTER TABLE nonexistent_table RENAME TO x`），检查审计日志面板是否新增一条 `module = "sql"`, `status = "failed"` 的记录
  - `programmatic` TR-2.4: `grep -rn '\.unwrap()\|expect(' src-tauri/src/services/sql_service.rs` → **0 处**（不含 `#[cfg(test)] mod tests` 内的测试代码）

- **Notes**:
  - 若 `AuditLogService::record_audit_log` 需要 `sqlite_conn: &rusqlite::Connection`，请确认在 `catch_unwind` 分支内 `sqlite_conn` 仍有效且未被移动（Rust 所有权分析）
  - 错误写入审计日志失败时，**不要阻断回退逻辑**（即 record_audit_log 返回 Err 时只 log::warn! 不影响后续回退）
  - 与任务 1 的文件冲突避免：任务 1 修改 `sql_service.rs` 末尾（mod tests），任务 2 修改中部（catch_unwind 分支），串行执行可避免冲突

---

## [ ] 任务 3：store/index.ts 统一出口（前端架构一致性）

- **Priority**: P1（架构一致性，重要但非阻塞）
- **Depends On**: 任务 2（或与任务 4 并行，但依赖后端任务的 Tier-1 文件不冲突即可；前端任务可与后端任务并行，但为简化，建议串行）
- **Description**:
  - 第一步：阅读 `src/store/index.ts` 和所有子 store 文件（`tableStore.ts`、`taskStore.ts`、`queryStore.ts`、`projectStore.ts`、`importStore.ts`、`workspaceStore.ts`、`settingsStore.ts`、`toastStore.ts`、`dashboardStore.ts`、`appStore.ts` 等），列出所有从子文件导出的 **公共 symbol**（包括 hook、const、type、interface 等）
  - 第二步：在 `src/store/index.ts` 中补全所有当前未 re-export 的公共 symbol（例如 `useTableStore`、`SIDEBAR_DEFAULT_WIDTH`、各 store 导出的 const 等）
  - 第三步：在 `src/` 目录中 grep 出所有 `from '../../store/xxxStore'` 或类似直接 import 子文件的路径，统一改为 `from '../../store'`
  - 预计修改文件数：1 (index.ts) + ~10 (组件文件) = ~11 个文件
  - **不修改任何 store 的业务逻辑代码**（不修改 state/action，仅改 export 和 import 路径）

- **关键实现细节 / 方法**:
  - 执行 `grep -rn "from.*store/.*Store" src/` → 列出所有需要修改的组件文件
  - 注意：有些组件可能 import 的是 `SIDEBAR_DEFAULT_WIDTH` 等常量（非 hook），确保这些常量也从 index.ts 导出
  - 为避免 `use*` 重名冲突，优先使用 `export { useTableStore } from './tableStore'` 而非 `export * from './tableStore'`
  - 修改后必须验证：`grep -rn "from.*store/.*Store" src/` → **0 处匹配**

- **Acceptance Criteria Addressed**: AC-4, AC-6

- **Test Requirements**:
  - `programmatic` TR-3.1: `tsc --noEmit` → **0 errors**
  - `programmatic` TR-3.2: `grep -rn "from.*store/.*Store" src/` → **0 处直接 import 子文件**
  - `human-judgment` TR-3.3: `src/store/index.ts` 的 export 列表完整，各 store 的公共 hook 与 const 均可从 `from './store'` 访问

- **Notes**:
  - 建议使用 IDE 的 "find all references" 或 "rename import path" 功能，但最终需手动确认
  - 与任务 4 可并行执行（修改路径不同：store/ vs types/），但为简化建议串行，先完成任务 3 再做任务 4

---

## [ ] 任务 4：types/settings.ts 独立文件（前端类型文件规范）

- **Priority**: P1（架构一致性，与任务 3 同级别）
- **Depends On**: 任务 3 完成后开始，或与任务 3 并行（两者修改路径不冲突）
- **Description**:
  - 第一步：阅读 `src/types/index.ts`，找到 settings 相关类型定义（`SettingItem`、`SettingCategory`、`SettingsListResponse`、`UpdateSettingRequest`、`ExportSettingsResponse`、`ImportSettingsRequest` 等）
  - 第二步：新建 `src/types/settings.ts`，将第一步找到的 settings 相关类型定义完整迁移过来
  - 第三步：修改 `src/types/index.ts`，用 `export * from './settings'` 或 `export { SettingItem, ... } from './settings'` 替代原有内联定义
  - 第四步：若有组件文件直接 import settings 类型的路径（如 `from '@/types/index'` 或硬编码路径），**保持不变**（通过 index.ts 中转即可兼容）
  - 预计修改文件数：1 (新建 settings.ts) + 1 (修改 index.ts) = **仅 2 个文件**

- **关键实现细节 / 方法**:
  - 遵循 `types/chart.ts`、`types/dashboard.ts`、`types/workspace.ts` 等现有领域文件的风格
  - `export interface SettingItem { ... }` 而非 `const SettingItem = ...`
  - 保留原有 JSDoc 注释（若有）
  - **不修改任何组件代码**（仅修改 types/ 目录内的 2 个文件）

- **Acceptance Criteria Addressed**: AC-5, AC-6

- **Test Requirements**:
  - `programmatic` TR-4.1: `tsc --noEmit` → **0 errors**
  - `programmatic` TR-4.2: `grep -rn "SettingItem\|SettingCategory" src/types/index.ts` → **0 处内联定义**（全部通过 re-export 访问）
  - `human-judgment` TR-4.3: `src/types/settings.ts` 文件存在且类型定义风格与 `types/chart.ts` 等其他领域文件一致

- **Notes**:
  - 此任务最小范围，仅 2 个文件，目的是建立 settings 领域的独立类型文件，作为后续更广泛类型整理的基础
  - 与任务 3 并行执行无冲突（任务 3 修改 store/ 和 components/，任务 4 仅修改 types/）

---

## 角色与分工汇总

| 角色 | 负责任务 | 修改目录 | 预计改动范围 |
|------|---------|---------|-------------|
| **@后端** | 任务 1 + 任务 2 | `src-tauri/src/services/sql_service.rs` | ~300-400 行新增（测试 + 审计日志逻辑） |
| **@前端** | 任务 3 + 任务 4 | `src/store/index.ts` + `src/components/*/` (~10 个组件) + `src/types/` (2 个文件) | ~50-100 行修改（主要是 import 路径 + 类型迁移） |
| **@架构** | 全局验证 + 更新架构现状文档 | `docs/架构现状.md` | v12 版本记录 |

---

## 任务间文件冲突避免

| 任务对 | 是否冲突 | 冲突原因 | 解决方式 |
|--------|---------|---------|---------|
| 任务 1 vs 任务 2 | **是** | 两者均修改 `sql_service.rs` | **串行执行**（任务 1 先做，任务 2 后做） |
| 任务 3 vs 任务 4 | **否** | 任务 3 修改 store/ + components/，任务 4 修改 types/，无交集 | 可并行，建议串行简化 |
| 任务 1/2 vs 任务 3/4 | **否** | 后端修改 src-tauri/，前端修改 src/，完全无交集 | 可并行执行 |

---

## 整体门禁（全部任务完成后验证）

以下必须在 v12 全部任务完成后通过：

1. ✅ `cd src-tauri; cargo check --quiet` → 0 errors, 0 warnings
2. ✅ `cd src-tauri; cargo test --quiet -p quickersql --lib services::sql_service::tests` → 0 failing
3. ✅ `tsc --noEmit` → 0 errors
4. ✅ `grep -rn "from.*store/.*Store" src/` → 0 处
5. ✅ `grep -rn ": any[^a-zA-Z]" src/` → 0 处（或与 v11.0 基线相等）
6. ✅ `src/types/settings.ts` 文件存在

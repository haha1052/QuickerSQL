# QuickerSQL 剩余技术债 v14.1 — Product Requirement Document

## Overview
- **Summary**: 清理 v14.0 文档中标记的两条剩余技术债：T-007（多语句 SQL 缓存路由，P1）与 T-008（系统表 ensure_* 函数合并优化，P3）。目标是：对多语句只读 SQL 实现"部分命中→只执行未命中的语句并合并结果"的优化；对系统表初始化代码做结构合并，减少重复模式。
- **Purpose**: 提升高频多语句 SQL 场景的性能（如仪表盘批量查询、自动化任务脚本）、减少代码重复模式、降低维护成本。
- **Target Users**: 日常在 QuickerSQL 中执行多语句只读 SQL 的用户、维护代码的开发者。

## Goals
- **G1（T-007）**: 在 `execute_sql` 中实现多语句 SQL 的"部分命中缓存"逻辑——将每条语句独立查询缓存，命中则直接返回缓存值，未命中则执行并回写缓存。最终结果按原始顺序合并。
- **G2（T-007）**: 为此新增 `#[cfg(test)]` 单元测试，覆盖 3 种场景：全部命中 / 部分命中 / 全部未命中。
- **G3（T-008）**: 将 `lib.rs` 中的系统表 ensure_* 函数数组（8 个独立 `(fn, &str)` 元组）重构为一个更简洁的可维护模式，保持功能完全一致。
- **G4**: 全部通过 `cargo check --quiet`、`cargo test --quiet`、`npx tsc --noEmit --pretty`、`npx vitest run` 四重门禁。

## Non-Goals (Out of Scope)
- ❌ 不引入外部缓存系统（如 Redis、memcache）。
- ❌ 不修改缓存数据结构（继续使用 `QueryCacheService` 现有 LRU + TTL 实现）。
- ❌ 不对写操作（INSERT/UPDATE/DELETE/DROP）做缓存保留——写操作仍然触发全量失效（已有行为保持不变）。
- ❌ 不修改前端 UI（T-007 与 T-008 均为纯后端改动）。
- ❌ 不引入 SQL 语句级别的参数化查询改写——`make_cache_key` 保持现有行为（按语句文本 + 空参数生成 key）。

## Background & Context

### T-007 背景
当前 `commands/sql.rs` 的缓存路径（第 44-109 行）对多语句 SQL 采用"全有或全无"策略：
```rust
if stmts.len() > 1 {
    // 路径 A：所有语句必须是只读，逐条查缓存
    // 若 all_cacheable 为 true，则逐条查缓存
    // 必须 100% 命中才能走缓存路径
    // 只要一条未命中 → 全部重新执行
    // 回写缓存也是逐条写回（第 120-154 行的执行后逻辑）
}
```

**问题**: 10 条 SELECT 语句中有 9 条命中缓存时，仍然要重新执行全部 10 条——浪费 90% 的缓存收益。

**现有基础设施**:
- `services/query_cache_service.rs` 已提供 `get(key)` / `set(key, result)` / `is_enabled()` / `invalidate_all()`。
- `services/sql_service.rs::split_sql_statements(sql)` 已可正确拆分多语句（含字符串内分号、注释等）。
- `is_cacheable(stmt)` / `is_write_operation(stmt)` 已在 `query_cache_service` 暴露。
- `services/sql_service.rs::execute_sql_batch` 已可执行单/多语句，返回 `BatchExecuteResult { results, success_count, fail_count }`。

### T-008 背景
`src-tauri/src/lib.rs` 第 89-98 行存在以下模式：
```rust
let ensure_fns: &[(fn(&MutexGuardConnection<'_>) -> Result<(), String>, &str)] = &[
    (crate::services::AuditLogService::ensure_audit_log_table_exists, "审计日志表"),
    (crate::services::TrashService::ensure_trash_table_exists, "回收站表"),
    (crate::services::SettingsService::ensure_settings_table_exists, "设置表"),
    (crate::services::QueryHistoryService::ensure_query_history_table_exists, "查询历史表"),
    (crate::services::TaskService::ensure_tables_exists, "自动化任务表"),
    (crate::services::DashboardService::ensure_tables_exist, "仪表盘/图表表"),
    (crate::services::AppStateService::ensure_app_state_table_exists, "应用状态表"),
    (crate::services::AppStateService::ensure_workspace_tables_exist, "工作区表"),
];
```

**问题**: 存在重复的类型签名 + 冗余的元组模式，每行重复书写 `(crate::services::XxxService::ensure_xxx, "xxx表")`，共 8 个函数指针重复。功能正常，但维护成本较高——每次新增系统表需在两处改（数组 + 实际函数）。

**改进方向**: 定义一个常量 `&[(&str, fn(&MutexGuardConnection<'_>) -> Result<(), String>)]` 或结构化枚举，将"表名-函数"对合并为更清晰的模式。

## Functional Requirements

### FR-1（T-007）: 多语句 SQL 的缓存部分命中
- 当多语句 SQL 全部为只读（`is_cacheable` 为 true）时，进入"部分命中"路径：
  1. 对每条语句生成 `make_cache_key(stmt, &[])` 查缓存。
  2. 若所有语句均命中缓存 → 直接返回所有缓存结果（现有行为）。
  3. 若部分命中、部分未命中 → 仅执行未命中的语句，并将新结果按原始位置填入 results 数组；所有新执行成功的语句写回缓存。
  4. 若全部未命中 → 走正常执行路径（等同于现有路径）。
- 当多语句 SQL 中包含写操作 → 保持现有行为：执行后 `invalidate_all()`。
- `BatchExecuteResult` 的 `success_count` / `fail_count` 必须正确反映混合缓存+执行场景的计数。

### FR-2（T-007）: 按位置合并结果保持顺序
- 最终返回的 `results: Vec<SqlStatementResult>` 必须按原始语句顺序排列。
- 缓存命中项的 `statement` 字段必须与原始语句一致（与原单语句路径相同）。

### FR-3（T-008）: 系统表初始化代码结构优化
- 将 8 个 `(fn, &str)` 元组重构为更易维护的结构（推荐：单独定义常量数组 `const SYSTEM_TABLE_ENSURE_FNS`，使初始化循环体引用该常量即可）。
- 保持现有错误处理与日志行为不变：每个 ensure 失败不阻止其他表初始化，失败时打印 `warn!`。
- 保持事务包裹行为（`begin_transaction` → `commit_transaction` / 回退到非事务模式）不变。

## Non-Functional Requirements

- **NFR-1 性能**: T-007 路径中，部分命中缓存的执行总耗时应 ≈ "未命中率 × 单语句耗时"，而非 `n × 单语句耗时`（性能优化目标）。
- **NFR-2 安全性**: 所有新增代码遵循架构分层——`commands/sql.rs` 仅做缓存判断与连接获取，实际执行仍在 `services/sql_service.rs`，不引入新的 `conn.query` / `conn.execute`。
- **NFR-3 可测试性**: T-007 的逻辑应在 `commands/sql.rs` 的 `#[cfg(test)]` 中或新的 `services/sql_service.rs` tests 模块中覆盖至少 3 个场景（全命中/部分命中/全未命中）。
- **NFR-4 代码简洁性**: T-008 重构后，`lib.rs` 系统表初始化代码减少至少 10 行纯重复代码。

## Constraints

- **技术栈**: Rust 1.80+ / tauri v2 / SQLite / DuckDB（保持不变）。
- **分层架构**: 严格遵守 `commands → services → database` 三层架构。SQL 仅出现在 `services/` 和 `database/` 层。
- **依赖管理**: 不引入新的 crate。
- **测试范围**: 不新增前端测试文件，仅在 Rust 端补充单元测试。

## Assumptions

- 多语句只读 SQL 全部使用同一个 SQLite 连接或 DuckDB 连接执行（与现有 `execute_sql_batch` 行为一致）。
- `split_sql_statements` 对含注释/字符串的复杂 SQL 拆分正确——无需重写。
- 写操作（INSERT/UPDATE/DELETE/DROP）的缓存失效策略保持不变：全部失效。

## Acceptance Criteria

### AC-1: 多语句全部命中缓存时走快速路径
- **Given**: 有多语句只读 SQL `SELECT 1; SELECT 2; SELECT 3;`，且 3 条语句均已写入缓存。
- **When**: 调用 `execute_sql(state, sql)`。
- **Then**: 返回 `BatchExecuteResult { success_count: 3, fail_count: 0, results: [...] }`，且 `results` 顺序与原始语句一致；不实际执行任何 SQL。
- **Verification**: `programmatic`（Rust 单元测试）。

### AC-2: 多语句部分命中缓存时只执行未命中的语句
- **Given**: 有多语句只读 SQL `SELECT 1; SELECT 2; SELECT 3;`，其中第 1、3 条已写入缓存，第 2 条未写入。
- **When**: 调用 `execute_sql(state, sql)`。
- **Then**: 返回 `BatchExecuteResult { success_count: 3, fail_count: 0 }`；第 1、3 条结果来自缓存，第 2 条结果来自实际执行；第 2 条执行完成后写回缓存。
- **Verification**: `programmatic`（Rust 单元测试 + mock/可验证的执行计数）。

### AC-3: 多语句全未命中时退化为现有行为
- **Given**: 有多语句只读 SQL `SELECT 4; SELECT 5;`，均未在缓存中。
- **When**: 调用 `execute_sql(state, sql)`。
- **Then**: 全部通过 `execute_sql_batch` 执行；所有成功语句均被写回缓存；`success_count = 2, fail_count = 0`。
- **Verification**: `programmatic`（Rust 单元测试）。

### AC-4: 含写操作的多语句不进入缓存路径
- **Given**: 有多语句混合 SQL `INSERT INTO t VALUES(1); SELECT * FROM t;`。
- **When**: 调用 `execute_sql(state, sql)`。
- **Then**: 完全走 `execute_sql_batch` 正常执行；执行完成后 `invalidate_all()` 清理缓存；返回正确的执行结果。
- **Verification**: `programmatic`（Rust 单元测试）。

### AC-5: lib.rs 系统表初始化结构优化后保持功能等价
- **Given**: 优化后的 `SYSTEM_TABLE_ENSURE_FNS` 常量数组结构。
- **When**: 运行完整 `cargo test` 和应用启动自检。
- **Then**: 8 个系统表的确保创建行为、事务包裹、错误处理与日志输出与优化前完全一致。
- **Verification**: `programmatic`（`cargo test` + `cargo check` 通过 + 代码 diff 无功能变更）。

### AC-6: 四重门禁全部通过
- **Given**: 所有 T-007 和 T-008 修改已提交。
- **When**: 执行 `cargo check --quiet`、`cargo test --quiet`、`npx tsc --noEmit --pretty`、`npx vitest run`。
- **Then**: 全部通过（无 error、0 failing）。
- **Verification**: `programmatic`（终端命令）。

## Open Questions

- [x] Q1: T-007 中的"部分命中"逻辑应放在 `commands/sql.rs` 还是下沉到 `services/sql_service.rs`？
  - **决策**: 下沉到 `services/sql_service.rs` 内部 `execute_sql_batch`，让 commands 层保持简单——只做"是否全部命中缓存"的快速短路判断，剩余逻辑交给 service 层统一处理。理由：与现有"commands 只做参数校验+连接获取"的分层原则一致。
- [x] Q2: T-008 的重构标准——减少重复代码的精确目标是什么？
  - **决策**: 定义 `const SYSTEM_TABLE_ENSURE_FNS: &[(&str, fn(&MutexGuardConnection<'_>) -> Result<(), String>)] = &[...]`；将 (函数, 描述) 的顺序改为 (描述, 函数) 以便可读性；目标是使 `TauriAppState::new()` 中的初始化循环减少 5-10 行重复代码。
- [x] Q3: T-007 的单元测试如何在无真实数据库连接的情况下验证"执行次数减少"？
  - **决策**: 在 `services/sql_service.rs` 内的 `#[cfg(test)] mod tests` 中新增测试，验证 `split_sql_statements` + 缓存 key 生成逻辑；对"部分命中"逻辑本身，引入一个可 mock 的执行计数器（通过重构 `execute_sql_batch` 为可传入执行函数的形式，或在 `commands/sql.rs` 内的路径上做状态计数测试）。若测试过于复杂，则退化为在 `query_cache_service.rs` 的现有测试框架内，通过验证 `set` 调用次数，间接证明部分命中减少了 SQL 执行。

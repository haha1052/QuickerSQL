# QuickerSQL 剩余技术债 v14.1 — 多角色实施计划

> **整体原则**: T-007 与 T-008 彼此独立，可由两个不同的子 Agent 并行推进。
> **预计总耗时**: 2-3 小时（并行）。

---

## 【并行任务组 A】T-007：多语句 SQL 缓存路由（P1）

### 角色
- **@后端（子 Agent A）**: 负责 Rust 层的缓存逻辑重构与测试

---

## [ ] Task A-1: 梳理缓存路径，定义"部分命中"的内部辅助函数

- **Priority**: P1
- **Depends on**: None
- **Owner**: @后端
- **Description**:
  - 在 `services/sql_service.rs` 中新增两个辅助函数：
    1. `try_partial_cache_hit(sqlite_conn, duckdb_opt, db_manager, sql, &state.query_cache) -> Option<BatchExecuteResult>`
       - 逻辑：拆分 sql → 检查是否全只读 → 逐条查缓存 → 若部分命中，则仅执行未命中语句 → 合并结果 → Some(result)；若全部未命中则返回 None（走原路径）。
    2. `is_all_readonly(stmts: &[String]) -> bool`
       - 简单包装：检查所有语句是否 `is_cacheable`。
  - 注意：`is_cacheable` / `is_write_operation` / `make_cache_key` 需从 `query_cache_service` 重新导出或在 `sql_service.rs` 内使用 `use crate::services::query_cache_service::{is_cacheable, is_write_operation, make_cache_key};`。
- **Acceptance Criteria Addressed**: FR-1, FR-2, NFR-1
- **Test Requirements**:
  - `programmatic` TR-A1-1: `is_all_readonly(["SELECT 1", "SELECT 2"])` → true
  - `programmatic` TR-A1-2: `is_all_readonly(["SELECT 1", "INSERT INTO t VALUES(1)"])` → false
  - `programmatic` TR-A1-3: `try_partial_cache_hit` 在所有语句均未命中时返回 `None`
- **Notes**: 先实现辅助函数，**暂不修改** `commands/sql.rs` 的调用路径。

---

## [ ] Task A-2: 重构 `execute_sql_batch` 以支持内部"部分命中 → 部分执行"

- **Priority**: P1
- **Depends on**: Task A-1
- **Owner**: @后端
- **Description**:
  - 重构 `execute_sql_batch` 的内部循环逻辑：
    - 对每条语句，先检查是否有缓存命中（通过外部传入的 `&QueryCacheService` 或一个简化的只读缓存检查接口）。
    - 命中则直接使用缓存结果，未命中则执行。
  - 在 `commands/sql.rs` 中，将 `execute_sql` 的缓存路径更新为：
    1. 快速短路：若所有语句均已在缓存中 → 直接返回（原有路径，保留以获得最快性能）。
    2. 否则调用新的 `execute_sql_batch`（它内部会处理部分命中 + 回写）。
  - **关键改动清单**:
    - `services/sql_service.rs::execute_sql_batch` 签名增加 `query_cache: Option<&QueryCacheService>` 参数（或通过 state 传入）。
    - `commands/sql.rs::execute_sql` 更新调用时传入缓存引用。
- **Acceptance Criteria Addressed**: FR-1, FR-2, NFR-2
- **Test Requirements**:
  - `programmatic` TR-A2-1: 模拟 3 条语句，1、3 命中缓存，2 未命中。验证最终结果有 3 条，`success_count = 3`。
  - `programmatic` TR-A2-2: 2 条语句全未命中 → 正常执行，`success_count = 2`，且写回缓存。
  - `programmatic` TR-A2-3: 3 条语句全命中 → 走快速短路路径，`success_count = 3`，0 次 SQL 执行。
- **Notes**: 由于 `QueryCacheService` 内部用 `Mutex<InnerCache>`，需要确保在 sql_service 中引入它时遵循 `Arc<QueryCacheService>` 或 &QueryCacheService 的方式传递。

---

## [ ] Task A-3: 写操作检测保持不变 + 失败路径回归

- **Priority**: P1
- **Depends on**: Task A-2
- **Owner**: @后端
- **Description**:
  - 写操作检测逻辑（含写操作时 `invalidate_all()`）保持在 `commands/sql.rs`。
  - 确保新的"部分命中"路径不会意外缓存写操作结果。
- **Acceptance Criteria Addressed**: FR-1（写操作分支）, AC-4
- **Test Requirements**:
  - `programmatic` TR-A3-1: 多语句混合 `INSERT INTO t VALUES(1); SELECT * FROM t;` → 不走缓存，执行后 `invalidate_all()` 被调用。
  - `programmatic` TR-A3-2: 纯写操作 `DELETE FROM t WHERE id = 1;` → 不走缓存，执行后 `invalidate_all()`。
- **Notes**: 这是防御性测试——确保写操作永远不会进入缓存路径。

---

## [ ] Task A-4: 门禁回归 + 自测

- **Priority**: P1
- **Depends on**: Task A-1, A-2, A-3
- **Owner**: @后端
- **Description**:
  - `cd src-tauri; cargo check --quiet` → 0 errors
  - `cd src-tauri; cargo test --quiet` → 所有测试通过
  - `cd ..; npx tsc --noEmit --pretty` → 0 errors（确保前端无连锁问题）
  - `cd ..; npx vitest run` → 43 tests passed（保持前端单元测试不变）
- **Acceptance Criteria Addressed**: AC-6
- **Test Requirements**:
  - `programmatic` TR-A4-1: `cargo check --quiet` 退出码 0
  - `programmatic` TR-A4-2: `cargo test --quiet` 退出码 0
  - `programmatic` TR-A4-3: `npx tsc --noEmit --pretty` 退出码 0
  - `programmatic` TR-A4-4: `npx vitest run` 退出码 0

---

## 【并行任务组 B】T-008：系统表 ensure_* 函数合并优化（P3）

### 角色
- **@架构（子 Agent B）**: 负责 `lib.rs` 的结构性重构，最小化改动，保持功能等价

---

## [ ] Task B-1: 抽取 `SYSTEM_TABLE_ENSURE_FNS` 常量

- **Priority**: P3
- **Depends on**: None
- **Owner**: @架构
- **Description**:
  - 在 `lib.rs` 的 `TauriAppState::new()` 之前或一个独立 `mod` 中定义：
    ```rust
    use crate::database::MutexGuardConnection;

    type EnsureFn = fn(&MutexGuardConnection<'_>) -> Result<(), String>;

    const SYSTEM_TABLE_ENSURE_FNS: &[(&str, EnsureFn)] = &[
        ("审计日志表", crate::services::AuditLogService::ensure_audit_log_table_exists),
        ("回收站表", crate::services::TrashService::ensure_trash_table_exists),
        ("设置表", crate::services::SettingsService::ensure_settings_table_exists),
        ("查询历史表", crate::services::QueryHistoryService::ensure_query_history_table_exists),
        ("自动化任务表", crate::services::TaskService::ensure_tables_exists),
        ("仪表盘/图表表", crate::services::DashboardService::ensure_tables_exist),
        ("应用状态表", crate::services::AppStateService::ensure_app_state_table_exists),
        ("工作区表", crate::services::AppStateService::ensure_workspace_tables_exist),
    ];
    ```
  - 用 `SYSTEM_TABLE_ENSURE_FNS.iter()` 替换原 `ensure_fns` 数组的内联定义。
- **Acceptance Criteria Addressed**: FR-3, NFR-4
- **Test Requirements**:
  - `programmatic` TR-B1-1: `cargo check --quiet` → 0 errors（确保类型签名匹配）
- **Notes**: `type EnsureFn` 的定义必须与实际函数签名精确匹配——如参数生命周期、返回类型不一致会导致编译失败，需在首次 `cargo check` 时微调到精确匹配。

---

## [ ] Task B-2: 简化 `TauriAppState::new()` 中的初始化循环

- **Priority**: P3
- **Depends on**: Task B-1
- **Owner**: @架构
- **Description**:
  - 现有的事务 + 回退循环模式（第 100-123 行）保持完全不变——只改变数据源为 `SYSTEM_TABLE_ENSURE_FNS`。
  - 目标：将 `TauriAppState::new()` 中约 15 行的内联 `ensure_fns` 数组定义缩减为 1 行引用。
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `programmatic` TR-B2-1: `cargo test --quiet` → 0 failing（保持所有单元测试通过）
  - `human-judgment` TR-B2-2: 代码 diff 中无功能逻辑变更（仅结构重排）——通过人工 review diff 确认。

---

## [ ] Task B-3: 门禁回归

- **Priority**: P3
- **Depends on**: Task B-1, B-2
- **Owner**: @架构
- **Description**:
  - 与 Task A-4 相同的四门门禁。
  - 由于 T-008 不涉及前端改动，`tsc` / `vitest` 应自然通过。
- **Acceptance Criteria Addressed**: AC-6
- **Test Requirements**:
  - `programmatic` TR-B3-1: `cargo check --quiet` 0 errors
  - `programmatic` TR-B3-2: `cargo test --quiet` 0 failing
  - `programmatic` TR-B3-3: `npx tsc --noEmit --pretty` 0 errors
  - `programmatic` TR-B3-4: `npx vitest run` 全通过

---

## 【收敛阶段】两个任务组完成后合并门禁

## [ ] Task C-1: 合并 A + B 的改动，运行最终四门门禁

- **Priority**: P1
- **Depends on**: Task A-4, Task B-3
- **Owner**: @架构（最终收敛）
- **Description**:
  - 确保 T-007 与 T-008 的改动在同一工作副本中共存无冲突（理论上两者修改不同文件或不同 `lib.rs` 区域，冲突概率低）。
  - 最终执行一次完整的四门门禁：
    ```powershell
    cd src-tauri; cargo check --quiet; cargo test --quiet
    cd ..; npx tsc --noEmit --pretty; npx vitest run
    ```
- **Acceptance Criteria Addressed**: AC-6
- **Test Requirements**:
  - `programmatic` TR-C1-1: 所有门禁退出码 0
  - `human-judgment` TR-C1-2: 最终 diff 摘要确认改动范围合理（无意外文件变更）

---

## 任务依赖图

```
Task A-1 ─┐
          ├─► Task A-2 ─► Task A-3 ─► Task A-4 ─┐
Task B-1 ─┼──────────────────────────────────────┼─► Task C-1
          └─► Task B-2 ───────────► Task B-3 ────┘
```

**并行推进策略**:
- **时间片 1**: Task A-1 与 Task B-1 同时开始
- **时间片 2**: Task A-2 与 Task B-2 同时开始（各自依赖已完成）
- **时间片 3**: Task A-3 + A-4 与 Task B-3 并行推进
- **时间片 4**: Task C-1（必须等待 A、B 全部完成）

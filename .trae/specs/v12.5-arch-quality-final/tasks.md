# v12.5 架构质量收尾 — 实施计划（分解为原子任务）

## 角色分工总览

| 角色 | 负责任务 | 预期改动 |
|------|---------|---------|
| **@后端** | 任务 1 + 任务 2 + 任务 3 | `database_service.rs`（新方法 ~45 行）+ `commands/database.rs`（44 行 → 10 行） |
| **@架构** | 任务 4（文档更新 + M7 检查） | `docs/架构现状.md` 更新 + M7 条件报告 |

---

## [ ] 任务 1：在 `database_service.rs` 新增 `get_table_performance_info` 方法

- **Priority**: P0
- **Depends On**: None（起始任务）
- **Description**:
  - 在 `src-tauri/src/services/database_service.rs` 中，参考现有 `get_table_meta(conn, table_name)` 方法的风格，新增一个新方法：
  ```
  pub fn get_table_performance_info(
      conn: &MutexGuardConnection,
      table_name: &str,
  ) -> Result<TableMetaInfo, String>
  ```
  - 方法内部逻辑：
    1. `let ident = SqlIdentifier::new(table_name)?;` — 表名安全校验
    2. 执行 `PRAGMA index_list(<quoted_table_name>)` — 获取索引数量 `result.rows.len()`
    3. 执行 `PRAGMA page_size` — 获取 page_size
    4. 执行 `PRAGMA page_count` — 获取 page_count
    5. 执行 `PRAGMA freelist_count` — 获取 freelist_count
    6. 执行 `SELECT COUNT(*) FROM sqlite_master WHERE type='table'` — 获取表总数
    7. 计算 `size_bytes = page_size.saturating_sub(freelist_count).saturating_mul(page_size) / table_count.max(1)`（注意：要正确的公式是 `page_size × (page_count - freelist_count) / table_count`）
    8. 返回 `TableMetaInfo { index_count, size_bytes }`
  - 每一步查询的错误处理：`conn.query(...).ok().and_then(...).unwrap_or(0)` 模式（与原 commands 代码一致）— 元数据失败时降级为默认值而非让整个命令失败
  - **重要**: `TableMetaInfo` 定义在 `src-tauri/src/commands/database.rs:165-168`，需要确保 database_service.rs 能访问该结构体。方案：在 `database_service.rs` 顶部添加 `use crate::commands::database::TableMetaInfo;`，或者更优雅的做法：将 `TableMetaInfo` 从 commands 移到 `models/database.rs`，两边都从 models 引入（这是架构正确的做法，但改动略大，需评估）
  - 为简化改动，推荐方案：**将 `TableMetaInfo` 从 commands 移到 `models/database.rs`**，然后两边通过 `use crate::models::database::TableMetaInfo;` 引用。这是一个小改动（1 处删除 + 1 处新增 + 2 处 use 更新），但符合架构分层要求。
  - PRAGMA 语句的安全注意：PRAGMA index_list(...) 的表名通过 `format!("PRAGMA index_list({})", ident.quoted())` 拼接，这是合理的，因为 ident 已通过 SqlIdentifier 校验。其他 PRAGMA 无用户输入参数，完全安全。

- **Acceptance Criteria Addressed**: AC-1, AC-3, AC-4

- **Test Requirements**:
  - `programmatic` TR-1.1: `cd src-tauri; cargo check --quiet` → 0 errors, 0 new warnings
  - `programmatic` TR-1.2: `grep -rn '\.unwrap()\|expect(' src-tauri/src/services/database_service.rs | grep -v "#\[cfg(test)\]"'` → 0 处新增 unwrap
  - `human-judgment` TR-1.3: 代码审查确认 SqlIdentifier 校验正确，表名通过 ident.quoted() 拼接

- **Notes**: 
  - TableMetaInfo 的迁移路径：`commands/database.rs:165-168` → `models/database.rs` 末尾；然后两边 `use crate::models::database::TableMetaInfo;`
  - 如果发现 `TableMetaInfo` 已被前端通过 `#[derive(Serialize, Deserialize)]` 序列化，请确保迁移到 models 后序列化属性保持不变

---

## [ ] 任务 2：简化 `commands/database.rs` 的 `get_table_meta`

- **Priority**: P0
- **Depends On**: 任务 1（必须先有 service 层的新方法，commands 才能调用它）
- **Description**:
  - 在 `src-tauri/src/commands/database.rs:171-214`，将 `get_table_meta` 函数从当前 44 行实现简化为约 8-10 行：
    ```rust
    #[tauri::command]
    pub fn get_table_meta(state: State<'_, TauriAppState>, table_name: String) -> Result<TableMetaInfo, String> {
        if !state.db_manager.is_connected() {
            return Err("未连接到数据库".to_string());
        }
        let conn = state.db_manager.get_connection().map_err(|e| e.to_string())?;
        DatabaseService::get_table_performance_info(&conn, &table_name)
    }
    ```
  - **保留** `#[tauri::command]` 标记（Tauri 需要这个属性注册命令）
  - **保留** `is_connected()` 检查和 `get_connection()` 错误处理（commands 层的标准模式）
  - **删除** 5 处 `conn.query` 调用（完全移到 service 层）
  - **删除** `SqlIdentifier::new` 调用（service 层已做，不重复）

- **Acceptance Criteria Addressed**: AC-1, AC-2

- **Test Requirements**:
  - `programmatic` TR-2.1: `grep -rn 'conn.query\|conn.execute' src-tauri/src/commands/` → **0 处匹配**
  - `programmatic` TR-2.2: `cd src-tauri; cargo check --quiet` → 0 errors, 0 new warnings
  - `programmatic` TR-2.3: `get_table_meta` 函数体 ≤ 15 行（不含空行和注释）

- **Notes**: 
  - 修改前先确认 `TableMetaInfo` 是否已移到 models，如果已移，需要更新 use 路径
  - 此任务对 commands 层其他函数（list_databases/get_database_status/list_tables/get_table_columns/get_table_row_count/delete_table/rename_table）零影响

---

## [ ] 任务 3：编译验证 + 代码整理

- **Priority**: P0
- **Depends On**: 任务 2
- **Description**:
  - 执行 `cd src-tauri; cargo check --quiet`
  - 执行 `cd src-tauri; cargo test --quiet -p tv_sc --lib` — 确保没有现有测试被破坏
  - 在 `src-tauri/src/services/database_service.rs` 中检查 `get_table_performance_info` 方法附近是否应该添加 doc comment（`/// 查询表的性能相关元信息：索引数量 + 估算存储大小`）
  - 检查 `TableMetaInfo` 是否需要 `#[serde(rename_all = "camelCase")]`（如果前端期望 camelCase 字段名，目前字段名是 snake_case；如果前端通过字段名映射，需要确认是否已处理——但大概率原实现中 `TableMetaInfo` 就是 Serialize/Deserialize 过的）

- **Acceptance Criteria Addressed**: AC-4

- **Test Requirements**:
  - `programmatic` TR-3.1: `cd src-tauri; cargo check --quiet` → 0 errors, 0 new warnings
  - `programmatic` TR-3.2: `cd src-tauri; cargo test --quiet -p tv_sc --lib` → 0 failing tests

- **Notes**: 如果 cargo test 触发了 sql_service.rs 的测试，确保它们仍然通过（它们是纯函数测试，不会被这次修改影响）

---

## [ ] 任务 4：架构现状文档更新 + M7 里程碑检查报告

- **Priority**: P0
- **Depends On**: 任务 3（代码验证通过后才更新文档）
- **Description**:
  - 角色：@架构
  - 更新 `docs/架构现状.md`：
    1. 在 §4.2 "中优先级改进项"表格中，将 T74 标记为 **v12.5 已完成**
    2. 在 §4.2 顶部追加一行说明："截至 v12.5，中优先级改进项 T70-T74 全部完成"
    3. 在文档中合适位置（建议在 §4.2 之后）新增 **"M7 架构分层里程碑达成报告"** 小节，包含 C1-C7 7 项检查的最终结果
  - 在 `docs/架构现状.md` 开头版本号位置追加 **v12.5**，简要说明："完成架构分层最后一公里（commands 层 0 处直连 DB）"
  - **M7 报告内容模板**（7 项检查的详细说明）：

  ```
  ### M7 架构分层里程碑达成报告（v12.5，2026-06-21）

  目标：commands 层零直接数据库操作，所有 DB 访问必须通过 services/*_service.rs 统一编排

  | 条件 | 描述 | 完成状态 | 验证方式 |
  |------|-----|---------|---------|
  | C1 | commands 层 `conn.query` / `conn.execute` 总数 = 0 | ✅ 0 处 | `grep -rn 'conn.query\|conn.execute' src-tauri/src/commands/` |
  | C2 | 前端 TypeScript `any` 类型 = 0 | ✅ 0 处 | `grep -rn ': any[^a-zA-Z]' src/` |
  | C3 | 生产代码 `.unwrap()` = 0 | ✅ 0 处 | `grep -rn '\.unwrap()\|expect(' src-tauri/src/ | grep -v "#\[cfg(test)\]"'` |
  | C4 | store import 统一出口比例 = 100% | ✅ 100% | `grep -rn "from.*store/.*Store" src/` |
  | C5 | types 目录覆盖所有主要领域（7+） | ✅ 8 个独立领域文件 | 目录枚举 |
  | C6 | 核心纯函数有单元测试 | ✅ sql_service.rs 有 14+ 个测试 | `cargo test --lib services::sql_service::tests` |
  | C7 | DuckDB panic / 错误进入审计日志 | ✅ 两个分支均写入 | `grep -n 'AuditLogService::record_audit_log' src-tauri/src/services/sql_service.rs` |

  结论：✅ M7 架构分层里程碑达成。所有 commands 层命令均通过 service 层访问数据库，架构分层 100% 满足。
  ```

- **Acceptance Criteria Addressed**: AC-5, AC-6

- **Test Requirements**:
  - `programmatic` TR-4.1: `docs/架构现状.md` 文件中包含 "M7 架构分层里程碑达成" 字样
  - `human-judgment` TR-4.2: M7 报告中的 C1-C7 每项均有明确的 ✅ 通过状态
  - `programmatic` TR-4.3: §4.2 T74 已标记为 "v12.5 已完成"

- **Notes**: 这是纯文档任务，不修改任何代码。确保报告中的验证命令与实际执行命令一致。

---

## 任务依赖图

```
任务 1（新增 service 方法 + TableMetaInfo 迁移）
    ↓
任务 2（简化 commands 层 get_table_meta）
    ↓
任务 3（编译验证 + 测试验证 + 代码整理）
    ↓
任务 4（文档更新 + M7 报告）
```

**预计总工作量**: 约 1-2 小时（核心逻辑 ~45 行 + 10 行，主要时间在 TableMetaInfo 迁移和编译验证上）
**修改文件数**: 3-4 个 Rust 文件（database_service.rs、commands/database.rs、models/database.rs（可能））+ 1 个 Markdown 文档
**前端代码改动**: 0 个文件
**Tier-1 文件修改**: 0 个（不涉及 lib.rs/tauri.conf.json/Cargo.toml/package.json）

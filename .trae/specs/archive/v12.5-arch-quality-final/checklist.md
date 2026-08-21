# v12.5 架构质量收尾 — 验证清单（Checklist）

> 以下检查项按任务执行顺序排列。每一项必须在对应任务完成后手动勾选。

---

## 任务 1 完成后验证（@后端）

- [ ] 1.1 `src-tauri/src/services/database_service.rs` 中存在新方法 `pub fn get_table_performance_info(conn, table_name) -> Result<TableMetaInfo, String>`
- [ ] 1.2 新方法内部调用了 `SqlIdentifier::new(table_name)?` 进行表名校验
- [ ] 1.3 新方法执行了 5 个 SQL 查询（PRAGMA index_list / page_size / page_count / freelist_count + SELECT from sqlite_master）
- [ ] 1.4 新方法中所有 `conn.query` 调用的错误处理使用了 `.ok().and_then(...).unwrap_or(0)` 或等效模式（元数据查询失败时降级为默认值，不导致整个命令失败）
- [ ] 1.5 `TableMetaInfo` 结构体要么在 `models/database.rs` 定义，要么在 `database_service.rs` 中通过 `use crate::commands::database::TableMetaInfo;` 正确引用
- [ ] 1.6 `cd src-tauri; cargo check --quiet` → 0 errors, 0 new warnings
- [ ] 1.7 新方法没有引入任何 `.unwrap()` / `.expect()` 到生产代码
- [ ] 1.8 `SqlIdentifier` 的 `quoted()` 用于将表名拼接到 PRAGMA index_list(...) 中（如果该 PRAGMA 确实需要表名参数的话——请核实！）

---

## 任务 2 完成后验证（@后端）

- [ ] 2.1 `src-tauri/src/commands/database.rs:171-214` 的 `get_table_meta` 函数体已被简化为约 8-10 行
- [ ] 2.2 简化后的函数体不包含任何 `conn.query` 或 `conn.execute`
- [ ] 2.3 简化后的函数体仍然保留了 `#[tauri::command]` 属性
- [ ] 2.4 简化后的函数体仍然保留了 `state.db_manager.is_connected()` 检查
- [ ] 2.5 简化后的函数体调用 `DatabaseService::get_table_performance_info(&conn, &table_name)`
- [ ] 2.6 `grep -rn 'conn.query\|conn.execute' src-tauri/src/commands/` → **0 处匹配**（整个 commands 层零直连 DB）
- [ ] 2.7 `cd src-tauri; cargo check --quiet` → 0 errors, 0 new warnings

---

## 任务 3 完成后验证（@后端 + CI）

- [ ] 3.1 `cd src-tauri; cargo check --quiet` → exit code 0
- [ ] 3.2 `cd src-tauri; cargo test --quiet -p tv_sc --lib` → 0 failing tests（特别是 sql_service 的现有测试不能被破坏）
- [ ] 3.3 新方法 `get_table_performance_info` 有 doc comment（`/// 查询表的性能相关元信息...`）
- [ ] 3.4 `TableMetaInfo` 如果包含 `#[derive(Serialize, Deserialize)]` 或等效序列化，确保迁移后仍然保留
- [ ] 3.5 `grep -rn '\.unwrap()\|expect(' src-tauri/src/services/database_service.rs | grep -v cfg.test` → 0 处新增 unwrap/expect
- [ ] 3.6 手工测试（在开发环境中运行 Tauri app 后）：在表列表中点击某个表，能看到正确的索引数量和大小估算（用于验证运行时行为正确）

---

## 任务 4 完成后验证（@架构）

- [ ] 4.1 `docs/架构现状.md` 的 §4.2 "中优先级改进项" 中，T74 已标记为 "v12.5 已完成"
- [ ] 4.2 `docs/架构现状.md` 中新增了 "M7 架构分层里程碑达成报告" 小节
- [ ] 4.3 M7 报告包含 C1-C7 7 项检查，每项均有明确 ✅ 标记和验证命令
- [ ] 4.4 文档开头的版本号已更新，明确提到 "完成 commands 层 0 处直连 DB"
- [ ] 4.5 M7 报告中 C1-C7 的验证命令与实际 grep 命令一致（确保可以在命令行复现）

---

## 整体门禁 — M7 里程碑最终检查

> 所有前述任务完成后，执行以下 **7 个最终验证命令**，输出结果记入文档：

- [ ] **M7-C1**: `grep -rn 'conn.query\|conn.execute' src-tauri/src/commands/` → **0 results**
- [ ] **M7-C2**: `grep -rn ': any[^a-zA-Z]' src/` → **0 results**
- [ ] **M7-C3**: `grep -rn '\.unwrap()\|expect(' src-tauri/src/ | grep -v "#\[cfg(test)\]"` → 0 results（或仅 lib.rs 主入口合理保留的 1 处）
- [ ] **M7-C4**: `grep -rn "from.*store/.*Store" src/` → **0 results**
- [ ] **M7-C5**: 确认 `src/types/` 目录包含以下文件：`audit_log.ts`、`automation.ts`、`chart.ts`、`dashboard.ts`、`settings.ts`、`table.ts`、`workspace.ts`、`index.ts` → **8 个文件** ✅
- [ ] **M7-C6**: `cd src-tauri; cargo test --quiet -p tv_sc --lib services::sql_service::tests` → **0 failing**
- [ ] **M7-C7**: `grep -n 'AuditLogService::record_audit_log' src-tauri/src/services/sql_service.rs` → ≥ 2 matches（panic 分支 + error 分支都写审计日志）

### 最终门禁报告格式（写入架构现状文档末尾或单独文档）

```
v12.5 M7 架构分层里程碑 — 最终门禁报告
生成时间: 2026-06-21
执行者: @架构

C1 commands 层直连 DB: ✅ 0 处
C2 前端 any 类型: ✅ 0 处
C3 生产代码 unwrap: ✅ 0 处
C4 store 统一出口: ✅ 100%
C5 types 领域文件覆盖: ✅ 8 个文件
C6 核心纯函数测试: ✅ 0 failing
C7 DuckDB 错误可观测性: ✅ ≥ 2 处调用 AuditLogService

结论: ✅ M7 架构分层里程碑达成。
```

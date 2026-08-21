# v12 架构质量加固 — 验证清单（Checklist）

> 每个任务完成后必须逐项验证并勾选。"整体门禁"需在所有任务完成后最终验证。

---

## 任务 1：sql_service.rs 单元测试

- [ ] `src-tauri/src/services/sql_service.rs` 文件末尾新增了 `#[cfg(test)] mod tests`
- [ ] `split_sql_statements` 有 ≥ 8 个测试用例，覆盖：单语句、多语句、`--` 注释、`/* */` 块注释、字符串内含分号、末尾无分号、空字符串、纯分号
- [ ] `parse_drop_table_table_name` 有 ≥ 6 个测试用例，覆盖：`DROP TABLE foo`、`DROP TABLE IF EXISTS foo`、带引号表名、无表名、非 DROP 语句、多空格大小写混合
- [ ] `should_use_temp_connection` 有 ≥ 5 个测试用例，覆盖：SELECT、WITH、EXPLAIN、PRAGMA → true；INSERT/DELETE/CREATE → false
- [ ] `cd src-tauri; cargo test --quiet -p quickersql --lib services::sql_service::tests` → **0 failing tests**
- [ ] `cd src-tauri; cargo check --quiet` → **0 errors, 0 warnings**
- [ ] `git diff` 确认：`split_sql_statements` / `parse_drop_table_table_name` / `should_use_temp_connection` 三个生产函数签名与实现**保持不变**

---

## 任务 2：sql_service.rs catch_unwind → 审计日志

- [ ] `sql_service.rs` 中 `catch_unwind(|| duckdb_conn_guard.query(...))` 的 `Ok(Err(e))` 分支内新增了 `AuditLogService::record_audit_log` 调用
- [ ] `sql_service.rs` 中 `catch_unwind` 的 `Err(e)` 分支内新增了 `AuditLogService::record_audit_log` 调用
- [ ] 审计日志的 `module = "sql"`, `action = "query"`, `status = "failed"`
- [ ] panic 路径的 `description` 包含 `"DuckDB panicked"`；常规错误路径的 `description` 包含 `"DuckDB execution failed"`
- [ ] `details` 字段包含原始 panic payload 或错误信息（若无法转换则有降级文本）
- [ ] 审计日志写入失败时不阻断后续 SQLite 回退逻辑（`if let Err(e) = record_audit_log { log::warn!(...) }`）
- [ ] `cd src-tauri; cargo check --quiet` → **0 errors, 0 warnings**
- [ ] `cd src-tauri; cargo test --quiet -p quickersql --lib services::sql_service::tests` → **0 failing tests**（任务 1 的测试未被破坏）
- [ ] `grep -rn '\.unwrap()\|expect(' src-tauri/src/services/sql_service.rs` → **0 处**（不含 `#[cfg(test)]` 内的测试代码）
- [ ] 人工验证：在应用中执行一条会触发 DuckDB 错误的 SQL，审计日志面板可见新增的失败记录

---

## 任务 3：store/index.ts 统一出口

- [ ] `src/store/index.ts` 中补全了所有未 re-export 的公共 symbol（包括 `useTableStore`、各 store const 等）
- [ ] 所有组件文件中 `from '../../store/xxxStore'` 已改为 `from '../../store'`
- [ ] `grep -rn "from.*store/.*Store" src/` → **0 处匹配**（无直接 import 子 store 文件）
- [ ] `tsc --noEmit` → **0 errors**
- [ ] 手动启动应用并验证：Dashboard 页面、Task 页面、Settings 页面均正常加载，无运行时错误

---

## 任务 4：types/settings.ts 独立文件

- [ ] `src/types/settings.ts` 新文件存在，包含 `SettingItem`、`SettingCategory`、`SettingsListResponse`、`UpdateSettingRequest` 等 settings 相关类型定义
- [ ] `src/types/index.ts` 中原有 settings 内联定义已被 `export * from './settings'`（或等效 re-export）替代
- [ ] `grep -rn "SettingItem\|SettingCategory" src/types/index.ts` → **0 处内联定义**
- [ ] `tsc --noEmit` → **0 errors**
- [ ] `src/types/settings.ts` 的代码风格与 `src/types/chart.ts` 等其他领域文件一致（`export interface`, `export type` 等）

---

## 整体门禁（所有任务完成后最终验证）

- [ ] `cd src-tauri; cargo check --quiet` → 0 errors, 0 warnings
- [ ] `cd src-tauri; cargo test --quiet -p quickersql --lib services::sql_service::tests` → 0 failing tests
- [ ] `tsc --noEmit` → 0 errors
- [ ] `grep -rn "from.*store/.*Store" src/` → 0 处直接 import 子文件
- [ ] `grep -rn ": any[^a-zA-Z]" src/` → 0 处 any 类型（或与 v11.0 基线相等）
- [ ] `src/types/settings.ts` 文件存在
- [ ] `docs/架构现状.md` 已更新至 v12.0 版本，记录本次完成的 4 项质量加固
- [ ] `grep -rn '\.unwrap()\|expect(' src-tauri/src/services/sql_service.rs | grep -v "#\[cfg(test)\]"'` → 0 处（生产代码无 unwrap）
- [ ] `grep -rn 'format!("[A-Z ]*SELECT\|INSERT\|UPDATE\|DELETE\|ALTER\|CREATE' src-tauri/src/services/sql_service.rs` → 0 处新增 SQL 拼接

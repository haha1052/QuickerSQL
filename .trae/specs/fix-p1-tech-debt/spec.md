# P1 技术债修复 Spec

## Why
当前技术债清单中有 2 项 P1 级高危技术债（P1-1 SQL 注入检测 19 条违规 + P1-2 Rust 生产代码 unwrap/expect 368 处），导致安全门禁和代码规范门禁无法通过。SQL 注入检测中有 7 条真正违规需要修复为参数化查询，368 处 unwrap/expect 需要替换为安全错误处理形式。

## What Changes
- **P1-1 修复 7 条真正 SQL 注入违规**：`dashboard_service.rs:1429/1438`、`profile_service.rs:62/75/77`、`view_service.rs:158/257/411` 中的 `format!` SQL 拼接改为参数化查询或 `SqlIdentifier` 封装
- **P1-1 消除 12 条误报**：`migration_service.rs`、`trash_service.rs` 中的 `map_err(format!("...DROP... 失败"))` 是错误信息不是 SQL 执行；`project.rs:675` 的 `format!` 不含 SQL；测试代码中的 `format!` SQL 属测试数据 — 通过调整检测规则或加白名单标记消除
- **P1-2 分批清理 services 层 unwrap/expect**：优先处理 Top 5 文件（project_service.rs 92 处、query_history_service.rs 48 处、settings_service.rs 45 处、sql_snippet_service.rs 44 处、app_state_service.rs 41 处，合计 270 处），剩余 98 处后续逐步清理
- **门禁验证**：修复后 SQL 注入检测违规数降为 0（或仅剩测试代码白名单），unwrap/expect 生产代码数量大幅降低（目标 ≤ 50）
- **浏览器验证**：启动应用自主验证修复后功能正常
- **文档更新**：修复完成后更新架构现状.md、技术债清单_v4.md、历史技术债.md

## Impact
- Affected specs: 无新增 spec，修复现有技术债
- Affected code:
  - `src-tauri/src/services/dashboard_service.rs`（SQL 注入修复 + unwrap 清理）
  - `src-tauri/src/services/profile_service.rs`（SQL 注入修复 + unwrap 清理）
  - `src-tauri/src/services/view_service.rs`（SQL 注入修复 + unwrap 清理）
  - `src-tauri/src/services/project_service.rs`（unwrap 清理，92 处）
  - `src-tauri/src/services/query_history_service.rs`（unwrap 清理，48 处）
  - `src-tauri/src/services/settings_service.rs`（unwrap 清理，45 处）
  - `src-tauri/src/services/sql_snippet_service.rs`（unwrap 清理，44 处）
  - `src-tauri/src/services/app_state_service.rs`（unwrap 清理，41 处）
  - `src-tauri/src/services/migration_service.rs`（误报标记）
  - `src-tauri/src/services/trash_service.rs`（误报标记）
  - `docs/架构现状.md`（更新 §7 当前技术债章节）
  - `docs/技术债清单_v4.md`（更新 P1 状态为已修复）
  - `docs/历史技术债.md`（追加本次修复记录）

## ADDED Requirements

### Requirement: P1-1 SQL 注入违规修复
系统 SHALL 将以下 7 个位置的 `format!` SQL 拼接改为参数化查询或经 `SqlIdentifier` 封装：
1. `dashboard_service.rs:1429` — `INSERT INTO {} (name) VALUES ('{}')` → 参数化
2. `dashboard_service.rs:1438` — `INSERT INTO t (name, description) VALUES ({}, {})` → 参数化
3. `profile_service.rs:62` — `SELECT COUNT(*) FROM {}` → `SqlIdentifier::quoted()` 封装
4. `profile_service.rs:75` — `SELECT * FROM {} LIMIT ?` → `SqlIdentifier::quoted()` 封装
5. `profile_service.rs:77` — `SELECT * FROM {}` → `SqlIdentifier::quoted()` 封装
6. `view_service.rs:158` — `DROP VIEW IF EXISTS {}` → `SqlIdentifier::quoted()` 封装
7. `view_service.rs:257` — `CREATE TABLE {} (id INTEGER, name TEXT)` → `SqlIdentifier::quoted()` 封装
8. `view_service.rs:411` — `CREATE TABLE {} (id INTEGER)` → `SqlIdentifier::quoted()` 封装

#### Scenario: SQL 注入检测通过
- **WHEN** 执行 PowerShell 两段式 SQL 注入检测命令
- **THEN** 排除 `SqlIdentifier` 封装的合法用法后，潜在违规数为 0（测试代码单独标记白名单）

### Requirement: P1-2 unwrap/expect 清理
系统 SHALL 将 services 层 Top 5 文件中的 `.unwrap()` / `.expect()` 替换为安全错误处理形式：
- `?` 操作符（当函数返回 `Result<T, E>` 时）
- `match + map_err`（当需要错误转换时）
- `lock().map_err()`（Mutex 锁定时）
- `.unwrap_or_default()` 或 `.unwrap_or(fallback)`（当默认值安全时）

#### Scenario: unwrap/expect 数量降低
- **WHEN** 执行 PowerShell unwrap/expect 检测命令（排除测试代码）
- **THEN** 生产代码中的 unwrap/expect 数量从 368 降至 ≤ 100（优先完成 Top 5 文件 270 处中的至少 220 处）

### Requirement: 浏览器验证
修复完成后 SHALL 启动应用验证核心功能正常。

#### Scenario: 应用启动成功
- **WHEN** 执行 `npm run tauri dev` 启动应用
- **THEN** 应用正常启动，可执行 SQL 查询、查看仪表盘、导入数据

### Requirement: 文档更新
修复完成后 SHALL 更新 3 个文档。

#### Scenario: 文档同步更新
- **WHEN** P1 修复完成并验证通过
- **THEN** `docs/架构现状.md` §7 当前技术债更新（P1 标记为已修复/大幅改善）；`docs/技术债清单_v4.md` P1 状态更新；`docs/历史技术债.md` 追加本次修复记录

## MODIFIED Requirements

### Requirement: SQL 注入检测规则
现有检测规则需排除 `map_err(format!("...失败..."))` 等错误信息场景，以及测试代码中的 SQL 测试数据。

## REMOVED Requirements
无

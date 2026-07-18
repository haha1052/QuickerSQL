# v24.0 质量体系化 + 技术债务清理 Spec

> **change-id**: `v24-quality-system-and-debt-cleanup`
> **创建日期**: 2026-07-17
> **基线文档**: `docs/架构现状.md` v23.1 §13.3 下一步计划（v24.0+）
> **范围**: v24.0+ 下一步计划 5 项中的可实施子集 + 启动应用验证 + 架构现状文档同步 v23.1 → v24.0

---

## Why

`docs/架构现状.md` v23.1 完成了 P2 五项修复，质量评分 9.5。当前 v24.0+ 下一步计划包含 5 项工作，其中部分项目（如 i18n Phase 2/3 框架升级、依赖升级）属于破坏性大变更，需独立 spec 推进。本 spec 聚焦**可切实完成**的质量体系化与技术债务清理：

- **migration_service.rs:103 format! ALTER TABLE 形式违规**：虽然 old_name/new_name 来自内部映射表（安全），但形式上违反 CLAUDE.local.md §2.1 SQL 注入防护规则，需修复以通过严格门禁
- **17 个 too_many_arguments 保留项中 7 处可重构**：services 层内部流水线函数（sql_service.rs 5 处 + task_service.rs 2 处）可提取参数为 struct，不影响前端 API 契约；commands 层 4 处 + dashboard_service 3 处 + audit_log 测试 1 处保留（需同步前端契约或重构收益低）
- **覆盖率工具缺失**：前后端均无覆盖率统计，无法量化测试质量
- **CI 门禁未落地**：无 .github/workflows 配置，clippy deny warnings 仅本地执行
- **PR 审查 checklist 缺失**：无标准化审查清单

修复后启动应用自主验证功能完整性，同步更新架构现状文档 v23.1 → v24.0。

## What Changes

### 第一批：migration_service.rs:103 format! 违规修复
- `migration_service.rs:103` `format!("ALTER TABLE {} RENAME TO {}", old_name, new_name)` 改为通过 `SqlIdentifier` 校验后用 `ident.quoted()` 拼装
- old_name/new_name 来自 `LEGACY_TABLE_MAPPINGS` 常量（编译时已知），但仍走 `SqlIdentifier::new()` 校验确保形式合规

### 第二批：services 层 7 处 too_many_arguments 重构
- **sql_service.rs 5 处**：`execute_via_duckdb_or_sqlite`、`execute_routed_duckdb_query`、`handle_duckdb_query_error`、`try_duckdb_view_refresh_retry`、`handle_duckdb_panic` 提取参数为 `SqlExecContext` struct
- **task_service.rs 2 处**：`handle_execute_success`、`handle_execute_failure` 提取参数为 `TaskExecResult` struct
- 移除对应的 `#[allow(clippy::too_many_arguments)]` + TODO 注释
- **保留项**：commands 层 4 处（Tauri API 契约）、dashboard_service 3 处（需同步前端）、sql_snippet_service 1 处（需同步前端）、audit_log_service 1 处（测试辅助）—— 共 9 处保留

### 第三批：覆盖率工具引入
- **Rust (tarpaulin)**：在 `Cargo.toml` 的 `[dev-dependencies]` 添加 `cargo-tarpaulin` 配置；在 `package.json` scripts 添加 `coverage:rust` 脚本
- **前端 (vitest coverage)**：安装 `@vitest/coverage-v8`；在 `vitest.config.ts` 添加 coverage 配置；在 `package.json` scripts 添加 `coverage:web` 脚本
- 目标：`npm run coverage:rust` 与 `npm run coverage:web` 可执行并输出报告

### 第四批：CI 门禁配置（GitHub Actions）
- 新建 `.github/workflows/ci.yml`：包含 `cargo check`、`cargo clippy -- -D warnings`、`cargo test`、`npx tsc --noEmit`、`npx vitest run` 五项门禁
- 触发条件：push to main + pull request
- 目标：CI 自动执行所有门禁，阻断违规合并

### 第五批：PR 审查 checklist 文档
- 新建 `docs/PR_REVIEW_CHECKLIST.md`：标准化 PR 审查清单，包含架构合规、安全合规、代码规范、测试要求、文档同步五大类
- 目标：所有 PR 合并前须对照 checklist 审查

### 第六批：启动应用自主验证
- 执行 `npm run tauri dev` 启动应用
- 验证核心功能：应用启动、SQL 查询、仪表盘、自动化任务、数据导入、设置页面
- 截图或日志确认功能正常

### 第七批：架构现状文档 v23.1 → v24.0
- 头部版本号 v23.1 → v24.0
- §6.1 版本概览：架构文档版本 v24.0；质量评分 9.5 → 9.7（预期）
- §7.6 技术债务清单：P3 项部分标注 ✅ 已解决（覆盖率工具、CI 门禁、PR checklist）；17 个 too_many_arguments → 9 个保留项
- §7.7 质量改进路线图：v24.0 状态从 ⏳ → ✅ 已完成
- §13.3 下一步计划：更新为 v25.0 计划（i18n Phase 2/3、依赖升级、剩余 9 个 too_many_arguments 重构）
- §13 版本修订说明追加 v24.0 修订说明

## Impact

### Affected specs
- `p2-fix-and-arch-v23-1-upgrade`（前一批，已完成，作为基线参考）

### Affected code（预计修改文件）
**后端 Rust**：
- `src-tauri/src/services/migration_service.rs`（第一批 format! 修复）
- `src-tauri/src/services/sql_service.rs`（第二批 5 处重构）
- `src-tauri/src/services/task_service.rs`（第二批 2 处重构）
- `src-tauri/Cargo.toml`（第三批 tarpaulin dev-dependency）

**前端 TS**：
- `vitest.config.ts`（第三批 coverage 配置，若不存在则新建）
- `package.json`（第三批 coverage scripts + 依赖）

**配置文件**：
- `.github/workflows/ci.yml`（第四批新建）

**文档**：
- `docs/PR_REVIEW_CHECKLIST.md`（第五批新建）
- `docs/架构现状.md`（第七批 v23.1 → v24.0）
- `CHANGELOG.md`（追加 2.2.0 → 2.3.0 条目）

### 不在本次范围
- i18n Phase 2/3 框架升级（react-i18next）—— 破坏性大变更，独立 spec 推进
- 依赖升级（Rust/TS 依赖版本升级）—— 风险大，独立 spec 推进
- commands 层 4 处 + dashboard_service 3 处 + sql_snippet_service 1 处 too_many_arguments 重构 —— 需同步前端 API 契约，独立 spec 推进
- audit_log_service 测试辅助函数重构 —— 重构收益低，永久保留

## ADDED Requirements

### Requirement: migration_service format! 违规修复
系统 SHALL 在 `migration_service.rs` 中通过 `SqlIdentifier::new()` 校验 old_name/new_name 后用 `ident.quoted()` 拼装 ALTER TABLE 语句，不再使用裸 `format!`。

#### Scenario: SQL 注入检测通过
- **WHEN** 执行两段式 SQL 注入检测命令
- **THEN** `migration_service.rs:103` 不再出现在潜在违规列表中

### Requirement: services 层 too_many_arguments 重构
系统 SHALL 将 `sql_service.rs` 5 处 + `task_service.rs` 2 处共 7 处 `#[allow(clippy::too_many_arguments)]` 通过提取参数为 struct 消除，保留项降至 9 处。

#### Scenario: clippy 门禁通过
- **WHEN** 执行 `cargo clippy --all-targets -- -D warnings`
- **THEN** 退出码 0，0 warnings

### Requirement: 覆盖率工具可用
系统 SHALL 提供 `npm run coverage:rust`（tarpaulin）与 `npm run coverage:web`（vitest coverage）两个脚本，执行后输出覆盖率报告。

#### Scenario: 覆盖率报告生成
- **WHEN** 执行 `npm run coverage:web`
- **THEN** 在 `coverage/` 目录生成 HTML 覆盖率报告

### Requirement: CI 门禁自动化
系统 SHALL 通过 `.github/workflows/ci.yml` 在 push/PR 时自动执行五项门禁（cargo check、cargo clippy -D warnings、cargo test、tsc --noEmit、vitest run）。

#### Scenario: CI 自动触发
- **WHEN** 向 main 分支 push 或创建 PR
- **THEN** GitHub Actions 自动执行五项门禁，全部通过才允许合并

### Requirement: PR 审查 checklist
系统 SHALL 在 `docs/PR_REVIEW_CHECKLIST.md` 提供标准化 PR 审查清单，涵盖架构合规、安全合规、代码规范、测试要求、文档同步五大类。

#### Scenario: checklist 可用
- **WHEN** 开发者提交 PR
- **THEN** 可对照 `docs/PR_REVIEW_CHECKLIST.md` 逐项审查

### Requirement: 应用功能验证
系统 SHALL 通过 `npm run tauri dev` 启动应用并验证核心功能（SQL 查询、仪表盘、自动化任务、数据导入、设置）正常工作。

#### Scenario: 应用启动成功
- **WHEN** 执行 `npm run tauri dev`
- **THEN** 应用窗口正常显示，无 panic/crash

### Requirement: 架构现状文档 v24.0 同步
`docs/架构现状.md` SHALL 升级到 v24.0，反映本次质量体系化与技术债务清理结果。

#### Scenario: 文档版本同步
- **WHEN** 读取 `docs/架构现状.md` 头部
- **THEN** 版本号为 v24.0

## MODIFIED Requirements

（无）

## REMOVED Requirements

（无）

## 验证基线（参考 CLAUDE.local.md §六）

| 验证项 | 命令 | 通过标准 |
|--------|------|---------|
| Rust 编译 | `cd src-tauri; cargo check --quiet` | 0 errors |
| Rust 测试 | `cd src-tauri; cargo test --quiet` | 无 FAIL（test_get_default_db_path 环境问题除外） |
| TS 类型检查 | `npx tsc --noEmit --pretty` | 0 errors |
| 前端测试 | `npx vitest run` | 100% passed |
| clippy 门禁 | `cd src-tauri; cargo clippy --all-targets -- -D warnings` | 0 warnings |
| SQL 注入检测 | 两段式检测命令 | 潜在违规数 = 0（migration_service.rs:103 已修复） |
| too_many_arguments | `grep -c "too_many_arguments" src-tauri/src/**/*.rs` | ≤ 9 处保留项 |
| 覆盖率工具 | `npm run coverage:web` | 生成 coverage/ 目录 |
| CI 配置 | `.github/workflows/ci.yml` 存在 | 文件存在且语法正确 |
| PR checklist | `docs/PR_REVIEW_CHECKLIST.md` 存在 | 文件存在且包含五大类 |
| 应用启动 | `npm run tauri dev` | 应用窗口正常显示 |

## 范围边界

### 本次范围内
- migration_service.rs:103 format! 违规修复
- services 层 7 处 too_many_arguments 重构（sql_service 5 + task_service 2）
- 覆盖率工具引入（tarpaulin + vitest coverage）
- CI 门禁配置（GitHub Actions）
- PR 审查 checklist 文档
- 启动应用验证功能
- 架构现状文档 v23.1 → v24.0
- CHANGELOG.md 追加 2.2.0 → 2.3.0

### 本次范围外（留待 v25.0+）
- i18n Phase 2/3 框架升级（react-i18next）—— 破坏性大变更
- 依赖升级（Rust/TS 依赖版本升级）
- commands 层 4 处 + dashboard_service 3 处 + sql_snippet_service 1 处 too_many_arguments 重构（需同步前端 API 契约）
- audit_log_service 测试辅助函数重构（永久保留）
- 国际化剩余硬编码清理（DashboardItem.tsx 6 处错误消息中文）

## Open Questions

- [ ] Q1: tarpaulin 在 Windows 上可能需要特定配置，若无法运行则仅保留配置不强制执行（后续 Linux CI 中运行）
- [ ] Q2: CI 门禁是否包含 E2E 测试？（建议本次不含，E2E 需要桌面环境，后续单独配置）
- [ ] Q3: 应用功能验证是否需要浏览器自动化？（本次仅启动验证无 panic，深度验证留待用户手动）

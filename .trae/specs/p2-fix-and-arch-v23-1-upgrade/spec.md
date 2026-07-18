# P2 漏洞修复 + 架构现状文档 v23.1 升级 Spec

> **change-id**: `p2-fix-and-arch-v23-1-upgrade`
> **创建日期**: 2026-07-17
> **基线文档**: `docs/架构现状.md` v23.0 §7.6 P2 一般（5 项）、§13.3 下一步计划（v23.1+）
> **范围**: 下一步计划 P2-1 至 P2-5 五项 + 架构现状文档同步更新 v23.0 → v23.1

---

## Why

`docs/架构现状.md` v23.0 完成了 5 项 P0 + 3 项 P1 漏洞修复，质量评分从 8.9 上调到 9.2。当前剩余 **P2 一般级 5 项**是下一批阻断质量进一步提升的关键问题：

- **P2-1**：clippy 剩余 36 个警告（多为深度重构类）—— 阻碍 CI `clippy deny warnings` 门禁落地
- **P2-2**：透明窗口诊断日志重复输出（startup.rs + lib.rs）—— 干扰问题排查，日志噪音过大
- **P2-3**：前端组件 JSDoc 覆盖率不足 —— 关键组件缺乏文档影响可维护性
- **P2-4**：少量函数过长/嵌套过深（sql_service.rs 等）—— 圈复杂度高，重构风险大
- **P2-5**：错误信息用户友好度不足（部分 command）—— 用户难以理解错误原因

同时架构现状文档需从 v23.0 升级到 v23.1，同步本次修复结果、更新技术债务清单与质量评分。

## What Changes

### 第一批：P2-1 clippy 警告清理（分批处理）
- 执行 `cargo clippy --all-targets -- -W warnings` 获取当前完整警告清单
- 分批处理 36 个警告：
  - 优先处理 type alias 简化复杂类型（如 `Vec<&dyn ToSql>` 等）
  - 重构多参数函数（>5 个参数提取为 struct）
  - 修复 `needless_borrow`、`redundant_closure`、`manual_strip` 等机械类警告
- 目标：clippy 警告 36 → 0（或 ≤ 5 个需深度重构的保留项，加 `#[allow]` + 注释说明）

### 第二批：P2-2 透明窗口诊断日志去重
- 排查 `src-tauri/src/commands/startup.rs` 与 `src-tauri/src/lib.rs` 中的透明窗口诊断日志重复输出逻辑
- 修复方案：首次成功后跳过重试，或降低重复诊断日志级别（`info!` → `debug!`）
- 启动日志只保留：首次诊断 + 最终结果（成功/失败），中间重试改为 `debug!`

### 第三批：P2-3 前端组件 JSDoc 补充
- 识别关键组件（按使用频率与复杂度）：DashboardItem、SqlQueryPage、TaskCenterPage、DatabaseExplorer、ChartLibraryPanel、AddChartModal、Settings 等
- 为每个关键组件的公共 props 与导出函数补充 JSDoc 注释
- 目标：关键组件 JSDoc 覆盖率 ≥ 80%

### 第四批：P2-4 函数过长/嵌套过深重构
- 排查 `src-tauri/src/services/sql_service.rs` 等文件中超长函数（> 80 行）
- 拆分为多个有意义的子函数，降低圈复杂度
- 嵌套层级 > 4 处通过 early return / match 优化
- 目标：单函数 ≤ 80 行，嵌套 ≤ 4 层

### 第五批：P2-5 错误信息用户友好度提升
- 审查 `src-tauri/src/commands/*.rs` 中的错误信息返回
- 区分"用户可读信息"（前端 ApiResponse.message）与"开发调试信息"（log::error!）
- 错误信息分级：
  - 用户可读：如"表已存在"、"查询超时，请缩减数据范围"
  - 开发定位：完整 stack/上下文写入日志
- 目标：所有 command 错误返回均为用户可读中文/英文（i18n key），技术细节进日志

### 第六批：架构现状文档 v23.0 → v23.1
- 头部版本号 v23.0 → v23.1，最后更新日期改为 2026-07-17
- §6.1 版本概览：架构文档版本 v23.0 → v23.1；质量评分 9.2 → 9.5（预期）
- §7.6 技术债务清单 P2 项标注 ✅ 已解决（含修复方案与修复时间）
- §7.7 质量改进路线图：v23.1 状态从 ⏳ 待开始 → ✅ 已完成
- §13.3 下一步计划：更新为 v24.0 计划（CI 门禁 / 覆盖率工具 / 国际化 Phase 2/3）
- §13 版本修订说明追加 v23.1 修订说明

## Impact

### Affected specs
- `p0-fix-and-rule-v12-upgrade`（前一批，已完成，作为基线参考）

### Affected code（预计修改文件）
**后端 Rust**：
- `src-tauri/src/commands/startup.rs`（P2-2 日志去重）
- `src-tauri/src/lib.rs`（P2-2 日志去重）
- `src-tauri/src/commands/*.rs`（P2-5 错误信息优化）
- `src-tauri/src/services/sql_service.rs`（P2-4 函数拆分）
- 其他含 clippy 警告的文件（P2-1，根据实际清单确定）

**前端 TS**：
- `src/components/dashboard/*.tsx`（P2-3 JSDoc 补充）
- `src/components/sql/*.tsx`（P2-3 JSDoc 补充）
- `src/components/automation/*.tsx`（P2-3 JSDoc 补充）
- `src/components/database/*.tsx`（P2-3 JSDoc 补充）
- `src/components/settings/*.tsx`（P2-3 JSDoc 补充）

**文档**：
- `docs/架构现状.md`（v23.0 → v23.1）
- `CHANGELOG.md`（追加 2.1.0 → 2.2.0 条目）

### 不在本次范围
- P3 级 4 项技术债务（国际化 Phase 2/3、覆盖率工具、clippy deny 升级、PR 审查 checklist）
- v24.0 质量体系化（CI 门禁、覆盖率统计、代码审查 checklist）
- 依赖升级
- 新功能开发

## ADDED Requirements

（无新增需求，本次均为现有问题的修复与文档同步）

## MODIFIED Requirements

### Requirement: clippy 警告清理（P2-1）
系统 SHALL 通过 `cargo clippy --all-targets -- -D warnings` 门禁，非测试代码 0 警告；保留的深度重构项须加 `#[allow(clippy::xxx)]` + 行内注释说明保留理由与负责人/日期。

#### Scenario: clippy 门禁通过
- **WHEN** 执行 `cd src-tauri; cargo clippy --all-targets -- -D warnings`
- **THEN** 退出码 0，无 warning 输出

### Requirement: 透明窗口诊断日志去重（P2-2）
系统 SHALL 在透明窗口诊断流程中，首次成功后跳过重试日志输出；中间重试日志级别降为 `debug!`；启动日志只保留首次诊断与最终结果两条 `info!`。

#### Scenario: 启动日志清洁
- **WHEN** 应用启动且透明窗口诊断成功
- **THEN** 日志中 `info!` 级别仅出现 2 条（首次诊断 + 最终成功），中间重试不输出 `info!`

### Requirement: 前端组件 JSDoc 覆盖（P2-3）
系统 SHALL 为关键前端组件（DashboardItem、SqlQueryPage、TaskCenterPage、DatabaseExplorer、ChartLibraryPanel、AddChartModal、Settings、Toolbar 等）的公共 props 与导出函数补充 JSDoc 注释，覆盖率 ≥ 80%。

#### Scenario: JSDoc 覆盖率验证
- **WHEN** 执行 JSDoc 覆盖率检测脚本
- **THEN** 关键组件公共接口 JSDoc 覆盖率 ≥ 80%

### Requirement: 函数复杂度控制（P2-4）
系统 SHALL 保证 `src-tauri/src/services/*.rs` 中单函数 ≤ 80 行、嵌套层级 ≤ 4；超过的须拆分为命名子函数或加注释说明保留理由。

#### Scenario: 函数长度门禁
- **WHEN** 执行函数长度检测
- **THEN** services 层单函数 ≤ 80 行（保留项须有注释说明）

### Requirement: 错误信息用户友好（P2-5）
系统 SHALL 在 `commands/*.rs` 中返回的 `ApiResponse.message` 为用户可读文案（中文/英文 i18n key），技术细节通过 `log::error!` 写入日志，不暴露给前端。

#### Scenario: 错误信息分级
- **WHEN** command 执行失败
- **THEN** `ApiResponse.message` 为用户可读文案；`log::error!` 包含完整上下文

### Requirement: 架构现状文档 v23.1 同步
`docs/架构现状.md` SHALL 升级到 v23.1，反映本次 P2 五项修复结果，更新技术债务清单、质量评分、版本修订说明、下一步计划。

#### Scenario: 文档版本同步
- **WHEN** 读取 `docs/架构现状.md` 头部
- **THEN** 版本号为 v23.1，最后更新日期为 2026-07-17

## REMOVED Requirements

（无移除需求）

## 验证基线（参考 CLAUDE.local.md §六）

| 验证项 | 命令 | 通过标准 |
|--------|------|---------|
| Rust 编译 | `cd src-tauri; cargo check --quiet` | 0 errors |
| Rust 测试 | `cd src-tauri; cargo test --quiet` | 无 FAIL（test_get_default_db_path 环境问题除外） |
| TS 类型检查 | `npx tsc --noEmit --pretty` | 0 errors |
| 前端测试 | `npx vitest run` | 100% passed |
| **clippy 门禁** | `cd src-tauri; cargo clippy --all-targets -- -D warnings` | **0 warnings**（本次新增） |
| SQL 注入检测 | 两段式检测命令 | 真实违规数 = 0 |
| 敏感字符串检测 | PowerShell 检测命令 | 0 matches |
| 前端 any 检测 | PowerShell 检测命令 | 0 matches |
| unwrap/expect 检测 | PowerShell 检测命令 | 非测试代码 0 处 |
| 系统表三处一致 | 三处文档对比 | 17 张表完全一致 |
| 前端硬编码中文 | grep 中文字符串字面量 | 关键模块 0 处 |

## 范围边界

### 本次范围内
- P2-1 至 P2-5 五项 P2 漏洞修复
- 架构现状文档 v23.0 → v23.1
- CHANGELOG.md 追加 2.1.0 → 2.2.0 条目

### 本次范围外（留待 v24.0）
- P3 级 4 项技术债务（国际化 Phase 2/3、覆盖率工具、clippy deny CI 升级、PR 审查 checklist）
- v24.0 质量体系化（CI 门禁、覆盖率统计、代码审查 checklist）
- 依赖升级
- 新功能开发
- migration_service.rs:103 `format!("ALTER TABLE {} RENAME TO {}", old_name, new_name)` 形式违规（old_name/new_name 来自内部映射，安全但形式违规，加注释说明即可，不在本次强制修复范围）

## Open Questions

- [ ] Q1: P2-1 clippy 警告清理后，是否将 `cargo clippy -- -D warnings` 加入 CI 门禁？（建议 v24.0 再升级 CI，本次仅清理代码）
- [ ] Q2: P2-3 JSDoc 覆盖率检测是否引入工具？（建议本次人工审查，v24.0 再引入 eslint-plugin-jsdoc）
- [ ] Q3: P2-4 函数拆分是否引入圈复杂度工具？（建议本次人工审查，v24.0 再引入 clippy::cognitive_complexity）

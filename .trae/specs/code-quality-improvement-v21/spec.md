# QuickerSQL 代码质量全面提升 v21.0 — Product Requirement Document

## Overview
- **Summary**: 基于商业软件开发规范，对 QuickerSQL 项目进行全面代码质量评估，识别架构违规、安全隐患、规范性问题和可维护性债务，并制定分阶段改进计划，系统性提升代码质量至商业软件标准。
- **Purpose**: 当前代码库存在架构分层违规（前端组件直接 invoke、commands 层直接写 SQL）、unwrap 使用不规范、代码重复等问题，需系统性治理以降低维护成本、提升可靠性。
- **Target Users**: 开发团队、代码审查者、未来维护者

## Goals
- **G1**: 修复所有 P0/P1 级架构违规和安全隐患
- **G2**: 建立量化的代码质量指标体系，可通过命令行自动化验证
- **G3**: 消除前端组件层直接调用 Tauri invoke 的架构违规
- **G4**: 消除 commands 层直接拼接 SQL 的架构违规
- **G5**: 更新架构现状文档，完整记录质量评估结果和改进路线图
- **G6**: 抽取公共工具函数，消除核心业务逻辑代码重复

## Non-Goals (Out of Scope)
- ❌ 不进行大规模架构重构（如更换框架、重写核心模块）
- ❌ 不修复所有 clippy 警告（仅修复 P1/P2 级，约前 30 个高频项）
- ❌ 不引入新的测试框架或覆盖率工具（本期仅量化现状）
- ❌ 不升级依赖版本（避免引入兼容性风险）
- ❌ 不修改 UI 样式或交互逻辑
- ❌ 不新增业务功能

## Background & Context
- **当前架构**: Rust 后端三层架构（commands/services/database/models）+ React 前端三层架构（components/store/services/types）
- **已知问题**:
  - Toolbar.tsx 中直接 `import('@tauri-apps/api/core')` 调用 invoke，违反前端分层规则
  - commands/file.rs 中使用 `format!` 拼接 SELECT SQL，违反后端分层规则
  - 311 处 unwrap/expect 调用（含测试代码），需审查生产代码使用情况
  - 3 处获取用户表名的 SQL 逻辑重复（sql.rs/router.rs/lib.rs），已导致 LIKE 转义 bug
  - 约 79 个 clippy 风格警告
- **规则体系**: `.trae/rules/` 下 9 条架构/安全/编码规则，architecture.md 定义分层约束
- **测试现状**: 后端 ~169 个单元测试 + 前端 98 个单元测试 + E2E 65 个测试

## Functional Requirements
- **FR-1**: 架构违规修复 — 前端 Toolbar.tsx 的直接 invoke 改为通过 tauriService
- **FR-2**: 架构违规修复 — commands/file.rs 的 SQL 拼接下沉到 service 层
- **FR-3**: 代码重复治理 — 抽取 `get_user_table_names()` 公共函数统一获取用户表列表
- **FR-4**: unwrap 治理 — 审查并修复生产代码中不安全的 unwrap/expect 使用
- **FR-5**: clippy 警告修复 — 修复前 30 个高频 clippy 警告（P1/P2 级）
- **FR-6**: 文档更新 — 更新架构现状.md 的质量保障章节，补充量化评估和改进路线图
- **FR-7**: 质量门禁脚本 — 提供一键质量检测命令，可验证所有 P0/P1 指标

## Non-Functional Requirements
- **NFR-1**: 所有修改不得破坏现有功能（cargo check + tsc + 现有测试必须全部通过）
- **NFR-2**: 架构分层违规数量从 2 降至 0（commands 层无 SQL、组件层无直接 invoke）
- **NFR-3**: 生产代码 unwrap/expect 数量减少 80% 以上（测试代码除外）
- **NFR-4**: clippy 警告数量减少 50% 以上
- **NFR-5**: 代码重复率降低（获取表名逻辑从 3 处减为 1 处）
- **NFR-6**: 所有修改必须遵循现有命名规范和代码风格

## Constraints
- **Technical**:
  - 必须保持与现有 Tauri 2 + React 19 + Rust 2021 技术栈兼容
  - 不得引入新的第三方依赖
  - 不得修改系统表结构或迁移逻辑
- **Business**:
  - 改进工作分阶段进行，每阶段可独立验证
  - 优先修复架构违规和安全问题，风格类改进后置
- **Dependencies**:
  - 依赖现有规则体系（.trae/rules/）作为评判标准
  - 依赖现有测试套件作为回归验证手段

## Assumptions
- 假设现有测试套件能覆盖核心功能，修改后跑通测试即无功能回归
- 假设 clippy 警告修复不会引入语义变化（仅风格改进）
- 假设 Toolbar.tsx 中的 invoke 调用可以通过 tauriService 等价替换
- 假设 file.rs 中的 SQL 可以下沉到 database_service 或新建的 file_service

## Acceptance Criteria

### AC-1: 前端架构合规（组件层无直接 invoke）
- **Given**: 当前代码库中 Toolbar.tsx 直接 import @tauri-apps/api/core
- **When**: 完成架构违规修复后
- **Then**: components/ 和 pages/ 目录下所有文件均无 `@tauri-apps/api/core` 的 import
- **Verification**: `programmatic`
- **Notes**: 检测命令：`Get-ChildItem -Path src/components,src/pages -Include *.ts,*.tsx -Recurse | Select-String -Pattern '@tauri-apps/api/core' | Measure-Object`，结果 Count = 0

### AC-2: 后端架构合规（commands 层无 SQL 拼接）
- **Given**: 当前代码库中 commands/file.rs 使用 format! 拼接 SQL
- **When**: 完成架构违规修复后
- **Then**: commands/ 目录下无 format! 拼接 SELECT/INSERT/UPDATE/DELETE SQL
- **Verification**: `programmatic`
- **Notes**: 检测命令：`Get-ChildItem -Path src-tauri/src/commands -Include *.rs -Recurse | Select-String -Pattern 'format!.*"SELECT|format!.*"INSERT|format!.*"UPDATE|format!.*"DELETE' | Measure-Object`，结果 Count = 0

### AC-3: 代码重复治理（获取表名逻辑统一）
- **Given**: 当前有 3 处独立的获取用户表名 SQL 逻辑
- **When**: 抽取公共函数后
- **Then**: 所有获取用户表名的调用都使用同一个公共函数
- **Verification**: `programmatic`
- **Notes**: 检测命令：`Get-ChildItem -Path src-tauri/src -Include *.rs -Recurse | Select-String -Pattern 'sqlite_master.*type.*table' | Measure-Object`，结果 Count ≤ 1（定义处）

### AC-4: 生产代码 unwrap 显著减少
- **Given**: 当前生产代码（不含 tests 模块）中有若干 unwrap/expect
- **When**: 完成 unwrap 治理后
- **Then**: 生产代码中 unwrap/expect 数量减少 80% 以上
- **Verification**: `programmatic`
- **Notes**: 仅统计非测试、非示例代码中的 unwrap/expect

### AC-5: clippy 警告数量减少 50% 以上
- **Given**: 当前约 79 个 clippy 警告
- **When**: 完成前 30 个高频警告修复后
- **Then**: clippy 警告数量 ≤ 40 个
- **Verification**: `programmatic`
- **Notes**: 使用 `cargo clippy --quiet 2>&1 | Select-String '^warning' | Measure-Object` 统计

### AC-6: 架构现状文档更新
- **Given**: 当前架构现状.md 质量保障章节为 v20.0
- **When**: 完成评估和改进后
- **Then**: 文档更新至 v21.0，包含四维评估、技术债务清单、改进路线图
- **Verification**: `human-judgment`
- **Notes**: 文档需包含安全性、规范性、架构合规性、可维护性四维评估

### AC-7: 所有现有测试通过
- **Given**: 现有测试套件全部通过
- **When**: 完成所有代码修改后
- **Then**: cargo test + vitest run + tsc --noEmit 全部通过
- **Verification**: `programmatic`
- **Notes**: 三项检测全部 0 errors / 0 failed

### AC-8: 敏感信息零硬编码
- **Given**: 当前无敏感信息硬编码
- **When**: 完成所有修改后
- **Then**: 生产代码中仍无 sk-/Bearer/ghp_/password: 等敏感字符串
- **Verification**: `programmatic`
- **Notes**: 检测命令：`Get-ChildItem -Path src-tauri/src,src -Include *.rs,*.ts,*.tsx -Recurse | Select-String -Pattern 'sk-|Bearer |ghp_|eyJ|password:' | Measure-Object`，Count = 0

## Open Questions
- [ ] Q1: commands/file.rs 中的 parquet_scan SQL 应下沉到哪个 service？database_service 还是新建 file_service？
- [ ] Q2: unwrap 治理是否包括 `Mutex::lock().unwrap()`？此类在标准库中通常被认为是可接受的
- [ ] Q3: clippy 警告修复是否需要新建单独的 spec 文档跟踪，还是合并在本 spec 中？
- [ ] Q4: 质量门禁脚本是放在 package.json scripts 中，还是单独的 PowerShell 脚本？

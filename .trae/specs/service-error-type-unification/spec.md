# Rust Service 层错误类型统一 — Product Requirement Document

## Overview
- **Summary**: 将后端 Rust Service 层所有 public 函数的错误返回类型统一为 `Result<T, String>`，目前只有 `project_service.rs` 使用自定义 `ProjectError` 枚举，需要修改。
- **Purpose**: 统一 Service 层错误类型，降低调用方（commands 层）的错误处理复杂度，提高代码一致性和可维护性。
- **Target Users**: 开发人员

## Goals
- G1: 所有 Service 文件的 public 函数统一使用 `Result<T, String>` 作为错误返回类型
- G2: 错误信息包含上下文描述和具体错误原因
- G3: 关键错误位置添加 `log::error!` 或 `log::warn!` 日志
- G4: 不修改业务逻辑，仅修改错误类型和错误处理

## Non-Goals (Out of Scope)
- ❌ 不修改业务逻辑
- ❌ 不修改 commands 层以外的调用方
- ❌ 不重构内部私有函数的错误处理
- ❌ 不引入新的错误类型或错误处理框架

## Background & Context
- 当前项目有 16 个 Service 文件，其中 15 个已经使用 `Result<T, String>`
- 只有 `project_service.rs` 使用自定义的 `ProjectError` 枚举（通过 `thiserror` 派生）
- commands 层调用 `ProjectService` 时需要处理不同的错误类型，增加了代码复杂度
- 架构规则要求 Service 层统一使用 `Result<T, String>`

## Functional Requirements
- **FR-1**: `project_service.rs` 的所有 public 函数返回类型从 `Result<T>`（`ProjectError`）改为 `Result<T, String>`
- **FR-2**: 错误信息包含上下文（如 "创建项目失败"）和具体错误原因
- **FR-3**: 关键错误位置添加适当的日志记录
- **FR-4**: `commands/project.rs` 和 `commands/startup.rs` 中调用 `ProjectService` 的地方适配新的错误类型
- **FR-5**: 内部私有函数可以继续使用 `Result<T, ProjectError>`，在 public 函数边界转换为 `String`

## Non-Functional Requirements
- **NFR-1**: 编译通过，无 warning
- **NFR-2**: 所有现有测试通过
- **NFR-3**: 不引入新的 `unwrap()` / `expect()`
- **NFR-4**: 错误信息对用户可读，包含足够的上下文

## Constraints
- **Technical**: Rust 语言、Tauri 框架、rusqlite
- **Business**: 不改变业务功能，仅修改错误处理
- **Dependencies**: 不新增依赖，可以移除 `thiserror`（如确认无其他用途）

## Assumptions
- `thiserror` 只在 `project_service.rs` 中使用
- 测试代码中直接匹配 `ProjectError` 变体的部分需要调整
- commands 层目前通过 `.map_err(|e| e.to_string())` 或类似方式转换错误

## Acceptance Criteria

### AC-1: ProjectService public 函数错误类型统一
- **Given**: 当前 `project_service.rs` 使用 `Result<T, ProjectError>`
- **When**: 修改完成后
- **Then**: 所有 public 函数返回 `Result<T, String>`
- **Verification**: `programmatic`
- **Notes**: 用 grep 检查 `pub fn.*-> Result<` 返回类型中是否还有 `ProjectError`

### AC-2: 错误信息包含上下文
- **Given**: Service 函数执行失败
- **When**: 返回错误时
- **Then**: 错误字符串包含操作上下文（如 "创建项目失败"）和具体错误原因
- **Verification**: `human-judgment`

### AC-3: 关键错误位置有日志
- **Given**: Service 函数执行失败
- **When**: 发生数据库操作、文件系统操作等关键错误时
- **Then**: 有 `log::error!` 或 `log::warn!` 记录
- **Verification**: `programmatic`
- **Notes**: 检查是否有合理的日志记录

### AC-4: 编译通过
- **Given**: 所有修改完成
- **When**: 执行 `cargo check --quiet`
- **Then**: 无编译错误
- **Verification**: `programmatic`

### AC-5: 测试通过
- **Given**: 所有修改完成
- **When**: 执行 `cargo test --quiet`
- **Then**: 所有测试通过
- **Verification**: `programmatic`

### AC-6: 无新增 unwrap/expect
- **Given**: 所有修改完成
- **When**: 检查修改的文件
- **Then**: 没有新增的 `unwrap()` 或 `expect()`
- **Verification**: `programmatic`

## Open Questions
- [ ] 是否需要在修改完成后移除 `thiserror` 依赖？（待确认无其他用途后再处理）

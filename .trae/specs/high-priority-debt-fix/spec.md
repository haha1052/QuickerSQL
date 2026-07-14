# 高优先级剩余技术债务修复 - Product Requirement Document

## Overview
- **Summary**: 修复高优先级剩余技术债务，包括 Service 层错误类型统一、Context 与 Store 职责梳理，提升代码质量和可维护性
- **Purpose**: 清理高优先级技术债务，为 Beta 发布做准备
- **Target Users**: 开发团队（提升代码质量）

## Goals
- G1: 完成 Service 层错误类型统一（D-07），统一核心 Service 的错误处理方式
- G2: 梳理 Context 与 Store 职责（D-08），明确边界，减少维护成本
- G3: 全量回归测试通过，确保修改不引入新问题

## Non-Goals (Out of Scope)
- ❌ 不做完整的架构重构
- ❌ 不引入新的状态管理库
- ❌ 不重写现有稳定运行的业务逻辑
- ❌ 不做完整的 Context 迁移到 Store（只做职责梳理和边界明确）

## Background & Context
- 当前高优先级技术债务剩余 3 项：
  - D-07: Service 层错误类型不统一（部分完成）
  - D-08: Context 与 Store 职责重叠（待处理）
  - D-10: 测试覆盖不足（Day 4 已完成大部分）
- 5天发布计划已完成 Day 1-4，Day 5 是发布准备
- 需要在发布前尽量清理高优先级债务

## Functional Requirements
- **FR-1**: Service 层错误类型统一（D-07 完成）
  - 统一所有 Service 层的返回错误类型为 String
  - 确保错误信息清晰，包含上下文
  - 添加必要的错误日志
- **FR-2**: Context 与 Store 职责梳理（D-08 部分完成）
  - 明确 AppContext 的职责：全局 UI 状态（页面切换、模态框控制）
  - 明确 Store 的职责：业务数据状态
  - 不做大规模迁移，只做边界明确和文档化
  - 将可以迁移的简单状态迁移到 Store
- **FR-3**: 全量回归测试

## Non-Functional Requirements
- **NFR-1**: 不影响现有功能的正常运行
- **NFR-2**: TypeScript 编译 0 errors
- **NFR-3**: Rust 编译 0 errors
- **NFR-4**: 所有单元测试通过
- **NFR-5**: 遵循 CLAUDE.local.md 中的核心规则

## Constraints
- **Technical**: Rust / TypeScript / React / Zustand
- **Business**: 发布前清理，时间有限
- **Dependencies**: 不引入新的依赖

## Assumptions
- Service 层错误统一为 String 类型是可接受的
- Context 与 Store 的职责边界可以通过文档和少量调整明确
- 不需要大规模重构就能达到发布标准

## Acceptance Criteria

### AC-1: Service 层错误类型统一
- **Given**: 核心 Service 函数
- **When**: 检查错误返回类型
- **Then**: 所有 public 函数返回 Result<T, String>
- **Verification**: `programmatic`
- **Notes**: 只处理核心 Service，内部私有函数可以灵活处理

### AC-2: Context 与 Store 职责明确
- **Given**: AppContext 和各个 Store
- **When**: 审查职责边界
- **Then**: 职责边界清晰，有文档说明
- **Verification**: `human-judgment`
- **Notes**: 不做大规模迁移，只做边界明确

### AC-3: 全量回归测试通过
- **Given**: 所有修改完成
- **When**: 运行全量测试
- **Then**: 所有测试通过
- **Verification**: `programmatic`

## Open Questions
- [ ] Q1: Service 层错误类型统一到什么程度？所有 Service 还是只核心 Service？
- [ ] Q2: Context 中哪些状态可以迁移到 Store？

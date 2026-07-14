# Day 4 - 测试加固 - Product Requirement Document

## Overview
- **Summary**: 提升测试覆盖，降低回归风险。为核心 Service 添加单元测试，为核心工具函数补充测试，完善 E2E 测试核心流程，确保代码质量稳定可靠
- **Purpose**: 提升代码质量，降低发布后的回归风险，确保核心功能稳定
- **Target Users**: 开发团队（提升代码质量）

## Goals
- G1: 为核心 Rust Service 添加单元测试，提升测试覆盖率
- G2: 为核心工具函数补充测试，覆盖更多边界场景
- G3: 完善 E2E 测试核心流程，覆盖关键用户旅程
- G4: 全量回归测试通过，确保所有修改不引入新问题

## Non-Goals (Out of Scope)
- ❌ 不做 100% 测试覆盖率（成本收益比不合理）
- ❌ 不做组件级别的 UI 测试（Vitest 不适合）
- ❌ 不做性能基准测试（需要独立的任务）
- ❌ 不修改现有稳定运行的业务逻辑

## Background & Context
- 当前后端有 169 个测试，前端有 43 个测试
- Service 层业务逻辑测试不足
- 错误路径测试不足
- E2E 测试框架已就绪（Playwright）但用例不足

## Functional Requirements
- **FR-1**: 核心 Rust Service 单元测试
  - dashboard_service 核心函数测试
  - settings_service 核心函数测试
  - query_history_service 核心函数测试
- **FR-2**: 核心工具函数测试补充
  - 前端工具函数测试（gridLayout, virtual, filterSql 已覆盖）
  - 后端工具函数测试（SQL 解析、缓存键生成等）
- **FR-3**: E2E 测试完善
  - 新建查询、执行 SQL 流程
  - 创建仪表盘、添加图表流程
- **FR-4**: 全量回归测试
  - Rust 后端测试全部通过
  - 前端测试全部通过
  - TypeScript 编译无错误
  - Rust 编译无错误

## Non-Functional Requirements
- **NFR-1**: 测试代码风格与现有代码一致
- **NFR-2**: 不引入新的 any 类型
- **NFR-3**: 测试用例命名清晰，可读性好
- **NFR-4**: 遵循 CLAUDE.local.md 中的核心规则

## Constraints
- **Technical**: Vitest / Cargo test / Playwright
- **Business**: 必须在 Day 4 内完成
- **Dependencies**: 不引入新的测试框架

## Assumptions
- 现有测试框架（Vitest, Cargo test, Playwright）已就绪
- 核心 Service 的公共接口已稳定
- E2E 测试可以访问 localhost:1420

## Acceptance Criteria

### AC-1: Rust Service 单元测试
- **Given**: 核心 Service 的公共函数
- **When**: 编写单元测试
- **Then**: 测试覆盖核心函数的正常路径和错误路径
- **Verification**: `programmatic`
- **Notes**: 目标：新增 15+ 个 Service 测试用例

### AC-2: 工具函数测试补充
- **Given**: 核心工具函数
- **When**: 编写单元测试
- **Then**: 测试覆盖边界条件和异常情况
- **Verification**: `programmatic`
- **Notes**: 目标：新增 10+ 个工具函数测试用例

### AC-3: E2E 测试完善
- **Given**: 核心用户旅程
- **When**: 编写 E2E 测试
- **Then**: 测试覆盖关键用户操作流程
- **Verification**: `programmatic`
- **Notes**: 目标：完善 2 个核心场景的 E2E 测试

### AC-4: 全量回归测试通过
- **Given**: 所有修改完成
- **When**: 运行全量测试
- **Then**: 所有测试通过，无回归
- **Verification**: `programmatic`

## Open Questions
- [ ] Q1: E2E 测试是否需要在真实 Tauri 环境中运行？
- [ ] Q2: Service 测试的 mock 策略是什么？

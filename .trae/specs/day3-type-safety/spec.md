# Day 3 - 类型安全与稳定性 - Product Requirement Document

## Overview
- **Summary**: 消除前端 TypeScript 中的 any 类型以提升类型安全，优化后端 Rust Service 层的错误处理，增强前端 Store 层的稳定性，全面提升代码质量
- **Purpose**: 减少运行时错误风险，提高代码可维护性，为 Beta 发布提供更稳定的基础
- **Target Users**: 开发团队（提升代码质量）

## Goals
- G1: 消除或替换前端高风险的 any 类型，提升 TypeScript 类型安全
- G2: 统一后端 Rust Service 层的错误处理方式
- G3: 前端 Store 层关键逻辑添加 try/catch 兜底，防止未捕获异常
- G4: 关键路径回归测试确保修改不引入新问题

## Non-Goals (Out of Scope)
- ❌ 不重写整个前端类型系统
- ❌ 不引入新的 TypeScript 配置（如 strictNullChecks 等）
- ❌ 不做完整的 Rust Service 重构，只做错误处理的统一
- ❌ 不修改已稳定运行的业务逻辑

## Background & Context
- 当前前端存在约 11 处 any 类型使用，其中部分是高风险的
- 后端 Rust Service 层错误处理不统一（部分返回 String，部分返回 Box<dyn Error>）
- 前端 Store 层部分异步操作缺少异常兜底
- 需要在不影响现有功能的前提下进行类型安全提升

## Functional Requirements
- **FR-1**: 消除或替换前端 any 类型
  - Sidebar.tsx: 批量导入结果处理
  - AppWrapper.tsx: 主题配置处理
  - DashboardItem.tsx: ECharts 配置优化
  - SQLEditor.tsx: Monaco Editor 配置
  - sqlCompletionProvider.ts: Monaco 配置
- **FR-2**: 统一后端 Rust Service 层错误处理
  - 定义统一的错误类型或错误处理模式
  - 优先简化版：统一使用 String 错误类型
- **FR-3**: 前端 Store 层关键逻辑添加 try/catch
  - 关键异步操作的异常捕获
  - 错误状态的友好处理
- **FR-4**: 关键路径回归测试
  - SQL 执行流程
  - 数据导入流程
  - 仪表盘创建流程

## Non-Functional Requirements
- **NFR-1**: 修改后 TypeScript 编译 0 errors
- **NFR-2**: 修改后 Rust 编译 0 errors
- **NFR-3**: 不引入新的 any 类型
- **NFR-4**: 不影响现有功能的正常运行
- **NFR-5**: 遵循 CLAUDE.local.md 中的核心规则

## Constraints
- **Technical**: TypeScript strict 模式、Rust 错误处理
- **Business**: 必须在 Day 3 内完成
- **Dependencies**: 不引入新的第三方依赖

## Assumptions
- Monaco Editor 类型定义（@monaco-editor/react）已经存在，可以用正确类型替代 any
- ECharts 的配置对象可以用 Record<string, unknown> 或具体类型替代 any
- Sidebar 的批量导入结果可以用明确的接口类型替代 any
- Service 层错误统一为 String 类型是可以接受的简化方案

## Acceptance Criteria

### AC-1: any 类型消除
- **Given**: 前端代码中存在 any 类型
- **When**: 代码审查和修改
- **Then**: 高风险的 any 类型被替换为正确的类型或 unknown
- **Verification**: `programmatic`
- **Notes**: 测试代码中的 any 可保留

### AC-2: Service 层错误处理统一
- **Given**: Rust Service 层有不同的错误处理方式
- **When**: 修改 Service 函数
- **Then**: 关键 Service 函数的错误处理方式统一
- **Verification**: `programmatic`
- **Notes**: 优先统一涉及核心功能的 Service

### AC-3: Store 层稳定性增强
- **Given**: 前端 Store 层关键异步操作
- **When**: 修改 Store 逻辑
- **Then**: 关键异步操作有 try/catch 兜底
- **Verification**: `programmatic`
- **Notes**: 只处理确实缺少异常处理的场景

### AC-4: 编译和测试通过
- **Given**: 所有修改完成
- **When**: 运行编译和测试
- **Then**: TypeScript 0 errors, Rust 0 errors, 所有单元测试通过
- **Verification**: `programmatic`

### AC-5: 核心功能正常
- **Given**: 代码修改完成
- **When**: 运行应用
- **Then**: SQL 执行、数据导入、仪表盘功能正常
- **Verification**: `human-judgment`

## Open Questions
- [ ] Q1: Monaco Editor 的类型定义是否完整？是否需要额外安装类型包？
- [ ] Q2: ECharts 配置的具体类型是否需要完整定义？还是用 Record<string, unknown> 替代？
- [ ] Q3: Service 层错误处理统一到什么程度？完全统一还是只统一核心 Service？

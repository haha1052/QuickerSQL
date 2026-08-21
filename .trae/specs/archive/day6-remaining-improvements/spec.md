# Day 6 待改进项推进方案

## Overview

- **Summary**：推进架构现状文档中剩余的 3 项待改进工作：集成测试补充、前端 JSDoc 覆盖率提升、用户使用手册编写
- **Purpose**：进一步提升项目质量评分，从 8.6/10 迈向更高
- **Target Users**：开发团队成员、项目维护者

## Goals

- **G1**：前端 JSDoc 注释覆盖率提升 50%（从约 0.7% 提升到 1.5%+）
- **G2**：集成测试覆盖核心业务流程（设置系统、仪表盘系统、自动化任务系统）
- **G3**：编写用户使用手册核心章节（Getting Started、功能模块说明）

## Non-Goals

- ❌ 不做完整的 API 文档（那是 API 设计方案的范畴）
- ❌ 不做国际化翻译手册
- ❌ 不做部署运维手册

## Background & Context

当前项目综合质量评分 8.6/10，剩余 3 项待改进：
1. **集成测试**：后端 249 个测试都是单元测试，缺少业务流程层面的集成验证
2. **JSDoc 覆盖率**：TS 代码 178 行 JSDoc（约 0.7%），需要系统性提升
3. **用户手册**：文档体系完善但缺少用户使用手册

## Functional Requirements

### FR-1：前端 JSDoc 覆盖率提升

- 为 `src/components/` 下的关键组件添加模块级注释
- 为 `src/store/` 下的所有 store 添加函数级注释
- 为 `src/services/tauri.ts` 补充完整注释
- 目标文件：
  - `src/store/appStore.ts`
  - `src/store/settingsStore.ts`
  - `src/store/taskStore.ts`
  - `src/services/tauri.ts`
  - `src/components/common/*.tsx`（5 个核心组件）

### FR-2：集成测试补充

- 编写 Rust 集成测试，覆盖以下业务流程：
  - **设置系统**：创建 → 读取 → 更新 → 删除（CRUD）
  - **仪表盘系统**：创建图表 → 保存 → 加载 → 删除
  - **自动化任务**：创建任务 → 触发运行 → 查看日志
- 集成测试命名：`src-tauri/src/services/tests/` 目录

### FR-3：用户使用手册编写

- 创建 `docs/用户手册.md`
- 章节内容：
  - 第 1 章：快速开始（安装、启动、基本操作）
  - 第 2 章：数据查询（连接、查询、结果展示）
  - 第 3 章：仪表盘（创建图表、布局、保存）
  - 第 4 章：自动化任务（创建任务、调度、监控）

## Non-Functional Requirements

- **NFR-1**：所有新增代码必须通过编译检查
- **NFR-2**：所有测试必须通过且不破坏现有功能
- **NFR-3**：文档使用 Markdown 格式，便于阅读和维护

## Constraints

- **前端注释**：只添加必要的注释，不做过度注释
- **集成测试**：使用 Rust 内置测试框架，不引入额外依赖
- **用户手册**：只做核心章节，不做完整手册

## Assumptions

- 用户手册的目标读者是初级到中级用户
- 集成测试可以复用现有的数据库测试基础设施
- JSDoc 补充以组件导出函数为主，不做行内注释

## Acceptance Criteria

### AC-1：前端 JSDoc 覆盖率
- **Given**：所有待注释文件
- **When**：审查代码注释覆盖率
- **Then**：JSDoc 行数从约 178 行提升到 300+ 行
- **Verification**：`programmatic`

### AC-2：集成测试
- **Given**：三个核心业务系统
- **When**：运行集成测试
- **Then**：至少 10 个集成测试用例通过
- **Verification**：`programmatic`

### AC-3：用户使用手册
- **Given**：用户手册文件
- **When**：创建核心章节
- **Then**：至少包含 4 章，每章至少 500 字
- **Verification**：`human-judgment`

### AC-4：质量评分
- **Given**：完成所有改进
- **When**：评估项目质量
- **Then**：综合评分从 8.6/10 提升到 8.8/10
- **Verification**：`programmatic`

## Open Questions

- [ ] Q1：集成测试是否需要单独的测试数据库实例？
- [ ] Q2：用户手册的截图是否需要？
- [ ] Q3：是否需要添加 CONTRIBUTING.md？

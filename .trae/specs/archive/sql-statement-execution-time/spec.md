# 单条SQL执行耗时返回 - Product Requirement Document

## Overview
- **Summary**: 当一个查询框中同时执行多个 SQL 语句时，每个语句应返回单独的执行耗时，而不是所有语句共享同一整体耗时。
- **Purpose**: 用户需要知道多个 SQL 语句中哪个耗时最长，以便进行性能优化和排查慢查询。
- **Target Users**: 使用多语句 SQL 查询的用户

## Goals
- G1: `SqlStatementResult` 结构体添加 `execution_time_ms` 字段
- G2: 后端执行每个 SQL 语句时记录并返回单独耗时
- G3: 前端显示每个 SQL 语句的单独执行耗时

## Non-Goals (Out of Scope)
- ❌ 不修改整体执行耗时的显示
- ❌ 不修改查询历史中已有的耗时记录逻辑
- ❌ 不修改缓存机制（缓存命中时返回合理的耗时值）

## Background & Context
- 当前后端 `sql_service.rs` 中已在 `stmt_start` 记录每个语句的执行开始时间，并计算了耗时存入 `execution_metadatas`
- 但 `SqlStatementResult` 结构体没有 `execution_time_ms` 字段，导致前端无法显示单独耗时
- 前端 `QueryResultItem.tsx` 已有 `formatExecutionTime` 函数和显示逻辑，期望从 `result.execution_time_ms` 获取数据

## Functional Requirements
- **FR-1**: 在 `SqlStatementResult` 结构体中添加 `execution_time_ms: Option<i64>` 字段
- **FR-2**: 在 `execute_sql_batch` 函数中，为每个语句的结果设置 `execution_time_ms` 值
- **FR-3**: 在 `commands/sql.rs` 的缓存命中快路径中，也设置正确的 `execution_time_ms` 值
- **FR-4**: 前端正确显示每个语句的单独执行耗时

## Non-Functional Requirements
- **NFR-1**: 不影响现有功能和性能
- **NFR-2**: 向后兼容，`execution_time_ms` 为 `Option` 类型

## Constraints
- **Technical**: Rust + TypeScript 前后端分离架构
- **Dependencies**: 后端 models 变更需同步到前端 types

## Assumptions
- 前端 types 定义与后端 models 保持一致
- 缓存命中时，耗时记录为查询缓存的时间（通常非常短）

## Acceptance Criteria

### AC-1: SqlStatementResult 包含 execution_time_ms 字段
- **Given**: 后端执行多语句 SQL
- **When**: 返回 `BatchExecuteResult`
- **Then**: 每个 `SqlStatementResult` 包含 `execution_time_ms` 字段
- **Verification**: `programmatic`

### AC-2: 每个 SQL 语句返回单独的执行耗时
- **Given**: 用户执行包含多个 SQL 语句的查询（如 SELECT COUNT(*); SELECT * FROM users;）
- **When**: 查询执行完成
- **Then**: 每个结果集显示各自的执行耗时，耗时值不同（除非恰好相同）
- **Verification**: `human-judgment`

### AC-3: 缓存命中时返回合理的耗时值
- **Given**: 执行已缓存的 SQL 语句
- **When**: 缓存命中直接返回
- **Then**: 返回的 `execution_time_ms` 值应很小（通常 < 10ms）
- **Verification**: `human-judgment`

## Open Questions
- [ ] 前端 types 是否需要同步添加 `execution_time_ms` 字段？


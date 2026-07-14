# 查询结果集 UI 优化修复 — Product Requirement Document

## Overview
- **Summary**：修复查询结果集上下方内容被遮挡的问题，并在执行引擎标识后补充返回结果条数显示。
- **Purpose**：提升查询结果展示的完整性和信息密度，确保用户能看到完整的结果信息（包括分页信息、行数统计等）。
- **Target Users**：所有使用 SQL 查询功能的用户

## Goals
- G1：修复结果集内容遮挡问题，确保分页信息、警告信息等底部内容完整可见
- G2：在执行引擎标识（SQLite/DuckDB badge）后补充返回结果条数
- G3：不影响现有结果展示功能（表格、图表、导出等）

## Non-Goals (Out of Scope)
- ❌ 不重构整个查询结果组件的整体布局结构
- ❌ 不修改后端 SQL 执行逻辑
- ❌ 不添加新的导出/格式
- ❌ 不修改 ag-grid 的表格渲染逻辑

## Background & Context
- 当前 QueryResultItem 组件中，容器高度 `contentHeight` 仅计算了表格+分页+警告的高度，但未计入 header 高度（约 40px），导致底部内容被 `overflow: hidden` 截断
- 结果集 header 中显示了序号、SQL 语句、耗时、引擎标识、成功/失败状态、表格/图表切换、导出菜单
- 缺少结果行数的快速查看，用户需要滚动到底部才能看到总行数
- 用户反馈结果集上下方内容被遮挡

## Functional Requirements
- **FR-1**：修复结果集高度计算，确保 header + 表格 + 分页 + 警告全部内容完整显示，无遮挡
- **FR-2**：在引擎标识 badge 后添加结果行数显示（如 "1000 行"）
- **FR-3**：行数显示仅在查询成功且有返回结果时显示
- **FR-4**：行数显示格式与整体 UI 风格一致

## Non-Functional Requirements
- **NFR-1**：修复后不引入新的布局问题
- **NFR-2**：不影响结果集的响应式布局
- **NFR-3**：代码改动最小化

## Constraints
- **Technical**：React + ag-grid-community
- **Business**：保持现有 UI 风格统一
- **Dependencies**：依赖现有 SqlStatementResult 数据结构

## Assumptions
- 遮挡问题是由于高度计算未包含 header 高度导致的
- 行数数据可以从 `result.rows.length` 获取

## Acceptance Criteria

### AC-1: 结果集底部内容完整可见
- **Given**：用户执行 SQL 查询，有返回结果
- **When**：查看结果集
- **Then**：分页信息、警告信息等底部内容完整可见，无遮挡
- **Verification**: `human-judgment`
- **Notes**：需验证多种场景：单行结果、多行结果、有分页、无分页、有警告、无警告

### AC-2: 引擎标识后显示结果行数
- **Given**：用户执行 SQL 查询，有返回结果（columns 和 rows）
- **When**：查看结果集 header
- **Then**：在引擎标识 badge 后显示结果行数
- **Verification**: `human-judgment`
- **Notes**：格式如 "1,234 行" 或类似样式

### AC-3: 无结果时不显示行数
- **Given**：用户执行 SQL 查询，无返回结果（如 INSERT/UPDATE/DELETE 等）
- **When**：查看结果集 header
- **Then**：不显示行数
- **Verification**: `human-judgment`

### AC-4: 编译通过
- **Given**：修复代码后
- **When**：执行 TypeScript 类型检查
- **Then**：无类型错误
- **Verification**: `programmatic`

### AC-5: 功能正常
- **Given**：修复后
- **When**：使用各种 SQL 查询（SELECT/INSERT/UPDATE/DELETE/EXPLAIN 等）
- **Then**：结果展示正常，无新问题
- **Verification**: `human-judgment`

## Open Questions
- [ ] 行数显示格式是否需要本地化（如 1,000 行显示 1 千行
- [ ] 是否需要显示列数（本次暂不实现，用户未提及

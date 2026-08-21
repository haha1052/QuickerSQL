# 查询结果高度问题修复 Spec v2（修正版）

## Overview
- **Summary**: 修复移除 autoHeight 后表格不显示的问题，恢复 autoHeight 模式，最小高度设为 200px，最大高度 800px
- **Purpose**: 用户反馈修改后表格不显示了，需要回退到 autoHeight 模式并调整高度策略
- **Target Users**: 所有使用SQL查询功能的用户

## Goals
- 表格内容正常显示（修复空白问题）
- 每个结果项最小高度 200px
- 每个结果项最大高度 800px，超过时内部滚动
- 多个结果项依次排列，总高度无限制
- 数据少时自适应，数据多时充分利用空间

## Non-Goals
- 不修改分页逻辑
- 不修改图表视图
- 不修改数据返回链路

## Background & Context

### 问题分析
v1 版本移除了 `domLayout="autoHeight"`，改用 normal 模式，但：
1. ag-grid normal 模式需要明确的高度才能渲染表格内容
2. flex 布局嵌套导致高度传递失效
3. 最终表格内容区域高度为 0，显示空白

### 修复方案
恢复 `domLayout="autoHeight"`，通过容器的 maxHeight + overflow 实现滚动：
- ag-grid 使用 autoHeight，确保表格一定能正常渲染
- tableContainer 设置 maxHeight: 720px + overflow: auto
- 数据少时，表格高度自适应，结果项高度 = 内容高度
- 数据多时，tableContainer 出现滚动条，结果项总高度不超过 800px

## Functional Requirements
- **FR-1**: 恢复 domLayout="autoHeight"，确保表格正常显示
- **FR-2**: 结果项最小高度 200px
- **FR-3**: 结果项最大高度 800px
- **FR-4**: tableContainer maxHeight 720px + overflow auto，实现内部滚动
- **FR-5**: 多结果集总高度无限制，外层滚动

## Acceptance Criteria

### AC-1: 表格内容正常显示
- **Given**: 查询返回任意行数的数据
- **When**: 渲染结果表格
- **Then**: 表格内容正常显示，不会空白
- **Verification**: `human-judgment`

### AC-2: 小结果集自适应高度
- **Given**: 查询返回 5 行数据
- **When**: 渲染结果表格
- **Then**: 结果项高度自适应，不浪费过多空间
- **Verification**: `human-judgment`

### AC-3: 大结果集最大800px
- **Given**: 查询返回 1000 行数据
- **When**: 渲染结果表格
- **Then**: 结果项总高度不超过 800px，表格内部可滚动
- **Verification**: `human-judgment`

### AC-4: 多结果集排列正常
- **Given**: 执行多个 SQL 查询
- **When**: 查看结果区域
- **Then**: 每个结果项独立显示，通过外层滚动查看
- **Verification**: `human-judgment`

### AC-5: 编译通过
- **Verification**: `programmatic`

## Open Questions
- [ ] 无

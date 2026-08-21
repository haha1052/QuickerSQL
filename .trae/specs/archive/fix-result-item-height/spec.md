# 查询结果项高度修复 Spec

## Overview
- **Summary**: 修复多个SQL结果项显示高度过窄的问题，确保每个结果项最大高度800px，内容超过时内部滚动，总列表由外层面板滚动
- **Purpose**: 用户执行多个SQL查询时，每个结果项的表格区域被压缩到几乎不可见，需要确保每个结果项有足够的显示空间
- **Target Users**: 所有使用SQL查询功能的用户

## Goals
- 每个 SQL 结果项最大高度 800px，内容超过时内部滚动
- 多个结果项依次排列，总高度无限制，由外层面板滚动查看
- 小结果集自适应高度，不浪费空间

## Non-Goals (Out of Scope)
- 不修改分页逻辑
- 不修改图表视图
- 不添加可拖拽调整高度功能

## Background & Context
当前代码存在以下问题：
1. `QueryResultItem` 容器有 `flex: 1` 但缺少 `overflow: auto`，导致在 flex 容器中被压缩
2. `tableWrapper` 设置了 `overflow: hidden`，阻止表格内容滚动
3. `resultsContainer` 缺少 `overflowY: auto`，中间层滚动链路断裂

## Functional Requirements
- **FR-1**: 每个结果项容器有 `maxHeight: 800px` 和 `overflow: auto`
- **FR-2**: `tableWrapper` 移除 `overflow: hidden`，允许内容自然延伸
- **FR-3**: `resultsContainer` 添加 `overflowY: auto`，确保滚动链路完整

## Constraints
- 保持 `domLayout="autoHeight"` 实现自适应
- 不影响错误结果、空结果、图表视图的显示
- 保持单个结果项最大高度 800px 不变

## Acceptance Criteria

### AC-1: 单个大结果集显示正常
- **Given**: 查询返回 1000 行数据
- **When**: 渲染结果表格
- **Then**: 结果项最大高度 800px，表格内部可滚动
- **Verification**: `human-judgment`

### AC-2: 多个结果集排列正常
- **Given**: 执行 5 个 SQL 查询，每个返回 100 行数据
- **When**: 查看结果区域
- **Then**: 每个结果项正常显示，不会被压缩到不可见
- **And**: 总列表可通过外层面板滚动查看
- **Verification**: `human-judgment`

### AC-3: 编译通过
- **Given**: 修改后的代码
- **When**: 运行 `npx tsc --noEmit --pretty`
- **Then**: 类型检查通过
- **Verification**: `programmatic`

## Open Questions
- [ ] 无

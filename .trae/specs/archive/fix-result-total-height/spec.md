# 修复总结果集高度限制 Spec

## Why
当前每个 SQL 结果的最大高度已设为 800px，但总的结果列表区域被限制在面板高度内，通过内部滚动查看。用户希望：
- 每个 SQL 结果项最大高度 800px（已完成）
- 总结果列表不设最大高度，自然延伸，由外层面板滚动条查看全部结果

## What Changes
- 修改 `QueryResult.tsx` 的容器样式，移除总高度限制
- 移除 `resultsContainer` 的内部滚动
- 修改 `PanelManager.tsx` 的 `panelContent` 样式，启用 overflow: auto
- 让结果列表自然延伸，由外层 `panelContent` 处理滚动

## Impact
- Affected code:
  - `src/components/sql/QueryResult.tsx`
  - `src/components/workspace/PanelManager.tsx`

## ADDED Requirements

### Requirement: 每个结果项最大 800px，总列表无高度限制

#### Scenario: 执行多个 SQL 查询
- **GIVEN** 执行 5 个 SQL 查询，每个返回 100 行数据
- **WHEN** 查看结果区域
- **THEN** 每个结果项最大高度约 800px（内容多时内部滚动）
- **AND** 5 个结果依次排列，总高度 = 5 个结果高度之和
- **AND** 通过外层面板的滚动条查看所有结果

#### Scenario: 单个小结果
- **GIVEN** 执行 1 个 SQL 查询，只返回 5 行数据
- **WHEN** 查看结果区域
- **THEN** 结果项高度自适应内容
- **AND** 不会出现多余空白

## NON-GOALS
- ❌ 不修改 QueryResultItem 的高度
- ❌ 不修改 SqlQueryPage 的分隔条逻辑
- ❌ 不修改分页功能

## Constraints
- 保持 QueryResultItem 的 maxHeight 800px 不变
- 不影响编辑器与结果区的拖拽分隔功能
- 空结果、加载状态的显示保持正常

## Acceptance Criteria

### AC-1: 总结果列表无高度限制
- **Given**: 执行多个 SQL 查询
- **When**: 查看结果区域
- **Then**: 所有结果依次排列，总高度无限制
- **And**: 通过外层滚动条查看所有结果
- **Verification**: `human-judgment`

### AC-2: 每个结果项最大 800px
- **Given**: 单个查询返回大量数据
- **When**: 查看该结果项
- **Then**: 结果项最大高度约 800px
- **And**: 表格内部可滚动
- **Verification**: `human-judgment`

### AC-3: 编译通过
- **Given**: 修改后的代码
- **When**: 运行 `npx tsc --noEmit --pretty`
- **Then**: 类型检查通过
- **Verification**: `programmatic`

## Open Questions
- [ ] 无


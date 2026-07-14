# 查询结果区域高度优化 Spec

## Why
当执行多个 SQL 时，每个 SQL 的结果返回显示区域太窄（最大只有约 520-600px），查看大结果集时需要频繁滚动。用户希望每个 SQL 结果的最大高度增加到 800px，内容不足时显示实际高度。

## What Changes
- 增大 `QueryResultItem` 组件的结果区域最大高度，从 600px 增加到 800px
- 调整内部各层容器的 maxHeight 使其层级一致
- 保持 `domLayout="autoHeight"` 行为，内容不足 800px 时显示实际高度

## Impact
- Affected code:
  - `src/components/sql/QueryResultItem.tsx`

## ADDED Requirements

### Requirement: 查询结果最大高度为 800px
每个 SQL 查询结果区域的最大高度为 800px。

#### Scenario: 大结果集显示
- **GIVEN** 查询返回 1000 行数据
- **WHEN** 渲染结果表格
- **THEN** 结果区域高度为 800px
- **AND** 表格内部可滚动查看更多数据

#### Scenario: 小结果集显示
- **GIVEN** 查询只返回 5 行数据
- **WHEN** 渲染结果表格
- **THEN** 结果区域高度自适应内容
- **AND** 不会出现空白区域

## NON-GOALS
- ❌ 不修改其他组件的高度
- ❌ 不修改分页逻辑
- ❌ 不增加可拖拽调整高度功能

## Constraints
- 使用 CSS `maxHeight` 控制上限
- 保持 `domLayout="autoHeight"` 实现自适应
- 不影响错误结果、空结果、图表视图的显示

## Acceptance Criteria

### AC-1: 最大高度增加到 800px
- **Given**: 有大量数据的查询结果
- **When**: 渲染结果表格
- **Then**: 结果区域最大高度为 800px
- **Verification**: `human-judgment`

### AC-2: 小结果集自适应高度
- **Given**: 只有少量数据的查询结果
- **When**: 渲染结果表格
- **Then**: 结果区域高度适应内容，不强制 800px
- **Verification**: `human-judgment`

### AC-3: 编译通过
- **Given**: 修改后的代码
- **When**: 运行 `npx tsc --noEmit --pretty`
- **Then**: 类型检查通过
- **Verification**: `programmatic`

## Open Questions
- [ ] 无


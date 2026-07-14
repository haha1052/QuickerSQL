# 查询结果集高度计算修复 v3 — The Implementation Plan (Decomposed and Prioritized Task List)

## [x] Task 1: 修复 flex 布局中 ag-grid 高度计算问题
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 修改 `src/components/sql/QueryResultItem.tsx` 中的 flex 布局
  - 核心问题：flex 列布局中，子元素的 `height: 100%` 需要父元素有明确高度值才能正确计算
  - 当前问题：`tableContainer` 使用 `flex: 1` + `minHeight: 0`，但没有明确的 `height`，导致 ag-grid 的 `height: 100%` 计算不准确
  - 修复方案：将 `contentWrapper`、`tableWrapper`、`tableContainer` 的 `minHeight: 0` 改为 `height: 0`，配合 `flex: 1` 确保子元素百分比高度正确计算
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-3
- **Test Requirements**:
  - `human-judgement` TR-1.1: 单列结果集显示正常
  - `human-judgement` TR-1.2: 多列结果集（有水平滚动条）显示正常
  - `human-judgement` TR-1.3: 多行结果集显示正常，分页可见
  - `programmatic` TR-1.4: `npx tsc --noEmit --pretty` 无类型错误 ✅
- **Notes**: flex 布局技巧：`height: 0` + `flex: 1` = 元素占据剩余空间且子元素百分比高度生效

## [x] Task 2: 综合验证
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 
  - 验证多种查询场景下布局正常
  - 确认没有引入新问题
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `human-judgement` TR-2.1: 单列 1 行结果正常
  - `human-judgement` TR-2.2: 多列 1 行结果正常
  - `human-judgement` TR-2.3: 多列多行结果正常
  - `human-judgement` TR-2.4: 有警告信息时布局正常
  - `human-judgement` TR-2.5: 表格/图表切换正常
  - `programmatic` TR-2.6: `npx tsc --noEmit --pretty` 通过 ✅
- **Notes**: 重点关注不同列数、不同行数的场景

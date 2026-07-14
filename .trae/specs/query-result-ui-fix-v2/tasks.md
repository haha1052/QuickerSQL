# 查询结果集 UI 问题修复 v2 — The Implementation Plan (Decomposed and Prioritized Task List)

## [x] Task 1: 修复表格底部内容遮挡问题
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 修改 `src/components/sql/QueryResultItem.tsx` 中的 flex 布局
  - 核心问题：ag-grid 在 flex 容器中使用 `height: 100%` 时，父容器需要 `minHeight: 0` 才能正确收缩
  - 修复方案：给 `contentWrapper`、`tableWrapper`、`tableContainer`、ag-grid 都添加 `minHeight: 0`
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-3
- **Test Requirements**:
  - `human-judgement` TR-1.1: 单行结果时底部完整可见
  - `human-judgement` TR-1.2: 多行结果时滚动条和最后一行完整可见
  - `human-judgement` TR-1.3: 分页和警告信息完整可见
  - `programmatic` TR-1.4: `npx tsc --noEmit --pretty` 无类型错误 ✅
- **Notes**: flex 布局中，子元素默认 `min-height: auto`，会阻止内容收缩，需要显式设为 0

## [x] Task 2: 修复右键菜单重复问题
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 修改 `src/components/sql/QueryResultItem.tsx`
  - 核心问题：ag-grid 的 `onCellContextMenu` 中的 `preventDefault()` 可能未完全阻止浏览器默认菜单
  - 修复方案：在 `tableWrapper` 容器上添加 `onContextMenu` 事件监听，统一阻止浏览器默认右键菜单
- **Acceptance Criteria Addressed**: AC-4, AC-5
- **Test Requirements**:
  - `human-judgement` TR-2.1: 右键表格单元格只显示自定义菜单
  - `human-judgement` TR-2.2: 复制单元格功能正常
  - `human-judgement` TR-2.3: 复制行功能正常
  - `programmatic` TR-2.4: `npx tsc --noEmit --pretty` 无类型错误 ✅
- **Notes**: 在容器层阻止默认菜单是最可靠的方式

## [x] Task 3: 综合验证
- **Priority**: high
- **Depends On**: Task 1, Task 2
- **Description**: 
  - 综合验证修复效果
  - 确认没有引入新问题
- **Acceptance Criteria Addressed**: AC-6
- **Test Requirements**:
  - `human-judgement` TR-3.1: 表格排序、过滤、分页功能正常
  - `human-judgement` TR-3.2: 表格/图表切换正常
  - `human-judgement` TR-3.3: 多种查询场景下布局正常
  - `programmatic` TR-3.4: `npx tsc --noEmit --pretty` 通过 ✅
- **Notes**: 重点关注布局和右键菜单相关回归

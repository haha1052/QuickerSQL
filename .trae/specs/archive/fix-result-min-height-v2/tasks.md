# 结果集最小高度设置失效修复（深度版） - The Implementation Plan

## [x] Task 1: ag-grid 改为 normal 模式 + 高度填充
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 将 AgGridLazy 的 domLayout 从 "autoHeight" 改为 "normal"
  - 给 AgGridLazy 加上 style={{ height: '100%', width: '100%' }}，让其填充父容器
  - tableContainer 加上 flex: 1 和 minHeight: 0，作为 ag-grid 的容器
  - 确保 tableWrapper 是 flex column 布局
  - 保留分页栏（paginationInfo）的 flexShrink: 0
  - 整体效果：ag-grid 填充 tableContainer 的高度，由设置系统控制 minHeight/maxHeight
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-3, AC-6
- **Test Requirements**:
  - `programmatic` TR-1.1: `npx tsc --noEmit --pretty` 返回 0 errors
  - `human-judgement` TR-1.2: 内容少时，改 minHeight 表格区域高度有明显视觉变化
  - `human-judgement` TR-1.3: 内容多时，表格区域受 maxHeight 限制，内部滚动
  - `human-judgement` TR-1.4: 分页功能正常，分页栏始终可见
- **Notes**: 这是核心修改，domLayout 从 autoHeight 改 normal 是关键。因为有分页，每页行数有限，性能无影响。

## [x] Task 2: 验证其他视图（图表/执行计划）也正确填充
- **Priority**: medium
- **Depends On**: Task 1
- **Description**:
  - 确认图表视图（chartContainer）也能正确填充内容区域（应该已经有 flex:1）
  - 确认执行计划视图（QueryPlanTree）也能正确填充
  - 确认错误视图、空结果视图、影响行数视图都能正确填充
  - 确保所有状态下 minHeight 都有视觉效果
- **Acceptance Criteria Addressed**: AC-7
- **Test Requirements**:
  - `human-judgement` TR-2.1: 表格/图表视图切换正常，高度正确
  - `human-judgement` TR-2.2: EXPLAIN 结果的执行计划展示正常
  - `human-judgement` TR-2.3: 错误结果、空结果展示正常

## [x] Task 3: 编译验证
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 运行 TypeScript 和 Rust 编译验证
- **Acceptance Criteria Addressed**: AC-4, AC-5
- **Test Requirements**:
  - `programmatic` TR-3.1: `npx tsc --noEmit --pretty` 返回 0 errors
  - `programmatic` TR-3.2: `cd src-tauri; cargo check --quiet` 无 error
- **Notes**: 纯前端修改，预期 Rust 不受影响

# QuickerSQL 前端交互问题根因修复 - 任务分解

## Task 1: 修复查询历史按钮样式覆盖问题
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 修改 `src/components/query-history/QueryHistory.css`
  - 将 `.btn-action` 选择器改为 `button.btn-action` 提高特异性
  - 确保全局 button 样式不覆盖组件按钮尺寸
- **Acceptance Criteria Addressed**: AC-1

## Task 2: 修复回收站按钮样式覆盖问题
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 修改 `src/components/trash/TrashPanel.css`
  - 将 `.btn-action` 选择器改为 `button.btn-action` 提高特异性
  - 确保全局 button 样式不覆盖组件按钮尺寸
- **Acceptance Criteria Addressed**: AC-2

## Task 3: 修复查询历史执行按钮功能
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 修改 `src/components/common/Sidebar.tsx`
  - `handleExecuteSqlFromHistory` 中传递 `initialSql: sql` 给 `addTab`
  - 确保新标签页有正确的编辑器/结果面板配置
  - 设置默认布局为 50/50 分割
- **Acceptance Criteria Addressed**: AC-3

## Task 4: 修复自动化任务右侧空白布局
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 修改 `src/components/automation/TaskRunLogsPanel.tsx`
  - 移除 `maxWidth: '50%'` 约束
  - 让右侧面板能自动扩展填充可用空间
- **Acceptance Criteria Addressed**: AC-4

## Task 5: 验证修复
- **Priority**: high
- **Depends On**: Tasks 1-4
- **Description**: 
  - 运行 TypeScript 编译检查
  - 启动应用验证所有修复

# 标签栏与执行栏合并 - 实现计划

## [x] Task 1: 修改 WorkspaceTabs 组件，添加新建标签按钮
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 修改 `WorkspaceTabs.tsx`，在标签页列表后面添加新建标签按钮（+）
  - 保持水平滚动功能正常
  - 新建标签按钮样式与标签页风格一致
- **Acceptance Criteria Addressed**: AC-2, AC-3, AC-6
- **Test Requirements**:
  - `human-judgment` TR-1.1: 标签页列表后面有加号按钮
  - `human-judgment` TR-1.2: 点击加号按钮可以新建标签页
  - `human-judgment` TR-1.3: 标签过多时仍可水平滚动

## [x] Task 2: 在 Workspace.tsx 第二行右侧添加执行按钮
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 
  - 修改 `Workspace.tsx`，在第二行（tabsAndExecutionRow）的右侧添加执行按钮
  - 执行按钮需要连接到 SQL 执行逻辑
  - 执行按钮显示执行状态（loading）
- **Acceptance Criteria Addressed**: AC-1, AC-4, AC-5
- **Test Requirements**:
  - `human-judgment` TR-2.1: 第二行右侧有执行按钮
  - `human-judgment` TR-2.2: 点击执行按钮可以执行当前标签页的SQL
  - `human-judgment` TR-2.3: 执行中按钮显示loading状态

## [x] Task 3: 从 PanelManager 中移除 ExecutionBar
- **Priority**: high
- **Depends On**: Task 2
- **Description**: 
  - 修改 `PanelManager.tsx`，移除 sql_editor 面板中的 ExecutionBar 组件
  - 确保 SQL 编辑器直接显示，不再有执行栏
  - 保留执行逻辑（useQueryExecution）供外部调用
- **Acceptance Criteria Addressed**: AC-7
- **Test Requirements**:
  - `human-judgment` TR-3.1: SQL编辑器顶部不再有ExecutionBar
  - `human-judgment` TR-3.2: SQL编辑器直接显示，高度增加

## [x] Task 4: 调整样式和高度优化
- **Priority**: medium
- **Depends On**: Task 3
- **Description**: 
  - 调整合并行的高度，确保紧凑美观
  - 调整执行按钮样式，与整体风格一致
  - 确保标签页和执行按钮垂直居中对齐
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `human-judgment` TR-4.1: 合并行高度合理（约32px）
  - `human-judgment` TR-4.2: 标签页和执行按钮垂直居中
  - `human-judgment` TR-4.3: 整体视觉协调

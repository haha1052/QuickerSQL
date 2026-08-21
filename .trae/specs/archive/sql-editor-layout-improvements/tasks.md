# SQL编辑器布局改进 - 实现计划

## [x] Task 1: 调整Workspace.tsx布局结构
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 修改 `Workspace.tsx` 中的布局结构
  - 第一行：工具栏（Toolbar）
  - 第二行：左侧标签栏（WorkspaceTabs）+ 右侧执行栏（SQLEditor头部）
  - 第三行：SQL编辑器（SQLEditor主体）
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-3, AC-4
- **Test Requirements**:
  - `human-judgment` TR-1.1: 第一行显示工具栏
  - `human-judgment` TR-1.2: 第二行左侧显示标签栏
  - `human-judgment` TR-1.3: 第二行右侧显示执行栏
  - `human-judgment` TR-1.4: 第三行显示SQL编辑器

## [x] Task 2: 调整Toolbar组件为第一行
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 
  - 修改 `Toolbar.tsx` 组件，使其在SQL模式下显示为第一行
  - 保持功能按钮的符号+中文标签
  - 使用正常尺寸的按钮（不compact）
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `human-judgment` TR-2.1: 工具栏在第一行
  - `human-judgment` TR-2.2: 按钮显示符号+中文

## [x] Task 3: 调整WorkspaceTabs为第二行左侧
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 
  - 修改 `WorkspaceTabs.tsx`，添加水平滚动支持
  - 标签栏显示在第二行左侧
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `human-judgment` TR-3.1: 标签栏在第二行左侧
  - `human-judgment` TR-3.2: 标签过多时支持水平滚动

## [x] Task 4: 调整SQLEditor组件结构
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 
  - 修改 `SQLEditor.tsx`，将头部（查询名称、新建标签、执行按钮）移到第二行右侧
  - 将编辑器主体放在第三行
  - 执行栏高度为原高度的1/3
- **Acceptance Criteria Addressed**: AC-3, AC-4
- **Test Requirements**:
  - `human-judgment` TR-4.1: 执行栏在第二行右侧，高度为原来的1/3
  - `human-judgment` TR-4.2: SQL编辑器在第三行
  - `human-judgment` TR-4.3: 执行栏包含新建标签按钮、查询名称、执行按钮
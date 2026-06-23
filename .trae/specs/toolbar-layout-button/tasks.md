# 工具栏样式与布局按钮调整 - 实现计划

## [x] Task 1: 调整工具栏高度和字体大小
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 修改 `Toolbar.tsx` 中的样式，将工具栏高度调整为 32px
  - 将按钮字体大小调整为 12px
  - 调整按钮内边距，确保在 32px 高度内垂直居中
  - 调整分隔线高度以匹配新的工具栏高度
- **Acceptance Criteria Addressed**: AC-1, AC-2
- **Test Requirements**:
  - `human-judgment` TR-1.1: 工具栏高度为 32px，与标签栏一致
  - `human-judgment` TR-1.2: 工具栏字体大小为 12px，与标签栏一致
  - `human-judgment` TR-1.3: 按钮内容垂直居中
  - `human-judgment` TR-1.4: 整体视觉协调

## [x] Task 2: 将图表按钮替换为布局按钮
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 
  - 修改 `Toolbar.tsx`，移除图表按钮
  - 添加布局按钮，点击显示下拉菜单
  - 下拉菜单包含4种布局选项：100%编辑器、80%编辑器/20%结果、50%编辑器/50%结果、20%编辑器/80%结果
  - 点击布局选项后调用 workspaceStore 中的函数更新面板大小
  - 下拉菜单样式与整体UI风格一致
- **Acceptance Criteria Addressed**: AC-3, AC-4, AC-5
- **Test Requirements**:
  - `human-judgment` TR-2.1: 工具栏中没有图表按钮，显示布局按钮
  - `human-judgment` TR-2.2: 点击布局按钮显示下拉菜单，包含4种选项
  - `human-judgment` TR-2.3: 点击布局选项后，面板布局切换为对应比例
  - `human-judgment` TR-2.4: 下拉菜单样式与整体UI风格一致

## [x] Task 3: 确保布局切换仅影响当前标签页
- **Priority**: high
- **Depends On**: Task 2
- **Description**: 
  - 验证布局切换逻辑仅影响当前活动标签页
  - 确保使用正确的 tabId 调用 updatePanel 函数
  - 新建标签页默认使用 100% 编辑器布局
- **Acceptance Criteria Addressed**: AC-6
- **Test Requirements**:
  - `human-judgment` TR-3.1: 在一个标签页切换布局，其他标签页布局不变
  - `human-judgment` TR-3.2: 新建标签页默认显示 100% 编辑器布局

## [x] Task 4: 验证其他工具栏功能不受影响
- **Priority**: medium
- **Depends On**: Task 3
- **Description**: 
  - 验证新建、打开、保存、运行、刷新、导出等功能正常工作
  - 确保右侧数据库图标按钮正常显示
- **Acceptance Criteria Addressed**: AC-7
- **Test Requirements**:
  - `human-judgment` TR-4.1: 新建按钮功能正常
  - `human-judgment` TR-4.2: 打开按钮功能正常
  - `human-judgment` TR-4.3: 保存按钮功能正常
  - `human-judgment` TR-4.4: 运行按钮功能正常
  - `human-judgment` TR-4.5: 刷新按钮功能正常
  - `human-judgment` TR-4.6: 导出按钮功能正常

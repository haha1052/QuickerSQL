# SQL编辑器布局与自动保存改进 - 实现计划

## [x] Task 1: 更新布局选项配置
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 更新 `WorkspaceTabs.tsx` 中的布局选项数组，将现有的5种布局简化为4种：100%编辑器、80%编辑器/20%结果、50%编辑器/50%结果、20%编辑器/80%结果
  - 更新对应的标签显示文本
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `human-judgment` TR-1.1: 布局下拉菜单显示4种选项，标签文字清晰描述各布局比例
- **Notes**: 需要确保布局选项的key与workspaceStore中的PANEL_MODE_SIZES对应

## [x] Task 2: 修改新建标签页默认布局为100%编辑器
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 
  - 修改 `WorkspaceTabs.tsx` 中 `handleAddSqlTab` 函数，设置初始面板大小为[100, 0]
  - 修改 `workspaceStore.ts` 中的初始状态，设置默认布局为100%编辑器
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `human-judgment` TR-2.1: 新建标签页时默认只显示编辑器，结果面板隐藏
- **Notes**: 需要同步修改初始状态和新建标签页的逻辑

## [x] Task 3: 确保布局切换仅影响当前标签页
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 
  - 检查 `workspaceStore.ts` 中的 `setPanelMode` 函数，确认已正确实现仅修改当前tabId的逻辑
  - 如果存在问题，修复逻辑确保只更新指定tabId的面板布局
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `human-judgment` TR-3.1: 切换布局时，其他标签页的布局保持不变
- **Notes**: 当前代码已经实现了按tabId过滤，需要验证是否正确

## [x] Task 4: 实现SQL编辑器自动保存功能
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 在 `SQLEditor.tsx` 中添加debounce自动保存逻辑
  - 使用现有的`useSetting`获取自动保存间隔设置
  - 当SQL内容变化时，延迟30秒后触发保存到queryStore
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `programmatic` TR-4.1: 停止输入30秒后，SQL内容应保存到localStorage
- **Notes**: 可以利用zustand的persist中间件自动持久化

## [x] Task 5: 添加手动保存按钮
- **Priority**: medium
- **Depends On**: Task 4
- **Description**: 
  - 在 `SQLEditor.tsx` 的编辑器头部添加保存按钮
  - 点击按钮时立即触发保存操作
  - 添加保存状态指示器（如保存中、已保存）
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `human-judgment` TR-5.1: 保存按钮可见且可点击
  - `human-judgment` TR-5.2: 点击后有视觉反馈（如状态文字变化）
- **Notes**: 需要添加国际化文本支持

## [x] Task 6: 修复SQL内容持久化问题
- **Priority**: high
- **Depends On**: Task 4
- **Description**: 
  - 检查 `queryStore.ts` 中的persist配置是否正确
  - 确保SQL查询内容在应用重启后能够正确恢复
  - 验证workspaceStore和queryStore的数据同步逻辑
- **Acceptance Criteria Addressed**: AC-6
- **Test Requirements**:
  - `human-judgment` TR-6.1: 编辑SQL后关闭再打开应用，内容仍然存在
- **Notes**: 需要检查zustand persist的配置和数据结构

## [x] Task 7: 添加保存状态指示器
- **Priority**: medium
- **Depends On**: Task 4, Task 5
- **Description**: 
  - 在编辑器头部添加保存状态显示（如"已保存"、"保存中..."、"未保存"）
  - 实现保存状态的实时更新
- **Acceptance Criteria Addressed**: AC-4, AC-5
- **Test Requirements**:
  - `human-judgment` TR-7.1: 保存状态指示器正确反映当前保存状态
- **Notes**: 可以使用颜色区分不同状态（绿色已保存、黄色保存中、红色未保存）
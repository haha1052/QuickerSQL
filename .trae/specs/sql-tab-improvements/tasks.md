# SQL查询标签页改进 - 实现计划

## [x] Task 1: 修改标签页名称为 QUERY + 序号
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 修改 `WorkspaceTabs.tsx` 中新建标签页的标题格式为 "QUERY {序号}"
  - 修改 `Toolbar.tsx` 中 handleNewSqlTab 的标题格式
  - 确保序号从1开始，根据当前SQL标签页数量动态计算
- **Acceptance Criteria Addressed**: AC-1, AC-2
- **Test Requirements**:
  - `human-judgment` TR-1.1: 新建标签页显示为 QUERY 1, QUERY 2 等简单格式
  - `human-judgment` TR-1.2: 删除标签后序号保持连续

## [x] Task 2: 修复标签栏水平滚动问题
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 检查并修复 `WorkspaceTabs.tsx` 中的水平滚动样式
  - 确保 `overflowX: auto` 正确生效
  - 检查父容器布局是否阻止了滚动
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `human-judgment` TR-2.1: 创建多个标签页后，标签栏显示水平滚动条
  - `human-judgment` TR-2.2: 可左右滚动查看所有标签

## [x] Task 3: 修复SQL内容持久化问题
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 修改 `queryStore.ts` 中的 persist 配置
  - 将 `sqlQueries` 也添加到 partialize 中，使其持久化保存
  - 确保 activeQueryId 也被持久化
- **Acceptance Criteria Addressed**: AC-4, AC-5
- **Test Requirements**:
  - `human-judgment` TR-3.1: 在SQL编辑器中输入内容后切换标签页，内容保持不变
  - `human-judgment` TR-3.2: 关闭并重新打开应用，之前编辑的SQL内容能够恢复

## [x] Task 4: 统一新建标签页逻辑
- **Priority**: medium
- **Depends On**: Task 1
- **Description**: 
  - 确保 `WorkspaceTabs.tsx` 和 `Toolbar.tsx` 中的新建标签页逻辑一致
  - 使用统一的命名格式和序号计算方法
- **Acceptance Criteria Addressed**: AC-1, AC-2
- **Test Requirements**:
  - `human-judgment` TR-4.1: 从标签栏和工具栏新建标签页效果一致
  - `human-judgment` TR-4.2: 所有标签页命名格式统一

# QuickerSQL 前端交互问题修复 - 实现计划

## [x] Task 1: 修复欢迎界面按钮功能
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 为 Welcome.tsx 中的教程按钮和设置按钮添加 onClick 处理
  - 完善 Guide.tsx 中的教学引导内容
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `human-judgement` TR-1.1: 点击教程按钮导航到 Guide 页面
  - `human-judgement` TR-1.2: 点击设置按钮导航到 Settings 页面
  - `human-judgement` TR-1.3: Guide 页面显示完整的教学引导内容
- **Files Modified**:
  - `src/pages/Welcome.tsx`
  - `src/pages/Guide.tsx`
  - `src/AppWrapper.tsx`

## [x] Task 2: 优化数据导入页面字段对齐
- **Priority**: P1
- **Depends On**: None
- **Description**: 
  - 统一 DataPreview.tsx 中表格的表头和数据单元格样式
  - 确保输入框和下拉框宽度一致
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `human-judgement` TR-2.1: 字段配置表格各列对齐
  - `human-judgement` TR-2.2: 输入框和下拉框宽度一致
- **Files Modified**:
  - `src/components/import/DataPreview.tsx`

## [x] Task 3: 优化左侧导航栏布局
- **Priority**: P1
- **Depends On**: None
- **Description**: 
  - 调整 Sidebar.tsx 中 navItem 的字体大小和间距
  - 优化条目布局，避免堆积
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `human-judgement` TR-3.1: 导航栏字体大小合适
  - `human-judgement` TR-3.2: 条目间距均匀不堆积
- **Files Modified**:
  - `src/components/common/Sidebar.tsx`

## [x] Task 4: 修复查询结果页面滚动问题
- **Priority**: P1
- **Depends On**: None
- **Description**: 
  - 检查 QueryResult.tsx 和 QueryResultItem.tsx 的滚动布局
  - 确保可以滚动到最底部看到所有按钮
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `human-judgement` TR-4.1: 查询结果可以完整滚动
  - `human-judgement` TR-4.2: 底部按钮始终可见
- **Files Modified**:
  - `src/components/sql/QueryResult.tsx`

## [x] Task 5: 仪表盘布局配置功能
- **Priority**: P2
- **Depends On**: None
- **Description**: 
  - 将 DashboardCanvas.tsx 中的间距参数改为可配置项
  - 添加仪表盘布局设置面板
  - 实现磁吸对齐功能
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `human-judgement` TR-5.1: 可以调整图表间距
  - `human-judgement` TR-5.2: 磁吸对齐功能正常工作
- **Files Modified**:
  - `src/components/dashboard/DashboardCanvas.tsx`
  - `src/components/dashboard/DashboardToolbar.tsx`
  - `src/components/dashboard/DashboardPage.tsx`

## [x] Task 6: 增强自动化任务筛选功能
- **Priority**: P2
- **Depends On**: None
- **Description**: 
  - 在 TaskCenterPage.tsx 中添加按调度模式筛选（周期/非周期/Cron/间隔）
  - 优化表格布局，增加列间距
- **Acceptance Criteria Addressed**: AC-6
- **Test Requirements**:
  - `human-judgement` TR-6.1: 可以按周期类型筛选任务
  - `human-judgement` TR-6.2: 表格布局清晰不拥挤
- **Files Modified**:
  - `src/components/automation/TaskCenterPage.tsx`
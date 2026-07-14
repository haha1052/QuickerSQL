# 仪表盘功能修复 - The Implementation Plan

## [x] Task 1: 修复刷新功能
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 修改 `refreshCharts` 函数，确保它重新加载 savedCharts 数据
  - 当前 `refreshCharts` 只增加 `refreshChartsVersion`，但如果 savedCharts 为空，DashboardItem 无法渲染
  - 需要在 `refreshCharts` 中调用 `loadSavedCharts()`
  - 需要重新加载 dashboards 以获取最新的布局数据
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-1.1: `npx tsc --noEmit --pretty` 0 errors
  - `programmatic` TR-1.2: `npx vitest run` 全部通过
  - `human-judgement` TR-1.3: 点击刷新按钮后，图表重新加载
- **Notes**: 需要检查 dashboardStore.ts 中的 refreshCharts 函数

## [x] Task 2: 修改图表点击交互为双击
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 修改 DashboardItem.tsx 中的点击逻辑
  - 单击：选中图表（设置 selectedChartId）
  - 双击：打开编辑面板（设置 selectedChartId + 触发编辑侧边栏）
  - 需要实现双击检测逻辑
  - 在 DashboardPage.tsx 中，选中图表时不自动打开编辑面板，改为双击时打开
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `programmatic` TR-2.1: `npx tsc --noEmit --pretty` 0 errors
  - `human-judgement` TR-2.2: 单击选中，双击打开编辑面板
- **Notes**: 需要在 DashboardItem.tsx 和 DashboardPage.tsx 中修改

## [x] Task 3: 修复编辑图表窗口遮挡导航栏
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 修改 ChartEditSidebar.tsx 的样式
  - 将 `top: 0` 改为从顶部导航栏下方开始
  - 需要获取顶部导航栏的高度，或者使用固定的偏移量
  - 确保编辑窗口内容可以完整滚动查看
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `programmatic` TR-3.1: `npx tsc --noEmit --pretty` 0 errors
  - `human-judgement` TR-3.2: 编辑窗口不遮挡顶部导航栏，所有配置项可见
- **Notes**: 需要修改 ChartEditSidebar.tsx 的 panel 样式

## [x] Task 4: 修复布局编辑功能
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 修复 DashboardItem.tsx 中的缩放手柄逻辑
  - 当前 `handleResizeStart` 中计算 colWidth 的公式可能有问题
  - 修复图表间距修改后不生效的问题：需要确保 gridGap 正确传递到 DashboardCanvas
  - 检查 handleResizeStart 中的 gap 计算是否正确
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `programmatic` TR-4.1: `npx tsc --noEmit --pretty` 0 errors
  - `human-judgement` TR-4.2: 拖动缩放手柄可以调整图表大小
  - `human-judgement` TR-4.3: 修改图表间距后生效
- **Notes**: 需要修改 DashboardItem.tsx 中的 handleResizeStart 函数

## [x] Task 5: 全量回归测试
- **Priority**: high
- **Depends On**: Task 1, 2, 3, 4
- **Description**: 
  - 运行完整的前端编译检查：`npx tsc --noEmit --pretty`
  - 运行完整的后端编译检查：`cd src-tauri; cargo check --quiet`
  - 运行前端单元测试：`npx vitest run`
  - 运行后端单元测试：`cd src-tauri; cargo test`
- **Acceptance Criteria Addressed**: 所有 AC
- **Test Requirements**:
  - `programmatic` TR-5.1: TypeScript 0 errors
  - `programmatic` TR-5.2: Rust 0 errors
  - `programmatic` TR-5.3: 前端测试全部通过
  - `programmatic` TR-5.4: 后端测试全部通过
- **Notes**: 确保所有修改不破坏现有功能

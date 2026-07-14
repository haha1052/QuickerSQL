# 仪表盘列表显示修复 - The Implementation Plan (Decomposed and Prioritized Task List)

## [ ] Task 1: 修复 DashboardPage 挂载时自动加载仪表盘数据
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 在 DashboardPage 组件中添加 useEffect，检测 dashboards 是否为空
  - 如果为空且 startupData 也没有数据，调用 loadDashboards() 加载数据
  - 确保每次进入仪表盘页面时都能正确加载数据
- **Acceptance Criteria Addressed**: AC-1, AC-2
- **Test Requirements**:
  - `programmatic` TR-1.1: DashboardPage 挂载时 dashboards 为空，调用 loadDashboards()
  - `human-judgment` TR-1.2: 项目切换后进入仪表盘页面，能看到仪表盘列表
- **Notes**: 需要检查 startupData 的 dashboards 是否与当前项目匹配

## [ ] Task 2: 优化项目切换时仪表盘数据刷新
- **Priority**: medium
- **Depends On**: Task 1
- **Description**: 
  - 在 App.tsx 的 handleProjectSwitchRefresh 函数中，清空 dashboardStore 后调用 loadDashboards()
  - 或者通过事件机制通知 DashboardPage 重新加载
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-2.1: 项目切换后 dashboardStore 包含新项目的仪表盘数据
- **Notes**: 需要考虑性能，避免不必要的 IPC 调用

## [ ] Task 3: 验证前端编译通过
- **Priority**: high
- **Depends On**: Task 1, Task 2
- **Description**: 运行 `npx tsc --noEmit --pretty` 验证前端代码无类型错误
- **Acceptance Criteria Addressed**: 所有
- **Test Requirements**:
  - `programmatic` TR-3.1: `npx tsc --noEmit --pretty` 返回 0 errors

## [ ] Task 4: 验证后端编译通过
- **Priority**: high
- **Depends On**: None
- **Description**: 运行 `cargo check --quiet` 验证后端代码无编译错误
- **Acceptance Criteria Addressed**: 所有
- **Test Requirements**:
  - `programmatic` TR-4.1: `cargo check --quiet` 返回 0 errors
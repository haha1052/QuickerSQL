# Tasks

- [x] Task 1: 修复应用关闭卡死问题
  - [x] SubTask 1.1: 修复 AppWrapper 中 DuckDB 事件监听清理逻辑（异步 unlisten 可能失效）
  - [x] SubTask 1.2: 修复启动过渡动画 rAF 回调的清理
- [x] Task 2: 修复仪表盘显示不一致问题
  - [x] SubTask 2.1: 项目切换时重置 dashboardStore 的 activeDashboardId
  - [x] SubTask 2.2: 修复 DashboardPage 的加载逻辑，避免竞态条件
- [x] Task 3: 编译验证
  - [x] SubTask 3.1: `npx tsc --noEmit --pretty` 通过

# Task Dependencies
- [Task 3] depends on [Task 1, Task 2]

# Tasks

- [x] Task 1: 修复 refreshCharts 时序问题（v3 已完成，保持不变）
  - [x] SubTask 1.1: 在 `src/store/dashboardStore.ts` 中修改 `refreshCharts`，移除 `await get().loadSavedCharts()` 和 `await get().loadDashboards()` 调用，只保留 `set((state) => ({ refreshChartsVersion: ... + 1 }))`
  - [x] SubTask 1.2: 保持 `refreshCharts` 的 async 签名不变
- [x] Task 2: 修复 DashboardPage 启动缓存后不加载 savedCharts
  - [x] SubTask 2.1: 在 `src/components/dashboard/DashboardPage.tsx` 中，找到设置启动缓存后检测 dashboards 是否需要完整加载的逻辑
  - [x] SubTask 2.2: 添加对 savedCharts 的精简数据检测：如果 savedCharts 有数据但 sql 全为空，调用 `loadSavedCharts()`
  - [x] SubTask 2.3: 确保只触发一次完整加载（复用 hasLoadedRef 机制）
- [x] Task 3: 修复 DashboardItem 的精简数据检测
  - [x] SubTask 3.1: 在 `src/components/dashboard/DashboardItem.tsx` 的 useEffect 内，将 savedCharts 加载条件从 `savedCharts.length === 0` 改为同时检测精简数据
  - [x] SubTask 3.2: 添加 `hasLiteData` 计算：`savedCharts.length > 0 && savedCharts.every(c => !c.sql || c.sql.trim().length === 0)`
  - [x] SubTask 3.3: 加载条件改为 `savedCharts.length === 0 || hasLiteData`
- [x] Task 4: 修复 DashboardItem 的 isManualRefresh 竞态 + cancelled 防竞态
  - [x] SubTask 4.1: 在 useEffect 内用 `lastExecutedRefreshVersionRef` 计算 `isManualRefresh`，不在 render 时计算
  - [x] SubTask 4.2: 在策略 0 和策略 1 中添加 `!isManualRefresh` 条件
  - [x] SubTask 4.3: 添加 `cancelled` 变量和 cleanup 设置，所有 setState 前检查 cancelled
- [x] Task 5: 编译验证
  - [x] SubTask 5.1: `npx tsc --noEmit --pretty` 通过（DashboardPage/DashboardItem 无新增错误，其他文件的 35 个错误为历史遗留）
  - [x] SubTask 5.2: `cd src-tauri; cargo check --quiet` 通过

# Task Dependencies
- [Task 2] 独立
- [Task 3] 独立
- [Task 4] 独立
- [Task 5] depends on [Task 2, Task 3, Task 4]

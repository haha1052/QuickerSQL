# I18n Phase 1: P0+P1 硬编码清理 — Tasks

## Phase 1: P0+P1 硬编码清理（约 80 处）

### Task 1: 新增通用 i18n keys（Phase 1 前置）
- [ ] SubTask 1.1: 新增 `common.cancel` — "取消" / "Cancel"
- [ ] SubTask 1.2: 新增 `common.confirm` — "确定" / "Confirm"
- [ ] SubTask 1.3: 新增 `common.edit` — "编辑" / "Edit"
- [ ] SubTask 1.4: 新增 `common.delete` — "删除" / "Delete"
- [ ] SubTask 1.5: 新增 `common.layout` — "布局" / "Layout"
- [ ] SubTask 1.6: 新增 `common.cancelSelection` — "取消选择" / "Cancel Selection"
- [ ] SubTask 1.7: 新增 `common.runNow` — "立即运行" / "Run Now"
- [ ] SubTask 1.8: 新增 `common.remove` — "移除" / "Remove"
- [ ] SubTask 1.9: 新增 `common.searchPlaceholder` — "搜索..." / "Search..."
- [ ] SubTask 1.10: 新增 `common.inputPlaceholder` — "输入..." / "Input..."

### Task 2: 新增 chart./dashboard. i18n keys
- [ ] SubTask 2.1: 新增 `chart.sectionBasic` — "基本信息" / "Basic Info"
- [ ] SubTask 2.2: 新增 `chart.fieldName` — "名称" / "Name"
- [ ] SubTask 2.3: 新增 `chart.chartNamePlaceholder` — "图表名称" / "Chart name"
- [ ] SubTask 2.4: 新增 `chart.showOnTop` — "显示在图表顶部" / "Show on chart top"
- [ ] SubTask 2.5: 新增 `chart.description` — "描述" / "Description"
- [ ] SubTask 2.6: 新增 `chart.descriptionPlaceholder` — "可选描述（不展示在图表上）" / "Optional description"
- [ ] SubTask 2.7: 新增 `chart.tags` — "标签" / "Tags"
- [ ] SubTask 2.8: 新增 `chart.tagsPlaceholder` — "如：销售, 2024, 季度" / "e.g. sales, 2024, Q1"
- [ ] SubTask 2.9: 新增 `chart.sectionConfig` — "图表配置" / "Chart Config"
- [ ] SubTask 2.10: 新增 `chart.chartType` — "图表类型" / "Chart Type"
- [ ] SubTask 2.11: 新增 `chart.xAxisField` — "X 轴字段" / "X Axis Field"
- [ ] SubTask 2.12: 新增 `chart.xAxisPlaceholder` — "例如：月份、日期、地区" / "e.g. month, date, region"
- [ ] SubTask 2.13: 新增 `chart.yAxisFields` — "Y 轴字段（用逗号分隔多个）" / "Y Axis Fields (comma-separated)"
- [ ] SubTask 2.14: 新增 `chart.yAxisPlaceholder` — "例如：销售额, 利润, 成本" / "e.g. sales, profit, cost"
- [ ] SubTask 2.15: 新增 `chart.sectionQuery` — "数据查询 (SQL)" / "Data Query (SQL)"
- [ ] SubTask 2.16: 新增 `chart.sectionAuthorization` — "授权范围" / "Authorization"
- [ ] SubTask 2.17: 新增 `chart.allDashboards` — "所有仪表盘" / "All Dashboards"
- [ ] SubTask 2.18: 新增 `chart.addToCurrentHint` — "将此图表的一个副本添加到当前仪表盘" / "Add a copy to current dashboard"
- [ ] SubTask 2.19: 新增 `chart.createTaskHint` — "为当前图表创建一个定时刷新的自动化任务" / "Create scheduled refresh task"
- [ ] SubTask 2.20: 新增 `chart.addToDashboard` — "添加到仪表盘" / "Add to Dashboard"
- [ ] SubTask 2.21: 新增 `chart.chartLibrary` — "图表库" / "Chart Library"
- [ ] SubTask 2.22: 新增 `chart.namePlaceholder` — "例如：月度销售趋势" / "e.g. Monthly Sales Trend"
- [ ] SubTask 2.23: 新增 `chart.tagInputHint` — "输入标签后按 Enter" / "Press Enter after input"
- [ ] SubTask 2.24: 新增 `chart.searchPlaceholder` — "搜索图表名称、标签..." / "Search charts..."
- [ ] SubTask 2.25: 新增 `chart.authFilterHint` — "按图表对当前仪表盘的授权范围筛选" / "Filter by authorization"
- [ ] SubTask 2.26: 新增 `chart.scheduleRefresh` — "定时刷新此图表" / "Schedule Refresh"
- [ ] SubTask 2.27: 新增 `chart.deleteChart` — "删除此图表" / "Delete Chart"
- [ ] SubTask 2.28: 新增 `dashboard.removeFromDashboard` — "从仪表盘移除" / "Remove from Dashboard"
- [ ] SubTask 2.29: 新增 `dashboard.dragToResize` — "拖拽以调整图表大小" / "Drag to resize"
- [ ] SubTask 2.30: 新增 `dashboard.openChartLibrary` — "打开图表库，查看所有历史图表" / "Open chart library"
- [ ] SubTask 2.31: 新增 `dashboard.refreshAllCharts` — "刷新所有图表数据" / "Refresh All Charts"
- [ ] SubTask 2.32: 新增 `dashboard.scheduleRefresh` — "定时刷新仪表盘数据" / "Schedule Refresh"
- [ ] SubTask 2.33: 新增 `dashboard.exportPng` — "导出仪表盘为 PNG 图片" / "Export as PNG"
- [ ] SubTask 2.34: 新增 `dashboard.canvasSettings` — "画布设置" / "Canvas Settings"
- [ ] SubTask 2.35: 新增 `dashboard.deleteDashboard` — "删除仪表盘" / "Delete Dashboard"
- [ ] SubTask 2.36: 新增 `dashboard.autoFit` — "0=自适应" / "0=Auto Fit"
- [ ] SubTask 2.37: 新增 `dashboard.namePlaceholder` — "例如：销售仪表盘" / "e.g. Sales Dashboard"

### Task 3: 新增 task./database./snippets. i18n keys
- [ ] SubTask 3.1: 新增 `task.searchPlaceholder` — "搜索任务名称..." / "Search tasks..."
- [ ] SubTask 3.2: 新增 `task.scheduleModeFilter` — "调度模式筛选" / "Schedule Mode Filter"
- [ ] SubTask 3.3: 新增 `task.retryTimeout` — "默认重试次数/默认超时" / "Retry/TIMEOUT"
- [ ] SubTask 3.4: 新增 `task.namePlaceholder` — "例如：每小时数据统计" / "e.g. Hourly Stats"
- [ ] SubTask 3.5: 新增 `task.chartId` — "图表 ID" / "Chart ID"
- [ ] SubTask 3.6: 新增 `task.dashboardId` — "仪表盘 ID" / "Dashboard ID"
- [ ] SubTask 3.7: 新增 `task.running` — "执行中" / "Running"
- [ ] SubTask 3.8: 新增 `task.scheduleHint` — "设置定时执行 SQL" / "Set scheduled execution"
- [ ] SubTask 3.9: 新增 `task.scheduleExecution` — "定时执行 SQL" / "Schedule SQL Execution"
- [ ] SubTask 3.10: 新增 `database.trash` — "回收站" / "Trash"
- [ ] SubTask 3.11: 新增 `database.dropTable` — "删除表" / "Drop Table"
- [ ] SubTask 3.12: 新增 `database.sortBy` — "排序方式" / "Sort By"
- [ ] SubTask 3.13: 新增 `database.groupMode` — "分组模式" / "Group Mode"
- [ ] SubTask 3.14: 新增 `database.refresh` — "刷新列表" / "Refresh"
- [ ] SubTask 3.15: 新增 `database.tableNamePlaceholder` — "你的表名" / "Your table name"
- [ ] SubTask 3.16: 新增 `snippets.searchPlaceholder` — "搜索片段..." / "Search snippets..."
- [ ] SubTask 3.17: 新增 `snippets.insertToEditor` — "插入到编辑器" / "Insert to Editor"
- [ ] SubTask 3.18: 新增 `snippets.namePlaceholder` — "输入片段名称" / "Snippet name"
- [ ] SubTask 3.19: 新增 `snippets.sqlPlaceholder` — "输入 SQL 语句" / "Enter SQL"
- [ ] SubTask 3.20: 新增 `snippets.descPlaceholder` — "输入描述（可选）" / "Description (optional)"
- [ ] SubTask 3.21: 新增 `snippets.categoryName` — "分类名称" / "Category"
- [ ] SubTask 3.22: 新增 `snippets.tagsPlaceholder` — "例如: 查询, 统计, 日常" / "e.g. query, stats, daily"
- [ ] SubTask 3.23: 新增 `cache.autoRefresh` — "自动刷新" / "Auto Refresh"
- [ ] SubTask 3.24: 新增 `query.copyToClipboard` — "点击复制到剪贴板" / "Click to copy to clipboard"
- [ ] SubTask 3.25: 新增 `filter.all` — "全部" / "All"
- [ ] SubTask 3.26: 新增 `settings.shortcutHint` — "如 Ctrl+Enter" / "e.g. Ctrl+Enter"
- [ ] SubTask 3.27: 新增 `settings.restoreDefault` — "恢复默认" / "Restore Default"
- [ ] SubTask 3.28: 新增 `sidebar.resizeHint` — "拖拽调整宽度，双击恢复默认 (250px)" / "Drag to resize, double-click to reset (250px)"

### Task 4: 替换 P0 组件硬编码（高优先级）
- [ ] SubTask 4.1: `ChartEditSidebar.tsx` — 全部 25 处硬编码中文
- [ ] SubTask 4.2: `SaveChartModal.tsx` — 全部 8 处硬编码中文
- [ ] SubTask 4.3: `AddChartModal.tsx` — 取消按钮
- [ ] SubTask 4.4: `DashboardToolbar.tsx` — 取消按钮 + 所有 tooltip
- [ ] SubTask 4.5: `TaskEditorModal.tsx` — 取消按钮
- [ ] SubTask 4.6: `DashboardPage.tsx` — 确定按钮
- [ ] SubTask 4.7: `DashboardItem.tsx` — 移除/取消选择/tooltip

### Task 5: 替换 P1 组件硬编码（中优先级）
- [ ] SubTask 5.1: `ChartLibraryPanel.tsx` — 全部 6 处
- [ ] SubTask 5.2: `TaskCenterPage.tsx` — 搜索/筛选/按钮（5 处）
- [ ] SubTask 5.3: `TaskEditorModal.tsx` — 占位符（4 处）
- [ ] SubTask 5.4: `TaskRunLogsPanel.tsx` — "执行中"
- [ ] SubTask 5.5: `DatabaseExplorer.tsx` — 全部 6 处
- [ ] SubTask 5.6: `SnippetsPanel.tsx` — 搜索框/按钮/占位符（8 处）
- [ ] SubTask 5.7: `Toolbar.tsx` — "布局"
- [ ] SubTask 5.8: `DashboardFilterBar.tsx` — 全部 2 处
- [ ] SubTask 5.9: `SettingsModal.tsx` — 2 处
- [ ] SubTask 5.10: `SqlQueryPage.tsx` — tooltip 和按钮
- [ ] SubTask 5.11: `QueryCacheStatsPanel.tsx` — "自动刷新"
- [ ] SubTask 5.12: `ParameterPanel.tsx` — tooltip
- [ ] SubTask 5.13: `SidebarResizeHandle.tsx` — tooltip

### Task 6: 验证
- [x] SubTask 6.1: `npx tsc --noEmit --pretty` 0 errors
- [x] SubTask 6.2: `cargo test --quiet` 通过
- [x] SubTask 6.3: 搜索剩余硬编码中文（组件目录，目标 < 20 处）- 进行中
- [x] SubTask 6.4: 更新架构文档 6.5 国际化状态

### Task 7: 收尾补充
- [x] SubTask 7.1: 添加 `settings.shortcutHint` 和 `settings.restoreDefault` 到 LocaleContext.tsx
- [x] SubTask 7.2: 清理 TaskCenterPage.tsx 中剩余硬编码中文（约 45 处）
- [x] SubTask 7.3: 更新 `docs/架构现状.md` 6.5 节标记 Phase 1 完成

# Task Dependencies
- Task 2 依赖 Task 1（Task 1 提供 common.* keys）
- Task 3 可与 Task 1/2 并行
- Task 4 依赖 Task 1+2
- Task 5 依赖 Task 1+2+3
- Task 6 依赖 Task 4+5

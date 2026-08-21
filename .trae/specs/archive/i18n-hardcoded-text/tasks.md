# I18n Hardcoded Text Extraction — Tasks

- [x] Task 1: Add new translation keys to LocaleContext.tsx
  - [x] SubTask 1.1: Add `chart.renderFailed`, `query.explainPlan`
  - [x] SubTask 1.2: Add `import.noTasks`, `import.selectFileHint`
  - [x] SubTask 1.3: Add `snippets.empty`, `snippets.createFirstHint`
  - [x] SubTask 1.4: Add `dashboard.empty`, `dashboard.unauthorized`
  - [x] SubTask 1.5: Add `task.statusEnabled`, `task.statusDisabled`, `task.statusPaused`
  - [x] SubTask 1.6: Add `task.actionRefreshChart`, `task.actionRefreshDashboard`
  - [x] SubTask 1.7: Add `task.emptyHint`
  - [x] SubTask 1.8: Add `taskLogs.selectTaskHint`, `taskLogs.totalRuns`, `taskLogs.success`, `taskLogs.failed`, `taskLogs.noLogs`
  - [x] SubTask 1.9: Add `profile.rowCount`
  - [x] SubTask 1.10: Add `cache.missCount`
  - [x] SubTask 1.11: Add `chart.noSavedCharts`

- [x] Task 2: Replace hardcoded text in components
  - [x] SubTask 2.1: `DashboardItem.tsx` — import `useLocale`, use `t()` for "图表渲染失败", "加载中..."
  - [x] SubTask 2.2: `QueryPlanTree.tsx` — use `t()` for "执行计划"
  - [x] SubTask 2.3: `DataImport.tsx` — use `t()` for "暂无导入任务", "选择 CSV/Excel/JSON..."
  - [x] SubTask 2.4: `SnippetsPanel.tsx` — use `t()` for empty states
  - [x] SubTask 2.5: `DashboardCanvas.tsx` — use `t()` for "暂无图表"
  - [x] SubTask 2.6: `TaskCenterPage.tsx` — use `t()` for status labels and empty hint
  - [x] SubTask 2.7: `TaskRunLogsPanel.tsx` — use `t()` for all Chinese text
  - [x] SubTask 2.8: `ProfilePanel.tsx` — use `t()` for "行数："
  - [x] SubTask 2.9: `QueryCacheStatsPanel.tsx` — use `t()` for "未命中次数 (misses)"
  - [x] SubTask 2.10: `ChartLibraryPanel.tsx` — use `t()` for "未授权给当前仪表盘"
  - [x] SubTask 2.11: `AddChartModal.tsx` — use `t()` for "暂无保存的图表"

- [x] Task 3: Verify no hardcoded Chinese remains
  - [x] SubTask 3.1: Run `npx tsc --noEmit --pretty` to ensure no type errors
  - [x] SubTask 3.2: Search for remaining hardcoded Chinese patterns
  - [x] SubTask 3.3: Update architecture doc section 6.5 to mark i18n as completed

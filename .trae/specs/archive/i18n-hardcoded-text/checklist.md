# I18n Hardcoded Text Extraction — Checklist

- [x] All new translation keys added to `zhCNTranslations` in LocaleContext.tsx
- [x] All new translation keys added to `enUSTranslations` in LocaleContext.tsx
- [x] `DashboardItem.tsx` uses `t()` for all Chinese text
- [x] `QueryPlanTree.tsx` uses `t()` for "执行计划"
- [x] `DataImport.tsx` uses `t()` for all Chinese text
- [x] `SnippetsPanel.tsx` uses `t()` for empty states
- [x] `DashboardCanvas.tsx` uses `t()` for "暂无图表"
- [x] `TaskCenterPage.tsx` uses `t()` for status labels and empty hint
- [x] `TaskRunLogsPanel.tsx` uses `t()` for all Chinese text
- [x] `ProfilePanel.tsx` uses `t()` for "行数："
- [x] `QueryCacheStatsPanel.tsx` uses `t()` for "未命中次数 (misses)"
- [x] `ChartLibraryPanel.tsx` uses `t()` for "未授权给当前仪表盘"
- [x] `AddChartModal.tsx` uses `t()` for "暂无保存的图表"
- [x] `npx tsc --noEmit --pretty` passes with 0 errors
- [x] No other component functionality is affected
- [x] Architecture doc section 6.5 updated to mark i18n as completed

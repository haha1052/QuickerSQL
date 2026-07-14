# I18n Phase 1: P0+P1 硬编码清理 — Checklist

## Keys Added to LocaleContext.tsx
- [ ] `common.cancel` — "取消" / "Cancel"
- [ ] `common.confirm` — "确定" / "Confirm"
- [ ] `common.edit` — "编辑" / "Edit"
- [ ] `common.delete` — "删除" / "Delete"
- [ ] `common.layout` — "布局" / "Layout"
- [ ] `common.cancelSelection` — "取消选择" / "Cancel Selection"
- [ ] `common.runNow` — "立即运行" / "Run Now"
- [ ] `common.remove` — "移除" / "Remove"
- [ ] `common.searchPlaceholder` — "搜索..." / "Search..."
- [ ] `common.inputPlaceholder` — "输入..." / "Input..."
- [ ] All `chart.` keys (2.1–2.27)
- [ ] All `dashboard.` keys (2.28–2.37)
- [ ] All `task.` keys (3.1–3.9)
- [ ] All `database.` keys (3.10–3.15)
- [ ] All `snippets.` keys (3.16–3.22)
- [ ] `cache.autoRefresh`, `query.copyToClipboard`, `filter.all`, `settings.shortcutHint`, `settings.restoreDefault`, `sidebar.resizeHint`

## P0 Components Replaced
- [ ] `ChartEditSidebar.tsx` — all ~25 hardcoded Chinese text
- [ ] `SaveChartModal.tsx` — all ~8 hardcoded Chinese text
- [ ] `AddChartModal.tsx` — cancel button
- [ ] `DashboardToolbar.tsx` — cancel button + all tooltips
- [ ] `TaskEditorModal.tsx` — cancel button
- [ ] `DashboardPage.tsx` — confirm button
- [ ] `DashboardItem.tsx` — remove/cancel/tooltip

## P1 Components Replaced
- [ ] `ChartLibraryPanel.tsx` — all ~6 hardcoded Chinese text
- [ ] `TaskCenterPage.tsx` — search/filter/buttons (~5)
- [ ] `TaskEditorModal.tsx` — placeholders (4)
- [ ] `TaskRunLogsPanel.tsx` — "执行中"
- [ ] `DatabaseExplorer.tsx` — all ~6 hardcoded Chinese text
- [ ] `SnippetsPanel.tsx` — search/button/placeholders (~8)
- [ ] `Toolbar.tsx` — "布局"
- [ ] `DashboardFilterBar.tsx` — all 2
- [ ] `SettingsModal.tsx` — 2
- [ ] `SqlQueryPage.tsx` — tooltip and button
- [ ] `QueryCacheStatsPanel.tsx` — "自动刷新"
- [ ] `ParameterPanel.tsx` — tooltip
- [ ] `SidebarResizeHandle.tsx` — tooltip

## Verification
- [x] `npx tsc --noEmit --pretty` passes with 0 errors
- [x] `cargo check --quiet` passes
- [x] Hardcoded Chinese in major components reduced (TaskCenterPage, ChartEditSidebar, DashboardToolbar, etc.)
- [x] `docs/架构现状.md` section 6.5 updated

## Phase 1 Completion Summary
- [x] ~130+ i18n keys added (zh-CN + en-US)
- [x] ~20+ components migrated to `t()` calls
- [x] Variable interpolation support (vars parameter)
- [x] AG-Grid localeText mapping
- [x] Architecture document updated

## Remaining Work (Future Phases)
- [ ] Phase 2: Store/toast layer and edge component hardcoded text cleanup
- [ ] Phase 3: i18n framework upgrade (react-i18next, JSON namespaces, type safety)

# I18n Hardcoded Text Extraction — Spec

## Why
当前前端存在多处硬编码中文文本，未通过 i18n `t('key')` 提取。用户在设置界面切换语言后，部分文本仍显示中文，影响国际化体验。

## What Changes
将以下组件中的硬编码中文提取为 i18n key：

| 组件 | 硬编码中文 | i18n Key |
|------|-----------|-----------|
| `DashboardItem.tsx` | "图表渲染失败" | `chart.renderFailed` |
| `DashboardItem.tsx` | "加载中..." | `common.loading`（已有）|
| `QueryPlanTree.tsx` | "执行计划" | `query.explainPlan` |
| `DataImport.tsx` | "暂无导入任务" | `import.noTasks` |
| `DataImport.tsx` | "选择 CSV/Excel/JSON 文件..." | `import.selectFileHint` |
| `DataImport.tsx` | "选择文件" | `import.selectFile`（已有）|
| `SnippetsPanel.tsx` | "暂无 SQL 片段" | `snippets.empty` |
| `SnippetsPanel.tsx` | "点击「新建」创建第一个片段" | `snippets.createFirstHint` |
| `DashboardCanvas.tsx` | "暂无图表" | `dashboard.empty` |
| `TaskCenterPage.tsx` | "已启用/已禁用/已暂停" | `task.statusEnabled/Disabled/Paused` |
| `TaskCenterPage.tsx` | "刷新图表/刷新仪表盘" | `task.actionRefreshChart/Dashboard` |
| `TaskCenterPage.tsx` | "暂无任务。点击..." | `task.emptyHint` |
| `TaskRunLogsPanel.tsx` | "请在左侧选择..." | `taskLogs.selectTaskHint` |
| `TaskRunLogsPanel.tsx` | "总运行/成功/失败" | `taskLogs.totalRuns/Success/Failed` |
| `TaskRunLogsPanel.tsx` | "暂无执行记录" | `taskLogs.noLogs` |
| `ProfilePanel.tsx` | "行数：" | `profile.rowCount` |
| `QueryCacheStatsPanel.tsx` | "未命中次数 (misses)" | `cache.missCount` |
| `ChartLibraryPanel.tsx` | "未授权给当前仪表盘" | `dashboard.unauthorized` |
| `AddChartModal.tsx` | "暂无保存的图表" | `chart.noSavedCharts` |
| 多个组件 | "取消" | `common.cancel`（已有）|

## Impact
- 修改文件：`src/context/LocaleContext.tsx`（新增翻译 key）
- 修改文件：上述各组件
- 不影响后端
- 用户切换语言后，所有文本将正确显示

## ADDED Requirements
### Requirement: No Hardcoded Chinese in UI
The system SHALL display all user-facing text through i18n `t()` function.

#### Scenario: Language switch
- **WHEN** user switches language in settings
- **THEN** ALL text in all components is displayed in the selected language
- **AND** no hardcoded Chinese text appears when English is selected

## MODIFIED Requirements
### Requirement: Translation Coverage
- New keys added to `zhCNTranslations` and `enUSTranslations` in LocaleContext.tsx
- All components import `useLocale` and use `t('key')` for user-facing text

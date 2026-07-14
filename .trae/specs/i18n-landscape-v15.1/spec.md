# QuickerSQL 国际化现状与规划报告 v15.1

## 一、国际化实现架构

### 1.1 技术选型
- **方案**：React Context + 内存翻译字典（无第三方库依赖）
- **核心文件**：`src/context/LocaleContext.tsx`（约 1600 行）
- **语言支持**：zh-CN（简体中文）、en-US（美国英语）

### 1.2 核心 API

```typescript
// 获取翻译文本
const { t } = useLocale();
t('key')  // 返回翻译后的文本

// 翻译替换变量
t('import.addedFiles', { count: 3 })  // "已添加 3 个文件"

// 格式化工具
formatDate(date)  // 格式化日期
formatTime(date)  // 格式化时间
formatNumber(num) // 格式化数字
```

### 1.3 翻译字典结构

| 章节前缀 | 用途 | key 数量 |
|---------|------|---------|
| `common.` | 通用文本（取消、确定、加载中等） | ~25 对 |
| `header.` | 顶部导航 | ~10 对 |
| `toolbar.` | 工具栏按钮 | ~30 对 |
| `query.` | SQL 查询结果 | ~15 对 |
| `settings.` | 设置页面 | ~80 对 |
| `import.` | 数据导入 | ~30 对 |
| `chart.` | 图表相关 | ~30 对 |
| `dashboard.` | 仪表盘（新增） | 2 对 |
| `snippets.` | SQL 片段（新增） | 2 对 |
| `task.` | 自动化任务（新增） | 6 对 |
| `taskLogs.` | 任务日志（新增） | 5 对 |
| `profile.` | 数据属性（新增） | 1 对 |
| `cache.` | 缓存统计（新增） | 4 对 |

### 1.4 AG-Grid 集成
- 通过 `localeText` prop 传入翻译字典
- 支持筛选、排序、分页等 AG-Grid 内部文本

---

## 二、已国际化组件清单（已完成）

| 组件 | 状态 | 说明 |
|------|------|------|
| `QueryPlanTree.tsx` | ✅ 已完成 | "执行计划" |
| `DashboardItem.tsx` | ✅ 已完成 | "加载中..." |
| `DataImport.tsx` | ✅ 已完成 | 空状态提示 |
| `SnippetsPanel.tsx` | ✅ 已完成 | 空状态提示 |
| `DashboardCanvas.tsx` | ✅ 已完成 | 空状态提示 |
| `TaskCenterPage.tsx` | ✅ 已完成 | 状态标签、提示文本 |
| `TaskRunLogsPanel.tsx` | ✅ 已完成 | 全部中文文本 |
| `ProfilePanel.tsx` | ✅ 已完成 | "行数：" |
| `QueryCacheStatsPanel.tsx` | ✅ 已完成 | "未命中次数" |
| `ChartLibraryPanel.tsx` | ✅ 已完成 | "未授权给当前仪表盘" |
| `AddChartModal.tsx` | ✅ 已完成 | "暂无保存的图表" |

---

## 三、遗留硬编码问题清单

### 3.1 优先级 P0（高优先级，需立即处理）

| 文件 | 行号 | 中文文本 | 上下文 | 建议 key |
|------|------|---------|--------|---------|
| `AddChartModal.tsx` | 136 | "取消" | 取消按钮 | `common.cancel` |
| `SaveChartModal.tsx` | 281, 312 | "取消" | 取消按钮 | `common.cancel` |
| `TaskEditorModal.tsx` | 504 | "取消" | 取消按钮 | `common.cancel` |
| `DashboardToolbar.tsx` | 286 | "取消" | 取消按钮 | `common.cancel` |
| `ChartEditSidebar.tsx` | 152 | "📋 基本信息" | 区块标题 | `chart.sectionBasic` |
| `ChartEditSidebar.tsx` | 153 | "名称" | 标签 | `chart.fieldName` |
| `ChartEditSidebar.tsx` | 158 | "图表名称" | 输入框 placeholder | `chart.chartNamePlaceholder` |
| `ChartEditSidebar.tsx` | 161 | "标题" | 标签 | `chart.title` |
| `ChartEditSidebar.tsx` | 166 | "显示在图表顶部" | 复选框 | `chart.showOnTop` |
| `ChartEditSidebar.tsx` | 169 | "描述" | 标签 | `chart.description` |
| `ChartEditSidebar.tsx` | 174 | "可选描述（不展示在图表上）" | 占位符 | `chart.descriptionPlaceholder` |
| `ChartEditSidebar.tsx` | 177 | "标签（用逗号分隔）" | 标签 | `chart.tags` |
| `ChartEditSidebar.tsx` | 182 | "如：销售, 2024, 季度" | 占位符 | `chart.tagsPlaceholder` |
| `ChartEditSidebar.tsx` | 188 | "📊 图表配置" | 区块标题 | `chart.sectionConfig` |
| `ChartEditSidebar.tsx` | 189 | "图表类型" | 标签 | `chart.chartType` |
| `ChartEditSidebar.tsx` | 207 | "X 轴字段" | 标签 | `chart.xAxisField` |
| `ChartEditSidebar.tsx | 212 | "例如：月份、日期、地区" | 占位符 | `chart.xAxisPlaceholder` |
| `ChartEditSidebar.tsx` | 216 | "Y 轴字段（用逗号分隔多个）" | 标签 | `chart.yAxisFields` |
| `ChartEditSidebar.tsx` | 221 | "例如：销售额, 利润, 成本" | 占位符 | `chart.yAxisPlaceholder` |
| `ChartEditSidebar.tsx` | 234 | "🗃️ 数据查询 (SQL)" | 区块标题 | `chart.sectionQuery` |
| `ChartEditSidebar.tsx` | 248 | "🔐 授权范围" | 区块标题 | `chart.sectionAuthorization` |
| `ChartEditSidebar.tsx` | 292 | "所有仪表盘" | 选项 | `chart.allDashboards` |
| `ChartEditSidebar.tsx` | 301 | "将此图表的一个副本添加到当前仪表盘" | 提示 | `chart.addToCurrentHint` |
| `ChartEditSidebar.tsx` | 308 | "为当前图表创建一个定时刷新的自动化任务" | 提示 | `chart.createTaskHint` |
| `SaveChartModal.tsx` | 75 | "添加到仪表盘" | 按钮 | `chart.addToDashboard` |
| `SaveChartModal.tsx` | 121 | "图表库" | Tab 标题 | `chart.chartLibrary` |
| `SaveChartModal.tsx` | 164 | "例如：月度销售趋势" | 占位符 | `chart.namePlaceholder` |
| `SaveChartModal.tsx` | 173 | "可选描述..." | 占位符 | `chart.descriptionPlaceholder` |
| `SaveChartModal.tsx` | 194 | "输入标签后按 Enter" | 占位符 | `chart.tagInputHint` |
| `SaveChartModal.tsx` | 307 | "例如：销售仪表盘" | 占位符 | `dashboard.namePlaceholder` |
| `DashboardPage.tsx` | 83 | "确定" | 确认按钮 | `common.confirm` |
| `DashboardItem.tsx` | 690 | "从仪表盘移除" | 按钮 | `dashboard.removeFromDashboard` |
| `DashboardItem.tsx` | 703 | "取消选择" | 按钮 | `common.cancelSelection` |
| `DashboardItem.tsx` | 782 | "拖拽以调整图表大小" | tooltip | `dashboard.dragToResize` |

### 3.2 优先级 P1（中优先级，影响用户体验）

| 文件 | 行号 | 中文文本 | 上下文 | 建议 key |
|------|------|---------|--------|---------|
| `ChartLibraryPanel.tsx` | 135 | "未授权给当前仪表盘，请在" | 提示文本 | `dashboard.unauthorized` |
| `ChartLibraryPanel.tsx` | 168 | "🔍 搜索图表名称、标签..." | 搜索框 | `chart.searchPlaceholder` |
| `ChartLibraryPanel.tsx` | 190 | "按图表对当前仪表盘的授权范围筛选" | 筛选提示 | `chart.authFilterHint` |
| `ChartLibraryPanel.tsx` | 298 | "定时刷新此图表" | 按钮 | `chart.scheduleRefresh` |
| `ChartLibraryPanel.tsx` | 303 | "删除此图表" | 按钮 | `chart.deleteChart` |
| `TaskCenterPage.tsx` | 446 | "搜索任务名称..." | 搜索框 | `task.searchPlaceholder` |
| `TaskCenterPage.tsx` | 478 | "调度模式筛选" | 筛选标签 | `task.scheduleModeFilter` |
| `TaskCenterPage.tsx` | 552 | "立即运行" | 按钮 | `task.runNow` |
| `TaskCenterPage.tsx` | 559 | "编辑" | 按钮 | `common.edit` |
| `TaskCenterPage.tsx` | 566 | "删除" | 按钮 | `common.delete` |
| `TaskEditorModal.tsx` | 6 | "默认重试次数/默认超时" | 标签 | `task.retryTimeout` |
| `TaskEditorModal.tsx` | 306 | "例如：每小时数据统计" | 占位符 | `task.namePlaceholder` |
| `TaskEditorModal.tsx` | 316 | "可选描述..." | 占位符 | `task.descriptionPlaceholder` |
| `TaskEditorModal.tsx` | 435 | "图表 ID" | 标签 | `task.chartId` |
| `TaskEditorModal.tsx` | 447 | "仪表盘 ID" | 标签 | `task.dashboardId` |
| `TaskRunLogsPanel.tsx` | 62 | "执行中" | 状态标签 | `task.running` |
| `DashboardToolbar.tsx` | 106 | "打开图表库，查看所有历史图表" | tooltip | `dashboard.openChartLibrary` |
| `DashboardToolbar.tsx` | 116 | "刷新所有图表数据" | 按钮 tooltip | `dashboard.refreshAllCharts` |
| `DashboardToolbar.tsx` | 122 | "定时刷新仪表盘数据" | 按钮 tooltip | `dashboard.scheduleRefresh` |
| `DashboardToolbar.tsx` | 130 | "导出仪表盘为 PNG 图片" | 按钮 tooltip | `dashboard.exportPng` |
| `DashboardToolbar.tsx` | 139 | "画布设置" | 按钮 | `dashboard.canvasSettings` |
| `DashboardToolbar.tsx` | 159 | "删除仪表盘" | 按钮 | `dashboard.deleteDashboard` |
| `DashboardToolbar.tsx` | 268, 279 | "0=自适应" | 输入框占位符 | `dashboard.autoFit` |
| `DatabaseExplorer.tsx` | 187 | "回收站" | Tab 标题 | `database.trash` |
| `DatabaseExplorer.tsx` | 387 | "删除表" | 按钮 tooltip | `database.dropTable` |
| `DatabaseExplorer.tsx` | 511 | "排序方式" | 下拉标签 | `database.sortBy` |
| `DatabaseExplorer.tsx` | 523 | "分组模式" | 切换标签 | `database.groupMode` |
| `DatabaseExplorer.tsx` | 530 | "刷新列表" | 按钮 tooltip | `database.refresh` |
| `DatabaseExplorer.tsx` | 574 | "你的表名" | 占位符 | `database.tableNamePlaceholder` |
| `SnippetsPanel.tsx` | 226 | "搜索片段..." | 搜索框 | `snippets.searchPlaceholder` |
| `SnippetsPanel.tsx` | 290 | "插入到编辑器" | 按钮 | `snippets.insertToEditor` |
| `SnippetsPanel.tsx` | 297 | "编辑" | 按钮 tooltip | `common.edit` |
| `SnippetsPanel.tsx` | 304 | "删除" | 按钮 tooltip | `common.delete` |
| `SnippetsPanel.tsx` | 378 | "输入片段名称" | 占位符 | `snippets.namePlaceholder` |
| `SnippetsPanel.tsx` | 388 | "输入 SQL 语句" | 占位符 | `snippets.sqlPlaceholder` |
| `SnippetsPanel.tsx` | 400 | "输入描述（可选）" | 占位符 | `snippets.descPlaceholder` |
| `SnippetsPanel.tsx` | 412 | "分类名称" | 标签 | `snippets.categoryName` |
| `SnippetsPanel.tsx` | 424 | "例如: 查询, 统计, 日常" | 占位符 | `snippets.tagsPlaceholder` |
| `Toolbar.tsx` | 623 | "布局" | 按钮/菜单 | `common.layout` |
| `DashboardFilterBar.tsx` | 78 | "全部" | 下拉选项 | `filter.all` |
| `DashboardFilterBar.tsx` | 89 | "输入..." | 输入框 | `filter.inputPlaceholder` |
| `AddChartModal.tsx` | 85 | "搜索图表..." | 搜索框 | `chart.searchPlaceholder` |
| `SettingsModal.tsx` | 278 | "如 Ctrl+Enter" | 占位符 | `settings.shortcutHint` |
| `SettingsModal.tsx` | 287 | "恢复默认" | 按钮 | `settings.restoreDefault` |
| `SqlQueryPage.tsx` | 141 | "设置定时执行 SQL" | tooltip | `query.scheduleHint` |
| `SqlQueryPage.tsx` | 214 | "定时执行SQL" | 按钮 | `query.scheduleExecution` |
| `QueryCacheStatsPanel.tsx` | 275 | "自动刷新" | 标签 | `cache.autoRefresh` |
| `ParameterPanel.tsx` | 104 | "点击复制到剪贴板" | tooltip | `query.copyToClipboard` |
| `SidebarResizeHandle.tsx` | 81 | "拖拽调整宽度，双击恢复默认 (250px)" | tooltip | `sidebar.resizeHint` |

### 3.3 优先级 P2（低优先级，后续迭代）

| 类别 | 涉及文件 | 说明 |
|------|---------|------|
| 页面文本 | `Welcome.tsx`、`Guide.tsx` | 欢迎页/引导页全页中文 |
| 过滤器组件 | `TextFilter.tsx`、`SelectFilter.tsx`、`DateRangePicker.tsx` | 仪表盘过滤器中文 |
| 下拉菜单 | `DropdownMenu.tsx` | 通用下拉菜单选项 |
| 错误边界 | `ErrorBoundary.tsx` | 错误提示 |
| 图表预览 | `ChartPreview.tsx`、`ChartRenderer.tsx` | 图表相关中文 |

---

## 四、现有 i18n 系统不足

### 4.1 功能缺失

| 问题 | 说明 | 影响 |
|------|------|------|
| **无动态语言切换** | 语言切换需要刷新页面 | 用户体验不佳 |
| **无复数形式支持** | "1 个文件" 和 "2 个文件" 需手动处理 | 翻译不自然 |
| **无嵌套翻译** | `t('key.sub')` 不支持自动拼接 | key 管理不便 |
| **无延迟加载** | 所有翻译一次性加载 | 初始包体积大 |

### 4.2 代码质量

| 问题 | 说明 |
|------|------|
| **key 命名不统一** | 有些用 camelCase，有些用 snake_case |
| **key 分类混乱** | `common.` 下有太多 key，应按功能进一步拆分 |
| **部分 key 缺失英译** | 需逐一检查 `enUSTranslations` 是否完整 |

---

## 五、下一步规划

### Phase 1：完成 P0 + P1 硬编码清理（预计 2 小时）
1. 新增 `common.` 章节通用 key（取消、确定、编辑、删除等）
2. 新增 `chart.` / `dashboard.` / `task.` / `database.` 章节
3. 批量替换约 80 处硬编码中文

### Phase 2：完善 i18n 系统（预计 4 小时）
1. 支持语言动态切换（无需刷新页面）
2. 添加复数形式支持 `t('key', { count: n })`
3. 统一 key 命名规范

### Phase 3：P2 清理（预计 2 小时）
1. 欢迎页/引导页全页国际化
2. 过滤器组件国际化

---

## 六、统计汇总

| 类别 | 数量 |
|------|------|
| 翻译 key 总数（中+英） | ~400 对 |
| 已国际化组件 | 11 个 |
| 待处理硬编码（components） | ~80 处 |
| 待新增 key | ~50 对 |
| 涉及文件数 | ~30 个 |

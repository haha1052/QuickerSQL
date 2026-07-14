# QuickerSQL 前端交互问题根因分析与修复 v2

## Overview
- **Summary**: 分析并修复用户反馈的 4 个前端交互问题：查询历史按钮尺寸、执行按钮功能、回收站按钮尺寸、自动化任务布局空白。
- **Root Cause**: App.css 全局 button 样式覆盖组件 CSS；执行按钮未传递 initialSql 导致布局不正确；TaskRunLogsPanel 布局约束问题。
- **Target Users**: QuickerSQL 用户和开发团队

---

## 根因分析

### 问题 3 & 4：按钮尺寸问题（查询历史 & 回收站）

**根因**：`src/App.css` 第 68-81 行定义了全局 button 样式：

```css
button:not(.header-window-btn):not(.header-tab):not(.header-project-button):not(.header-settings-button) {
  padding: 0.6em 1.2em;   /* 远大于组件中的 2px 6px */
  font-size: 1em;          /* 远大于组件中的 10px */
}
```

这个全局样式的选择器特异性高于组件 CSS 中的 `.btn-action`，导致组件中定义的 `padding: 2px 6px; font-size: 10px` 被覆盖。

**解决方案**：在组件 CSS 中使用 `button.btn-action` 选择器提高特异性，或在关键属性上加 `!important`。

---

### 问题 3：查询历史执行按钮功能不正常

**根因**：`Sidebar.tsx` 中的 `handleExecuteSqlFromHistory` 函数：

```tsx
workspaceState.addTab(
  {
    title: t('queryHistory.execute'),
    type: 'sql',
    panels: [],  // 空面板，未设置编辑器/结果面板
    active: true,
  },
  { queryId: newQuery.id }  // 未传递 initialSql
);
```

问题：
1. `panels: []` 导致新标签页没有编辑器/结果面板
2. 未传递 `initialSql`，虽然 queryState.updateSqlQuery 设置了 SQL，但 addTab 不会使用它

**解决方案**：传递 `initialSql: sql` 和正确的面板配置。

---

### 问题 6：自动化任务布局右侧空白

**根因**：`TaskRunLogsPanel.tsx` 第 237-248 行：

```tsx
panel: {
  flex: 1,
  minWidth: '340px',
  maxWidth: '50%',  // 最大宽度限制为 50%
  ...
}
```

当窗口放大时，左侧面板（`flex: 1`）占据所有可用空间，右侧面板因 `maxWidth: '50%'` 限制和固定 `minWidth: '340px'` 导致空白。

**解决方案**：移除 `maxWidth: '50%'` 约束，让右侧面板能自动扩展。

---

## 修复方案

### FR-1：修复查询历史按钮样式
- 修改 `src/components/query-history/QueryHistory.css`
- 将 `.btn-action` 选择器改为 `button.btn-action` 提高特异性

### FR-2：修复回收站按钮样式
- 修改 `src/components/trash/TrashPanel.css`
- 将 `.btn-action` 选择器改为 `button.btn-action` 提高特异性

### FR-3：修复查询历史执行按钮功能
- 修改 `src/components/common/Sidebar.tsx`
- `handleExecuteSqlFromHistory` 中传递 `initialSql: sql` 给 `addTab`
- 确保新标签页有正确的面板配置

### FR-4：修复自动化任务布局
- 修改 `src/components/automation/TaskRunLogsPanel.tsx`
- 移除 `maxWidth: '50%'` 约束

---

## 验收标准

### AC-1：查询历史按钮尺寸
- **Given**: 用户查看查询历史
- **When**: 查看执行和删除按钮
- **Then**: 按钮尺寸明显缩小（font-size: 10px, padding: 2px 6px），不受全局样式影响

### AC-2：回收站按钮尺寸
- **Given**: 用户查看回收站
- **When**: 查看恢复和删除按钮
- **Then**: 按钮尺寸明显缩小（font-size: 10px, padding: 2px 6px），不受全局样式影响

### AC-3：查询历史执行按钮功能
- **Given**: 用户点击查询历史中的执行按钮
- **When**: SQL 编辑器显示
- **Then**: SQL 内容正确显示，面板布局为 50/50 分割

### AC-4：自动化任务布局
- **Given**: 用户最大化自动化任务页面窗口
- **When**: 查看任务详情和日志面板
- **Then**: 右侧面板合理填充，无大面积空白

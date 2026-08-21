# QuickerSQL 前端交互细节问题分析报告

## Overview
- **Summary**: 分析并解决用户报告的6个前端交互细节问题，包括项目名称显示、按钮文字、按钮尺寸、消息系统统一、工具栏显示和布局优化。
- **Purpose**: 提升用户体验，修复视觉和功能缺陷。
- **Target Users**: QuickerSQL 用户和开发团队

## 问题分析

### 问题1：切换项目时顶级tab栏项目名称不会改变

**问题位置**: `src/components/common/Header.tsx`

**问题根因**: Header 组件接收 `currentProject` 属性，但需要确认父组件是否正确传递更新后的值。

**证据**:
```tsx
<span className="header-project-name">
  {currentProject || '未选择'}
</span>
```

**解决方案**: 
- 检查 AppWrapper.tsx 中传递给 Header 的 currentProject 是否响应式更新
- 确保项目切换时状态正确同步

---

### 问题2：顶级tab页CSV导入按钮文字不准确

**问题位置**: `src/context/LocaleContext.tsx`

**当前文字**: "CSV导入"
**期望文字**: "数据导入"

**证据**:
```tsx
'header.csvImport': 'CSV导入',
```

**解决方案**: 修改 locale 文件中的翻译值

---

### 问题3：查询历史执行按钮和删除按钮太大，且执行按钮无作用

**问题位置**: `src/components/query-history/index.tsx`

**问题分析**:
1. 按钮样式问题 - `.btn-action` 类可能定义了过大的尺寸
2. 执行按钮功能问题 - `handleExecute` 调用 `onExecuteSql`，但需要检查父组件是否正确传递此回调

**证据**:
```tsx
const handleExecute = (item: QueryHistoryItem) => {
  if (onExecuteSql) {
    onExecuteSql(item.sql);
  }
};

<button className="btn-action btn-execute" onClick={() => handleExecute(item)}>
  {t('queryHistory.execute')}
</button>
```

**解决方案**:
1. 修改按钮样式，缩小尺寸为原来的 1/2
2. 确保 Sidebar 中传递 `onExecuteSql` 回调，实现新建查询标签页并执行SQL的功能

---

### 问题4：回收站恢复按钮和删除按钮太大，消息未走统一消息系统

**问题位置**: `src/components/trash/index.tsx`

**问题分析**:
1. 按钮样式问题 - `.btn-action` 类尺寸过大
2. 消息系统问题 - 使用 `alert()` 而不是统一的 `toastStore`

**证据**:
```tsx
// 恢复操作使用 alert
if (response.success) {
  alert(response.data || t('trash.restoreSuccess'));
} else {
  alert(`${t('trash.restoreFail')}: ${response.error}`);
}

// 删除操作使用 alert
if (response.success) {
  alert(response.data || t('trash.permanentDeleted'));
} else {
  alert(`${t('trash.deleteFail')}: ${response.error}`);
}
```

**解决方案**:
1. 修改按钮样式，缩小尺寸为原来的 1/2
2. 替换 `alert()` 为 `toastStore.success()` 和 `toastStore.error()`

---

### 问题5：仪表盘标签页不需要显示新建/打开/布局工具栏

**问题位置**: `src/components/dashboard/DashboardToolbar.tsx`

**问题分析**: 用户反馈仪表盘不需要显示"新建"、"打开"、"布局"等按钮

**解决方案**: 移除或隐藏这些按钮

---

### 问题6：自动化任务界面放大后右侧空白

**问题位置**: `src/components/automation/TaskCenterPage.tsx`

**问题分析**: 任务列表和运行日志面板布局在窗口放大时，右侧运行日志区域可能出现大面积空白

**解决方案**: 优化布局，使右侧面板能够自适应填充空间

---

## 功能需求

### FR-1：项目名称响应式更新
- FR-1.1: 切换项目时，Header 中的项目名称实时更新

### FR-2：按钮文字更正
- FR-2.1: 将"CSV导入"改为"数据导入"

### FR-3：查询历史按钮优化
- FR-3.1: 执行按钮和删除按钮缩小为原尺寸的 1/2
- FR-3.2: 执行按钮点击后新建查询标签页并执行SQL

### FR-4：回收站按钮优化
- FR-4.1: 恢复按钮和删除按钮缩小为原尺寸的 1/2
- FR-4.2: 操作结果使用统一消息系统(toast)

### FR-5：仪表盘工具栏优化
- FR-5.1: 隐藏不需要的新建/打开/布局按钮

### FR-6：自动化任务布局优化
- FR-6.1: 优化任务和日志面板的布局，消除空白

---

## 实施方案

### 任务1：修复项目名称更新
- 修改文件: `src/AppWrapper.tsx`
- 确保 currentProject 状态正确传递给 Header

### 任务2：修改按钮文字
- 修改文件: `src/context/LocaleContext.tsx`
- 将 'header.csvImport': 'CSV导入' 改为 '数据导入'

### 任务3：查询历史按钮优化
- 修改文件: `src/components/query-history/index.tsx`
- 修改文件: `src/components/query-history/QueryHistory.css`
- 修改文件: `src/components/common/Sidebar.tsx`

### 任务4：回收站按钮优化
- 修改文件: `src/components/trash/index.tsx`
- 修改文件: `src/components/trash/TrashPanel.css`

### 任务5：仪表盘工具栏优化
- 修改文件: `src/components/dashboard/DashboardToolbar.tsx`

### 任务6：自动化任务布局优化
- 修改文件: `src/components/automation/TaskCenterPage.tsx`

---

## 验收标准

### AC-1：项目名称更新
- **Given**: 用户切换项目
- **When**: 选择新的项目
- **Then**: Header 中的项目名称立即更新

### AC-2：按钮文字正确
- **Given**: 用户查看顶级tab栏
- **When**: 查看CSV导入按钮
- **Then**: 显示"数据导入"

### AC-3：查询历史按钮尺寸和功能
- **Given**: 用户查看查询历史
- **When**: 查看执行和删除按钮
- **Then**: 按钮尺寸缩小，执行按钮点击后新建标签页并执行SQL

### AC-4：回收站按钮尺寸和消息
- **Given**: 用户操作回收站
- **When**: 恢复或删除项目
- **Then**: 按钮尺寸缩小，结果通过 toast 显示

### AC-5：仪表盘工具栏简化
- **Given**: 用户查看仪表盘
- **When**: 查看工具栏
- **Then**: 不显示新建/打开/布局按钮

### AC-6：自动化任务布局
- **Given**: 用户最大化窗口
- **When**: 查看自动化任务页面
- **Then**: 右侧面板合理填充，无大面积空白

---

## Open Questions
- [ ] 是否需要保留仪表盘的"布局"按钮用于布局设置功能？
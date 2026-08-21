# 快捷键完整实现 (importData/exportData/newProject)

## Why
剩余 3 个简易实现的快捷键（newProject、importData、exportData）目前只显示"开发中"提示，需要实现完整功能，让用户真正能用这些快捷键操作。

## What Changes
- 实现 `newProject` (Ctrl+Shift+N)：创建新项目/工作区
- 实现 `importData` (Ctrl+I)：打开数据导入功能
- 实现 `exportData` (Ctrl+E)：打开数据导出功能
- 更新相关文档

## Impact
- Affected specs: unified-shortcut-system, shortcut-handlers-impl
- Affected code: ShortcutProvider.tsx, appStore.ts, workspaceStore.ts

## ADDED Requirements

### Requirement: newProject 快捷键完整实现
系统应支持通过快捷键创建新项目/工作区。

#### Scenario: 创建新项目
- **WHEN** 用户按 Ctrl+Shift+N
- **THEN** 创建一个新的空项目/工作区，或打开项目创建对话框

### Requirement: importData 快捷键完整实现
系统应支持通过快捷键打开数据导入功能。

#### Scenario: 打开数据导入
- **WHEN** 用户按 Ctrl+I
- **THEN** 打开数据导入面板或对话框

### Requirement: exportData 快捷键完整实现
系统应支持通过快捷键打开数据导出功能。

#### Scenario: 打开数据导出
- **WHEN** 用户按 Ctrl+E（在编辑器外）
- **THEN** 打开数据导出面板或对话框
- **NOTE**: 编辑器内 Ctrl+E 是 explainQuery，优先级更高

## Implementation Approach

### newProject 实现方案
1. 方案 A：直接调用 workspaceStore 创建一个新的空工作区
2. 方案 B：打开一个项目创建对话框，让用户输入项目名称
3. 建议：先实现方案 A 作为基础，方案 B 作为增强

### importData 实现方案
1. 参考 Toolbar.tsx 中的"批量导入"功能
2. 使用 appStore 的状态管理打开导入面板
3. 或直接打开一个导入对话框

### exportData 实现方案
1. 导出功能可能需要更多上下文（导什么数据？）
2. 简化方案：打开导出面板，让用户选择要导出的内容
3. 或导出当前活动的表/查询结果

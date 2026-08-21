# 仪表盘导出和保存按钮修复 Spec

## Why
用户点击仪表盘界面的"导出"和"保存"按钮都没有反应。根因是：
1. **保存按钮**：`handleSave` 只在 `isEditing && tempLayout 有变更` 时才执行保存，其他情况静默返回无任何反馈。
2. **导出按钮**：编辑模式下 `disabled={isEditing}` 禁用了按钮，但按钮样式没有禁用态视觉变化（`cursor` 始终为 `pointer`，无透明度变化），用户无法察觉按钮被禁用。此外导出失败时只用 `alert()` 而非统一 toast 消息系统。

## What Changes
- 修复 `handleSave`：非编辑模式或无变更时给出明确 toast 提示，而非静默返回；保存成功/失败时用 toast 反馈替代 `alert()`
- 修复导出按钮禁用态样式：`disabled` 时降低透明度、`cursor: not-allowed`，让用户清楚看到按钮不可用
- 修复 `handleExportPng`：无活动仪表盘时给出 toast 提示；导出失败时用 toast 替代 `alert()`
- 导出按钮在编辑模式下不再直接禁用，而是点击时提示"请先退出编辑模式"

## Impact
- Affected code: `src/components/dashboard/DashboardPage.tsx`、`src/components/dashboard/DashboardToolbar.tsx`、`src/utils/dashboardExport.ts`

## ADDED Requirements

### Requirement: 保存按钮反馈
保存按钮在所有情况下都应给用户明确反馈：
- 非编辑模式点击 → toast 提示"请先进入编辑模式再保存"
- 编辑模式但无布局变更 → toast 提示"没有未保存的变更"
- 编辑模式有变更 → 执行保存，成功/失败均 toast 反馈

#### Scenario: 非编辑模式点击保存
- **WHEN** 用户不在编辑模式下点击"保存"按钮
- **THEN** 显示 toast 提示"请先进入编辑模式再保存"

#### Scenario: 编辑模式无变更点击保存
- **WHEN** 用户在编辑模式下但未移动任何图表时点击"保存"
- **THEN** 显示 toast 提示"没有未保存的变更"

#### Scenario: 保存成功
- **WHEN** 用户在编辑模式下有布局变更时点击"保存"
- **THEN** 执行事务性保存，成功后显示 toast"保存成功"，清空 tempLayout

#### Scenario: 保存失败
- **WHEN** 保存操作返回错误
- **THEN** 显示 toast 错误消息"保存失败：{错误信息}"

### Requirement: 导出按钮禁用态视觉反馈
导出按钮在编辑模式下应明确展示禁用状态，且点击时给出提示而非静默无效。

#### Scenario: 编辑模式下点击导出
- **WHEN** 用户在编辑模式下点击"导出"按钮
- **THEN** 显示 toast 提示"请先退出编辑模式"，不执行导出逻辑

#### Scenario: 非编辑模式正常导出
- **WHEN** 用户不在编辑模式下点击"导出"按钮
- **THEN** 正常执行导出逻辑

### Requirement: 导出错误使用 toast 反馈
导出过程中的错误提示统一使用 toast 消息系统，不再使用 `alert()`。

#### Scenario: 仪表盘为空时导出
- **WHEN** 仪表盘没有图表时点击导出
- **THEN** 显示 toast 警告"仪表盘为空，无法导出"

#### Scenario: 导出异常
- **WHEN** 导出过程中发生异常
- **THEN** 显示 toast 错误"导出失败：{错误信息}"

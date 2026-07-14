# 快捷键引导和执行逻辑修复 Spec

## Why
引导界面展示的快捷键知识有误（显示 F5 执行查询，实际是 Ctrl+Enter），且 Ctrl+Enter 的执行逻辑有问题（无选中时只执行光标所在语句，而非全部 SQL）。用户期望 Ctrl+Enter 的行为与"执行"按钮一致：有选中→执行选中，无选中→执行全部。

## What Changes
- 修复引导页快捷键文案：`F5 执行查询` → `Ctrl+Enter 执行查询`
- 修复引导页保存快捷键描述：`Ctrl+S 保存查询` → `Ctrl+S 保存到文件`
- 修复 `handleExecuteQuery`（Ctrl+Enter）逻辑：无选中时调用 `onExecute?.()`（执行全部），而非 `getStatementAtCursor` + `onExecuteStatement`（只执行光标所在语句）

## Impact
- Affected code: `src/context/LocaleContext.tsx`（i18n 文案）、`src/components/sql/SQLEditor.tsx`（快捷键处理逻辑）

## ADDED Requirements

### Requirement: Ctrl+Enter 执行逻辑与执行按钮一致
Ctrl+Enter 快捷键的执行行为应与点击"执行"按钮完全一致：优先执行选中的 SQL，无选中时执行编辑器中的全部 SQL。

#### Scenario: 有选中 SQL 时执行
- **GIVEN** 用户在 SQL 编辑器中选中了一段 SQL 文本
- **WHEN** 用户按下 Ctrl+Enter
- **THEN** 只执行选中的 SQL 文本

#### Scenario: 无选中 SQL 时执行全部
- **GIVEN** 用户在 SQL 编辑器中没有选中任何文本
- **WHEN** 用户按下 Ctrl+Enter
- **THEN** 执行编辑器中的全部 SQL（与点击"执行"按钮行为一致）

#### Scenario: 选中空白文本时执行全部
- **GIVEN** 用户选中的文本只包含空格或换行
- **WHEN** 用户按下 Ctrl+Enter
- **THEN** 视为无选中，执行编辑器中的全部 SQL

### Requirement: 引导页快捷键文案正确
引导页展示的快捷键必须与系统实际默认快捷键一致。

#### Scenario: 引导页显示正确的执行快捷键
- **GIVEN** 用户进入引导页的"查询"步骤
- **WHEN** 查看快捷操作列表
- **THEN** 显示"Ctrl+Enter 执行查询"（而非"F5 执行查询"）

#### Scenario: 引导页显示正确的保存快捷键描述
- **GIVEN** 用户进入引导页的"查询"步骤
- **WHEN** 查看快捷操作列表
- **THEN** 显示"Ctrl+S 保存到文件"（而非"Ctrl+S 保存查询"）

## Non-Goals
- 不修改快捷键默认值（Ctrl+Enter 保持不变）
- 不修改 `getStatementAtCursor` 函数本身（其他功能仍可能使用）
- 不修改 Ctrl+Shift+Enter（执行全部）的行为
- 不动态读取设置系统中的快捷键值来展示（仅修复硬编码文案）

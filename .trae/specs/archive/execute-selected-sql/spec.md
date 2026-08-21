# 执行选中 SQL 优先 Spec

## Why
当前 SQL 查询界面的"执行"按钮点击时总是执行编辑器中的全部 SQL 内容，而不考虑用户是否选中了部分 SQL。用户期望的行为是：如果鼠标选中了部分 SQL，则只执行选中的部分；如果没有选中，则执行查询框中的全部 SQL。这与主流 SQL 客户端（如 DBeaver、DataGrip、Navicat）的行为一致。

## What Changes
- 修改"执行 SQL"按钮的点击逻辑：优先获取 Monaco 编辑器的选中文本，有选中则执行选中部分，无选中则执行整段 SQL
- 修改 `useQueryExecution` hook：新增 `executeSelectedOrAll` 方法，支持传入选中文本
- 保持快捷键（Ctrl+Enter）的现有行为不变（已经是选中优先）

## Impact
- Affected code:
  - `src/components/workspace/Workspace.tsx` — 执行按钮 onClick
  - `src/components/sql/hooks/useQueryExecution.ts` — 执行逻辑
  - `src/components/workspace/PanelManager.tsx` — 中间层传递
  - `src/components/sql/SQLEditor.tsx` — 暴露获取选中文本的能力

## ADDED Requirements

### Requirement: 执行按钮优先执行选中 SQL
系统 SHALL 在用户点击"执行 SQL"按钮时，优先检查 Monaco 编辑器中是否有选中文本：
- 如果有选中文本（非空白），则只执行选中的 SQL
- 如果没有选中文本，则执行编辑器中的全部 SQL

#### Scenario: 用户选中部分 SQL 后点击执行
- **WHEN** 用户在 SQL 编辑器中选中一段 SQL 语句，然后点击"执行 SQL"按钮
- **THEN** 系统只执行选中的 SQL 语句，结果区域显示该语句的执行结果

#### Scenario: 用户未选中任何 SQL 时点击执行
- **WHEN** 用户没有在 SQL 编辑器中选中任何文本，点击"执行 SQL"按钮
- **THEN** 系统执行编辑器中的全部 SQL 内容（与当前行为一致）

#### Scenario: 用户选中空白文本时点击执行
- **WHEN** 用户在 SQL 编辑器中选中了只包含空白字符的文本，点击"执行 SQL"按钮
- **THEN** 系统视为未选中，执行编辑器中的全部 SQL 内容

### Requirement: 执行历史记录区分来源
系统 SHALL 在查询历史中记录实际执行的 SQL 内容，无论是选中执行还是全部执行。

#### Scenario: 选中执行后历史记录正确
- **WHEN** 用户选中部分 SQL 执行
- **THEN** 查询历史中记录的是选中的 SQL 文本，而非编辑器全部内容

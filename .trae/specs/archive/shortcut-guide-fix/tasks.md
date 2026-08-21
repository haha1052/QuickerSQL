# Tasks

- [x] Task 1: 修复引导页快捷键文案（LocaleContext.tsx）
  - [x] SubTask 1.1: 中文 `guide.query.shortcut1` 从 `▶️ F5 执行查询` 改为 `▶️ Ctrl+Enter 执行查询`
  - [x] SubTask 1.2: 中文 `guide.query.shortcut2` 从 `💾 Ctrl+S 保存查询` 改为 `💾 Ctrl+S 保存到文件`
  - [x] SubTask 1.3: 英文 `guide.query.shortcut1` 从 `▶️ F5 to execute query` 改为 `▶️ Ctrl+Enter to execute query`
  - [x] SubTask 1.4: 英文 `guide.query.shortcut2` 从 `💾 Ctrl+S to save query` 改为 `💾 Ctrl+S to save to file`
- [x] Task 2: 修复 Ctrl+Enter 执行逻辑（SQLEditor.tsx）
  - [x] SubTask 2.1: 修改 `handleExecuteQuery` 函数：有选中时保持现有行为（调用 `onExecuteStatement`）
  - [x] SubTask 2.2: 无选中时改为调用 `onExecute?.()`（执行全部 SQL），移除 `getStatementAtCursor` 逻辑
- [x] Task 3: 编译验证
  - [x] SubTask 3.1: `npx tsc --noEmit --pretty` 通过（0 errors）
  - [x] SubTask 3.2: `cargo check --quiet` 通过（无后端改动，N/A）

# Task Dependencies
- [Task 2] depends on [Task 1] (无硬依赖，可并行)
- [Task 3] depends on [Task 1, Task 2]

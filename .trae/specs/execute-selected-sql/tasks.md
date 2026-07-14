# 执行选中 SQL 优先 - 实现计划

## [x] Task 1: useQueryExecution 新增 executeSelectedOrAll 方法
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 在 `src/components/sql/hooks/useQueryExecution.ts` 中新增 `executeSelectedOrAll` 方法
  - 该方法接收一个可选参数 `selectedSql?: string`
  - 如果 `selectedSql` 非空（trim 后长度 > 0），则执行 `selectedSql`
  - 如果 `selectedSql` 为空或未传入，则 fallback 到现有逻辑（执行 `activeQuery.sql`）
  - 内部复用现有的执行流程（applyDefaultSelectLimit → executeSql → setBatchResults → addToHistory）
  - 避免与现有 `executeQuery` 重复代码：可以让 `executeQuery` 调用 `executeSelectedOrAll(undefined)`
- **Acceptance Criteria**: AC-1, AC-2
- **Test**:
  - `programmatic` TR-1.1: tsc 类型检查通过
  - `programmatic` TR-1.2: 传入选中文本时执行选中内容
  - `programmatic` TR-1.3: 未传入选中文本时执行全部内容

## [x] Task 2: SQLEditor 暴露获取选中文本的能力
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 在 `src/components/sql/SQLEditor.tsx` 中，通过 ref 或回调向父组件暴露获取当前选中文本的方法
  - 方案：在 PanelManager 中通过 ref 获取 SQLEditor 内部的 Monaco editor 实例，调用 `editor.getSelection()` 和 `model.getValueInRange(selection)` 获取选中文本
  - 或者：SQLEditor 接受一个 `onGetSelection?: () => string | undefined` 回调注册
  - 推荐方案：使用 `forwardRef` + `useImperativeHandle` 暴露 `getSelectedText()` 方法
- **Acceptance Criteria**: AC-1
- **Test**:
  - `programmatic` TR-2.1: tsc 类型检查通过
  - `human-judgement` TR-2.2: 能正确获取编辑器选中的文本

## [x] Task 3: Workspace 执行按钮接入选中优先逻辑
- **Priority**: high
- **Depends On**: Task 1, Task 2
- **Description**:
  - 修改 `src/components/workspace/Workspace.tsx` 中执行按钮的 onClick
  - 点击时先获取当前活动编辑器的选中文本
  - 调用 `executeSelectedOrAll(selectedText)` 而非 `executeQuery()`
  - 需要从 PanelManager 或 SQLEditor 获取选中文本：可通过 ref 链或 context
  - 如果获取选中文本失败（如编辑器未挂载），fallback 到执行全部 SQL
- **Acceptance Criteria**: AC-1, AC-2, AC-3
- **Test**:
  - `programmatic` TR-3.1: tsc 类型检查通过
  - `human-judgement` TR-3.2: 选中 SQL 后点击按钮只执行选中部分
  - `human-judgement` TR-3.3: 未选中 SQL 时点击按钮执行全部内容

## [x] Task 4: 联调验证
- **Priority**: high
- **Depends On**: Task 3
- **Description**:
  - 运行 tsc 类型检查
  - 验证选中执行、未选中执行、空白选中三种场景
  - 验证查询历史记录正确
  - 验证快捷键 Ctrl+Enter 行为不受影响
- **Acceptance Criteria**: AC-1, AC-2, AC-3, AC-4
- **Test**:
  - `programmatic` TR-4.1: tsc 通过
  - `human-judgement` TR-4.2: 三种场景行为正确

# Task Dependencies
- Task 3 depends on Task 1 and Task 2
- Task 4 depends on Task 3

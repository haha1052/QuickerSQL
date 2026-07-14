# 快捷键 Handler 对接实施 - The Implementation Plan (Decomposed and Prioritized Task List)

## [ ] Task 1: 编辑器作用域快捷键（find/replace/goToLine/toggleComment）
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 修改 `src/components/sql/SQLEditor.tsx`
  - 向 shortcutManager 注册 4 个 editor 作用域的命令
  - find: 调用 Monaco 内置查找命令（actions.find）
  - replace: 调用 Monaco 内置替换命令（editor.action.startFindReplaceAction）
  - goToLine: 调用 Monaco 内置跳转到行命令（editor.action.gotoLine）
  - toggleComment: 调用 Monaco 内置切换注释命令（editor.action.commentLine 或 editor.action.toggleLineComment）
  - 从设置读取快捷键值并绑定
  - 监听设置变更，动态更新绑定
  - 组件卸载时注销命令
- **Acceptance Criteria Addressed**: AC-1, AC-4
- **Test Requirements**:
  - `programmatic` TR-1.1: 在编辑器中按 Ctrl+F 打开查找框
  - `programmatic` TR-1.2: 在编辑器中按 Ctrl+H 打开替换框
  - `programmatic` TR-1.3: 在编辑器中按 Ctrl+G 打开跳转到行对话框
  - `programmatic` TR-1.4: 在编辑器中按 Ctrl+/ 切换当前行注释
  - `human-judgement` TR-1.5: 与 Monaco 原有行为一致，不破坏内置功能
- **Notes**: 使用 editor.getAction(id).run() 调用内置命令

## [ ] Task 2: 全局文件操作快捷键（newFile/openFile/saveFile/saveAs）
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 修改 `src/context/ShortcutProvider.tsx`
  - 实现 4 个全局文件操作快捷键的 handler
  - newFile: 调用 workspaceStore.addTab() 新建 SQL 标签页
  - openFile: 打开文件对话框（Tauri open dialog），选择 .sql 文件，读取内容并新建标签页
  - saveFile: 保存当前文件。如果当前标签是 SQL 类型且有关联文件路径，直接保存；否则弹出另存为
  - saveAs: 弹出另存为对话框，保存当前 SQL 内容到文件
  - 参考 Toolbar.tsx 中已有的文件操作实现
  - 保存功能需要知道当前活动标签的内容和文件路径
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `programmatic` TR-2.1: 按 Ctrl+N 新建一个 SQL 标签页
  - `programmatic` TR-2.2: 按 Ctrl+O 弹出文件选择对话框
  - `programmatic` TR-2.3: 按 Ctrl+S 触发保存操作
  - `human-judgement` TR-2.4: 文件操作行为与点击工具栏按钮一致
- **Notes**: 需要从 workspaceStore 获取当前活动标签信息

## [ ] Task 3: 全局编辑快捷键（undo/redo/copy/paste/cut/selectAll）
- **Priority**: medium
- **Depends On**: None
- **Description**:
  - 修改 `src/context/ShortcutProvider.tsx`
  - 实现 6 个全局编辑快捷键的 handler
  - 实现策略：
    - 对于可编辑元素（输入框、textarea 等）：不 preventDefault，让浏览器默认行为处理
    - 对于 Monaco 编辑器：让 Monaco 自己处理（editor 作用域）
    - 对于非编辑区域：使用 document.execCommand 尝试触发
  - 实际上，大部分情况浏览器/Monaco 已经处理了，我们主要是：
    - 确保这些快捷键在设置中可配置
    - 确保我们的全局快捷键系统不会意外阻止这些默认行为
    - 在非编辑区域提供基础支持
  - 注意：paste 可能受浏览器安全限制，在某些场景下可能不工作
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `programmatic` TR-3.1: 在输入框中 Ctrl+Z 能撤销
  - `programmatic` TR-3.2: 在输入框中 Ctrl+C/V/X/A 能正常工作
  - `programmatic` TR-3.3: 在编辑器中这些操作由 Monaco 处理，不受影响
  - `human-judgement` TR-3.4: 编辑操作符合用户预期
- **Notes**: 编辑快捷键是"锦上添花"，主要依赖浏览器默认行为

## [ ] Task 4: 全局导入导出与项目快捷键（importData/exportData/newProject）
- **Priority**: low
- **Depends On**: None
- **Description**:
  - 修改 `src/context/ShortcutProvider.tsx`
  - 实现 3 个功能较复杂的快捷键
  - importData (Ctrl+I): 打开数据导入功能（参考 Toolbar.tsx 的批量导入）
  - exportData (Ctrl+E): 导出功能（如果没有现成的简单实现，先做一个简单的导出数据库或导出当前表）
  - newProject (Ctrl+Shift+N): 新建项目（如果流程复杂，先打开项目管理器）
  - 注意：Ctrl+E 在编辑器中是 explainQuery，编辑器优先级更高，不会冲突
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `programmatic` TR-4.1: 按 Ctrl+I 能触发导入流程
  - `human-judgement` TR-4.2: 导入/导出/新建项目行为符合预期
  - `human-judgement` TR-4.3: 与编辑器的 Ctrl+E 不冲突
- **Notes**: 如果某些功能太复杂，可以只做简单版本或标记为待完善

## [ ] Task 5: 编译验证与集成测试
- **Priority**: high
- **Depends On**: Task 1, Task 2, Task 3, Task 4
- **Description**:
  - 运行 npx tsc --noEmit --pretty 验证类型
  - 运行 cargo check --quiet 验证后端（预期无变化）
  - 检查架构分层是否正确
  - 验证快捷键优先级是否正确
  - 检查是否有新增的 any 类型
- **Acceptance Criteria Addressed**: AC-4, AC-5
- **Test Requirements**:
  - `programmatic` TR-5.1: npx tsc --noEmit --pretty 返回 0 errors（我们修改的文件）
  - `programmatic` TR-5.2: cargo check --quiet 无 error
  - `programmatic` TR-5.3: 组件层无直接 invoke 调用
  - `human-judgement` TR-5.4: 代码风格与现有项目一致
- **Notes**: 编译验证是硬门禁

## [ ] Task 6: 更新文档
- **Priority**: medium
- **Depends On**: Task 5
- **Description**:
  - 更新快捷键管理系统技术文档（补充已对接的快捷键）
  - 更新设置系统现状分析报告（更新快捷键分类的实现率）
  - 更新 implemented_settings 函数（新增实现的快捷键）
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `human-judgement` TR-6.1: 文档内容准确，与实际实现一致
  - `human-judgement` TR-6.2: 设置系统现状分析报告数据准确
- **Notes**: 文档更新是收尾工作

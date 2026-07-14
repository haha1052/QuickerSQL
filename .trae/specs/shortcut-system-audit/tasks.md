# 快捷键系统全面审计与修复 - The Implementation Plan (Decomposed and Prioritized Task List)

## [ ] Task 1: 后端补充缺失的快捷键设置项
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 在 `settings_service.rs` 的 `default_settings()` 中补充 3 个缺失的快捷键设置项
  - 在 `implemented_settings()` 中标记这 3 项为已实现
  - 新增项：
    - `executeAll` - 执行全部 SQL，默认值 "Ctrl+Shift+Enter"
    - `explainQuery` - 解释当前查询，默认值 "Ctrl+E"
    - `explainAll` - 解释全部查询，默认值 "Ctrl+Shift+E"
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `programmatic` TR-1.1: `cargo check --quiet` 通过，无编译错误
  - `programmatic` TR-1.2: 设置系统返回的 shortcuts 分类包含 executeAll、explainQuery、explainAll 三项
  - `programmatic` TR-1.3: implemented_settings 中包含这三项
- **Notes**: 注意同步更新文档中的快捷键计数（20 → 23 项）

## [ ] Task 2: SQLEditor 快捷键绑定修复与优化
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 
  - 合并命令注册与快捷键绑定到同一个 useEffect，消除时序问题
  - 确保命令先注册，再绑定快捷键（顺序确定）
  - 移除空 catch 块，添加有意义的错误日志（console.warn）
  - 验证所有 9 个编辑器作用域命令的 handler 是否正确
  - 添加开发模式下的调试日志（注册、绑定、触发）
  - 确保 executeQuery 的 handler 正确调用 onExecuteStatement（执行选中文本或光标所在语句）
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-6
- **Test Requirements**:
  - `programmatic` TR-2.1: `npx tsc --noEmit` 通过，无类型错误
  - `human-judgement` TR-2.2: 在编辑器中按 Ctrl+Enter 能执行 SQL
  - `human-judgement` TR-2.3: 所有 9 个编辑器快捷键都能正常工作
  - `programmatic` TR-2.4: 控制台无快捷键相关的未捕获错误
- **Notes**: 重点排查执行查询快捷键不生效的根本原因

## [ ] Task 3: ShortcutProvider 全局快捷键优化
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 检查所有全局快捷键 handler 是否正确实现
  - 修复空 handler 的快捷键（executeQuery、formatSql、toggleComment 等编辑器相关的全局命令）
  - 添加绑定成功/失败的日志
  - 优化 isMonacoEditor 检测逻辑（确保准确）
  - 验证全局快捷键与编辑器快捷键的优先级是否正确
  - 清理无效的全局命令（编辑器相关的全局命令如果在编辑器内已处理，全局的可以移除或改为透传）
- **Acceptance Criteria Addressed**: AC-3, AC-6
- **Test Requirements**:
  - `programmatic` TR-3.1: `npx tsc --noEmit` 通过
  - `human-judgement` TR-3.2: Ctrl+, 打开设置正常工作
  - `human-judgement` TR-3.3: Ctrl+N 新建文件正常工作
  - `human-judgement` TR-3.4: 在编辑器中按 Ctrl+E 触发 explainQuery 而不是 exportData（优先级正确）
- **Notes**: 全局快捷键中的编辑器相关命令（如 executeQuery）只在非编辑器区域有意义，编辑器内由 editor 作用域处理

## [ ] Task 4: 补充常用快捷键（关闭标签、切换标签等）
- **Priority**: medium
- **Depends On**: Task 1, Task 2, Task 3
- **Description**: 
  - 后端新增 4 个快捷键设置项：
    - `closeTab` - 关闭当前标签（Ctrl+W）
    - `nextTab` - 下一个标签（Ctrl+Tab）
    - `prevTab` - 上一个标签（Ctrl+Shift+Tab）
    - `newTab` - 新建标签（Ctrl+T，可与 newFile 合并）
  - 前端 ShortcutProvider 中实现对应的 handler
  - 确保与 workspaceStore 正确集成
- **Acceptance Criteria Addressed**: AC-3, AC-4
- **Test Requirements**:
  - `programmatic` TR-4.1: `cargo check --quiet` 通过
  - `programmatic` TR-4.2: `npx tsc --noEmit` 通过
  - `human-judgement` TR-4.3: Ctrl+W 关闭当前标签页
  - `human-judgement` TR-4.4: Ctrl+Tab 切换到下一个标签
  - `human-judgement` TR-4.5: Ctrl+Shift+Tab 切换到上一个标签
- **Notes**: 此任务为可选增强，如果时间紧张可以延后

## [ ] Task 5: 全面验证与文档更新
- **Priority**: high
- **Depends On**: Task 1, Task 2, Task 3
- **Description**: 
  - 逐一测试所有快捷键，确保全部可用
  - 编译检查通过（cargo check + npx tsc）
  - 安全检查通过（无 SQL 注入、无敏感字符串）
  - 记录快捷键测试结果
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-3, AC-5, AC-6
- **Test Requirements**:
  - `programmatic` TR-5.1: `cargo check --quiet` 通过
  - `programmatic` TR-5.2: `npx tsc --noEmit` 通过
  - `programmatic` TR-5.3: SQL 注入检测 Count = 0
  - `programmatic` TR-5.4: 敏感字符串检测 Count = 0
  - `human-judgement` TR-5.5: 所有快捷键功能正常，无明显 bug
- **Notes**: 此任务为最终验证

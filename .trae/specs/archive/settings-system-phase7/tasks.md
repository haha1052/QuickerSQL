# 设置系统 Phase 7 功能接入 - 实施计划

## [x] Task 1: 后端标记数据导入已实现项
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 在 `settings_service.rs` 的 `implemented_settings()` 函数中添加数据导入的 2 项已实现标记
  - `import.firstRowAsHeader` 和 `import.skipEmptyRows` 实际已在 DataImport.tsx 中使用
  - 只需添加标记即可在设置页面显示
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `programmatic` TR-1.1: implemented_settings() 中包含 import.firstRowAsHeader 和 import.skipEmptyRows
  - `programmatic` TR-1.2: cargo check 通过
- **Notes**: 最简单的任务，先做这个快速验证动态渲染机制

## [x] Task 2: 编辑器设置接入 - 基础项（3 项）
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 接入 `editor.showLineNumbers` - 控制行号显示
  - 接入 `editor.highlightLine` - 控制当前行高亮
  - 接入 `editor.bracketMatching` - 控制括号匹配
  - 在 SQLEditor.tsx 中通过 useSetting 读取设置
  - 配置到 CodeMirror 的 extensions 中
  - 在后端添加 is_implemented 标记
- **Acceptance Criteria Addressed**: AC-1, AC-5, AC-6
- **Test Requirements**:
  - `programmatic` TR-2.1: SQLEditor.tsx 中使用 useSetting 读取 3 项设置
  - `programmatic` TR-2.2: CodeMirror extensions 根据设置动态变化
  - `programmatic` TR-2.3: npx tsc 和 cargo check 均通过
  - `human-judgement` TR-2.4: 切换开关后编辑器立即对应变化
- **Notes**: 低难度，CodeMirror 原生支持这些配置

## [x] Task 3: 编辑器设置接入 - 进阶项（3 项）
- **Priority**: high
- **Depends On**: Task 2
- **Description**:
  - 接入 `editor.showMinimap` - 控制小地图显示
  - 接入 `editor.enableCodeFolding` - 控制代码折叠
  - 接入 `editor.useSoftTabs` - 控制软制表符（空格代替 Tab）
  - 在后端添加 is_implemented 标记
  - 确保设置变更后 CodeMirror 正确更新扩展
- **Acceptance Criteria Addressed**: AC-1, AC-5, AC-6
- **Test Requirements**:
  - `programmatic` TR-3.1: SQLEditor.tsx 中使用 useSetting 读取 3 项设置
  - `programmatic` TR-3.2: npx tsc 和 cargo check 均通过
  - `human-judgement` TR-3.3: 小地图可显隐
  - `human-judgement` TR-3.4: 代码折叠可开关
  - `human-judgement` TR-3.5: Tab 键行为可切换
- **Notes**: 中难度，需要确认 CodeMirror 扩展的动态更新方式

## [x] Task 4: SQL 查询设置接入（2-4 项）
- **Priority**: medium
- **Depends On**: None
- **Description**:
  - 接入 `sql.enableHighlighting` - 语法高亮开关（如可行）
  - 接入 `sql.uppercaseKeywords` - 关键字大写（如可行）
  - 评估 `sql.autoComplete` 和 `sql.formatOnSave` 的可行性
  - 对于不可行的项，在 Open Questions 中记录原因
  - 在后端添加已实现项的 is_implemented 标记
- **Acceptance Criteria Addressed**: AC-2, AC-5, AC-6
- **Test Requirements**:
  - `programmatic` TR-4.1: 至少 2 项 SQL 设置接入成功
  - `programmatic` TR-4.2: npx tsc 和 cargo check 均通过
  - `human-judgement` TR-4.3: 功能实际生效
- **Notes**: 需先评估可行性，部分功能可能需要额外依赖

## [x] Task 5: 数据导入设置接入（2 项）
- **Priority**: medium
- **Depends On**: Task 1
- **Description**:
  - 接入 `import.defaultEncoding` - 默认编码
  - 接入 `import.defaultDelimiter` - 默认分隔符
  - 在 DataImport.tsx / DataPreview.tsx 中使用
  - 在后端添加 is_implemented 标记
- **Acceptance Criteria Addressed**: AC-3, AC-5, AC-6
- **Test Requirements**:
  - `programmatic` TR-5.1: 数据导入组件读取 defaultEncoding 和 defaultDelimiter 设置
  - `programmatic` TR-5.2: npx tsc 和 cargo check 均通过
  - `human-judgement` TR-5.3: 修改默认编码/分隔符后导入行为变化
- **Notes**: 需先了解当前数据导入的编码和分隔符是如何处理的

## [x] Task 6: 功能验证与回归测试
- **Priority**: high
- **Depends On**: Task 1, 2, 3, 4, 5
- **Description**:
  - 启动应用验证所有新增设置项正常显示和工作
  - 验证原有 27 项设置不受影响
  - 运行所有安全和规范检测命令
  - 更新设置系统现状分析报告到 v5.0
- **Acceptance Criteria Addressed**: AC-4, AC-6, AC-7
- **Test Requirements**:
  - `programmatic` TR-6.1: cargo check --quiet 通过
  - `programmatic` TR-6.2: npx tsc --noEmit 通过
  - `programmatic` TR-6.3: SQL 注入检测 0 新增
  - `programmatic` TR-6.4: TS any 检测 0 新增
  - `human-judgement` TR-6.5: 设置页面显示 41+ 项已实现设置
  - `human-judgement` TR-6.6: 所有新增设置项功能正常

# Phase 11 设置功能接入深化 — The Implementation Plan

## [x] Task 1: 编辑器设置完善（3 项）
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 在 settings_service.rs 中更新 3 项编辑器设置的元数据（autoIndent、formatOnPaste、bracketPairColorization），标记为 is_implemented = true
  - 在 SQLEditor.tsx 中接入这 3 项设置
  - autoIndent：控制 Monaco Editor 的 autoIndent 选项（'none' | 'keep' | 'brackets' | 'advanced' | 'full'）
  - formatOnPaste：控制粘贴时是否自动格式化（Monaco 的 formatOnPaste 选项）
  - bracketPairColorization：控制括号对着色（Monaco 的 bracketPairColorization.enabled 选项）
  - 注意：编辑器使用的是 @monaco-editor/react，不是 CodeMirror
- **Acceptance Criteria Addressed**: AC-1, AC-6, AC-7
- **Test Requirements**:
  - `programmatic` TR-1.1: cargo check 无错误
  - `programmatic` TR-1.2: npx tsc 无错误
  - `programmatic` TR-1.3: settings_meta 返回中 3 项编辑器设置的 is_implemented 为 true
  - `human-judgement` TR-1.4: 打开设置界面，编辑器分类下 3 项设置都显示，且为正确的控件类型
  - `human-judgement` TR-1.5: 修改 autoIndent 后，编辑器自动缩进行为改变
  - `human-judgement` TR-1.6: 修改 bracketPairColorization 后，括号对着色行为改变
- **Notes**: formatOnPaste 如果当前没有粘贴格式化逻辑，先接入设置项，功能可分阶段完善

## [x] Task 2: SQL 查询设置完善（3 项）
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 在 settings_service.rs 中更新 3 项 SQL 查询设置的元数据（formatOnSave、autoExecute、defaultSelectLimit），标记为 is_implemented = true
  - 在 SQLEditor 或相关模块中接入
  - formatOnSave：保存时自动格式化 SQL（与编辑器的区分开，SQL 特有）
  - autoExecute：输入分号后自动执行查询
  - defaultSelectLimit：SELECT 默认限制行数
- **Acceptance Criteria Addressed**: AC-2, AC-6, AC-7
- **Test Requirements**:
  - `programmatic` TR-2.1: cargo check 无错误
  - `programmatic` TR-2.2: npx tsc 无错误
  - `programmatic` TR-2.3: settings_meta 返回中 3 项 SQL 查询设置的 is_implemented 为 true
  - `human-judgement` TR-2.4: 打开设置界面，SQL 查询分类下新增 3 项设置都显示
  - `human-judgement` TR-2.5: 修改 defaultSelectLimit 后，SELECT 查询默认带 LIMIT
  - `human-judgement` TR-2.6: 开启 autoExecute 后，输入分号自动执行
- **Notes**: formatOnSave 如果保存逻辑不在 SQLEditor 中，先接入设置项，功能在保存处实现

## [x] Task 3: 数据导入设置完善（2 项）
- **Priority**: medium
- **Depends On**: None
- **Description**:
  - 在 settings_service.rs 中更新 2 项数据导入设置的元数据（importBatchSize、maxImportFileSize），标记为 is_implemented = true
  - 在数据导入服务/流程中接入
  - importBatchSize：批量导入行数
  - maxImportFileSize：最大导入文件大小（MB）
- **Acceptance Criteria Addressed**: AC-3, AC-6, AC-7
- **Test Requirements**:
  - `programmatic` TR-3.1: cargo check 无错误
  - `programmatic` TR-3.2: npx tsc 无错误
  - `programmatic` TR-3.3: settings_meta 返回中 2 项数据导入设置的 is_implemented 为 true
  - `human-judgement` TR-3.4: 打开设置界面，数据导入分类下 6 项设置都显示
  - `human-judgement` TR-3.5: 修改 importBatchSize 后，批量导入行数受限制
  - `human-judgement` TR-3.6: 修改 maxImportFileSize 后，最大导入文件大小受限制
- **Notes**: 这两项都是 number 类型，已有 min/max/step 配置，可显示为滑块

## [x] Task 4: 高级设置首批接入（3 项）
- **Priority**: medium
- **Depends On**: None
- **Description**:
  - 在 settings_service.rs 中新增/更新 3 项高级设置的元数据（developerMode、logLevel、showDebugInfo），标记为 is_implemented = true
  - developerMode：开发者模式开关，开启后显示调试工具入口
  - logLevel：控制 Rust 后端日志级别（error/warn/info/debug/trace）
  - showDebugInfo：显示 FPS、内存等调试信息
- **Acceptance Criteria Addressed**: AC-4, AC-6, AC-7
- **Test Requirements**:
  - `programmatic` TR-4.1: cargo check 无错误
  - `programmatic` TR-4.2: npx tsc 无错误
  - `programmatic` TR-4.3: settings_meta 返回中 3 项高级设置的 is_implemented 为 true
  - `human-judgement` TR-4.4: 打开设置界面，高级分类下 3 项设置都显示
  - `human-judgement` TR-4.5: 修改 logLevel 后，后端日志输出级别改变
  - `human-judgement` TR-4.6: 开启 developerMode 后，界面显示更多调试信息
- **Notes**: logLevel 是 select 类型，需要配置 options

## [x] Task 5: 缓存设置完善（1 项）
- **Priority**: low
- **Depends On**: None
- **Description**:
  - 在 settings_service.rs 中更新 cacheStrategy 设置的元数据，标记为 is_implemented = true
  - 在缓存服务中接入策略切换
  - 支持 memory / lru / fifo 三种策略
  - 切换策略时清空旧缓存并提示用户确认
- **Acceptance Criteria Addressed**: AC-5, AC-6, AC-7
- **Test Requirements**:
  - `programmatic` TR-5.1: cargo check 无错误
  - `programmatic` TR-5.2: npx tsc 无错误
  - `programmatic` TR-5.3: settings_meta 返回中 cacheStrategy 的 is_implemented 为 true
  - `human-judgement` TR-5.4: 打开设置界面，缓存分类下 cacheStrategy 设置显示
  - `human-judgement` TR-5.5: 切换缓存策略时有确认提示，确认后切换成功
- **Notes**: 切换策略可能导致缓存数据丢失，需要用户确认

## [x] Task 6: 测试验证与文档更新
- **Priority**: medium
- **Depends On**: Task 1, Task 2, Task 3, Task 4, Task 5
- **Description**:
  - 启动应用验证所有新增设置项的显示和效果
  - 更新设置系统现状分析报告.md
  - 更新相关文档
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-3, AC-4, AC-5
- **Test Requirements**:
  - `human-judgement` TR-6.1: 所有 12 项设置在设置界面正确显示
  - `human-judgement` TR-6.2: 设置修改后立即生效
  - `human-judgement` TR-6.3: 设置系统现状分析报告已更新到 v10.0
- **Notes**: 启动应用进行完整验证

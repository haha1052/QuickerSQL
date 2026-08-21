# Phase 11 设置功能接入深化 — Product Requirement Document

## Overview
- **Summary**: 继续扩展高优先级设置项接入，将生效比例从 56.4% 提升到 67.3%，重点覆盖编辑器完善、SQL 查询完善、数据导入完善、高级设置首批接入、缓存设置完善五大任务。
- **Purpose**: 提升设置系统的完整性和用户体验，让更多设置项真正发挥作用，减少"有设置但不生效"的情况。
- **Target Users**: QuickerSQL 所有用户，特别是高频使用 SQL 编辑器和数据导入的用户

## Goals
- 生效设置项从 62 项增加到 74 项（+12 项）
- 总生效率从 56.4% 提升到 67.3%
- 编辑器生效率从 75% 提升到 100%
- SQL 查询生效率从 60% 提升到 90%
- 数据导入生效率从 66.7% 提升到 100%
- 高级设置生效率从 0% 提升到 37.5%
- 缓存生效率从 75% 提升到 100%

## Non-Goals (Out of Scope)
- 不做快捷键设置（20 项，复杂度高，后续 Phase 处理）
- 不做安全设置高级功能（密码保护、加密等，风险高，后续 Phase 处理）
- 不做自动化任务剩余设置（并行任务限制、通知，依赖自动化模块完善）
- 不做数据库连接池设置（依赖连接池模块实现）
- 不做外观剩余设置（小地图、平滑滚动，依赖编辑器组件完善）
- 不做自动执行/保存格式化等依赖完整 SQL 格式化引擎的功能（分阶段实现）

## Background & Context
- 当前共有 110 项设置，62 项已生效，生效率 56.4%
- Phase 6 建立了元数据驱动的动态渲染架构，新增设置项接入成本低
- Phase 7-9 已完成编辑器、SQL、可视化、数据库、性能等核心分类的大部分接入
- Phase 10 完成了 UI 控件升级（布尔值下拉、数值滑块）
- Phase 10.5 完成了 UI 精细化优化和 bug 修复
- 当前剩余未生效设置主要集中在：高级设置(8)、快捷键(20)、编辑器(3)、SQL(4)、数据导入(2)、安全(4)、自动化(2)、外观(2)、缓存(1)、数据库(1)、性能(1)

## Functional Requirements

### FR-1: 编辑器设置完善（3 项）
系统 SHALL 实现编辑器剩余的 3 项设置接入，使编辑器生效率达到 100%。

#### FR-1.1 editor.autoIndent（自动缩进）
- 控制 CodeMirror 的 `indentOnInput` 选项
- 开启时，换行后自动缩进对齐
- 默认值：true

#### FR-1.2 editor.formatOnSave（保存时格式化）
- 保存 SQL 文件时自动触发格式化
- 依赖 SQL 格式化功能
- 默认值：false

#### FR-1.3 editor.enableSnippets（启用代码片段）
- 控制 SQL 代码片段提示的启用/禁用
- 依赖 CodeMirror snippets 扩展
- 默认值：true

### FR-2: SQL 查询设置完善（3 项）
系统 SHALL 实现 SQL 查询剩余的 3 项设置接入，使 SQL 查询生效率达到 90%。

#### FR-2.1 sql.formatOnSave（保存时格式化）
- 保存 SQL 查询时自动格式化
- 与 editor.formatOnSave 区分（一个是编辑器通用，一个是 SQL 特有）
- 默认值：false

#### FR-2.2 sql.enableSuggestion（启用建议）
- 控制 SQL 自动补全建议的显示/隐藏
- 默认值：true

#### FR-2.3 sql.enableValidation（启用验证）
- 控制 SQL 语法校验的启用/禁用
- 关闭后不显示语法错误提示
- 默认值：true

### FR-3: 数据导入设置完善（2 项）
系统 SHALL 实现数据导入剩余的 2 项设置接入，使数据导入生效率达到 100%。

#### FR-3.1 import.maxRowsPreview（预览最大行数）
- 限制导入预览时显示的最大行数
- 默认值：100
- 范围：10-1000

#### FR-3.2 import.createBackup（导入前创建备份）
- 导入数据前自动创建原表备份
- 备份表名格式：`原表名_backup_时间戳`
- 默认值：true

### FR-4: 高级设置首批接入（3 项）
系统 SHALL 实现高级设置的首批 3 项接入，使高级生效率达到 37.5%。

#### FR-4.1 advanced.developerMode（开发者模式）
- 开启后显示更多调试信息和开发工具入口
- 默认值：false

#### FR-4.2 advanced.logLevel（日志级别）
- 控制 Rust 后端日志输出级别
- 选项：error、warn、info、debug、trace
- 默认值：info

#### FR-4.3 advanced.showDebugInfo（显示调试信息）
- 在界面角落显示 FPS、内存等调试信息
- 仅在开发者模式下可用（或独立开关）
- 默认值：false

### FR-5: 缓存设置完善（1 项）
系统 SHALL 实现缓存剩余的 1 项设置接入，使缓存生效率达到 100%。

#### FR-5.1 cache.cacheStrategy（缓存策略）
- 支持不同的缓存策略切换
- 选项：memory（内存缓存）、lru（LRU 淘汰）、fifo（FIFO 淘汰）
- 默认值：memory
- 切换时清空旧缓存并提示用户

## Non-Functional Requirements

### NFR-1: 设置变更实时生效
- 所有新增设置项变更后，相关组件应立即响应生效
- 不需要重启应用

### NFR-2: 向后兼容
- 新增设置项不影响现有功能
- 老用户升级后使用默认值

### NFR-3: 性能影响可忽略
- 设置读取和应用不造成明显性能下降
- 设置变更操作 < 50ms

## Constraints
- **技术**: React + TypeScript 前端，Rust 后端，Tauri 框架
- **业务**: 遵守项目架构分层规则（commands → services → database）
- **安全**: 禁止 SQL 注入，使用参数化查询

## Assumptions
- 编辑器使用 CodeMirror，相关扩展（indentOnInput、snippets）已集成或可集成
- SQL 格式化功能已有基础实现或可快速接入
- 数据导入流程有明确的预览和导入阶段
- 缓存服务已有基础架构，支持策略扩展

## Acceptance Criteria

### AC-1: 编辑器设置全部生效
- **Given**: 用户打开设置界面的编辑器分类
- **When**: 用户修改 autoIndent、formatOnSave、enableSnippets 任一设置
- **Then**: 设置立即保存并生效，编辑器行为对应改变
- **Verification**: `human-judgment`
- **Notes**: 实际操作验证各设置项的效果

### AC-2: SQL 查询设置大部分生效
- **Given**: 用户打开设置界面的 SQL 查询分类
- **When**: 用户修改 enableSuggestion、enableValidation 设置
- **Then**: 设置立即保存并生效，SQL 编辑器行为对应改变
- **Verification**: `human-judgment`
- **Notes**: formatOnSave 依赖格式化功能，分阶段实现

### AC-3: 数据导入设置全部生效
- **Given**: 用户打开设置界面的数据导入分类
- **When**: 用户修改 maxRowsPreview、createBackup 设置
- **Then**: 设置立即保存并生效，导入流程行为对应改变
- **Verification**: `human-judgment`
- **Notes**: 实际导入操作验证

### AC-4: 高级设置首批生效
- **Given**: 用户打开设置界面的高级分类
- **When**: 用户修改 developerMode、logLevel、showDebugInfo 设置
- **Then**: 设置立即保存并生效，系统行为对应改变
- **Verification**: `human-judgment`
- **Notes**: 日志级别需要查看后端日志验证

### AC-5: 缓存设置全部生效
- **Given**: 用户打开设置界面的缓存分类
- **When**: 用户修改 cacheStrategy 设置
- **Then**: 设置保存，缓存策略切换，旧缓存被清空
- **Verification**: `human-judgment`
- **Notes**: 切换时有提示，确认后再执行

### AC-6: 编译通过
- **Given**: 代码修改完成
- **When**: 执行 cargo check 和 npx tsc
- **Then**: 两者都无错误
- **Verification**: `programmatic`

### AC-7: 无安全问题
- **Given**: 代码修改完成
- **When**: 执行 SQL 注入检测和敏感字符串检测
- **Then**: 无新增风险
- **Verification**: `programmatic`

## Open Questions
- [ ] SQL 格式化功能当前实现程度如何？formatOnSave 是否可以直接接入？
- [ ] CodeMirror snippets 扩展是否已集成？enableSnippets 是否可以直接开关？
- [ ] 缓存服务当前支持哪些策略？扩展新策略的成本如何？

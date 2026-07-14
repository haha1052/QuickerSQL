# 设置系统 Phase 7 功能接入 - Product Requirement Document

## Overview
- **Summary**: 利用 Phase 6 建立的动态渲染架构，快速接入 14+ 项高优先级设置项，将设置生效率从 24.5% 提升到 37%+。
- **Purpose**: 充分发挥架构重构的价值，让更多设置项真正生效，提升用户体验。
- **Target Users**: QuickerSQL 用户（SQL 编辑器使用者、数据导入使用者）

## Goals
- G1: 编辑器设置生效率从 25.0% 提升到 75.0%（新增 6 项）
- G2: SQL 查询设置生效率从 30.0% 提升到 70.0%（新增 4 项）
- G3: 数据导入设置生效率从 0% 提升到 66.7%（新增 4 项，其中 2 项已实现待标记）
- G4: 总生效设置项从 27 项提升到 41+ 项
- G5: 所有新增设置项实时生效，无需重启

## Non-Goals (Out of Scope)
- 不实现快捷键设置（20 项，低优先级）
- 不实现安全设置（7 项，高难度）
- 不实现高级设置（8 项，低优先级）
- 不实现可视化设置（8 项，中优先级）
- 不实现自动化任务剩余 2 项
- 不重构 SettingsContext
- 不修改数据库表结构

## Background & Context
Phase 6 已完成设置系统架构重构：
- 后端为唯一数据源，110 个设置项统一定义
- 前端动态渲染，删除了 SETTING_CONFIGS
- 新增设置项只需后端标记 is_implemented + 前端接入功能

当前已生效 27 项（24.5%），其中：
- 外观 6/8（75%）
- 编辑器 3/12（25%）
- SQL 查询 3/10（30%）
- 数据导入 0/6（0%）- 注：firstRowAsHeader、skipEmptyRows 实际已实现但未标记

## Functional Requirements

### FR-1: 编辑器设置接入（6 项）
接入以下编辑器设置到 SQLEditor 的 CodeMirror 配置：

| 设置键 | 类型 | 默认值 | CodeMirror 对应配置 |
|--------|------|--------|-------------------|
| `editor.showLineNumbers` | boolean | true | lineNumbers |
| `editor.highlightLine` | boolean | true | highlightActiveLineGutter + highlightActiveLine |
| `editor.bracketMatching` | boolean | true | bracketMatching |
| `editor.showMinimap` | boolean | false | minimap.enabled |
| `editor.enableCodeFolding` | boolean | true | foldGutter + foldKeymap |
| `editor.useSoftTabs` | boolean | false | indentWithTab + tabSize |

### FR-2: SQL 查询设置接入（4 项）

| 设置键 | 类型 | 默认值 | 实现位置 |
|--------|------|--------|---------|
| `sql.uppercaseKeywords` | boolean | true | SQL 格式化/关键字高亮 |
| `sql.enableHighlighting` | boolean | true | 语法高亮开关 |
| `sql.autoComplete` | boolean | true | 自动补全开关 |
| `sql.formatOnSave` | boolean | false | 保存时自动格式化 |

### FR-3: 数据导入设置接入（4 项）

| 设置键 | 类型 | 默认值 | 状态 |
|--------|------|--------|------|
| `import.firstRowAsHeader` | boolean | true | ✅ 已实现，仅需标记 |
| `import.skipEmptyRows` | boolean | true | ✅ 已实现，仅需标记 |
| `import.defaultEncoding` | select | utf-8 | 待接入 |
| `import.defaultDelimiter` | select | auto | 待接入 |

### FR-4: 后端标记 is_implemented
在 `settings_service.rs` 的 `implemented_settings()` 函数中添加所有新接入项的标记。

### FR-5: 设置变更实时生效
- 所有新增设置变更后立即生效，无需刷新页面
- 通过 `useSetting` hook 的响应式更新实现

## Non-Functional Requirements
- **NFR-1**: 不破坏现有功能，所有 27 个已实现设置项保持正常工作
- **NFR-2**: 设置变更后 500ms 内生效
- **NFR-3**: 类型安全，不使用 any
- **NFR-4**: 遵守架构分层规则
- **NFR-5**: SQL 注入防护，使用参数化查询

## Constraints
- **Technical**: React + Zustand + Tauri + Rust + CodeMirror 6
- **Business**: 向后兼容，不破坏现有设置数据
- **Dependencies**: 依赖现有 SQLEditor、DataImport、useSetting hook

## Assumptions
- CodeMirror 6 支持所有需要的编辑器配置项
- 数据导入组件支持编码和分隔符配置
- useSetting hook 已支持响应式更新
- 设置值以字符串形式存储，使用时解析

## Acceptance Criteria

### AC-1: 编辑器设置生效
- **Given**: 用户打开设置页面 → 编辑器分类
- **When**: 用户修改 showLineNumbers/highlightLine/bracketMatching/showMinimap/enableCodeFolding/useSoftTabs 中任意设置
- **Then**: SQL 编辑器立即对应变化（行号显隐、当前行高亮、括号匹配、小地图显隐、代码折叠、软制表符）
- **Verification**: `human-judgment`

### AC-2: SQL 查询设置生效
- **Given**: 用户打开设置页面 → SQL查询分类
- **When**: 用户修改 uppercaseKeywords/enableHighlighting/autoComplete/formatOnSave 中任意设置
- **Then**: 对应功能立即生效
- **Verification**: `human-judgment`

### AC-3: 数据导入设置生效
- **Given**: 用户打开设置页面 → 数据导入分类
- **When**: 用户修改 firstRowAsHeader/skipEmptyRows/defaultEncoding/defaultDelimiter 中任意设置
- **Then**: 数据导入时使用新的设置值
- **Verification**: `human-judgment`

### AC-4: 设置项数量正确
- **Given**: 设置页面打开
- **When**: 统计所有分类的设置项数量
- **Then**: 总数量为 41+ 项（27 原有 + 14 新增）
- **Verification**: `human-judgment`

### AC-5: 后端 is_implemented 标记正确
- **Given**: 代码库
- **When**: 查看 settings_service.rs 中 implemented_settings()
- **Then**: 包含所有 41+ 项已实现设置
- **Verification**: `programmatic`

### AC-6: 编译通过
- **Given**: 代码修改完成
- **When**: 执行 cargo check 和 npx tsc
- **Then**: 均无错误
- **Verification**: `programmatic`

### AC-7: 无安全问题
- **Given**: 代码修改完成
- **When**: 运行 SQL 注入检测和敏感字符串检测
- **Then**: 均无新增问题
- **Verification**: `programmatic`

## Open Questions
- [ ] sql.formatOnSave 的"保存"指什么场景？当前 SQL 查询没有保存功能
- [ ] sql.autoComplete 是否需要额外的 CodeMirror 扩展？
- [ ] import.defaultEncoding 和 import.defaultDelimiter 是否在导入向导中有 UI 入口？

# 设置系统改进实施方案

## Overview

- **Summary**: 根据设置系统现状分析报告，制定设置系统改进方案，重点解决 SQL 注入风险、隐藏未生效设置项、接入编辑器常用设置等问题。
- **Purpose**: 提升设置系统的安全性、可用性和用户体验，遵循项目安全规范。
- **Target Users**: 所有使用 QuickerSQL 的用户

## Goals

1. 修复 SQL 注入风险（security.md 规范要求）
2. 隐藏未生效的设置项，提升用户体验
3. 接入编辑器常用设置（字体大小、主题、Tab 宽度）
4. 简化设置页面代码，减少前后端重复定义

## Non-Goals (Out of Scope)

- 不实现未定义的设置功能（如密码保护、快捷键自定义等）
- 不修改已生效的设置项逻辑
- 不改变设置的数据模型结构

## Background & Context

根据 2026-06-24 的设置系统现状分析报告：

| 状态 | 数量 | 占比 |
|------|------|------|
| 完全生效 | 6 | 5.5% |
| 部分生效 | 3 | 2.7% |
| 仅定义未生效 | 101 | 91.8% |
| **总计** | **110** | **100%** |

**主要问题：**
1. `settings_service.rs` 中存在 SQL 注入风险（使用 `format!` 拼接 SQL）
2. 90%+ 设置项未生效，但全部展示给用户，造成困惑
3. 前后端设置定义重复，维护成本高

## Functional Requirements

### FR-1: 修复 SQL 注入风险（安全修复）

**描述**: 将 `settings_service.rs` 中 `initialize_default_settings` 函数的 SQL 拼接改为参数化查询。

**变更内容:**
- 将 `format!("SELECT ... WHERE category = '{}' AND key = '{}'", ...)` 改为参数化查询
- 将 `format!("INSERT INTO __settings ...")` 改为参数化查询
- 遵循 security.md 规范（禁止 `format!` 拼接 SQL 文本）

**验证方式:** 执行 SQL 注入检测命令，Count = 0

### FR-2: 隐藏未生效的设置项

**描述**: 在设置页面中只展示已生效的设置项，避免用户困惑。

**变更内容:**
- 在 `SETTING_CONFIGS` 中添加 `isImplemented: true` 标记
- 设置页面只渲染标记为已实现的设置项
- 保持设置数据完整性（数据库中的定义不变）

**需展示的已生效/部分生效设置项:**
- `appearance.theme`（主题）
- `appearance.fontSize`（字体大小）
- `editor.tabSize`（Tab 宽度）
- `editor.wordWrap`（自动换行）
- `editor.autoSave`（自动保存）
- `sql.showExecutionTime`（显示执行时间）
- `sql.maxHistorySize`（历史记录大小）
- `sql.resultLimit`（结果限制）
- `trash.confirmBeforeDelete`（删除确认）
- `database.showSystemTables`（显示系统表）
- `locale.language`（界面语言）
- `automation.engineEnabled`（调度引擎）
- `automation.defaultRetryOnFail`（默认重试次数）
- `automation.defaultTimeoutSecs`（默认超时时间）
- `security.enableAuditLog`（审计日志）
- `cache.enableCache`（启用缓存）

### FR-3: 接入编辑器常用设置

**描述**: 将编辑器相关的设置项接入实际代码，使设置生效。

**变更内容:**
- `appearance.fontSize` → SQL 编辑器组件使用此设置
- `appearance.theme` → 应用主题系统使用此设置
- `editor.tabSize` → SQL 编辑器使用此设置
- `editor.wordWrap` → SQL 编辑器使用此设置

**涉及文件:**
- [SQLEditor.tsx](file:///e:/LA_DUCK/la-duck/src/components/sql/SQLEditor.tsx) - SQL 编辑器组件
- [App.tsx](file:///e:/LA_DUCK/la-duck/src/App.tsx) - 应用主题系统
- [appStore.ts](file:///e:/LA_DUCK/la-duck/src/store/appStore.ts) - 全局状态（主题）

### FR-4: 简化设置页面代码

**描述**: 减少前端 `SETTING_CONFIGS` 与后端 `default_settings()` 的重复定义。

**变更内容:**
- 保留 `SETTING_CONFIGS` 作为 UI 配置（选项标签、输入控件类型等）
- 依赖后端返回的 `options` 字段作为选项数据源
- 添加注释说明哪些设置已实现

## Non-Functional Requirements

- **NFR-1**: 安全性 - 必须修复 SQL 注入风险
- **NFR-2**: 可用性 - 设置页面只展示已生效项
- **NFR-3**: 兼容性 - 现有已生效的设置不受影响

## Constraints

- **Technical**: React + Zustand + Rust/Tauri
- **Dependencies**: 
  - 设置系统现有代码
  - SQLEditor 组件
  - 主题系统
- **Security**: 必须遵循 security.md 规范

## Assumptions

- 设置项的 `is_implemented` 字段暂不添加到数据库，先用前端配置标记
- 编辑器设置通过 CSS 变量或 props 传递，不改编辑器库配置

## Acceptance Criteria

### AC-1: SQL 注入风险修复
- **Given**: 修改 `settings_service.rs` 后
- **When**: 执行 SQL 注入检测命令
- **Then**: `format!` 拼接 SQL 的检测结果 Count = 0
- **Verification**: `programmatic`

### AC-2: 未生效设置项隐藏
- **Given**: 用户打开设置页面
- **When**: 查看设置分类和设置项
- **Then**: 只显示已实现/部分实现的设置项
- **Verification**: `human-judgment`

### AC-3: 编辑器设置生效
- **Given**: 用户修改编辑器相关设置后
- **When**: 重新打开 SQL 编辑器
- **Then**: 编辑器应用新的字体大小、主题等设置
- **Verification**: `human-judgment`

### AC-4: 设置页面正常运行
- **Given**: 修改设置系统后
- **When**: 打开设置页面，切换分类，修改设置
- **Then**: 所有功能正常工作，无报错
- **Verification**: `human-judgment`

### AC-5: TypeScript 编译通过
- **Given**: 修改前端代码后
- **When**: 执行 `npx tsc --noEmit`
- **Then**: 0 errors
- **Verification**: `programmatic`

### AC-6: Rust 编译通过
- **Given**: 修改后端代码后
- **When**: 执行 `cargo check`
- **Then**: 无 error
- **Verification**: `programmatic`

## Open Questions

- [ ] 主题系统是否已实现？（需要确认 `appearance.theme` 设置能否直接接入）
- [ ] SQL 编辑器组件是否支持通过 props 动态设置字体大小？
- [ ] 是否需要在数据库中添加 `is_implemented` 字段？

## 实施范围

### Phase 1: 安全修复（立即）
- 修复 `settings_service.rs` 的 SQL 注入风险

### Phase 2: UI 优化（短期）
- 隐藏未生效的设置项
- 简化设置页面代码

### Phase 3: 功能接入（中期）
- 接入编辑器常用设置
- 接入主题设置
- 接入其他高优先级设置

## 相关文件

| 文件 | 角色 | 阶段 |
|------|------|------|
| [settings_service.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/services/settings_service.rs) | 后端设置服务（SQL 注入修复） | Phase 1 |
| [Settings.tsx](file:///e:/LA_DUCK/la-duck/src/pages/Settings.tsx) | 设置页面（隐藏未生效项） | Phase 2 |
| [SQLEditor.tsx](file:///e:/LA_DUCK/la-duck/src/components/sql/SQLEditor.tsx) | SQL 编辑器（接入设置） | Phase 3 |
| [App.tsx](file:///e:/LA_DUCK/la-duck/src/App.tsx) | 应用入口（主题系统） | Phase 3 |
| [appStore.ts](file:///e:/LA_DUCK/la-duck/src/store/appStore.ts) | 全局状态（主题状态） | Phase 3 |
| [settingsStore.ts](file:///e:/LA_DUCK/la-duck/src/store/settingsStore.ts) | 设置状态 | Phase 2-3 |
| [SettingsContext.tsx](file:///e:/LA_DUCK/la-duck/src/context/SettingsContext.tsx) | 设置上下文 | Phase 3 |

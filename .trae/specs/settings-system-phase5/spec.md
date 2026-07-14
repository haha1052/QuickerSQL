# 设置系统恢复计划 Phase 5 - Product Requirement Document

## Overview
- **Summary**: 实施 Phase 5 设置系统恢复计划，将 SQL 查询设置、回收站设置、数据库设置等功能接入到实际功能中，让已标记为 `isImplemented` 的设置项真正生效。
- **Purpose**: 提升设置系统的实际生效比例，从 20% 提升到更高水平，让用户的设置真正起作用。
- **Target Users**: QuickerSQL 所有用户

## Goals
- G1: SQL 查询设置（resultLimit、maxHistorySize、showExecutionTime）真正接入并生效
- G2: 回收站设置（confirmBeforeDelete）真正接入并生效
- G3: 数据库设置（showSystemTables）真正接入并生效
- G4: 所有 Phase 5 设置项在 SettingsModal 中显示且可正常修改保存

## Non-Goals (Out of Scope)
- 不实现新的设置项（仅让已有的设置项真正生效）
- 不重构设置系统架构
- 不实现快捷键、安全设置、高级设置等低优先级设置
- 不修改后端数据库结构

## Background & Context
当前设置系统有 110 个设置项，仅 22 个（20%）已标记为生效。经过 Phase 1-4 改进后，已完成：
- Phase 1: SQL 注入安全修复 ✅
- Phase 2: UI 优化（isImplemented 标记 + 渲染过滤）✅
- Phase 3: 外观设置接入编辑器 ✅
- Phase 4: 补充缺失标记 + 统一设置入口 ✅

Phase 5 的目标是让更多已标记的设置项真正在功能中生效。

## Functional Requirements

- **FR-1**: SQL 查询结果限制（sql.resultLimit）
  - 查询结果超过限制时自动截断
  - 设置值变化时立即生效，下次查询时应用

- **FR-2**: 查询历史记录大小限制（sql.maxHistorySize）
  - 查询历史记录数量超过限制时自动删除最早的记录
  - 设置值变化时立即应用到历史记录

- **FR-3**: 显示查询执行时间（sql.showExecutionTime）
  - 启用时在查询结果区域显示执行时间
  - 禁用时隐藏执行时间显示

- **FR-4**: 删除前确认（trash.confirmBeforeDelete）
  - 启用时删除表前弹出确认对话框
  - 禁用时直接删除（不推荐，但提供选项）

- **FR-5**: 显示系统表（database.showSystemTables）
  - 启用时在数据库浏览器中显示系统表（__ 开头的表）
  - 禁用时隐藏系统表，只显示用户表

## Non-Functional Requirements
- **NFR-1**: 设置变更立即生效，不需要重启应用
- **NFR-2**: 设置变更通过 SettingsContext / useSetting hook 统一管理
- **NFR-3**: 不引入新的依赖库

## Constraints
- **Technical**: React + Zustand + Tauri，遵循架构分层规则
- **Business**: 不破坏现有功能，向后兼容
- **Dependencies**: 依赖现有 SettingsContext、useSetting hook

## Assumptions
- SettingsContext 和 useSetting hook 已正常工作
- 查询历史在 queryStore 中管理
- 数据库浏览器在 DatabaseExplorer 组件中
- 删除表操作在 DatabaseExplorer 的右键菜单中

## Acceptance Criteria

### AC-1: SQL 查询结果限制
- **Given**: 用户在设置中修改了 resultLimit 值
- **When**: 用户执行 SQL 查询
- **Then**: 查询结果不超过 resultLimit 设置的条数
- **Verification**: `programmatic`
- **Notes**: 在查询结果处验证截断逻辑

### AC-2: 查询历史大小限制
- **Given**: 用户在设置中修改了 maxHistorySize 值
- **When**: 有新的查询历史记录添加
- **Then**: 历史记录总数不超过 maxHistorySize
- **Verification**: `programmatic`
- **Notes**: 在 queryStore 的 addToHistory 中验证

### AC-3: 显示执行时间
- **Given**: 用户在设置中开启了 showExecutionTime
- **When**: 查询完成后
- **Then**: 查询结果区域显示执行时间
- **Verification**: `human-judgment`
- **Notes**: 视觉验证

### AC-4: 删除前确认
- **Given**: 用户在设置中开启了 confirmBeforeDelete
- **When**: 用户在数据库浏览器中删除表
- **Then**: 弹出确认对话框，用户确认后才删除
- **Verification**: `human-judgment`
- **Notes**: 视觉验证

### AC-5: 显示系统表
- **Given**: 用户在设置中关闭了 showSystemTables
- **When**: 查看数据库浏览器
- **Then**: 系统表（__ 开头）不显示
- **Verification**: `human-judgment`
- **Notes**: 视觉验证

### AC-6: 设置项正常显示
- **Given**: 用户打开设置页面
- **When**: 切换到对应分类
- **Then**: 所有 Phase 5 设置项都显示在设置页面中
- **Verification**: `human-judgment`

## Open Questions
- [ ] 是否需要添加"结果已截断"的提示信息？
- [ ] 执行时间显示在什么位置最合适？

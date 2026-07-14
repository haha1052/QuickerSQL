# 设置系统 Phase 6 架构改写 - Product Requirement Document

## Overview
- **Summary**: 重构设置系统架构，建立以后端为唯一数据源的设置系统，解决前后端设置定义重复的问题。
- **Purpose**: 降低维护成本，消除前后端不一致，提升新增设置项的效率。
- **Target Users**: QuickerSQL 开发者和用户

## Goals
- G1: 后端作为设置元数据的唯一数据源
- G2: 前端从后端获取设置元数据，动态渲染设置 UI
- G3: 删除前端重复的 SETTING_CONFIGS 定义
- G4: 保持所有已实现的 27 项设置功能正常工作
- G5: 删除冗余的 pages/Settings.tsx

## Non-Goals (Out of Scope)
- 不实现新的设置项功能（仅重构架构）
- 不修改设置项的默认值
- 不修改后端数据库表结构（复用现有 __settings 表）
- 不实现快捷键、安全等低优先级设置
- 不重构 settingsStore（保持现有状态管理）

## Background & Context
当前设置系统存在以下核心问题：
1. **前后端定义重复**：后端 `settings_service.rs` 定义了 110 项，前端 `SettingsModal.tsx` 又定义了 SETTING_CONFIGS
2. **维护成本高**：新增设置项需要同时改前后端
3. **容易不一致**：默认值、类型、选项等可能前后端不一致

后端已经有完整的设置元数据（category、key、value_type、options、description），前端可以直接使用。

## Functional Requirements

- **FR-1**: 后端新增获取设置元数据的命令
  - 新增 `get_settings_meta` 命令
  - 返回所有设置项的元数据（分类、键、类型、默认值、选项、描述、是否可见、是否系统设置）

- **FR-2**: 前端从后端获取设置元数据
  - 在 settingsStore 中添加元数据状态
  - 应用启动时加载元数据
  - SettingsModal 从元数据动态渲染，不再使用 SETTING_CONFIGS

- **FR-3**: 动态渲染设置 UI
  - 根据 value_type 动态选择渲染组件（boolean/number/select/string）
  - 使用 options 字段渲染 select 选项
  - 使用 description 字段作为标签文字

- **FR-4**: isImplemented 标记机制迁移
  - isImplemented 从前端 SETTING_CONFIGS 移到后端元数据
  - 后端 settings_service.rs 中添加 is_implemented 字段

- **FR-5**: 删除冗余代码
  - 删除 SettingsModal.tsx 中的 SETTING_CONFIGS
  - 删除 pages/Settings.tsx（旧的设置页面）

## Non-Functional Requirements
- **NFR-1**: 不破坏现有功能，所有 27 个已实现设置项保持正常工作
- **NFR-2**: 性能不受影响，设置页面加载时间 < 500ms
- **NFR-3**: 类型安全，不使用 any
- **NFR-4**: 遵守架构分层规则

## Constraints
- **Technical**: React + Zustand + Tauri + Rust
- **Business**: 向后兼容，不破坏现有设置数据
- **Dependencies**: 依赖现有 settings_service、settingsStore、useSetting

## Assumptions
- 后端 __settings 表已有完整的设置项数据
- settingsStore 的 categories 结构可以复用
- useSetting hook 不需要修改
- 所有设置项的 value_type 已经正确定义

## Acceptance Criteria

### AC-1: 后端元数据接口
- **Given**: 应用已启动并连接数据库
- **When**: 前端调用 get_settings_meta 命令
- **Then**: 返回所有 110 个设置项的元数据，包含 category、key、value_type、default_value、options、description、is_visible、is_system、is_implemented
- **Verification**: `programmatic`

### AC-2: 前端动态渲染
- **Given**: 设置元数据已加载
- **When**: 用户打开设置页面
- **Then**: 设置页面根据元数据动态渲染所有 is_implemented 为 true 的设置项
- **Verification**: `human-judgment`

### AC-3: 设置项数量一致
- **Given**: 设置页面打开
- **When**: 统计显示的设置项数量
- **Then**: 显示 27 个已实现的设置项（与之前相同）
- **Verification**: `human-judgment`

### AC-4: 设置功能正常
- **Given**: 设置页面打开
- **When**: 用户修改任意设置项
- **Then**: 设置值正确保存，且对应功能立即生效
- **Verification**: `human-judgment`

### AC-5: 冗余代码已删除
- **Given**: 代码库
- **When**: 搜索 SETTING_CONFIGS
- **Then**: SettingsModal 中不再有 SETTING_CONFIGS 定义
- **Verification**: `programmatic`

### AC-6: 编译通过
- **Given**: 代码修改完成
- **When**: 执行 cargo check 和 npx tsc
- **Then**: 均无错误
- **Verification**: `programmatic`

## Open Questions
- [ ] is_implemented 字段是否需要持久化到数据库？还是只在内存中返回？
- [ ] 是否需要保留前端 SETTING_CONFIGS 作为 fallback？

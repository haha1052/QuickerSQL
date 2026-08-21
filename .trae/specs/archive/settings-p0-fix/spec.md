# 设置系统 P0 修复 — implemented_settings 修正与假功能标记

## Overview
- **Summary**: 修正 `implemented_settings()` 函数，只保留真正生效的 75 项设置；在设置 UI 中为未实现的设置项添加"开发中"标记。
- **Purpose**: 解决"假功能"问题，避免用户看到设置项以为能用但实际无效，提升用户信任度。
- **Target Users**: 所有 QuickerSQL 用户

## Goals
- G1: `implemented_settings()` 只包含真正生效的 75 项设置（与 v19 报告一致）
- G2: 未实现的设置项在 UI 中明确标注"开发中"或禁用，避免误导用户
- G3: 设置系统生效率数据准确，可验证

## Non-Goals (Out of Scope)
- 不实现新的设置功能（只修正标记和 UI 展示）
- 不重构设置系统架构
- 不修改设置项的默认值

## Background & Context
当前 `implemented_settings()` 函数中标记了 111 项设置为"已实现"，但根据 v19 报告的代码核查，实际只有 75 项真正生效。这导致：
1. 设置 API 返回的元数据不准确
2. 用户看到很多"假功能"设置项，改了没效果
3. 统计数据失真

下一步行动计划中的 P0 任务：
- 修正 `implemented_settings()` — 只标记真正生效的 55→75 项
- 删除或标记"假功能"设置项 — 未实现的不在 UI 中显示，或明确标注"开发中"

## Functional Requirements

### FR-1: 修正 implemented_settings 函数
系统 SHALL 在 `settings_service.rs` 的 `implemented_settings()` 函数中，只保留代码中确认真正生效的设置项。

#### Scenario: 查询已实现设置
- **WHEN** 前端调用 `get_settings_metadata`
- **THEN** 返回的元数据中，`is_implemented` 字段准确反映实际实现状态
- **Verification**: `programmatic`

### FR-2: 未实现设置项 UI 标记
系统 SHALL 在设置弹窗中，为未实现的设置项添加"开发中"标记，或将其禁用/灰化。

#### Scenario: 查看未实现设置
- **WHEN** 用户打开设置窗口
- **THEN** 未实现的设置项有明确的"开发中"或"即将推出"标识
- **Verification**: `human-judgment`

### FR-3: 分类维度保持一致
系统 SHALL 确保 14 个设置分类的元数据完整，未实现的项也保留在分类中（但标记为未实现）。

#### Scenario: 浏览所有分类
- **WHEN** 用户切换设置分类
- **THEN** 所有 14 个分类都可见，未实现项有明确标识
- **Verification**: `human-judgment`

## Non-Functional Requirements
- **NFR-1**: 编译验证必须通过（cargo check + tsc）
- **NFR-2**: 不影响已实现设置项的正常使用
- **NFR-3**: 保持代码风格与现有项目一致

## Constraints
- **Technical**: 基于现有的 settings_service.rs 和 SettingsModal.tsx
- **Business**: 不删除任何设置项，只标记状态
- **Dependencies**: 无

## Assumptions
- v19 报告中的 75 项已实现统计是准确的
- 未实现的 36 项（13 部分实现 + 23 未实现）需要标记
- UI 上保留所有设置项可见，但明确标记状态

## Acceptance Criteria

### AC-1: implemented_settings 数量准确
- **Given**: 运行 cargo test 或代码核查
- **When**: 统计 `implemented_settings()` 中的 `set.insert` 数量
- **Then**: 数量为 75（与 v19 报告的"已实现"数量一致）
- **Verification**: `programmatic`

### AC-2: 已实现设置项正确
- **Given**: 已实现的 75 项设置
- **When**: 逐一核查代码中是否有实际消费者
- **Then**: 每项都能找到对应的消费代码
- **Verification**: `programmatic`

### AC-3: 未实现设置项有 UI 标记
- **Given**: 用户打开设置窗口
- **When**: 浏览各个分类
- **Then**: 未实现的设置项有"开发中"或"即将推出"的明确标识
- **Verification**: `human-judgment`

### AC-4: 编译通过
- **Given**: 修改完成后
- **When**: 运行 cargo check 和 npx tsc
- **Then**: 无错误
- **Verification**: `programmatic`

### AC-5: 文档同步更新
- **Given**: 代码修改完成后
- **When**: 更新设置系统现状分析报告
- **Then**: 报告中的统计数据与实际代码一致
- **Verification**: `human-judgment`

## Open Questions
- [ ] Q1: 未实现的设置项是完全隐藏，还是显示但标记"开发中"？（建议：显示但标记，透明度低一些）
- [ ] Q2: `is_visible` 字段是否需要用来控制显示/隐藏？

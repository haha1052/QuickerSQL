# 设置系统现状重新梳理 - Product Requirement Document

## Overview
- **Summary**: 重新全面梳理设置系统的真实生效状态，修正 `implemented_settings()` 函数中的错误标记，更新设置系统现状分析报告，让用户看到准确的设置系统状态。
- **Purpose**: 解决 `implemented_settings()` 将所有 111 项设置都标记为"已实现"的误导性问题，如实反映设置系统的真实完成度。
- **Target Users**: QuickerSQL 用户和开发者

## Goals
- G1：修正 `implemented_settings()` 函数，只标记真正有功能实现的设置项
- G2：全面梳理所有 111 个设置项的真实状态（已实现/部分实现/未实现）
- G3：更新设置系统现状分析报告，提供准确的统计数据
- G4：分析快捷键设置的实施难度，给出实施建议

## Non-Goals (Out of Scope)
- ❌ 不实际实现任何新的设置功能（只是梳理现状）
- ❌ 不修改设置 UI 布局
- ❌ 不实现快捷键功能（仅分析难度和给出方案）

## Background & Context
- 之前的分析报告显示设置系统生效率约 82.5%，但这是基于 `implemented_settings()` 的错误标记
- 经过代码审计，真实生效率只有约 49.5%（55/111 项真正有功能）
- 快捷键分类 20 项全部只有 UI 没有功能，是最大的"假功能"区域
- `implemented_settings()` 函数直接遍历 `default_settings()` 全部标记为已实现，失去了筛选意义

## Functional Requirements

### FR-1: 修正 implemented_settings() 函数
- **描述**: 将 `implemented_settings()` 改为只包含真正有功能实现的设置项
- **实现位置**: `src-tauri/src/services/settings_service.rs`
- **判断标准**: 设置值的变化确实会影响应用行为

### FR-2: 更新设置系统现状分析报告
- **描述**: 基于真实状态重新撰写分析报告
- **实现位置**: `docs/设置系统现状分析报告.md`
- **内容要求**:
  - 准确的统计数据（已实现/部分实现/未实现数量）
  - 各分类详细分析
  - 重点问题清单
  - 优先级建议

### FR-3: 快捷键设置实施难度分析
- **描述**: 分析 20 个快捷键设置的实施难度和技术方案
- **内容要求**:
  - 技术方案选型
  - 工作量估算
  - 风险点分析
  - 分阶段实施建议

## Non-Functional Requirements
- **NFR-1**: 准确性：所有设置项的状态判断必须基于代码实际使用情况
- **NFR-2**: 透明度：如实报告问题，不隐瞒未实现的功能
- **NFR-3**: 可验证：状态判断有明确的代码引用支持

## Constraints
- **技术**: 不修改任何功能代码，只修正标记和文档
- **业务**: 保持向后兼容，不破坏现有功能
- **依赖**: 需要全面了解代码库中设置项的使用情况

## Assumptions
- "已实现"的定义：设置值的变化确实会影响应用行为
- "部分实现"的定义：有部分逻辑但不完整（如键名错误、只读不用、只有 Context 没有消费者）
- "未实现"的定义：UI 上能改但改了没有效果

## Acceptance Criteria

### AC-1: implemented_settings() 修正完成
- **Given**: 开发者查看 settings_service.rs
- **When**: 检查 implemented_settings() 函数
- **Then**: 只包含真正有功能实现的设置项
- **Verification**: `programmatic`

### AC-2: 设置系统现状分析报告更新完成
- **Given**: 用户查看分析报告
- **When**: 对比代码真实状态
- **Then**: 统计数据准确，各分类状态与代码一致
- **Verification**: `human-judgment`

### AC-3: 快捷键设置实施分析完成
- **Given**: 开发者查看分析报告
- **When**: 阅读快捷键章节
- **Then**: 有明确的技术方案、工作量估算、风险分析和分阶段建议
- **Verification**: `human-judgment`

### AC-4: 编译和类型检查通过
- **Given**: 代码修改完成
- **When**: 执行 cargo check 和 npx tsc
- **Then**: 全部通过
- **Verification**: `programmatic`

## Open Questions
- [ ] 快捷键设置是先隐藏未实现的，还是保留 UI 显示"开发中"标记？
- [ ] 部分实现的设置项是否应该在 UI 中隐藏？

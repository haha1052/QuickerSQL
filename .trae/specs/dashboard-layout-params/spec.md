# 仪表盘参数系统梳理与修复 - Product Requirement Document

## Overview
- **Summary**: 梳理当前仪表盘的参数系统，修复画布高度不一致、内边距与图表间距混淆、图表随画布扩张等问题，统一参数管理，提升用户体验。
- **Purpose**: 解决用户反馈的多个布局参数相关问题，让仪表盘的尺寸和间距控制更直观、更可控。
- **Target Users**: 所有使用仪表盘布局和背景设置的用户

## Goals
- G1: 修复画布高度与设定不一致的问题（画布高度应该是固定高度，而不是最小高度）
- G2: 明确区分"画布内边距"和"图表间距"两个概念，避免用户混淆
- G3: 统一管理布局相关参数，将 gap（图表间距）、rowHeight（行高）也持久化到数据库
- G4: 图表尺寸保持网格相对单位，但提供固定画布尺寸时图表不随之外部容器变化的能力

## Non-Goals (Out of Scope)
- 不改变图表的网格布局系统（仍使用 12 列网格）
- 不增加自由布局（绝对定位）功能
- 不改变图表的拖拽和缩放交互方式

## Background & Context
### 当前参数体系现状
1. **布局设置弹窗**（📐 布局按钮）：
   - 图表间距 (gap)：0-32px，默认 16px
   - 行高 (rowHeight)：40-160px，默认 80px
   - 磁吸对齐 (snapToGrid)：布尔值，默认 true
   - ❌ 不持久化，仅存在组件本地状态

2. **背景设置弹窗**（🎨 背景按钮）：
   - 背景颜色 (backgroundColor)
   - 背景图片 (backgroundImage)
   - 内边距 (padding)：0-48px，默认 16px
   - 画布宽度 (canvasWidth)：0=自适应
   - 画布高度 (canvasHeight)：0=自适应
   - ✅ 持久化到 __dashboards 表

### 用户反馈的问题
1. 画布实际高度和设定不一致：canvasHeight 只设置了 minHeight，内容超过会扩张
2. 内边距设为 0 但图表间距还是不为 0：用户混淆了 padding 和 gap
3. 扩张画布时图表也跟着扩张：图表尺寸是网格相对单位，画布变宽图表也变宽

## Functional Requirements
- **FR-1**: 画布高度支持"固定高度"模式（设置 canvasHeight > 0 时，画布高度固定，内容超出时滚动）
- **FR-2**: 将 gap（图表间距）、rowHeight（行高）、snapToGrid（磁吸对齐）持久化到数据库，随仪表盘保存
- **FR-3**: 将"布局设置"和"背景设置"整合为一个统一的"画布设置"弹窗，避免参数分散
- **FR-4**: 明确标注"画布内边距"和"图表间距"的区别，使用户不再混淆

## Non-Functional Requirements
- **NFR-1**: 向后兼容 — 旧仪表盘数据能正常读取，缺失的字段使用默认值
- **NFR-2**: 不破坏现有布局数据 — 图表的 x/y/width/height 网格单位保持不变

## Constraints
- **Technical**: 必须遵循 architecture.md 分层架构约束
- **Technical**: 数据库迁移必须有降级处理（默认值）
- **Business**: 不能破坏用户已有的仪表盘布局数据

## Assumptions
- 用户希望画布高度固定时，内容超出应该滚动，而不是自动扩张
- 用户混淆了 padding（画布内边距）和 gap（图表间距），需要统一在一个地方设置
- 图表使用网格相对单位是合理的，需要修复的是画布尺寸的控制方式

## Acceptance Criteria

### AC-1: 画布高度固定时不自动扩张
- **Given**: 用户设置了画布高度（如 800px）
- **When**: 图表内容总高度超过 800px
- **Then**: 画布高度保持 800px，内容超出时出现滚动条
- **Verification**: `human-judgment`

### AC-2: 图表间距随仪表盘持久化
- **Given**: 用户修改了图表间距为 8px
- **When**: 用户刷新页面或重新打开仪表盘
- **Then**: 图表间距保持为 8px
- **Verification**: `human-judgment`

### AC-3: 行高随仪表盘持久化
- **Given**: 用户修改了行高为 100px
- **When**: 用户刷新页面或重新打开仪表盘
- **Then**: 行高保持为 100px
- **Verification**: `human-judgment`

### AC-4: 统一的画布设置弹窗
- **Given**: 用户点击设置按钮
- **When**: 弹窗打开
- **Then**: 可以在同一个弹窗中设置背景、内边距、图表间距、行高、画布尺寸
- **Verification**: `human-judgment`

### AC-5: 旧数据向后兼容
- **Given**: 旧版本创建的仪表盘（没有 gap/rowHeight 等字段）
- **When**: 打开该仪表盘
- **Then**: 使用默认值（gap=16, rowHeight=80），布局显示正常
- **Verification**: `human-judgment`

### AC-6: 编译通过
- **Given**: 代码修改完成
- **When**: 运行 cargo check 和 tsc
- **Then**: 无编译错误
- **Verification**: `programmatic`

## Open Questions
- [ ] 图表宽度是否应该支持固定像素尺寸（不随网格变化）？还是保持当前网格相对单位即可？
- [ ] 画布宽度固定时，图表尺寸是否按比例缩放，还是保持网格单位对应固定像素？

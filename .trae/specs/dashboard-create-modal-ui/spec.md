# 新建仪表盘弹窗 UI 优化 - Product Requirement Document

## Overview
- **Summary**: 将新建仪表盘的原生浏览器 prompt 弹窗替换为与应用 UI 风格一致的自定义弹窗，并统一优化所有新建仪表盘弹窗的视觉效果。
- **Purpose**: 解决当前新建仪表盘弹窗拥挤、丑陋、与原有 UI 系统不一致的问题，提升用户体验。
- **Target Users**: QuickerSQL 所有使用仪表盘功能的用户。

## Goals
- G1：DashboardPage 空状态的"创建仪表盘"按钮不再使用浏览器原生 prompt()，改为自定义弹窗
- G2：所有新建仪表盘弹窗（DashboardToolbar、DashboardPage、SaveChartModal）风格统一，与应用整体 UI 一致
- G3：弹窗尺寸更宽敞，不拥挤，视觉效果精致

## Non-Goals (Out of Scope)
- ❌ 不修改弹窗的业务逻辑（创建仪表盘的流程不变）
- ❌ 不新增仪表盘字段（仍只有名称）
- ❌ 不重构其他弹窗（如画布设置、保存图表等）

## Background & Context
当前新建仪表盘弹窗存在以下问题：
1. **DashboardPage 空状态页**：使用浏览器原生 `prompt()`，样式丑陋、与应用完全不一致（用户截图所指）
2. **DashboardToolbar 新建弹窗**：虽然是自定义弹窗，但只有 360px 宽，比较拥挤，没有 header/body/footer 分层结构
3. **SaveChartModal 新建仪表盘弹窗**：有 header/body/footer 结构，但可以进一步优化

参考项目中其他弹窗（如 SaveChartModal、项目管理窗口）的风格，统一设计语言：圆角 12px、阴影、header 分隔线、body 内边距 20px、footer 右对齐按钮组。

## Functional Requirements
- **FR-1**：DashboardPage 空状态页的"创建仪表盘"按钮点击后弹出自定义模态框，而非浏览器原生 prompt
- **FR-2**：自定义弹窗包含：标题栏（带关闭按钮）、名称输入框、取消/创建按钮
- **FR-3**：DashboardToolbar 的新建仪表盘弹窗优化样式，与 SaveChartModal 风格对齐
- **FR-4**：所有新建弹窗支持 Enter 键快速创建、Esc 键关闭
- **FR-5**：弹窗打开时输入框自动聚焦

## Non-Functional Requirements
- **NFR-1**：弹窗宽度不小于 420px，避免拥挤感
- **NFR-2**：视觉风格与应用现有弹窗（SaveChartModal 等）保持一致
- **NFR-3**：支持暗黑模式（使用 CSS 变量）

## Constraints
- **Technical**: React + TypeScript + inline styles（项目现有模式）
- **Dependencies**: 不引入新的 UI 库，保持纯 CSS 变量方案

## Assumptions
- 用户希望弹窗风格与 SaveChartModal 保持一致（header + body + footer 三段式）
- 不需要新增字段，仅优化现有 UI

## Acceptance Criteria

### AC-1: DashboardPage 空状态使用自定义弹窗
- **Given**: 用户在没有任何仪表盘的情况下进入仪表盘页
- **When**: 点击"创建仪表盘"按钮
- **Then**: 弹出与应用风格一致的自定义模态框，而非浏览器原生 prompt
- **Verification**: `human-judgment`

### AC-2: 弹窗尺寸宽敞不拥挤
- **Given**: 新建仪表盘弹窗已打开
- **When**: 用户观察弹窗
- **Then**: 弹窗宽度 ≥ 420px，内边距充足，输入框和按钮有足够呼吸空间
- **Verification**: `human-judgment`

### AC-3: 风格与应用 UI 一致
- **Given**: 新建仪表盘弹窗已打开
- **When**: 与应用中其他弹窗（如保存图表）对比
- **Then**: 圆角、阴影、配色、按钮样式、字体大小保持一致
- **Verification**: `human-judgment`

### AC-4: 交互体验完善
- **Given**: 新建仪表盘弹窗已打开且输入框已聚焦
- **When**: 用户按 Enter 键
- **Then**: 触发创建操作（若名称不为空）
- **Verification**: `programmatic`
- **Notes**: 检查代码中是否有 onKeyDown 处理

### AC-5: 关闭方式多样
- **Given**: 新建仪表盘弹窗已打开
- **When**: 用户点击遮罩层、点击关闭按钮、点击取消按钮、按 Esc 键
- **Then**: 弹窗关闭，不创建仪表盘
- **Verification**: `programmatic`
- **Notes**: 检查代码中是否有对应的关闭逻辑

### AC-6: TypeScript 类型检查通过
- **Given**: 代码修改完成
- **When**: 执行 `npx tsc --noEmit --pretty`
- **Then**: 返回 0 errors
- **Verification**: `programmatic`

## Open Questions
- [ ] 无（需求明确）

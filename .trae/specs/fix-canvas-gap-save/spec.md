# 画布间距修改无法保存修复 — Product Requirement Document

## Overview
- **Summary**: 修复画布设置中图表间距（gridGap）、行高（rowHeight）、磁吸对齐（snapToGrid）修改后无法保存的问题
- **Purpose**: 用户在画布设置中修改间距等参数后，点击"应用"按钮，设置应正确保存到数据库并在重新打开设置时显示最新值
- **Target Users**: 仪表盘用户

## Goals
- G1: 修复 `gridGap` 值为 0 时无法保存的问题
- G2: 修复 `rowHeight` 值为 0 时无法保存的问题  
- G3: 修复 `snapToGrid` 值为 false 时无法保存的问题
- G4: 确保修改后的设置在重新打开画布设置时正确显示

## Non-Goals (Out of Scope)
- ❌ 不修改数据库表结构
- ❌ 不修改后端 API 签名
- ❌ 不修改其他画布设置字段（背景色、内边距等已正常工作）

## Background & Context
- 前端 `tauriService.updateDashboard` 函数中，`gridGap`、`rowHeight`、`snapToGrid` 字段直接传递给 Tauri invoke
- 在 JavaScript 中，`0` 和 `false` 是 falsy 值，Tauri invoke 会将它们转换为 `null`
- 后端 command 参数类型为 `Option<i64>` 和 `Option<bool>`，收到 `null` 时视为 `None`，因此不会执行 UPDATE
- 其他字段如 `padding` 在 `DashboardToolbar.tsx` 中使用了 `|| undefined` 处理，所以能正常工作

## Functional Requirements
- **FR-1**: 修改 `tauriService.updateDashboard` 函数，确保 `gridGap`、`rowHeight` 为 0 时能正确传递
- **FR-2**: 修改 `tauriService.updateDashboard` 函数，确保 `snapToGrid` 为 false 时能正确传递

## Non-Functional Requirements
- **NFR-1**: 不引入新的技术债务，保持代码风格一致
- **NFR-2**: 修复后不影响其他功能的正常运行

## Constraints
- **Technical**: 前端使用 TypeScript + Tauri，后端使用 Rust
- **Dependencies**: Tauri invoke 对 falsy 值的处理方式

## Assumptions
- [ ] 后端 API 已经正确处理 `Option<i64>` 和 `Option<bool>` 参数
- [ ] 数据库表结构已包含 `grid_gap`、`row_height`、`snap_to_grid` 字段

## Acceptance Criteria

### AC-1: gridGap 为 0 时能正确保存
- **Given**: 用户打开画布设置，将图表间距滑块拖到 0
- **When**: 用户点击"应用"按钮，然后重新打开画布设置
- **Then**: 图表间距滑块应显示为 0
- **Verification**: `human-judgment`

### AC-2: rowHeight 为 0 时能正确保存
- **Given**: 用户打开画布设置，将行高输入框改为 0
- **When**: 用户点击"应用"按钮，然后重新打开画布设置
- **Then**: 行高输入框应显示为 0
- **Verification**: `human-judgment`

### AC-3: snapToGrid 为 false 时能正确保存
- **Given**: 用户打开画布设置，取消勾选磁吸对齐
- **When**: 用户点击"应用"按钮，然后重新打开画布设置
- **Then**: 磁吸对齐复选框应显示为未勾选状态
- **Verification**: `human-judgment`

### AC-4: 其他非零值仍能正常保存
- **Given**: 用户打开画布设置，将图表间距改为 20
- **When**: 用户点击"应用"按钮，然后重新打开画布设置
- **Then**: 图表间距滑块应显示为 20
- **Verification**: `human-judgment`

## Open Questions
- [x] 问题原因已确认：前端传递参数时未处理 falsy 值
- [x] 修复方案已确定：使用 `?? undefined` 处理数字字段，使用 `=== undefined` 判断布尔字段

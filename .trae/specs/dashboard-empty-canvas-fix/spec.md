# 仪表盘空状态区域下移 — Product Requirement Document

## Overview
- **Summary**: 仪表盘空状态（暂无图表）区域被顶部工具栏遮挡，需要向下移动以确保完全可见
- **Purpose**: 解决 UI 遮挡问题，提升用户体验
- **Target Users**: 使用仪表盘功能的所有用户

## Goals
- G1: 将仪表盘空状态区域向下移动，确保不被顶部工具栏遮挡
- G2: 修改后验证应用运行正常，空状态区域完全可见

## Non-Goals (Out of Scope)
- ❌ 不修改其他组件的样式
- ❌ 不改变空状态区域的内容和布局结构
- ❌ 不修改仪表盘非空状态的渲染逻辑

## Background & Context
- 当前空状态区域使用 `justifyContent: 'center'` 在整个 canvas 中垂直居中
- 顶部工具栏高度约 48px，过滤器栏约 40px，导致居中区域被遮挡
- 需要添加 `marginTop` 将区域下移

## Functional Requirements
- **FR-1**: 修改 `DashboardCanvas.tsx` 中 `emptyCanvas` 样式，添加 `marginTop` 属性
- **FR-2**: 确保下移后的空状态区域完全可见，包含图标、文字和添加图表按钮

## Non-Functional Requirements
- **NFR-1**: 修改范围控制在单个文件的单个样式定义内
- **NFR-2**: 不影响其他功能模块的正常运行

## Constraints
- **Technical**: React + TypeScript 项目，使用内联样式定义

## Assumptions
- 工具栏和过滤器栏总高度约 100px
- 添加 `marginTop: '100px'` 足以让空状态区域完全可见

## Acceptance Criteria

### AC-1: 空状态区域下移
- **Given**: 仪表盘为空状态，用户打开仪表盘页面
- **When**: 页面渲染完成
- **Then**: 空状态区域（图标、文字、按钮）完全可见，不被顶部工具栏遮挡
- **Verification**: `human-judgment`

### AC-2: 应用编译通过
- **Given**: 修改完成后执行类型检查
- **When**: 运行 `npx tsc --noEmit --pretty`
- **Then**: 0 errors
- **Verification**: `programmatic`

### AC-3: 应用启动正常
- **Given**: 修改完成后启动开发服务器
- **When**: 运行 `npm run tauri dev`
- **Then**: 应用正常启动，无报错
- **Verification**: `programmatic`

## Open Questions
- [ ] 无

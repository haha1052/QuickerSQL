# 关闭卡死与仪表盘显示不一致修复 Spec

## Overview
- **Summary**: 修复两个问题：1) 应用重启后关闭页面卡死；2) 切换到仪表盘页面显示不一致（有时空状态有时有数据）
- **Purpose**: 提升应用稳定性和用户体验，确保页面状态一致性
- **Target Users**: 所有应用用户

## Goals
- 修复应用关闭卡死问题
- 修复仪表盘页面显示不一致问题
- 确保项目切换后仪表盘状态正确

## Non-Goals (Out of Scope)
- 不修改数据库结构
- 不添加新的仪表盘功能
- 不重构整个状态管理系统

## Background & Context

### 问题1：应用关闭卡死
- AppWrapper 中 DuckDB 事件监听的 unlisten 是异步赋值的，组件卸载时可能清理失效
- 启动过渡动画的 rAF 回调没有清理机制
- 项目级 autoSaveTimer 模块级定时器未清理
- 后端 TaskScheduleEngine 的 shutdown 信号从未触发

### 问题2：仪表盘显示不一致
- DashboardPage 有两个 useEffect 可能重复触发加载（启动缓存 + 空列表检测）
- 项目切换时 `loadDashboards()` 只更新 dashboards 数组，**不重置 activeDashboardId**
- activeDashboardId 残留旧项目的 ID，导致 `dashboards.find(d => d.id === activeDashboardId)` 返回 undefined
- 虽然渲染时有 `|| dashboards[0]` 兜底，但状态不一致可能引发其他副作用
- 启动精简数据（layout 为空）与完整数据切换时存在竞态

## Functional Requirements

### FR-1: 修复应用关闭卡死
- 修复 DuckDB 事件监听的清理逻辑（使用 AbortController 或 ref 模式）
- 确保所有定时器、事件监听器在组件卸载时正确清理
- 修复启动过渡动画 rAF 的清理问题

### FR-2: 修复仪表盘显示不一致
- 项目切换时重置 activeDashboardId 为 null
- DashboardPage 加载逻辑统一，避免竞态条件
- 确保从其他页面切换到仪表盘时能正确显示数据

## Acceptance Criteria

### AC-1: 应用正常关闭
- **Given**: 应用正在运行
- **When**: 用户关闭应用窗口
- **Then**: 应用正常退出，无卡死或报错
- **Verification**: `human-judgment`

### AC-2: 重启后关闭正常
- **Given**: 应用重启后正常运行
- **When**: 用户再次关闭应用
- **Then**: 应用正常退出，无卡死
- **Verification**: `human-judgment`

### AC-3: 项目切换后仪表盘正确显示
- **Given**: 用户切换到另一个有仪表盘的项目
- **When**: 用户打开仪表盘页面
- **Then**: 正确显示该项目的仪表盘列表，默认选中第一个
- **Verification**: `human-judgment`

### AC-4: 空项目仪表盘显示空状态
- **Given**: 用户切换到一个没有仪表盘的项目
- **When**: 用户打开仪表盘页面
- **Then**: 显示空状态和创建按钮，无报错
- **Verification**: `human-judgment`

### AC-5: 切换页面仪表盘显示一致
- **Given**: 用户在仪表盘页面看到了数据
- **When**: 用户切换到其他页面再切回仪表盘
- **Then**: 显示的内容与离开时一致
- **Verification**: `human-judgment`

### AC-6: TypeScript 类型检查通过
- **Given**: 代码修改完成
- **When**: 执行 `npx tsc --noEmit --pretty`
- **Then**: 0 errors
- **Verification**: `programmatic`

## Open Questions
- [ ] 关闭卡死是否在特定场景出现（如执行 SQL 时关闭）？
- [ ] 仪表盘显示不一致是否仅在项目切换后出现？

# 仪表盘布局保存失效修复 - Product Requirement Document

## Overview
- **Summary**: 修复仪表盘布局保存后不生效、刷新后丢失的问题。根因是启动缓存（DashboardLite）不含 layout 数据，前端页面直接消费缓存而不加载完整数据，导致用户看到的仪表盘始终是空的。
- **Purpose**: 确保用户创建的仪表盘和图表布局能够持久化保存，刷新页面或切换项目后仍然可见。
- **Target Users**: 所有使用仪表盘功能的用户

## Goals
- G1: 仪表盘页面进入时能正确显示已保存的图表布局
- G2: 保存布局后数据持久化到后端，前端状态同步更新
- G3: 切换项目后重新进入仪表盘页，能加载新项目的仪表盘数据
- G4: 不影响启动性能（DashboardLite 精简缓存仍用于首屏加速）

## Non-Goals (Out of Scope)
- ❌ 不修改后端 DashboardLite 数据结构（保持精简，用于启动性能优化）
- ❌ 不重构仪表盘整体架构
- ❌ 不新增仪表盘功能
- ❌ 不处理数据恢复（用户历史数据丢失问题不在本次修复范围）

## Background & Context
### 问题现象
用户反馈"创建后的仪表盘保存不下来"，点击保存布局后看不到效果，刷新后也没有。

### 根因分析
1. **启动缓存数据不完整**：`get_startup_status` 返回的 `DashboardLite` 是精简结构，不含 `layout`（图表项）字段
2. **前端直接消费缓存**：`DashboardPage` 通过 `setDashboardsFromStartup` 消费启动缓存，`layout` 被设为空数组 `[]`
3. **页面不触发完整加载**：进入仪表盘页后，只要 startupData 有数据，就不调用 `loadDashboards()` 加载完整数据
4. **保存后不刷新**：保存布局成功后，前端没有重新加载该仪表盘的完整数据

### 相关代码
- 后端精简数据：`src-tauri/src/models/dashboard.rs::DashboardLite`（不含 layout）
- 前端缓存设置：`src/store/dashboardStore.ts::setDashboardsFromStartup`（layout 设为 `[]`）
- 页面加载逻辑：`src/components/dashboard/DashboardPage.tsx`（只消费 startup 缓存）
- 保存布局逻辑：`src/components/dashboard/DashboardPage.tsx::handleToggleEdit`（保存后不刷新）

## Functional Requirements
- **FR-1**: 仪表盘页面进入时，若 layout 为空则自动触发完整数据加载（含 layout）
- **FR-2**: 保存布局成功后，重新加载当前仪表盘的完整数据，确保前端状态与后端一致
- **FR-3**: 切换项目后进入仪表盘页，能正确加载新项目的仪表盘数据
- **FR-4**: 启动缓存（DashboardLite）仍保留，用于仪表盘列表快速展示（名称、描述等）

## Non-Functional Requirements
- **NFR-1**: 性能：首次进入仪表盘页的额外加载时间 < 200ms（本地 SQLite 查询）
- **NFR-2**: 兼容：不破坏现有启动优化架构，DashboardLite 仍用于列表展示
- **NFR-3**: 代码质量：遵循现有代码风格，TypeScript 无 any 类型

## Constraints
- **Technical**: React + Zustand + Tauri IPC，前端三层架构约束
- **Business**: 修复范围限定在前端，不修改后端数据结构
- **Dependencies**: 依赖现有 `tauriService.getDashboard()` / `loadDashboards()` 接口

## Assumptions
- 后端 `get_dashboard` / `get_dashboards` 接口返回的完整数据包含 layout（已验证）
- 用户的仪表盘数据已正确保存在后端 `__dashboard_items` 表中
- StartupContext 中的精简数据仅用于加速首屏列表展示

## Acceptance Criteria

### AC-1: 进入仪表盘页能看到已保存的图表
- **Given**: 数据库中存在一个仪表盘，且该仪表盘有 1 个或多个图表项
- **When**: 用户进入仪表盘页面
- **Then**: 页面上能看到所有已保存的图表，布局正确
- **Verification**: `human-judgment`
- **Notes**: 需要在应用中实际操作验证

### AC-2: 保存布局后立即生效
- **Given**: 用户在编辑模式下拖拽调整了图表位置
- **When**: 用户点击"保存布局"并确认
- **Then**: 退出编辑模式后，图表保持新位置不变；刷新页面后仍然保持
- **Verification**: `human-judgment`

### AC-3: 切换项目后仪表盘数据刷新
- **Given**: 项目 A 有仪表盘 X，项目 B 有仪表盘 Y
- **When**: 用户从项目 A 切换到项目 B，然后进入仪表盘页
- **Then**: 显示的是项目 B 的仪表盘 Y，不是项目 A 的仪表盘 X
- **Verification**: `human-judgment`

### AC-4: TypeScript 类型检查通过
- **Given**: 修复完成后的代码
- **When**: 执行 `npx tsc --noEmit --pretty`
- **Then**: 0 errors
- **Verification**: `programmatic`

### AC-5: 前端无 SQL 拼接
- **Given**: 修复完成后的前端代码
- **When**: 执行 SQL 关键字检测
- **Then**: 0 个匹配（SELECT/INSERT/UPDATE/DELETE）
- **Verification**: `programmatic`

## Open Questions
- [ ] 无（根因已明确，修复方案清晰）

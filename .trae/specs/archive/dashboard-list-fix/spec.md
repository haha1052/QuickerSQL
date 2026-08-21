# 仪表盘列表显示修复 - Product Requirement Document

## Overview
- **Summary**: 修复仪表盘页面在项目切换后无法显示已保存仪表盘的问题，实现仪表盘列表的正确加载和展示。
- **Purpose**: 用户创建仪表盘后切换到其他界面再回来，应该能看到已保存的仪表盘列表并可点击进入。
- **Target Users**: 所有使用仪表盘功能的用户

## Goals
- G1: 项目切换后进入仪表盘页面，正确加载并显示当前项目的仪表盘列表
- G2: 仪表盘列表页面显示已保存的仪表盘名称，点击即可进入编辑/查看
- G3: 保留"创建仪表盘"按钮，支持创建新仪表盘

## Non-Goals (Out of Scope)
- ❌ 不修改仪表盘数据结构
- ❌ 不修改后端存储逻辑
- ❌ 不添加仪表盘排序功能

## Background & Context
当前问题：
1. 启动时 `startupData` 包含仪表盘精简数据，DashboardPage 消费这些数据
2. 项目切换时 `handleProjectSwitchRefresh` 清空了 `dashboardStore`
3. 切换后再进入仪表盘页面，`startupData` 仍是旧数据，`dashboardStore` 为空
4. DashboardPage 认为没有仪表盘，显示空状态（"还没有仪表盘"）
5. 但进入后发现原来创建的仪表盘还在（因为后端数据还在）

## Functional Requirements
- **FR-1**: DashboardPage 挂载时检测 dashboards 是否为空，如果为空则调用 loadDashboards 加载数据
- **FR-2**: 项目切换时清空 dashboardStore 后，触发重新加载仪表盘数据（可选优化）
- **FR-3**: 仪表盘列表页面显示已保存的仪表盘名称和描述，点击可进入查看
- **FR-4**: 保留"创建仪表盘"按钮，支持创建新仪表盘

## Non-Functional Requirements
- **NFR-1**: 加载仪表盘列表的时间 < 500ms
- **NFR-2**: 仪表盘列表显示延迟 < 100ms

## Constraints
- **Technical**: 保持现有架构分层，不修改后端 API
- **Dependencies**: 依赖现有的 `tauriService.getDashboards()` 和 `loadDashboards()` 方法

## Assumptions
- 后端 `__dashboards` 表存储的仪表盘数据是正确的
- `tauriService.getDashboards()` API 能正确返回当前项目的仪表盘列表

## Acceptance Criteria

### AC-1: 项目切换后仪表盘列表正确加载
- **Given**: 用户已创建仪表盘并切换到 SQL 查询页面
- **When**: 用户切换项目后再切换回仪表盘页面
- **Then**: 仪表盘页面显示当前项目的仪表盘列表
- **Verification**: `programmatic`

### AC-2: 仪表盘列表页面显示已保存的仪表盘
- **Given**: 用户已创建至少一个仪表盘
- **When**: 用户进入仪表盘页面
- **Then**: 页面显示仪表盘名称列表，点击可进入查看
- **Verification**: `human-judgment`

### AC-3: 创建仪表盘按钮保留
- **Given**: 用户进入仪表盘页面
- **When**: 用户查看仪表盘列表页面
- **Then**: 页面显示"创建仪表盘"按钮
- **Verification**: `human-judgment`

## Open Questions
- [ ] Q1: 是否需要在项目切换时预加载仪表盘数据（优化体验）？

---

# 仪表盘列表显示修复 - Implementation Plan

## [ ] Task 1: 修复 DashboardPage 挂载时自动加载仪表盘数据
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 在 DashboardPage 挂载时检测 `dashboards` 是否为空
  - 如果为空且 startupData 也没有数据，调用 `loadDashboards()` 加载数据
- **Acceptance Criteria Addressed**: AC-1, AC-2
- **Test Requirements**:
  - `programmatic` TR-1.1: DashboardPage 挂载时 dashboards 为空，调用 loadDashboards()
  - `human-judgment` TR-1.2: 项目切换后进入仪表盘页面，能看到仪表盘列表
- **Notes**: 需要检查 startupData 的 dashboards 是否与当前项目匹配

## [ ] Task 2: 优化项目切换时仪表盘数据刷新
- **Priority**: medium
- **Depends On**: Task 1
- **Description**: 
  - 在 `handleProjectSwitchRefresh` 中，清空 dashboardStore 后调用 `loadDashboards()`
  - 或者通过事件机制通知 DashboardPage 重新加载
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-2.1: 项目切换后 dashboardStore 包含新项目的仪表盘数据
- **Notes**: 需要考虑性能，避免不必要的 IPC 调用

## [ ] Task 3: 验证前端编译通过
- **Priority**: high
- **Depends On**: Task 1, Task 2
- **Description**: 运行 `npx tsc --noEmit --pretty` 验证前端代码无类型错误
- **Acceptance Criteria Addressed**: 所有
- **Test Requirements**:
  - `programmatic` TR-3.1: `npx tsc --noEmit --pretty` 返回 0 errors

---

# 仪表盘列表显示修复 - Verification Checklist

- [ ] Checkpoint 1: DashboardPage 挂载时检测 dashboards 为空，调用 loadDashboards()
- [ ] Checkpoint 2: 项目切换后进入仪表盘页面，显示当前项目的仪表盘列表
- [ ] Checkpoint 3: 仪表盘列表页面显示已保存的仪表盘名称，点击可进入查看
- [ ] Checkpoint 4: 保留"创建仪表盘"按钮
- [ ] Checkpoint 5: 前端编译通过（npx tsc --noEmit --pretty）
- [ ] Checkpoint 6: 后端编译通过（cargo check --quiet）
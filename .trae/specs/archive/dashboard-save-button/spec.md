# 仪表盘保存功能优化 - Product Requirement Document

## Overview
- **Summary**: 优化仪表盘的保存机制，增加独立的"保存"按钮，统一保存入口，确保仪表盘数据（布局、画布设置等）能够正确持久化到数据库。
- **Purpose**: 解决当前仪表盘保存入口不直观、保存流程分散的问题，让用户能够清晰地知道如何保存仪表盘，确保数据持久化的可靠性。
- **Target Users**: 所有使用仪表盘功能的用户

## Goals
- G1: 在仪表盘工具栏增加独立的"保存"按钮，点击后立即保存当前仪表盘的所有变更
- G2: 统一保存逻辑，确保布局变更、画布设置变更等都能正确持久化
- G3: 保留编辑模式的保存流程，同时提供非编辑模式下的快速保存入口
- G4: 保存后有明确的视觉反馈（保存中状态、保存成功/失败提示）

## Non-Goals (Out of Scope)
- ❌ 不实现自动保存功能（定时保存）
- ❌ 不实现版本历史/回滚功能
- ❌ 不修改仪表盘数据的数据库表结构
- ❌ 不改变编辑模式下的拖拽交互逻辑

## Background & Context
### 当前保存机制分析
1. **布局保存**：通过"编辑模式 → 退出时确认保存"实现
   - 进入编辑模式 → 拖拽/缩放图表 → 退出编辑模式 → 确认保存
   - 保存逻辑：遍历 `tempLayout`，逐个调用 `updateDashboardItem` 更新 `__dashboard_items` 表

2. **画布设置保存**：通过"⚙️ 画布"弹窗的"应用"按钮保存
   - 调用 `updateDashboard` 更新 `__dashboards` 表

3. **存在的问题**：
   - 保存入口不直观，用户可能不知道需要通过"编辑"按钮来保存布局
   - 没有独立的"保存"按钮，用户习惯的"Ctrl+S"或明显的保存按钮缺失
   - 保存逻辑分散在多处，缺乏统一的保存入口
   - 保存后反馈不明显，用户不确定是否保存成功

### 数据链路现状
```
前端状态 (dashboardStore)
    ↓
  tauriService (IPC 封装)
    ↓
commands/dashboard.rs (命令层)
    ↓
dashboard_service.rs (业务层)
    ↓
SQLite 数据库
  ├── __dashboards 表 (仪表盘基本信息、画布设置)
  └── __dashboard_items 表 (图表项位置/尺寸)
```

## Functional Requirements
- **FR-1**: 仪表盘工具栏增加独立的"💾 保存"按钮
  - 按钮位置：工具栏右侧，"编辑"按钮旁边
  - 按钮状态：正常态、保存中态（显示加载动画）、禁用态（无变更时）
  - 点击后保存当前仪表盘的所有变更

- **FR-2**: 统一的保存逻辑 `saveDashboard(dashboardId)`
  - 保存内容：布局变更、画布设置变更
  - 保存方式：调用后端统一接口，一次性保存所有变更
  - 保存后：刷新当前仪表盘数据，确保前端状态与后端一致

- **FR-3**: 保存状态反馈
  - 保存中：按钮显示"保存中..."，禁用点击
  - 保存成功：短暂显示"已保存"提示（toast 或按钮文字变化）
  - 保存失败：显示错误提示

- **FR-4**: 编辑模式保存流程保留并优化
  - 保留"编辑模式 → 退出时保存"的流程
  - 编辑模式下"保存"按钮同样可用，可随时保存
  - 保存后不退出编辑模式，用户可继续编辑

- **FR-5**: 快捷键支持
  - `Ctrl+S` / `Cmd+S`：保存当前仪表盘

## Non-Functional Requirements
- **NFR-1**: 保存操作响应时间 < 500ms（正常网络/本地数据库场景）
- **NFR-2**: 保存失败时必须有明确的错误提示，不能静默失败
- **NFR-3**: 保存操作必须是原子的，要么全部保存成功，要么全部失败回滚
- **NFR-4**: 遵循现有架构分层约束（commands → services → database）

## Constraints
- **Technical**: 
  - 前端：React + Zustand + TypeScript
  - 后端：Rust + Tauri + SQLite
  - 必须遵循项目架构分层规则
- **Business**: 
  - 不改变现有用户数据结构
  - 向后兼容，不破坏已有仪表盘数据
- **Dependencies**: 
  - 依赖现有的 dashboard_service.rs
  - 依赖现有的 tauriService IPC 封装

## Assumptions
- 假设用户理解"保存"按钮的含义和作用
- 假设当前数据库表结构能够满足保存需求
- 假设现有 `updateDashboard` 和 `updateDashboardItem` 接口工作正常

## Acceptance Criteria

### AC-1: 保存按钮显示
- **Given**: 用户打开仪表盘页面，且有选中的仪表盘
- **When**: 查看工具栏
- **Then**: 工具栏右侧显示"💾 保存"按钮，位于"编辑"按钮旁边
- **Verification**: `human-judgment`

### AC-2: 点击保存按钮触发保存
- **Given**: 用户在仪表盘页面，对仪表盘布局或设置做了修改
- **When**: 用户点击"保存"按钮
- **Then**: 
  1. 按钮变为"保存中..."状态，禁用点击
  2. 所有变更被保存到数据库
  3. 保存完成后按钮恢复正常
  4. 显示保存成功提示
- **Verification**: `human-judgment`

### AC-3: 保存后数据持久化
- **Given**: 用户修改了仪表盘布局并点击保存
- **When**: 用户刷新页面或重启应用后重新进入仪表盘
- **Then**: 仪表盘布局与保存前一致
- **Verification**: `human-judgment`

### AC-4: 编辑模式下也可保存
- **Given**: 用户处于编辑模式，修改了图表布局
- **When**: 用户点击"保存"按钮
- **Then**: 布局被保存，但不退出编辑模式，用户可继续编辑
- **Verification**: `human-judgment`

### AC-5: Ctrl+S 快捷键保存
- **Given**: 用户在仪表盘页面
- **When**: 用户按下 Ctrl+S（或 Cmd+S）
- **Then**: 触发保存操作，与点击保存按钮效果相同
- **Verification**: `human-judgment`

### AC-6: 无变更时保存按钮状态
- **Given**: 用户打开仪表盘，未做任何修改
- **When**: 查看保存按钮
- **Then**: 保存按钮可用但不高亮（或显示为正常态），点击后提示"无需保存"或直接成功
- **Verification**: `human-judgment`

### AC-7: 前后端编译通过
- **Given**: 代码修改完成
- **When**: 执行编译检查
- **Then**: `cargo check` 和 `npx tsc` 均无错误
- **Verification**: `programmatic`

## Open Questions
- [ ] Q1: 是否需要实现"未保存变更"提示（离开页面时提醒）？
- [ ] Q2: 保存成功的提示方式：toast 通知 vs 按钮文字短暂变化？
- [ ] Q3: 是否需要在仪表盘名称旁边显示"已修改"标记（如 * 号）？

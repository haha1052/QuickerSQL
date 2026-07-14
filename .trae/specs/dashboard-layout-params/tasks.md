# 仪表盘参数系统梳理与修复 - 实施计划

## [ ] Task 1: 数据库迁移 — 添加布局参数字段到 __dashboards 表
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 在 `__dashboards` 表中新增字段：`grid_gap`(图表间距, INTEGER, 默认16)、`row_height`(行高, INTEGER, 默认80)、`snap_to_grid`(磁吸对齐, BOOLEAN, 默认true)
  - 在 `initialize_dashboard_tables` 中添加 ALTER TABLE 迁移语句
  - 在 `Dashboard` 模型中添加对应字段
  - 在 `row_to_dashboard_by_name` 中读取新字段
  - 在 `update_dashboard` 中支持更新这些字段
- **Acceptance Criteria Addressed**: AC-2, AC-3, AC-5, AC-6
- **Test Requirements**:
  - `programmatic` TR-1.1: `cargo check --quiet` 通过
  - `programmatic` TR-1.2: 旧数据读取时有默认值
- **Notes**: 遵循 migration 规范，添加默认值确保向后兼容

## [ ] Task 2: 前端 Dashboard 类型和 store 更新
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - 在 `src/types/dashboard.ts` 的 `Dashboard` interface 中添加 `gridGap`、`rowHeight`、`snapToGrid` 字段
  - 在 `dashboardStore` 的 `updateDashboard` 中支持这些新字段
  - 在 `tauriService.updateDashboard` 中支持这些参数
- **Acceptance Criteria Addressed**: AC-2, AC-3, AC-6
- **Test Requirements**:
  - `programmatic` TR-2.1: `npx tsc --noEmit --pretty` 通过
- **Notes**: 字段命名遵循 camelCase 规范

## [ ] Task 3: 修复画布高度问题 — 固定高度时使用 height 而非 minHeight
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 修改 `DashboardCanvas` 组件：当 `canvasHeight > 0` 时，使用 `height` 而非 `minHeight`
  - 内容超出时自动滚动（overflow: auto 已设置）
  - 确保宽度固定时也使用固定宽度
- **Acceptance Criteria Addressed**: AC-1, AC-6
- **Test Requirements**:
  - `programmatic` TR-3.1: `npx tsc --noEmit --pretty` 通过
  - `human-judgement` TR-3.2: 设置画布高度后，画布高度固定，内容超出时滚动
- **Notes**: 保持 0=自适应 的逻辑不变

## [ ] Task 4: 整合布局设置到背景设置弹窗，统一为"画布设置"
- **Priority**: high
- **Depends On**: Task 2, Task 3
- **Description**:
  - 重命名"背景设置"弹窗为"画布设置"
  - 将原"布局设置"中的图表间距、行高、磁吸对齐移至"画布设置"弹窗
  - 删除独立的"布局设置"弹窗（布局按钮）
  - 工具栏中移除"布局"按钮，保留"背景"按钮但改为打开统一弹窗
  - 弹窗内分组显示：背景设置、布局设置、画布尺寸
  - 设置值从 dashboard 对象读取，保存时调用 updateDashboard
- **Acceptance Criteria Addressed**: AC-2, AC-3, AC-4, AC-5
- **Test Requirements**:
  - `programmatic` TR-4.1: `npx tsc --noEmit --pretty` 通过
  - `human-judgement` TR-4.2: 一个弹窗中可以设置所有画布相关参数
- **Notes**: 保持 DashboardCanvas 的 layoutSettings prop 兼容，从 dashboard 字段读取

## [ ] Task 5: DashboardCanvas 从 dashboard 读取布局参数
- **Priority**: high
- **Depends On**: Task 4
- **Description**:
  - 修改 `DashboardCanvas` 组件，优先从 `dashboard.gridGap`、`dashboard.rowHeight` 读取布局参数
  - 如果 dashboard 没有这些字段（旧数据），使用 props 中的 layoutSettings 默认值
  - 确保编辑模式下的拖拽/缩放计算使用正确的 gap 和 rowHeight
- **Acceptance Criteria Addressed**: AC-2, AC-3, AC-5
- **Test Requirements**:
  - `programmatic` TR-5.1: `npx tsc --noEmit --pretty` 通过
  - `human-judgement` TR-5.2: 修改间距/行高后立即生效
- **Notes**: 保持向后兼容

## [ ] Task 6: 编译验证和应用重启
- **Priority**: high
- **Depends On**: Task 1, Task 2, Task 3, Task 4, Task 5
- **Description**:
  - 运行 cargo check 验证 Rust 编译
  - 运行 npx tsc 验证 TS 编译
  - 重启应用验证功能
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6
- **Test Requirements**:
  - `programmatic` TR-6.1: `cargo check --quiet` 通过
  - `programmatic` TR-6.2: `npx tsc --noEmit --pretty` 通过
  - `human-judgement` TR-6.3: 所有功能正常工作
- **Notes**: 完整功能验证

## 实施顺序
1. Task 1（数据库 + 后端模型）
2. Task 2（前端类型 + store）
3. Task 3（画布高度修复）
4. Task 4（整合设置弹窗）
5. Task 5（DashboardCanvas 读取参数）
6. Task 6（验证 + 重启）

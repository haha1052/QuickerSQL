# 仪表盘布局架构重构规范

## Why
当前仪表盘布局存在根本性问题：
1. `styles.item` 的 `height: '100%'` 覆盖了 grid 计算的固定高度
2. Grid 和 Flex 混合布局导致高度计算混乱
3. 图表容器没有正确获取到网格分配的尺寸
4. 仪表盘尺寸固定，图表不能自适应大小

## What Changes
- 重构 DashboardItem 的布局：移除 `height: '100%'`，使用 CSS Grid 自动拉伸
- 使用 `align-self: stretch` 让网格项自动填满网格单元格
- 简化 DashboardItem 的样式结构，去除不必要的 flex 嵌套
- 图表容器直接响应网格分配的尺寸

## Impact
- Affected specs: 仪表盘功能模块
- Affected code:
  - `src/components/dashboard/DashboardItem.tsx` - 完全重构布局结构
  - `src/components/dashboard/DashboardCanvas.tsx` - 调整 grid 布局参数

## ADDED Requirements

### Requirement: 图表容器正确响应网格尺寸
系统 SHALL 确保图表容器能正确获取并响应网格分配的尺寸：
- 图表卡片的根容器使用 `align-self: stretch` 自动填满网格单元格
- 不使用 `height: '100%'`，避免高度计算冲突
- 内部容器使用 flex column 布局，图表区域使用 `flex: 1`

#### Scenario: 网格尺寸正确传递到图表容器
- **WHEN** 网格单元格高度为 160px（2行 × 80px）
- **THEN** 图表卡片容器高度精确为 160px，图表正确填充

## MODIFIED Requirements

### Requirement: DashboardItem 布局重构
**原设计**: item 有 `height: '100%'`，依赖父容器
**新设计**: item 使用 `align-self: stretch`，依赖 grid 布局

### Requirement: DashboardCanvas Grid 布局优化
**原设计**: `gridTemplateColumns: 'repeat(12, 1fr)'`，`gridAutoRows: '80px'`
**新设计**: 保留 grid 布局，添加 `align-items: stretch` 确保子元素高度一致

## REMOVED Requirements
- 移除 DashboardItem.item 的 `height: '100%'`
- 移除 DashboardItem.itemContainer 的 `height: '100%'`

## Acceptance Criteria

### AC-1: 网格尺寸正确传递
- **Given**: 仪表盘有一个 2×2 的图表
- **When**: 仪表盘渲染完成
- **Then**: 图表卡片高度精确为 160px（2行 × 80px）
- **Verification**: `programmatic` - 检查 DOM 元素的实际高度

### AC-2: 图表自适应容器尺寸
- **Given**: 图表容器有明确的 160px 高度
- **When**: 调整容器大小或窗口大小
- **Then**: 图表自动 resize，填充整个容器
- **Verification**: `human-judgment` - 视觉验证

### AC-3: 拖拽编辑时尺寸正确
- **Given**: 用户在编辑模式下拖拽缩放图表
- **When**: 图表从 2×2 变为 3×2
- **Then**: 图表容器高度保持 160px，宽度增加
- **Verification**: `human-judgment` - 拖拽操作验证

## Open Questions
无

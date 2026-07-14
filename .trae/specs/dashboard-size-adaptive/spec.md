# 仪表盘尺寸自适应与编辑规范

## Why
当前仪表盘存在以下问题：
1. 仪表盘尺寸固定，图表不能自适应容器大小
2. 图表文字和图形相互挤压，显示效果差
3. 缺少容器尺寸变化时的自动 resize 机制
4. 仪表盘画布尺寸无法编辑

## What Changes
- 为每个仪表盘添加自定义画布尺寸设置
- 实现图表容器尺寸变化时的自动 resize
- 优化图表内部布局（标题、图例、坐标轴间距）
- 添加 ResizeObserver 监听容器尺寸变化
- 优化小尺寸图表的文字和图形显示

## Impact
- Affected specs: 仪表盘功能模块
- Affected code:
  - `src/components/dashboard/DashboardItem.tsx` - 图表卡片组件和 ChartCanvas
  - `src/components/dashboard/DashboardCanvas.tsx` - 画布布局
  - `src/components/dashboard/DashboardToolbar.tsx` - 背景设置扩展
  - `src/utils/chartNormalize.ts` - ECharts 配置规范化

## ADDED Requirements

### Requirement: 仪表盘画布尺寸可编辑
系统 SHALL 支持每个仪表盘自定义画布尺寸：
- 画布宽度（支持"自适应"和"固定宽度"两种模式）
- 最小宽度/最大宽度限制
- 画布内边距设置
- 行高设置（影响图表高度）

#### Scenario: 用户自定义画布尺寸
- **WHEN** 用户打开仪表盘背景设置，设置画布宽度为 1200px
- **THEN** 仪表盘画布宽度变为 1200px，超出时显示横向滚动条

### Requirement: 图表尺寸自适应
系统 SHALL 确保图表在容器尺寸变化时自动调整：
- 使用 ResizeObserver 监听容器尺寸变化
- 容器尺寸变化时自动调用 echarts.resize()
- 编辑模式下缩放图表时实时更新图表尺寸
- 切换仪表盘时正确初始化图表尺寸

#### Scenario: 容器尺寸变化时图表自动适配
- **WHEN** 用户调整浏览器窗口大小或缩放图表尺寸
- **THEN** 图表自动 resize，填充整个容器

### Requirement: 小尺寸图表优化
系统 SHALL 优化小尺寸图表的显示效果：
- 小尺寸下图例自动隐藏或简化
- 小尺寸下坐标轴标签自动旋转或隐藏
- 小尺寸下标题字体自动缩小
- 避免文字与图形重叠

#### Scenario: 小尺寸图表正常显示
- **WHEN** 图表宽度小于 300px 或高度小于 200px
- **THEN** 图表自动简化显示，文字和图形不重叠

## MODIFIED Requirements

### Requirement: ChartCanvas 组件增强
**原需求**: ChartCanvas 只渲染图表，监听 window resize
**新需求**: ChartCanvas 增加以下功能：
- 使用 ResizeObserver 监听容器尺寸变化
- 容器尺寸变化时自动调用 resize
- 根据容器尺寸自动优化图表配置（字体大小、图例位置等）

## REMOVED Requirements
无

## Acceptance Criteria

### AC-1: 仪表盘画布尺寸可编辑
- **Given**: 用户打开仪表盘
- **When**: 用户在背景设置中修改画布宽度为 1400px
- **Then**: 仪表盘画布宽度变为 1400px，超出视口时显示滚动条
- **Verification**: `human-judgment` - 截图验证

### AC-2: 图表自适应容器尺寸
- **Given**: 仪表盘包含图表
- **When**: 调整浏览器窗口大小或在编辑模式下缩放图表
- **Then**: 图表自动 resize，正确填充容器
- **Verification**: `human-judgment` - 手动操作验证

### AC-3: 小尺寸图表显示正常
- **Given**: 图表尺寸较小（宽度 < 300px 或高度 < 200px）
- **When**: 图表渲染完成
- **Then**: 图表文字和图形不重叠，显示清晰
- **Verification**: `human-judgment` - 截图验证

### AC-4: 编辑模式下图表实时更新
- **Given**: 用户处于编辑模式
- **When**: 用户拖拽缩放图表尺寸
- **Then**: 图表内容实时更新，不会变形
- **Verification**: `human-judgment` - 手动操作验证

## Open Questions
- [ ] 是否需要支持"响应式"模式（根据容器宽度自动调整图表数量）？
- [ ] 小尺寸图表的简化策略需要用户可配置吗？

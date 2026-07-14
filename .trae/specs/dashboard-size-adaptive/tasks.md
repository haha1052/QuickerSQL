# 仪表盘尺寸自适应任务清单

## 任务列表

### [ ] Task 1: 增强 ChartCanvas - 添加 ResizeObserver
- **Priority**: high
- **Depends On**: None
- **Description**: 为 ChartCanvas 组件添加 ResizeObserver，实现容器尺寸变化时自动 resize
  - 使用 ResizeObserver 监听容器尺寸变化
  - 移除 window resize 监听（改为更精确的容器监听）
  - 添加防抖处理，避免频繁 resize
  - 确保组件卸载时正确清理 observer
- **Acceptance Criteria Addressed**: AC-2, AC-4
- **Test Requirements**:
  - `programmatic`: TypeScript 编译通过
  - `human-judgment`: 调整窗口大小时图表自动适配

### [ ] Task 2: 优化小尺寸图表显示
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 优化小尺寸图表的显示效果，避免文字和图形重叠
  - 根据容器尺寸动态调整图表配置
  - 小尺寸下自动调整字体大小、图例位置、边距
  - 小尺寸下简化坐标轴标签
  - 修改 normalizeEChartsConfig 或在 ChartCanvas 中后处理配置
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `human-judgment`: 小尺寸图表文字不重叠

### [ ] Task 3: 扩展仪表盘画布尺寸设置
- **Priority**: medium
- **Depends On**: None
- **Description**: 在背景设置中添加画布尺寸选项
  - 添加画布宽度设置（自适应 / 固定宽度）
  - 添加最小宽度/最大宽度选项
  - 更新 DashboardCanvas 应用宽度设置
  - 添加水平滚动支持
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic`: TypeScript 编译通过
  - `human-judgment`: 背景设置中有画布尺寸选项

### [ ] Task 4: 优化 DashboardItem 布局
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 优化 DashboardItem 的布局结构，确保图表区域正确计算尺寸
  - 确认标题行固定高度不影响图表区域
  - 确保图表容器有明确的高度限制
  - 优化编辑模式下的尺寸计算
- **Acceptance Criteria Addressed**: AC-2, AC-4
- **Test Requirements**:
  - `human-judgment`: 图表正确填充容器

### [ ] Task 5: 验证和集成测试
- **Priority**: high
- **Depends On**: Task 1, 2, 3, 4
- **Description**: 综合验证所有改进
  - 验证图表自适应不同容器尺寸
  - 验证小尺寸图表显示效果
  - 验证画布尺寸设置
  - 验证编辑模式下的实时更新
- **Acceptance Criteria Addressed**: All
- **Test Requirements**:
  - `human-judgment`: 综合验证所有功能

## Task Dependencies
```
Task 1 ──┬── Task 2 ──┐
          └── Task 4 ──┴── Task 5 (Verification)
Task 3 ───────────────────┘
```

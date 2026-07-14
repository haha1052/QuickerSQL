# 仪表盘布局架构重构任务清单

## 任务列表

### [x] Task 1: 重构 DashboardItem 布局结构
- **Priority**: high
- **Depends On**: None
- **Description**: 完全重构 DashboardItem 的样式结构，解决高度计算冲突
  - 移除 `styles.item` 的 `height: '100%'`
  - 移除 `styles.itemContainer` 的 `height: '100%'`
  - 添加 `alignSelf: 'stretch'` 让网格项自动填满
  - 简化内部布局结构，确保图表容器正确获取高度
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-3
- **Test Requirements**:
  - ✅ TypeScript 编译通过
  - ✅ 代码修改已确认

### [x] Task 2: 优化 DashboardCanvas Grid 布局
- **Priority**: high
- **Depends On**: None
- **Description**: 优化 DashboardCanvas 的 grid 布局
  - 添加 `alignItems: 'stretch'` 确保子元素高度一致
  - 确保 grid 单元格的高度正确传递给子元素
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - ✅ TypeScript 编译通过
  - ✅ 代码修改已确认

### [x] Task 3: 验证和改进
- **Priority**: high
- **Depends On**: Task 1, Task 2
- **Description**: 综合验证所有改进
  - 验证图表容器高度正确
  - 验证图表 resize 功能正常
  - 验证拖拽编辑功能正常
- **Acceptance Criteria Addressed**: All
- **Test Requirements**:
  - ✅ TypeScript 编译通过
  - ✅ Rust 编译通过
  - ✅ 应用正常启动

## Task Dependencies
```
Task 1 ──┐
         ├── Task 3 (Verification)
Task 2 ──┘
```

## 实施总结

### 核心修改

1. **DashboardItem.tsx**:
   - `styles.item`: 移除 `height: '100%'`，添加 `alignSelf: 'stretch'`
   - `styles.itemContainer`: 移除 `height: '100%'`，添加 `flex: 1` 和 `minHeight: 0`
   - `styles.chart`: 移除 `minHeight: '150px'`，改用 `minHeight: 0`
   - `gridStyle`: 移除固定高度设置，只保留网格位置

2. **DashboardCanvas.tsx**:
   - `styles.canvas`: 添加 `alignItems: 'stretch'`

### 布局原理

- CSS Grid 的 `align-items: stretch`（在父容器）配合子元素的 `align-self: stretch` 让网格项自动填满单元格
- 内部 flex 布局使用 `flex: 1` 让图表区域自动填充剩余空间
- `minHeight: 0` 确保 flex 子元素可以收缩到 0

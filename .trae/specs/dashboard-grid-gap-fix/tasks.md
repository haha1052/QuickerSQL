# 仪表盘图表间距修复 - The Implementation Plan

## [x] Task 1: 分析并定位间距问题
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 确认问题根因：DashboardItem 的 itemContainer 有 12px 的内边距
  - 确认 grid gap 是否正确应用
  - 确认 rowHeight 计算是否正确
- **Acceptance Criteria Addressed**: AC-1, AC-2
- **Test Requirements**:
  - `programmatic` TR-1.1: 代码审查确认问题根因
- **Notes**: 已完成分析，问题根因是 itemContainer 的 12px padding

## [x] Task 2: 修复图表内边距问题
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 
  - 将 DashboardItem 的 itemContainer padding 从固定 12px 改为可配置
  - 或者当 gridGap 为 0 时，也将 itemContainer padding 设为 0
  - 确保图表边框紧贴 grid 单元格边界
- **Acceptance Criteria Addressed**: AC-1, AC-2
- **Test Requirements**:
  - `programmatic` TR-2.1: `npx tsc --noEmit --pretty` 0 errors
  - `human-judgement` TR-2.2: 间距设为0时图表紧贴
- **Notes**: 修改 DashboardItem.tsx

## [x] Task 3: 验证间距设置一致性
- **Priority**: high
- **Depends On**: Task 2
- **Description**: 
  - 确保 gridGap 值与实际显示的间距一致
  - 确保设置修改后立即生效
  - 检查保存后重新加载是否正确
- **Acceptance Criteria Addressed**: AC-2, AC-3
- **Test Requirements**:
  - `programmatic` TR-3.1: TypeScript 编译通过
  - `human-judgement` TR-3.2: 间距设置与实际显示一致
- **Notes**: 需要用户实际测试验证

## [x] Task 4: 全量回归测试
- **Priority**: high
- **Depends On**: Task 2, 3
- **Description**: 
  - 运行完整的前端编译检查：`npx tsc --noEmit --pretty`
  - 运行完整的后端编译检查：`cd src-tauri; cargo check --quiet`
  - 运行前端单元测试：`npx vitest run`
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `programmatic` TR-4.1: TypeScript 0 errors
  - `programmatic` TR-4.2: Rust 0 errors
  - `programmatic` TR-4.3: 前端测试全部通过
- **Notes**: 确保所有修改不破坏现有功能

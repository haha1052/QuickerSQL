# 结果集最小高度设置失效修复 - The Implementation Plan

## [x] Task 1: 修复 QueryResultItem 的 flex 布局和高度控制链路
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 给内容区域（表格所在层）加上 `flex: 1`，使其能够撑开填充 container 的剩余高度
  - 给 tableWrapper 加 `flex: 1; display: flex; flexDirection: column; minHeight: 0;`
  - 给 tableContainer 加 `flex: 1; minHeight: 0;`，移除硬编码的高度值
  - AgGridLazy 保持 `domLayout="autoHeight"` 不变（内容自适应），但外层容器能正确响应 minHeight/maxHeight
  - 确保 result_min_height 和 result_max_height 都能正确作用到视觉上
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-3, AC-5
- **Test Requirements**:
  - `programmatic` TR-1.1: `npx tsc --noEmit --pretty` 返回 0 errors
  - `human-judgement` TR-1.2: 修改 result_min_height 后，少量数据的结果集卡片高度有明显变化
  - `human-judgement` TR-1.3: 修改 result_max_height 后，大量数据的结果集不超出最大高度，出现滚动条
  - `human-judgement` TR-1.4: 分页功能正常，分页栏始终可见
- **Notes**: 重点是确保 flex 布局正确传递高度，让用户能看到设置生效的视觉效果

## [x] Task 2: 验证 cargo check 通过
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 运行 cargo check 确保后端代码没有受到影响（虽然只改前端，但做完整性验证）
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `programmatic` TR-2.1: `cd src-tauri; cargo check --quiet` 无 error
- **Notes**: 纯前端修改，预期无后端影响

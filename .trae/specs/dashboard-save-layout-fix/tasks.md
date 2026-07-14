# 仪表盘布局保存失效修复 - The Implementation Plan (Decomposed and Prioritized Task List)

## [x] Task 1: 修复仪表盘页面进入时的完整数据加载
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 在 DashboardPage.tsx 中，启动缓存设置后，检查仪表盘的 layout 是否为空
  - 若 layout 为空（说明只有精简数据），则调用 `loadDashboards()` 加载完整数据（含 layout）
  - 切换项目后重新进入页面时，也应触发完整加载
- **Acceptance Criteria Addressed**: AC-1, AC-3
- **Test Requirements**:
  - `programmatic` TR-1.1: `npx tsc --noEmit --pretty` 返回 0 errors ✅
  - `human-judgement` TR-1.2: 进入仪表盘页能看到已保存的图表布局
  - `human-judgement` TR-1.3: 切换项目后进入仪表盘页显示新项目的数据
- **Notes**: 实现方式：设置 startup 缓存后，检测所有仪表盘 layout 是否都为空，若是则触发 loadDashboards 完整加载。

## [x] Task 2: 修复保存布局后的状态刷新
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 
  - 在 DashboardPage.tsx 的 `handleToggleEdit` 函数中，保存成功后重新加载当前仪表盘的完整数据
  - 调用 `loadDashboards()` 刷新所有仪表盘，确保 store 中的 layout 数据与后端一致
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `programmatic` TR-2.1: `npx tsc --noEmit --pretty` 返回 0 errors ✅
  - `human-judgement` TR-2.2: 保存布局后立即看到新位置，刷新页面后仍然保持
- **Notes**: 保存全部成功时才刷新，有失败时不刷新（避免用户丢失未保存的更改上下文）。

## [x] Task 3: 验证修复效果
- **Priority**: high
- **Depends On**: Task 1, Task 2
- **Description**: 
  - 运行 TypeScript 类型检查 ✅
  - 运行前端安全检查（SQL 拼接、any 类型等）✅
  - 逻辑验证：确认修改后的数据流正确 ✅
- **Acceptance Criteria Addressed**: AC-4, AC-5
- **Test Requirements**:
  - `programmatic` TR-3.1: `npx tsc --noEmit --pretty` 返回 0 errors ✅
  - `programmatic` TR-3.2: 前端无 SQL 关键字拼接（SELECT/INSERT/UPDATE/DELETE）✅（修改文件无新增）
  - `programmatic` TR-3.3: 前端无 any 类型 ✅（修改文件无新增）
- **Notes**: 编译验证通过，UI 验证需用户在应用中实际操作。

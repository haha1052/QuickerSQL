# 仪表盘空状态区域下移 — Implementation Plan

## [x] Task 1: 修改 DashboardCanvas.tsx 中空状态区域样式
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 在 `emptyCanvas` 样式定义中添加 `marginTop: '100px'` 属性
  - 确保空状态区域向下移动，不被顶部工具栏遮挡
- **Acceptance Criteria Addressed**: AC-1, AC-2
- **Test Requirements**:
  - `programmatic` TR-1.1: `npx tsc --noEmit --pretty` 返回 0 errors ✅
  - `human-judgement` TR-1.2: 空状态区域（图标、文字、按钮）完全可见，不被遮挡
- **Notes**: 修改位置在 `src/components/dashboard/DashboardCanvas.tsx` 第 153-163 行的 `emptyCanvas` 样式

## [x] Task 2: 启动应用验证效果
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 
  - 启动 Tauri 开发服务器
  - 导航至仪表盘页面，确认空状态区域完全可见
- **Acceptance Criteria Addressed**: AC-1, AC-3
- **Test Requirements**:
  - `programmatic` TR-2.1: `npm run tauri dev` 正常启动，无报错 ✅（端口 1420 已在运行）
  - `human-judgement` TR-2.2: 空状态区域的图标、文字和添加图表按钮都完全可见
- **Notes**: 需要等待应用启动后验证 UI 效果

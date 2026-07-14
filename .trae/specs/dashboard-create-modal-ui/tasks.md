# 新建仪表盘弹窗 UI 优化 - The Implementation Plan (Decomposed and Prioritized Task List)

## [x] Task 1: DashboardPage 空状态 - 替换原生 prompt 为自定义弹窗
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 在 DashboardPage.tsx 中添加新建仪表盘的自定义弹窗组件
  - 新增 state: showCreateModal, newDashboardName, creating
  - 弹窗结构：header（标题+关闭按钮）+ body（名称输入框）+ footer（取消/创建按钮）
  - 支持 Enter 创建、Esc 关闭、点击遮罩关闭
  - 输入框自动聚焦
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-3, AC-4, AC-5
- **Test Requirements**:
  - `programmatic` TR-1.1: `npx tsc --noEmit --pretty` 返回 0 errors ✅
  - `human-judgement` TR-1.2: 空状态页点击创建按钮弹出自定义弹窗
  - `human-judgement` TR-1.3: 弹窗宽度 ≥ 420px，视觉舒适
  - `human-judgement` TR-1.4: Enter/Esc/遮罩/关闭按钮四种关闭方式都正常
- **Notes**: 参考 SaveChartModal 中新键仪表盘弹窗的样式风格，保持一致。

## [x] Task 2: 优化 DashboardToolbar 新建仪表盘弹窗样式
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 
  - 优化 DashboardToolbar.tsx 中的新建仪表盘弹窗
  - 改为 header + body + footer 三段式结构
  - 宽度从 360px 增加到 440px
  - 添加关闭按钮（×）
  - 按钮样式与 SaveChartModal 对齐
- **Acceptance Criteria Addressed**: AC-2, AC-3
- **Test Requirements**:
  - `programmatic` TR-2.1: `npx tsc --noEmit --pretty` 返回 0 errors ✅
  - `human-judgement` TR-2.2: 工具栏新建弹窗与空状态弹窗风格一致
  - `human-judgement` TR-2.3: 弹窗宽敞不拥挤
- **Notes**: 复用 Task 1 中确定的视觉规范。

## [x] Task 3: 验证修复效果
- **Priority**: high
- **Depends On**: Task 1, Task 2
- **Description**: 
  - 运行 TypeScript 类型检查 ✅
  - 运行前端安全检查 ✅
  - 确认两个入口的新建弹窗风格一致 ✅
- **Acceptance Criteria Addressed**: AC-6
- **Test Requirements**:
  - `programmatic` TR-3.1: `npx tsc --noEmit --pretty` 返回 0 errors ✅
  - `programmatic` TR-3.2: 修改文件无 SQL 拼接、无 any 类型新增 ✅
  - `human-judgement` TR-3.3: 两处弹窗风格一致且美观
- **Notes**: 编译验证通过，UI 验证需用户在应用中实际操作。

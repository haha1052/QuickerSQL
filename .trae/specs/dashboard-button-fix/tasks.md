# Tasks

- [x] Task 1: 修复 DashboardToolbar 导出按钮禁用态样式和交互
  - [x] SubTask 1.1: 导出按钮不再用 `disabled={isEditing}`，改为点击时检查 `isEditing` 并通过回调通知父组件
  - [x] SubTask 1.2: 为所有工具栏按钮添加 `disabled` 时的视觉样式（opacity: 0.5, cursor: not-allowed）
  - [x] SubTask 1.3: 导出按钮接收 `onExportPng` 回调，编辑模式下点击时调用回调（由父组件决定提示内容）
- [x] Task 2: 修复 DashboardPage handleSave 函数，添加完整反馈
  - [x] SubTask 2.1: 导入 `useToastStore`
  - [x] SubTask 2.2: 非编辑模式点击保存 → toast 提示"请先进入编辑模式再保存"
  - [x] SubTask 2.3: 编辑模式但无 tempLayout 变更 → toast 提示"没有未保存的变更"
  - [x] SubTask 2.4: 保存成功 → toast 提示"保存成功"（替代无反馈）
  - [x] SubTask 2.5: 保存失败 → toast 错误提示（替代 `alert()`）
- [x] Task 3: 修复 DashboardPage handleExportPng 函数，添加完整反馈
  - [x] SubTask 3.1: 编辑模式下点击导出 → toast 提示"请先退出编辑模式"
  - [x] SubTask 3.2: 无活动仪表盘 → toast 错误提示（替代静默返回）
- [x] Task 4: 修复 dashboardExport.ts 中的 alert 调用，改用回调或返回错误信息
  - [x] SubTask 4.1: `exportDashboardToPng` 返回 `{ success: boolean, message: string }` 而非 `boolean`
  - [x] SubTask 4.2: 调用方根据返回结果通过 toast 显示错误/成功消息
- [x] Task 5: 编译验证
  - [x] SubTask 5.1: `cargo check --quiet` 通过（无后端改动，N/A）
  - [x] SubTask 5.2: `npx tsc --noEmit --pretty` 通过（0 errors）

# Task Dependencies
- [Task 2] depends on [Task 1] (Toolbar 改动影响 Page 传参)
- [Task 3] depends on [Task 1] (Toolbar 改动影响 Page 传参)
- [Task 4] depends on [Task 3] (导出函数签名变更后需更新调用方)
- [Task 5] depends on [Task 1, Task 2, Task 3, Task 4]

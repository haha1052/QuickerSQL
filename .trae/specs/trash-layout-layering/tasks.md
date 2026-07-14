# 回收站布局分层优化 - 任务分解

## [ ] Task 1: 修改回收站布局为分层结构
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 修改 TrashPanel.css 中 .trash-item 的布局
  - .trash-item 使用 position: relative
  - .trash-item-info 使用 position: absolute，固定在左侧
  - .trash-item-actions 使用 position: absolute，固定在右侧
  - 文本区域设置 white-space: nowrap 和 overflow: hidden
  - 确保按钮层级高于文本
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-3
- **Test Requirements**:
  - `human-judgement` TR-1.1: 文本与按钮分层显示
  - `human-judgement` TR-1.2: 拖动分隔框时仅按钮移动
  - `human-judgement` TR-1.3: 宽度较窄时文本可被遮挡

## [ ] Task 2: 验证修复并启动应用
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 
  - 运行 TypeScript 编译检查
  - 启动应用验证所有修复

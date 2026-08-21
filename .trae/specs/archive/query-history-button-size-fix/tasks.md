# 查询历史按钮尺寸和交互优化 - 任务分解

## [ ] Task 1: 缩小按钮尺寸与 badge 一致
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 修改 QueryHistory.css 中按钮的尺寸，使其与 status-badge 一致
  - status-badge 当前样式：font-size: 14px; padding: 2px 6px;
  - 按钮应该使用类似的尺寸
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `human-judgement` TR-1.1: 按钮尺寸与成功标记一致

## [ ] Task 2: 修复双击选中功能
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 确保双击 SQL 文本可以正常全选
  - 可能需要设置 user-select: text 或移除妨碍选中文本的 CSS
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `human-judgement` TR-2.1: 双击 SQL 文本可以全选

## [ ] Task 3: 添加右键菜单翻译键
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 在 LocaleContext.tsx 中添加 queryHistory.copy 和 queryHistory.copied 翻译键
  - 中文：复制 / 已复制
  - 英文：Copy / Copied
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `human-judgement` TR-3.1: 右键菜单显示正确的语言

## [ ] Task 4: 验证修复并启动应用
- **Priority**: high
- **Depends On**: Tasks 1-3
- **Description**: 
  - 运行 TypeScript 编译检查
  - 启动应用验证所有修复

# 快捷键完整实现任务列表

## [ ] Task 1: 实现 newProject 快捷键
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 修改 `src/context/ShortcutProvider.tsx`
  - 实现 newProject handler
  - 方案：调用 workspaceStore 创建一个新的空工作区
  - 如果有现成的"新建项目"功能，直接调用
  - 如果没有，创建一个新的空工作区标签页
- **Test Requirements**:
  - `programmatic` TR-1.1: 按 Ctrl+Shift+N 能创建新项目/工作区
  - `human-judgement` TR-1.2: 行为符合用户预期

## [ ] Task 2: 实现 importData 快捷键
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 修改 `src/context/ShortcutProvider.tsx`
  - 实现 importData handler
  - 方案：打开数据导入面板
  - 参考 Toolbar.tsx 中"批量导入"的实现
  - 使用 appStore 或专门的 importStore 来触发打开导入面板
- **Test Requirements**:
  - `programmatic` TR-2.1: 按 Ctrl+I 能打开数据导入
  - `human-judgement` TR-2.2: 行为与点击工具栏导入按钮一致

## [ ] Task 3: 实现 exportData 快捷键
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 修改 `src/context/ShortcutProvider.tsx`
  - 实现 exportData handler
  - 方案：打开数据导出面板
  - 如果有专门的导出功能，直接调用
  - 如果没有，可以导出当前活动的表或查询结果
  - 注意：编辑器内 Ctrl+E 是 explainQuery，优先级更高，不会冲突
- **Test Requirements**:
  - `programmatic` TR-3.1: 按 Ctrl+E（在编辑器外）能打开数据导出
  - `human-judgement` TR-3.2: 编辑器内 Ctrl+E 仍然是 explainQuery

## [ ] Task 4: 编译验证
- **Priority**: high
- **Depends On**: Task 1, Task 2, Task 3
- **Description**:
  - 运行 npx tsc --noEmit --pretty 验证类型
  - 运行 cargo check --quiet 验证后端
- **Test Requirements**:
  - `programmatic` TR-4.1: npx tsc --noEmit --pretty 无错误
  - `programmatic` TR-4.2: cargo check --quiet 无错误

## [ ] Task 5: 更新文档
- **Priority**: medium
- **Depends On**: Task 4
- **Description**:
  - 更新快捷键管理系统技术文档（更新实现状态）
  - 更新设置系统现状分析报告（快捷键分类从 85% → 100%）
  - 更新 implemented_settings（如果有新增）
- **Test Requirements**:
  - `human-judgement` TR-5.1: 文档数据准确

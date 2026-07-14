# 查询历史收藏按钮和回收站布局优化 - 任务分解

## [ ] Task 1: 缩小查询历史收藏按钮尺寸
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 修改 QueryHistory.css 中 btn-favorite 的尺寸
  - 按钮尺寸缩小为原来的 1/2，内部图标大小保持不变
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `human-judgement` TR-1.1: 收藏按钮尺寸明显缩小，图标大小不变

## [ ] Task 2: 回收站记录改为单行布局
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 修改 index.tsx 中的 trash-item 结构
  - 修改 TrashPanel.css 中的样式
  - 布局顺序：表名 | 行数 | 删除时间 | 恢复按钮 | 删除按钮
  - 更新 TRASH_ITEM_HEIGHT 高度
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `human-judgement` TR-2.1: 每条记录显示为一行

## [ ] Task 3: 验证修复并启动应用
- **Priority**: high
- **Depends On**: Tasks 1-2
- **Description**: 
  - 运行 TypeScript 编译检查
  - 启动应用验证所有修复

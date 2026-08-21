# 查询历史模块布局优化 - 任务分解

## [ ] Task 1: 修改查询历史组件布局为单行显示
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 修改 index.tsx 中的 history-item 结构，将多行布局改为单行布局
  - 布局顺序：状态标记 | SQL文本 | 收藏按钮 | 执行按钮 | 删除按钮
  - 添加 SQL 文本截断逻辑
- **Acceptance Criteria Addressed**: AC-1, AC-2
- **Test Requirements**:
  - `human-judgment` TR-1.1: 每条记录显示为一行
  - `human-judgment` TR-1.2: SQL 文本过长时自动截断，鼠标悬停显示完整内容

## [ ] Task 2: 统一收藏按钮尺寸
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 
  - 修改 CSS 中 btn-favorite 的样式，使其与 btn-action 尺寸一致
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `human-judgment` TR-2.1: 收藏按钮与执行/删除按钮尺寸一致

## [ ] Task 3: 添加双击选中和右键复制功能
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 
  - 实现双击 SQL 文本选中功能
  - 实现右键菜单复制功能
- **Acceptance Criteria Addressed**: AC-4, AC-5
- **Test Requirements**:
  - `human-judgment` TR-3.1: 双击 SQL 文本可以全选
  - `human-judgment` TR-3.2: 右键点击 SQL 文本可以复制

## [ ] Task 4: 更新虚拟列表高度配置
- **Priority**: medium
- **Depends On**: Task 1
- **Description**: 
  - 更新 ITEM_HEIGHT 常量，适应单行布局的高度
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `human-judgment` TR-4.1: 虚拟列表滚动正常

## [ ] Task 5: 验证修复并启动应用
- **Priority**: high
- **Depends On**: Tasks 1-4
- **Description**: 
  - 运行 TypeScript 编译检查
  - 启动应用验证所有修复

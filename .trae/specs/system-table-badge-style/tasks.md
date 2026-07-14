# 系统表标识样式优化 - 任务分解

## [ ] Task 1: 修改系统表标识样式
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 修改 DatabaseExplorer.tsx 中的 systemTableBadge 样式
  - 将背景色和文字颜色改为与 tableMeta 一致的灰色风格
  - 参考 tableMeta 的样式：background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)'
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `human-judgement` TR-1.1: 系统表标识样式与行数列数标签一致

## [ ] Task 2: 验证修复并启动应用
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 
  - 运行 TypeScript 编译检查
  - 启动应用验证修复

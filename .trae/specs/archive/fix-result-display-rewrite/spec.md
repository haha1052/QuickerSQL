# 查询结果显示布局彻底修复 Spec

## Why
反复调整导致 `QueryResult` 与 `QueryResultItem` 的 flex/overflow 设置互相冲突：子结果项高度被不自然拉伸、父容器滚动条不生效、整体滚动卡顿。需要一次性梳理清楚整个显示链路，给出稳定方案。

## What Changes
- **重新设计 `QueryResultItem` 高度模型**：子结果项最大高度 800px；数据少时由 ag-grid `autoHeight` 决定实际高度，数据多时 `tableContainer` 内部滚动。
- **修复 `QueryResult` 滚动链路**：`resultsContainer` 作为唯一内部滚动层，`panelContent` 作为外层兜底滚动。
- **优化滚动性能**：保持分页 20 行/页，给 ag-grid 增加 `rowBuffer`，减少拖动调整大小时的布局重算。

## Impact
- 影响文件：
  - `src/components/sql/QueryResult.tsx`
  - `src/components/sql/QueryResultItem.tsx`

## ADDED Requirements
### Requirement: 子结果项高度自适应且受限
- **WHEN** 单个 SQL 返回 1~10 行
- **THEN** 结果项高度由内容决定，不强制拉伸
- **WHEN** 单个 SQL 返回大量行
- **THEN** 结果项高度最大 800px，表格区域内部滚动

### Requirement: 多结果集整体可滚动
- **WHEN** 执行多个 SQL 且总高度超出面板可视区
- **THEN** 父容器出现垂直滚动条，可顺滑滚动查看所有结果

### Requirement: 调整面板高度不卡顿
- **WHEN** 用户拖动结果面板高度
- **THEN** 不应出现明显掉帧

## MODIFIED Requirements
无

## REMOVED Requirements
无

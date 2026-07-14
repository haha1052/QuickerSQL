# 查询结果集 UI 优化修复 — The Implementation Plan (Decomposed and Prioritized Task List)

## [x] Task 1: 修复结果集高度计算导致的内容遮挡问题
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 修改 `src/components/sql/QueryResultItem.tsx` 中的布局方案
  - 改为 flex 布局，让内容区域自适应，避免硬编码固定高度
  - 核心问题：之前使用固定 `height: contentHeight` + `overflow: hidden`，导致底部内容被截断
  - 新方案：容器使用 `minHeight` + `maxHeight`，内容区域使用 flex 布局，表格区域 `flex: 1` + `overflow: auto`，分页/警告信息 `flexShrink: 0` 始终可见
- **Acceptance Criteria Addressed**: AC-1, AC-4, AC-5
- **Test Requirements**:
  - `human-judgement` TR-1.1: 单行结果时底部内容完整可见
  - `human-judgement` TR-1.2: 多行结果（超过一页）时分页信息完整可见
  - `human-judgement` TR-1.3: 有警告信息时警告条完整可见
  - `human-judgement` TR-1.4: 无分页时（行数 < pageSize）底部无多余空白
  - `programmatic` TR-1.5: `npx tsc --noEmit --pretty` 无类型错误 ✅
- **Notes**: 采用 flex 布局方案，确保底部分页/警告信息始终可见

## [x] Task 2: 在执行引擎标识后补充返回结果条数
- **Priority**: medium
- **Depends On**: None
- **Description**: 
  - 修改 `src/components/sql/QueryResultItem.tsx` 中的 header 区域
  - 在引擎标识 badge 后添加结果行数显示
  - 仅在查询成功且有 rows/columns 时显示
  - 样式与现有 badge 风格统一
- **Acceptance Criteria Addressed**: AC-2, AC-3, AC-4
- **Test Requirements**:
  - `human-judgement` TR-2.1: 有结果的查询显示行数
  - `human-judgement` TR-2.2: 无结果的查询（如 INSERT）不显示行数
  - `human-judgement` TR-2.3: 行数样式与整体 UI 风格一致
  - `programmatic` TR-2.4: `npx tsc --noEmit --pretty` 无类型错误 ✅
- **Notes**: 行数格式使用千分位分隔（如 1,234 行）

## [x] Task 3: 综合验证
- **Priority**: high
- **Depends On**: Task 1, Task 2
- **Description**: 
  - 综合验证修复效果
  - 验证多种查询场景：SELECT、INSERT、UPDATE、DELETE、EXPLAIN、多结果集
  - 确认没有引入新问题
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `human-judgement` TR-3.1: SELECT 查询结果展示正常
  - `human-judgement` TR-3.2: INSERT/UPDATE/DELETE 语句结果展示正常
  - `human-judgement` TR-3.3: EXPLAIN 查询结果展示正常
  - `human-judgement` TR-3.4: 多语句批量查询结果展示正常
  - `human-judgement` TR-3.5: 表格/图表切换正常
  - `programmatic` TR-3.6: `npx tsc --noEmit --pretty` 通过 ✅
- **Notes**: 重点关注布局和高度相关的回归

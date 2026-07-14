# Tasks

- [x] Task 1: 增大查询结果区域最大高度到 800px
  - **Priority**: high
  - **Depends On**: None
  - **Description**:
    - 修改 `src/components/sql/QueryResultItem.tsx` 中的样式
    - `container` 的 `maxHeight` 从 600 改为 800
    - `tableWrapper` 的 `maxHeight` 从 560 改为 760
    - `tableContainer` 的 `maxHeight` 从 520 改为 720
    - `chartContainer` 的 `maxHeight` 从 460 调整为 660
    - 保持 `domLayout="autoHeight"` 不变，内容不足时自适应
  - **Acceptance Criteria Addressed**: AC-1, AC-2
  - **Test Requirements**:
    - `programmatic` TR-1.1: `npx tsc --noEmit --pretty` 通过
    - `human-judgement` TR-1.2: 大结果集最大高度约 800px
    - `human-judgement` TR-1.3: 小结果集高度自适应

- [x] Task 2: 编译验证
  - **Priority**: high
  - **Depends On**: Task 1
  - **Description**:
    - 运行 `npx tsc --noEmit --pretty`
    - 确保无类型错误
  - **Acceptance Criteria Addressed**: AC-3
  - **Test Requirements**:
    - `programmatic` TR-2.1: `npx tsc` 通过
    - `human-judgement` TR-2.2: 应用启动后结果区域显示正常

# Task Dependencies
- Task 2 depends on Task 1


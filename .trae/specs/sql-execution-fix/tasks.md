# DuckDB SQL 执行链路修复 - 实施计划

## [ ] Task 1: 验证 DuckDB ATTACH 后的表名查询方式
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 测试 DuckDB ATTACH SQLite 后，`information_schema.tables` 是否能正确返回 SQLite 中的表
  - 如果不行，寻找其他可用的元数据查询方式
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `human-judgement` TR-1.1: 通过日志确认 VIEW 创建数量 > 0
- **Notes**: 需要在 DuckDB 初始化代码中添加调试日志

## [ ] Task 2: 修复 DuckDB query() panic 问题
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 分析 DuckDB `query()` 内部 panic 的原因
  - 添加更完善的 panic 保护和错误处理
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `programmatic` TR-2.1: 执行各种 SQL 查询不会导致 panic
- **Notes**: 需要检查 DuckDB 的 prepare 阶段和 execute 阶段

## [ ] Task 3: 修复 VIEW 创建逻辑
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 
  - 根据 Task 1 的结果修改表名查询方式
  - 确保所有 SQLite 表都能在 DuckDB 中创建对应的 VIEW
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `human-judgement` TR-3.1: 日志显示成功创建 X/Y 个 VIEW（X > 0）

## [ ] Task 4: 验证分析查询路由
- **Priority**: high
- **Depends On**: Task 2, Task 3
- **Description**: 
  - 执行分析查询（GROUP BY/JOIN）验证路由到 DuckDB
  - 检查 EXPLAIN 输出格式
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `human-judgement` TR-4.1: EXPLAIN 输出为 DuckDB 格式

## [ ] Task 5: 回归测试
- **Priority**: medium
- **Depends On**: Task 1-4
- **Description**: 
  - 运行所有现有测试
  - 验证 SQLite 查询仍然正常工作
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-3
- **Test Requirements**:
  - `programmatic` TR-5.1: `cargo test --lib` 全部通过

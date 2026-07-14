# 单条SQL执行耗时返回 - 实现计划

## [x] Task 1: 后端 SqlStatementResult 添加 execution_time_ms 字段
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 在 `src-tauri/src/models/database.rs` 的 `SqlStatementResult` 结构体中添加 `execution_time_ms: Option<i64>` 字段
- **Acceptance Criteria Addressed**: [AC-1]
- **Test Requirements**:
  - `programmatic` TR-1.1: `cargo check --quiet` 通过
- **Notes**: 字段名需与前端保持一致，使用 snake_case + serde rename

## [x] Task 2: 修复 sql_service.rs 中每个语句的执行耗时记录
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 
  - 在 `execute_sql_batch` 函数中，为每个语句的 `SqlStatementResult` 设置 `execution_time_ms` 值
  - 需要在缓存命中、DuckDB 执行成功、SQLite 执行成功、执行失败等所有路径都设置耗时
- **Acceptance Criteria Addressed**: [AC-1, AC-2, AC-3]
- **Test Requirements**:
  - `programmatic` TR-2.1: `cargo check --quiet` 通过
  - `human-judgment` TR-2.2: 多语句 SQL 执行后，每个结果显示不同的耗时值

## [x] Task 3: 修复 commands/sql.rs 缓存命中快路径的耗时记录
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 
  - 在 `commands/sql.rs` 的两处缓存命中快路径（多语句全命中、单语句命中）中设置 `execution_time_ms` 值
- **Acceptance Criteria Addressed**: [AC-3]
- **Test Requirements**:
  - `programmatic` TR-3.1: `cargo check --quiet` 通过

## [ ] Task 4: 验证前端显示效果
- **Priority**: medium
- **Depends On**: Task 1, 2, 3
- **Description**: 
  - 执行多语句 SQL 查询，验证每个结果集显示单独的执行耗时
- **Acceptance Criteria Addressed**: [AC-2]
- **Test Requirements**:
  - `human-judgment` TR-4.1: 前端显示每个 SQL 语句的单独耗时，且值合理


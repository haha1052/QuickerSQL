# DuckDB VIEW 同步修复 - 实施计划（任务分解与优先级排序）

## [ ] Task 1：分析 DuckDB 错误信息，确认 VIEW 缺失的错误特征
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 研究 DuckDB 在表/VIEW 缺失时的错误信息格式
  - 确认错误关键字（如 "Table not found"、"View not found" 等）
  - 为后续的"是否需要刷新 VIEW"判断提供依据
- **Acceptance Criteria Addressed**: [AC-1]
- **Test Requirements**:
  - `programmatic` TR-1.1: 确认 DuckDB "表不存在" 错误信息的精确字符串模式
  - `programmatic` TR-1.2: 确认错误信息大小写（全大写/小写/混合）
- **Notes**: 可以通过在应用中执行 `SELECT * FROM non_existent_table` 来观察错误信息

## [ ] Task 2：在 sql_service.rs 中实现 VIEW 刷新重试逻辑
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 
  - 在 `execute_sql_batch` 函数的 DuckDB 执行失败分支中，增加 VIEW 刷新重试逻辑
  - 检测失败原因是否与表/VIEW 相关（基于 Task 1 确认的错误关键字）
  - 如果是 VIEW 相关错误，调用 `ViewService::refresh_all_views` 刷新所有 VIEW
  - 刷新后重试一次查询
  - 重试成功则正常返回结果
  - 重试失败则回退到 SQLite（原有逻辑）
  - 确保只重试一次，避免无限循环
  - 添加详细的日志记录（刷新原因、刷新结果、重试结果）
- **Acceptance Criteria Addressed**: [AC-1, AC-2, AC-3, AC-4]
- **Test Requirements**:
  - `programmatic` TR-2.1: VIEW 缺失时，DuckDB 查询失败后自动刷新并重试成功
  - `programmatic` TR-2.2: 非 VIEW 错误时，刷新后仍然失败，回退到 SQLite
  - `programmatic` TR-2.3: 正常查询（VIEW 存在）无额外性能开销
  - `programmatic` TR-2.4: 重试逻辑只触发一次，不会无限循环
  - `human-judgement` TR-2.5: 代码结构清晰，不破坏原有的回退逻辑框架
- **Notes**: 
  - 修改位置：`sql_service.rs` 的 `execute_sql_batch` 函数中 DuckDB 执行失败的分支
  - VIEW 刷新需要在 DuckDB 连接锁内执行
  - 注意：刷新 VIEW 时需要持有 DuckDB 连接的 MutexGuard

## [ ] Task 3：单元测试与集成验证
- **Priority**: high
- **Depends On**: Task 2
- **Description**: 
  - 确保 `cargo check --quiet` 编译通过
  - 确保 `cargo test` 现有测试全部通过
  - 验证 router 单元测试不受影响
  - 代码审查：确认修改不影响其他功能
- **Acceptance Criteria Addressed**: [AC-5, AC-6]
- **Test Requirements**:
  - `programmatic` TR-3.1: cargo check --quiet 编译通过，无 error
  - `programmatic` TR-3.2: cargo test 所有现有测试通过
  - `programmatic` TR-3.3: 无新增 unwrap/expect
  - `programmatic` TR-3.4: 无 SQL 注入风险（使用 SqlIdentifier）
- **Notes**: 重点关注并发场景下的安全性（Mutex 锁的正确使用）

## [ ] Task 4：回归测试 — 确保其他功能不受影响
- **Priority**: medium
- **Depends On**: Task 3
- **Description**: 
  - 验证导入功能正常（导入 CSV 后 VIEW 正确创建）
  - 验证简单查询正常（走 SQLite）
  - 验证分析查询正常（走 DuckDB）
  - 验证查询缓存正常工作
  - 验证写操作（INSERT/UPDATE/DELETE）正常
  - 验证 EXPLAIN 语句正常
- **Acceptance Criteria Addressed**: [AC-3, AC-4, AC-5]
- **Test Requirements**:
  - `human-judgement` TR-4.1: 导入 CSV 功能正常，新表可查询
  - `human-judgement` TR-4.2: 简单 SELECT 查询正常返回
  - `human-judgement` TR-4.3: JOIN/GROUP BY 查询正常返回
  - `human-judgement` TR-4.4: 查询缓存命中/失效逻辑正常
  - `human-judgement` TR-4.5: 写操作正常，数据正确持久化
- **Notes**: 回归测试确保修改不引入新的 bug

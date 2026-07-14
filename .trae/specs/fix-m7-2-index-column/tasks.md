# Tasks

- [x] Task 1: 修复 M7.2 索引优化的字段名错误
  - **Priority**: high
  - **Depends On**: None
  - **Description**:
    - 修改 `src-tauri/src/services/migration_service.rs` 第 142-148 行
    - 将 `is_enabled` 字段改为 `state`
    - 更新注释说明：`WHERE next_run_at < ? AND is_enabled = TRUE` 改为 `WHERE next_run_at < ? AND state = 'enabled'`
    - 保持索引名 `idx_auto_tasks_next_run_enabled` 不变（向后兼容）
  - **Acceptance Criteria Addressed**: AC-1, AC-2
  - **Test Requirements**:
    - `programmatic` TR-1.1: `cargo check --quiet` 通过
    - `programmatic` TR-1.2: `cargo test --lib` 全部通过
    - `human-judgment` TR-1.3: 启动日志显示索引优化成功

- [x] Task 2: 编译验证与回归测试
  - **Priority**: high
  - **Depends On**: Task 1
  - **Description**:
    - 运行 `cargo check --quiet`
    - 运行 `cargo test --lib`
    - 启动应用验证 M7.2 索引优化不再报错
  - **Acceptance Criteria Addressed**: AC-3
  - **Test Requirements**:
    - `programmatic` TR-2.1: `cargo check` 通过
    - `programmatic` TR-2.2: `cargo test --lib` 全部通过
    - `human-judgment` TR-2.3: 应用启动后无 M7.2 索引错误日志

# Task Dependencies
- Task 2 depends on Task 1


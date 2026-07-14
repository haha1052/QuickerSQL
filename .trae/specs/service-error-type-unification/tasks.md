# Rust Service 层错误类型统一 — 实施计划

## [x] Task 1: 修改 project_service.rs 的 public 函数错误类型
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 将所有 public 函数的返回类型从 `Result<T>`（`ProjectError`）改为 `Result<T, String>`
  - 内部私有函数可以保留 `Result<T, ProjectError>`，在 public 函数边界转换
  - 错误信息添加上下文描述
  - 关键错误位置添加 `log::error!` 或 `log::warn!`
  - 调整测试代码以适应新的错误类型
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-3, AC-6
- **Test Requirements**:
  - `programmatic` TR-1.1: `grep "pub fn.*-> Result<" project_service.rs` 结果中不包含 `ProjectError`
  - `programmatic` TR-1.2: `cargo check --quiet` 通过
  - `human-judgement` TR-1.3: 错误信息包含上下文描述

## [x] Task 2: 适配 commands/project.rs 调用方
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 
  - 修改 `commands/project.rs` 中调用 `ProjectService` 的地方
  - 移除不必要的错误类型转换（因为已经是 String）
  - 确保 `ApiResponse` 包装正确
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `programmatic` TR-2.1: `cargo check --quiet` 通过

## [x] Task 3: 适配 commands/startup.rs 调用方
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 
  - 修改 `commands/startup.rs` 中调用 `ProjectService` 的地方
  - 确保错误处理正确
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `programmatic` TR-3.1: `cargo check --quiet` 通过

## [x] Task 4: 运行完整测试验证
- **Priority**: high
- **Depends On**: Task 1, Task 2, Task 3
- **Description**: 
  - 运行 `cargo check --quiet` 确保编译通过
  - 运行 `cargo test --quiet` 确保所有测试通过
  - 运行安全检测命令（SQL注入、敏感字符串等）
- **Acceptance Criteria Addressed**: AC-4, AC-5, AC-6
- **Test Requirements**:
  - `programmatic` TR-4.1: `cargo check --quiet` 无错误
  - `programmatic` TR-4.2: `cargo test --quiet` 全部通过
  - `programmatic` TR-4.3: SQL 注入检测通过
  - `programmatic` TR-4.4: 敏感字符串检测通过

# 项目切换后 DuckDB 立即初始化 - 实施计划

## [x] Task 1: 后端 switch_project 命令追加 DuckDB 预加载
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 修改 `src-tauri/src/commands/project.rs` 的 `switch_project` 函数
  - 在第 6 步（系统表初始化 + 审计日志）之后，追加第 7 步：异步触发 DuckDB 重新初始化
  - 复用 `preload_duckdb` 中的逻辑：从新 SQLite 获取表名 → 创建内存 DuckDB → ATTACH → 创建 VIEW
  - 使用 `std::thread::spawn` 异步执行，不阻塞 `switch_project` 命令返回
  - 预加载失败仅记录日志，不影响项目切换成功
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic`: `cargo check --quiet` 通过
  - `programmatic`: `cargo test --lib` 全部通过
  - `human-judgment`: 切换项目后日志中应出现 `[DuckDB] 预加载` 而非 `[DuckDB] 首次使用，开始懒初始化`

## [x] Task 2: 前端 handleProjectSwitchRefresh 追加预加载调用
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - 修改 `src/App.tsx` 的 `handleProjectSwitchRefresh` 函数
  - 在 `Promise.all` 数组中追加 `tauriService.preloadDuckdb()` 调用
  - 预加载失败不阻塞其他 Store 刷新（`.catch` 兜底）
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `programmatic`: `npx tsc --noEmit --pretty` 通过
  - `human-judgment`: 切换项目后 Network 中可见 `preload_duckdb` IPC 调用

## [x] Task 3: 验证应用启动预加载不受影响
- **Priority**: medium
- **Depends On**: Task 1, Task 2
- **Description**:
  - 确认 `AppWrapper.tsx` 的 5 秒延时预加载逻辑未被修改
  - 启动应用，确认 5 秒后仍自动触发 `preloadDuckdb`
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `human-judgment`: `AppWrapper.tsx` 第 230-240 行代码无变化
  - `human-judgment`: 启动日志中 5 秒后出现 `[DuckDB] 预加载开始`

## [x] Task 4: 编译与回归验证
- **Priority**: high
- **Depends On**: Task 1, Task 2
- **Description**:
  - 执行 `cargo check --quiet` 确认后端编译通过
  - 执行 `npx tsc --noEmit --pretty` 确认前端类型检查通过
  - 执行 `cargo test --lib` 确认后端测试全部通过
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `programmatic`: `cargo check --quiet` 无 error
  - `programmatic`: `npx tsc --noEmit --pretty` 0 errors
  - `programmatic`: `cargo test --lib` 无 FAIL

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1, Task 2
- Task 4 depends on Task 1, Task 2

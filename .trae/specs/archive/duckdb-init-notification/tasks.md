# DuckDB 初始化完成消息通知 - 实施计划

## [ ] Task 1: 后端添加 DuckDB 初始化完成事件类型定义
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 在 `src-tauri/src/models/` 下创建 `duckdb.rs`，定义 `DuckDbInitStatus` 结构体（包含 success、view_count、total_tables、duration_ms、trigger 字段）
  - 结构体需支持 serde 序列化（`#[derive(Serialize)]`）
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic`: `cargo check --quiet` 通过

## [ ] Task 2: 后端 preload_duckdb 命令发送初始化完成事件
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - 修改 `src-tauri/src/commands/sql.rs` 的 `preload_duckdb` 命令
  - 在异步线程中，初始化完成后通过 `tauri::event::emit_all` 发送 `duckdb_init_completed` 事件
  - 需要从 `state` 中获取 `AppHandle`
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic`: `cargo check --quiet` 通过
  - `human-judgment`: 代码中有 `emit_all` 调用

## [ ] Task 3: 后端 switch_project 命令发送初始化完成事件
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - 修改 `src-tauri/src/commands/project.rs` 的 `switch_project` 命令
  - 在异步预加载线程中，初始化完成后发送 `duckdb_init_completed` 事件
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic`: `cargo check --quiet` 通过
  - `human-judgment`: 代码中有 `emit_all` 调用

## [ ] Task 4: 后端懒加载路径发送初始化完成事件
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - 修改 `src-tauri/src/lib.rs` 的 `get_duckdb_connection` 方法
  - 在懒加载完成后发送 `duckdb_init_completed` 事件
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic`: `cargo check --quiet` 通过
  - `human-judgment`: 代码中有 `emit_all` 调用

## [ ] Task 5: 前端 tauriService 添加事件监听方法
- **Priority**: high
- **Depends On**: Task 1-4
- **Description**:
  - 在 `src/services/tauri.ts` 中添加 `onDuckDbInitCompleted` 方法
  - 使用 `window.addEventListener` 监听 `duckdb_init_completed` 事件
  - 返回取消监听函数
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `programmatic`: `npx tsc --noEmit --pretty` 通过

## [ ] Task 6: 前端 AppWrapper 注册事件监听
- **Priority**: high
- **Depends On**: Task 5
- **Description**:
  - 在 `src/AppWrapper.tsx` 中注册 `onDuckDbInitCompleted` 监听
  - 收到事件后通过 `toastStore.addToast` 显示消息
  - 在组件卸载时取消监听
- **Acceptance Criteria Addressed**: AC-2, AC-3, AC-4, AC-5
- **Test Requirements**:
  - `programmatic`: `npx tsc --noEmit --pretty` 通过
  - `human-judgment`: 代码中有监听注册和 toast 显示逻辑

## [ ] Task 7: 编译与回归验证
- **Priority**: high
- **Depends On**: Task 1-6
- **Description**:
  - 执行 `cargo check --quiet` 确认后端编译通过
  - 执行 `npx tsc --noEmit --pretty` 确认前端类型检查通过
  - 执行 `cargo test --lib` 确认后端测试全部通过
- **Acceptance Criteria Addressed**: AC-1, AC-2
- **Test Requirements**:
  - `programmatic`: `cargo check --quiet` 无 error
  - `programmatic`: `npx tsc --noEmit --pretty` 0 errors
  - `programmatic`: `cargo test --lib` 无 FAIL

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1
- Task 4 depends on Task 1
- Task 5 depends on Task 1-4
- Task 6 depends on Task 5
- Task 7 depends on Task 1-6

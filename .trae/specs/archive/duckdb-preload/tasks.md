# DuckDB 预加载优化 - 实施计划

## [ ] Task 1: 后端新增 preload_duckdb 命令
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 在 `commands/sql.rs` 中新增 `preload_duckdb` Tauri 命令
  - 命令异步执行 DuckDB 初始化
  - 返回初始化状态
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `human-judgement` TR-1.1: 命令注册到 lib.rs 和 capabilities/default.json
  - `human-judgement` TR-1.2: 命令返回 ApiResponse 格式正确

## [ ] Task 2: 前端启动后5秒触发预加载
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 
  - 在 `services/tauri.ts` 中添加 `preloadDuckdb` 方法
  - 在 `AppWrapper.tsx` 启动成功后5秒调用预加载
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `human-judgement` TR-2.1: tauriService 中有 preloadDuckdb 方法
  - `human-judgement` TR-2.2: AppWrapper 中有5秒延迟调用逻辑

## [ ] Task 3: 验证分析查询响应时间
- **Priority**: high
- **Depends On**: Task 1, Task 2
- **Description**: 
  - 启动应用后等待5秒
  - 执行 GROUP BY 查询
  - 验证查询不再卡住
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `human-judgement` TR-3.1: 查询在2秒内返回结果

## [ ] Task 4: 回归测试
- **Priority**: medium
- **Depends On**: Task 1, Task 2
- **Description**: 
  - 运行所有现有测试
  - 验证 SQLite 查询仍然正常工作
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `programmatic` TR-4.1: `cargo test --lib` 全部通过
  - `programmatic` TR-4.2: `npx tsc --noEmit --pretty` 通过

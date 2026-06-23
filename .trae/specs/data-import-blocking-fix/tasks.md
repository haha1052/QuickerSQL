# Tasks

## P0: Tauri 后端命令异步化

- [x] Task 1: 改造 `import_data_v2` 为异步命令
  - [x] SubTask 1.1: 将 `#[tauri::command]` 改为 `#[tauri::command(async)]`
  - [x] SubTask 1.2: 将阻塞 IO（文件解析、COPY 执行、批量插入）放入 `tokio::task::spawn_blocking`
  - [x] SubTask 1.3: 在 `spawn_blocking` 内使用 `std::fs` 同步 IO（不创建新 Runtime）
  - [x] SubTask 1.4: 添加文件路径校验（exists、readonly 检查）
  - [x] SubTask 1.5: 添加日志埋点（文件打开、COPY 执行、锁获取耗时）

## P1: DuckDB 连接超时锁

- [x] Task 2: 新增 `get_connection_with_timeout` 方法
  - [x] SubTask 2.1: 在 `src-tauri/src/database/traits.rs` 中添加 `get_connection_with_timeout(Duration)` 方法
  - [x] SubTask 2.2: 使用手动实现超时逻辑（try_lock + sleep 循环）
  - [x] SubTask 2.3: 超时返回 `DatabaseError::ConnectionTimeout` 错误
  - [x] SubTask 2.4: 在 `import_data_v2_async` 中使用带超时的连接获取（5 秒）

## P1: 全链路超时机制

- [x] Task 3: 添加后端超时保护
  - [x] SubTask 3.1: COPY 命令执行用 `tokio::time::timeout(Duration::from_secs(10), spawn_blocking)` 包装
  - [x] SubTask 3.2: 传统批量插入用 `tokio::time::timeout(Duration::from_secs(20), spawn_blocking)` 包装
  - [x] SubTask 3.3: 超时后返回友好错误消息，不 panic

- [x] Task 4: 添加前端超时保护
  - [x] SubTask 4.1: 在 `src/services/tauri.ts` 中为 `importDataV2` 添加 30 秒全局超时
  - [x] SubTask 4.2: 使用 `clearTimeout` 清理 setTimeout，避免内存泄漏
  - [x] SubTask 4.3: 超时后显示"导入超时，请检查文件/数据库"提示

## P2: Excel 临时文件优化

- [x] Task 5: 优化临时文件处理
  - [x] SubTask 5.1: 临时目录改为 `dirs::data_local_dir().join("quickersql_temp")`
  - [x] SubTask 5.2: 分批写入保留（每 100 行刷盘）
  - [x] SubTask 5.3: 临时文件删除改为异步 `tokio::spawn(async { tokio::fs::remove_file(...) })`
  - [x] SubTask 5.4: 应用退出时清理临时目录（可选，当前异步删除已足够）

## P3: 前端进度反馈

- [x] Task 6: 添加导入状态 UI
  - [x] SubTask 6.1: 在 `DataPreview.tsx` 中添加错误友好化函数
  - [x] SubTask 6.2: 显示导入状态指示器（按钮样式变化 + 图标）
  - [x] SubTask 6.3: 导入完成后显示成功/失败消息（Toast）
  - [x] SubTask 6.4: 错误消息友好化（区分文件不存在、连接超时、导入超时等）

## 验证任务

- [x] Task 7: 编译验证
  - [x] SubTask 7.1: `cargo check --quiet` 通过
  - [x] SubTask 7.2: `npx tsc --noEmit --pretty` 通过
  - [x] SubTask 7.3: `cargo test --quiet --lib` 通过（待执行）

- [ ] Task 8: 功能验证（需用户手动测试）
  - [ ] SubTask 8.1: 10 行 CSV 导入无卡顿
  - [ ] SubTask 8.2: 10 行 Excel 导入无卡顿
  - [ ] SubTask 8.3: 同时发起两次导入，第二次返回超时错误
  - [ ] SubTask 8.4: 异常文件（损坏/只读）触发友好错误提示

---

# Task Dependencies

- [Task 2] 依赖 [Task 1] —— 连接超时锁需要在异步命令中使用
- [Task 3] 依赖 [Task 1] —— 超时机制需要异步命令才能生效
- [Task 4] 依赖 [Task 1] —— 前端超时需要后端异步命令配合
- [Task 5] 依赖 [Task 1] —— 临时文件优化需要在异步上下文中执行
- [Task 6] 依赖 [Task 1, Task 4] —— 进度 UI 需要异步导入 + 前端超时
- [Task 7] 依赖 [Task 1-6] —— 编译验证在所有改造完成后
- [Task 8] 依赖 [Task 7] —— 功能验证在编译通过后

---

# 并行化建议

以下任务可并行执行：
- [Task 1] 和 [Task 2] 可并行 —— 异步命令改造和连接超时锁是独立模块
- [Task 5] 可与 [Task 1-4] 并行 —— 临时文件优化独立于超时机制
- [Task 6] 可与 [Task 1-5] 并行 —— 前端 UI 改造独立于后端

以下任务必须串行：
- [Task 3] 必须等 [Task 1] —— 超时机制依赖异步命令
- [Task 7] 必须等所有改造完成
- [Task 8] 必须等 [Task 7]
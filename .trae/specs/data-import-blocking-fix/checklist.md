# Checklist

## P0: 异步命令改造

- [x] `import_data_v2` 命令标记为 `#[tauri::command(async)]`
- [x] 所有阻塞 IO 放入 `tokio::task::spawn_blocking`
- [x] `spawn_blocking` 内使用 `std::fs` 同步 IO，不创建新 Runtime
- [x] 文件路径校验（exists、readonly）在异步命令入口处执行
- [x] 日志埋点覆盖文件打开、COPY 执行、锁获取耗时

## P1: 连接超时锁

- [x] `get_connection_with_timeout(Duration)` 方法存在于 `database/traits.rs`
- [x] 超时逻辑使用 `try_lock + sleep` 循环实现
- [x] 超时返回 `DatabaseError::ConnectionTimeout` 或友好错误消息
- [x] `import_data_v2_async` 使用 5 秒超时获取连接

## P1: 全链路超时

- [x] COPY 命令执行有 10 秒超时保护（动态调整）
- [x] 传统批量插入有 20 秒超时保护（动态调整）
- [x] 前端 `importDataV2` 有 30 秒全局超时
- [x] 前端超时使用 `clearTimeout` 正确清理
- [x] 超时后返回友好错误消息，不 panic

## P2: Excel 临时文件优化

- [x] 临时目录使用 `dirs::data_local_dir().join("quickersql_temp")`
- [x] 分批写入保留（每 100 行刷盘）
- [x] 临时文件删除使用异步 `tokio::spawn`
- [x] 应用退出时清理临时目录（可选，当前异步删除已足够）

## P3: 前端进度反馈

- [x] `DataPreview.tsx` 有错误友好化函数
- [x] 导入时显示状态指示器（按钮样式变化 + 图标）
- [x] 导入完成显示成功/失败消息（Toast）
- [x] 错误消息友好化（区分不同错误类型）

## 编译验证

- [x] `cargo check --quiet` 通过，无错误
- [x] `npx tsc --noEmit --pretty` 通过，0 errors
- [x] `cargo test --quiet --lib` 通过，167 passed; 0 failed

## 功能验证

- [ ] 10 行 CSV 导入无卡顿，UI 可操作
- [ ] 10 行 Excel 导入无卡顿，UI 可操作
- [ ] 同时发起两次导入，第二次返回"连接占用超时"错误
- [ ] 损坏 Excel 文件触发友好错误提示
- [ ] 只读文件触发友好错误提示
- [ ] Windows 任务管理器观察无 CPU/内存暴涨
- [ ] 临时文件导入后被删除，无残留
# 项目切换后 DuckDB 立即初始化 - 验证清单

## 后端修改检查
- [x] Checkpoint 1: `src-tauri/src/commands/project.rs` 的 `switch_project` 函数末尾有异步 DuckDB 预加载触发
- [x] Checkpoint 2: 预加载使用 `std::thread::spawn` 异步执行，不阻塞命令返回
- [x] Checkpoint 3: 预加载失败仅记录日志，不影响 `switch_project` 返回 `Ok(project_info)`
- [x] Checkpoint 4: `set_db_path` 方法本身未被修改（仍负责清空旧连接 + 更新路径）

## 前端修改检查
- [x] Checkpoint 5: `src/App.tsx` 的 `handleProjectSwitchRefresh` 中追加了 `preloadDuckdb()` 调用
- [x] Checkpoint 6: `preloadDuckdb()` 调用有 `.catch` 兜底，不阻塞其他 Store 刷新
- [x] Checkpoint 7: `AppWrapper.tsx` 的 5 秒延时预加载逻辑未被修改

## 编译与类型检查
- [x] Checkpoint 8: `cargo check --quiet` 无 error
- [x] Checkpoint 9: `npx tsc --noEmit --pretty` 0 errors
- [x] Checkpoint 10: `cargo test --lib` 无 FAIL（275 passed, 0 failed）

## 功能验证
- [ ] Checkpoint 11: 切换项目后日志中出现 `[DuckDB] 预加载` 而非 `[DuckDB] 首次使用，开始懒初始化`
- [ ] Checkpoint 12: 应用首次启动时 5 秒延时预加载仍正常工作

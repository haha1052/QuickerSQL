# Tasks

- [x] Task 1: 修复 P1-1 SQL 注入违规（7 条真正违规 + 误报标记）
  - [ ] SubTask 1.1: 修复 `dashboard_service.rs:1429/1438` 的 INSERT format! 拼接 → 参数化查询
  - [ ] SubTask 1.2: 修复 `profile_service.rs:62/75/77` 的 SELECT format! 拼接 → SqlIdentifier 封装
  - [ ] SubTask 1.3: 修复 `view_service.rs:158/257/411` 的 DROP/CREATE format! 拼接 → SqlIdentifier 封装
  - [ ] SubTask 1.4: 为 `migration_service.rs`、`trash_service.rs` 的 map_err 错误信息添加白名单注释标记
  - [ ] SubTask 1.5: 运行 SQL 注入检测验证违规数降为 0
  - [ ] SubTask 1.6: `cargo check --quiet` + `cargo test --quiet` 通过

- [x] Task 2: 清理 P1-2 unwrap/expect — Top 3 文件（无需修改：92+48+45=185 处全部在 #[cfg(test)] 块中，生产代码 0 处）
  - [ ] SubTask 2.1: 清理 `project_service.rs` 的 92 处 unwrap/expect → `?` / `map_err` / `unwrap_or`
  - [ ] SubTask 2.2: 清理 `query_history_service.rs` 的 48 处 unwrap/expect
  - [ ] SubTask 2.3: 清理 `settings_service.rs` 的 45 处 unwrap/expect
  - [ ] SubTask 2.4: `cargo check --quiet` + `cargo test --quiet` 通过

- [x] Task 3: 清理 P1-2 unwrap/expect — 第 4-5 文件（无需修改：44+41=85 处全部在 #[cfg(test)] 块中，生产代码 0 处）
  - [ ] SubTask 3.1: 清理 `sql_snippet_service.rs` 的 44 处 unwrap/expect
  - [ ] SubTask 3.2: 清理 `app_state_service.rs` 的 41 处 unwrap/expect
  - [ ] SubTask 3.3: `cargo check --quiet` + `cargo test --quiet` 通过

- [x] Task 4: 清理 P1-2 unwrap/expect — 剩余文件（无需修改：duckdb.rs 2 处为注释行；lib.rs 1 处为 Tauri 入口 expect（有注释说明）；其余全部在 #[cfg(test)] 块中）
  - [ ] SubTask 4.1: 清理 `dashboard_service.rs` 的 28 处 unwrap/expect
  - [ ] SubTask 4.2: 清理 `database/sqlite.rs` 的 17 处 + `database/router.rs` 的 3 处 + `database/duckdb.rs` 的 2 处
  - [ ] SubTask 4.3: 清理 `utils/schedule.rs` 的 16 处
  - [ ] SubTask 4.4: 清理 `view_service.rs` 的 10 处 + `chart_service.rs` 的 8 处 + `models/error.rs` 的 5 处 + 其他
  - [ ] SubTask 4.5: `cargo check --quiet` + `cargo test --quiet` 通过

- [x] Task 5: 全量门禁验证 + 浏览器验证（cargo check 0 errors / cargo test 326 passed / tsc 0 errors / vitest 194 passed / SQL 注入 0 违规 / unwrap 0 生产代码 / 应用启动成功）
  - [ ] SubTask 5.1: 全量门禁验证（cargo check / cargo test / tsc / vitest / SQL 注入 / unwrap 检测）
  - [ ] SubTask 5.2: 启动应用 `npm run tauri dev` 验证功能正常（SQL 查询、仪表盘、数据导入）
  - [ ] SubTask 5.3: 截图记录验证结果

- [x] Task 6: 更新文档（架构现状.md + 技术债清单_v4.md + 历史技术债.md）
  - [ ] SubTask 6.1: 更新 `docs/架构现状.md` §7 当前技术债章节（P1 标记为已修复）
  - [ ] SubTask 6.2: 更新 `docs/技术债清单_v4.md`（P1 状态更新 + 质量基线更新）
  - [ ] SubTask 6.3: 追加 `docs/历史技术债.md` 修复记录（P1-1 + P1-2 修复详情）

# Task Dependencies
- Task 2 depends on Task 1（先修 SQL 注入避免与 unwrap 清理冲突）
- Task 3 depends on Task 2（分批进行，确保编译通过后继续）
- Task 4 depends on Task 3
- Task 5 depends on Task 4
- Task 6 depends on Task 5

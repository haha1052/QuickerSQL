# Tasks

- [x] Task 1: 修复 3 处硬编码 SQL LIKE 中的下划线通配符 bug
  - [x] 修改 `src-tauri/src/commands/sql.rs:330` — 将 `NOT LIKE '__%'` 改为 `NOT LIKE '\\_\\_%' ESCAPE '\\'`
  - [x] 修改 `src-tauri/src/database/router.rs:72` — 同上
  - [x] 修改 `src-tauri/src/lib.rs:392` — 同上

- [x] Task 2: 修复 database_service.rs 参数化查询中的下划线通配符 bug
  - [x] 修改 `src-tauri/src/services/database_service.rs:176` — 参数 `"__%"` 改为 `"\\_\\_%"` 并添加 `ESCAPE '\\'` 子句

- [x] Task 3: 修复透明窗口成功率 Win10 适配
  - [x] 修改 `src-tauri/src/commands/startup.rs` 中 `success_rate()` 方法 — Win10 下排除 `dwm_transitions_disabled`、`dwm_border_color_ok`、`dwm_border_thickness_ok` 的计算
  - [x] 增加 `is_win10` 字段，日志中 Win10 不可用 DWM 属性显示为 `N/A(Win10)`

- [x] Task 4: 编译验证与回归测试
  - [x] `cargo check --quiet` 通过
  - [x] `npx tsc --noEmit --pretty` 通过
  - [x] 未转义的 `NOT LIKE '__%'` 残留检测 Count=0
  - [x] success_rate 方法正确排除 Win10 不可用属性

# Task Dependencies
- Task 4 depends on Task 1, Task 2, Task 3

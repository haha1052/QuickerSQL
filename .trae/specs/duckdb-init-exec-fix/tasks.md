# Tasks

- [x] Task 1: 修复预加载表名查询 SQL
  - 移除 `AND name NOT LIKE '__%'` 过滤，与 `router.rs::get_table_names` 保持一致
  - 文件: `src-tauri/src/commands/sql.rs` 第 328 行
  - 验证: 日志显示获取到 32 个用户表（而非 0 个）

- [x] Task 2: 修复 PRAGMA busy_timeout 执行方式
  - 将 `sqlite_conn.execute(&pragma_sql, &[])` 改为 `sqlite_conn.query(&pragma_sql, &[])`
  - 文件: `src-tauri/src/services/sql_service.rs` 第 507 行
  - 验证: 日志不再出现 "设置 busy_timeout 失败"

- [x] Task 3: 修复 DuckDB query panic - 改用 query_arrow 作为主路径
  - 在 `duckdb.rs` 的 `query()` 方法中，跳过 `stmt.query([])`，直接使用 `query_arrow([])`
  - 文件: `src-tauri/src/database/duckdb.rs` 第 82-177 行
  - 验证: 分析查询不再 panic，`cargo test --lib` 通过

- [x] Task 5: 查询结果增加 engine 字段，前端显示引擎标识
  - 在 `SqlStatementResult` struct 中新增 `engine: Option<String>` 字段
  - 在 `sql_service.rs` 中所有创建 `SqlStatementResult` 的地方填入 engine 值
  - 更新前端类型 `SqlStatementResult` 增加 engine 字段
  - 前端结果标签旁显示引擎徽章（DuckDB 绿色，SQLite 蓝色）
  - 文件: `src-tauri/src/models/database.rs`、`src-tauri/src/services/sql_service.rs`、`src/types/database.ts`、结果展示组件
  - 验证: GROUP BY 查询显示 DuckDB 徽章，INSERT 查询显示 SQLite 徽章

- [x] Task 4: 编译验证与回归测试
  - `cargo check --quiet` 通过
  - `cargo test --lib` 全部通过
  - `npx tsc --noEmit --pretty` 通过

# Task Dependencies
- Task 4 depends on Task 1, Task 2, Task 3

# DuckDB 主引擎重构 - 实现计划

## Task 1: TauriAppState 双连接结构改造

- **Status**: `pending`

- **Priority**: high

- **Depends On**: None

- **Description**:

  - 在 `TauriAppState` 中新增 `duckdb_manager: SharedDatabaseManager`，注册 `DuckDbDriver`。

  - 启动时连接 `meta.db`（sqlite）与 `data.duckdb`（duckdb）。

  - 移除 `duckdb_conn` 字段、`init_duckdb()`、`get_duckdb_connection()`、`DuckDbConnHandle` 类型。

  - `set_db_path` 改为同时切换两个 manager 的连接。

  - 系统表初始化仍走 sqlite\_manager。

- **Acceptance Criteria Addressed**: AC-1, AC-8

- **Test Requirements**:

  - `rule` TR-1.1: `cargo check` 通过，`TauriAppState` 含 `duckdb_manager` 不含 `duckdb_conn`

  - `rule` TR-1.2: 系统表 ensure 仍使用 sqlite 连接（lib.rs 中 `state.db_manager.get_connection()` 指向 sqlite）

- **Notes**: `db_manager` 保留原名指向 sqlite，新增 `duckdb_manager`，避免大范围重命名。

## Task 2: 项目生命周期双文件管理

- **Status**: `pending`

- **Priority**: high

- **Depends On**: Task 1

- **Description**:

  - `project_service.rs::create_project`：创建 `meta.db` 后同时创建 `data.duckdb`（空库）。

  - `delete_project`：同时删除两个文件。

  - `duplicate_project`：同时复制两个文件。

  - `import_project`/`export_project`：处理两个文件。

  - `commands/project.rs::switch_project`：同时 reconnect sqlite\_manager(meta.db) + duckdb\_manager(data.duckdb)，删除内联 DuckDB 预加载逻辑。

- **Acceptance Criteria Addressed**: AC-2

- **Test Requirements**:

  - `rule` TR-2.1: 创建项目后目录含 `meta.db` 与 `data.duckdb`

  - `rule` TR-2.2: `switch_project` 中无 `connect_memory`/`ATTACH` 调用

- **Notes**: `data.duckdb` 路径由 meta.db 同目录推导。

## Task 3: SQL 执行路由重构（用户 SQL 走 DuckDB）

- **Status**: `pending`

- **Priority**: high

- **Depends On**: Task 1

- **Description**:

  - `sql_service.rs::execute_sql_batch` 签名改为接收 `duckdb_conn: &MutexGuardConnection`（始终可用）。

  - 移除 `QueryRouter::should_use_duckdb` 调用，用户 SQL 直接在 DuckDB 执行。

  - 删除 VIEW 刷新重试逻辑：`refresh_missing_views`、`list_existing_duckdb_views`、`try_duckdb_view_refresh_retry`、`handle_duckdb_query_error` 中的 VIEW 分支。

  - 移除 DuckDB→SQLite 回退（DuckDB 是主引擎，失败直接报错）。

  - `DROP TABLE`：系统表拦截，用户表走 DuckDB + 回收站元数据写 SQLite。

  - `commands/sql.rs::execute_sql`：从 `duckdb_manager` 取连接。

- **Acceptance Criteria Addressed**: AC-3

- **Test Requirements**:

  - `rule` TR-3.1: `sql_service.rs` 无 `should_use_duckdb` 调用

  - `rule` TR-3.2: 执行 `SELECT 1` 返回 `engine: "duckdb"`

  - `rule` TR-3.3: `DROP TABLE __settings` 被拦截

- **Notes**: 查询缓存仍保留，挂在 DuckDB 结果上。

## Task 4: 导入链路改造（fast\_import 走 DuckDB）

- **Status**: `pending`

- **Priority**: high

- **Depends On**: Task 1

- **Description**:

  - `database_service.rs::fast_import_csv`/`fast_import_parquet` 签名改为 `&dyn DatabaseConnection`。

  - `commands/file.rs` 导入流程从 `duckdb_manager` 取连接。

  - 删除 `import_using_traditional_method` 回退路径。

- **Acceptance Criteria Addressed**: AC-4

- **Test Requirements**:

  - `rule` TR-4.1: `fast_import_csv` 参数类型为 `&dyn DatabaseConnection`

  - `rule` TR-4.2: `file.rs` 中无 "回退到传统方式" 代码

- **Notes**: 保留 `preview_parquet_file` 等预览函数，也走 DuckDB。

## Task 5: 元数据查询走 DuckDB

- **Status**: `pending`

- **Priority**: high

- **Depends On**: Task 1

- **Description**:

  - `commands/database.rs`：`list_tables`/`get_table_columns`/`get_table_meta`/`get_table_row_count` 改用 `duckdb_manager`。

  - `delete_table`：DuckDB 执行删表 + SQLite 写回收站元数据。

  - `commands/profile.rs::profile_table` 改用 DuckDB 连接。

  - `database_service.rs::list_tables_with_meta`/`get_table_columns`/`get_row_count`/`get_table_performance_info` 改为查 DuckDB（移除 sqlite\_master 依赖，改用 DuckDB 的 information\_schema 或 SHOW TABLES）。

- **Acceptance Criteria Addressed**: AC-5

- **Test Requirements**:

  - `rule` TR-5.1: `database.rs` 的 list\_tables 等使用 `duckdb_manager`

  - `rule` TR-5.2: DuckDB 中 `SHOW TABLES` 或 `information_schema.tables` 可正确列出用户表

- **Notes**: DuckDB 元数据查询用 `information_schema.tables` 或 `SHOW ALL TABLES`。

## Task 6: 旧数据迁移逻辑

- **Status**: `pending`

- **Priority**: high

- **Depends On**: Task 1, Task 2

- **Description**:

  - 在 `migration_service.rs` 新增 `migrate_user_tables_to_duckdb(sqlite_conn, duckdb_conn)`。

  - 启动时（项目打开后）检测 `meta.db` 中非系统表，逐表迁移到 `data.duckdb`。

  - 迁移方式：DuckDB `ATTACH` sqlite\_db（仅迁移时临时使用）→ `CREATE TABLE data.tbl AS SELECT * FROM sqlite_db.tbl` → 从 meta.db DROP。

  - 幂等：data.duckdb 已存在该表则跳过；迁移失败保留原表不删除。

- **Acceptance Criteria Addressed**: AC-6

- **Test Requirements**:

  - `rule` TR-6.1: 旧项目打开后 meta.db 用户表为空，data.duckdb 含原表

  - `rule` TR-6.2: 迁移失败时 meta.db 原表不被删除

- **Notes**: 迁移仅在首次打开旧项目时执行一次，通过 `__project_info` 标记或检测 data.duckdb 存在性判断。

## Task 7: 清理 VIEW 机制与 router

- **Status**: `pending`

- **Priority**: medium

- **Depends On**: Task 3, Task 4, Task 5

- **Description**:

  - 删除 `services/view_service.rs`。

  - 从 `services/mod.rs` 移除 `view_service` 模块声明。

  - `database/router.rs`：移除 `should_use_duckdb`、`route_table_names`，保留 `get_table_names`（改为查 DuckDB）或内联删除。

  - `commands/sql.rs::preload_duckdb` 改为 no-op（保留签名兼容前端）。

  - 清理 `lib.rs` 中 `app_handle`/DuckDB 初始化事件相关无用代码（如仍需则保留）。

- **Acceptance Criteria Addressed**: AC-7

- **Test Requirements**:

  - `rule` TR-7.1: `view_service.rs` 文件不存在

  - `rule` TR-7.2: `grep -r "ViewService" src-tauri/src` 无匹配

- **Notes**: 保留 `router.rs` 中的 `get_table_names` 或迁移到合适位置。

## Task 8: 回收站服务适配 DuckDB

- **Status**: `pending`

- **Priority**: high

- **Depends On**: Task 5

- **Description**:

  - `trash_service.rs::move_to_trash_sync`：在 DuckDB 上执行 `ALTER TABLE tbl RENAME TO __trash_<id>`（或等价），元数据写入 SQLite `__trash_metadata`。

  - `restore_from_trash`：反向 RENAME。

  - `get_table_row_count`：从 DuckDB 查行数。

  - `permanent_delete`：DuckDB DROP 表 + SQLite 删元数据。

- **Acceptance Criteria Addressed**: AC-3, AC-5

- **Test Requirements**:

  - `rule` TR-8.1: 删表后 DuckDB 中表被改名/删除，SQLite `__trash_metadata` 有记录

  - `rule` TR-8.2: 回收站恢复后 DuckDB 表名还原

- **Notes**: DuckDB 支持 `ALTER TABLE ... RENAME TO ...`。

## Task 9: 编译、类型检查与验证

- **Status**: `pending`

- **Priority**: high

- **Depends On**: Task 1-8

- **Description**:

  - 运行 `cargo check`，修复所有编译错误。

  - 运行 `npx tsc --noEmit`，确保无类型错误。

  - 运行 SQL 注入检测、敏感字符串检测等项目自检命令。

  - 手动验证：创建项目、导入 CSV、执行查询、删表、回收站恢复、切换项目。

- **Acceptance Criteria Addressed**: AC-9, AC-10

- **Test Requirements**:

  - `rule` TR-9.1: `cargo check` 退出码 0

  - `rule` TR-9.2: `npx tsc --noEmit` 退出码 0

  - `rubric` TR-9.3: 架构清晰度；scale 1-5；anchors 1=仍有ATTACH/VIEW, 3=双引擎但路由复杂, 5=职责清晰；threshold >= 4；evidence: 源码审查

- **Notes**: 编译错误可能较多，需逐轮修复。


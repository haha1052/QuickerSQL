# DuckDB 主引擎重构 - 产品需求文档

## Overview

- **Summary**: 将数据链路从"SQLite 存储业务数据 + DuckDB 内存加速"重构为"SQLite 仅系统表 + DuckDB 持久化业务数据"的双引擎并行架构。

- **Purpose**: 让 DuckDB 真正发挥列式存储与并行查询优势，解决当前 fast\_import 永远失败回退、DuckDB 每次启动重建 ATTACH/VIEW、架构意图与实现错位三大问题。

- **Target Users**: QuickerSQL 桌面应用的最终用户与维护开发者。

## Goals

- SQLite 仅负责 17 张系统表（`__xxx`）的读写与软件自身事务。

- DuckDB 以文件连接方式持久化存储所有业务数据（用户建表、CSV/Parquet 导入、查询）。

- 用户 SQL 执行不再走关键词路由，统一由 DuckDB 处理业务数据。

- 消除 ATTACH + VIEW 机制及其维护成本。

- 旧项目数据从 SQLite 自动迁移到 DuckDB。

## Non-Goals

- 不修改前端 UI 与交互逻辑。

- 不改变系统表清单与命名规范（仍为 17 张 `__xxx` 表）。

- 不引入新的数据库引擎或外部服务。

- 不重构查询缓存逻辑（仍保留，挂在 DuckDB 查询结果上）。

## Background & Context

- 当前 `TauriAppState.db_manager` 仅注册 `SqliteDriver`，连接到项目 `meta.db`，同时存放系统表与用户业务表。

- `duckdb_conn` 是独立的内存连接，通过 `ATTACH sqlite_db` + `CREATE VIEW` 透传 SQLite 数据，自身不持久化。

- `fast_import_csv`/`fast_import_parquet` 在 SQLite 连接上执行 `read_csv_auto`/`read_parquet`，SQLite 不支持这些函数，每次必失败后回退到逐行 INSERT。

- DuckDB 初始化存在三套并行实现：`lib.rs::init_duckdb`（懒加载）、`commands/sql.rs::preload_duckdb`、`commands/project.rs` 内联（switch\_project）。

- `QueryRouter::should_use_duckdb` 靠关键词（GROUP BY/JOIN/聚合）匹配决定引擎，误判率高且无法覆盖所有场景。

## Functional Requirements

- **FR-1**: `TauriAppState` 同时持有 `sqlite_manager` 与 `duckdb_manager` 两个 `SharedDatabaseManager`，分别连接项目目录下的 `meta.db`（SQLite）与 `data.duckdb`（DuckDB）。

- **FR-2**: 项目创建时同时生成 `meta.db` 与 `data.duckdb` 两个文件；项目删除/复制/导入/导出时两个文件同步处理。

- **FR-3**: 切换项目时同时 reconnect 两个 manager 到新项目的对应文件。

- **FR-4**: 用户 SQL（`execute_sql` 命令）统一在 DuckDB 上执行，不再调用 `QueryRouter::should_use_duckdb`。

- **FR-5**: 系统表（`__` 前缀）的 DDL/DML 由内部服务直接走 `sqlite_manager`，不经过用户 SQL 路径。

- **FR-6**: `DROP TABLE` 用户表在 DuckDB 上执行（改名/删除），回收站元数据写入 SQLite 的 `__trash_metadata`。

- **FR-7**: `fast_import_csv`/`fast_import_parquet` 接收 DuckDB 连接，直接执行 `read_csv_auto`/`read_parquet`，不再有失败回退路径。

- **FR-8**: `list_tables`/`get_table_columns`/`get_table_meta`/`get_table_row_count`/`profile_table` 等元数据查询走 DuckDB。

- **FR-9**: 启动时若检测到 `meta.db` 中存在非系统用户表，自动将其迁移到 `data.duckdb` 并从 `meta.db` 删除（幂等）。

- **FR-10**: 删除 `view_service.rs` 与 ATTACH/VIEW 机制；`router.rs` 移除关键词路由逻辑。

- **FR-11**: `preload_duckdb` 命令保留签名但改为 no-op（前端兼容），不再执行内存连接初始化。

## Non-Functional Requirements

- **NFR-1**: DuckDB 文件连接启动耗时 < 50ms（无需 ATTACH/VIEW 重建）。

- **NFR-2**: CSV/Parquet 导入走 DuckDB 原生函数，不再触发回退日志。

- **NFR-3**: 所有 Rust 代码遵守 SQL 注入防护规则（参数化查询 + `SqlIdentifier`）。

- **NFR-4**: `cargo check` 与 `npx tsc --noEmit` 均通过。

- **NFR-5**: 旧项目数据迁移不丢失，迁移失败时保留原数据不删除。

## Constraints

- **Technical**: DuckDB 单写者模型；本应用已有 `query_semaphore` 做并发控制。

- **Business**: 必须兼容现有项目目录结构，用户数据不可丢失。

- **Dependencies**: 依赖现有 `SqliteDriver`、`DuckDbDriver`、`DatabaseManager`、`SqlIdentifier`。

## Assumptions

- DuckDB 文件连接（`DuckDbConn::open(path)`）可正常持久化读写（已在 `duckdb.rs` 中实现 `connect`/`create_database`）。

- 回收站"改名"机制可在 DuckDB 上等价实现（`ALTER TABLE RENAME` 或复制后删除）。

- 用户不会直接在 SQL 编辑器中查询系统表（系统表访问走内部服务）。

## Acceptance Criteria

### AC-1: 双连接结构

- **Type**: `rule`

- **Given**: 应用启动并打开一个项目

- **When**: 检查 `TauriAppState` 字段

- **Then**: 存在 `sqlite_manager`（连 meta.db）与 `duckdb_manager`（连 data.duckdb），且 `duckdb_conn` 内存连接字段已移除

- **Pass Condition**: `lib.rs` 中 `TauriAppState` 结构体含 `duckdb_manager`，不含 `duckdb_conn`

- **Evidence**: `lib.rs` 源码 + `cargo check` 通过

### AC-2: 项目双文件生命周期

- **Type**: `rule`

- **Given**: 创建/删除/复制一个项目

- **When**: 查看项目目录

- **Then**: 目录下同时存在 `meta.db` 与 `data.duckdb`，且随项目操作同步增删

- **Pass Condition**: `project_service.rs` 的 create/delete/duplicate 均处理两个文件

- **Evidence**: 源码审查 + 手动创建项目验证

### AC-3: 用户 SQL 走 DuckDB

- **Type**: `rule`

- **Given**: 用户在 SQL 编辑器执行 `CREATE TABLE`/`SELECT`/`INSERT`

- **When**: 追踪执行链路

- **Then**: SQL 在 `duckdb_manager` 连接上执行，不经过 `QueryRouter::should_use_duckdb`

- **Pass Condition**: `sql_service.rs` 中无 `QueryRouter::should_use_duckdb` 调用；`execute_sql` 从 `duckdb_manager` 取连接

- **Evidence**: 源码审查 + 执行 `SELECT 1` 验证 engine 字段为 "duckdb"

### AC-4: 导入直接走 DuckDB

- **Type**: `rule`

- **Given**: 导入一个 CSV 文件

- **When**: 执行导入

- **Then**: `fast_import_csv` 在 DuckDB 连接上执行 `read_csv_auto`，无 "回退到传统方式" 日志

- **Pass Condition**: `database_service.rs` 的 `fast_import_csv` 接收 `&dyn DatabaseConnection`；`file.rs` 无回退分支

- **Evidence**: 源码审查 + 导入 CSV 验证日志无 warn

### AC-5: 元数据查询走 DuckDB

- **Type**: `rule`

- **Given**: 打开表列表/查看表结构/探查表

- **When**: 调用 `list_tables`/`get_table_columns`/`profile_table`

- **Then**: 从 DuckDB 连接查询，返回 DuckDB 中的用户表

- **Pass Condition**: `commands/database.rs`、`commands/profile.rs` 使用 `duckdb_manager`

- **Evidence**: 源码审查

### AC-6: 数据迁移

- **Type**: `rule`

- **Given**: 一个旧项目（meta.db 中含用户表，无 data.duckdb）

- **When**: 打开该项目

- **Then**: 用户表被迁移到 data.duckdb，meta.db 中仅余系统表

- **Pass Condition**: 启动后 `list_user_table_names(meta.db)` 为空，data.duckdb 含原用户表

- **Evidence**: 迁移逻辑源码 + 旧项目测试

### AC-7: VIEW 机制已移除

- **Type**: `rule`

- **Given**: 代码库

- **When**: 搜索 `ViewService`、`ATTACH`、`CREATE VIEW`、`sqlite_db`

- **Then**: 无业务代码引用（仅可能在注释/历史中）

- **Pass Condition**: `view_service.rs` 已删除，`services/mod.rs` 无 `view_service` 声明

- **Evidence**: `grep` 搜索结果为空

### AC-8: 系统表隔离

- **Type**: `rule`

- **Given**: 系统表服务（settings/audit/dashboard 等）

- **When**: 执行系统表读写

- **Then**: 通过 `sqlite_manager` 连接访问 meta.db

- **Pass Condition**: 系统表 ensure 函数与 service 调用使用 sqlite 连接

- **Evidence**: 源码审查

### AC-9: 编译与类型检查通过

- **Type**: `rule`

- **Given**: 重构完成

- **When**: 运行 `cargo check` 与 `npx tsc --noEmit`

- **Then**: 均无错误

- **Pass Condition**: 两条命令退出码为 0

- **Evidence**: 命令输出

### AC-10: 架构清晰度

- **Type**: `rubric`

- **Dimension**: 数据链路职责分离的清晰程度

- **Scale**: 1-5

- **Anchors**: 1 = 仍有 ATTACH/VIEW 或关键词路由；3 = 双引擎但路由逻辑复杂；5 = 系统表→SQLite、业务表→DuckDB 一目了然，无中间态

- **Pass Threshold**: >= 4

- **Evidence**: 源码审查 `lib.rs`、`sql_service.rs`、`router.rs`

## Open Questions

- [ ] 回收站在 DuckDB 上的实现方式：`ALTER TABLE RENAME TO __trash_xxx` 还是"复制到 \_\_trash\_xxx + DROP"？（倾向 RENAME，DuckDB 支持）

- [ ] 迁移过程中若 DuckDB 不支持 SQLite 某列类型，是否需要类型映射？（DuckDB 类型系统更丰富，通常可隐式转换）


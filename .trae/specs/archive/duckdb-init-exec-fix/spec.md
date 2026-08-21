# DuckDB 初始化与执行链路修复 Spec

## Why
DuckDB 预加载获取到 0 个用户表，导致首次分析查询时 VIEW 不存在；VIEW 刷新后重试查询时 DuckDB crate 内部 panic；PRAGMA busy_timeout 执行方式错误。这三个问题导致分析查询始终回退到 SQLite，DuckDB 形同虚设。

## What Changes
- 修复预加载表名查询：移除 `AND name NOT LIKE '__%'` 过滤，与 `get_table_names` 保持一致
- 修复 PRAGMA busy_timeout 执行方式：用 `query()` 替代 `execute()`，因为 PRAGMA 可能返回结果行
- 修复 DuckDB query panic：跳过不稳定的 `stmt.query([])`，直接使用 `query_arrow([])` 作为主路径
- 查询结果增加 `engine` 字段，前端显示执行引擎标识（DuckDB / SQLite）

## Impact
- Affected code: `src-tauri/src/commands/sql.rs`（预加载表名查询）、`src-tauri/src/services/sql_service.rs`（PRAGMA 执行 + 引擎标识）、`src-tauri/src/database/duckdb.rs`（query 方法）、`src-tauri/src/models/database.rs`（SqlStatementResult 新增字段）、`src/types/database.ts`（前端类型）、`src/components/`（结果标签展示）

## ADDED Requirements

### Requirement: DuckDB 预加载必须获取到全部用户表
预加载时的表名查询必须与 `QueryRouter::get_table_names` 使用相同的 SQL，确保获取到所有非系统表（包括 `__` 前缀的表），从而在预加载阶段就创建全部 VIEW。

#### Scenario: 预加载时数据库有 32 个表
- **WHEN** 预加载执行时 SQLite 中有 32 个表
- **THEN** 日志显示 "从 SQLite 获取到 32 个用户表"
- **AND** 日志显示 "已创建 32/32 个 VIEW"

### Requirement: PRAGMA 语句必须用 query 而非 execute
SQLite 的 PRAGMA 语句可能返回结果行，`execute()` 遇到结果行会报错 "Execute returned results"。

#### Scenario: 设置 busy_timeout
- **WHEN** 执行 `PRAGMA busy_timeout = 60000;`
- **THEN** 不产生 "Execute returned results" 错误

### Requirement: DuckDB query 必须不 panic
DuckDB 的 `stmt.query([])` 在某些情况下内部 unwrap None 导致 panic。改用 `query_arrow([])` 作为主查询路径，避免触发该 bug。

#### Scenario: VIEW 刷新后重试分析查询
- **WHEN** VIEW 刷新成功后重试 `SELECT department, COUNT(*) FROM employees GROUP BY department`
- **THEN** 查询成功返回结果，不发生 panic
- **AND** 不回退到 SQLite

### Requirement: 查询结果必须显示执行引擎
每条 SQL 执行结果必须包含 `engine` 字段，标识是由 DuckDB 还是 SQLite 执行的。前端结果标签旁显示引擎徽章。

#### Scenario: 执行分析查询
- **WHEN** 用户执行包含 GROUP BY 的分析查询
- **THEN** 结果数据中 engine 字段为 "duckdb"
- **AND** 前端结果标签旁显示 "DuckDB" 徽章

#### Scenario: 执行写操作
- **WHEN** 用户执行 INSERT/UPDATE/DELETE
- **THEN** 结果数据中 engine 字段为 "sqlite"
- **AND** 前端结果标签旁显示 "SQLite" 徽章

# Fix EXPLAIN QUERY PLAN Display — Spec

## Why
当前执行计划功能生成的 `EXPLAIN SELECT ...` 被查询路由判定为"简单查询"（不含 GROUP BY/JOIN/聚合函数），从而路由到 SQLite 执行。SQLite 的 `EXPLAIN` 返回底层虚拟机操作码（OpenRead、Rewind、Column 等），完全不可读。用户期望看到类似 PL/SQL Developer 的人类友好执行计划。

根本问题不在展示格式，而在**执行引擎路由**：EXPLAIN 语句应当像原查询一样被正确路由到 DuckDB（如果原查询含分析特征），或至少优先使用 SQLite 的 `EXPLAIN QUERY PLAN` 而非 `EXPLAIN`。

## What Changes
1. **后端路由修复**：修改 `database/router.rs` 的 `should_use_duckdb`，对以 `EXPLAIN` 或 `EXPLAIN QUERY PLAN` 开头的 SQL，先剥离前缀再判断原查询是否含 DuckDB 分析特征
2. **前端前缀调整**：保留 `EXPLAIN ` 前缀（DuckDB 的 EXPLAIN 返回人类友好计划），但将结果识别为执行计划并用特殊方式渲染
3. **结果渲染**：DuckDB EXPLAIN 返回的是格式化计划文本（多列），前端用预格式化文本/树形结构展示，而非普通数据表格

## Impact
- 受影响文件：`src-tauri/src/database/router.rs`、`src/components/workspace/PanelManager.tsx`、`src/components/sql/QueryResultItem.tsx`
- 新建文件：`src/components/sql/QueryPlanTree.tsx`
- 执行计划快捷键行为不变，但输出内容从 SQLite 操作码变为 DuckDB 物理计划

## ADDED Requirements
### Requirement: EXPLAIN Routing to DuckDB
The system SHALL route EXPLAIN statements to the same engine as the underlying query would use.

#### Scenario: EXPLAIN on analytical query
- **WHEN** user runs `EXPLAIN SELECT ... GROUP BY ...` or `EXPLAIN SELECT ... JOIN ...`
- **THEN** the EXPLAIN statement is routed to DuckDB (same as the original query)
- **AND** DuckDB returns a human-readable physical query plan

#### Scenario: EXPLAIN on simple query
- **WHEN** user runs `EXPLAIN SELECT * FROM table LIMIT 100`
- **THEN** since the underlying query is simple (routed to SQLite), EXPLAIN also routes to SQLite
- **AND** SQLite returns `EXPLAIN QUERY PLAN` output (not raw opcodes)

### Requirement: Plan Result Rendering
The system SHALL render EXPLAIN results as formatted text/tree, not a flat data table.

#### Scenario: DuckDB plan received
- **WHEN** a DuckDB EXPLAIN result is received (detected by statement prefix)
- **THEN** it renders as a pre-formatted tree with indentation and operation hierarchy

#### Scenario: Normal query unaffected
- **WHEN** a regular SELECT/INSERT/UPDATE result is received
- **THEN** it continues to render as a normal data table

## MODIFIED Requirements
### Requirement: Query Router Engine Selection
- **Before**: `should_use_duckdb` checks the full SQL including EXPLAIN prefix
- **After**: `should_use_duckdb` strips `EXPLAIN` / `EXPLAIN QUERY PLAN` prefix before checking analytical keywords

### Requirement: Explain Prefix Logic
- **Before**: `addExplainPrefix` adds `EXPLAIN ` prefix ( SQLite returns opcodes)
- **After**: `addExplainPrefix` behavior adjusted based on query complexity; for simple queries, use `EXPLAIN QUERY PLAN ` (SQLite) instead

# DuckDB SQL 执行链路修复方案

## Overview
- **Summary**: DuckDB 执行链路存在多个问题导致分析查询无法正确路由到 DuckDB：1) DuckDB query() 内部 unwrap() panic；2) VIEW 创建失败（表名查询方式错误）；3) 缺乏可靠的故障恢复机制。
- **Purpose**: 修复 SQL 执行链路，确保分析查询能正确路由到 DuckDB 执行，同时保持与 SQLite 的兼容性。
- **Target Users**: 所有需要执行分析查询的用户

## Goals
- G1: 修复 DuckDB VIEW 创建失败问题，确保初始化时能正确创建所有 VIEW
- G2: 修复 DuckDB query() panic 问题，添加完善的错误处理
- G3: 确保分析查询（GROUP BY/JOIN 等）能正确路由到 DuckDB 并返回结果
- G4: 保持与现有 SQLite 查询的完全兼容性

## Non-Goals
- 不修改前端组件逻辑
- 不改变 SQL 路由规则（保持现有规则）
- 不引入新的数据库引擎

## Background & Context

### 当前 SQL 执行链路
```
前端 invoke("execute_sql")
    ↓
commands/sql.rs: execute_sql()
    ↓ 获取 SQLite/DuckDB 连接
sql_service.rs: execute_sql_batch()
    ↓ 拆分 SQL
    ↓ 路由判断
    ├── DuckDB 路径 → duckdb_conn.query() → 返回结果
    └── SQLite 路径 → sqlite_conn.query() → 返回结果
```

### 发现的问题
1. **panic 问题**：DuckDB `query()` 内部调用 `unwrap()`，遇到不支持的语法时 panic
2. **VIEW 创建失败**：原代码使用 `sqlite_db.sqlite_master` 查询表名，但 DuckDB 的 SQLite 扩展不暴露此表
3. **信息模式兼容性**：使用 `information_schema.tables` 后，需要验证是否能正确获取 ATTACH 的 SQLite 数据库中的表

## Functional Requirements

### FR-1: 修复 DuckDB VIEW 创建
- 验证 `information_schema.tables` 在 DuckDB ATTACH SQLite 后的行为
- 如果 `information_schema.tables` 不可用，提供备用方案

### FR-2: 添加 panic 安全保护
- 在 DuckDB 查询前添加更完善的 panic 保护
- panic 后自动清理并回退到 SQLite

### FR-3: 验证 DuckDB 查询执行
- 确保分析查询能正确在 DuckDB 中执行
- 处理 DuckDB 特有的语法差异

## Acceptance Criteria

### AC-1: DuckDB VIEW 创建成功
- **Given**: SQLite 数据库中存在表（如 employees、departments）
- **When**: DuckDB 初始化并 ATTACH SQLite 数据库
- **Then**: 日志显示成功创建 X/Y 个 VIEW（X > 0）
- **Verification**: `human-judgment`

### AC-2: 分析查询走 DuckDB
- **Given**: DuckDB 已成功初始化
- **When**: 执行含 GROUP BY 的查询
- **Then**: EXPLAIN 输出为 DuckDB 格式（树形结构）
- **Verification**: `human-judgment`

### AC-3: 无 panic
- **Given**: 执行任何 SQL 查询
- **When**: 查询执行过程中
- **Then**: 不会出现 `Option::unwrap()` panic
- **Verification**: `programmatic`

## Open Questions
- [ ] Q1: DuckDB 1.x 的 SQLite 扩展是否支持 `information_schema.tables`？
- [ ] Q2: DuckDB 的 `query()` 在什么情况下会 panic？

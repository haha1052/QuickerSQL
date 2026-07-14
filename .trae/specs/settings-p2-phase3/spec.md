# 设置系统 P2 阶段 3 — 数据库分类完善 Spec

## Why
数据库分类当前实现率仅 33.3%（2/6 项），4 项设置项未实现：autoConnect、connectionTimeout、queryTimeout、enableExplainPlan。这些设置项对数据库连接和查询控制至关重要，影响用户的工作效率和数据库安全性。

## What Changes
- 实现 `database.autoConnect` — 启动时自动连接最近使用的数据库
- 实现 `database.connectionTimeout` — 连接超时控制（SQLite 限制说明）
- 实现 `database.queryTimeout` — 查询执行超时控制
- 实现 `database.enableExplainPlan` — 执行计划展示功能
- 更新 `implemented_settings()` 标记

## Impact
- Affected specs: settings system, database connection management
- Affected code:
  - `src-tauri/src/lib.rs` — 启动时 autoConnect 逻辑
  - `src-tauri/src/services/database_service.rs` — 连接超时
  - `src-tauri/src/services/sql_service.rs` — 查询超时
  - `src/context/ShortcutProvider.tsx` — explainPlan 快捷键已有

## ADDED Requirements

### Requirement: Auto Connect on Startup
系统 SHALL 在启动时读取 `database.autoConnect` 设置，如果为 true，自动连接最近使用的数据库路径。

#### Scenario: Auto connect enabled
- **WHEN** 用户启动应用且 `autoConnect=true`
- **THEN** 系统自动连接最近使用的数据库，无需用户手动操作

#### Scenario: Auto connect disabled
- **WHEN** 用户启动应用且 `autoConnect=false`
- **THEN** 系统不自动连接，用户需要手动选择数据库

### Requirement: Connection Timeout
系统 SHALL 读取 `database.connectionTimeout` 设置，控制数据库连接超时时间。

#### Scenario: SQLite connection
- **WHEN** 用户连接 SQLite 数据库
- **THEN** 系统记录设置值，但由于 SQLite 连接特性，实际超时效果有限（记录在文档中说明）

### Requirement: Query Timeout
系统 SHALL 读取 `database.queryTimeout` 设置，控制 SQL 查询执行超时时间。

#### Scenario: Query execution with timeout
- **WHEN** 用户执行 SQL 查询且设置了 queryTimeout
- **THEN** 查询超过指定时间后自动中断，返回超时错误

### Requirement: Explain Plan
系统 SHALL 读取 `database.enableExplainPlan` 设置，提供 SQL 执行计划分析功能。

#### Scenario: Explain plan enabled
- **WHEN** 用户启用 `enableExplainPlan=true` 且使用快捷键 Ctrl+Shift+E
- **THEN** 系统显示当前 SQL 的执行计划分析结果

## MODIFIED Requirements

### Requirement: implemented_settings
`implemented_settings()` 函数 SHALL 包含以下数据库设置项：
- `database.autoConnect`
- `database.connectionTimeout`（标记为部分实现）
- `database.queryTimeout`
- `database.enableExplainPlan`

## REMOVED Requirements
None
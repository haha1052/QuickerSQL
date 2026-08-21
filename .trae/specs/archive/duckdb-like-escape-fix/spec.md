# DuckDB SQL LIKE 通配符转义修复与透明窗口成功率优化 Spec

## Why
上次修复引入了 SQL LIKE 通配符 bug：`NOT LIKE '__%'` 中的 `_` 在 SQL LIKE 中是单字符通配符，导致该条件匹配"任意两个字符开头的表名"，排除了所有用户表。同时 Win10 环境下透明窗口成功率始终 75%，因 `DWMWA_TRANSITIONS_FORCEDISABLED` 在 Win10 不可用但被计入成功率。

## What Changes
- 修复 3 处 SQL LIKE 中的 `_` 通配符问题：使用 `ESCAPE` 子句转义下划线
- 修复 `database_service.rs` 中参数化查询的 `_` 通配符问题
- Win10 环境下透明窗口成功率计算排除不可用的 DWM 属性

## Impact
- Affected code: `commands/sql.rs`, `database/router.rs`, `lib.rs`, `services/database_service.rs`, `commands/startup.rs`

## ADDED Requirements

### Requirement: SQL LIKE 下划线转义
所有使用 `NOT LIKE '__%'` 过滤系统表的地方，必须使用 `ESCAPE` 子句转义下划线字符，确保 `_` 被当作字面量而非通配符。

#### Scenario: 正确过滤系统表
- **WHEN** 执行 `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '\_\_%' ESCAPE '\'`
- **THEN** 只排除以 `__` 开头的表名，保留所有用户表

### Requirement: 透明窗口成功率 Win10 适配
Win10 环境下，`DWMWA_TRANSITIONS_FORCEDISABLED` 失败是预期行为，不应降低成功率。

#### Scenario: Win10 下成功率达 100%
- **WHEN** Win10 环境下所有可用 DWM 属性设置成功
- **THEN** 成功率显示 100.0%（排除 Win10 不支持的属性）

## MODIFIED Requirements
无

## REMOVED Requirements
无

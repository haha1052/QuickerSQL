# 项目切换后 DuckDB 立即初始化 - 产品需求文档

## Why
项目切换时 `set_db_path` 会清空旧的 DuckDB 连接，但不会重新初始化。导致切换后首次执行分析查询时触发懒加载（日志：`[DuckDB] 首次使用，开始懒初始化...`），用户需等待初始化完成才能得到结果。应用启动时的 5 秒延时预加载机制不覆盖项目切换场景。

## What Changes
- 后端 `switch_project` 命令在完成 SQLite 连接切换后，**立即异步触发 DuckDB 重新初始化**（复用 `preload_duckdb` 逻辑）
- 前端 `handleProjectSwitchRefresh` 在并行刷新阶段**追加调用 `preloadDuckdb()`**，确保切换后 DuckDB 可用
- **不修改**应用启动时的 5 秒延时预加载逻辑（`AppWrapper.tsx` 保持不变）
- **不修改** `set_db_path` 方法本身（仍负责清空旧连接 + 更新路径）

## Impact
- Affected specs: `duckdb-preload`（预加载机制扩展到项目切换场景）
- Affected code:
  - `src-tauri/src/commands/project.rs` — `switch_project` 命令末尾追加预加载触发
  - `src/App.tsx` — `handleProjectSwitchRefresh` 追加 `preloadDuckdb()` 调用

## ADDED Requirements

### Requirement: 项目切换后立即初始化 DuckDB

#### Scenario: 项目切换成功后 DuckDB 自动初始化
- **WHEN** 用户切换到项目 B（从项目 A）
- **THEN** 后端完成 SQLite 连接切换后，立即异步触发 DuckDB 初始化（ATTACH 新 SQLite + 创建 VIEW）
- **AND** 前端 `handleProjectSwitchRefresh` 同时调用 `preloadDuckdb()` 作为双重保障

#### Scenario: 项目切换后 DuckDB 初始化失败
- **WHEN** 项目切换后 DuckDB 初始化失败
- **THEN** 不阻塞项目切换流程，后续 SQL 查询回退到懒加载模式

#### Scenario: 应用启动预加载不受影响
- **WHEN** 应用首次启动
- **THEN** 仍然使用 `AppWrapper.tsx` 中 5 秒延时预加载逻辑，行为不变

## MODIFIED Requirements

### Requirement: switch_project 命令
`switch_project` 命令在完成以下步骤后追加 DuckDB 预加载：
1. 更新 `db_path`（清空旧 DuckDB 连接）
2. 关闭旧 SQLite 连接
3. 建立新 SQLite 连接
4. 系统表初始化 + 审计日志
5. **新增：异步触发 DuckDB 重新初始化**（不阻塞命令返回）

## Non-Goals
- 不修改应用启动时的 5 秒延时预加载逻辑
- 不修改 `set_db_path` 方法本身
- 不修改 DuckDB 初始化核心逻辑（`init_duckdb` / `preload_duckdb`）
- 不修改 SQL 路由规则
- 不修改用户表刷新逻辑（`list_tables` 从 SQLite 获取，与 DuckDB 无关）

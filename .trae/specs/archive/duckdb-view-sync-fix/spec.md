# DuckDB VIEW 同步修复 - Product Requirement Document

## Overview
- **Summary**: 修复 DuckDB VIEW 同步机制，确保分析查询（JOIN/GROUP BY/窗口函数等）能正确路由到 DuckDB 执行，避免因 VIEW 缺失导致查询回退到 SQLite 而性能下降。
- **Purpose**: 解决用户导入数据后，含 JOIN 的分析查询仍然走 SQLite 执行的问题，充分发挥 DuckDB 在分析查询上的性能优势。
- **Target Users**: 所有使用 QuickerSQL 进行数据分析的用户，尤其是导入新表后进行 JOIN/聚合查询的用户。

## Goals
- G1：DuckDB 执行失败回退到 SQLite 前，先尝试刷新缺失的 VIEW 并重试一次
- G2：导入新表时，如果 DuckDB 已初始化则刷新单个表的 VIEW（已有逻辑保持）；如果未初始化则不做额外操作（初始化时会全量刷新）
- G3：确保 VIEW 同步机制不影响其他功能（导入、查询、缓存等）
- G4：保持现有回退机制作为最终兜底（DuckDB 彻底失败时仍回退到 SQLite）

## Non-Goals (Out of Scope)
- ❌ 不修改 SQL 路由规则（router.rs 的 should_use_duckdb 逻辑不变）
- ❌ 不修改查询缓存逻辑
- ❌ 不修改 SQLite 执行逻辑
- ❌ 不新增用户可见的 UI 功能或设置项
- ❌ 不重构 DuckDB 连接管理（懒加载机制保持不变）

## Background & Context

### 当前架构
- QuickerSQL 使用 SQLite（写操作 + 简单查询）+ DuckDB（分析查询）双引擎架构
- DuckDB 通过 ATTACH 方式连接 SQLite 数据库，通过 VIEW 机制访问 SQLite 的表
- VIEW 机制：为每个 SQLite 用户表在 DuckDB 中创建同名 VIEW，指向 `sqlite_db.表名`
- DuckDB 采用懒加载策略：首次执行分析查询时才初始化

### 问题现象
1. 用户导入 CSV 数据后，执行含 JOIN 的三表查询
2. 按路由规则，含 JOIN 的查询应该走 DuckDB
3. 但实际 EXPLAIN 输出显示是 SQLite 的 VDBE 字节码，说明查询走了 SQLite
4. 原因：DuckDB 执行失败（VIEW 缺失或其他原因）后自动回退到 SQLite

### 根因分析
- **场景 A**：DuckDB 初始化时就创建了所有表的 VIEW，初始化后导入的新表也会在导入后刷新 VIEW
- **场景 B**：导入数据时 DuckDB 尚未初始化，`duckdb_conn_opt` 为 None，导入后不刷新 VIEW；但 DuckDB 首次初始化时会全量创建所有表的 VIEW，这个场景应该没问题
- **真正的问题**：DuckDB 执行失败后直接回退到 SQLite，没有尝试诊断失败原因（是否是 VIEW 缺失）并重试
- 即使 VIEW 是同步的，也可能因为其他原因（字段类型、SQL 语法差异）导致 DuckDB 执行失败，此时回退是正确的
- 但如果是 VIEW 缺失导致的失败，应该可以通过刷新 VIEW 后重试来解决

### 相关代码位置
- 路由逻辑：`src-tauri/src/database/router.rs`
- SQL 执行：`src-tauri/src/services/sql_service.rs`
- VIEW 服务：`src-tauri/src/services/view_service.rs`
- DuckDB 初始化：`src-tauri/src/lib.rs`（init_duckdb、get_duckdb_connection）
- 导入后 VIEW 刷新：`src-tauri/src/commands/file.rs`

## Functional Requirements

- **FR-1**：DuckDB 执行失败时，先检测失败原因是否与表/VIEW 相关；如果是，刷新所有 VIEW 后重试一次
- **FR-2**：VIEW 刷新重试仅在第一次失败时触发，避免无限重试循环
- **FR-3**：如果重试后仍然失败，再回退到 SQLite（保持原有兜底逻辑）
- **FR-4**：刷新 VIEW 的逻辑复用现有 ViewService::refresh_all_views，不新增重复代码
- **FR-5**：所有失败重试都有明确的日志记录，便于排查问题

## Non-Functional Requirements

- **NFR-1**：性能影响可忽略 — 正常情况下（DuckDB 执行成功），不增加任何额外开销
- **NFR-2**：失败重试的额外开销仅限一次 VIEW 刷新（< 100ms），用户感知不明显
- **NFR-3**：不引入新的 SQL 注入风险 — VIEW 刷新使用 SqlIdentifier 安全校验
- **NFR-4**：向下兼容 — 所有现有功能（导入、查询、缓存、回退）行为保持不变

## Constraints

- **Technical**: 
  - 必须保持 DuckDB 懒加载机制不变
  - 必须保持双引擎回退机制作为最终兜底
  - 修改仅限 sql_service.rs、view_service.rs 等 service 层，不涉及 commands 层
- **Business**: 
  - 不影响现有用户使用习惯
  - 不新增 UI 交互
- **Dependencies**: 
  - 依赖现有 ViewService::refresh_all_views 接口
  - 依赖现有 DuckDB 连接管理

## Assumptions

- 假设 DuckDB 执行失败时，可以通过错误信息判断是否与表/VIEW 相关（如 "Table not found"、"View not found"）
- 假设刷新 VIEW 后，之前失败的查询大概率能成功（如果失败原因确实是 VIEW 缺失）
- 假设用户导入数据后，大多数情况下 VIEW 同步是正确的，失败是少数情况
- 假设一次刷新重试足以解决 VIEW 不同步问题

## Acceptance Criteria

### AC-1：DuckDB 失败后自动刷新 VIEW 并重试
- **Given**: DuckDB 中某个表的 VIEW 缺失，用户执行一个含 JOIN 的分析查询
- **When**: 查询被路由到 DuckDB 执行
- **Then**: DuckDB 执行失败 → 自动刷新所有 VIEW → 重试查询 → 查询成功
- **Verification**: `programmatic`
- **Notes**: 可以通过手动删除某个 VIEW 来模拟测试

### AC-2：刷新重试只触发一次
- **Given**: DuckDB 查询失败原因不是 VIEW 缺失（而是语法错误等）
- **When**: 查询被路由到 DuckDB 执行
- **Then**: 刷新 VIEW 后重试仍然失败 → 回退到 SQLite → 不会无限重试
- **Verification**: `programmatic`
- **Notes**: 确保不会因为刷新 VIEW 导致死循环

### AC-3：正常查询不受影响
- **Given**: DuckDB VIEW 同步正常
- **When**: 用户执行任意分析查询
- **Then**: 查询直接在 DuckDB 执行成功，无额外开销
- **Verification**: `programmatic`
- **Notes**: 性能对比测试，确保正常路径无性能退化

### AC-4：SQLite 回退机制仍然有效
- **Given**: DuckDB 查询因为语法不支持等原因失败（非 VIEW 问题）
- **When**: 刷新 VIEW 后重试仍然失败
- **Then**: 查询最终回退到 SQLite 执行，返回正确结果
- **Verification**: `programmatic`
- **Notes**: 保持原有兜底逻辑不变

### AC-5：导入后 VIEW 同步逻辑保持不变
- **Given**: DuckDB 已初始化，用户导入一个新表
- **When**: 导入完成
- **Then**: 新表的 VIEW 被正确创建，导入前后的行为一致
- **Verification**: `programmatic`
- **Notes**: 不修改导入流程的 VIEW 刷新逻辑

### AC-6：代码编译通过且无新增警告
- **Given**: 所有修改完成
- **When**: 执行 cargo check --quiet
- **Then**: 编译通过，无 error，无新增 warning
- **Verification**: `programmatic`

## Open Questions

- [ ] Q1：DuckDB 错误信息中，哪些错误码/关键字表示是 VIEW/表缺失？需要实际测试确认
- [ ] Q2：是否需要区分"表缺失"和"VIEW 缺失"？还是统一刷新所有 VIEW 即可？

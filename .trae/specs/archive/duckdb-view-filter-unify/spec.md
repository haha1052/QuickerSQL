# DuckDB VIEW 同步表过滤统一修复 — Product Requirement Document

## Overview
- **Summary**: 统一 DuckDB VIEW 同步机制中用户表过滤逻辑，确保所有获取表名的地方都正确排除系统表（`__` 前缀）和回收站表（`__trash_` 前缀），避免 DuckDB 预加载、VIEW 刷新、SQL 路由等场景下系统表被错误同步。
- **Purpose**: 解决用户反馈的"只有 3 个用户表但系统显示 21 张表"问题，根因是多个代码路径中的表名获取逻辑不一致，部分路径未排除系统表。
- **Target Users**: QuickerSQL 所有用户

## Goals
- G1: 统一所有获取用户表名的代码路径，确保都排除 `__` 前缀的系统表和 `sqlite_` 前缀的内置表
- G2: DuckDB VIEW 同步只针对用户业务表，不同步系统表
- G3: 消除启动日志中的 DWM 警告噪音，Win10 环境下 DWM 不支持的属性降级为 debug 日志

## Non-Goals (Out of Scope)
- ❌ 不修改系统表命名规范（仍以 `__` 开头）
- ❌ 不重构整个 VIEW 同步机制架构
- ❌ 不新增系统表的 DuckDB 访问支持
- ❌ 不修改数据库迁移流程

## Background & Context
### 当前存在的问题：
1. 用户数据库中只有 3 个用户表（`departments`、`employees`、`salary_adjustments`），但 DuckDB VIEW 刷新时创建了 21 个 VIEW，包括所有系统表都被同步了。

### 根因分析：
代码中存在多个获取表名的地方，过滤逻辑不一致：

| 位置 | 文件:行号 | 排除 sqlite_ | 排除系统表(__) | 状态 |
|------|-----------|------------|------------|------|
| DuckDB 预加载 | commands/sql.rs:330 | ✅ | ✅ | 已修复 |
| DuckDB 懒初始化 | lib.rs:392 | ✅ | ✅ | 正确 |
| QueryRouter.get_table_names | database/router.rs:72 | ✅ | ❌ | **有问题 |
| DatabaseService.list_tables_with_meta | services/database_service.rs:25 | ✅ | 部分（仅排除 __trash_） | 设计如此但需确认 |
| DatabaseService.list_user_table_names | services/database_service.rs:174 | ✅ | ✅ | 正确 |

### 影响范围：
- `router.rs 的 `get_table_names` 被 `sql_service.rs` 用于 VIEW 刷新时调用
- 导致 VIEW 刷新时会把系统表也同步到 DuckDB，浪费内存和性能损耗
- 也导致用户表数量统计不准确

## Functional Requirements
- **FR-1**: 统一 `QueryRouter::get_table_names()` 函数增加系统表过滤逻辑，排除 `__` 前缀的表
- **FR-2**: 确保 `database_service.rs 中 `list_tables_with_meta` 的过滤逻辑与系统表定义一致
- **FR-3**: DWM 透明窗口警告在 Win10 环境下降级为 debug 级别日志
- **FR-4**: 所有获取用户表名的地方使用统一的过滤规则：排除 `sqlite_%` AND `__%`

## Non-Functional Requirements
- **NFR-1**: 性能：表过滤应在 SQL 层面完成（NOT LIKE），避免 Rust 层二次过滤
- **NFR-2**: 一致性：所有路径使用相同的过滤规则，避免不一致
- **NFR-3**: 可维护性：使用 SqlIdentifier::is_system_table() 作为唯一真值来源

## Constraints
- **Technical**: Rust + Tauri + SQLite/DuckDB 混合架构
- **Business**: 不破坏现有功能，系统表仍需通过 SQLite 正常访问
- **Dependencies**: 依赖 SqlIdentifier::is_system_table() 作为系统表判断的唯一标准

## Assumptions
- 系统表都以 `__` 开头（双下划线）
- SQLite 内置表都以 `sqlite_` 开头
- 回收站表也以 `__trash_` 开头，属于系统表范畴
- 用户业务表都不以 `__` 或 `sqlite_` 开头

## Acceptance Criteria

### AC-1: QueryRouter.get_table_names 排除系统表
- **Given**: 数据库中存在系统表和用户表
- **When**: 调用 QueryRouter::get_table_names() 获取表名列表
- **Then**: 返回的列表中只包含用户业务表，不包含任何 `__` 前缀的系统表
- **Verification**: `programmatic`
- **Notes**: 通过单元测试验证

### AC-2: VIEW 刷新只同步用户表
- **Given**: 数据库中有 3 个用户表和 18 个系统表
- **When**: 触发 DuckDB VIEW 刷新（如查询不存在的表）
- **Then**: VIEW 刷新日志显示成功创建 3/3 个 VIEW
- **Verification**: `programmatic`
- **Notes**: 通过启动日志验证

### AC-3: DuckDB 预加载只加载用户表
- **Given**: 数据库中有 3 个用户表
- **When**: DuckDB 预加载执行
- **Then**: 预加载日志显示获取到 3 个用户表
- **Verification**: `programmatic`
- **Notes**: 已修复，需验证

### AC-4: DWM 警告降级
- **Given**: Win10 环境启动应用
- **When**: 透明窗口初始化
- **Then**: DWMWA_TRANSITIONS_FORCEDISABLED 失败时输出 debug 级别日志，而非 warn
- **Verification**: `programmatic`
- **Notes**: 已修复，需验证

### AC-5: 编译通过
- **Given**: 修改完成后
- **When**: 执行 cargo check --quiet
- **Then**: 无编译错误
- **Verification**: `programmatic`

## Open Questions
- [ ] database_service.rs 的 list_tables_with_meta 是否需要同时返回系统表（用于前端展示"系统表"分类？当前设计是返回所有表（除回收站表），通过 is_system_table 字段区分，是否合理？
- [ ] 是否需要统一封装一个统一的"获取用户表名"工具函数，避免多处重复实现？

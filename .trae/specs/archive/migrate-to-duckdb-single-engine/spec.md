# QuickerSQL DuckDB 单引擎迁移方案 - Product Requirement Document

## Overview
- **Summary**: 将 QuickerSQL 从 SQLite+DuckDB 双引擎架构迁移到 DuckDB 单引擎架构，简化架构、提高性能、消除双引擎维护成本。
- **Purpose**: 解决当前双引擎架构的维护复杂、SQL 方言差异、数据同步延迟等问题，为用户提供更一致、更快的 SQL 查询体验。
- **Target Users**: QuickerSQL 所有用户，特别是需要复杂分析查询的用户。

## Goals
- G1: 完成数据库层从 SQLite+DuckDB 双引擎到 DuckDB 单引擎的迁移
- G2: 所有系统表（12+ 张）成功迁移到 DuckDB，功能保持不变
- G3: 用户数据迁移后完整性验证通过（数据不丢失、不损坏）
- G4: 迁移失败时有完整的回滚机制，不影响用户现有数据
- G5: 迁移后分析查询性能不低于当前双引擎方案

## Non-Goals (Out of Scope)
- ❌ 不修改前端 UI（除非数据库变更导致必要的适配）
- ❌ 不添加新功能（迁移期间专注于功能等价性）
- ❌ 不修改自动化任务调度器逻辑
- ❌ 不修改仪表盘/图表功能

## Background & Context
当前项目采用 SQLite+DuckDB 双引擎架构：
- SQLite 负责数据持久化、写操作、系统表存储
- DuckDB 负责复杂分析查询（通过 ATTACH 机制读取 SQLite 数据）
- QueryRouter 根据 SQL 关键字自动路由到对应引擎

存在的问题：
- 双引擎维护成本高（两套连接、两套类型映射、两套错误处理）
- SQL 方言差异（SQLite vs DuckDB）导致用户容易踩坑
- 数据同步延迟（DuckDB ATTACH 读 SQLite 有额外开销）
- 参数化查询在 DuckDB 端未实现
- SQLite 扩展加载不可靠

## Functional Requirements
- FR-1: 系统表迁移 - 将所有 12+ 张系统表从 SQLite 迁移到 DuckDB
- FR-2: 用户数据迁移 - 将用户创建的表从 SQLite 迁移到 DuckDB
- FR-3: 参数化查询 - 修复 DuckDB 的参数化查询实现（`$1, $2` 占位符）
- FR-4: SQL 语法兼容 - 替换所有 SQLite 特有语法为 DuckDB 兼容语法
- FR-5: 类型系统适配 - 处理 SQLite 动态类型到 DuckDB 强类型的转换
- FR-6: 迁移工具 - 提供完整的数据迁移工具，支持增量迁移和验证
- FR-7: 回滚机制 - 迁移失败时自动回滚到 SQLite，确保数据安全

## Non-Functional Requirements
- NFR-1: 迁移过程必须保证数据完整性（不丢失、不损坏）
- NFR-2: 迁移过程必须可中断（中断后可继续或回滚）
- NFR-3: 迁移后查询性能不低于当前双引擎方案
- NFR-4: 迁移工具必须有详细的日志记录
- NFR-5: 回滚必须在 30 秒内完成（针对小型数据库）

## Constraints
- **Technical**: Rust 语言、DuckDB Rust crate、Tauri 框架
- **Business**: 不能影响现有用户数据，迁移过程必须安全
- **Dependencies**: DuckDB crate version 1.10502.0（与当前一致）

## Assumptions
- A1: 用户数据库大小通常在 GB 级别，迁移时间可接受
- A2: 当前 SQLite 数据库是健康的（无损坏）
- A3: 用户愿意在迁移期间关闭应用（或迁移在后台进行）
- A4: DuckDB 1.x 版本的稳定性足够用于生产环境

## Acceptance Criteria

### AC-1: 系统表迁移成功
- **Given**: 应用启动时检测到 SQLite 数据库
- **When**: 执行系统表迁移脚本
- **Then**: 所有 12+ 张系统表成功迁移到 DuckDB，数据完整
- **Verification**: `programmatic` - 迁移后系统表数量等于迁移前，记录数一致
- **Notes**: 系统表包括 __settings, __app_state, __query_history 等

### AC-2: 用户数据迁移成功
- **Given**: SQLite 数据库中有用户创建的表
- **When**: 执行用户数据迁移脚本
- **Then**: 所有用户表成功迁移到 DuckDB，行数一致
- **Verification**: `programmatic` - 迁移前后每张表的行数对比
- **Notes**: 包含所有用户创建的表，不包括系统表

### AC-3: 参数化查询正常工作
- **Given**: DuckDB 单引擎已启用
- **When**: 执行带参数的 SQL 查询（如 `SELECT * FROM users WHERE id = ?`）
- **Then**: 查询成功返回正确结果
- **Verification**: `programmatic` - 编写单元测试验证参数化查询
- **Notes**: DuckDB 使用 `$1, $2` 占位符，需要自动转换

### AC-4: SQLite 特有语法已替换
- **Given**: DuckDB 单引擎已启用
- **When**: 执行表列表查询、列信息查询等操作
- **Then**: 所有操作正常工作，不报错
- **Verification**: `programmatic` - 自动化测试覆盖所有数据库元信息查询
- **Notes**: 替换 `sqlite_master`、`PRAGMA table_info` 等

### AC-5: 迁移失败回滚成功
- **Given**: 迁移过程中出现错误
- **When**: 回滚机制触发
- **Then**: 系统自动切换回 SQLite，数据保持完整
- **Verification**: `programmatic` - 模拟迁移失败，验证回滚后数据完整性
- **Notes**: 回滚包括：恢复 SQLite 连接、删除临时 DuckDB 文件、记录错误日志

### AC-6: 迁移后分析查询性能
- **Given**: DuckDB 单引擎已启用
- **When**: 执行复杂分析查询（GROUP BY、JOIN、窗口函数）
- **Then**: 查询性能不低于当前双引擎方案
- **Verification**: `human-judgment` - 对比迁移前后的查询耗时
- **Notes**: 使用相同的测试数据和查询进行对比

## Open Questions
- [ ] Q1: 是否需要支持增量迁移（只迁移新增数据）？
- [ ] Q2: 迁移过程中是否需要显示进度条给用户？
- [ ] Q3: 是否需要支持用户选择迁移时机（启动时 vs 手动触发）？
- [ ] Q4: 大数据库（>10GB）的迁移策略是什么？

## Migration Rollback Strategy

### Rollback Point 1: 迁移前备份
- **Action**: 自动创建 SQLite 数据库的完整备份（`.bak` 文件）
- **Trigger**: 迁移开始前自动执行
- **Recovery**: 回滚时使用备份文件恢复

### Rollback Point 2: 系统表迁移失败
- **Action**: 删除已创建的 DuckDB 系统表，恢复 SQLite 连接
- **Trigger**: 系统表迁移过程中出现任何错误
- **Recovery**: 应用继续使用 SQLite

### Rollback Point 3: 用户数据迁移失败
- **Action**: 删除 DuckDB 数据库文件，恢复 SQLite 连接
- **Trigger**: 用户数据迁移过程中出现任何错误
- **Recovery**: 应用继续使用 SQLite，系统表（如果已迁移）回滚

### Rollback Point 4: 验证失败
- **Action**: 删除 DuckDB 数据库文件，恢复 SQLite 连接
- **Trigger**: 迁移完成后验证发现数据不一致
- **Recovery**: 应用继续使用 SQLite

### Manual Rollback
用户可以手动删除 DuckDB 数据库文件（`data/quickersql.duckdb`），应用下次启动时会自动使用 SQLite。

## Risk Matrix

| 风险项 | 概率 | 影响 | 风险等级 | 缓解措施 |
|--------|------|------|---------|---------|
| 数据丢失 | 低 | 高 | 🟡 中 | 迁移前自动备份、验证阶段检查 |
| 迁移失败 | 中 | 高 | 🟠 中高 | 完善的回滚机制、逐步迁移 |
| 写入性能下降 | 高 | 中 | 🟠 中高 | 批量写入优化、内存缓冲 |
| 类型转换错误 | 中 | 高 | 🟠 中高 | 严格类型校验、降级方案 |
| SQL 语法不兼容 | 中 | 中 | 🟡 中 | 全面梳理、测试覆盖 |
| 查询性能下降 | 低 | 中 | 🟢 低 | 基准测试、索引优化 |

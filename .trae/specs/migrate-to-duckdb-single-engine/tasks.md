# QuickerSQL DuckDB 单引擎迁移 - 实施计划

## [ ] Task 1: 准备阶段 - 环境检查与依赖确认
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 确认 DuckDB Rust crate 版本（当前 1.10502.0）
  - 确认现有 SQLite 数据库文件结构
  - 检查所有 service 层的 SQL 语句，标记 SQLite 特有语法
  - 创建迁移日志目录和日志文件
- **Acceptance Criteria Addressed**: [AC-1, AC-2]
- **Test Requirements**:
  - `programmatic` TR-1.1: DuckDB crate 版本确认正确
  - `programmatic` TR-1.2: SQLite 数据库文件存在且可访问
  - `human-judgement` TR-1.3: 完成 SQL 语句梳理清单，列出所有 SQLite 特有语法
- **Notes**: 输出文件：`docs/migration/sqlite-syntax-audit.md`

## [ ] Task 2: 数据库层重构 - DuckDB 参数化查询实现
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 
  - 修复 DuckDB 的 `execute()` 方法，正确处理参数化查询
  - 修复 DuckDB 的 `query()` 方法，正确处理参数化查询
  - 实现 SQLite `?` 占位符到 DuckDB `$1, $2` 占位符的自动转换
  - 实现参数类型映射（SQLite ToSql → DuckDB ToSql）
- **Acceptance Criteria Addressed**: [AC-3]
- **Test Requirements**:
  - `programmatic` TR-2.1: 单元测试验证参数化查询执行成功
  - `programmatic` TR-2.2: 单元测试验证参数类型正确转换
  - `programmatic` TR-2.3: 单元测试验证多个参数的查询
- **Notes**: 修改文件：`src-tauri/src/database/duckdb.rs`

## [ ] Task 3: 数据库层重构 - SQLite 特有语法替换
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 
  - 替换 `sqlite_master` 查询为 `information_schema.tables` 或 `SHOW TABLES`
  - 替换 `PRAGMA table_info()` 为 `DESCRIBE` 或 `information_schema.columns`
  - 替换 `PRAGMA index_list()` 为 `SHOW INDEX`
  - 替换 `randomblob(16)` 为 `uuid()` 或应用层 UUID 生成
  - 替换 `CURRENT_TIMESTAMP` 默认值处理（DuckDB 返回 TIMESTAMP 类型）
- **Acceptance Criteria Addressed**: [AC-4]
- **Test Requirements**:
  - `programmatic` TR-3.1: 单元测试验证表列表查询正常工作
  - `programmatic` TR-3.2: 单元测试验证列信息查询正常工作
  - `programmatic` TR-3.3: 单元测试验证索引列表查询正常工作
- **Notes**: 修改文件：`src-tauri/src/services/database_service.rs`, `src-tauri/src/database/router.rs`, `src-tauri/src/services/settings_service.rs`

## [ ] Task 4: 数据库层重构 - 类型系统适配
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 
  - 处理 BOOLEAN 类型转换（SQLite INTEGER → DuckDB BOOLEAN）
  - 处理 DATETIME 类型转换（SQLite TEXT → DuckDB TIMESTAMP）
  - 处理 JSON 类型转换（SQLite TEXT → DuckDB JSON）
  - 实现类型转换的降级方案（转换失败时使用 TEXT 类型）
- **Acceptance Criteria Addressed**: [AC-2]
- **Test Requirements**:
  - `programmatic` TR-4.1: 单元测试验证 BOOLEAN 类型转换
  - `programmatic` TR-4.2: 单元测试验证 DATETIME 类型转换
  - `programmatic` TR-4.3: 单元测试验证 JSON 类型转换
- **Notes**: 修改文件：`src-tauri/src/database/traits.rs`, `src-tauri/src/database/duckdb.rs`

## [ ] Task 5: 系统表迁移脚本 - 创建 DuckDB 系统表 Schema
- **Priority**: high
- **Depends On**: Tasks 2, 3, 4
- **Description**: 
  - 创建 DuckDB 版本的系统表 schema（12+ 张表）
  - 适配类型系统差异（BOOLEAN → BOOLEAN, DATETIME → TIMESTAMP）
  - 添加必要的索引（与 SQLite 版本一致或更优）
  - 创建系统表迁移脚本（CREATE TABLE, CREATE INDEX）
- **Acceptance Criteria Addressed**: [AC-1]
- **Test Requirements**:
  - `programmatic` TR-5.1: 脚本执行成功，所有系统表创建完成
  - `programmatic` TR-5.2: 验证系统表结构与 SQLite 版本等价
  - `human-judgement` TR-5.3: 检查索引是否合理
- **Notes**: 修改文件：`src-tauri/src/services/migration_service.rs`，新增迁移脚本文件

## [ ] Task 6: 迁移工具 - 系统表数据迁移
- **Priority**: high
- **Depends On**: Task 5
- **Description**: 
  - 实现系统表数据迁移函数（从 SQLite 读取 → 写入 DuckDB）
  - 处理类型转换（BOOLEAN、DATETIME、JSON）
  - 添加迁移进度日志
  - 实现迁移失败时的回滚逻辑
- **Acceptance Criteria Addressed**: [AC-1, AC-5]
- **Test Requirements**:
  - `programmatic` TR-6.1: 系统表迁移后记录数与 SQLite 一致
  - `programmatic` TR-6.2: 迁移失败时回滚到 SQLite
  - `human-judgement` TR-6.3: 迁移日志完整记录每个步骤
- **Notes**: 修改文件：`src-tauri/src/services/migration_service.rs`

## [ ] Task 7: 迁移工具 - 用户数据表迁移
- **Priority**: high
- **Depends On**: Task 5
- **Description**: 
  - 实现用户数据表迁移函数（从 SQLite 读取 → 写入 DuckDB）
  - 处理用户表的类型转换（自动检测并转换）
  - 处理用户表的索引迁移
  - 添加迁移进度日志
  - 实现迁移失败时的回滚逻辑
- **Acceptance Criteria Addressed**: [AC-2, AC-5]
- **Test Requirements**:
  - `programmatic` TR-7.1: 用户表迁移后行数与 SQLite 一致
  - `programmatic` TR-7.2: 用户表索引迁移完成
  - `programmatic` TR-7.3: 迁移失败时回滚到 SQLite
- **Notes**: 修改文件：`src-tauri/src/services/migration_service.rs`

## [ ] Task 8: 迁移工具 - 数据验证
- **Priority**: high
- **Depends On**: Tasks 6, 7
- **Description**: 
  - 实现迁移后数据验证函数
  - 验证系统表记录数一致性
  - 验证用户表行数一致性
  - 验证关键数据完整性（如设置值、查询历史等）
  - 生成验证报告
- **Acceptance Criteria Addressed**: [AC-1, AC-2, AC-5]
- **Test Requirements**:
  - `programmatic` TR-8.1: 所有表记录数验证通过
  - `programmatic` TR-8.2: 关键数据完整性验证通过
  - `human-judgement` TR-8.3: 验证报告清晰可读
- **Notes**: 修改文件：`src-tauri/src/services/migration_service.rs`

## [ ] Task 9: 迁移工具 - 回滚机制实现
- **Priority**: high
- **Depends On**: Tasks 6, 7, 8
- **Description**: 
  - 实现迁移前自动备份功能（SQLite → .bak 文件）
  - 实现系统表迁移失败回滚
  - 实现用户数据迁移失败回滚
  - 实现验证失败回滚
  - 实现手动回滚功能（删除 DuckDB 文件触发）
- **Acceptance Criteria Addressed**: [AC-5]
- **Test Requirements**:
  - `programmatic` TR-9.1: 迁移前备份文件创建成功
  - `programmatic` TR-9.2: 系统表迁移失败自动回滚
  - `programmatic` TR-9.3: 用户数据迁移失败自动回滚
  - `programmatic` TR-9.4: 验证失败自动回滚
- **Notes**: 修改文件：`src-tauri/src/services/migration_service.rs`

## [ ] Task 10: 连接层重构 - 移除 QueryRouter
- **Priority**: medium
- **Depends On**: Tasks 2, 3, 4
- **Description**: 
  - 修改 `DatabaseManager`，移除 QueryRouter，直接使用 DuckDB
  - 修改所有 service 的数据库调用，移除路由逻辑
  - 简化连接管理（从双连接到单连接）
  - 更新错误处理逻辑（统一为 DuckDB 错误类型）
- **Acceptance Criteria Addressed**: [AC-3, AC-4]
- **Test Requirements**:
  - `programmatic` TR-10.1: 所有 service 层数据库调用正常工作
  - `programmatic` TR-10.2: 编译通过，无未使用的代码
  - `human-judgement` TR-10.3: 代码结构简化，可读性提升
- **Notes**: 修改文件：`src-tauri/src/database/traits.rs`, `src-tauri/src/database/router.rs`, 所有 `*_service.rs`

## [ ] Task 11: 删除 SQLite 相关代码
- **Priority**: medium
- **Depends On**: Task 10
- **Description**: 
  - 删除 `src-tauri/src/database/sqlite.rs`
  - 删除 `src-tauri/src/database/router.rs`（如果不再需要）
  - 从 `Cargo.toml` 中移除 `rusqlite` 依赖
  - 清理所有 SQLite 相关的 import 和 unused code
- **Acceptance Criteria Addressed**: [AC-1, AC-2]
- **Test Requirements**:
  - `programmatic` TR-11.1: `cargo check --quiet` 通过
  - `programmatic` TR-11.2: 无 SQLite 相关代码残留
  - `human-judgement` TR-11.3: 代码结构清晰
- **Notes**: 修改文件：`src-tauri/src/database/`, `src-tauri/Cargo.toml`

## [ ] Task 12: 集成测试与回归测试
- **Priority**: high
- **Depends On**: Tasks 1-11
- **Description**: 
  - 编写集成测试验证迁移流程
  - 编写回归测试验证所有功能
  - 测试边界情况（空数据库、大数据库、特殊字符等）
  - 测试回滚机制（模拟各种失败场景）
- **Acceptance Criteria Addressed**: [AC-1, AC-2, AC-3, AC-4, AC-5]
- **Test Requirements**:
  - `programmatic` TR-12.1: 所有集成测试通过
  - `programmatic` TR-12.2: 所有回归测试通过
  - `human-judgement` TR-12.3: 测试覆盖率合理
- **Notes**: 修改文件：`src-tauri/tests/`, `src-tauri/src/database/tests.rs`

## [ ] Task 13: 性能基准测试
- **Priority**: medium
- **Depends On**: Task 12
- **Description**: 
  - 设置性能基准测试环境（相同硬件、相同数据）
  - 测试迁移前后的查询性能（简单查询、复杂分析查询）
  - 测试迁移前后的写入性能（单条写入、批量写入）
  - 生成性能对比报告
- **Acceptance Criteria Addressed**: [AC-6]
- **Test Requirements**:
  - `programmatic` TR-13.1: 查询性能不低于当前双引擎方案
  - `human-judgement` TR-13.2: 写入性能可接受（如果下降，有优化方案）
- **Notes**: 输出文件：`docs/migration/performance-report.md`

## [ ] Task 14: 文档更新
- **Priority**: low
- **Depends On**: Tasks 1-13
- **Description**: 
  - 更新 `docs/架构现状.md`，记录数据库架构变更
  - 更新 `docs/数据库迁移指南.md`（新增）
  - 更新 `AGENTS.md` 系统表清单（如果有变化）
  - 更新 README.md（如果需要）
- **Acceptance Criteria Addressed**: [AC-1]
- **Test Requirements**:
  - `human-judgement` TR-14.1: 文档准确反映当前架构
  - `human-judgement` TR-14.2: 迁移指南清晰易懂
- **Notes**: 修改文件：`docs/架构现状.md`, `docs/数据库迁移指南.md`, `AGENTS.md`

# Task Dependencies

```
Task 1 (准备阶段)
    ↓
Task 2 (参数化查询) ←→ Task 3 (SQL语法) ←→ Task 4 (类型适配)
    ↓                   ↓                   ↓
    └──────────→ Task 5 (系统表Schema) ←──────────┘
                        ↓
              Task 6 (系统表迁移) ←→ Task 7 (用户数据迁移)
                        ↓                   ↓
                        └────────→ Task 8 (数据验证) ←──────┘
                                     ↓
                              Task 9 (回滚机制)
                                     ↓
                              Task 10 (移除Router)
                                     ↓
                              Task 11 (删除SQLite代码)
                                     ↓
                              Task 12 (集成测试)
                                     ↓
                              Task 13 (性能测试)
                                     ↓
                              Task 14 (文档更新)
```

# Rollback Plan Summary

## Pre-Migration Rollback Point
- **Action**: 创建 SQLite 数据库完整备份（`.bak` 文件）
- **Location**: `data/quickersql.sqlite.bak`
- **Recovery**: 删除 DuckDB 文件，恢复 SQLite 连接

## During Migration Rollback Points

| 阶段 | 失败时操作 | 恢复方式 |
|------|-----------|---------|
| 系统表 Schema 创建 | 删除 DuckDB 文件 | 使用 SQLite |
| 系统表数据迁移 | 删除已创建的系统表，恢复 SQLite | 使用 SQLite |
| 用户表 Schema 创建 | 删除已创建的用户表，恢复 SQLite | 使用 SQLite |
| 用户表数据迁移 | 删除 DuckDB 文件，恢复 SQLite | 使用 SQLite |
| 数据验证 | 删除 DuckDB 文件，恢复 SQLite | 使用 SQLite |

## Post-Migration Rollback
- **Manual**: 用户删除 `data/quickersql.duckdb` 文件
- **Automatic**: 应用启动时检测到 DuckDB 文件不存在，自动切换回 SQLite

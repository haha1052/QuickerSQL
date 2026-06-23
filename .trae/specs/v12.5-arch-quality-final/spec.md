# v12.5 架构质量收尾（T74 下沉 + M7 里程碑条件检查）— Product Requirement Document

## Overview

- **Summary**: 本 spec 针对架构现状文档 §4.2 中优先级改进项的**唯一未完成项（T74）**，制定多角色分工的实施计划。T74 是整个 commands 层 **仅存的 5 处** `conn.query` 直连 DB 操作，位于 `commands/database.rs:171-214` 的 `get_table_meta` 函数。完成该项后，commands 层将真正做到"零直接数据库操作"，架构分层 100% 满足。同时对 v12 计划中 T70-T73 其他项的完成状态做最终盘点，并评估当前是否满足进入 M7（下一个重大架构里程碑）的条件。

- **Purpose**: 
  1. 解决架构分层上的最后一公里：commands 层不应直接执行 SQL 查询
  2. 消除 commands 层和 service 层同名 `get_table_meta` 的混乱（两个函数名字相同但返回完全不同的字段）
  3. 将 PRAGMA index_list / page_size / page_count / freelist_count + sqlite_master 元数据查询从命令层下沉到 service 层，统一维护
  4. 完成 M7 里程碑条件检查，明确下一阶段方向

- **Target Users**: 开发者（主要）；不会影响普通用户的任何功能

## Goals

- **G1**: `commands/database.rs` 中的 `get_table_meta` 不再直接调用 `conn.query` / `conn.execute`，改为调用 `DatabaseService` 的新方法
- **G2**: 消除 service 层和 commands 层 `get_table_meta` 同名函数的命名/返回值混乱
- **G3**: 完成后，`grep -rn 'conn.query\|conn.execute' src-tauri/src/commands/` 返回 **0 匹配** — 架构分层 100% 满足
- **G4**: M7 条件最终检查报告（所有核心质量指标）
- **G5**: 零新增技术债

## Non-Goals (Out of Scope)

- ❌ **不实现新图表类型**（热力图/瀑布图/漏斗图）——属于功能需求，不在本次架构质量收尾范围内
- ❌ **不做 DatabaseExplorer 组件全量拆分**——属于前端组件重构，独立任务
- ❌ **不新增任何 ESLint 配置**（可在后续 CI 配置任务中单独处理）
- ❌ **不修改任何 Tier-1 文件**（`lib.rs`、`tauri.conf.json`、`Cargo.toml`、`package.json` 等）
- ❌ **不修改前端 components/store/types 任何代码**——本次纯后端架构修正
- ❌ **不改变现有 `get_table_meta` 的 API 返回值格式**（前端调用方兼容不变）

## Background & Context

### 架构现状（v12.0 基线）

当前 v12.0 已完成的质量加固：
| 项 | 状态 | 细节 |
|----|------|------|
| T70 refreshCharts no-op | ✅ | 正常递增 refreshChartsVersion，3 处调用，1 处 useEffect 依赖 |
| T71 store 统一出口 | ✅ | 100% 统一，0 处直接 import 子 store 文件 |
| T72 catch_unwind → audit_log | ✅ | panic 分支 + DuckDB 常规错误分支均写入 `__audit_logs` |
| T73 types 补齐 | ✅ | `settings.ts` + `workspace.ts` 存在，index.ts re-export 完整 |
| T74 database.rs 下沉 | ❌ **未完成** | `get_table_meta` 函数 5 处 `conn.query` 直接调用 |

### T74 详细分析

**位置**: `src-tauri/src/commands/database.rs:171-214`，函数名 `get_table_meta`

**功能**: 查询单个表的元信息（索引数量 + 估算大小）
- `PRAGMA index_list(<table>)` → 索引数量
- `PRAGMA page_size` → 数据库页大小（字节）
- `PRAGMA page_count` → 数据库总页数
- `PRAGMA freelist_count` → 空闲页数
- `SELECT COUNT(*) FROM sqlite_master WHERE type='table'` → 数据库中表总数
- 计算公式：`size_bytes = page_size * (page_count - freelist_count) / table_count`

**问题**: 整个 `commands` 层仅这 1 个函数有 5 处直接 `conn.query`，其他 77+ 条命令均已通过 service 层访问数据库。这个函数让架构分层的最后一块拼图缺失。

**命名冲突**: service 层的 `DatabaseService::get_table_meta`（行 231，返回 `TableInfo { name, row_count, column_count, is_system_table }`）和 commands 层的 `get_table_meta`（返回 `TableMetaInfo { index_count, size_bytes }`）**名字相同但功能完全不同**，属于潜在维护混乱。

### 当前各层 DB 访问统计

| 层 | 文件数 | `conn.query`/`conn.execute` 总数 | 备注 |
|---|--------|--------------------------------|-----|
| commands/ | 13 | **5** | 全部在 `database.rs:get_table_meta` |
| services/ | 14 | ~20-30 | 正常，业务逻辑所在 |
| database/ | 1 | ~5 | 正常，底层连接管理 |

### M7 里程碑条件定义

**M7 = "架构分层完全满足 + 核心质量门禁通过"**

| 条件 | 描述 | 当前值 |
|------|------|--------|
| C1 | commands 层 0 处 `conn.query`/`conn.execute` | 5（T74 待解决） |
| C2 | 前端 TypeScript `any` 类型 0 处 | 0 ✅ |
| C3 | 生产代码 `.unwrap()` 0 处（测试内允许） | 0 ✅ |
| C4 | store import 统一出口 100% | 100% ✅ |
| C5 | types 目录覆盖所有主要领域 | 8 个文件 ✅ |
| C6 | sql_service.rs 有单元测试 | 14+ 个 ✅ |
| C7 | DuckDB panic/错误 进入审计日志 | ✅ |

**结论**: 目前 M7 有 7 个条件中的 **6 个已满足**，**唯一阻塞 C1 = T74**。完成 T74 后即可宣布架构分层里程碑达成。

## Functional Requirements

### FR-1: service 层新增 `get_table_meta_extended` 方法

在 `src-tauri/src/services/database_service.rs` 中新增 `DatabaseService::get_table_meta_extended(conn, table_name)`，实现以下功能：
- 调用 `SqlIdentifier::new(table_name)` 校验表名
- 执行 `PRAGMA index_list(<quoted_table>)` 获取索引数量
- 执行 `PRAGMA page_size` 获取页大小
- 执行 `PRAGMA page_count` 获取总页数
- 执行 `PRAGMA freelist_count` 获取空闲页数
- 执行 `SELECT COUNT(*) FROM sqlite_master WHERE type='table'` 获取表总数
- 计算 `size_bytes = page_size * (page_count - freelist_count) / max(table_count, 1)`
- 返回现有的 `TableMetaInfo { index_count, size_bytes }` 结构体
- 所有数据库操作使用 `conn.query(sql, &[])` 形式，SQL 中表名必须使用 `SqlIdentifier` 的 `quoted()` 输出
- 错误处理遵循现有规范：`map_err(|e| format!("...: {}", e))`，不要 unwrap/expect

### FR-2: commands 层 `get_table_meta` 改为调用 service

修改 `src-tauri/src/commands/database.rs:171-214` 的 `get_table_meta` 函数：
- 保留函数签名不变（`pub fn get_table_meta(state, table_name) -> Result<TableMetaInfo, String>`）
- 保留 TauriAppState 连接检查逻辑（前 8 行）
- 保留 `SqlIdentifier` 表名校验（或移到 service 层，service 层已做）
- 改为直接调用 `DatabaseService::get_table_meta_extended(&conn, &table_name)`
- 函数体从约 44 行压缩到约 8-10 行（仅参数检查 + 获取连接 + 调用 service）

### FR-3: 重命名消除命名混乱（可选，但推荐）

方案 A（推荐）：将 service 层的 `get_table_meta`（返回 TableInfo，用于列表页面）重命名为更准确的 `get_table_info`，因为 "info" 比 "meta" 更准确地描述了（name+row_count+column_count）这类基础信息；而新加入的 extended 方法返回（index_count+size_bytes）是"扩展元信息"。

- 在 `database_service.rs` 中重命名 `pub fn get_table_meta` → `pub fn get_table_info`
- 搜索并更新所有调用方：`grep -rn 'DatabaseService::get_table_meta' src-tauri/src/` 以确保所有调用都改为 `get_table_info`
- commands 层的 `get_table_meta` 名字保持不变（因为它是 Tauri 命令名，前端调用 `invoke("get_table_meta")`），但内部调用 service 层新方法

方案 B（更简洁，减少改动）：不重命名 service 层原有的 `get_table_meta`，新方法命名为 `get_table_extended_meta` 或 `get_table_performance_info`。这样只需要新增 1 个方法 + 更新 1 处调用，不需要重命名现有符号。

**推荐方案 B**（最小改动原则），因为：
- 现有 `get_table_meta` 调用点可能较多，重命名有风险
- `get_table_performance_info` 更准确地描述"索引数+大小"这类性能相关元信息
- 改动范围最小，风险最低

### FR-4: 更新架构现状文档（docs）

更新 `docs/架构现状.md` 的 §4.2：
- T74 标记为 v12.5 已完成，标记为"已下沉到 DatabaseService"
- 新增"当前 commands 层 conn.query 总数：0"的验证结果
- 可选：添加 M7 里程碑达成声明

## Non-Functional Requirements

### NFR-1: 零新增技术债

- `grep -rn '\.unwrap()\|expect(' src-tauri/src/services/database_service.rs` → 0 处生产代码 unwrap
- `grep -rn 'conn.query\|conn.execute' src-tauri/src/commands/` → 0 处
- `grep -rn 'format!("[A-Z ]*SELECT\|INSERT\|UPDATE\|DELETE\|ALTER\|CREATE' src-tauri/src/commands/database.rs` → 0 处（表名通过 SqlIdentifier 传递）

### NFR-2: cargo check 零警告

- `cd src-tauri; cargo check --quiet` → 0 errors, 0 new warnings

### NFR-3: 最小改动原则

- 改动文件 ≤ 2 个（`database_service.rs` + `commands/database.rs`）
- 新增强制代码 ≤ 60 行（service 方法 ~45 行 + commands 精简 ~15 行）
- 无 API 变更（前端 invoke 调用路径不变）

### NFR-4: 单元测试

- 在 `database_service.rs` 或 `sql_service.rs` 中添加至少 **2 个**针对新 `get_table_performance_info` 方法的测试用例：
  1. 测试不存在的表名（应返回错误或 0/0）
  2. 测试系统表名（通过 SqlIdentifier 检测）
- 如无法纯函数测试（因为需要真实 DB 连接），则用代码审查替代：确保 `SqlIdentifier::new` 调用 + 参数化查询格式正确

## Constraints

- **技术**: Rust + Tauri 技术栈不变
- **架构分层**: 禁止 commands 层新增 `conn.query`/`conn.execute`
- **安全约束**: 表名必须通过 `SqlIdentifier::new()` 校验后再拼接到 SQL（PRAGMA 不支持参数化）
- **API 不变**: 前端 `invoke("get_table_meta", { table_name })` 的返回类型保持 `{ index_count: number, size_bytes: number }`

## Assumptions

- 当前 `TableMetaInfo` 结构体（在 `commands/database.rs:165-168` 内联定义的 `pub struct TableMetaInfo`）可以保持原地定义，或移动到 `models/database.rs` 统一管理
- `database_service.rs` 的其他 `get_*` 方法（如 `get_row_count`, `get_column_count`, `get_table_columns` 等）作为参考风格，新方法遵循相同的参数/错误处理模式
- PRAGMA 语句中传递表名的安全方式是先通过 `SqlIdentifier` 校验后用 `format!` 拼接到 PRAGMA SQL 字符串中（PRAGMA 不支持 `?` 参数绑定）

## Acceptance Criteria

### AC-1: commands/database.rs 中 get_table_meta 不再直接调用 conn.query

- **Given**: 开发者打开 `src-tauri/src/commands/database.rs`
- **When**: 搜索 `get_table_meta` 函数体
- **Then**: 函数体内**不包含**任何 `conn.query` 或 `conn.execute` 调用，唯一的数据库相关调用是 `state.db_manager.get_connection()` + `DatabaseService::get_table_performance_info(&conn, &table_name)`
- **Verification**: `programmatic`（`grep -rn 'conn.query\|conn.execute' src-tauri/src/commands/database.rs` → 0 matches）

### AC-2: 整个 commands 层零直连 DB 操作

- **Given**: 任务完成后
- **When**: 执行 `grep -rn 'conn.query\|conn.execute' src-tauri/src/commands/`
- **Then**: 结果为 **0 条匹配**
- **Verification**: `programmatic`

### AC-3: service 层新增方法符合代码风格

- **Given**: 新的 `DatabaseService::get_table_performance_info` 方法
- **When**: 代码审查
- **Then**: 
  1. 参数签名与其他 `get_*` 方法一致（`conn: &MutexGuardConnection, table_name: &str`）
  2. 包含 `SqlIdentifier::new(table_name)?` 校验
  3. 错误处理使用 `map_err(|e| format!("...: {}", e))` 而非 unwrap/expect
  4. 返回值类型与前端期望一致（`Result<TableMetaInfo, String>` 或等效）
- **Verification**: `human-judgment`

### AC-4: cargo check 通过

- **Given**: 代码修改完成
- **When**: `cd src-tauri; cargo check --quiet`
- **Then**: exit code 0, 0 errors, 0 new warnings
- **Verification**: `programmatic`

### AC-5: M7 里程碑条件报告

- **Given**: T74 完成后
- **When**: 执行 M7 条件清单检查
- **Then**: 报告 C1-C7 全部 ✅ 通过（commands 层 0 处 conn.query + 原有 6 项保持不变）
- **Verification**: `programmatic`（7 个 grep 命令）

### AC-6: 架构现状文档更新

- **Given**: 所有代码修改和验证通过
- **When**: 审查 `docs/架构现状.md`
- **Then**: §4.2 中 T74 标记为已完成，并包含"M7 里程碑达成"的声明
- **Verification**: `human-judgment`

## Open Questions

- [ ] **Q1**: TableMetaInfo 结构体目前定义在 `commands/database.rs` 内联，是否需要移到 `models/database.rs` 以便其他 service 函数共享？（**默认：可以保留原位或移动，不影响功能。推荐方案 B：暂时保留原位，减少改动范围；如果后续有其他命令需要同样的信息，再考虑迁移。**）
- [ ] **Q2**: 命名方案是否按方案 B（新方法叫 `get_table_performance_info`）执行？（**默认：方案 B**）
- [ ] **Q3**: 是否在本次一并实现单元测试（由于需要真实 DB 连接，可能需要 mock 或在 `database/tests.rs` 中写集成测试）？（**默认：新增方法加 2 个简单的参数合法性测试 + 代码审查确认 SQL 结构正确**）

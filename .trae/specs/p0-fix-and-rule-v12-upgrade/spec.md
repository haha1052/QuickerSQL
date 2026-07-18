# P0 漏洞修复 + 规则体系 v12.0 升级 + 文档同步 Spec

> **change-id**: `p0-fix-and-rule-v12-upgrade`
> **创建日期**: 2026-07-17
> **基线文档**: `docs/架构现状.md` v22.0 §7 漏洞清单、§8 技术债务清单、§13.3 下一步计划
> **范围**: 下一步计划 1-5 + 架构现状文档同步更新

---

## Why

`docs/架构现状.md` v22.0 深度审计发现 5 项 P0 级漏洞、3 个零测试 service、3 处规则与代码不同步、CHANGELOG 严重脱节。这些问题中：
- P0-1（foreign_keys 未开启）+ P0-2（batch_insert 未校验）破坏数据完整性与 SQL 注入防线根基
- P0-5（project_service 重复建表 5 次）使任意字段变更需 7 处同步维护
- P0-3（规则检测命令与规则文本自相矛盾）让 CI 门禁无法落地
- TD-22/23/24 三个 service 零测试使后续重构无回归保障
- TD-3 CHANGELOG 停留 1.0.0-beta，与实际 2.0.0 严重脱节

必须先修复这些阻断级问题，才能继续安全推进 P1/P2 漏洞修复与功能演进。

## What Changes

### 第一批：P0 级漏洞修复（5 项）
- **P0-1**: 在 `SqliteDriver::connect` 的 PRAGMA 序列追加 `PRAGMA foreign_keys = ON;`；修复前先排查并清理现有孤儿记录
- **P0-2**: `batch_insert`（SQLite + DuckDB 两处）强制要求传入 `&SqlIdentifier`，内部用 `ident.quoted()` 拼装；DuckDB 版本移除 `v.replace('\'', "''")` 手工转义，值用 `?` 占位符
- **P0-3**: 修订 `security.md §1.1` + `CLAUDE.local.md §2.1` + `mcp.md §十二` 的检测命令，精确 regex 排除 `ident.quoted()` / `safe_xxx` 模式；或修订 architecture.md §1.1 情形 C 明确"经 SqlIdentifier 封装的 format! 调用允许"
- **P0-4**: 前端硬编码中文清理（按优先级分模块处理）：
  - 优先级 1：`ErrorBoundary.tsx`、`useQueryExecution.ts`、`dashboardStore.ts`、`taskStore.ts`、`projectStore.ts`、`tableStore.ts`
  - 优先级 2：`ChartLibraryPanel.tsx`、`AddChartModal.tsx`、`DashboardItem.tsx`、`DashboardPage.tsx`
  - store 层引入"error key 而非 message"模式由组件层翻译
- **P0-5**: 提取 `ensure_project_info_table_exists()` 和 `ensure_projects_registry_table_exists()` 函数，7 处调用点改为函数调用；line 1691 改为 `CREATE TABLE IF NOT EXISTS`

### 第二批：规则体系 v12.0 升级（TD-9）
- 9 份规则文件版本号统一从 v11.0 升级到 v12.0
- `architecture.md §1.2` 新增"上下文层"或并入"组件层"（TD-7）
- `architecture.md §3` 系统表清单同步本文档 §10 的 17 张表（TD-8）
- `test.md §一` "项目测试现状"重写，与本文档 §9.3 对齐（TD-6）
- `lib.rs:23` 注释从"8 张系统表"改为"17 张系统表"（TD-10）；补全 `SYSTEM_TABLE_ENSURE_FNS` 数组覆盖全部 17 张表
- `AGENTS.md` §2.2 系统表清单同步 17 张；末尾追加 v11.0/v12.0 版本变更记录（TD-4）
- **P0-3 同步**：修订 security.md §1.1、CLAUDE.local.md §2.1、mcp.md §十二 的检测命令

### 第三批：AGENTS.md + architecture.md 系统表清单同步（计划项 3）
- `AGENTS.md §2.2` 系统表清单：从 10 张修正为 17 张，命名对齐（`__automation_runs`、`__dashboards` 等）
- `architecture.md §三` 系统表清单：从 11 张修正为 17 张，命名对齐
- 两份文档均在版本变更记录追加本次修订说明

### 第四批：CHANGELOG.md 补全（计划项 4，TD-3）
- 补全 1.0.0-beta → 2.0.0 之间的版本变更条目
- 修正技术栈描述（"React 18" → "React 19"）
- 至少包含以下里程碑：M1-M7、国际化 Phase 1、图表授权范围、启动聚合优化、数据导入多格式支持、v22.0 架构审计

### 第五批：3 个零测试 service 补充内联测试（计划项 5，TD-22/23/24）
- **TD-22**: `app_state_service.rs` 补充内联测试：覆盖表创建幂等性、workspace_tabs/panels CRUD、并发读写
- **TD-23**: `view_service.rs` 补充内联测试：覆盖 VIEW 创建幂等、删除存在/不存在、跨引擎数据一致性
- **TD-24**: `sql_snippet_service.rs` 补充 CRUD 测试

### 第六批：架构现状文档同步更新
- 更新 `docs/架构现状.md` 版本号 v22.0 → v23.0
- §6.4 已知问题表追加本次修复条目
- §7 漏洞清单中已修复项标记 ✅ 已修复 + 修复日期
- §8 技术债务清单中已解决项标记 ✅ 已解决
- §9 质量保障章节同步最新测试数字
- §13.3 下一步计划更新，新增 P1 漏洞修复计划
- 调整质量评分（预计从 7.6 上调到 8.2+）

## Impact

### 受影响的 specs
- `docs/架构现状.md` v22.0 → v23.0（本文档基线）
- `AGENTS.md`（系统表清单 + 版本变更记录）
- 9 份 `.trae/rules/*.md` 规则文件（v11.0 → v12.0）
- `CHANGELOG.md`（1.0.0-beta → 2.0.0 补全）

### 受影响的代码

#### 后端（Rust）
- `src-tauri/src/database/sqlite.rs`（P0-1 foreign_keys、P0-2 batch_insert、close() 资源释放）
- `src-tauri/src/database/duckdb.rs`（P0-2 batch_insert、close() 资源释放）
- `src-tauri/src/services/project_service.rs`（P0-5 重复建表重构，1700+ 行）
- `src-tauri/src/services/app_state_service.rs`（TD-22 补充测试）
- `src-tauri/src/services/view_service.rs`（TD-23 补充测试）
- `src-tauri/src/services/sql_snippet_service.rs`（TD-24 补充测试）
- `src-tauri/src/lib.rs`（TD-10 注释修正 + SYSTEM_TABLE_ENSURE_FNS 补全）

#### 前端（TS/TSX）
- `src/components/common/ErrorBoundary.tsx`（P0-4 硬编码中文）
- `src/components/sql/hooks/useQueryExecution.ts`（P0-4）
- `src/store/dashboardStore.ts`（P0-4 store 错误消息改 i18n key）
- `src/store/taskStore.ts`（P0-4）
- `src/store/projectStore.ts`（P0-4）
- `src/store/tableStore.ts`（P0-4）
- `src/components/dashboard/ChartLibraryPanel.tsx`（P0-4）
- `src/components/dashboard/AddChartModal.tsx`（P0-4）
- `src/components/dashboard/DashboardItem.tsx`（P0-4）
- `src/components/dashboard/DashboardPage.tsx`（P0-4）
- `src/context/LocaleContext.tsx`（P0-4 扩展 i18n key）

#### 文档
- `docs/架构现状.md`（v22.0 → v23.0）
- `CHANGELOG.md`（补全 1.0.0-beta → 2.0.0）
- `AGENTS.md`（§2.2 系统表清单 + 版本变更记录）
- `.trae/rules/architecture.md`（§1.2 + §3 + 版本号）
- `.trae/rules/security.md`（§1.1 检测命令）
- `.trae/rules/CLAUDE.local.md`（§2.1 检测命令 + 版本号）
- `.trae/rules/test.md`（§一 现状表 + 版本号）
- `.trae/rules/mcp.md`（§十二 检测命令 + 版本号）
- `.trae/rules/coding.md`（版本号）
- `.trae/rules/file-lock.md`（版本号）
- `.trae/rules/release.md`（版本号）

## ADDED Requirements

### Requirement: SQLite 外键约束强制启用
后端 SQLite 驱动 SHALL 在每个连接初始化时启用 `PRAGMA foreign_keys = ON`，保证 `FOREIGN KEY ... ON DELETE CASCADE` 约束生效。

#### Scenario: 启用外键约束后级联删除生效
- **WHEN** 用户删除一个 dashboard 记录
- **THEN** 该 dashboard 关联的 `__dashboard_items` 记录被数据库自动级联删除
- **AND** 不依赖应用层手动 DELETE

#### Scenario: 启用外键前清理孤儿记录
- **WHEN** 应用启动且检测到 `__dashboard_items` 存在 `dashboard_id` 不在 `__dashboards.id` 中的孤儿记录
- **THEN** 启动日志记录孤儿记录数量
- **AND** 自动删除孤儿记录（或提供清理工具）

### Requirement: batch_insert 强制 SqlIdentifier 校验
`batch_insert` API SHALL 强制要求传入 `&SqlIdentifier` 类型的表名参数，内部用 `ident.quoted()` 拼装，禁止字符串表名直接拼入 SQL。

#### Scenario: 调用方传入字符串表名
- **WHEN** 调用方尝试 `batch_insert("my_table", ...)` 字符串形式
- **THEN** 编译期报错（Rust 类型系统拦截）

#### Scenario: DuckDB batch_insert 移除手工转义
- **WHEN** 调用 DuckDB `batch_insert` 插入含 `'` 字符的值
- **THEN** 值通过 `?` 占位符参数化传入
- **AND** 不再使用 `v.replace('\'', "''")` 手工转义

### Requirement: 规则检测命令与规则文本一致
`security.md §1.1`、`CLAUDE.local.md §2.1`、`mcp.md §十二` 的 SQL 注入检测命令 SHALL 与 `architecture.md §1.1 情形 C` 的规则文本一致。

#### Scenario: 经 SqlIdentifier 封装的 format! 不被检测为违规
- **WHEN** 代码中出现 `format!("SELECT ... FROM {}", ident.quoted())` 形式
- **THEN** 检测命令不报告为违规
- **AND** Count 期望值仍为 0（针对真正违规的 `format!("SELECT ... FROM {}", user_input)`）

### Requirement: project_service 重复建表合并
`project_service.rs` SHALL 通过提取 `ensure_project_info_table_exists()` 和 `ensure_projects_registry_table_exists()` 函数，将 7 处重复 schema 维护点合并为 2 处。

#### Scenario: 字段变更只修改一处
- **WHEN** 开发者需要在 `__project_info` 表新增一列
- **THEN** 只修改 `ensure_project_info_table_exists()` 函数内的一处 DDL
- **AND** 7 处调用点自动获得新 schema

### Requirement: 规则体系 v12.0 升级
9 份 `.trae/rules/*.md` 规则文件 SHALL 同步升级到 v12.0，与代码现状对齐。

#### Scenario: 系统表清单在所有文档中一致
- **WHEN** 开发者查阅 `AGENTS.md §2.2`、`architecture.md §三`、`docs/架构现状.md §十`
- **THEN** 三处系统表清单完全一致（17 张表，命名相同）

#### Scenario: 前端架构表包含 context 层
- **WHEN** 开发者查阅 `architecture.md §1.2` 前端架构表
- **THEN** 表中明确包含 `src/context/`、`src/styles/`、`src/pages/` 等目录的层级归属

### Requirement: 3 个零测试 service 补充内联测试
`app_state_service.rs`、`view_service.rs`、`sql_snippet_service.rs` SHALL 包含 `#[cfg(test)]` 模块覆盖核心 CRUD 与幂等性。

#### Scenario: app_state_service 测试覆盖
- **WHEN** 运行 `cargo test --quiet`
- **THEN** `app_state_service` 模块至少包含 5 个测试用例
- **AND** 覆盖表创建幂等性、workspace_tabs CRUD、workspace_panels CRUD

#### Scenario: view_service 测试覆盖
- **WHEN** 运行 `cargo test --quiet`
- **THEN** `view_service` 模块至少包含 4 个测试用例
- **AND** 覆盖 VIEW 创建幂等、删除存在/不存在场景

#### Scenario: sql_snippet_service 测试覆盖
- **WHEN** 运行 `cargo test --quiet`
- **THEN** `sql_snippet_service` 模块至少包含 5 个测试用例
- **AND** 覆盖 snippet 的 CRUD 全流程

### Requirement: CHANGELOG 补全
`CHANGELOG.md` SHALL 包含从 1.0.0-beta 到 2.0.0 的所有版本变更条目，技术栈描述与实际一致。

#### Scenario: CHANGELOG 反映实际技术栈
- **WHEN** 开发者查阅 `CHANGELOG.md`
- **THEN** 技术栈描述中 React 版本为 19（非 18）
- **AND** 包含 M1-M7 里程碑条目
- **AND** 包含国际化 Phase 1、图表授权范围、启动聚合优化等 2.0.0 关键特性

### Requirement: 前端硬编码中文清理
前端代码 SHALL 将所有用户可见的中文字符串通过 `t()` 函数获取，store 层错误消息保存 i18n key 而非硬编码 message。

#### Scenario: store 层错误消息国际化
- **WHEN** `dashboardStore` 的 action 失败
- **THEN** `error` 字段保存 i18n key（如 `'error.dashboard.load_failed'`）
- **AND** 组件层根据 key 调用 `t()` 翻译显示

#### Scenario: en-US 用户无中文残留
- **WHEN** 用户切换 locale 到 en-US
- **THEN** ErrorBoundary、useQueryExecution、dashboardStore 等模块无中文残留
- **AND** 错误提示以英文显示

## MODIFIED Requirements

### Requirement: 架构现状文档同步更新
`docs/架构现状.md` SHALL 在修复完成后从 v22.0 升级到 v23.0，反映本次修复结果。

#### Scenario: 漏洞清单标记已修复项
- **WHEN** 开发者查阅 §7 漏洞清单
- **THEN** P0-1 至 P0-5 五项均标注 ✅ 已修复 + 修复日期
- **AND** §8 技术债务清单中 TD-3、TD-4、TD-6、TD-7、TD-8、TD-9、TD-10、TD-22、TD-23、TD-24 标注 ✅ 已解决

#### Scenario: 质量评分上调
- **WHEN** 修复完成后重新评估
- **THEN** 质量评分从 7.6 上调到 8.2 或更高
- **AND** §6.4 已知问题表追加本次修复条目

## REMOVED Requirements

无移除项。本次为修复与文档同步，不删除现有功能。

---

## 验证基线

修复完成后必须通过以下门禁（来自 CLAUDE.local.md §六）：

```powershell
# 1. Rust 编译检查
cd src-tauri; cargo check --quiet  # 期望：0 errors

# 2. Rust 单元测试（应增加新测试覆盖）
cd src-tauri; cargo test --quiet  # 期望：除 test_get_default_db_path（环境问题）外全部通过，测试总数增加

# 3. 前端类型检查
npx tsc --noEmit --pretty  # 期望：0 errors

# 4. 前端单元测试
npx vitest run  # 期望：100% passed

# 5. SQL 注入检测（修订后的命令，期望 0 真违规）
Get-ChildItem -Path src-tauri/src -Include *.rs -Recurse | Select-String -Pattern 'format!.*SELECT|format!.*INSERT|format!.*UPDATE|format!.*DELETE' -CaseSensitive:$false | Measure-Object | Select-Object Count
# 期望：Count 反映真实违规数（经 SqlIdentifier 封装的不计入）

# 6. 敏感字符串检测
Get-ChildItem -Recurse -Include *.rs,*.ts,*.tsx | Select-String -Pattern 'sk-|password:|PRIVATE KEY|Bearer '  # 期望：0 matches

# 7. 前端 any 类型检测
Get-ChildItem -Path src -Include *.ts,*.tsx -Recurse | Where-Object { $_.FullName -notmatch '__tests__' } | Select-String -Pattern ': any|as any'  # 期望：0 matches

# 8. unwrap/expect 检测（除测试代码）
Get-ChildItem -Path src-tauri/src -Include *.rs -Recurse | Select-String -Pattern '\.unwrap\(\)|\.expect\(' | Measure-Object | Select-Object Count
# 期望：非测试代码 0 处
```

## 范围边界

### 本次范围内
- P0-1 至 P0-5 五项 P0 漏洞修复
- 规则体系 v11.0 → v12.0 升级
- AGENTS.md / architecture.md 系统表清单同步
- CHANGELOG.md 补全
- 3 个零测试 service 补充测试
- 架构现状文档 v22.0 → v23.0

### 本次范围外（留待下一批）
- P1 级 17 项漏洞（如 P1-1 dashboard_service format! 改造、P1-4 execute_inner 事务等）
- P2 级 18 项漏洞
- P3 级 10 项漏洞
- TD-11 project_service 拆分（本次仅合并重复 schema，不拆分模块）
- TD-12/.trae/specs 归档、TD-13 docs 归档（独立任务）
- 依赖升级（TD-15/16/17/18/19/20/21）

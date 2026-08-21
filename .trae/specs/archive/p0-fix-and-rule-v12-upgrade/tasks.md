# Tasks

> **change-id**: `p0-fix-and-rule-v12-upgrade`
> **创建日期**: 2026-07-17
> **依赖关系**: 见文末 Task Dependencies
> **执行原则**: 按批次推进，每批完成后跑门禁验证；P0-1 修复前必须先排查孤儿记录；规则文档修订与代码修复可并行

---

## 批次 1：P0 级漏洞修复（5 项，阻断级）

- [x] **Task 1**: P0-1 启用 SQLite foreign_keys + 孤儿记录清理
  - [x] SubTask 1.1: 在 `src-tauri/src/database/sqlite.rs` 的 `SqliteDriver::connect` PRAGMA 初始化序列追加 `PRAGMA foreign_keys = ON;`（约 line 43-49 之间）
  - [x] SubTask 1.2: 在 `ensure_tables_exist` 或应用启动 hook 中追加孤儿记录检测与清理 SQL：删除 `__dashboard_items` 中 `dashboard_id` 不在 `__dashboards.id` 的记录、`chart_id` 不在 `__saved_charts.id` 的记录；启动日志记录清理数量
  - [x] SubTask 1.3: 补充单元测试覆盖 foreign_keys 启用后的级联删除行为
  - [x] SubTask 1.4: 运行 `cargo check --quiet` + `cargo test --quiet` 验证

- [x] **Task 2**: P0-2 batch_insert 强制 SqlIdentifier 校验
  - [x] SubTask 2.1: 修改 `src-tauri/src/database/sqlite.rs:180-185` 的 `batch_insert` 签名：`table: &str` → `table: &SqlIdentifier`，内部用 `ident.quoted()` 拼装
  - [x] SubTask 2.2: 修改 `src-tauri/src/database/duckdb.rs:218-248` 的 `batch_insert`：签名同上，移除 `v.replace('\'', "''")` 手工转义，值改为 `?` 占位符参数化
  - [x] SubTask 2.3: 更新 `src-tauri/src/database/traits.rs` 中的 trait 定义
  - [x] SubTask 2.4: 更新调用方：`src-tauri/src/commands/file.rs:792, 875` 等，调用前先 `SqlIdentifier::new(&table_name)?` 转换
  - [x] SubTask 2.5: 补充测试：覆盖合法表名、含引号表名被拦截、DuckDB 含 `'` 字符值正确写入
  - [x] SubTask 2.6: 运行 `cargo check --quiet` + `cargo test --quiet` 验证

- [x] **Task 3**: P0-3 规则检测命令与规则文本对齐
  - [x] SubTask 3.1: 在 `.trae/rules/security.md §1.1` 修订 PowerShell 检测命令：用精确 regex 排除 `ident.quoted()` / `safe_xxx` 模式，或改用两段式检测（先匹配 format! + SQL 关键字，再人工核查是否含 `ident.quoted()`）
  - [x] SubTask 3.2: 在 `.trae/rules/CLAUDE.local.md §2.1` 同步修订检测命令
  - [x] SubTask 3.3: 在 `.trae/rules/mcp.md §十二` 同步修订检测命令
  - [x] SubTask 3.4: 在 `.trae/rules/architecture.md §1.1 情形 C` 明确注释"经 SqlIdentifier 封装的 format! 调用允许"，附正例反例
  - [x] SubTask 3.5: 执行修订后的检测命令，确认 Count 反映真实违规数（应为 0 或仅剩 P1-1/P1-2 待修复项）

- [x] **Task 4**: P0-4 前端硬编码中文清理（按优先级分模块）
  - [x] SubTask 4.1: 在 `src/context/LocaleContext.tsx` 扩展 i18n key 命名空间：`error.dashboard.*`、`error.task.*`、`error.project.*`、`error.table.*`、`error.boundary.*`、`error.query.*`、`chart.library.*`、`chart.add.*`
  - [x] SubTask 4.2: 优先级 1 - `src/components/common/ErrorBoundary.tsx`（line 51, 58, 64）：硬编码中文改 `t()`
  - [x] SubTask 4.3: 优先级 1 - `src/components/sql/hooks/useQueryExecution.ts`（line 60, 88, 93）：硬编码改 `t()`
  - [x] SubTask 4.4: 优先级 1 - `src/store/dashboardStore.ts`（line 83-345）：error 字段从 message 改为 i18n key；新增 `errorKey` 字段供组件层翻译
  - [x] SubTask 4.5: 优先级 1 - `src/store/taskStore.ts`（line 268-516）：20 处 toast 中文改 i18n key
  - [x] SubTask 4.6: 优先级 1 - `src/store/projectStore.ts`（line 129-227）：硬编码改 i18n key
  - [x] SubTask 4.7: 优先级 1 - `src/store/tableStore.ts`（line 112-203）：硬编码改 i18n key
  - [x] SubTask 4.8: 优先级 2 - `src/components/dashboard/ChartLibraryPanel.tsx`（line 118, 142, 161, 177-202, 321）：硬编码改 `t()`
  - [x] SubTask 4.9: 优先级 2 - `src/components/dashboard/AddChartModal.tsx`（line 48-142）：硬编码改 `t()`
  - [x] SubTask 4.10: 优先级 2 - `src/components/dashboard/DashboardItem.tsx`（line 401, 487, 500, 728, 753, 766, 772）：硬编码改 `t()`
  - [x] SubTask 4.11: 优先级 2 - `src/components/dashboard/DashboardPage.tsx`（line 146-176, 335-337, 445-451）：硬编码改 `t()`
  - [x] SubTask 4.12: 修改组件层消费 store error 的代码：从 `error` 字段改为读取 `errorKey` 并调用 `t(errorKey)` 翻译显示
  - [x] SubTask 4.13: 运行 `npx tsc --noEmit` + `npx vitest run` 验证 0 errors

- [x] **Task 5**: P0-5 project_service 重复建表合并
  - [x] SubTask 5.1: 在 `src-tauri/src/services/project_service.rs` 顶部新增 `ensure_project_info_table_exists(conn: &MutexGuardConnection<'_>) -> Result<(), String>` 函数，内含完整 `__project_info` DDL（CREATE TABLE IF NOT EXISTS）
  - [x] SubTask 5.2: 新增 `ensure_projects_registry_table_exists(conn: &MutexGuardConnection<'_>) -> Result<(), String>` 函数，内含完整 `__projects_registry` DDL
  - [x] SubTask 5.3: 替换 line 341, 549, 974, 1080, 1691 五处 `__project_info` 建表代码为 `ensure_project_info_table_exists(conn)?` 调用
  - [x] SubTask 5.4: 替换两处 `__projects_registry` 建表代码为 `ensure_projects_registry_table_exists(conn)?` 调用
  - [x] SubTask 5.5: line 1691 原本的 `CREATE TABLE`（无 IF NOT EXISTS）改为函数调用后自然变为 `CREATE TABLE IF NOT EXISTS`
  - [x] SubTask 5.6: 运行 `cargo check --quiet` + `cargo test --quiet` 验证；补充测试覆盖幂等性（多次调用 ensure 函数不报错）

---

## 批次 2：规则体系 v12.0 升级 + AGENTS.md / architecture.md 同步（计划项 1、3）

- [x] **Task 6**: 9 份规则文件版本号 v11.0 → v12.0
  - [x] SubTask 6.1: `.trae/rules/architecture.md` 头部版本号 v11.0 → v12.0；§1.2 前端架构表新增"上下文层"行（TD-7）
  - [x] SubTask 6.2: `.trae/rules/architecture.md §三` 系统表清单从 11 张修正为 17 张，命名对齐（`__automation_runs` 非 `__automation_task_runs`、`__dashboards` 非 `__saved_dashboards`）（TD-8）
  - [x] SubTask 6.3: `.trae/rules/security.md` 头部版本号 → v12.0（§1.1 检测命令已在 Task 3 修订）
  - [x] SubTask 6.4: `.trae/rules/CLAUDE.local.md` 头部版本号 → v12.0（§2.1 检测命令已在 Task 3 修订）
  - [x] SubTask 6.5: `.trae/rules/test.md` 头部版本号 → v12.0；§一 "项目测试现状"重写，与 `docs/架构现状.md §9.3` 对齐（TD-6）
  - [x] SubTask 6.6: `.trae/rules/mcp.md` 头部版本号 → v12.0（§十二 检测命令已在 Task 3 修订）
  - [x] SubTask 6.7: `.trae/rules/coding.md`、`file-lock.md`、`release.md` 头部版本号 → v12.0
  - [x] SubTask 6.8: 每份规则文件末尾的"版本变更记录见 AGENTS.md"链接保持不变

- [x] **Task 7**: AGENTS.md 系统表清单同步（计划项 3）
  - [x] SubTask 7.1: `AGENTS.md §2.2` 系统表清单从 10 张修正为 17 张，命名与 `docs/架构现状.md §十` 完全对齐
  - [x] SubTask 7.2: `AGENTS.md` 末尾版本变更记录追加 v11.0（2026-06-27）和 v12.0（2026-07-17）两条记录（TD-4）
  - [x] SubTask 7.3: `AGENTS.md` 头部版本号标注从 v11.0 → v12.0

- [x] **Task 8**: lib.rs 注释与 SYSTEM_TABLE_ENSURE_FNS 补全（TD-10）
  - [x] SubTask 8.1: 修改 `src-tauri/src/lib.rs:23` 注释从"8 张系统表"改为"17 张系统表"
  - [x] SubTask 8.2: 审查 `SYSTEM_TABLE_ENSURE_FNS` 数组，补全缺失的 ensure 函数引用，让 17 张表全部被覆盖
  - [x] SubTask 8.3: 运行 `cargo check --quiet` 验证

---

## 批次 3：CHANGELOG.md 补全（计划项 4，TD-3）

- [x] **Task 9**: CHANGELOG.md 从 1.0.0-beta 补全到 2.0.0
  - [x] SubTask 9.1: 阅读 `git log --oneline` 了解 1.0.0-beta 到 2.0.0 之间的关键里程碑
  - [x] SubTask 9.2: 修正 CHANGELOG.md 头部技术栈描述：React 18 → React 19、Zustand 5、Tauri 2 等
  - [x] SubTask 9.3: 补全以下版本条目（按时间倒序）：
    - 2.0.0（2026-07-17）：M1-M7 完成、国际化 Phase 1、图表授权范围、启动聚合优化、数据导入多格式、v22.0 架构审计
    - 1.x.x（中间版本）：根据 git log 补全关键功能
    - 1.0.0-beta：保留现有内容
  - [x] SubTask 9.4: 本次 P0 修复 + 规则 v12.0 升级作为 2.0.1 或 2.1.0 预发布条目追加

---

## 批次 4：3 个零测试 service 补充内联测试（计划项 5，TD-22/23/24）

- [x] **Task 10**: app_state_service.rs 补充内联测试（TD-22）
  - [x] SubTask 10.1: 在 `src-tauri/src/services/app_state_service.rs` 末尾新增 `#[cfg(test)] mod tests { ... }`
  - [x] SubTask 10.2: 测试用例覆盖：(1) `ensure_tables_exist` 幂等性（调用两次不报错）；(2) workspace_tabs CRUD（insert/list/update/delete）；(3) workspace_panels CRUD；(4) 并发读写（多线程调用）
  - [x] SubTask 10.3: 运行 `cargo test --quiet` 验证新增测试全部通过

- [x] **Task 11**: view_service.rs 补充内联测试（TD-23）
  - [x] SubTask 11.1: 在 `src-tauri/src/services/view_service.rs` 末尾新增 `#[cfg(test)] mod tests { ... }`
  - [x] SubTask 11.2: 测试用例覆盖：(1) VIEW 创建幂等性；(2) 删除存在的 VIEW；(3) 删除不存在的 VIEW（应友好错误）；(4) 跨引擎数据一致性（SQLite 表数据变更后 DuckDB VIEW 查询结果同步）
  - [x] SubTask 11.3: 运行 `cargo test --quiet` 验证

- [x] **Task 12**: sql_snippet_service.rs 补充内联测试（TD-24）
  - [x] SubTask 12.1: 在 `src-tauri/src/services/sql_snippet_service.rs` 末尾新增 `#[cfg(test)] mod tests { ... }`
  - [x] SubTask 12.2: 测试用例覆盖：(1) create_snippet + get_snippet；(2) list_snippets；(3) update_snippet；(4) delete_snippet；(5) snippet 唯一性约束（若存在）
  - [x] SubTask 12.3: 运行 `cargo test --quiet` 验证

---

## 批次 5：架构现状文档同步更新（v22.0 → v23.0）

- [x] **Task 13**: 更新 `docs/架构现状.md` v22.0 → v23.0
  - [x] SubTask 13.1: 头部版本号 v22.0 → v23.0，最后更新日期改为 2026-07-17
  - [x] SubTask 13.2: §1.3 当前发布版本表：规则体系版本 v11.0 → v12.0，架构文档版本 v22.0 → v23.0
  - [x] SubTask 13.3: §6.1 版本概览：capabilities 权限数字更新（若 Task 7 同步了）；services 测试覆盖从 13/16 → 16/16
  - [x] SubTask 13.4: §6.2 实测代码统计：`format!` 拼接 SQL 数字更新（修订检测后）；unwrap 数字更新
  - [x] SubTask 13.5: §6.4 已知问题表追加 5 项已修复条目（P0-1 至 P0-5 + 修复日期 2026-07-17）
  - [x] SubTask 13.6: §7.1 P0 级漏洞：5 项标题前加 ✅ 标记，每项末尾追加"**修复**: ...（2026-07-17 修复）"
  - [x] SubTask 13.7: §8 技术债务清单：TD-3、TD-4、TD-6、TD-7、TD-8、TD-9、TD-10、TD-22、TD-23、TD-24 标注 ✅ 已解决
  - [x] SubTask 13.8: §9 质量保障：测试数字更新（新增约 14+ 测试用例）
  - [x] SubTask 13.9: §13.3 下一步计划：更新为 P1 漏洞修复计划，本次完成的 5 项标记 ✅
  - [x] SubTask 13.10: 调整质量评分：从 7.6 上调到 8.2（或根据实际修复结果重新评估）
  - [x] SubTask 13.11: §13.3 末尾"本次重写说明"区块追加 v23.0 修订说明

---

## 批次 6：最终门禁验证

- [x] **Task 14**: 跑完整门禁验证（CLAUDE.local.md §六）
  - [x] SubTask 14.1: `cd src-tauri; cargo check --quiet` → 0 errors
  - [x] SubTask 14.2: `cd src-tauri; cargo test --quiet` → 除 test_get_default_db_path 外全部通过；测试总数较修复前增加
  - [x] SubTask 14.3: `npx tsc --noEmit --pretty` → 0 errors
  - [x] SubTask 14.4: `npx vitest run` → 100% passed
  - [x] SubTask 14.5: SQL 注入检测（修订后命令）→ 真实违规数 = 0
  - [x] SubTask 14.6: 敏感字符串检测 → 0 matches
  - [x] SubTask 14.7: 前端 any 类型检测 → 0 matches
  - [x] SubTask 14.8: unwrap/expect 检测 → 非测试代码 0 处
  - [x] SubTask 14.9: 系统表清单三处一致：执行 PowerShell 对比 AGENTS.md / architecture.md / 架构现状.md 的系统表清单
  - [x] SubTask 14.10: 前端硬编码中文检测（仅 ErrorBoundary、useQueryExecution、4 个 store、4 个 dashboard 组件）：grep 中文字符串字面量，期望 0 处

---

# Task Dependencies

```
Task 1 (P0-1 foreign_keys)         ← 独立，可立即开始
Task 2 (P0-2 batch_insert)         ← 独立，可与 Task 1 并行
Task 5 (P0-5 project_service 重构)  ← 独立，可与 Task 1/2 并行
Task 3 (P0-3 规则检测命令)          ← 独立，可与 Task 1/2/5 并行
Task 4 (P0-4 前端 i18n)             ← 独立，可与 Task 1/2/3/5 并行

Task 6 (规则 v12.0 升级)            ← 依赖 Task 3 完成（避免重复修订 security.md / CLAUDE.local.md / mcp.md）
Task 7 (AGENTS.md 同步)             ← 依赖 Task 6 完成（版本号统一）
Task 8 (lib.rs 注释)                ← 依赖 Task 7 完成（确认 17 张表清单）

Task 9 (CHANGELOG 补全)             ← 独立，可与 Task 6/7/8 并行

Task 10 (app_state_service 测试)    ← 独立，可与 Task 11/12 并行
Task 11 (view_service 测试)         ← 独立，可与 Task 10/12 并行
Task 12 (sql_snippet_service 测试)  ← 独立，可与 Task 10/11 并行

Task 13 (架构现状文档 v23.0)        ← 依赖 Task 1-12 全部完成
Task 14 (最终门禁验证)              ← 依赖 Task 13 完成
```

**并行机会**：
- 第一波：Task 1 / 2 / 3 / 4 / 5 可全部并行（5 个独立修复任务）
- 第二波：Task 6 / 9 / 10 / 11 / 12 可并行（规则升级 + CHANGELOG + 3 个测试任务）
- 第三波：Task 7 / 8 串行（依赖 Task 6）
- 第四波：Task 13 → Task 14 串行

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/lang/zh-CN/).

## Tech Stack

- 前端：React 19 + TypeScript 5 + Zustand 5 + ECharts 5 + AgGrid 35 + Monaco Editor
- 后端：Rust 2021 edition + Tauri 2 + SQLite (rusqlite 0.32) + DuckDB 1.x
- 构建：Vite 7 + Vitest 4 + Playwright 1
- 架构：前后端三层分离（commands/services/database 与 components/store/services）

---

## [2.3.0] - 2026-07-18

### Added
- 引入前端覆盖率工具 @vitest/coverage-v8（vitest.config.ts 添加 coverage 配置，package.json 添加 coverage:web 脚本）
- 引入 Rust 覆盖率工具脚本（package.json 添加 coverage:rust 脚本，需先 cargo install cargo-tarpaulin）
- 新建 CI 门禁配置 .github/workflows/ci.yml（5 项 step：cargo check / cargo clippy -D warnings / cargo test / tsc --noEmit / vitest run，触发条件 push to main + pull_request）
- 新建 PR 审查清单 docs/PR_REVIEW_CHECKLIST.md（五大类：架构合规 / 安全合规 / 代码规范 / 测试要求 / 文档同步）

### Changed
- migration_service.rs:103 format! ALTER TABLE 形式违规修复：通过 SqlIdentifier::new() 校验 + ident.quoted() 拼装，不再使用裸 format!
- services 层 7 处 too_many_arguments 重构：
  - sql_service.rs 5 处函数（execute_via_duckdb_or_sqlite / execute_routed_duckdb_query / handle_duckdb_query_error / try_duckdb_view_refresh_retry / handle_duckdb_panic）提取为 SqlExecContext struct
  - task_service.rs 2 处函数（handle_execute_success / handle_execute_failure）提取为 TaskExecContext struct
  - 保留项从 17 降至 9（commands 4 + dashboard_service 3 + sql_snippet_service 1 + audit_log 1）

### Verified
- 应用启动验证通过（npm run tauri dev，无 panic/crash，TauriAppState 34.64ms，DuckDB 预加载 1639ms）
- 前端测试覆盖率：91.36% statements / 87.88% branches / 96.55% functions
- cargo check / cargo test / cargo clippy -D warnings / npx tsc / npx vitest 全部通过

---

## [2.2.0] - 2026-07-17

### P2 漏洞修复（5 项）

#### P2-1: clippy 警告清零
- 警告数从 ~63 降至 0（`cargo clippy --all-targets -- -D warnings` 通过）
- 修复机械类警告：borrowed_box、get_first、manual_flatten、ptr_arg、len_zero、unnecessary_cast、manual_range_contains、vec_init_then_push、useless_asif、manual_clamp、doc_lazy_continuation、items_after_test_module、explicit_auto_deref、useless_vec、assertions_on_constants、bool_assert_comparison、while_let_loop、while_let_on_iterator、manual_repeat_n
- 新增 2 个 type alias：DuckDbConnHandle、DefaultSettingEntry
- 17 个 too_many_arguments 保留项加 `#[allow]` + TODO 注释（留待 v24.0 深度重构）

#### P2-2: 透明窗口诊断日志去重
- 首次成功后跳过重试日志输出
- 中间重试日志级别从 info!/warn! 降为 debug!
- 启动日志只保留首次诊断 + 最终结果两条 info!
- 新增 apply_to_hwnd_reapply + apply_borderless_to_hwnd_reapply 函数

#### P2-3: 前端组件 JSDoc 补充
- 10 个关键组件 JSDoc 覆盖率提升至 80%-90%
- 覆盖组件：DashboardItem、ChartLibraryPanel、AddChartModal、SqlQueryPage、TaskCenterPage、DatabaseExplorer、ErrorBoundary、Toast、Toolbar、Sidebar

#### P2-4: 函数过长/嵌套过深重构
- 9 个 services 文件重构：sql_service、task_service、dashboard_service、migration_service、settings_service、profile_service、project_service、chart_service、app_state_service
- sql_service.rs 缓存写回逻辑 5 层嵌套 → 2 层（提取 apply_cache_post_exec 函数）
- migration_service.rs apply_optimization_indexes 225 行 → 11 个分类辅助函数

#### P2-5: 错误信息用户友好度提升
- 修改 commands/file.rs、project.rs、sql.rs 三个文件
- 12 处技术性错误信息改为用户可读中文文案 + log::error! 日志
- 错误信息分级：用户可读文案写入 ApiResponse.message；技术细节通过 log::error! 写入日志

### 质量提升
- clippy 门禁通过（`cargo clippy --all-targets -- -D warnings` 0 warnings）
- 质量评分从 9.2 上调到 9.5
- 架构现状文档 v23.0 → v23.1

---

## [2.1.0] - 2026-07-17 (预发布)

### Added
- 规则体系 v11.0 → v12.0 升级：新增规格驱动开发流程，MCP 工具验证内化为默认开发流程一环
- 架构现状文档 v22.0 → v23.0：同步本轮 P0 修复与规则升级
- 为 3 个零测试 service 补充内联测试：
  - `app_state_service`（工作区标签页/面板状态持久化）
  - `view_service`（DuckDB VIEW 路由管理）
  - `sql_snippet_service`（SQL 代码片段管理）

### Fixed
- P0 安全漏洞：SQLite 连接统一启用 `foreign_keys` 外键约束
- P0 安全漏洞：`batch_insert` 强制使用 `SqlIdentifier` 校验表/列名，杜绝注入
- P0 安全漏洞：规则检测命令对齐（security/architecture/coding 检测正则统一）
- P0 国际化漏洞：前端硬编码中文字符串清理，统一走 i18n key
- P0 数据完整性：`project_service` 重复建表逻辑合并为单次初始化

### Changed
- CHANGELOG.md 补全（Task 9）：补齐 1.0.0-beta → 2.0.0 全部版本条目，修正技术栈描述

---

## [2.0.0] - 2026-07-17

### Added
- v22.0 架构深度审计：识别 50 项漏洞（5 P0 / 17 P1 / 18 P2 / 10 P3）+ 27 项技术债务
- 完成 M1-M7 七大里程碑：
  - M1 基础框架（三层架构骨架、SqlIdentifier 安全封装）
  - M2 SQL 编辑器（多语句执行、查询历史、结果导出）
  - M3 仪表盘图表（多仪表盘、拖拽布局、10+ 图表类型）
  - M4 自动化任务（定时 SQL 执行、Webhook 通知、运行日志）
  - M5 架构质量基线（规则体系 v11.0、MCP 工具验证）
  - M6 性能优化（启动聚合、虚拟滚动）
  - M7 测试体系（Rust 内联测试 + Vitest 单测 + Playwright E2E）
- 国际化 Phase 1：130+ i18n key，覆盖 20+ 组件
- 图表授权范围：支持 `visibility` + `authorized_dashboard_ids` 双维度权限控制
- 启动聚合优化：`get_startup_status` 一次 IPC 拿全首屏数据，减少冷启动往返
- 数据导入多格式支持：CSV、Excel、JSON、JSON Lines、Parquet、TXT
- 虚拟滚动：QueryHistory / TaskRunLogs / Trash / ChartLibrary 四处长列表场景

### Changed
- 双引擎架构定型：SQLite（事务持久化）+ DuckDB（分析查询），各司其职
- 后端 Rust 依赖版本锁定（tauri 2.11.1、serde 1.0.228、rusqlite 0.32.1、duckdb 1.10502.0）
- 前端依赖升级：React 18 → React 19、Zustand 4 → Zustand 5、Vite 6 → Vite 7

### Fixed
- 修复应用关闭卡死问题（`7a649f7`）
- 修复仪表盘显示不一致问题（`7a649f7`）

---

## [1.x.x] - 2026-05 ~ 2026-06

> 1.x 系列为 1.0.0-beta 之前的功能迭代期，按 git log 关键里程碑分组。

### [1.1.0] - 2026-05-17 ~ 2026-05-27

#### Added
- 双引擎架构引入：`v1.1` 增加 DuckDB 数据库，与 SQLite 并存（`73a2b05`）
- 多 CSV 文件批量导入（`6639a39`）
- 后端改为混合数仓架构（`6639a39`）
- DuckDB VIEW 机制实现表路由（`72c5b58`）
- MVP 界面重构（`d9b5255`）

### [1.0.0] - 2026-05-15 ~ 2026-06-20

#### Added
- 项目初始提交：CSV viewer with Tauri + React + DuckDB（`1970fb5`，2026-05-15）
- SQL 编辑页与翻译系统持续迭代（`f367591`，2026-06-23）

#### Changed
- 数据库选型演化：DuckDB → SQLite（`3b983b1`，2026-05-17）→ 双引擎回归（`73a2b05`，2026-05-17）

---

## [1.0.0-beta] - 2026-06-27

### Added
- SQL 编辑器：支持多语句执行、查询历史、结果导出
- 数据导入：支持 CSV/Excel 批量导入，进度可视化
- 仪表盘：支持多仪表盘管理、图表拖拽布局、筛选器
- 图表系统：支持柱状图、折线图、饼图等 10+ 图表类型
- 自动化任务：定时 SQL 执行、Webhook 通知
- 回收站：表删除后可恢复
- 项目管理：多项目隔离
- 审计日志：操作记录可追溯
- 主题系统：明暗主题切换

### Tech Stack（当时状态）
- 前端：React 18 + TypeScript + Zustand + ECharts + AgGrid
- 后端：Rust + Tauri + SQLite + DuckDB
- 架构：前后端分离，三层架构（commands/services/database）

### Known Issues
- 部分高级图表类型仍在优化中
- 大文件导入性能有待提升

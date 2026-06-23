# QuickerSQL 产品路线图与商业BI对标分析 - Product Requirement Document

## Overview
- **Summary**：对 QuickerSQL 当前已实现功能进行盘点，与市面主流商业BI与本地数据管理软件（DuckDB Studio / Tableau / Power BI Desktop / Metabase / Superset / Looker Studio / ClickHouse Local / dbt / TablePlus 等）逐项能力对标，识别能力缺口，输出"本地轻量但能力完善"的下一步推进路线图，并保存为本地产品分析文档。
- **Purpose**：解决"项目已有什么、还差什么、先做什么"三个核心问题，使后续开发有清晰的产品依据与优先级，而不是凭技术感觉做功能。
- **Target Users**：QuickerSQL 的产品/研发负责人（即本项目所有者）与所有贡献者。

## Goals
- **G1**：系统性盘点 QuickerSQL 现状（v2.0.0），给出"已实现功能清单"可量化。
- **G2**：与至少 8 款典型商业/开源 BI 和数据管理软件逐项对标，输出对比矩阵（feature matrix）。
- **G3**：识别并排序能力缺口，输出下一个大版本（v3.0 产品规划）所需推进的 Top 功能列表，并给出 P0/P1/P2。
- **G4**：保存本地产品分析文档（spec.md / tasks.md / checklist.md），成为后续 `/spec` 驱动开发的入口。

## Non-Goals (Out of Scope)
- ❌ **不做云服务化**：保留"本地轻量"定位，不引入联网的 SaaS 部署模式。
- ❌ **不做多用户协作系统**：不引入账号、角色、权限（除本地单用户偏好设置外）。
- ❌ **不做企业级数据治理（血缘、质量、脱敏）**：不作为当前路线重点。
- ❌ **不引入 Dataset/语义层**：用户直接操作 SQL/表/视图即可，不增加中间抽象层。
- ❌ **不重新实现 Python/R 大数据生态**：不通过任何形式引入 Python/R 解释器依赖，保持零部署定位。
- ❌ **不修改现有 tier-1 文件**：本 spec 仅为产品规划阶段，不直接产生代码。
- ❌ **不写测试**：本 spec 不包含实现阶段的代码与测试。

## Background & Context
- 当前项目：QuickerSQL v2.0.0，Tauri (Rust) + React 桌面应用，基于 SQLite + DuckDB 的本地数据分析引擎。
- 核心目录结构（架构骨架）：
  - 后端：[commands](file:///e:/LA_DUCK/la-duck/src-tauri/src/commands) / [services](file:///e:/LA_DUCK/la-duck/src-tauri/src/services) / [models](file:///e:/LA_DUCK/la-duck/src-tauri/src/models) / [database](file:///e:/LA_DUCK/la-duck/src-tauri/src/database) / [utils](file:///e:/LA_DUCK/la-duck/src-tauri/src/utils)
  - 前端：[components](file:///e:/LA_DUCK/la-duck/src/components) / [store](file:///e:/LA_DUCK/la-duck/src/store) / [services](file:///e:/LA_DUCK/la-duck/src/services) / [types](file:///e:/LA_DUCK/la-duck/src/types) / [utils](file:///e:/LA_DUCK/la-duck/src/utils)
  - 规则文档：`.trae/rules/{architecture,security,coding,test,file-lock,mcp,release}.md`
- 已暴露的 Tauri command 总数 ≈ 65+（各 domain commands 文件合计约 185 个 `fn` 定义），覆盖数据库/文件/SQL/项目/回收站/查询历史/图表/设置/审计/应用状态/仪表盘/自动化/启动 13 个领域。
- 技术约束：
  - 前端不可直连数据库；SQL 文本禁止在前端拼接（security.md §2）。
  - 参数化查询为唯一合法调用路径（security.md §1）。
  - 系统表必须以 `__` 开头（architecture.md §3）。
  - Tier-1 文件修改须先完整读取（file-lock.md）。
- 产品定位（需在本规划中强化）：**本地单用户 · 零部署 · 零学习门槛 · 轻量但功能完善的个人数据工作台**（本地版 Power BI Desktop 的超精简替代 + 工程化数据管理能力）。

## Functional Requirements（基于"对标后输出"这一产出维度）
- **FR-1**：产出一份"当前项目功能盘点表"，按"数据源 / 查询 / 分析 / 可视化 / 仪表盘 / 自动化 / 协作与导出 / 管理与治理"八大维度归类。
- **FR-2**：产出一份"商业BI/数据管理软件功能矩阵"，覆盖至少 8 款参考软件×至少 15 项能力维度。
- **FR-3**：输出"差距分析表"（Gap Analysis），每项差距标注优先级 P0/P1/P2。
- **FR-4**：输出"下一个版本推进路线图"，含里程碑 M1/M2/M3 与明确可交付物。
- **FR-5**：产品分析文档必须可本地读取（Markdown，UTF-8），不依赖外部系统。

## Non-Functional Requirements
- **NFR-1（可读性）**：对比矩阵、差距分析、路线图均以结构化表格呈现，一眼能看出"哪些缺、先补什么"。
- **NFR-2（可追踪）**：每项推进功能必须给出落地到本项目目录结构的建议文件路径，便于未来开 `/spec` 实施。
- **NFR-3（可复核）**：盘点项均能用 `Get-ChildItem / Select-String / cargo check` 等终端命令交叉验证。
- **NFR-4（定位一致）**：所有建议功能不违反"本地轻量"定位，不引入云依赖。

## Constraints
- **Technical**：保留 Tauri (Rust) + React + SQLite + DuckDB 的技术栈不变；不引入 Node 运行时之外的重型依赖。
- **Business**：以"本地个人数据工作台"为唯一产品定位，不走 SaaS。
- **Compliance**：不引入外部 API Key 管理，不联网收集用户数据；用户路径敏感字段须脱敏（遵循 security.md §3）。
- **Dependencies**：规划阶段不新增 Cargo.toml / package.json 依赖；实施阶段再按子 spec 评审。

## Assumptions
- 用户日常典型数据量：**单表 1 万 ~ 500 万行**，CSV/Excel 源为主，少量 Parquet。
- 用户典型硬件：普通 Windows 笔记本 16G 内存，SSD。
- 用户目标场景：**个人BI看板、销售数据分析、CSV/Excel 即席查询、轻量 ETL、自动化报表**。
- 不引入付费组件；可视化仍以 ECharts + AG Grid 为基础栈。

## Acceptance Criteria

### AC-1：当前项目功能盘点完整
- **Given**：项目当前为 v2.0.0，代码位于 `e:\LA_DUCK\la-duck`。
- **When**：对 commands/services/models/components/store 五大目录做功能归类。
- **Then**：产出一份 ≥ 8 大维度 × ≥ 30 项具体功能点的清单表，并在表中标记每项"已实现 / 部分实现 / 未实现"。
- **Verification**：`programmatic`（可复用 PowerShell 扫描 commands 数量、components 目录结构）+ `human-judgment`（归类是否合理）。

### AC-2：商业BI对标矩阵可对比
- **Given**：参考软件不少于 8 款（含 Tableau、Power BI Desktop、Metabase、Superset、Looker Studio、DuckDB Studio、ClickHouse Local、TablePlus/dbeaver 类管理工具）。
- **When**：按数据源、查询、建模、可视化、仪表盘、协作/发布、权限、版本管理、自动化、移动端、扩展生态等维度构建矩阵。
- **Then**：矩阵每项用"已具备 / 部分具备 / 不具备 / 不适用"四档，且给出 QuickerSQL 的定位差异。
- **Verification**：`human-judgment`（矩阵覆盖度与区分度）。

### AC-3：差距分析（Gap Analysis）可排序
- **Given**：AC-1 与 AC-2 完成。
- **When**：对"商业BI具备但本项目未具备"的功能点逐项评估重要度 + 实施成本。
- **Then**：产出 Top 15 差距项，每项含 P0/P1/P2 与一句话"为什么先做"。
- **Verification**：`human-judgment` + `programmatic`（每项需能对应到一个可落地子任务的建议路径）。

### AC-4：路线图清晰可执行
- **Given**：AC-3 已产出 Top 差距项。
- **When**：把差距项组织为 M1/M2/M3 三个里程碑，每里程碑 4~6 周工作量。
- **Then**：每里程碑给出交付物、对应文件路径建议、可验证的门禁命令。
- **Verification**：`human-judgment`（节奏是否合理）+ `programmatic`（里程碑门禁命令是否可执行）。

### AC-5：文档可本地阅读与版本化
- **Given**：文档写在 `.trae/specs/product-roadmap-commercial-BI-benchmark/` 目录。
- **When**：在本地编辑器打开该目录 3 份 md 文件。
- **Then**：可读、结构清晰、表格完整，不依赖外部图片或网络。
- **Verification**：`programmatic`（路径存在 + 文件行数/大小可度量）。

## Open Questions（已回答）
- ✅ Q1：多数据源（PostgreSQL/MySQL/REST API/JSON）—— **立即在 M1 引入**。通过 DuckDB `postgres_scanner` / `mysql_scanner` / `httpfs` 扩展实现，让项目从"本地文件"升级为"个人数据中台"。
- ❌ Q2：数据集 Dataset / 语义层 Semantic Layer—— **不需要**。不引入中间抽象，用户直接操作 SQL/表/视图，保持产品简单与定位一致。
- ❌ Q3：Python/R 脚本作为可插拔分析扩展—— **暂不需要**。保持"零部署"定位，不引入解释器依赖；未来如有明确用户场景再单独提 spec 讨论。
- ✅ Q4：自动化任务调度—— **升级为 DAG（有向无环图）调度**。支持任务依赖声明（A 成功后触发 B），支持并行分支与失败重试，保留 Cron 触发入口但内部运行 DAG 引擎。
- ✅ Q5：仪表盘导出优先级—— **高于新图表类型**。PNG/PDF 导出先实现，HTML 延后；高级图表类型在上述完成后再补充。

---

# 附录 A：当前项目功能盘点表（v2.0.0）

| 维度 | 功能点 | 状态 | 关键文件/目录 | 备注 |
|------|--------|------|---------------|------|
| **1. 数据源接入** | CSV 导入 | ✅ 已实现 | [commands/file.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/commands/file.rs)、[components/import](file:///e:/LA_DUCK/la-duck/src/components/import) | 支持预览/批量导入 |
| | Excel（多 Sheet）导入 | ✅ 已实现 | [commands/file.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/commands/file.rs) | `get_excel_sheets` / `load_excel_sheet` |
| | SQLite 打开/创建项目 | ✅ 已实现 | [commands/project.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/commands/project.rs) | `create_project` / `open_project` / `switch_project` |
| | 多数据库切换 | ✅ 已实现 | [commands/database.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/commands/database.rs) | `list_databases` / `get_database_status` |
| | DuckDB 能力使用（ATTACH SQLite） | ✅ 已实现 | [database/duckdb.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/database/duckdb.rs)、[lib.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/lib.rs#L217-L295) | DuckDB 懒加载，首次使用时启动 |
| | Parquet / Arrow IPC 读取 | ⚠️ 未实现 | — | 商业BI标配，DuckDB 原生支持但本项目未暴露 |
| | PostgreSQL/MySQL 直连 | ❌ 未实现 | — | TablePlus / DBeaver 基础能力 |
| | REST API / JSON 拉取 | ❌ 未实现 | — | Power BI / Metabase 均内置 |
| | Google Sheets / 在线表格 | ❌ 未实现 | — | 低优先级，但对协作场景有用 |
| **2. 数据查询** | SQL 编辑器（Monaco） | ✅ 已实现 | [components/sql](file:///e:/LA_DUCK/la-duck/src/components/sql) | 语法高亮、复制、导出 |
| | 参数化查询（SQL 安全层） | ✅ 已实现 | [database/router.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/database/router.rs)、[database/security.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/database/security.rs) | 遵循 security.md §1 |
| | 查询结果分页/大结果虚拟化 | ✅ 已实现 | [components/sql/QueryResult.tsx](file:///e:/LA_DUCK/la-duck/src/components/sql/QueryResult.tsx) | AG Grid + 自定义虚拟滚动 |
| | 查询历史收藏/检索/清理 | ✅ 已实现 | [commands/query_history.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/commands/query_history.rs)、[components/query-history](file:///e:/LA_DUCK/la-duck/src/components/query-history) | 有 query_cache_service 优化 |
| | 只读查询缓存（LRU + TTL） | ✅ 已实现 | [services/query_cache_service.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/services/query_cache_service.rs) | 默认开启，默认容量 100 |
| | SQL 模板库 / 片段管理 | ❌ 未实现 | — | Metabase Saved Questions 等价能力 |
| | 可视化 Query Builder（拖拽条件） | ❌ 未实现 | — | Tableau / Power BI 标志性能力 |
| | 自然语言提问（NL → SQL） | ❌ 未实现 | — | 商业BI热点，依赖本地 LLM |
| **3. 数据分析 / 建模** | 行过滤 / 列选择 / 聚合 | ✅ 已实现（通过 SQL） | — | 但需要用户手写 SQL |
| | Join / 子查询 / CTE | ✅ 已实现（通过 SQL） | — | DuckDB 支持 |
| | 数据清洗 / 类型推断 | ⚠️ 部分实现（依赖 SQLite/DuckDB 原生） | — | 缺乏可视化的字段类型编辑与数据探查面板 |
| | 视图（View）管理 | ✅ 已实现（DuckDB 视图创建） | [services/view_service.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/services/view_service.rs)、[lib.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/lib.rs#L266-L279) | 代码层面已有视图创建，但缺乏 GUI |
| | 语义层 / 数据集 Dataset | ❌ 未实现 | — | Tableau Data Source / Looker Model 等价能力 |
| | 数据探查（Profile / 分布 / 缺失） | ❌ 未实现 | — | Power BI "数据视图" + pandas-profiling 等价能力 |
| | 派生列 / 计算字段 GUI | ❌ 未实现 | — | Tableau Calculated Field 等价能力 |
| **4. 数据可视化** | 折线/柱状/饼图/散点等基础图表 | ✅ 已实现 | [components/chart](file:///e:/LA_DUCK/la-duck/src/components/chart)、[services/chart_service.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/services/chart_service.rs) | ECharts 驱动 |
| | 图表类型推荐引擎 | ✅ 已实现 | [commands/chart.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/commands/chart.rs) | `get_recommended_chart_types` |
| | 图表配置保存 | ✅ 已实现 | [commands/chart.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/commands/chart.rs) | `save_chart_image` / `create_saved_chart` |
| | 热力图 / 地图 / 桑基 / 漏斗 / KPI Card | ❌ 未实现 | — | 商业BI丰富图表类型 |
| | 双轴 / 组合图 / 误差线 | ⚠️ 未显式支持 | — | 可通过配置实现，但需用户手写 option |
| | 图形交互（刷选、联动、钻取） | ❌ 未实现 | — | Tableau 标志性能力 |
| | 条件格式（Conditional Formatting） | ❌ 未实现 | — | Power BI / Excel 基础能力 |
| **5. 仪表盘** | 多图表组合仪表盘 | ✅ 已实现 | [components/dashboard](file:///e:/LA_DUCK/la-duck/src/components/dashboard)、[commands/dashboard.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/commands/dashboard.rs) | 拖拽布局、增删改查 |
| | 全局过滤器（Filter Bar） | ✅ 已实现 | [components/dashboard/filters](file:///e:/LA_DUCK/la-duck/src/components/dashboard/filters) | `DashboardFilterBar` / 日期/文本/下拉 |
| | 仪表盘导出（PNG/PDF/HTML） | ❌ 未实现 | — | Power BI / Tableau 发布能力的本地版 |
| | 仪表盘模板 / 克隆 | ❌ 未实现 | — | 复用能力 |
| | 响应式布局 / 移动端视图 | ❌ 未实现 | — | 非核心但对分享有用 |
| | KPI 指标卡 / 预警阈值高亮 | ❌ 未实现 | — | BI 常见能力 |
| **6. 自动化任务** | Cron 定时执行 SQL | ✅ 已实现 | [commands/automation.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/commands/automation.rs)、[services/task_service.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/services/task_service.rs) | 独立后台线程调度 |
| | 任务运行日志 | ✅ 已实现 | [components/automation/TaskRunLogsPanel.tsx](file:///e:/LA_DUCK/la-duck/src/components/automation/TaskRunLogsPanel.tsx) | 查看每次运行结果 |
| | 任务启用/禁用/立即运行 | ✅ 已实现 | [components/automation](file:///e:/LA_DUCK/la-duck/src/components/automation) | |
| | 多步骤 DAG（任务依赖） | ❌ 未实现 | — | Airflow / dbt 基础能力 |
| | 任务失败告警（通知/弹窗） | ❌ 未实现 | — | 自动化必备 |
| | 任务输出 → 文件 / 图表刷新联动 | ❌ 未实现 | — | "自动化报表"场景 |
| **7. 数据管理 / 工程化** | 表结构（元数据）查看 | ✅ 已实现 | [commands/database.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/commands/database.rs) | `get_table_meta` |
| | 表重命名 / 删除 | ✅ 已实现 | [commands/database.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/commands/database.rs) | `rename_table` / `delete_table` |
| | 回收站 / 软删除 | ✅ 已实现 | [commands/trash.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/commands/trash.rs) | `__trash_metadata` 系统表 |
| | 项目（Project）隔离 | ✅ 已实现 | [components/project/ProjectManager.tsx](file:///e:/LA_DUCK/la-duck/src/components/project/ProjectManager.tsx) | 多项目管理 |
| | 项目导出 / 备份（打包为文件） | ⚠️ 部分实现 | [commands/project.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/commands/project.rs) | `export_database` / `export_selected_projects` |
| | 版本管理（数据快照 / Git 集成） | ❌ 未实现 | — | dbt + git 等价能力 |
| | 审计日志（本地使用记录） | ✅ 已实现 | [commands/audit_log.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/commands/audit_log.rs) | `__audit_logs` 系统表 |
| | 工作区（Workspace Tab）持久化 | ✅ 已实现 | [commands/app_state.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/commands/app_state.rs) | 保存布局/打开状态 |
| | 设置项（Settings） | ✅ 已实现 | [commands/settings.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/commands/settings.rs)、[components/settings](file:///e:/LA_DUCK/la-duck/src/components/settings) | 包括 Query Cache Stats 面板 |
| **8. 协作与发布 / 性能** | 主题（暗色/亮色） | ✅ 已实现 | [context/ThemeContext.tsx](file:///e:/LA_DUCK/la-duck/src/context/ThemeContext.tsx)、[styles/theme.css](file:///e:/LA_DUCK/la-duck/src/styles/theme.css) | |
| | 国际化（i18n） | ⚠️ 基础骨架（`LocaleContext`）但未完成 | [context/LocaleContext.tsx](file:///e:/LA_DUCK/la-duck/src/context/LocaleContext.tsx) | 仅中英占位，未真正翻译 |
| | 性能：DuckDB 懒加载 / 查询缓存 / 虚拟化渲染 | ✅ 已实现 | [lib.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/lib.rs#L297-L325)、[services/query_cache_service.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/services/query_cache_service.rs) | 有明确耗时打点 |
| | 导出 CSV/JSON/Excel | ⚠️ 部分实现 | [components/sql/hooks/useQueryExport.ts](file:///e:/LA_DUCK/la-duck/src/components/sql/hooks/useQueryExport.ts) | 查询结果导出 |
| | 导出为可分享的静态 HTML 仪表盘 | ❌ 未实现 | — | Looker Studio / Power BI Publish to Web 等价能力 |
| | 多用户 / 角色权限 / 评论 | ❌ 不适用（本地单用户） | — | 与产品定位冲突 |

**小结**：本项目在"**查询 + 基础图表 + 仪表盘 + 自动化 + 数据管理**"五块已经具备一个可用最小版本，但在"**多数据源 + 可视化建模 + 高级图表 + 仪表盘导出与模板 + 数据探查 + 自动化告警**"等维度仍有明显差距。

---

# 附录 B：商业BI / 数据管理软件功能对比矩阵

| 能力维度 | QuickerSQL v2 | Tableau | Power BI Desktop | Metabase | Superset | DuckDB Studio | ClickHouse Local | TablePlus / DBeaver |
|----------|---------------|---------|------------------|----------|----------|---------------|------------------|-------------------|
| **数据源覆盖** | CSV/Excel/SQLite + DuckDB 混合 | 几乎全部关系型 + SaaS | 几乎全部关系型 + SaaS | 主流 DB + SaaS | 主流 DB + 数据湖 | DuckDB / Parquet / CSV | ClickHouse / Parquet / S3 | 几乎全部关系型 DB |
| **SQL 查询** | ✅ Monaco + 参数化 | ✅ 原生 SQL + 可视化生成 | ✅ DAX + Power Query | ✅ Native Query + 查询生成器 | ✅ SQL Lab | ✅ SQL 编辑器 | ✅ SQL 编辑器 | ✅ SQL 编辑器 + 表格浏览 |
| **可视化 Query Builder** | ❌ | ✅ 拖拽字段生成视图 | ✅ Power Query 图形化 | ✅ 提问式 UI | ✅ 拖拽图表构建 | ❌ | ❌ | ❌ |
| **语义层 / 建模** | ❌ | ✅ Data Source + 计算字段 | ✅ Data Model + DAX | ✅ Models（轻量） | ✅ Dataset + Semantic Layer | ❌ | ❌ | ❌ |
| **数据探查 / Profile** | ❌ | ✅ 字段分布 / 摘要 | ✅ 数据视图 + 摘要 | ✅ 字段元信息 | ⚠️ 基础 | ❌ | ❌ | ❌ |
| **图表类型丰富度** | ⚠️ 基础 5~8 种 | ✅ 30+ | ✅ 30+ | ✅ 15+ | ✅ 30+ | ⚠️ 基础 | ⚠️ 基础 | ❌ |
| **地图 / 地理可视化** | ❌ | ✅ 内置地图 + 自定义 | ✅ 内置地图 + ArcGIS | ✅ 地图（Pro 版更好） | ✅ Deck.GL 地理可视化 | ❌ | ❌ | ❌ |
| **刷选 / 联动 / 钻取** | ❌ | ✅ 核心能力 | ✅ 核心能力 | ✅ 部分 | ✅ 部分 | ❌ | ❌ | ❌ |
| **仪表盘** | ✅ 拖拽布局 + 过滤器 | ✅ 看板 + 故事 | ✅ 报表 + 仪表盘 | ✅ 集合 + 仪表盘 | ✅ 仪表盘 | ❌ | ❌ | ❌ |
| **发布 / 导出** | ❌ 仅基础导出 | ✅ Tableau Public / Server | ✅ PBIRS / 导出 PDF | ✅ 分享链接 + 订阅 | ✅ 导出 / 分享 | ❌ | ❌ | ⚠️ 导出 SQL/CSV |
| **自动化 / 调度** | ✅ Cron（单步骤） | ✅ Tableau Prep + Server 调度 | ✅ Power Automate + 订阅 | ✅ Pulse / Alerts | ✅ 定时报告 + Alert | ❌ | ❌ | ❌ |
| **版本 / Git 集成** | ❌ | ❌（需外部） | ❌（需外部） | ✅ Metabase 版本 | ✅ Superset 支持 Git 配置同步 | ❌ | ❌ | ❌ |
| **协作 / 评论** | ❌（本地单用户） | ✅ 评论/订阅/分享 | ✅ 协作/评论 | ✅（Pro 版） | ✅（自托管版） | ❌ | ❌ | ❌ |
| **权限 / 角色** | ❌（本地单用户） | ✅ RLS / 行列权限 | ✅ RLS | ✅（Pro 版） | ✅ 角色 | ❌ | ❌ | ❌ |
| **移动 / 响应式** | ❌（固定桌面） | ✅ 移动端 App | ✅ 移动端视图 | ✅ 响应式 Web | ✅ 响应式 Web | ❌ | ❌ | ❌ |
| **自然语言提问** | ❌ | ✅ Ask Data | ✅ Copilot for Power BI | ✅（Pro 版） | ✅（社区集成） | ❌ | ❌ | ❌ |
| **扩展脚本（Python/R）** | ❌ | ✅ TabPy + R | ✅ Python visual + R | ✅（Pro 版） | ✅ Python 生态 | ❌ | ❌ | ❌ |
| **本地 / 零部署** | ✅ 核心定位 | ❌（需安装 + License） | ✅ Desktop 本地 | ✅ 本地容器 / jar | ✅ 本地容器 / Python | ✅ 单文件 | ✅ 单文件 | ✅ 桌面程序 |
| **启动速度 / 轻量** | ✅ 秒启 | ❌ 分钟级启动 | ❌ 分钟级启动 | ⚠️ 中等 | ❌ 偏重型 | ✅ 秒启 | ✅ 秒启 | ✅ 秒启 |
| **数据规模** | 单表 ≤ 数百万行（个人） | ✅ 亿级 / 集群 | ✅ 亿级（Premium） | ✅ 千万级 | ✅ 亿级 + 集群 | ✅ 单机亿级 | ✅ 单机亿级 | ✅ 连接远程 DB |

**定位差异小结**：QuickerSQL 的独特价值在于 **"本地 + 零部署 + 零门槛 + 一个应用覆盖 SQL/图表/仪表盘/自动化"** —— 这是 Tableau/Power BI 的"启动重/贵"与 DuckDB Studio/ClickHouse Local 的"只有查询没有可视化"之间的定位空间。

---

# 附录 C：差距分析（Top 14 · 带优先级 · 已按用户决策更新）

| 编号 | 差距项 | 为什么重要 | 对标的商业BI功能 | 实施难度 | 优先级 | 里程碑 |
|------|--------|-------------|-----------------|----------|--------|--------|
| G-01 | **数据探查面板**（字段类型、值域、空值率、分布、唯一值、Top 频率值） | 用户拿到数据第一件事是"看看数据长什么样" | Power BI 数据视图 + pandas-profiling | 中 | **P0** | **M1** |
| G-02 | **计算字段 / 派生列 GUI**（图形化编辑字段公式，支持数值/日期/文本函数） | 避免反复写 `SELECT xxx AS yyy FROM`；降低门槛 | Tableau Calculated Field + Power BI 计算列 | 中 | **P0** | **M1** |
| G-03 | **Parquet/JSON/多分隔符 CSV 直接读取**（DuckDB 原生能力） | 让项目不再局限于 CSV/Excel，支持大数据格式 | DuckDB 原生 / Power BI Get Data | 低 | **P0** | **M1** |
| **G-12** | **PostgreSQL/MySQL/REST API/JSON 数据源**（通过 DuckDB `postgres_scanner` / `mysql_scanner` / `httpfs`） | 从"本地文件工作台"升级为"个人数据中台" —— **按用户 Q1 决策提升到 P0 并前置到 M1** | TablePlus / DBeaver / Power BI Get Data | 中高 | **P0** | **M1** |
| G-06 | **仪表盘一键导出 PNG/PDF** | 分享/汇报场景必备；优先级按用户 Q5 决策 **高于新图表类型** | Power BI 导出 / Looker Studio 发布 | 中 | **P0** | **M1** |
| G-05 | **仪表盘图表刷选与联动**（点一个柱状图，其他图表过滤） | "交互式分析"的标志性能力 | Tableau 刷选 / Power BI 交叉筛选 | 中高 | **P0** | **M1** |
| G-04 | **高级图表类型**（热力图、KPI Card、漏斗、桑基、地图、双轴、组合图、误差线） | BI 竞争力的直观差距；按 Q5 决策 **置于导出之后实现** | Tableau / Power BI Show Me 面板 | 中 | **P0** | **M1** |
| G-09 | **DAG 自动化任务调度**（任务依赖、分支、失败重试，保留 Cron 触发入口） | 按用户 Q4 决策 **升级为 DAG**；从"定时跑 SQL"变成"轻量工作流引擎" | dbt + Airflow 轻量版 | 中高 | **P1** | **M2** |
| G-10 | **仪表盘模板库 / 克隆**（对典型数据结构提供"一键生成仪表盘"） | 新用户 5 分钟得到价值 | Power BI 模板应用 / Metabase Dashboard 模板 | 中 | **P1** | **M2** |
| G-11 | **SQL 片段 / 模板库**（常用查询可保存为片段复用） | 提高重度 SQL 用户效率 | SSMS 模板 / DataGrip Live Templates | 低 | **P1** | **M2** |
| G-13 | **条件格式**（表格单元格颜色、进度条、图标集） | Excel / Power BI 用户最熟悉的分析手法 | Excel 条件格式 / Power BI 条件格式 | 中 | **P1** | **M2** |
| G-07 | **可视化 Query Builder**（字段拖拽 + 条件拼接，生成 SQL） | 非 SQL 用户的入门路径 | Tableau 工作表 / Metabase GUI | 高 | **P1** | **M2** |
| G-14 | **数据版本管理（Git 风格快照）**（对关键查询/仪表盘保留版本并可 diff） | 做"数据决策回溯"；对分析师非常有价值 | dbt + git / Superset Git sync | 高 | **P2** | **M3** |
| G-15 | **自然语言提问（本地 LLM）**（用中文"上月销售额按区域对比"生成 SQL + 图） | 产品差异化的王牌特性；前提是本地模型可跑 | Power BI Copilot / Tableau Ask Data | 高 | **P2** | **M3** |

> **已取消项**：原 G-08（Dataset / 语义层）按用户 Q2 决策 **不再推进**。原 Python/R 脚本扩展按用户 Q3 决策 **暂不推进**。

---

# 附录 D：下一步推进路线图（M1 / M2 / M3）

### 里程碑 M1 · 个人数据中台（4~6 周 · P0 全量落地）
**目标**：让"多数据源接入 + 数据查看/建模 + 仪表盘 + 导出"这一主链路在 v3.0 达到"用户上手 10 分钟内有价值"。

| 顺序 | 对应差距项 | 建议实施内容 | 建议文件路径 |
|------|------------|-------------|-------------|
| 1 | G-01 数据探查 | 新建 `ProfilePanel` 组件，对选中表运行字段分布查询（DuckDB 聚合） | `src/components/sql/ProfilePanel.tsx` + `src/services/profile_service.rs` + `src-tauri/src/commands/profile.rs` |
| 2 | G-02 计算字段 GUI | 新建 `CalculatedFieldEditor`，保存为 `__calculated_fields` 系统表 | `src/components/sql/CalculatedFieldEditor.tsx` + `src-tauri/src/models/calculated_field.rs` + `src-tauri/src/services/calc_field_service.rs` |
| 3 | G-03 Parquet/JSON 读取 | 增强 `commands/file.rs`，新增 `load_parquet` / `load_json_file` / 自定义分隔符 | `src-tauri/src/commands/file.rs`（改） + `src/components/import/`（增强预览页） |
| 4 | **G-12 多数据源**（P0 前置） | 新建 PostgreSQL/MySQL/REST API 数据源连接器；通过 DuckDB `postgres_scanner` / `mysql_scanner` / `httpfs` 扩展 | `src-tauri/src/commands/external_source.rs` + `src-tauri/src/services/external_source_service.rs` + `src/components/external-source/` |
| 5 | G-06 仪表盘导出（PNG/PDF，先于图表类型） | 新建 `dashboardExport.ts` 生成 PNG/PDF；在 DashboardToolbar 增加导出按钮 | `src/utils/dashboardExport.ts` + `src/components/dashboard/DashboardToolbar.tsx`（改） |
| 6 | G-05 图表刷选联动 | dashboardStore 中建立 `highlightFilter` 订阅机制，通过 `filterSql` 下推 | `src/store/dashboardStore.ts`（改） + `src/components/dashboard/DashboardItem.tsx`（改） |
| 7 | G-04 高级图表类型 | ChartTypeSelector 中新增 heatmap / funnel / sankey / kpi_card / dual_axis / gauge / map_point | `src/components/chart/ChartTypeSelector.tsx`（改） + `src/utils/echartsNormalize.ts`（改） |

**M1 门禁**：`cargo check --quiet` 通过 + `npx tsc --noEmit --pretty` 通过 + 可在应用内"连接 PostgreSQL 表 → 打开数据探查面板 → 新建计算字段 → 保存仪表盘 → 一键导出 PNG"全链路完成。

### 里程碑 M2 · DAG 工作流引擎与增强分析（4~6 周 · P1 全量落地）
**目标**：从"能画图"升级到"能做交互式分析 + 定时产出工作流"。

| 顺序 | 对应差距项 | 建议实施内容 | 建议文件路径 |
|------|------------|-------------|-------------|
| 1 | **G-09 DAG 调度**（升级） | 在 `task_service.rs` 引入 DAG 节点表、依赖边表、运行状态表；保留 Cron 入口；支持 A 成功→触发 B；支持失败重试与失败告警 | `src-tauri/src/services/task_service.rs`（重构） + `src/components/automation/TaskCenterPage.tsx`（增加 DAG 编辑器） |
| 2 | G-11 SQL 片段库 | `__sql_snippets` 系统表 + 片段管理 UI（新增/搜索/插入光标/删除） | `src-tauri/src/models/sql_snippet.rs` + `src-tauri/src/services/sql_snippet_service.rs` + `src/components/sql/SnippetLibrary.tsx` |
| 3 | G-13 条件格式 | 在 AG Grid 的列定义中注入条件格式规则（大于/小于/介于/Top N/Bottom N/进度条/图标集） | `src/components/common/AgGridLazy.tsx`（改） + `src/types/table.ts`（扩展列规则类型） |
| 4 | G-10 仪表盘模板库 | 预置 3~5 个典型仪表盘 JSON 模板 + 模板应用向导 | `src/components/dashboard/templates/` + `src-tauri/src/services/dashboard_template_service.rs` |
| 5 | G-07 Query Builder | 拖拽字段卡片生成 SELECT / WHERE / GROUP BY；生成 SQL 到编辑器 | `src/components/sql/QueryBuilder.tsx` + `src/utils/queryBuilder.ts` |

**M2 门禁**：可"新建 3 节点 DAG（A 导出 CSV → B 跑汇总 SQL → C 更新仪表盘）→ 配置失败告警 → 手动运行并观察日志与 UI 告警"全链路完成；SQL 片段库 CRUD 通过。

### 里程碑 M3 · 差异化特性（6~8 周 · P2 + 产品打磨）

| 顺序 | 对应差距项 | 建议实施内容 | 建议文件路径 |
|------|------------|-------------|-------------|
| 1 | G-14 数据版本管理 | 对查询/仪表盘做 snapshot 版本并可 diff；保存 `__snapshots` 表 | `src-tauri/src/services/snapshot_service.rs` + `src/components/snapshot/` |
| 2 | G-15 自然语言提问（本地 LLM，可选） | 本地 ollama `qwen2.5:7b` 把中文问题翻译成参数化 SQL | `src-tauri/src/commands/nl2sql.rs` + `src/components/sql/Nl2SqlPanel.tsx` |
| 3 | 性能与稳定性 | 完善 Query Cache 命中率监控、大结果分页的性能指标面板 | `components/settings/QueryCacheStatsPanel.tsx`（增强） |
| 4 | 体验打磨 | 完善 i18n、引导页、操作教学视频入口 | `context/LocaleContext.tsx`（填充）+ `pages/Guide.tsx` |

**M3 门禁**：自然语言面板（若启用）在断网环境可工作；所有 P0/P1 功能点有明确 UI 入口与使用说明。

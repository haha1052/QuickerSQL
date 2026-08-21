# QuickerSQL 产品路线图 - 实施任务分解（按用户决策更新版）

> 说明：每条任务在真正编码前应再开一份独立的 `/spec`，产出该子模块的 spec/tasks/checklist。
> 同一里程碑内的任务，如修改文件不重叠，可并行开发；跨里程碑必须串行。

## [ ] Task 1 · 数据探查面板（Profile Panel） — G-01 · P0 · M1
- **依赖**：无
- **描述**：对用户选中的表/查询结果按列输出数据类型、行数、空值率、唯一值数、Top 5 频率值、数值列的 min/max/mean/std/median。UI 放在 SQL 页面侧栏；后端走 DuckDB 聚合查询。大表走采样开关。
- **建议路径**：`src/components/sql/ProfilePanel.tsx` + `src-tauri/src/services/profile_service.rs` + `src-tauri/src/commands/profile.rs` + `src-tauri/src/models/profile.rs`（保存探查历史到 `__profile_history`）。
- **验收标准对应**：spec.md 附录 C G-01。
- **Test Requirements**：
  - `programmatic` TR-1.1：对 10 列、1000 行表，探查面板响应 ≤ 2s。
  - `programmatic` TR-1.2：含 NULL 值列的空值率计算正确。
  - `human-judgement` TR-1.3：一眼可读，数值/文本/日期列有区别样式。
- **安全约束**：前端只传 table_name/query_id，不拼 SQL；DuckDB 侧走参数化查询。

## [ ] Task 2 · 计算字段 / 派生列 GUI — G-02 · P0 · M1
- **依赖**：Task 1（复用字段元信息 UI 组件）
- **描述**：用户在表上新增"计算字段"，公式保存到系统表 `__calculated_fields`（id, table_name, field_name, expression, return_type, created_at）。可视化编辑器支持数值/日期/文本函数，预览前 100 行。
- **建议路径**：`src/components/sql/CalculatedFieldEditor.tsx` + `src-tauri/src/models/calculated_field.rs` + `src-tauri/src/services/calc_field_service.rs` + `src-tauri/src/commands/calculated_field.rs`。
- **Test Requirements**：
  - `programmatic` TR-2.1：计算字段 CRUD round-trip 通过。
  - `programmatic` TR-2.2：恶意表达式如 `'; DROP TABLE...` 被参数化机制隔离，不会执行。
  - `human-judgement` TR-2.3：公式编辑有语法高亮 + 实时预览表格。

## [ ] Task 3 · 增强文件数据源（Parquet / JSON / 多分隔符 CSV） — G-03 · P0 · M1
- **依赖**：无
- **描述**：在 `commands/file.rs` 新增 `load_parquet` / `load_json_file`；为 `load_csv` 增加 delimiter / encoding 参数；导入预览页增加格式检测下拉。利用 DuckDB 原生能力。
- **建议路径**：`src-tauri/src/commands/file.rs`（改）+ `src/components/import/DataImport.tsx`（改）+ `src/components/import/`（增强预览页）。
- **Test Requirements**：
  - `programmatic` TR-3.1：10 万行 Parquet 文件可导入且列信息正确。
  - `programmatic` TR-3.2：`|` 分隔 CSV 可正确解析。
  - `human-judgement` TR-3.3：格式切换交互自然。

## [ ] Task 4 · PostgreSQL / MySQL / REST API 外部数据源 — G-12 · P0 · M1
- **依赖**：无
- **描述**：通过 DuckDB `postgres_scanner` / `mysql_scanner` / `httpfs` 扩展把外部数据库/API 挂载为只读视图。连接配置（host、port、user、password）仅本地保存，不走日志，不硬编码（security.md §3）。
- **建议路径**：`src-tauri/src/commands/external_source.rs` + `src-tauri/src/services/external_source_service.rs` + `src-tauri/src/models/external_source.rs` + `src/components/external-source/`（连接管理向导页）。
- **Test Requirements**：
  - `programmatic` TR-4.1：配置中密码字段在 `__audit_logs` 中不可见。
  - `programmatic` TR-4.2：可建立 postgres 连接查询返回前 50 行。
  - `human-judgement` TR-4.3：新建数据源引导页体验清晰。

## [ ] Task 5 · 仪表盘导出 PNG/PDF — G-06 · P0 · M1（先于图表类型）
- **依赖**：无
- **描述**：在 `src/utils/dashboardExport.ts` 实现 `exportDashboardAsPng` / `exportDashboardAsPdf`。PNG 用 html2canvas；PDF 用浏览器原生打印 API + CSS `@media print`。在 DashboardToolbar 增加"导出"下拉按钮。HTML 导出放到 M2 暂不实现。
- **建议路径**：`src/utils/dashboardExport.ts` + `src/components/dashboard/DashboardToolbar.tsx`（改）。
- **Test Requirements**：
  - `programmatic` TR-5.1：导出的 PNG 非空，大小 > 10KB；PDF 可在系统 PDF 阅读器打开。
  - `human-judgement` TR-5.2：导出排版合理，不出现横向滚动条。

## [ ] Task 6 · 仪表盘图表刷选与联动 — G-05 · P0 · M1
- **依赖**：无
- **描述**：dashboardStore 新增 `highlightFilter` 全局状态（结构：{ chartId, field, value }）。DashboardItem 监听该状态，对绑定的查询结果 `filterSql` 追加 WHERE 条件重新跑；用户点击某图表柱子/切片时，点击的值写入 `highlightFilter`。
- **建议路径**：`src/store/dashboardStore.ts`（改）+ `src/components/dashboard/DashboardItem.tsx`（改）+ `src/components/chart/ChartRenderer.tsx`（绑定 click 事件）。
- **Test Requirements**：
  - `programmatic` TR-6.1：设置 `highlightFilter` 后，被过滤图表的查询结果行数 < 原始行数。
  - `human-judgement` TR-6.2：点击柱子 → 其他图表立即刷新并过滤 → 视觉反馈明确。

## [ ] Task 7 · 高级图表类型 — G-04 · P0 · M1
- **依赖**：无
- **描述**：扩展 ChartTypeSelector 新增 heatmap / funnel / sankey / kpi_card / dual_axis / gauge / map_point 共 7 种类型。在 `echartsNormalize.ts` 为每种类型生成完整 ECharts option 模板。
- **建议路径**：`src/components/chart/ChartTypeSelector.tsx`（改）+ `src/utils/echartsNormalize.ts`（改）。
- **Test Requirements**：
  - `programmatic` TR-7.1：每种新类型对最小示例数据无报错渲染。
  - `human-judgement` TR-7.2：标题/图例/坐标轴样式与现有基础图表一致。

## [ ] Task 8 · DAG 自动化任务调度（升级自 Cron） — G-09 · P1 · M2
- **依赖**：无
- **描述**：保留 Cron 触发入口，但内部运行 DAG 引擎。新增 `__automation_nodes`（节点）、`__automation_edges`（依赖边）、`__automation_node_runs`（节点运行记录）三个系统表。支持：A 成功→触发 B、并行分支、失败重试（默认 3 次）、失败 toast 告警。
- **建议路径**：`src-tauri/src/services/task_service.rs`（重构为 DAG 引擎）+ `src-tauri/src/models/automation.rs`（扩展节点/边类型）+ `src/components/automation/TaskCenterPage.tsx`（新增 DAG 可视化编辑器）+ `src-tauri/src/commands/automation.rs`（扩展 command）。
- **Test Requirements**：
  - `programmatic` TR-8.1：构造 3 节点 DAG（A→B→C），手工触发能按依赖顺序运行；B 故意失败触发 toast 告警。
  - `programmatic` TR-8.2：失败节点 3 次重试后最终失败，失败记录写入日志。
  - `human-judgement` TR-8.3：DAG 编辑器可视化直观。

## [ ] Task 9 · SQL 片段 / 模板库 — G-11 · P1 · M2
- **依赖**：无
- **描述**：`__sql_snippets` 系统表（id, name, sql_text, tags, created_at）。UI 提供新增/搜索/插入到光标处/删除。
- **建议路径**：`src-tauri/src/models/sql_snippet.rs` + `src-tauri/src/services/sql_snippet_service.rs` + `src-tauri/src/commands/sql_snippet.rs` + `src/components/sql/SnippetLibrary.tsx`。
- **Test Requirements**：
  - `programmatic` TR-9.1：CRUD round-trip；搜索不区分大小写。

## [ ] Task 10 · 表格条件格式 — G-13 · P1 · M2
- **依赖**：无
- **描述**：`src/types/table.ts` 扩展 ColumnDef，增加 `conditionalFormatRules[]`（大于/小于/等于/介于/Top N/Bottom N/进度条/图标集）。`AgGridLazy.tsx` 在 `cellClassRules` 注入规则。
- **建议路径**：`src/types/table.ts`（改）+ `src/components/common/AgGridLazy.tsx`（改）。
- **Test Requirements**：
  - `programmatic` TR-10.1：每类规则对最小样例数据可正确渲染高亮颜色。
  - `human-judgement` TR-10.2：编辑规则 UI 简洁易用。

## [ ] Task 11 · 仪表盘模板库与克隆 — G-10 · P1 · M2
- **依赖**：Task 7（高级图表类型）完成后效果更好，但不强制阻塞
- **描述**：预置 3~5 个典型仪表盘 JSON 模板（销售概览、用户行为、财务 KPI 等）。模板应用向导引导用户将模板中的占位表名映射到用户实际存在的表。
- **建议路径**：`src/components/dashboard/templates/` + `src-tauri/src/services/dashboard_template_service.rs`。
- **Test Requirements**：
  - `programmatic` TR-11.1：应用一个模板能生成一个完整仪表盘（含 ≥ 3 张图表）。
  - `human-judgement` TR-11.2：模板应用流程简洁。

## [ ] Task 12 · 可视化 Query Builder — G-07 · P1 · M2
- **依赖**：Task 1 / Task 2（复用字段元信息组件）
- **描述**：拖拽字段卡片构造 SELECT / WHERE / GROUP BY / ORDER BY / LIMIT；生成 SQL 文本供用户在 Monaco Editor 中继续编辑。SQL AST 构造放 `src/utils/queryBuilder.ts`，不直接执行，通过 `invokeCommand("execute_sql", ...)` 参数化执行。
- **建议路径**：`src/components/sql/QueryBuilder.tsx` + `src/utils/queryBuilder.ts`。
- **Test Requirements**：
  - `programmatic` TR-12.1：Builder 生成的 SQL 可在后端执行成功。
  - `human-judgement` TR-12.2：拖拽体验流畅，错误提示明确。

## [ ] Task 13 · 数据版本管理（Snapshot / Diff） — G-14 · P2 · M3
- **依赖**：Task 9（SQL 片段库 CRUD 架构可复用）
- **描述**：`__snapshots` 系统表（保存查询/仪表盘在某时刻的 JSON 快照）。UI 提供查看历史 + 选两条做文本 diff。
- **建议路径**：`src-tauri/src/services/snapshot_service.rs` + `src/components/snapshot/`。
- **Test Requirements**：
  - `programmatic` TR-13.1：保存 & 读取 snapshot round-trip。

## [ ] Task 14 · 自然语言提问（本地 LLM，可选） — G-15 · P2 · M3
- **依赖**：本地 ollama 已安装 & `qwen2.5:7b` 可运行
- **描述**：完全可选功能。检测不到 ollama 时面板禁用。把中文问题通过 ollama 翻译成参数化 SQL。
- **建议路径**：`src-tauri/src/commands/nl2sql.rs` + `src/components/sql/Nl2SqlPanel.tsx`。
- **Test Requirements**：
  - `programmatic` TR-14.1：断网环境可工作（如 ollama 存在）。

## [ ] Task 15 · 体验打磨（i18n / Guide / 性能监控面板增强） — P2 · M3
- **依赖**：无
- **描述**：填充 `LocaleContext.tsx` 中占位文案；`pages/Guide.tsx` 增加 M1/M2 功能入口指南与教学视频链接；`QueryCacheStatsPanel.tsx` 增加命中率与耗时图表。
- **建议路径**：`src/context/LocaleContext.tsx`（改）+ `src/pages/Guide.tsx`（改）+ `src/components/settings/QueryCacheStatsPanel.tsx`（增强）。

## 任务依赖关系总图（更新后）
```
Task-1 (Profile) ─┐
                   ├─▶ Task-2 (Calc Fields) ─┐
Task-3 (Parquet/JSON)┤                         ├─▶ Task-12 (QueryBuilder)
Task-4 (External DS) ─┤                        │
Task-5 (Export PNG/PDF) ──▶ (M1 完成)         │
Task-6 (Highlight) ────┤                        │
Task-7 (Advanced Charts)┘                        │
                                                  │
 (M2) ─┬─▶ Task-8 (DAG Scheduler)
        ├─▶ Task-9 (SQL Snippets)
        ├─▶ Task-10 (Conditional Format)
        ├─▶ Task-11 (Dashboard Templates) ──── Task-7 产出基础
        └─▶ Task-12 (QueryBuilder) ─────────── Task-1/2 元信息
                                                  │
 (M3) ─┬─▶ Task-13 (Snapshots)
        ├─▶ Task-14 (NL2SQL, optional)
        └─▶ Task-15 (Polish)
```

## 已取消 / 延后项
- ❌ 原 Task-8 Dataset / 语义层：按 Q2 决策不再推进。
- ❌ Python/R 脚本扩展：按 Q3 决策暂不需要；如有需要未来单独提 spec。
- ⏸ HTML 仪表盘导出：按 Q5 决策延后到 M3（或不做）。

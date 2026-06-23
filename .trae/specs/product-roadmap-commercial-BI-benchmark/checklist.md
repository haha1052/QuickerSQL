# QuickerSQL 产品路线图验证清单（按用户决策更新版）

## Part 1 · 文档规划完整性
- [ ] 1.1 `spec.md` 含完整 Goals / Non-Goals / Functional Requirements / Acceptance Criteria / Open Questions（已回答）五大段落。
- [ ] 1.2 `spec.md` 附录 C 差距分析表含 P0/P1/P2 + 里程碑分配，且已明确"已取消项"（G-08 Dataset、Python/R）。
- [ ] 1.3 `spec.md` 附录 D 路线图 M1/M2/M3 每项给出可落地文件路径与门禁语句。
- [ ] 1.4 `tasks.md` 每条任务含优先级/依赖/描述/文件路径/Test Requirements。
- [ ] 1.5 `tasks.md` 依赖关系图无循环依赖（DAG 合法性）。
- [ ] 1.6 三份文件可在本地 Markdown 编辑器正常渲染表格。

## Part 2 · 项目当前状态复核（PowerShell 命令）
- [ ] 2.1 目录结构完整：`src-tauri/src/` 至少含 commands/services/models/database/utils；`src/` 至少含 components/store/services/types/utils。
- [ ] 2.2 security.md 核心门禁基线：
  - `cd src-tauri; Get-ChildItem -Path src -Include *.rs -Recurse | Select-String -Pattern 'format!.*SELECT|format!.*INSERT|format!.*UPDATE|format!.*DELETE' | Measure-Object` → **Count = 0**。
- [ ] 2.3 前端 SQL 拼接门禁基线：
  - `Get-ChildItem -Path src -Include *.ts,*.tsx -Recurse | Select-String -Pattern 'SELECT|INSERT|UPDATE|DELETE' -CaseSensitive:$false | Measure-Object` → Count = 0。
- [ ] 2.4 前端无 any 类型（coding.md）：
  - `Get-ChildItem -Path src -Include *.ts,*.tsx -Recurse | Select-String -Pattern ': any|as any' | Measure-Object` → Count = 0。
- [ ] 2.5 Rust 无 unwrap/expect：
  - `Get-ChildItem -Path src-tauri/src -Include *.rs -Recurse | Select-String -Pattern '\.unwrap\(\)|\.expect\(' | Measure-Object` → Count = 0。
- [ ] 2.6 构建通过：`cd src-tauri; cargo check --quiet` 无 error。
- [ ] 2.7 TS 检查通过：`npx tsc --noEmit --pretty` 0 errors。

## Part 3 · 里程碑验收门禁
### M1 · 个人数据中台（7 项 P0）
- [ ] 3.1 可"连接 PostgreSQL 表 → 打开数据探查面板 → 新建计算字段 → 保存仪表盘 → 一键导出 PNG"全链路完成。
- [ ] 3.2 `cargo check --quiet` 通过；`npx tsc --noEmit --pretty` 通过。
- [ ] 3.3 security.md 核心门禁仍然满足（format! 拼接 SQL Count = 0；敏感字符串 Count = 0）。
- [ ] 3.4 高级图表类型：至少 heatmap / funnel / kpi_card / dual_axis 4 种可切换并渲染。
- [ ] 3.5 仪表盘刷选联动：点击一个柱子，其他图表查询结果行数变化。
- [ ] 3.6 Parquet 文件导入：10 万行可成功导入，列信息正确。

### M2 · DAG 工作流引擎与增强分析（5 项 P1）
- [ ] 3.7 可"新建 3 节点 DAG（A 导出 CSV → B 跑汇总 SQL → C 更新仪表盘）→ 配置失败告警 → 手动运行并观察日志与 UI toast 告警"。
- [ ] 3.8 SQL 片段库 CRUD + 搜索功能通过。
- [ ] 3.9 表格条件格式：大于/小于/介于/进度条 4 种规则正确渲染高亮颜色。
- [ ] 3.10 仪表盘模板：应用 1 个模板能生成完整仪表盘（≥ 3 张图表）。
- [ ] 3.11 Query Builder：拖拽生成的 SQL 可在后端成功执行。
- [ ] 3.12 构建门禁：`cargo check --quiet` + `npx tsc --noEmit --pretty` 通过。

### M3 · 差异化特性（P2 + 体验打磨）
- [ ] 3.13 数据版本管理：保存 & 读取 snapshot round-trip 通过，diff 视图可读。
- [ ] 3.14 自然语言面板（若启用）：断网环境下可把中文问题翻译成可执行 SQL。
- [ ] 3.15 所有 P0/P1 功能点有明确 UI 入口与使用说明文字。

## Part 4 · 产品定位守护（每次提交前自检）
- [ ] 4.1 规划中未引入 SaaS/云端数据同步（保留本地定位）。
- [ ] 4.2 规划中未引入任何外部 API Key 硬编码依赖。
- [ ] 4.3 规划中明确"本地个人工作台"定位，不与企业 BI 竞争全量能力。

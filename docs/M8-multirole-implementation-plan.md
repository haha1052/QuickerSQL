# QuickerSQL M8 里程碑多角色详细实施方案

> **版本：** v1.0
> **日期：** 2026-06-22
> **维护者：** QuickerSQL 架构组
> **前置条件：** M1-M7 已完成（v14.1 基线）；四重门禁（cargo check / cargo test / tsc / vitest）全绿
> **参考文档：** [架构现状.md](file:///e:/LA_DUCK/la-duck/docs/架构现状.md) §8 "下一个里程碑（M8 方向建议）"

---

## 一、M8 里程碑重新定义

### 1.1 M8 是什么

根据 v14.1 实际落地状态，原 M8 五条方向建议中的两条（**查询缓存命中率监控** / **虚拟滚动实际接入**）已在 T-002 / T-003 中初步完成。因此 M8 重新定义为：

| 子阶段 | 名称 | 与 v14.1 的关系 | 验收标准 |
|--------|------|-----------------|---------|
| **M8.1** | 国际化（i18n） | 新能力 | 前端 0 处硬编码中文文案；zh-CN / en-US 双语完整覆盖 |
| **M8.2** | 文档完善 | 新能力 | 使用手册 / API 文档 / 数据库字段说明 三份文档齐备 |
| **M8.3** | E2E 自动化测试 | 深化（T-005 已搭框架，M8 接入 tauri-driver + 4 场景） | 4 个核心用户旅程自动化通过 |
| **M8.4** | 查询缓存监控深化 | 巩固（T-002 已暴露基础面板） | stats 面板支持实时刷新 + 命中率趋势 + 手动清除缓存 |
| **M8.5** | 虚拟滚动深化 | 巩固（T-003 已接入两大面板） | 至少 3 个长列表面板接入；长列表交互 FCP / TTI 可量化 |

### 1.2 M8 总时间规划

| 阶段 | 周次 | 工作量（人周） | 主要产出 |
|------|------|---------------|---------|
| **第 1 周（M8.1 + M8.2 并行）** | 第17周 | @前端 1人周 + @文档 0.5人周 | i18n 框架 + 全量 keys 抽取；文档初稿 |
| **第 2 周（M8.3 + M8.4 并行）** | 第18周 | @后端 1人周 + @前端 0.5人周 + @QA 1人周 | tauri-driver 接入；4 个 E2E 用例；缓存监控深化 |
| **第 3 周（M8.5 + 回归）** | 第19周 | @前端 0.5人周 + @架构 0.5人周 | 审计日志 / 回收站 / 仪表盘列表 接入虚拟滚动；全量门禁回归 |
| **合计** | **3 周** | **约 5 人周** | i18n 双语 + 三份文档 + 4 个 E2E + 缓存实时监控 + 3 个虚拟滚动面板 |

---

## 二、角色分工总览

> M8 涉及五个角色，其中 @后端 / @前端 / @QA 可在不同子阶段**并行推进**，@架构 / @文档 以协调与交付物为主。

| 角色 | M8.1 参与度 | M8.2 参与度 | M8.3 参与度 | M8.4 参与度 | M8.5 参与度 | 主要交付物 |
|------|------------|------------|------------|------------|------------|-----------|
| **@架构** | 🔵 20% | 🔵 20% | 🔵 30% | 🔵 30% | 🔴 80% | i18n 设计评审；全量门禁回归；里程碑验收 |
| **@后端** | 🟡 10%（接口命名） | 🟡 10%（API 文档素材） | 🔴 90%（tauri-driver + Rust 侧命令） | 🔴 70%（缓存 stats 新接口） | 🟡 20%（新分页接口） | 新 Rust 命令与测试；文档素材 |
| **@前端** | 🔴 100%（i18n 框架 + keys 抽取） | 🟡 20%（文档截图） | 🔴 70%（Playwright 用例） | 🔴 80%（缓存监控面板升级） | 🔴 90%（虚拟滚动深化） | i18n 文件；组件升级；E2E 用例 |
| **@QA** | — | 🔵 20%（文档校对） | 🔴 100%（E2E 编写与验证） | 🔵 20%（缓存监控验收） | 🔵 30%（回归测试） | E2E 测试报告；回归测试清单 |
| **@文档** | 🟡 30%（i18n key 约定） | 🔴 90%（三份文档） | — | 🟡 20%（缓存监控文档） | 🟡 20%（虚拟滚动文档） | 使用手册 / API 文档 / 数据库字段说明 |

### 2.1 并行推进标记表

| 子阶段 | 可并行任务 | 串行依赖（必须先完成） |
|--------|-----------|------------------------|
| **M8.1（国际化）** | 与 M8.2 **并行**（i18n 不阻塞文档写作） | 无 |
| **M8.2（文档完善）** | 与 M8.1 **并行**；也可与 M8.3 并行 | 无 |
| **M8.3（E2E）** | 可与 M8.4 / M8.5 **部分并行**（只要核心组件不受改） | M8.1 完成后，UI 文案 key 稳定，E2E 选择器不易失效 |
| **M8.4（缓存监控深化）** | 可与 M8.5 **并行** | 前端构建框架需先通过 M8.1 门禁 |
| **M8.5（虚拟滚动深化）** | 可与 M8.4 **并行** | 同 M8.4 |

### 2.2 推荐甘特图（文字版）

```
第17周  ┃  M8.1 国际化[前端]  M8.2 文档完善[文档]  ┃  并行执行
第18周  ┃  M8.3 E2E[QA+后端]  M8.4 缓存监控[前端+后端]  ┃  并行执行
第19周  ┃  M8.5 虚拟滚动深化[前端]  +  全量门禁回归[架构+QA]  ┃  收尾
```

---

## 三、M8.1：国际化（i18n）—— @前端为主，@架构评审

### 3.1 现状分析

- 硬编码中文：`src/components/**`、`src/pages/**`、`src/store/**` 内广泛存在中文按钮、提示、Toast 文案
- 已存在 [LocaleContext.tsx](file:///e:/LA_DUCK/la-duck/src/context/LocaleContext.tsx)，但**未实际使用**（仅有 Context 壳，无 i18n 字典 / 切换 UI）
- 本项目为桌面应用，语言切换无需后端，仅前端 localStorage + settings table 持久化

### 3.2 技术选型

| 选项 | 推荐方案 | 理由 |
|------|---------|------|
| i18n 库 | **react-i18next** | 业界标准；支持命名空间、插值、懒加载；TypeScript 类型友好 |
| 语言文件位置 | `src/i18n/locales/{zh-CN,en-US}/{common,workspace,dashboard,task,settings,query,trash,audit,import}.json` | 按领域切分命名空间，避免单文件膨胀 |
| 持久化 | `localStorage`（主）+ `__settings` 表（category=`i18n`, key=`locale`） | 与现有 settings 体系对齐 |
| 默认语言 | `zh-CN` | 保持与当前中文 UI 一致，过渡期零破坏 |

### 3.3 详细任务拆分（@前端）

#### T8.1.1 初始化 i18n 框架（≈ 4h）

- 依赖：`npm install i18next react-i18next i18next-browser-languagedetector`
- 新建：`src/i18n/index.ts`（init i18next）、`src/i18n/locales/zh-CN/common.json`、`en-US/common.json`
- 接入：在 [AppWrapper.tsx](file:///e:/LA_DUCK/la-duck/src/AppWrapper.tsx) 顶部 `import './i18n'`；LocaleContext 改为读取 `i18next.language`
- Settings 面板新增语言切换下拉（zh-CN / en-US）

#### T8.1.2 全量 keys 抽取（≈ 1.5 人日）

**按领域扫描并替换以下文件内的中文文案：**

| 领域 | 目录 / 文件 | 估计 keys 数 | 命名空间 |
|------|------------|-------------|----------|
| 公共 / 导航 / 按钮 | `src/components/common/`、`src/components/workspace/` | ~30 | `common`、`workspace` |
| SQL 查询编辑器 | `src/components/sql/`、`src/pages/SqlQueryPage.tsx` | ~25 | `query` |
| 查询历史 | `src/components/query-history/index.tsx` | ~10 | `query` |
| 仪表盘 | `src/components/dashboard/**`、`src/pages/DashboardPage.tsx` | ~40 | `dashboard` |
| 自动化任务 | `src/components/automation/**` | ~30 | `task` |
| 设置 | `src/pages/Settings.tsx`、`src/components/settings/**` | ~20 | `settings` |
| 回收站 | `src/components/trash/index.tsx` | ~10 | `trash` |
| 审计日志 / 活动 | `src/pages/ActivityLog.tsx`、`src/components/common/QueryHistory.tsx` | ~15 | `audit`、`query` |
| 数据导入 / 项目管理 | `src/components/import/**`、`src/components/project/**` | ~20 | `import`、`common` |
| Toast / Message | `src/store/toastStore.ts`、`src/components/common/Toast.tsx` | ~10 | `common` |
| 引导页 / 欢迎页 | `src/pages/Welcome.tsx`、`src/pages/Guide.tsx` | ~25 | `welcome`、`guide` |
| **合计** | | **~230 keys** | 10 个命名空间 |

> **抽取规则（coding.md 对齐）：**
> - key 命名：`<namespace>.<camelCase>`（如 `dashboard.addChart`、`task.runNow`）
> - 插值变量统一使用 `{{ var }}` 语法（如 `query.executedAt: "执行于 {{ time }}"`）
> - 禁止把中文硬编码替换为 `t("xxx")` 后**遗漏**：PowerShell 门禁见 §7
> - 组件 props 传入的中文（如 title="xxx"）必须走 i18n

#### T8.1.3 en-US 翻译交付（≈ 1 人日）

- 所有 ~230 keys 的英文翻译（可由 AI 初翻 + 人工校对）
- 日期 / 数字格式：`src/i18n/formatters.ts`（date、number、duration 三个格式化函数）
- 保留英语环境下 DuckDB 错误信息（原英文字面），不做反向翻译

#### T8.1.4 TypeScript 类型安全（≈ 2h）

- 新建 `src/i18n/index.d.ts`：通过 `react-i18next` 的 `TypeOptions` 为 `t()` 推断 key 字面量类型
- 目标：**TS 编译期就能捕获未定义的 key**

#### T8.1.5 设置持久化（≈ 2h）

- settings 面板新增 "语言" 选择器（zh-CN / en-US）
- 写入 `__settings` 表：category=`i18n`，key=`locale`，value=`zh-CN` 或 `en-US`
- 下次启动从 settings 读取作为 default

### 3.4 验收标准（@架构 + @QA）

- `src/` 目录内中文硬编码 ≤ 0 处（PowerShell 扫描，§7 有命令）
- `tsc --noEmit` 全绿；`npm test` 全绿
- 手动切换到 en-US：所有 UI 文案为英文，无乱码 / 截断
- 重启应用后语言设置保留

---

## 四、M8.2：文档完善—— @文档为主，@后端 / @前端提供素材

### 4.1 文档清单

| 编号 | 文档名 | 目标读者 | 预计篇幅 | 主要素材来源 |
|------|--------|---------|---------|-------------|
| **D1** | [docs/使用手册.md](file:///e:/LA_DUCK/la-duck/docs/使用手册.md) | 终端用户 | 约 40 页 | 前端组件截图 + 功能演示 |
| **D2** | [docs/API设计方案.md](file:///e:/LA_DUCK/la-duck/docs/API设计方案.md)（扩充完整版） | 开发者 / 二次开发 | 约 30 页 | `src-tauri/src/commands/*` 所有命令签名 |
| **D3** | [docs/数据库字段说明.md](file:///e:/LA_DUCK/la-duck/docs/数据库字段说明.md) | 开发者 | 约 25 页 | `src-tauri/src/models/*.rs` struct 定义 + 13 张系统表 |

### 4.2 D1 使用手册结构（@文档，@前端提供截图）

| 章节 | 内容 | 依赖素材 |
|------|------|---------|
| 1. 快速开始 | 安装 / 创建项目 / 导入数据 / 第一个查询 | 截图 5 张 |
| 2. SQL 编辑器 | 语法 / 参数化查询 / 快捷键 / 查询历史 | 截图 3 张 |
| 3. 仪表盘 | 创建 / 配置图表 / 组件布局 / 刷新策略 | 截图 4 张 |
| 4. 自动化任务 | 四种任务类型 / schedule 配置 / 日志查看 | 截图 4 张 |
| 5. 设置与缓存 | 语言 / 主题 / 查询缓存 TTL 调整 | 截图 2 张 |
| 6. 回收站 | 恢复 / 永久删除 / 不可恢复场景说明 | 截图 2 张 |
| 7. 常见问题 | 报错解读 / 性能建议 / 数据导入注意事项 | 纯文本 |

### 4.3 D2 API 文档结构（@文档，@后端提供命令清单）

> 本项目的"API" = Tauri IPC 命令集合（前端 `invokeCommand<T>` 调用的 `#[tauri::command]` 函数）。

| 章节 | 内容 | 素材来源 |
|------|------|---------|
| 1. 调用约定 | `ApiResponse<T>` 结构；Error 字段含义 | `src/services/tauri.ts` |
| 2. 数据库命令（5 条） | list_tables / get_table_meta / drop_table / rename_table / execute_sql（batch） | `commands/database.rs`、`commands/sql.rs` |
| 3. 查询历史命令（3 条） | list / favorite / delete | `commands/query_history.rs` |
| 4. 仪表盘命令（8 条） | save_chart / list_charts / save_dashboard / list_dashboards / get_dashboard / delete / refresh / export | `commands/dashboard.rs`（如存在，详见实际 commands 目录） |
| 5. 自动化任务命令（10 条） | list / get / create / update / delete / execute / enable / disable / list_runs / clear_runs | `commands/automation.rs` |
| 6. 设置命令（4 条） | get_all / set / get_startup_status / query_cache_stats / configure_cache | `commands/settings.rs` + `commands/startup.rs` |
| 7. 审计日志命令（2 条） | list_audit_logs / clear_audit_logs | `commands/audit_log.rs`（若存在） |
| 8. 文件 / 导入命令（3 条） | import_csv / preview_file / load_file | `commands/file.rs` |
| 9. 回收站命令（3 条） | list / restore / purge | `commands/trash.rs` |

> **格式要求**：每条命令列出：命令名、参数（类型 + 说明）、返回（类型 + 字段说明）、错误情况

### 4.4 D3 数据库字段说明结构（@文档，@后端审核）

| 表名 | 字段名 | 类型 | 含义 | 约束 | 备注 |
|------|--------|------|------|------|------|
| `__automation_tasks` | id | TEXT PRIMARY KEY | 任务唯一 ID | NOT NULL | ULID / UUID 由前端生成 |
| … | … | … | … | … | … |

> 覆盖全部 **13 张系统表**（列表见 [架构现状.md §3](file:///e:/LA_DUCK/la-duck/docs/架构现状.md#L196-L215)），以及常见用户表字段（ROWID 隐式字段说明）。

### 4.5 验收标准

- D1 / D2 / D3 三份文档均存在且可阅读
- D2 API 文档覆盖**全部**当前 `#[tauri::command]` 函数（@后端用 `grep -rn '#\[tauri::command\]' src-tauri/src/commands/` 清点对比）
- D3 字段说明与 `models/` 中 struct 字段完全一致（字段增减 → 文档同步改）

---

## 五、M8.3：E2E 自动化测试—— @QA + @后端 + @前端

### 5.1 现状分析

- v14.1 T-005 已搭建 Playwright 框架：`e2e/playwright.config.ts`、`e2e/specs/*.spec.ts`、`e2e/README.md`
- `npm run e2e` 脚本已在 `package.json`
- **缺失**：真实桌面窗口驱动（tauri-driver），当前仅能跑 Web / headless 冒烟

### 5.2 技术路径（@后端 + @前端）

| 步骤 | 任务 | 负责人 | 工时 |
|------|------|--------|------|
| 1. 接入 tauri-driver | `cargo install tauri-driver`；配置 `tauri.conf.json` → `features=["custom-protocol"]` 或启用 tauri-driver 相关 feature；`playwright.config.ts` 使用 `tauri-driver` connect 方式连接到桌面窗口 | @后端 | 6h |
| 2. 核心旅程用例 1：创建项目 → 导入数据 → 查询 | 编写 spec；利用 DuckDB 内置 CSV 导入或走 IPC；断言结果行数 / 列名 | @QA + @前端 | 4h |
| 3. 核心旅程用例 2：回收站 → 恢复 → 永久删除 | 编写 spec；断言"永久删除后查询该表失败" | @QA | 3h |
| 4. 核心旅程用例 3：仪表盘 → 添加组件 → 编辑 → 删除 | 编写 spec；利用 `canvas` / `echarts` DOM 元素断言图表渲染成功 | @QA + @前端 | 6h |
| 5. 核心旅程用例 4：自动化任务 → 创建 → 执行 → 查看日志 | 编写 spec；创建一次性任务（schedule=once + 1 秒后），断言状态变更 + 日志出现 | @QA + @后端 | 5h |
| 6. CI 脚本与 README | `package.json` 追加 `e2e:headed` / `e2e:ci`；`e2e/README.md` 说明如何本地跑 + CI 注意事项 | @后端 | 2h |

### 5.3 验收标准

- `npm run e2e`（headless / headed）至少 4 spec passed，0 failed
- 4 个核心旅程用例**完全可复现**（同机器重复 3 次无 flaky）
- 每次在 CI（或人工）执行后，生成 `e2e/reports/` 截图报告

---

## 六、M8.4：查询缓存命中率监控深化—— @前端 + @后端

### 6.1 现状分析

- T-002 已提供 [QueryCacheStatsPanel.tsx](file:///e:/LA_DUCK/la-duck/src/components/settings/QueryCacheStatsPanel.tsx)
- `query_cache_service::stats()` 接口已返回 `CacheStats { capacity, size, hits, misses, hitRate, enabled }`
- **当前缺失**：实时刷新（手动点击刷新）、命中率可视化图表、清除缓存按钮、缓存容量 / TTL 运行时调整输入框

### 6.2 任务清单

| 编号 | 任务 | 负责人 | 工时 |
|------|------|--------|------|
| T8.4.1 | stats 面板增加"实时刷新"开关（轮询 interval=5s，可暂停） | @前端 | 2h |
| T8.4.2 | stats 面板新增 ECharts 折线图展示最近 30 次 hits / misses / hitRate 趋势（内存环形 buffer，不持久化） | @前端 | 4h |
| T8.4.3 | 新增命令 `cache:clear_cache` → `query_cache_service::invalidate_all()`；面板内"清除缓存"按钮 | @后端 | 2h |
| T8.4.4 | 面板内新增容量 / TTL 输入框 + "应用"按钮，调用 `configure(capacity, ttl, enabled)` | @前端 + @后端 | 3h |
| T8.4.5 | 内联测试追加：config 变更 → stats 容量随之变化；invalidate_all 后 size=0 | @后端 | 2h |

### 6.3 验收标准

- 打开设置 → 查询缓存面板，可观察到 hitRate 实时更新（执行若干 SQL 后 hitRate 变化）
- 点击"清除缓存"后 size=0，再次执行同一条 SQL 后 miss 计数+1，hit 计数+1（第二次执行命中）
- 调整 capacity=5 后，缓存第 6 条时最早条目被驱逐（可通过 stats 观察）
- 全部门禁仍绿

---

## 七、M8.5：虚拟滚动深化—— @前端为主，@后端按需提供分页接口

### 7.1 现状分析

- T-003 已在 [QueryHistory](file:///e:/LA_DUCK/la-duck/src/components/query-history/index.tsx)（ITEM_HEIGHT=96px）与 [TaskRunLogsPanel](file:///e:/LA_DUCK/la-duck/src/components/automation/TaskRunLogsPanel.tsx)（ITEM_HEIGHT=44px）接入
- [virtual.ts](file:///e:/LA_DUCK/la-duck/src/utils/virtual.ts) 提供 `computeVisibleRange`
- **仍未接入**：审计日志面板 / 回收站面板 / 仪表盘图表库列表（ChartLibraryPanel）

### 7.2 任务清单

| 编号 | 面板 | ITEM_HEIGHT | 数据量 | 负责人 | 工时 |
|------|------|-------------|--------|--------|------|
| T8.5.1 | 审计日志（[ActivityLog.tsx](file:///e:/LA_DUCK/la-duck/src/pages/ActivityLog.tsx) 或 common/QueryHistory.tsx 共用） | 44px | 可能数千条 | @前端 | 3h |
| T8.5.2 | 回收站面板（[trash/index.tsx](file:///e:/LA_DUCK/la-duck/src/components/trash/index.tsx)） | 72px | 通常 <1000 | @前端 | 3h |
| T8.5.3 | 仪表盘图表库列表（[ChartLibraryPanel.tsx](file:///e:/LA_DUCK/la-duck/src/components/dashboard/ChartLibraryPanel.tsx)） | 96px | 可能数百条 | @前端 | 3h |
| T8.5.4 | 新增后端分页接口（`list_audit_logs(page, size)` / `list_trash(page, size)`），减少一次性加载全量 | @后端 | 6h |

### 7.3 验收标准

- 3 个面板在 **1000 条数据**下滚动 FPS ≥ 55（本地肉眼观察 + DevTools Performance 记录）
- 新分页接口 `cargo check` 全绿；前端调用不破坏非分页调用路径
- 不引入新的硬编码中文（已在 M8.1 时提前抽到 i18n keys）

---

## 八、依赖关系图（DAG）

```
[M8.1: i18n 框架] ─┐
                    ├──▶ [M8.4: 缓存监控深化] ─┐
                    │                           │
[M8.1: keys 抽取] ─┤                           ├──▶ [M8 门禁回归 + 验收]
                    │                           │
[M8.2: 三份文档] ──┤                           │
                    │                           │
[M8.3: E2E tauri-driver] ──────────────────────┘
                    │
[M8.5: 虚拟滚动深化] ─┘

注：M8.2 与其他所有子阶段均可完全并行，无输入依赖
```

---

## 九、风险登记

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| i18n 抽取时遗漏 Toast 文案（store 层硬编码） | 中 | 高 | 专门扫描 `src/store/*.ts` + `grep -rn` 中文做门禁 |
| tauri-driver 在 Windows 下版本不匹配 | 中 | 高 | 固定 `tauri-driver` 与 Tauri core 版本号；README 写明验证命令 |
| E2E 用例 flaky（自动化任务时序问题） | 高 | 中 | 一次性任务使用"当前时间 + 2s"，断言使用 `waitFor({ timeout: 10_000 })`；CI 超时保护 |
| en-US 翻译质量差，二次返工 | 中 | 低 | 走"AI 初翻 → @文档校对 → @前端手动走一遍 en-US 全流程"模式 |
| 虚拟滚动接入后滚动条抖动（item 高度不固定） | 中 | 中 | ITEM_HEIGHT 在接入时人工抽样 10 条取最大值；不做动态高度（项目 v14.1 目前统一固定高度设计） |

---

## 十、交付物清单（里程碑验收必备）

| 交付物 | 所属子阶段 | 位置 |
|--------|-----------|------|
| i18n 框架 + 10 个命名空间 JSON 文件 | M8.1 | `src/i18n/locales/**` |
| 语言切换 UI + 设置持久化 | M8.1 | `src/pages/Settings.tsx` / `src/components/settings/` |
| 使用手册 | M8.2 | `docs/使用手册.md` |
| API 文档（完整版） | M8.2 | `docs/API设计方案.md`（或 `docs/API文档.md`） |
| 数据库字段说明 | M8.2 | `docs/数据库字段说明.md` |
| tauri-driver 接入 + 4 个 E2E spec | M8.3 | `e2e/specs/*.spec.ts`、`e2e/README.md` |
| QueryCacheStatsPanel 升级（实时刷新 / 图表 / 清缓存 / 配置） | M8.4 | `src/components/settings/QueryCacheStatsPanel.tsx` |
| 3 个新面板接入虚拟滚动 | M8.5 | `src/components/**` |
| 更新架构现状文档 M8 章节 | 全阶段 | `docs/架构现状.md` |

---

## 十一、门禁与质量保障（每次提交后必须通过）

> 所有命令均在 `e:\LA_DUCK\la-duck` 根目录执行（PowerShell）。

### 11.1 已有门禁（来自 [architecture.md](file:///e:/LA_DUCK/la-duck/.trae/rules/architecture.md) §6 + [security.md](file:///e:/LA_DUCK/la-duck/.trae/rules/security.md)）

```powershell
# 1. Rust 编译
cd src-tauri; cargo check --quiet
# 期望：0 errors

# 2. Rust 单元测试
cargo test --quiet
# 期望：156+ passed, 0 failed

# 3. TS 类型检查
cd ..; npx tsc --noEmit --pretty
# 期望：0 errors

# 4. 前端单元测试
npx vitest run
# 期望：3+ files / 43+ tests / 100% passed

# 5. SQL 注入检测
cd src-tauri; Get-ChildItem -Path src -Include *.rs -Recurse | Select-String -Pattern 'format!.*"SELECT|format!.*"INSERT|format!.*"UPDATE|format!.*"DELETE' -CaseSensitive:$false | Measure-Object | Select-Object Count
# 期望：Count = 0

# 6. 敏感字符串检测
cd ..; Get-ChildItem -Path src-tauri/src,src -Include *.rs,*.ts,*.tsx -Recurse | Select-String -Pattern 'sk-|password:|PRIVATE KEY|Bearer ' | Measure-Object | Select-Object Count
# 期望：Count = 0
```

### 11.2 M8 新增门禁

```powershell
# 7. 中文硬编码检测（M8.1 完成后必须 = 0）
#    排除 i18n 字典文件本身（它们天然含中文），也排除 .md / .css
Get-ChildItem -Path src -Include *.ts,*.tsx -Recurse |
  Select-String -Pattern '[\u4e00-\u9fa5]' |
  Where-Object { $_.Line -notmatch '^\s*//' -and $_.Line -notmatch 'console\.' -and $_.Line -notmatch 't\(' } |
  Select-Object -First 50
# 期望：0 matches（排除注释、排除 t() 翻译调用、排除 console 输出）

# 8. i18n key 与翻译文件一致性检测
#    验证 zh-CN / en-US 命名空间文件的 key 集合一致（用脚本对比 JSON）
#    简易实现（Node 小脚本即可）：
node -e "
const a = JSON.parse(require('fs').readFileSync('src/i18n/locales/zh-CN/common.json','utf8'));
const b = JSON.parse(require('fs').readFileSync('src/i18n/locales/en-US/common.json','utf8'));
const missingInB = Object.keys(a).filter(k => !(k in b));
const missingInA = Object.keys(b).filter(k => !(k in a));
console.log('Missing in en-US:', missingInB);
console.log('Missing in zh-CN:', missingInA);
process.exit((missingInA.length + missingInB.length) ? 1 : 0);
"

# 9. E2E 门禁（M8.3 完成后启用）
npm run e2e
# 期望：4+ passed，0 failed
```

### 11.3 手动验证清单（@QA）

| 项 | 场景 | 预期 |
|----|------|------|
| V1 | 切换到 en-US → 刷新应用 | 所有界面文案为英文；日期格式为 MM/DD/YYYY；重启后保留 |
| V2 | 切换到 zh-CN → 刷新应用 | 所有界面文案为中文；日期格式为 YYYY-MM-DD |
| V3 | 设置 → 查询缓存 → 打开实时刷新 → 连续跑 10 条相同 SQL | 折线图 hitRate 从 0 升到接近 0.9；清除缓存按钮点击后 size=0 |
| V4 | 审计日志面板 / 回收站面板 / 图表库列表在 1000 条数据下滚动 | 肉眼流畅，无明显掉帧 |
| V5 | E2E 4 个用例连续跑 3 次 | 3/3 全部 pass，无 flaky |

---

## 十二、里程碑验收会议（@架构主持）

**议程（约 1.5h）：**

1. 门禁演示：`cargo check` / `cargo test` / `tsc` / `vitest` / `e2e` / SQL 注入 / 中文硬编码 / key 一致性 —— 全量现场跑一遍
2. 功能演示（@前端 + @QA）：
   - zh-CN / en-US 切换 + 重启持久化
   - 查询缓存监控面板（实时刷新 / 折线图 / 清缓存 / 配置）
   - 3 个长列表面板接入虚拟滚动后滚动体验
3. 文档交付（@文档）：展示三份文档目录结构 + 抽查 3 个深度内容点
4. E2E 演示（@QA）：4 个核心旅程 headed 模式现场跑一遍
5. 遗留问题与下一里程碑（M9）选题讨论

**通过条件：** 11.1 + 11.2 全部门禁 = 0 failure；11.3 V1~V5 全部通过；三份文档齐全。

---

## 附录 A：M8 文件变更总表

| 路径 | 变更类型 | 所属子阶段 |
|------|---------|-----------|
| `src/i18n/index.ts` | 新建 | M8.1 |
| `src/i18n/index.d.ts` | 新建 | M8.1 |
| `src/i18n/formatters.ts` | 新建 | M8.1 |
| `src/i18n/locales/zh-CN/*.json`（约 10 个文件） | 新建 | M8.1 |
| `src/i18n/locales/en-US/*.json`（约 10 个文件） | 新建 | M8.1 |
| `src/context/LocaleContext.tsx` | 修改 | M8.1 |
| `src/pages/Settings.tsx` | 修改 | M8.1 / M8.4 |
| `src/components/settings/QueryCacheStatsPanel.tsx` | 修改 | M8.4 |
| `src/components/settings/index.ts` | 修改 | M8.4 |
| `src/pages/ActivityLog.tsx` | 修改（接入虚拟滚动） | M8.5 |
| `src/components/trash/index.tsx` | 修改（接入虚拟滚动） | M8.5 |
| `src/components/dashboard/ChartLibraryPanel.tsx` | 修改（接入虚拟滚动） | M8.5 |
| `src/components/common/QueryHistory.tsx` | 修改（i18n 化） | M8.1 |
| `src/components/**/*.tsx`（约 25+ 个组件中文本） | 修改（i18n 化） | M8.1 |
| `src/store/*.ts`（toastStore 等中文文案） | 修改（i18n 化） | M8.1 |
| `src-tauri/src/commands/settings.rs`（新增 locale 读写 + cache clear） | 修改 | M8.1 / M8.4 |
| `src-tauri/src/services/query_cache_service.rs`（新增 clear 命令入口 + 测试） | 修改 | M8.4 |
| `src-tauri/src/services/audit_log_service.rs`（分页接口） | 修改 | M8.5 |
| `src-tauri/src/services/trash_service.rs`（分页接口） | 修改 | M8.5 |
| `src/services/tauri.ts`（新增 `invokeCommand` 封装） | 修改 | M8.1 / M8.4 / M8.5 |
| `e2e/playwright.config.ts`（tauri-driver 接入配置） | 修改 | M8.3 |
| `e2e/specs/*.spec.ts`（4 个核心旅程） | 新建 / 修改 | M8.3 |
| `e2e/README.md` | 修改 | M8.3 |
| `docs/使用手册.md` | 新建 | M8.2 |
| `docs/API文档.md` 或扩写 `docs/API设计方案.md` | 新建 / 修改 | M8.2 |
| `docs/数据库字段说明.md` | 新建 | M8.2 |
| `docs/架构现状.md`（更新 M8 章节 + 版本号） | 修改 | 全阶段 |
| `package.json`（新增依赖 + 脚本） | 修改 | M8.1 / M8.3 |
| `src-tauri/Cargo.toml`（按需，tauri-driver feature） | 修改 | M8.3 |

---

**文档维护说明**：本文件为 M8 里程碑的计划与验收依据。实施中若子阶段边界 / 工时估算发生变化，由 @架构 更新本文件并在变更处标注"v1.1"等版本号。

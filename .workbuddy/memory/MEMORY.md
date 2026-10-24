# LA-DUCK 项目长期记忆

## ⚠️ 质量门禁约定（2026-10-20 确立，最高优先级）

- **i18n 检测必须用 `node scripts/check-hardcoded-i18n.mjs`（严格版）**，**禁止**用 `scripts/scan-hardcoded.mjs` 作为门禁依据 —— 后者只匹配引号/模板字符串，**漏检 JSX 裸文本**，曾导致「i18n 已清零」的错误结论潜伏 1 个多月（实测实际 167 处 / 20 文件）。
- **门禁第一步必须是 `rustc --version`**。2026-10-20 发现 `~/.rustup/toolchains/stable-x86_64-pc-windows-msvc/` 缺 `rustc` 二进制，导致 `cargo check` / `cargo test` / `npm run tauri dev` 全部无法执行，而文档中的 ✅ 结论已过期一个多月而无人察觉。**Rust 工具链可用性必须作为门禁前置检查**。
- 计划中的统一门禁 `check:all` 顺序：`rustc --version` → `cargo check` → `cargo test` → `tsc --noEmit` → `vitest run` → `check-hardcoded-i18n.mjs`（严格版）→ `check-doc-sync.ps1`，任一失败返回非 0。
- **技术债修复若不配套可持续门禁会在数周内回潮** —— 已实证：v26.2 拆到 ≤400 行的 3 个大组件，1 个月后被新代码重新撑大（`DashboardItem.tsx` 已 1085 行）。新增代码需有大文件行数约束意识。

## 文档版本与位置

- 架构现状：`docs/架构现状.md`（当前 v26.4，2026-10-20）
- 技术债清单：`docs/技术债清单_v4.md`（当前 v1.4，2026-10-20）
- 历史技术债归档：`docs/历史技术债.md`
- 当前技术债：13 项（P1×3 + P2×6 + P3×4），综合质量评分 7.5/10

## 图表渲染架构约定


- **ECharts 配置归一化**：所有 ECharts 渲染入口（仪表盘 `DashboardItem`、图表库预览 `ChartPreview`）在调用 `echarts.setOption()` 前，必须先经过 `src/utils/echartsNormalize.ts` 的 `normalizeEChartsConfig()` 归一化。该函数递归将 snake_case 键名转 camelCase（兼容 Bug 1 修复前的旧数据），并补充默认 grid/color。幂等，对新旧数据都安全。
- **SavedChart.config 是渲染黄金数据**：`SavedChart.config` 存的是完整 ECharts 配置对象，可直接渲染，无需 SQL 重跑。渲染优先级：config 直渲 > SQL 重新生成 > queryId 查找。
- **后端 EChartsConfig 结构体**已用 `#[serde(rename)]` 输出 camelCase（`x_axis`→`xAxis` 等），新保存的图表 config 直接是 camelCase。
- **config 是派生缓存，输入变化必须重建**（2026-10-23 修复）：`SavedChart.config` = SQL结果 × chartType × 坐标轴的生成物，DashboardItem 渲染优先级 config 直渲 > SQL 重生成（`lastResult` 缓存路径仅自动化任务写入，普通图表为 null 直接跳过）。所以侧边栏改 chartType/坐标轴/SQL 后**必须**重新执行 SQL + `generateChartConfig` 重建 config 写 store（`ChartEditSidebar.regenerateConfig`，带序列号防竞态），保存前也要重建一次——否则旧 config 永远短路直渲，表现为"改类型预览不响应、保存后也不生效、重启回退"。

## 仪表盘数据链路关键点

- **DashboardCanvas 空状态分支必须包含 AddChartModal**：当 `dashboard.layout.length === 0` 时，空状态 UI 和正常布局 UI 是**两个独立的 return 分支**，AddChartModal 必须在两个分支中都渲染，否则空状态下点击"添加图表"无反应。（Bug 4 根因）
- **savedCharts 加载时序**：DashboardItem 组件依赖 savedCharts 查找图表数据，如果 store 中 savedCharts 尚未加载完成，需要等待或主动触发 loadSavedCharts()。
- **防御性数据处理**：后端返回的 tags/authorizedDashboardIds 等数组字段可能为 null 或 undefined，前端使用时必须用 `(arr || []).map()` / `.join()` 保护。

## 仪表盘编辑模式（2026-06-20 P0+P1 已修复）

- **拖拽机制**：DashboardItem 的 ChartCanvas 组件在编辑模式下设置 `pointerEvents: 'none'`，让鼠标事件穿透到外层卡片。拖拽使用 `DRAG_THRESHOLD_PX = 5` 阈值区分点击/拖拽。ChartCanvas 不再设置 gridStyle（避免与父组件 Grid 布局嵌套冲突）。
- **缩放手柄**：resizeHandleRight/Bottom 通过 CSS `.resize-handle-right:hover` 高亮（`App.css`），corner 手柄为 16px 蓝色圆点。
- **编辑 UX**：DashboardPage 编辑模式显示蓝色 banner 提示 + 已修改项数；DashboardItem 左上角"✋ 拖拽移动"提示；编辑模式虚线边框 `2px dashed`；退出编辑时确认对话框；并行保存 `Promise.all` + 错误收集。
- **键盘快捷键**：编辑模式下 Delete 删除选中图表、方向键微调位置（Shift=3格大步）、Esc 退出编辑/全屏/取消选中；输入框中不触发。非编辑模式 Esc 取消选中。
- **筛选器联动**：`src/utils/filterSql.ts` 将 filterValues 转 SQL WHERE（text→LIKE, select→=/IN, date-range→BETWEEN）注入查询。DashboardItem useEffect 依赖 filterValuesKey（JSON.stringify），筛选激活时跳过 config 直渲强制走 SQL 路径。字符串值转义单引号防注入。
- **PNG 导出**：`src/utils/dashboardExport.ts` 用 `echarts.getInstanceByDom()` + `getDataURL()` 按网格布局拼接为一张 Canvas（2x 分辨率），无额外依赖。ChartCanvas 容器需标记 `data-echarts-container`。
- **暂缓项**：撤销/重做（command pattern）、响应式适配、PDF 导出、后端批量更新接口。
- 实施计划文档：`docs/M5-仪表盘与图表系统详细实施计划.md`（v3.0，完成度 92%）

## ⚠️ 构建/测试环境陷阱（2026-10-24 实测确立）

- **`vite build` 禁止从 Git Bash 运行**：Git Bash 传给 node 进程的 cwd 盘符是小写（`e:/LA_DUCK/la-duck`），而 rollup 传来的模块 id 是大写（`E:/...`）。vite 7 的 html-inline-proxy 用 `id.replace(root, '')` 字符串替换做缓存键，**大小写敏感**导致填充键 `/index.html` ≠ 查找键 `E:/...index.html`，报 `No matching HTML proxy module found`。**必须从 PowerShell / Windows Terminal / cmd 运行 `npm run build` / `tauri build`**（dev server 不走此代码路径，`tauri dev` 不受影响）。
- **vitest 4.1.9 + vite 7.x 测试运行器损坏**（2026-10-24）：现象为所有测试报 `Vitest failed to find the runner`（模块重复实例化，worker 初始化的 runner 与测试文件 import 的不是同一实例）。已验证 vite 7.2.7/7.3.3 + vitest 4.1.9/4.1.12 全坏、vite 8.3.5 正常。**修复：vitest 降级到 3.2.7（+ coverage-v8 3.2.7）**，vite 保持 7.3.3 不动（应用构建链零影响）。当前 207 测试全绿。
- **`tauri dev` 运行期间禁止做任何 npm install**：2026-10-24 曾在应用运行时替换 node_modules/vite，导致 dev server 读取到版本混合文件而崩溃（esbuild.exe 被锁还引发 EBUSY 安装失败）。改依赖前先确认 1420 端口无监听。
- **node_modules 历史隐患**：本机 npm 缓存从未有过 vite 7.3.3（直到 2026-10-23 才首次下载），说明 node_modules 是从别处拷贝的、与 lock 存在漂移；任何 `npm install` 都会按 lock 重新固化并可能移除 extraneous 包。出问题先 `node -e` 核对磁盘版本 vs lock。

## 技术栈

- 桌面框架：Tauri 2 + Rust 后端
- 前端：React 19 + TypeScript + Zustand + ECharts 5
- 双引擎：SQLite（事务）+ DuckDB（分析）
- 构建：Vite 7.3.3 + vitest 3.2.7，类型检查 `tsc --noEmit`，构建 `tsc && vite build`（**必须从 PowerShell 运行**）

## ⚠️ Tauri v2 IPC 参数命名契约（2026-10-23 修复后确立）

- **`invoke` 传给 `#[tauri::command]` 的扁平参数必须是 camelCase**（`chartType`/`xAxis`/`visualConfig`/`authorizedDashboardIds`/`filePath`/`projectId`…），Rust 侧声明 snake_case，由 Tauri 宏自动转换。**单词参数两种命名一致会掩盖错误，只有多词参数才暴露** —— 2026-10-23 的「视觉样式保存不生效」bug 即 `tauri.ts updateSavedChart` 误传 snake_case，5 个多词参数被 serde 静默丢弃（未知键不报错直接 None），后端跳过 UPDATE 列，DB 保留旧值。
- 嵌套 `{ request }` 对象内部用普通 serde 约定（snake_case 字段直通，如 `import_data_v2` 的 `file_path`）。
- 回归测试：`src/__tests__/updateSavedChartArgs.test.ts` 锁定 camelCase 契约。排查"保存丢失"先对比后端实收字段的命名特征。

## 图表视觉配置编辑链路（2026-10-23 修复）

- **预览通道（preview draft）模式**：`ChartEditSidebar.setVisualConfig` 只写本地 state + `dashboardStore.previewVisualConfigs[chartId]` 草稿；`DashboardItem.effectiveVisualConfig` 草稿优先、回退 `savedChart.visualConfig`；`handleSave` 成功后清草稿。**禁止**在编辑中直接 `updateSavedChartLocal` 写 visualConfig —— 会导致 hasChanges 恒 false + 保存后被 chartSyncKey effect 清空（第一轮 bug 根因）。
- **`chartSyncKey = chart.id:chart.updatedAt`** 重置 effect：保存成功后 updatedAt 变化会触发全量状态回填（此时 DB 已是新值，行为正确）；该 effect **不强制** `setActiveTab('basic')`，保证用户在 visual 页保存后停留在原页看到结果。

## ⚠️ 多语句 SQL 的结果段选择（2026-10-24 修复后确立，图表链路头号陷阱）

- **`execute_sql` 对多语句 SQL 逐条执行，`BatchExecuteResult.results` 按语句顺序排列**（Rust `execute_sql_batch`：split_sql_statements 后每条 push 一个结果）。**任何按 SQL 结果生成图表配置的链路都不能盲目取 `results[0]`** —— 图表的 x/y 轴列通常只在最后的聚合语句里，前置探索语句（如 `SELECT *`）的列不含聚合列。
- **症状指纹**：DB 中 `chart_type` 与 `config.series[0].type` 不一致（类型字段改了、config 没重建）；Rust `generate_chart_config` 缺列时报 `找不到Y轴列`/`找不到数值列`，前端若静默吞掉则表现为「改类型预览完全不更新、保存也不生效」。
- **修复**：`src/utils/chartResult.ts` 的 `pickChartResultStatement(results, xAxis, yAxis)` —— 挑列完整包含 x/y 轴的第一个结果段，无匹配退化为 results[0]。`ChartEditSidebar.regenerateConfig` 与 `DashboardItem.renderWithSql` 均已使用；新增链路必须复用，禁止再写 `results[0]`。
- **诊断捷径**：用户数据库在 `C:/Users/Administrator/AppData/Roaming/quickersql/projects/<project-id>/meta.db`（项目注册表 `projects.db` 的 `__projects_registry.db_path`），可直接查 `__saved_charts` 的 chart_type/config/sql 验证假设，无需起应用。

## i18n 架构（2026-08-09 v25.3 完成 Phase 2）

- **统一入口**：`src/context/LocaleContext.tsx` 提供 `useLocale()` hook，`t(key, params?)` 函数
- **翻译存储**：`zhCNTranslations` 和 `enUSTranslations` 两个大对象（非 JSON 文件），key 命名用点分命名空间（`task.error.nameRequired`、`chart.saveTitle`、`dep.cronLabel` 等）
- **参数插值**：`t('key', { name: 'value' })` → 模板中 `{name}` 自动替换
- **已清理文件**：DashboardPage、TaskEditorModal、SaveChartModal、DependencyEditorModal、App.tsx（共 112 处硬编码→t() 调用，新增 70+ key）
- **规则**：console.log/info/error 中的中文不需要翻译（开发者日志）；JSX 注释中的中文不翻译；所有用户可见的 UI 文本必须走 t()

## 技术债管理（2026-08-09 v25.3）

- **当前状态**：P0=0, P1=0, P2=2（内联样式迁移/大组件拆分，长期治理）, NEW=1（E2E skip 评估）
- **文档版本**：架构现状 v25.3，技术债清单 v6.3，综合评分 9.2/10
- **磁盘空间注意**：E 盘可能在编译/测试时空间不足（ENOSPC），需定期清理 `src-tauri/target/` 目录
- **cargo check 文件锁**：target/debug/.fingerprint 目录可能被 IDE/rust-analyzer 锁定（os error 5 拒绝访问），需关闭 IDE 后清理

## 透明窗口启动架构（2026-06-21 修复）

- **`transparent: true` 与 `backgroundColor` 冲突**：Tauri 2 在 Windows 上设置 `backgroundColor` 后可能不走分层窗口路径，导致 WebView2 底层用白色画刷填充。**禁止在 `tauri.conf.json` 的窗口配置中同时设置 `transparent: true` 和 `backgroundColor`**，只保留 `transparent: true`。
- **HWND 获取方式**：`apply_borderless()` 用 `GetForegroundWindow()` 不可靠（setup 阶段窗口未必是前台窗口）。应使用 `window.hwnd()` 获取确切句柄，通过 `hwnd.0 as *mut std::ffi::c_void` 转换后传入 `apply_borderless_to_hwnd(hwnd_ptr)`。
- **`.startup-phase` CSS 类**：index.html 中定义了 `.startup-phase` 类（`background: transparent !important`），JS 必须在执行第一时间给 html/body/#root 添加此类，splash 淡出时移除。这提供了额外的 `!important` 透明保障层。
- **DwmExtendFrameIntoClientArea(-1)**：让 DWM 把整个窗口视为客户区，不绘制任何框架轮廓。setup 阶段必须立即调用，不能等到 `window_resize_to_main` 命令。
- **log crate 未初始化**：项目没有 `env_logger` 或 `tauri_plugin_log`，`log::info!` 不会输出到 stdout。调试时需用 `println!`。

# LA-DUCK 项目长期记忆

## 图表渲染架构约定

- **ECharts 配置归一化**：所有 ECharts 渲染入口（仪表盘 `DashboardItem`、图表库预览 `ChartPreview`）在调用 `echarts.setOption()` 前，必须先经过 `src/utils/echartsNormalize.ts` 的 `normalizeEChartsConfig()` 归一化。该函数递归将 snake_case 键名转 camelCase（兼容 Bug 1 修复前的旧数据），并补充默认 grid/color。幂等，对新旧数据都安全。
- **SavedChart.config 是渲染黄金数据**：`SavedChart.config` 存的是完整 ECharts 配置对象，可直接渲染，无需 SQL 重跑。渲染优先级：config 直渲 > SQL 重新生成 > queryId 查找。
- **后端 EChartsConfig 结构体**已用 `#[serde(rename)]` 输出 camelCase（`x_axis`→`xAxis` 等），新保存的图表 config 直接是 camelCase。

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

## 技术栈

- 桌面框架：Tauri 2 + Rust 后端
- 前端：React 19 + TypeScript + Zustand + ECharts 5
- 双引擎：SQLite（事务）+ DuckDB（分析）
- 构建：Vite 7，类型检查 `tsc --noEmit`，构建 `tsc && vite build`

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

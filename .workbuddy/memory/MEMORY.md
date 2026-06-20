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

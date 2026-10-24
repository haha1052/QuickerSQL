# v13.0 图表编辑功能升级 — Product Requirement Document

> **状态**：Accepted
> **版本**：v13.0（2026-08-29）
> **负责人**：主 Agent（@架构）
> **影响范围**：前端 React 组件层 + 状态层 + 工具层
> **规则依据**：architecture.md、coding.md、i18n.md、file-lock.md

---

## 1. Overview

为 QuickerSQL 的图表编辑功能引入"Excel 级"视觉属性编辑能力。方案核心思路是 **"数据结构生成"和"视觉样式合成"解耦**，前端在渲染前将用户的 `VisualConfig` 合流到 ECharts option 中，实现颜色、文字、坐标轴、标签、图例、网格等视觉属性的自由定制。

## 2. Purpose

解决当前图表编辑只能修改元数据（名称、类型、X/Y 列、SQL）、无法调整视觉属性的问题，让 SQL 查询页和仪表盘都能提供类似 Excel 的图表美化体验。

## 3. Goals

- **G1**：支持修改图表的颜色方案、图例位置/显示、标题位置/字号/颜色、X/Y 轴样式、数据标签位置/内容、网格显示等视觉属性
- **G2**：SQL 查询页保持轻量，仅暴露最高频的 4 项视觉编辑 + 可折叠高级面板
- **G3**：仪表盘提供完整的 6 大视觉属性面板，支持实时预览和持久化
- **G4**：两端共用一套 `VisualConfig` 类型和子面板组件，保证代码复用率 > 70%
- **G5**：修改视觉配置时**不触发 SQL 重跑**，仅通过 `echarts.setOption` 热更新
- **G6**：遵循现有前端三层架构（components → store → services），所有 i18n 文案走 `LocaleContext`

## 4. Non-Goals（明确不做的事）

- **N1**：本次升级不修改后端 `chart_service.rs` 的 `generate_*` 函数（后端仍只负责"骨架配置"生成）
- **N2**：本次升级不新增系统表（`__saved_charts` 的 `visual_config` 字段复用现有 `config` JSON 字段承载，后续可单独发 spec 做数据库迁移）
- **N3**：不引入新的 UI 框架或组件库（继续使用原生 HTML + CSS-in-JS 风格）
- **N4**：不实现图表类型一键切换时保留 `visualConfig`（后续版本再处理类型相关配置的智能合流）
- **N5**：不实现"另存为模板"功能（可在第 3 波作为扩展）

## 5. Background

### 5.1 当前问题

| 问题 | 详情 |
|------|------|
| 视觉属性硬编码 | `chart_service.rs` 中 10+ 个 `generate_*` 函数写死了颜色、图例位置、网格线、tooltip 配置 |
| 前端渲染无合流 | `ChartRenderer.tsx` 的 `buildEchartsConfig` 仅处理全局设置（色板、网格、图例），不支持图表级视觉配置 |
| 编辑面板能力缺失 | `ChartEditSidebar.tsx` 只暴露元数据字段，`ChartConfigPanel.tsx` 只做 X/Y 列映射 |
| 配置无持久化 | `SavedChart` 的 `config` 字段未承载视觉配置，刷新后丢失 |

### 5.2 现有代码结构

```
src/components/chart/
├── ChartPanel.tsx          ← SQL 查询页图表容器（config/preview 两阶段）
├── ChartRenderer.tsx       ← ECharts 渲染器（懒加载、SVG/Canvas 切换）
├── ChartConfigPanel.tsx    ← X/Y 列映射面板
├── ChartTypeSelector.tsx   ← 图表类型选择
├── ChartPreview.tsx        ← 预览组件
└── SaveChartModal.tsx      ← 保存弹窗

src/components/dashboard/
└── ChartEditSidebar.tsx    ← 仪表盘图表编辑侧栏（元数据 + SQL）

src/types/chart.ts           ← ChartConfig、ChartType 类型
src/types/dashboard.ts      ← SavedChart 类型
src/utils/echartsNormalize.ts ← 历史工具（已被 ChartRenderer 替代，可废弃）
```

## 6. Functional Requirements

### FR1 — VisualConfig 类型定义（P0）

```typescript
// src/types/chart.ts 新增
export interface VisualConfig {
  title?: {
    text?: string;
    position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
    fontSize?: number;
    color?: string;
    fontWeight?: 'normal' | 'bold';
  };
  legend?: {
    show?: boolean;
    position?: 'top' | 'bottom' | 'left' | 'right';
    orient?: 'horizontal' | 'vertical';
    fontSize?: number;
  };
  color?: {
    scheme?: string;
    customPalette?: string[];
    seriesOverrides?: Record<string, { color?: string; opacity?: number }>;
  };
  xAxis?: AxisVisualConfig;
  yAxis?: AxisVisualConfig;
  label?: {
    show?: boolean;
    position?: 'top' | 'bottom' | 'left' | 'right' | 'inside' | 'outside' | 'center';
    format?: Array<'name' | 'value' | 'percent'>;
    fontSize?: number;
    color?: string;
  };
  grid?: { show?: boolean; left?: string; right?: string; top?: string; bottom?: string };
  animation?: { show?: boolean; duration?: number };
  tooltip?: { show?: boolean; trigger?: 'item' | 'axis' | 'none' };
}

interface AxisVisualConfig {
  title?: { text?: string; fontSize?: number; color?: string };
  show?: boolean;
  min?: number | 'auto';
  max?: number | 'auto';
  inverse?: boolean;
  labelRotate?: number;
  labelFontSize?: number;
  labelColor?: string;
  showGrid?: boolean;
  showTick?: boolean;
  numberFormat?: string;
}
```

### FR2 — applyVisualConfig 合流工具（P0）

```typescript
// src/utils/chartVisual.ts（新建）
export function applyVisualConfig(
  baseOption: Record<string, unknown>,
  visualConfig: VisualConfig
): Record<string, unknown>
```

- 覆盖 title / legend / xAxis / yAxis / series[i].itemStyle / series[i].label / grid / animation / tooltip / color
- 严格使用深拷贝 + 分字段覆盖，不破坏 baseOption 的数据结构（series data、xAxis.data 等）
- 对 `seriesOverrides` 按 series name 精确匹配，未匹配的系列使用 `colorPalette` 默认色

### FR3 — ChartRenderer 支持 visualConfig props（P0）

`ChartRendererProps` 新增 `visualConfig?: VisualConfig`，`buildEchartsConfig` 内部调用 `applyVisualConfig` 合流。

### FR4 — SQL 查询页快捷视觉编辑（P1）

`ChartPanel.tsx` 在 preview 阶段新增：
- 一行快捷条 `ChartStyleQuickBar`：色板切换、图例位置、数据标签开关、X/Y 轴标题
- 可折叠高级面板 `ChartStyleAdvancedPanel`：标题位置、网格、系列颜色、动画、背景
- 修改不持久化（session 级），保存时写入 `SavedChart.config`

### FR5 — 仪表盘完整视觉编辑（P1）

`ChartEditSidebar.tsx` 新增第 3 个 Tab「视觉样式」，包含 6 大分组：
1. 标题与图例（TitleLegendPanel）
2. 坐标轴（AxisPanel，X/Y 切换）
3. 颜色与系列（ColorPanel + SeriesPanel）
4. 数据标签（LabelPanel）
5. 网格与背景（GridPanel）
6. 动画与 Tooltip（AnimationPanel）

实时预览 + 脏态提示 + 持久化到 `SavedChart.config.visualConfig`。

### FR6 — 共用子面板组件（P1）

以下子面板组件两端共用，放在 `src/components/chart/panels/`：
- TitleLegendPanel
- AxisPanel
- ColorPanel
- LabelPanel
- SeriesPanel
- GridPanel

每个子面板接收 `value`、`onChange` props，内部用受控组件。

## 7. Non-Functional Requirements

### NFR1 — 性能

- 颜色/字号/位置等数值型改动使用 50ms debounce
- `echarts.setOption(option, false)` 增量更新，不重建图表实例
- 6 个子面板组件使用 `React.memo` + `useMemo` 固化 props 传递

### NFR2 — 兼容性

- 旧 `SavedChart` 没有 `visualConfig` 时，前端用默认渲染（`VisualConfig` 各字段可选，默认不覆盖任何 option）
- `ChartRenderer` 的 `buildEchartsConfig` 必须向后兼容现有设置（`showGrid`、`showLegend` 等全局设置仍生效，`visualConfig` 优先级更高）

### NFR3 — 可维护性

- 所有 i18n 文案走 `LocaleContext`，新增 key 使用 `chart.visual.*` 前缀
- 子面板组件单文件 ≤ 200 行
- `applyVisualConfig` 必须有单元测试覆盖 4 种常用图表类型

### NFR4 — 规则合规

- 前端新增文件全部在 `src/components/chart/`、`src/types/`、`src/utils/` 白名单内
- 不跨模块硬编码依赖（子面板不得依赖 dashboardStore）
- 不引入新依赖包（继续使用现有 echarts 5.x）

## 8. Constraints

- **C1**：SQL 查询页的快捷条占一行，高级面板默认折叠
- **C2**：仪表盘侧栏宽度保持 460px，不超过现有布局上限
- **C3**：视觉配置的任何修改不得触发 `generateChartConfig` 后端调用
- **C4**：`visualConfig` 字段的持久化先复用 `SavedChart.config` JSON，后续可单独发 spec 迁移到独立列

## 9. Files Changed

### 9.1 新增文件

| 文件路径 | 类型 | 说明 |
|---------|------|------|
| `src/types/chart.ts` | 修改 | 新增 `VisualConfig`、`AxisVisualConfig` 类型 |
| `src/utils/chartVisual.ts` | 新建 | `applyVisualConfig` 合流工具 |
| `src/utils/__tests__/chartVisual.test.ts` | 新建 | `applyVisualConfig` 单元测试 |
| `src/components/chart/panels/TitleLegendPanel.tsx` | 新建 | 标题图例子面板 |
| `src/components/chart/panels/AxisPanel.tsx` | 新建 | 坐标轴子面板 |
| `src/components/chart/panels/ColorPanel.tsx` | 新建 | 颜色子面板 |
| `src/components/chart/panels/LabelPanel.tsx` | 新建 | 数据标签子面板 |
| `src/components/chart/panels/SeriesPanel.tsx` | 新建 | 系列样式子面板 |
| `src/components/chart/panels/GridPanel.tsx` | 新建 | 网格子面板 |
| `src/components/chart/ChartStyleQuickBar.tsx` | 新建 | SQL 页快捷条 |
| `src/components/chart/ChartStyleAdvancedPanel.tsx` | 新建 | SQL 页折叠高级面板 |
| `src/components/chart/ChartPropertyPanel.tsx` | 新建 | 仪表盘属性面板容器（Tab 版） |

### 9.2 修改文件

| 文件路径 | 修改内容 |
|---------|---------|
| `src/components/chart/ChartRenderer.tsx` | props 新增 `visualConfig`，`buildEchartsConfig` 合流 |
| `src/components/chart/ChartPanel.tsx` | 新增 `visualConfig` state + 快捷条 + 高级面板 + 保存时写入 |
| `src/components/chart/SaveChartModal.tsx` | props 新增 `visualConfig`，保存时写入 |
| `src/components/dashboard/ChartEditSidebar.tsx` | 新增「视觉样式」Tab，嵌入 `ChartPropertyPanel` |
| `src/types/dashboard.ts` | `SavedChart.config` 字段类型扩展以承载 `visualConfig` |

### 9.3 不修改的文件

| 文件路径 | 理由 |
|---------|------|
| `src-tauri/src/services/chart_service.rs` | 后端仍只负责骨架配置，视觉合流由前端完成 |
| `src-tauri/src/services/dashboard_service.rs` | 第 1 波复用 `config` JSON 字段，不新增数据库列 |
| `src-tauri/src/models/dashboard.rs` | 同上 |
| `src-tauri/src/commands/dashboard.rs` | 同上 |

## 10. Acceptance Criteria

### AC1 — 类型定义 (programmatic)

- [ ] `src/types/chart.ts` 导出 `VisualConfig` 和 `AxisVisualConfig` 接口
- [ ] `npx tsc --noEmit` 零错误
- [ ] `VisualConfig` 所有字段为可选

### AC2 — applyVisualConfig 合流工具 (programmatic + human-judgment)

- [ ] `chartVisual.test.ts` 中 4 个测试用例全部通过（bar/pie/line/scatter）
- [ ] 颜色覆盖后 series data 不变（深拷贝验证）
- [ ] seriesOverrides 能按 series name 精确覆盖单个系列的颜色

### AC3 — ChartRenderer 合流 (human-judgment)

- [ ] 修改颜色方案后图表实时更新，不触发 SQL 重跑
- [ ] 修改图例位置后图例正确移动
- [ ] 修改 X 轴标题后轴标题正确显示
- [ ] `cargo check --quiet` 通过（后端无影响）

### AC4 — SQL 查询页快捷编辑 (human-judgment)

- [ ] 快捷条默认显示一行：色板、图例、标签、轴标题
- [ ] 高级面板默认折叠，点击可展开
- [ ] 修改视觉属性 → 图表实时刷新
- [ ] 保存图表后刷新页面，视觉属性保留

### AC5 — 仪表盘完整编辑 (human-judgment)

- [ ] `ChartEditSidebar` 新增「视觉样式」Tab
- [ ] 6 大分组子面板全部可用
- [ ] 修改视觉属性 → 图表实时刷新 + 脏态提示
- [ ] 保存后刷新仪表盘，视觉属性保留

### AC6 — 规则合规 (programmatic)

- [ ] SQL 检测：`format!.*SELECT` 等匹配数 = 0
- [ ] 敏感字符串检测：Count = 0
- [ ] TS any 检测：Count = 0
- [ ] 所有新增组件文件位于 `src/components/chart/panels/`

## 11. Rollout Plan（5 步推进）

### Step 1：基础设施（~0.5 天）
- 新增 `VisualConfig` 类型定义
- 新增 `applyVisualConfig` 工具 + 单元测试
- 修改 `ChartRenderer` 支持 `visualConfig` props
- **验收**：AC1、AC2、AC3 全部通过

### Step 2：SQL 查询页快捷编辑（~1 天）
- 新增 `ChartStyleQuickBar`（4 项高频控件）
- `ChartPanel` 集成快捷条 + `visualConfig` state
- **验收**：AC4 全部通过

### Step 3：仪表盘视觉编辑（~2 天）
- 新增 6 个共用子面板
- 新增 `ChartPropertyPanel`（Tab 容器）
- `ChartEditSidebar` 集成新 Tab
- `SavedChart.config` 承载 `visualConfig`
- **验收**：AC5 全部通过

### Step 4：SQL 查询页高级面板（~0.5 天）
- 新增 `ChartStyleAdvancedPanel`
- 折叠嵌入 `ChartPanel`
- **验收**：AC4 高级部分通过

### Step 5：收尾验证（~0.5 天）
- 补齐单元测试覆盖率
- 全量规则合规检测
- 清理废弃文件（`echartsNormalize.ts` 标记 deprecated）
- **验收**：AC1-AC6 全部通过

---

## 12. 风险与 Mitigation

| 风险 | 影响 | Mitigation |
|------|------|------------|
| echarts 频繁 setOption 导致卡顿 | 颜色 picker 拖动时性能抖动 | 50ms debounce + `React.memo` 子面板 |
| 后端生成的 `generateChartConfig` 返回的 option 与 `visualConfig` 字段冲突 | 合流时覆盖骨架数据 | `applyVisualConfig` 严格区分数据字段和视觉字段，数据字段不覆盖 |
| 仪表盘图表刷新 SQL 时视觉配置丢失 | 用户体验退化 | `DashboardItem.tsx` 加载图表时先加载 `visualConfig`，再调 `generateChartConfig` 生成骨架，最后合流 |
| 老数据兼容 | 已保存图表无 `visualConfig` | 渲染时检测 `SavedChart.config.visualConfig`，不存在则用空对象 `{}`（默认不覆盖） |

---

## 13. 版本记录

| 版本 | 日期 | 变更内容 |
|------|------|---------|
| v13.0 | 2026-08-29 | 初版。用户确认方案 A（分层解锁），5 步推进，预计 4.5 天完成 |
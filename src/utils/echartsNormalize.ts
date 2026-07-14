/**
 * ECharts 配置归一化工具
 *
 * 背景：
 *   在修复 xAxis/yAxis 键名问题（Bug 1）之前，Rust 后端的 EChartsConfig
 *   结构体使用 snake_case 字段名（x_axis、y_axis、data_zoom、axis_pointer、
 *   area_style 等），序列化后的 JSON 键名不符合 ECharts API 规范。虽然后端
 *   已通过 #[serde(rename)] 修复，但 SQLite 中已保存的旧图表 config 仍为
 *   snake_case。此模块在前端渲染前做兼容性归一化，确保新旧数据都能正确渲染。
 *
 * 设计原则：
 *   1. 仅转换对象的「键名」为 camelCase，不修改原始值（字符串、数字等数据）。
 *   2. 递归处理嵌套对象和对象数组。
 *   3. 幂等：对已经是 camelCase 的配置做归一化是安全的（仅补充缺失的默认项）。
 *   4. 补充默认 grid / color，与 SQL 查询页 ChartRenderer 保持视觉一致。
 */

const SNAKE_CASE_RE = /_([a-z])/g;

/** 将单个 snake_case 键名转为 camelCase；不含下划线则原样返回。 */
function toCamelCase(key: string): string {
  if (!key.includes('_')) return key;
  return key.replace(SNAKE_CASE_RE, (_, c: string) => c.toUpperCase());
}

/** 配色方案色板定义（与 ChartRenderer 保持一致）。 */
export const COLOR_SCHEMES: Record<string, string[]> = {
  default: ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc'],
  dark: ['#4992ff', '#7cffb2', '#fddd60', '#ff6e76', '#58d9f9', '#05c091', '#ff8a45', '#8d48e3', '#dd79ff'],
  light: ['#9ecaff', '#b8f0c8', '#ffe89c', '#ffa5ad', '#b0ecf7', '#7edcc3', '#ffc39e', '#d0a8f0', '#f5b8e0'],
  colorful: ['#ff4d4f', '#fa8c16', '#faad14', '#a0d911', '#52c41a', '#13c2c2', '#1890ff', '#722ed1', '#eb2f96'],
  pastel: ['#ffb3ba', '#ffdfba', '#ffffba', '#baffc9', '#bae1ff', '#e0baff', '#ffb3e6', '#c9c9ff', '#ffd6a5'],
  vivid: ['#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6', '#bcf60c'],
};

/** ECharts 默认色板（与 ChartRenderer 保持一致）。 */
const DEFAULT_COLORS = COLOR_SCHEMES.default;

/** 可视化设置选项（用于归一化时应用默认值）。 */
export interface VisualizationOptions {
  showGrid?: boolean;
  showLegend?: boolean;
  animation?: boolean;
  defaultColorScheme?: string;
}

/**
 * 递归归一化 ECharts 配置对象：
 *   - 将所有对象的 snake_case 键名转为 camelCase
 *   - 原始值（string / number / boolean / null）保持不变
 *   - 数组按元素递归处理（对象元素的键名会被转换，原始值不动）
 *
 * @returns 归一化后的新对象（不修改输入）
 */
function normalizeKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeKeys);
  }
  if (value && typeof value === 'object') {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(src)) {
      out[toCamelCase(key)] = normalizeKeys(src[key]);
    }
    return out;
  }
  return value;
}

/**
 * 归一化 ECharts 配置：转换键名 + 补充默认 grid/color + 应用可视化设置。
 *
 * 用于在 echarts.setOption() 之前对配置做兼容处理，确保：
 *   1. 旧数据（snake_case 键名）能正确渲染
 *   2. 新数据（camelCase 键名）不受影响（幂等）
 *   3. 缺少 grid/color 时使用合理默认值，避免坐标轴标签被裁剪
 *   4. 可传入可视化设置作为默认值（用户配置优先级高于设置）
 *
 * @param config 原始 ECharts 配置（可能为旧 snake_case 格式）
 * @param options 可选的可视化设置，作为默认值应用
 * @returns 可直接传给 echarts.setOption() 的配置；输入为 null 时返回 null
 */
export function normalizeEChartsConfig(
  config: Record<string, unknown> | null,
  options?: VisualizationOptions,
): Record<string, unknown> | null {
  if (!config || typeof config !== 'object') return config;

  const normalized = normalizeKeys(config) as Record<string, unknown>;

  const showGrid = options?.showGrid !== false;
  const showLegend = options?.showLegend !== false;
  const animation = options?.animation !== false;
  const colorScheme = options?.defaultColorScheme || 'default';
  const colorPalette = COLOR_SCHEMES[colorScheme] || DEFAULT_COLORS;

  // 补充默认 grid（避免坐标轴标签被容器边缘裁剪）
  if (!normalized.grid) {
    const hasTitle = !!(normalized.title as Record<string, unknown> | undefined)?.text;
    const hasDataZoom = Array.isArray(normalized.dataZoom) && normalized.dataZoom.length > 0;
    normalized.grid = {
      left: '10%',
      right: '5%',
      bottom: hasDataZoom ? '15%' : '8%',
      top: hasTitle ? '60px' : '40px',
      containLabel: true,
      show: showGrid,
    };
  } else {
    const gridObj = normalized.grid as Record<string, unknown>;
    if (gridObj.show === undefined) {
      gridObj.show = showGrid;
    }
  }

  // 补充默认 legend
  if (!normalized.legend) {
    normalized.legend = {
      show: showLegend,
    };
  } else {
    const legendObj = normalized.legend as Record<string, unknown>;
    if (legendObj.show === undefined) {
      legendObj.show = showLegend;
    }
  }

  // 补充默认 animation
  if (normalized.animation === undefined) {
    normalized.animation = animation;
  }

  // 补充默认色板
  if (!normalized.color) {
    normalized.color = colorPalette;
  }

  return normalized;
}

export default normalizeEChartsConfig;

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

/** ECharts 默认色板（与 ChartRenderer 保持一致）。 */
const DEFAULT_COLORS = [
  '#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de',
  '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc',
];

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
 * 归一化 ECharts 配置：转换键名 + 补充默认 grid/color。
 *
 * 用于在 echarts.setOption() 之前对配置做兼容处理，确保：
 *   1. 旧数据（snake_case 键名）能正确渲染
 *   2. 新数据（camelCase 键名）不受影响（幂等）
 *   3. 缺少 grid/color 时使用合理默认值，避免坐标轴标签被裁剪
 *
 * @param config 原始 ECharts 配置（可能为旧 snake_case 格式）
 * @returns 可直接传给 echarts.setOption() 的配置；输入为 null 时返回 null
 */
export function normalizeEChartsConfig(
  config: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!config || typeof config !== 'object') return config;

  const normalized = normalizeKeys(config) as Record<string, unknown>;

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
    };
  }

  // 补充默认色板
  if (!normalized.color) {
    normalized.color = DEFAULT_COLORS;
  }

  return normalized;
}

export default normalizeEChartsConfig;

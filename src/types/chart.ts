import type { EChartsOption } from 'echarts';

/**
 * 图表类型枚举，由后端 generateChartConfig 的 chart_type 参数决定
 */
export type ChartType = 'line' | 'bar' | 'pie' | 'scatter' | 'area' | 'stackedBar' | 'horizontalBar' | 'doughnut' | 'dualAxis' | 'radar' | 'funnel' | 'gauge';

/**
 * 通用表格数据：二维字符串矩阵 + 列名数组
 */
export interface ChartDataset {
  columns: string[];
  rows: string[][];
}

/**
 * generateChartConfig 返回的 ECharts 配置片段
 * 由后端生成，字段与 ECharts 官方 `option` 保持一致，但只包含部分 key
 */
export interface ChartConfigPayload {
  title?: { text?: string; left?: string } | Array<{ text?: string; left?: string }>;
  tooltip?: { trigger?: string; axisPointer?: { type?: string }; [key: string]: unknown };
  legend?: { data?: string[]; top?: string; [key: string]: unknown };
  xAxis?: ChartAxisOption | ChartAxisOption[];
  yAxis?: ChartAxisOption | ChartAxisOption[];
  series?: ChartSeriesOption[];
  dataZoom?: Array<{ type?: string; start?: number; end?: number; [key: string]: unknown }>;
  [key: string]: unknown;
}

interface ChartAxisOption {
  type?: string;
  data?: string[];
  name?: string;
  [key: string]: unknown;
}

interface ChartSeriesOption {
  name?: string;
  type?: string;
  data?: unknown[];
  stack?: string;
  areaStyle?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * 图表配置请求参数（前端 -> 后端 tauri 命令）
 */
export interface GenerateChartConfigRequest {
  columns: string[];
  rows: string[][];
  chart_type?: ChartType | null;
  x_axis_column?: string | null;
  y_axis_columns?: string[] | null;
}

/**
 * 推荐图表类型列表（API 响应体）
 */
export interface ChartTypeRecommendation {
  types: ChartType[];
}

/**
 * 供 UI 层使用的统一类型：既可以是第三方库的完整 EChartsOption，
 * 也可以是后端返回的 ChartConfigPayload（字段更窄）
 */
export type ChartConfig = EChartsOption | ChartConfigPayload | Record<string, unknown>;

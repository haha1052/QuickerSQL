// Dashboard Types

// 保存的查询
export interface SavedQuery {
  id: string;
  name: string;
  sql: string;
  params: QueryParam[];
  cacheTtlSecs: number;
  lastResult: QueryResult | null;
  lastRunAt: number | null;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface QueryParam {
  name: string;
  type: 'string' | 'number' | 'date' | 'select';
  default: string;
  options?: Array<{ label: string; value: string }>;
  label: string;
}

export interface QueryResult {
  columns: string[];
  rows: string[][];
}

// 保存的图表
export interface SavedChart {
  id: string;
  name: string;
  queryId: string;
  sql: string; // 原始 SQL（直接存到图表记录，避免依赖 __saved_queries）
  chartType: ChartType;
  xAxis: string;
  yAxis: string[];
  title: string;
  filters: ChartFilter[];
  tags: string[];
  description: string;
  thumbnail: string | null;
  config: Record<string, unknown> | null;
  // 授权范围: "all" = 所有仪表盘可用; "restricted" = 仅指定仪表盘可用
  visibility: 'all' | 'restricted';
  authorizedDashboardIds: string[]; // visibility = "restricted" 时生效
  // 自动化任务刷新：最新结果缓存（{columns, rows}），存在则前端可跳过查询直接渲染
  lastResult: { columns: string[]; rows: string[][] } | null;
  lastRunAt: number | null;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface ChartFilter {
  field: string;
  operator: '=' | '!=' | '>' | '<' | 'like' | 'in';
  value: string;
}

export type ChartType = 'bar' | 'line' | 'pie' | 'scatter' | 'area' | 'stackedBar' | 'horizontalBar' | 'doughnut' | 'dualAxis' | 'radar' | 'funnel' | 'gauge' | 'table';

// 仪表盘
export interface Dashboard {
  id: string;
  name: string;
  description: string;
  layout: DashboardItem[];
  filters: DashboardFilter[];
  refreshIntervalSecs: number;
  isDefault: boolean;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  // 背景设置
  backgroundColor?: string;     // 背景颜色，如 '#f0f0f0'
  backgroundImage?: string;     // 背景图片 URL
  canvasWidth?: number;        // 画布宽度（px），默认 100%
  canvasHeight?: number;       // 画布高度（px），默认自适应
  padding?: number;            // 画布内边距
  gridGap?: number;            // 图表间距（px），默认 16
  rowHeight?: number;          // 行高（px），默认 80
  snapToGrid?: boolean;        // 磁吸对齐，默认 true
}

export interface DashboardItem {
  id: string;
  dashboardId: string;
  chartId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  configOverrides: Partial<SavedChart>;
  position: number;
  createdAt: number;
  updatedAt: number;
}

export interface DashboardItemLayoutUpdate {
  id: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface DashboardFilter {
  id: string;
  field: string;
  label: string;
  type: 'date-range' | 'select' | 'text';
  defaultValue: string | string[];
  options?: Array<{ label: string; value: string }>;
}

// Grid position for dashboard items
export interface GridPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Create saved chart params
export interface CreateSavedChartParams {
  name: string;
  queryId: string;
  querySql: string; // 原始 SQL
  chartType: string;
  xAxis: string;
  yAxis: string[];
  title?: string;
  tags?: string[];
  description?: string;
  config?: Record<string, unknown>;
  visibility?: 'all' | 'restricted';
  authorizedDashboardIds?: string[];
}

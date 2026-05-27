// Database Types
export interface DatabaseStatus {
  db_type: string;
  tables: string[];
  row_count: [string, number][];
  is_connected: boolean;
}

export interface SqlStatementResult {
  statement: string;
  success: boolean;
  error: string | null;
  columns: string[] | null;
  rows: string[][] | null;
  affected_rows: number | null;
}

export interface BatchExecuteResult {
  results: SqlStatementResult[];
  success_count: number;
  fail_count: number;
}

// Project Types
export interface Project {
  name: string;
  db_path: string;
}

export interface ProjectList {
  projects: string[];
}

// Import Types
export interface SqlColumn {
  name: string;
  dataType: string;
}

export interface FieldMeta {
  name: string;
  dataType: string;
}

export interface TableInfo {
  name: string;
  rowCount: number;
  columns?: Array<{ name: string; type: string }>;
}

export interface QueryHistoryItem {
  id: string;
  sql: string;
  timestamp: number;
  success?: boolean;
  rowCount?: number | null;
}

export interface CsvPreview {
  headers: string[];
  rows: string[][];
}

export interface SheetInfo {
  name: string;
  rowCount: number;
  columnCount: number;
}

export interface ExcelPreview {
  sheets: SheetInfo[];
  activeSheetPreview?: CsvPreview;
}

// Import Item Status
export type ImportStatus = 'idle' | 'loading' | 'previewing' | 'importing' | 'success' | 'error';

// Import Item Interface
export interface ImportItem {
  id: string;
  fileType: 'csv' | 'excel';
  filePath: string;
  fileName: string;
  sheets?: SheetInfo[];
  sheetName?: string;
  activeSheetIndex?: number;
  preview: CsvPreview;
  hasHeader: boolean;
  tableName: string;
  fields: FieldMeta[];
  selected: boolean;
  status: ImportStatus;
  error?: string;
  parentId?: string;
  isParent?: boolean;
  isExpanded?: boolean;
}

// Import Request (V1 - deprecated)
export interface ImportRequest {
  rows: string[][];
  table_name: string;
  fields: FieldMeta[];
}

// Import Request (V2 - preferred)
export interface ImportRequestV2 {
  file_path: string;
  sheet_name?: string;
  table_name: string;
  has_header: boolean;
  fields: FieldMeta[];
}

// Query Types
export interface QueryResult {
  columns: string[];
  rows: string[][];
}

export interface SqlQuery {
  id: string;
  name: string;
  sql: string;
  result: QueryResult | null;
  batchResults: SqlStatementResult[] | null;
}

// Tabs
export type TabType = 'csv' | 'sql';

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// AG Grid Types
export interface GridColumnDef {
  field: string;
  headerName: string;
  [key: string]: unknown;
}

export interface GridRowData {
  [key: string]: unknown;
}

// Data Visualization Types
export interface ChartConfig {
  type: 'line' | 'bar' | 'pie' | 'scatter' | 'area';
  title?: string;
  xAxisField: string;
  yAxisField: string;
  [key: string]: unknown;
}

// Error Types
export interface AppError {
  code: string;
  message: string;
  details?: unknown;
}

// Common Types
export type LoadingState = 'idle' | 'loading' | 'succeeded' | 'failed';

export interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
}

export interface SortInfo {
  field: string;
  order: 'asc' | 'desc';
}

export interface FilterInfo {
  field: string;
  operator: string;
  value: unknown;
}

// Database Info
export interface DatabaseInfo {
  db_type: string;
  name: string;
  is_available: boolean;
  description: string;
}

// Export workspace types
export * from './workspace';

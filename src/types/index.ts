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
  executionTimeMs?: number;
  engine?: string | null;
}

export interface BatchExecuteResult {
  results: SqlStatementResult[];
  success_count: number;
  fail_count: number;
}

// Project Types
export interface ProjectInfo {
  id: string;                        // UUID
  name: string;                      // 项目显示名
  dbPath: string;                    // 数据库文件相对路径
  createdAt: string;                 // ISO 8601
  updatedAt: string;                 // ISO 8601
  lastOpenedAt: string | null;       // 最近打开时间
  description: string | null;        // 项目描述
}

// 旧名保留为别名（兼容期，Task 6/7 将清理所有引用后可删除）
export type Project = ProjectInfo;

export interface ProjectList {
  projects: ProjectInfo[];
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
  row_count: number;       // 行数（后端精确查询）
  column_count: number;    // 列数
  is_system_table: boolean; // 是否系统表（由后端判断，前端不再硬编码）
}

export interface ColumnInfo {
  name: string;              // 列名
  data_type: string;         // 数据类型（TEXT/INTEGER/REAL/BLOB 等）
  nullable: boolean;         // 是否允许 NULL
  default_value: string | null; // 默认值
  is_primary_key: boolean; // 是否主键
  position: number;          // 列序号（1-based）
}

export interface QueryHistoryItem {
  id: string;
  sql: string;
  name?: string | null;
  executed_at: string;
  execution_time_ms?: number | null;
  row_count?: number | null;
  success: boolean;
  error_message?: string | null;
  is_favorite: boolean;
  tags?: string | null;
}

export interface QueryHistoryListRequest {
  search?: string | null;
  only_favorites?: boolean | null;
  offset?: number | null;
  limit?: number | null;
}

export interface QueryHistoryListResponse {
  items: QueryHistoryItem[];
  total: number;
}

export interface UpdateFavoriteRequest {
  id: string;
  is_favorite: boolean;
}

export interface SqlSnippet {
  id: string;
  name: string;
  sql: string;
  description: string | null;
  category: string | null;
  tags: string | null;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
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
  fileType: 'csv' | 'excel' | 'json' | 'parquet' | 'txt';
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
  delimiter?: string;
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
  delimiter?: string;
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
export type TabType = 'csv' | 'sql' | 'dashboard' | 'automation';

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

// DuckDB Init Status
export interface DuckDbInitStatus {
  success: boolean;
  view_count: number;
  total_tables: number;
  duration_ms: number;
  trigger: 'preload' | 'switch_project' | 'lazy_load';
}

export * from './settings';

// Audit Log Types
export type {
  AuditLogModule,
  AuditLogAction,
  AuditLogStatus,
  AuditLogItem,
  RecordAuditLogRequest,
  QueryAuditLogsRequest,
  AuditLogsListResponse,
} from './audit_log';

// Export workspace types
export * from './workspace';

// Export dashboard types
export * from './dashboard';

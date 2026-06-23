import type {
  GridOptions,
  ColDef,
  GridReadyEvent,
  GridApi,
} from 'ag-grid-community';

/**
 * 表格行数据 —— 来自 SQL 查询结果的一行（key=列名，value=单元格值）
 */
export interface TableRowData {
  [columnName: string]: string | number | boolean | null;
}

/**
 * Column Def：基于 ag-grid-community 的 ColDef 做一层约束，
 * 避免调用方传入任意结构
 */
export type TableColumnDef = ColDef<TableRowData>;

/**
 * ag-grid 原生的配置类型（可透传 GridOptions）
 */
export type TableGridOptions = GridOptions<TableRowData>;

/**
 * ag-grid `onGridReady` 回调参数
 */
export type TableGridReadyEvent = GridReadyEvent<TableRowData>;

/**
 * ag-grid GridApi 类型
 */
export type TableGridApi = GridApi<TableRowData>;

/**
 * DatabaseExplorer 中用到的列元数据缓存：tableName -> ColumnInfo[]
 */
export interface ColumnsCache {
  [tableName: string]: ColumnMeta[];
}

/**
 * ColumnMeta：列信息（和后端 ColumnInfo 同结构）
 */
export interface ColumnMeta {
  name: string;
  data_type: string;
  nullable: boolean;
  default_value: string | null;
  is_primary_key: boolean;
  position: number;
}

/**
 * getTableMeta 返回的表格扩展信息（索引数、估算大小）
 */
export interface TableMetaInfo {
  index_count: number;
  size_bytes: number;
}

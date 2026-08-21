/**
 * result-grid/types.ts — ResultGrid 模块共享类型
 */
import type { CellClassRules } from 'ag-grid-community';

// ============================================================
// 选区模型
// ============================================================

export interface CellPos {
  rowIndex: number;
  colId: string;
}

/** 矩形选区：已归一化 rowStart <= rowEnd，colIds[0] 在前列顺序中靠前 */
export interface RectRange {
  rowStart: number;
  rowEnd: number;
  colIds: [string, string]; // 起止列 colId（按当前列顺序归一化）
}

export interface SelectionState {
  ranges: RectRange[]; // Ctrl 追加多个矩形
  anchor: CellPos | null; // Shift 扩选锚点
  active: CellPos | null; // 活动单元格（键盘导航焦点）
}

// ============================================================
// 右键菜单
// ============================================================

export type MenuAction =
  | 'copyCell'
  | 'copySelectionTsvHeader'
  | 'copySelectionTsvNoHeader'
  | 'copySelectionCsv'
  | 'copySelectionMarkdown'
  | 'copySelectionJson'
  | 'copySelectionInsert'
  | 'copyCurrentRow'
  | 'copyAllDisplayed'
  | 'copyAllFull'
  | 'copySelectedRowsAsTsv'
  | 'copySelectedRowsAsTsvWithHeader'
  | 'copySelectedRowsAsCsv'
  | 'copySelectedRowsAsCsvWithHeader'
  | 'copySelectedRowsAsMd'
  | 'copySelectedRowsAsMdWithHeader'
  | 'copySelectedRowsAsJson'
  | 'copySelectedRowsAsSqlInsert'
  | 'copySelectedColsAsTsv'
  | 'copySelectedColsAsTsvWithHeader'
  | 'copySelectedColsAsCsv'
  | 'copySelectedColsAsCsvWithHeader'
  | 'copySelectedColsAsMd'
  | 'copySelectedColsAsMdWithHeader'
  | 'copySelectedColsAsJson'
  | 'copySelectedColsAsSqlInsert'
  | 'exportCsv'
  | 'exportJson'
  | 'exportMarkdown'
  | 'exportSelectionCsv'
  | 'exportSelectionJson'
  | 'columnTogglePin'
  | 'columnHide'
  | 'columnAutoSizeThis'
  | 'columnAutoSizeAll'
  | 'columnShowAll'
  | 'columnResetLayout'
  | 'sortAsc'
  | 'sortDesc'
  | 'sortClear'
  | 'viewCellDetail';

export interface MenuItem {
  /** 已翻译的显示文本（调用方用 t() 翻译后传入） */
  label: string;
  icon?: string;
  /** 纯展示快捷键提示，如 'Ctrl+C' */
  shortcutHint?: string;
  disabled?: boolean;
  danger?: boolean;
  separatorBefore?: boolean;
  /** 是否为推荐项（高亮显示） */
  recommended?: boolean;
  /** 一级子菜单（不嵌套更深） */
  children?: MenuItem[];
  /** 菜单 action，用于统一分发 */
  action?: MenuAction;
  onClick?: () => void;
}

// ============================================================
// 右键菜单上下文
// ============================================================

export interface ContextMenuContext {
  /** 鼠标位置 */
  x: number;
  y: number;
  /** 右键所在行索引（displayRows 索引） */
  rowIndex: number | null;
  /** 右键所在列 colId */
  colId: string | null;
  /** 右键所在单元格的值 */
  cellValue: string | null;
  /** 右键所在列的表头名 */
  headerName: string | null;
  /** 菜单来源类型 */
  headerKind?: 'data' | 'row';
  /** 行号列单元格右键触发 */
  rowNumberCellClicked?: boolean;
  /** 列头单元格右键触发（由 handleColumnHeaderContextMenu 得到 headerKind=data） */
  columnCellClicked?: boolean;
}

// ============================================================
// Hook 返回类型
// ============================================================

export interface UseGridSelectionReturn {
  selection: SelectionState;
  cellClassRules: CellClassRules;
  handleCellMouseDown: (event: import('ag-grid-community').CellMouseDownEvent) => void;
  handleCellMouseOver: (event: import('ag-grid-community').CellMouseOverEvent) => void;
  handleCellClicked: (event: import('ag-grid-community').CellClickedEvent) => void;
  handleHeaderClicked: (event: import('ag-grid-community').ColumnHeaderClickedEvent) => void;
  handleCellFocused: (event: import('ag-grid-community').CellFocusedEvent) => void;
  handleKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  selectAll: () => void;
  selectRow: (rowIndex: number) => void;
  selectColumn: (colId: string) => void;
  selectCell: (rowIndex: number, colId: string) => void;
  isCellSelected: (rowIndex: number, colId: string) => boolean;
  clearSelection: () => void;
  getSelectedMatrix: () => Map<number, Set<string>> | null;
  hasSelection: boolean;
  selectionVersion: number;
  appendRow: (rowIndex: number) => void;
  extendRowsTo: (rowIndex: number) => void;
  appendColumn: (colId: string) => void;
  extendColumnsTo: (colId: string) => void;
  toggleColumn: (colId: string) => void;
  selectAllRows: () => void;
  appendAllRows: () => void;
  handleRowHeaderClicked: (event: { ctrlKey?: boolean; shiftKey?: boolean; metaKey?: boolean }) => void;
  handleColumnHeaderContextMenu: (event: unknown) => { headerKind: 'data'; colId: string } | null;
}

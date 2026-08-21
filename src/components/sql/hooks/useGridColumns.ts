/**
 * useGridColumns.ts — 列操作 hook
 *
 * 提供：
 * - 行号列定义（__rownum__，pinned left）
 * - 固定/取消固定列
 * - 隐藏/显示列
 * - 自动调整列宽（单列/全部）
 * - 重置列布局
 * - 列状态追踪（供右键菜单启用/禁用判断）
 *
 * 所有列操作使用 AG Grid Community API：
 * - setColumnsPinned / setColumnsVisible / autoSizeColumns / resetColumnState
 * - onColumnResized / onColumnPinned / onColumnVisible 事件镜像到 state
 */
import { useState, useCallback, useMemo } from 'react';
import type { GridApi, ColDef, CellClassRules } from 'ag-grid-community';
import type { ColumnTypeInfo } from '../../../utils/cellTypeDetection';
import { coerceCell } from '../../../utils/cellTypeDetection';
import GridHeaderCell from '../result-grid/GridHeaderCell';
import GridRowHeaderCell from '../result-grid/GridRowHeaderCell';

/** 行号列 colId */
export const ROWNUM_COL_ID = '__rownum__';

/** 列操作状态（用于菜单启用/禁用判断） */
export interface ColumnState {
  /** 被固定的列 colId 集合 */
  pinnedColumns: Set<string>;
  /** 被隐藏的列 colId 集合 */
  hiddenColumns: Set<string>;
  /** 是否有手动调整过列宽 */
  hasResized: boolean;
}

interface UseGridColumnsArgs {
  /** GridApi ref */
  apiRef: React.MutableRefObject<GridApi | null>;
  /** 列名数组 */
  columns: string[];
  /** 列类型信息数组 */
  columnTypes: ColumnTypeInfo[];
  /** 选区 cellClassRules（合并到列定义） */
  selectionCellClassRules?: CellClassRules;
  /** NULL 显示文本 */
  nullDisplayText?: string;
  /** 是否显示行号列 */
  showRowNumbers?: boolean;
}

export function useGridColumns({
  apiRef,
  columns,
  columnTypes,
  selectionCellClassRules,
  nullDisplayText = 'NULL',
  showRowNumbers = true,
}: UseGridColumnsArgs) {
  const [columnState, setColumnState] = useState<ColumnState>({
    pinnedColumns: new Set(),
    hiddenColumns: new Set(),
    hasResized: false,
  });

  // ===== 列定义构建 =====
  const columnDefs = useMemo<ColDef[]>(() => {
    const dataCols: ColDef[] = columns.map((col, i) => {
      // 合并选区高亮 + NULL 样式的 cellClassRules
      const nullClassRules: CellClassRules = {
        'rg-cell-null': (params) => {
          return params.value === null || params.value === undefined;
        },
      };

      const mergedClassRules: CellClassRules = {
        ...(selectionCellClassRules ?? {}),
        ...nullClassRules,
      };

      // valueFormatter: NULL 显示为 nullDisplayText
      const valueFormatter = (params: { value: string | number | boolean | null }) => {
        if (params.value === null || params.value === undefined) {
          return nullDisplayText;
        }
        return String(params.value);
      };

      return {
        field: `col${i}`,
        headerName: col,
        cellClassRules: mergedClassRules,
        valueFormatter,
        filter: false,
        sortable: false,
        headerComponent: GridHeaderCell as unknown as React.ComponentType,
        headerComponentParams: {},
      };
    });

    // 行号列（pinned left）
    if (showRowNumbers) {
      const rownumCol: ColDef = {
        colId: ROWNUM_COL_ID,
        headerName: '#',
        pinned: 'left',
        maxWidth: 56,
        sortable: false,
        filter: false,
        resizable: false,
        valueGetter: 'node.rowIndex + 1',
        cellClass: 'rg-rownum-cell',
        headerClass: 'rg-rownum-header',
        suppressMovable: true,
        headerComponent: GridRowHeaderCell as unknown as React.ComponentType,
      };
      return [rownumCol, ...dataCols];
    }

    return dataCols;
  }, [columns, selectionCellClassRules, nullDisplayText, showRowNumbers]);

  // ===== rowData 构建（含类型转换） =====
  const rowData = useMemo(() => {
    return (rows: string[][]) =>
      rows.map((row, rowIndex) => {
        const rowObj: Record<string, string | number | boolean | null> = { id: rowIndex };
        row.forEach((cell, colIndex) => {
          const colType = columnTypes[colIndex]?.type ?? 'string';
          rowObj[`col${colIndex}`] = coerceCell(cell, colType);
        });
        return rowObj;
      });
  }, [columnTypes]);

  // ===== 列操作 API =====

  /** 固定列到左侧 / 取消固定 */
  const togglePinColumn = useCallback((colId: string) => {
    const api = apiRef.current;
    if (!api) return;

    const isPinned = columnState.pinnedColumns.has(colId);
    api.setColumnsPinned([colId], isPinned ? null : 'left');

    setColumnState(prev => {
      const newPinned = new Set(prev.pinnedColumns);
      if (isPinned) {
        newPinned.delete(colId);
      } else {
        newPinned.add(colId);
      }
      return { ...prev, pinnedColumns: newPinned };
    });
  }, [apiRef, columnState.pinnedColumns]);

  /** 隐藏列 */
  const hideColumn = useCallback((colId: string) => {
    const api = apiRef.current;
    if (!api) return;

    api.setColumnsVisible([colId], false);

    setColumnState(prev => {
      const newHidden = new Set(prev.hiddenColumns);
      newHidden.add(colId);
      return { ...prev, hiddenColumns: newHidden };
    });
  }, [apiRef]);

  /** 显示所有列 */
  const showAllColumns = useCallback(() => {
    const api = apiRef.current;
    if (!api) return;

    // 获取所有列（含隐藏），设为可见
    const allCols = api.getColumns();
    if (!allCols) return;
    const colIds = allCols.map(c => c.getColId()).filter(id => id !== ROWNUM_COL_ID);
    api.setColumnsVisible(colIds, true);

    setColumnState(prev => ({ ...prev, hiddenColumns: new Set() }));
  }, [apiRef]);

  /** 自动调整单列宽 */
  const autoSizeColumn = useCallback((colId: string) => {
    const api = apiRef.current;
    if (!api) return;
    api.autoSizeColumns([colId]);
  }, [apiRef]);

  /** 自动调整所有列宽 */
  const autoSizeAllColumns = useCallback(() => {
    const api = apiRef.current;
    if (!api) return;
    const allCols = api.getColumns();
    if (!allCols) return;
    const colIds = allCols.map(c => c.getColId());
    api.autoSizeColumns(colIds);
  }, [apiRef]);

  /** 重置列布局（固定/隐藏/列宽全部恢复默认） */
  const resetColumnLayout = useCallback(() => {
    const api = apiRef.current;
    if (!api) return;
    api.resetColumnState();

    setColumnState({
      pinnedColumns: new Set(),
      hiddenColumns: new Set(),
      hasResized: false,
    });
  }, [apiRef]);

  // ===== 排序操作 =====

  /** 设置列排序 */
  const setColumnSort = useCallback((colId: string, sort: 'asc' | 'desc' | null) => {
    const api = apiRef.current;
    if (!api) return;
    api.applyColumnState({
      state: sort ? [{ colId, sort }] : [{ colId, sort: null }],
      defaultState: { sort: null },
    });
  }, [apiRef]);

  // ===== 事件处理（状态镜像） =====

  /** 列宽调整事件 → 标记 hasResized */
  const onColumnResized = useCallback(() => {
    setColumnState(prev => prev.hasResized ? prev : { ...prev, hasResized: true });
  }, []);

  /** 列固定事件 → 更新 pinnedColumns */
  const onColumnPinned = useCallback((event: { columns?: { getColId: () => string }[]; pinned?: string | null }) => {
    if (!event.columns) return;
    setColumnState(prev => {
      const newPinned = new Set(prev.pinnedColumns);
      for (const col of event.columns!) {
        const colId = col.getColId();
        if (colId === ROWNUM_COL_ID) continue;
        if (event.pinned) {
          newPinned.add(colId);
        } else {
          newPinned.delete(colId);
        }
      }
      return { ...prev, pinnedColumns: newPinned };
    });
  }, []);

  /** 列可见性事件 → 更新 hiddenColumns */
  const onColumnVisible = useCallback((event: { columns?: { getColId: () => string }[]; visible?: boolean }) => {
    if (!event.columns) return;
    setColumnState(prev => {
      const newHidden = new Set(prev.hiddenColumns);
      for (const col of event.columns!) {
        const colId = col.getColId();
        if (colId === ROWNUM_COL_ID) continue;
        if (event.visible) {
          newHidden.delete(colId);
        } else {
          newHidden.add(colId);
        }
      }
      return { ...prev, hiddenColumns: newHidden };
    });
  }, []);

  // ===== 菜单状态判断 =====

  /** 是否有隐藏列 */
  const hasHiddenColumns = columnState.hiddenColumns.size > 0;
  /** 是否有列被固定或隐藏或调整过宽度 */
  const hasLayoutChanges = columnState.pinnedColumns.size > 0
    || columnState.hiddenColumns.size > 0
    || columnState.hasResized;
  /** 可见列数（不含行号列） */
  const visibleColumnCount = columns.length - columnState.hiddenColumns.size;

  return {
    columnDefs,
    rowData,
    columnState,
    togglePinColumn,
    hideColumn,
    showAllColumns,
    autoSizeColumn,
    autoSizeAllColumns,
    resetColumnLayout,
    setColumnSort,
    onColumnResized,
    onColumnPinned,
    onColumnVisible,
    hasHiddenColumns,
    hasLayoutChanges,
    visibleColumnCount,
  };
}

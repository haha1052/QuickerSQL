/**
 * useGridSelection.ts — 自研矩形选区引擎
 *
 * 基于 AG Grid Community 事件实现：
 * - 鼠标拖选、Shift 扩选、Ctrl 多块选区
 * - 行号列点选整行、Ctrl+表头选整列
 * - 方向键移动活动格、Shift+方向键扩选
 * - Ctrl+A 全选、Ctrl+C 复制、Escape 清空
 *
 * 选区模型为唯一真源（移除 ag-grid 原生 rowSelection）。
 * 选区基于 displayRows 索引，翻页/数据替换时清空。
 */
import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import type {
  GridApi,
  CellMouseDownEvent,
  CellMouseOverEvent,
  CellFocusedEvent,
  ColumnHeaderClickedEvent,
  CellClassRules,
  CellClassParams,
} from 'ag-grid-community';
import type { SelectionState, RectRange, UseGridSelectionReturn } from '../result-grid/types';

// 内部 colId
const ROWNUM_COL_ID = '__rownum__';

/**
 * 将两个 colId 归一化为 [靠前的, 靠后的]。
 * 需要列顺序信息（allColIds）来判断先后。
 */
function normalizeColIds(
  colIdA: string,
  colIdB: string,
  allColIds: string[],
): [string, string] {
  const idxA = allColIds.indexOf(colIdA);
  const idxB = allColIds.indexOf(colIdB);
  if (idxA === -1 || idxB === -1) return [colIdA, colIdB];
  return idxA <= idxB ? [colIdA, colIdB] : [colIdB, colIdA];
}

/**
 * 将 RectRange 展开为 Set<colId>（该范围内的所有列）。
 */
function rangeToColSet(range: RectRange, allColIds: string[]): Set<string> {
  const startIdx = allColIds.indexOf(range.colIds[0]);
  const endIdx = allColIds.indexOf(range.colIds[1]);
  if (startIdx === -1 || endIdx === -1) return new Set();
  const lo = Math.min(startIdx, endIdx);
  const hi = Math.max(startIdx, endIdx);
  const set = new Set<string>();
  for (let i = lo; i <= hi; i++) {
    set.add(allColIds[i]);
  }
  return set;
}

/**
 * 将所有 ranges 展开为矩阵 Map<rowIndex, Set<colId>>。
 */
export function rangesToMatrix(
  ranges: RectRange[],
  allColIds: string[],
): Map<number, Set<string>> {
  const matrix = new Map<number, Set<string>>();
  for (const range of ranges) {
    const colSet = rangeToColSet(range, allColIds);
    const rowLo = Math.min(range.rowStart, range.rowEnd);
    const rowHi = Math.max(range.rowStart, range.rowEnd);
    for (let r = rowLo; r <= rowHi; r++) {
      if (!matrix.has(r)) {
        matrix.set(r, new Set());
      }
      const existing = matrix.get(r)!;
      for (const colId of colSet) {
        existing.add(colId);
      }
    }
  }
  return matrix;
}

/**
 * 从 ranges 计算需要刷新的行索引集合（新旧合并）。
 */
function getAffectedRows(
  oldRanges: RectRange[],
  newRanges: RectRange[],
): Set<number> {
  const rows = new Set<number>();
  for (const r of [...oldRanges, ...newRanges]) {
    const lo = Math.min(r.rowStart, r.rowEnd);
    const hi = Math.max(r.rowStart, r.rowEnd);
    for (let i = lo; i <= hi; i++) rows.add(i);
  }
  return rows;
}

export function useGridSelection(
  apiRef: React.MutableRefObject<GridApi | null>,
  allColIds: string[],
  rowCount: number,
): UseGridSelectionReturn {
  const [selection, setSelection] = useState<SelectionState>({
    ranges: [],
    anchor: null,
    active: null,
  });
  const [selectionVersion, setSelectionVersion] = useState(0);

  // 拖选状态
  const isDraggingRef = useRef(false);
  const dragModifierRef = useRef<'none' | 'ctrl' | 'shift'>('none');

  // 缓存上一次选区用于差异刷新
  const prevRangesRef = useRef<RectRange[]>([]);

  // 用于 cellClassRules 的 matrix（每次 selectionVersion 变化时重新计算）
  const matrix = useMemo(() => {
    if (selection.ranges.length === 0) return null;
    return rangesToMatrix(selection.ranges, allColIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionVersion, allColIds.join(',')]);

  // 刷新受影响的行
  const refreshAffectedRows = useCallback(
    (oldRanges: RectRange[], newRanges: RectRange[]) => {
      const api = apiRef.current;
      if (!api) return;
      const affectedRows = getAffectedRows(oldRanges, newRanges);
      if (affectedRows.size === 0) return;
      const rowNodes = [];
      for (const idx of affectedRows) {
        const node = api.getDisplayedRowAtIndex(idx);
        if (node) rowNodes.push(node);
      }
      if (rowNodes.length > 0) {
        api.refreshCells({ rowNodes, force: true });
      }
    },
    [apiRef],
  );

  // 更新选区并刷新
  const updateSelection = useCallback(
    (updater: (prev: SelectionState) => SelectionState) => {
      setSelection(prev => {
        const next = updater(prev);
        refreshAffectedRows(prev.ranges, next.ranges);
        prevRangesRef.current = next.ranges;
        return next;
      });
      setSelectionVersion(v => v + 1);
    },
    [refreshAffectedRows],
  );

  // ===== 选区操作 =====

  const clearSelection = useCallback(() => {
    updateSelection(() => ({
      ranges: [],
      anchor: null,
      active: null,
    }));
  }, [updateSelection]);

  const selectAll = useCallback(() => {
    if (allColIds.length === 0 || rowCount === 0) return;
    const dataCols = allColIds.filter(c => c !== ROWNUM_COL_ID);
    if (dataCols.length === 0) return;
    updateSelection(() => ({
      ranges: [
        {
          rowStart: 0,
          rowEnd: rowCount - 1,
          colIds: [dataCols[0], dataCols[dataCols.length - 1]],
        },
      ],
      anchor: { rowIndex: 0, colId: dataCols[0] },
      active: { rowIndex: 0, colId: dataCols[0] },
    }));
  }, [allColIds, rowCount, updateSelection]);

  const selectRow = useCallback(
    (rowIndex: number) => {
      const dataCols = allColIds.filter(c => c !== ROWNUM_COL_ID);
      if (dataCols.length === 0) return;
      updateSelection(() => ({
        ranges: [
          {
            rowStart: rowIndex,
            rowEnd: rowIndex,
            colIds: [dataCols[0], dataCols[dataCols.length - 1]],
          },
        ],
        anchor: { rowIndex, colId: dataCols[0] },
        active: { rowIndex, colId: dataCols[0] },
      }));
    },
    [allColIds, updateSelection],
  );

  const selectColumn = useCallback(
    (colId: string) => {
      if (colId === ROWNUM_COL_ID || rowCount === 0) return;
      updateSelection(() => ({
        ranges: [
          {
            rowStart: 0,
            rowEnd: rowCount - 1,
            colIds: [colId, colId],
          },
        ],
        anchor: { rowIndex: 0, colId },
        active: { rowIndex: 0, colId },
      }));
    },
    [rowCount, updateSelection],
  );

  /** 选中单个单元格（清空之前选区），用于右键菜单定位 */
  const selectCell = useCallback(
    (rowIndex: number, colId: string) => {
      if (colId === ROWNUM_COL_ID) return;
      updateSelection(() => ({
        ranges: [
          { rowStart: rowIndex, rowEnd: rowIndex, colIds: [colId, colId] },
        ],
        anchor: { rowIndex, colId },
        active: { rowIndex, colId },
      }));
    },
    [updateSelection],
  );

  /** 检查某单元格是否在当前选区中 */
  const isCellSelected = useCallback(
    (rowIndex: number, colId: string): boolean => {
      if (!matrix || colId === ROWNUM_COL_ID) return false;
      return matrix.get(rowIndex)?.has(colId) ?? false;
    },
    [matrix],
  );

  // ===== 鼠标事件 =====

  const handleCellMouseDown = useCallback(
    (event: CellMouseDownEvent) => {
      const rowIndex = event.rowIndex;
      const colId = event.colDef.field || event.column.getColId();
      if (rowIndex === null || rowIndex === undefined || !colId) return;

      // 行号列：选整行
      if (colId === ROWNUM_COL_ID) {
        const modifier = event.event as MouseEvent | undefined;
        if (modifier?.shiftKey && selection.anchor) {
          // Shift+行号：连续多行
          const startRow = Math.min(selection.anchor.rowIndex, rowIndex);
          const endRow = Math.max(selection.anchor.rowIndex, rowIndex);
          const dataCols = allColIds.filter(c => c !== ROWNUM_COL_ID);
          if (dataCols.length === 0) return;
          updateSelection(prev => ({
            ranges: [
              {
                rowStart: startRow,
                rowEnd: endRow,
                colIds: [dataCols[0], dataCols[dataCols.length - 1]],
              },
            ],
            anchor: prev.anchor,
            active: { rowIndex, colId: dataCols[0] },
          }));
        } else if (modifier?.ctrlKey || modifier?.metaKey) {
          // Ctrl+行号：追加整行
          const dataCols = allColIds.filter(c => c !== ROWNUM_COL_ID);
          if (dataCols.length === 0) return;
          updateSelection(prev => ({
            ranges: [
              ...prev.ranges,
              {
                rowStart: rowIndex,
                rowEnd: rowIndex,
                colIds: [dataCols[0], dataCols[dataCols.length - 1]],
              },
            ],
            anchor: { rowIndex, colId: dataCols[0] },
            active: { rowIndex, colId: dataCols[0] },
          }));
        } else {
          selectRow(rowIndex);
        }
        return;
      }

      // 普通单元格
      const mouseEvent = event.event as MouseEvent | undefined;
      const isCtrl = mouseEvent?.ctrlKey || mouseEvent?.metaKey;
      const isShift = mouseEvent?.shiftKey;

      if (isShift && selection.anchor) {
        // Shift+单击：从 anchor 到当前格的矩形
        const normColIds = normalizeColIds(selection.anchor.colId, colId, allColIds);
        const startRow = Math.min(selection.anchor.rowIndex, rowIndex);
        const endRow = Math.max(selection.anchor.rowIndex, rowIndex);
        updateSelection(prev => ({
          ranges: [
            {
              rowStart: startRow,
              rowEnd: endRow,
              colIds: normColIds,
            },
          ],
          anchor: prev.anchor,
          active: { rowIndex, colId },
        }));
      } else if (isCtrl) {
        // Ctrl+单击：追加单格矩形
        isDraggingRef.current = true;
        dragModifierRef.current = 'ctrl';
        updateSelection(prev => ({
          ranges: [
            ...prev.ranges,
            { rowStart: rowIndex, rowEnd: rowIndex, colIds: [colId, colId] },
          ],
          anchor: { rowIndex, colId },
          active: { rowIndex, colId },
        }));
      } else {
        // 普通单击：清空选区，设该格为 anchor+active，开启拖选
        isDraggingRef.current = true;
        dragModifierRef.current = 'none';
        updateSelection(() => ({
          ranges: [
            { rowStart: rowIndex, rowEnd: rowIndex, colIds: [colId, colId] },
          ],
          anchor: { rowIndex, colId },
          active: { rowIndex, colId },
        }));
      }
    },
    [allColIds, selection.anchor, updateSelection, selectRow],
  );

  const handleCellMouseOver = useCallback(
    (event: CellMouseOverEvent) => {
      if (!isDraggingRef.current) return;
      const rowIndex = event.rowIndex;
      const colId = event.colDef.field || event.column.getColId();
      if (rowIndex === null || rowIndex === undefined || !colId) return;
      if (colId === ROWNUM_COL_ID) return;

      // 更新最后一个 range 的终点
      setSelection(prev => {
        if (prev.ranges.length === 0 || !prev.anchor) return prev;
        const lastRange = prev.ranges[prev.ranges.length - 1];
        const normColIds = normalizeColIds(prev.anchor.colId, colId, allColIds);
        const startRow = Math.min(prev.anchor.rowIndex, rowIndex);
        const endRow = Math.max(prev.anchor.rowIndex, rowIndex);

        // 如果 range 没变就不更新
        if (
          lastRange.rowStart === startRow &&
          lastRange.rowEnd === endRow &&
          lastRange.colIds[0] === normColIds[0] &&
          lastRange.colIds[1] === normColIds[1]
        ) {
          return prev;
        }

        const newRanges = [...prev.ranges];
        newRanges[newRanges.length - 1] = {
          rowStart: startRow,
          rowEnd: endRow,
          colIds: normColIds,
        };

        // 刷新受影响行
        const oldAffected = getAffectedRows([lastRange], []);
        const newAffected = getAffectedRows([newRanges[newRanges.length - 1]], []);
        const allAffected = new Set([...oldAffected, ...newAffected]);
        const api = apiRef.current;
        if (api) {
          const rowNodes = [];
          for (const idx of allAffected) {
            const node = api.getDisplayedRowAtIndex(idx);
            if (node) rowNodes.push(node);
          }
          if (rowNodes.length > 0) {
            api.refreshCells({ rowNodes, force: true });
          }
        }

        return { ...prev, ranges: newRanges, active: { rowIndex, colId } };
      });
      setSelectionVersion(v => v + 1);
    },
    [allColIds, apiRef],
  );

  // window mouseup 结束拖选
  useEffect(() => {
    const handleMouseUp = () => {
      isDraggingRef.current = false;
      dragModifierRef.current = 'none';
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const handleCellClicked = useCallback(() => {
    // mousedown 已处理选区，这里不需要额外操作
  }, []);

  const handleHeaderClicked = useCallback(
    (event: ColumnHeaderClickedEvent) => {
      const mouseEvent = (event as unknown as { event?: MouseEvent }).event;
      const col = event.column as { getColId?: () => string } | null;
      const colId = col?.getColId?.();
      if (!colId || colId === ROWNUM_COL_ID) return;

      const ctrl = mouseEvent?.ctrlKey ?? false;
      const meta = mouseEvent?.metaKey ?? false;
      const shift = mouseEvent?.shiftKey ?? false;

      if (!ctrl && !meta && !shift) {
        selectColumn(colId);
      } else if (shift) {
        if (rowCount === 0) return;
        if (!selection.anchor) return;
        const normColIds = normalizeColIds(selection.anchor.colId, colId, allColIds);
        updateSelection(prev => ({
          ranges: [
            {
              rowStart: 0,
              rowEnd: rowCount - 1,
              colIds: normColIds,
            },
          ],
          anchor: prev.anchor,
          active: { rowIndex: 0, colId },
        }));
      } else if (ctrl || meta) {
        updateSelection(prev => ({
          ranges: [
            ...prev.ranges,
            {
              rowStart: 0,
              rowEnd: rowCount - 1,
              colIds: [colId, colId],
            },
          ],
          anchor: { rowIndex: 0, colId },
          active: { rowIndex: 0, colId },
        }));
      }
    },
    [allColIds, rowCount, selection.anchor, selectColumn, updateSelection],
  );

  const appendRow = useCallback(
    (rowIndex: number) => {
      const dataCols = allColIds.filter(c => c !== ROWNUM_COL_ID);
      if (dataCols.length === 0) return;
      const firstDataCol = dataCols[0];
      updateSelection(prev => ({
        ranges: [
          ...prev.ranges,
          {
            rowStart: rowIndex,
            rowEnd: rowIndex,
            colIds: [dataCols[0], dataCols[dataCols.length - 1]],
          },
        ],
        anchor: { rowIndex, colId: firstDataCol },
        active: { rowIndex, colId: firstDataCol },
      }));
    },
    [allColIds, updateSelection],
  );

  const extendRowsTo = useCallback(
    (rowIndex: number) => {
      const dataCols = allColIds.filter(c => c !== ROWNUM_COL_ID);
      if (dataCols.length === 0) return;
      if (!selection.anchor) {
        selectRow(rowIndex);
        return;
      }
      const startRow = Math.min(selection.anchor.rowIndex, rowIndex);
      const endRow = Math.max(selection.anchor.rowIndex, rowIndex);
      updateSelection(prev => ({
        ranges: [
          {
            rowStart: startRow,
            rowEnd: endRow,
            colIds: [dataCols[0], dataCols[dataCols.length - 1]],
          },
        ],
        anchor: prev.anchor,
        active: { rowIndex, colId: dataCols[0] },
      }));
    },
    [allColIds, selection.anchor, selectRow, updateSelection],
  );

  const appendColumn = useCallback(
    (colId: string) => {
      if (colId === ROWNUM_COL_ID || rowCount === 0) return;
      updateSelection(prev => ({
        ranges: [
          ...prev.ranges,
          {
            rowStart: 0,
            rowEnd: rowCount - 1,
            colIds: [colId, colId],
          },
        ],
        anchor: { rowIndex: 0, colId },
        active: { rowIndex: 0, colId },
      }));
    },
    [rowCount, updateSelection],
  );

  const extendColumnsTo = useCallback(
    (colId: string) => {
      if (rowCount === 0) return;
      if (!selection.anchor?.colId) return;
      const normColIds = normalizeColIds(selection.anchor.colId, colId, allColIds);
      updateSelection(prev => ({
        ranges: [
          {
            rowStart: 0,
            rowEnd: rowCount - 1,
            colIds: normColIds,
          },
        ],
        anchor: prev.anchor,
        active: { rowIndex: 0, colId },
      }));
    },
    [allColIds, rowCount, selection.anchor, updateSelection],
  );

  const toggleColumn = useCallback(
    (colId: string) => {
      if (colId === ROWNUM_COL_ID || rowCount === 0) return;

      const isFullColSelected = (() => {
        if (!matrix) return false;
        for (let r = 0; r < rowCount; r++) {
          if (!matrix.get(r)?.has(colId)) return false;
        }
        return true;
      })();

      if (isFullColSelected) {
        const colIdx = allColIds.indexOf(colId);
        if (colIdx === -1) return;

        updateSelection(prev => {
          const newRanges: RectRange[] = [];
          for (const range of prev.ranges) {
            const startIdx = allColIds.indexOf(range.colIds[0]);
            const endIdx = allColIds.indexOf(range.colIds[1]);
            if (startIdx === -1 || endIdx === -1) {
              newRanges.push(range);
              continue;
            }
            const lo = Math.min(startIdx, endIdx);
            const hi = Math.max(startIdx, endIdx);

            if (colIdx < lo || colIdx > hi) {
              newRanges.push(range);
              continue;
            }

            if (lo === colIdx && hi === colIdx) {
              continue;
            }

            if (lo < colIdx && colIdx < hi) {
              newRanges.push({
                rowStart: range.rowStart,
                rowEnd: range.rowEnd,
                colIds: [allColIds[lo], allColIds[colIdx - 1]],
              });
              newRanges.push({
                rowStart: range.rowStart,
                rowEnd: range.rowEnd,
                colIds: [allColIds[colIdx + 1], allColIds[hi]],
              });
            } else if (lo === colIdx) {
              newRanges.push({
                rowStart: range.rowStart,
                rowEnd: range.rowEnd,
                colIds: [allColIds[colIdx + 1], allColIds[hi]],
              });
            } else if (hi === colIdx) {
              newRanges.push({
                rowStart: range.rowStart,
                rowEnd: range.rowEnd,
                colIds: [allColIds[lo], allColIds[colIdx - 1]],
              });
            }
          }
          return {
            ...prev,
            ranges: newRanges,
          };
        });
      } else {
        appendColumn(colId);
      }
    },
    [allColIds, appendColumn, matrix, rowCount, updateSelection],
  );

  const selectAllRows = useCallback(() => {
    selectAll();
  }, [selectAll]);

  const appendAllRows = useCallback(() => {
    if (allColIds.length === 0 || rowCount === 0) return;
    const dataCols = allColIds.filter(c => c !== ROWNUM_COL_ID);
    if (dataCols.length === 0) return;
    const firstCol = dataCols[0];
    const lastCol = dataCols[dataCols.length - 1];
    updateSelection(prev => ({
      ranges: [
        ...prev.ranges,
        {
          rowStart: 0,
          rowEnd: rowCount - 1,
          colIds: [firstCol, lastCol],
        },
      ],
      anchor: { rowIndex: 0, colId: firstCol },
      active: { rowIndex: 0, colId: firstCol },
    }));
  }, [allColIds, rowCount, updateSelection]);

  const handleRowHeaderClicked = useCallback(
    (event: { ctrlKey?: boolean; shiftKey?: boolean; metaKey?: boolean } | MouseEvent | React.MouseEvent) => {
      const ctrl = event.ctrlKey ?? false;
      const meta = event.metaKey ?? false;
      const shift = event.shiftKey ?? false;

      if (ctrl || meta) {
        appendAllRows();
      } else if (shift) {
        extendRowsTo(rowCount - 1);
      } else {
        selectAllRows();
      }
    },
    [appendAllRows, extendRowsTo, rowCount, selectAllRows],
  );

  const handleColumnHeaderContextMenu = useCallback(
    (event: unknown): { headerKind: 'data'; colId: string } | null => {
      const ev = event as { column?: { getColId?: () => string; colId?: string }; event?: MouseEvent } | undefined;
      const col = ev?.column;
      const colId = col?.getColId?.() ?? col?.colId;
      if (!colId || colId === ROWNUM_COL_ID) return null;

      const mouseEvent = ev?.event;
      const ctrl = mouseEvent?.ctrlKey ?? false;
      const meta = mouseEvent?.metaKey ?? false;
      const shift = mouseEvent?.shiftKey ?? false;

      const isFullColSelected = (() => {
        if (!matrix) return false;
        for (let r = 0; r < rowCount; r++) {
          if (!matrix.get(r)?.has(colId)) return false;
        }
        return true;
      })();

      if (!isFullColSelected) {
        if (ctrl || meta) {
          appendColumn(colId);
        } else if (shift) {
          extendColumnsTo(colId);
        } else {
          selectColumn(colId);
        }
      }

      return { headerKind: 'data' as const, colId };
    },
    [appendColumn, extendColumnsTo, matrix, rowCount, selectColumn],
  );

  const handleCellFocused = useCallback(
    (event: CellFocusedEvent) => {
      const rowIndex = event.rowIndex;
      // column 可能是 string（colId）或 Column 对象
      const col = event.column as string | { getColId?: () => string } | null;
      const colId = typeof col === 'string' ? col : col?.getColId?.();
      if (rowIndex === null || rowIndex === undefined || !colId) return;
      // 仅更新 active，不改选区（键盘导航不自动选区，需 Shift 才扩选）
      setSelection(prev => {
        if (prev.active?.rowIndex === rowIndex && prev.active?.colId === colId) {
          return prev;
        }
        return { ...prev, active: { rowIndex, colId } };
      });
    },
    [],
  );

  // ===== 键盘事件 =====

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const api = apiRef.current;
      if (!api) return;

      // Ctrl+A 全选
      if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
        event.preventDefault();
        selectAll();
        return;
      }

      // Ctrl+C 复制（由 useGridCopy 监听，这里不阻止默认行为）
      // Escape 清空选区
      if (event.key === 'Escape') {
        clearSelection();
        return;
      }

      // 方向键移动 active
      const active = selection.active;
      if (!active) return;

      const dataCols = allColIds.filter(c => c !== ROWNUM_COL_ID);
      if (dataCols.length === 0) return;
      const currentColIdx = dataCols.indexOf(active.colId);
      let newRow = active.rowIndex;
      let newColId = active.colId;

      switch (event.key) {
        case 'ArrowUp':
          newRow = Math.max(0, newRow - 1);
          break;
        case 'ArrowDown':
          newRow = Math.min(rowCount - 1, newRow + 1);
          break;
        case 'ArrowLeft':
          if (currentColIdx > 0) newColId = dataCols[currentColIdx - 1];
          break;
        case 'ArrowRight':
          if (currentColIdx < dataCols.length - 1) newColId = dataCols[currentColIdx + 1];
          break;
        default:
          return;
      }

      event.preventDefault();
      api.ensureIndexVisible(newRow);
      api.ensureColumnVisible(newColId);
      api.setFocusedCell(newRow, newColId);

      if (event.shiftKey && selection.anchor) {
        // Shift+方向键：扩选
        const normColIds = normalizeColIds(selection.anchor.colId, newColId, allColIds);
        const startRow = Math.min(selection.anchor.rowIndex, newRow);
        const endRow = Math.max(selection.anchor.rowIndex, newRow);
        updateSelection(prev => ({
          ranges: [
            { rowStart: startRow, rowEnd: endRow, colIds: normColIds },
          ],
          anchor: prev.anchor,
          active: { rowIndex: newRow, colId: newColId },
        }));
      } else {
        // 仅移动 active
        setSelection(prev => ({
          ...prev,
          active: { rowIndex: newRow, colId: newColId },
        }));
      }
    },
    [
      apiRef,
      allColIds,
      rowCount,
      selection.active,
      selection.anchor,
      selectAll,
      clearSelection,
      updateSelection,
    ],
  );

  // ===== cellClassRules =====

  const cellClassRules = useMemo<CellClassRules>(
    () => ({
      'rg-cell-selected': (params: CellClassParams) => {
        if (!matrix || params.rowIndex === null || params.rowIndex === undefined) return false;
        const colId = params.colDef.field;
        if (!colId) return false;
        return matrix.get(params.rowIndex)?.has(colId) ?? false;
      },
      'rg-cell-active': (params: CellClassParams) => {
        if (!selection.active || params.rowIndex === null || params.rowIndex === undefined) return false;
        const colId = params.colDef.field;
        if (!colId) return false;
        return (
          selection.active.rowIndex === params.rowIndex &&
          selection.active.colId === colId
        );
      },
    }),
    [matrix, selection.active],
  );

  // ===== 公共 API =====

  const getSelectedMatrix = useCallback(() => {
    if (selection.ranges.length === 0) return null;
    return rangesToMatrix(selection.ranges, allColIds);
  }, [selection.ranges, allColIds]);

  const hasSelection = selection.ranges.length > 0;

  return {
    selection,
    cellClassRules,
    handleCellMouseDown,
    handleCellMouseOver,
    handleCellClicked,
    handleHeaderClicked,
    handleCellFocused,
    handleKeyDown,
    selectAll,
    selectRow,
    selectColumn,
    selectCell,
    isCellSelected,
    clearSelection,
    getSelectedMatrix,
    hasSelection,
    selectionVersion,
    appendRow,
    extendRowsTo,
    appendColumn,
    extendColumnsTo,
    toggleColumn,
    selectAllRows,
    appendAllRows,
    handleRowHeaderClicked,
    handleColumnHeaderContextMenu,
  };
}

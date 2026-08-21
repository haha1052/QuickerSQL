/**
 * GridHeaderCell.tsx — 自定义列头组件（右侧独立排序按钮 + 无筛选按钮）
 *
 * 列头点击（不含排序按钮区域）：冒泡到 AG Grid onColumnHeaderClicked → selection.handleHeaderClicked 选列
 * 排序按钮点击：stopPropagation，通过 columnApi.applyColumnState 触发排序循环 asc→desc→null
 * 列头右键：dispatch CustomEvent 'grid:columnHeaderContextMenu' (payload: { colId, headerName, x, y, ctrlKey, shiftKey, metaKey })
 */
import React, { useCallback, useMemo } from 'react';
import type { Column } from 'ag-grid-community';
import { useLocale } from '../../../context/LocaleContext';

interface IHeaderParams {
  displayName: string;
  column: Column & {
    getColId: () => string;
    getSort: () => 'asc' | 'desc' | null;
    isSortAscending: () => boolean;
    isSortDescending: () => boolean;
  };
  columnApi: {
    applyColumnState: (params: {
      state: { colId: string; sort?: 'asc' | 'desc' | null }[];
      defaultState?: { sort?: null };
    }) => void;
  };
  progressSort?: (multiSort?: boolean) => void;
  localeText?: Record<string, string>;
}

export const GridHeaderCell: React.FC<IHeaderParams> = (params) => {
  const { displayName, column, columnApi } = params;
  const { t } = useLocale();
  const colId = column.getColId?.();

  const sortState = useMemo(() => column.getSort?.() ?? null, [column]);
  const nextSort = useMemo<'asc' | 'desc' | null>(() => {
    if (sortState === null) return 'asc';
    if (sortState === 'asc') return 'desc';
    return null;
  }, [sortState]);

  const onSortBtnClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      e.preventDefault();
      try {
        if (!colId) return;
        const state: { colId: string; sort: 'asc' | 'desc' | null }[] = [];
        if (nextSort !== null) {
          state.push({ colId, sort: nextSort });
        }
        columnApi.applyColumnState?.({
          state: state.map(s => ({ colId: s.colId, sort: s.sort })),
          defaultState: { sort: null },
        });
      } catch {
      }
    },
    [colId, columnApi, nextSort],
  );

  const onContextMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      document.dispatchEvent(
        new CustomEvent('grid:columnHeaderContextMenu', {
          detail: {
            colId,
            headerName: displayName,
            x: e.clientX,
            y: e.clientY,
            ctrlKey: e.ctrlKey,
            shiftKey: e.shiftKey,
            metaKey: e.metaKey,
          },
        }),
      );
    },
    [colId, displayName],
  );

  const sortKey = sortState === 'asc' ? 'asc' : sortState === 'desc' ? 'desc' : 'neutral';
  const tip = t(`grid.sort.tip.${sortKey}`);

  const icon = sortState === 'asc' ? '↑' : sortState === 'desc' ? '↓' : '⇅';

  return (
    <div
      className="rg-header-cell"
      onContextMenu={onContextMenu}
      title={tip}
    >
      <span className="rg-header-label" title={displayName}>{displayName}</span>
      <button
        type="button"
        className="rg-header-sort-btn"
        onClick={onSortBtnClick}
        aria-label={tip}
        title={tip}
        tabIndex={0}
      >
        <span aria-hidden>{icon}</span>
      </button>
    </div>
  );
};

export default GridHeaderCell;

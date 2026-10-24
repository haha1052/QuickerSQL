/**
 * ResultGrid.tsx — SQL 查询结果表格（交互增强版 Phase 2）
 *
 * 封装 AgGridLazy，集成：
 * - 自研矩形选区引擎（useGridSelection）
 * - 多格式复制引擎（useGridCopy + resultCopy.ts）
 * - 数据驱动右键菜单（ResultGridContextMenu）
 * - 键盘快捷键（Ctrl+A/Ctrl+C/方向键/Escape）
 * - 列操作（固定/隐藏/自动列宽/重置）（useGridColumns）
 * - 类型感知渲染（cellTypeDetection + coerceCell）
 * - NULL 灰色斜体显示
 * - 导出（全量/仅选区，CSV/JSON/Markdown）
 * - 单元格详情弹窗（Phase 3）
 */
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { GridApi, GridReadyEvent, CellContextMenuEvent, PaginationChangedEvent } from 'ag-grid-community';
import { AgGridLazy } from '../../common/AgGridLazy';
import { useGridSelection } from '../hooks/useGridSelection';
import { useGridCopy } from '../hooks/useGridCopy';
import { useGridColumns } from '../hooks/useGridColumns';
import { useLocale } from '../../../context/LocaleContext';
import { useSetting } from '../../../context/SettingsContext';
import { ResultGridContextMenu } from './ResultGridContextMenu';
import { CellDetailModal } from './CellDetailModal';
import type { MenuItem, ContextMenuContext, MenuAction } from './types';
import { detectColumnTypes } from '../../../utils/cellTypeDetection';
import { ROWNUM_COL_ID } from '../hooks/useGridColumns';
import './ResultGrid.css';

interface ResultGridProps {
  /** 列名 */
  columns: string[];
  /** 截断后的显示行 */
  displayRows: string[][];
  /** 完整行数据（复制全量用，不渲染） */
  fullRows: string[][];
  /** 完整结果总行数 */
  totalRows: number;
  /** SQL 语句（INSERT 表名提取） */
  statement: string;
  /** 显示行数（= displayRows.length，传入避免重算） */
  displayRowCount: number;
  /** 是否截断 */
  isTruncated: boolean;
  /** 是否超过 maxResultRows */
  isOverMaxResultRows: boolean;
  /** maxResultRows 设置值 */
  maxResultRows: number;
  /** 分页大小 */
  pageSize: number;
  /** 是否分页 */
  paginated: boolean;
  /** 总页数 */
  totalPages: number;
  /** 表格高度 */
  tableHeight: number;
  /** 字号（px） */
  fontSizeNum: number;
  /** 字体 */
  fontFamily: string;
  /** ag-grid localeText */
  localeText: Record<string, string>;
}

export const ResultGrid: React.FC<ResultGridProps> = ({
  columns,
  displayRows,
  fullRows,
  totalRows,
  statement,
  displayRowCount,
  isTruncated,
  isOverMaxResultRows,
  maxResultRows,
  pageSize,
  paginated,
  totalPages,
  tableHeight,
  fontSizeNum,
  fontFamily,
  localeText,
}) => {
  const { t } = useLocale();
  const apiRef = useRef<GridApi | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuContext | null>(null);
  const [cellDetail, setCellDetail] = useState<{ value: string | null; header: string | null } | null>(null);

  // Phase 3：从 SettingsContext 读取 NULL 显示文本和行号列开关
  const [nullDisplayRaw] = useSetting('sql', 'null_display');
  const [showRowNumbersRaw] = useSetting('sql', 'grid_row_numbers');
  const nullDisplayText = nullDisplayRaw || 'NULL';
  const showRowNumbers = showRowNumbersRaw === undefined ? true : showRowNumbersRaw === 'true';

  // 列 colId 列表（顺序固定，不含行号列）
  const allColIds = useMemo(
    () => columns.map((_, i) => `col${i}`),
    [columns],
  );

  // 类型探测
  const columnTypes = useMemo(
    () => detectColumnTypes(displayRows, columns.length),
    [displayRows, columns.length],
  );

  // 选区引擎
  const selection = useGridSelection(apiRef, allColIds, displayRowCount);

  // 复制 + 导出引擎
  const copy = useGridCopy({
    columns,
    displayRows,
    fullRows,
    statement,
    selection: {
      getSelectedMatrix: selection.getSelectedMatrix,
      hasSelection: selection.hasSelection,
    },
    columnCount: columns.length,
    rowCount: displayRowCount,
  });

  // 列操作引擎
  const gridColumns = useGridColumns({
    apiRef,
    columns,
    columnTypes,
    selectionCellClassRules: selection.cellClassRules,
    nullDisplayText,
    showRowNumbers,
  });

  // ===== rowData 构建（含类型转换） =====
  const rowData = useMemo(
    () => gridColumns.rowData(displayRows),
    [gridColumns, displayRows],
  );

  const defaultColDef = useMemo(
    () => ({
      filter: false,
      sortable: false,
      resizable: true,
      minWidth: 120,
    }),
    [],
  );

  const gridStyle = useMemo(
    () =>
      ({
        '--ag-font-size': `${fontSizeNum}px`,
        '--ag-font-family': fontFamily || 'Monaco, Menlo, "Ubuntu Mono", monospace',
      }) as React.CSSProperties,
    [fontSizeNum, fontFamily],
  );

  const getRowId = useMemo(
    () => (params: { data: { id: number } }) => String(params.data.id),
    [],
  );

  // ===== Grid 事件 =====
  const handleGridReady = useCallback((params: GridReadyEvent) => {
    apiRef.current = params.api;
  }, []);

  // ===== 关闭右键菜单 =====
  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // ===== 菜单 action 统一分发 =====
  const handleMenuClick = useCallback(async (action: MenuAction) => {
    switch (action) {
      case 'copyCell':
        if (contextMenu?.cellValue != null) {
          await copy.copyCell(contextMenu.cellValue);
        }
        break;
      case 'copySelectionTsvHeader': {
        const matrix = selection.getSelectedMatrix();
        if (matrix) await copy.copySelection(matrix, 'tsv');
        break;
      }
      case 'copySelectionTsvNoHeader': {
        const matrix = selection.getSelectedMatrix();
        if (matrix) await copy.copySelection(matrix, 'tsv');
        break;
      }
      case 'copySelectionCsv': {
        const matrix = selection.getSelectedMatrix();
        if (matrix) await copy.copySelection(matrix, 'csv');
        break;
      }
      case 'copySelectionMarkdown': {
        const matrix = selection.getSelectedMatrix();
        if (matrix) await copy.copySelection(matrix, 'markdown');
        break;
      }
      case 'copySelectionJson': {
        const matrix = selection.getSelectedMatrix();
        if (matrix) await copy.copySelection(matrix, 'json');
        break;
      }
      case 'copySelectionInsert': {
        const matrix = selection.getSelectedMatrix();
        if (matrix) await copy.copySelection(matrix, 'insert');
        break;
      }
      case 'copyCurrentRow':
        if (contextMenu?.rowIndex != null) {
          await copy.copyRow(contextMenu.rowIndex);
        }
        break;
      case 'copyAllDisplayed':
        await copy.copyAllDisplayed();
        break;
      case 'copyAllFull':
        await copy.copyAllFull();
        break;

      case 'copySelectedRowsAsTsv':
        await copy.copySelectedRows('tsv', false); break;
      case 'copySelectedRowsAsTsvWithHeader':
        await copy.copySelectedRows('tsv', true); break;
      case 'copySelectedRowsAsCsv':
        await copy.copySelectedRows('csv', false); break;
      case 'copySelectedRowsAsCsvWithHeader':
        await copy.copySelectedRows('csv', true); break;
      case 'copySelectedRowsAsMd':
        await copy.copySelectedRows('markdown', false); break;
      case 'copySelectedRowsAsMdWithHeader':
        await copy.copySelectedRows('markdown', true); break;
      case 'copySelectedRowsAsJson':
        await copy.copySelectedRows('json'); break;
      case 'copySelectedRowsAsSqlInsert':
        await copy.copySelectedRows('insert'); break;

      case 'copySelectedColsAsTsv':
        await copy.copySelectedCols('tsv', false); break;
      case 'copySelectedColsAsTsvWithHeader':
        await copy.copySelectedCols('tsv', true); break;
      case 'copySelectedColsAsCsv':
        await copy.copySelectedCols('csv', false); break;
      case 'copySelectedColsAsCsvWithHeader':
        await copy.copySelectedCols('csv', true); break;
      case 'copySelectedColsAsMd':
        await copy.copySelectedCols('markdown', false); break;
      case 'copySelectedColsAsMdWithHeader':
        await copy.copySelectedCols('markdown', true); break;
      case 'copySelectedColsAsJson':
        await copy.copySelectedCols('json'); break;
      case 'copySelectedColsAsSqlInsert':
        await copy.copySelectedCols('insert'); break;

      case 'exportCsv':
        await copy.exportToFile(
          { columns, rows: fullRows, statement, success: true, error: null, affected_rows: null, executionTimeMs: 0 },
          'csv',
        );
        break;
      case 'exportJson':
        await copy.exportToFile(
          { columns, rows: fullRows, statement, success: true, error: null, affected_rows: null, executionTimeMs: 0 },
          'json',
        );
        break;
      case 'exportMarkdown':
        await copy.exportToFile(
          { columns, rows: fullRows, statement, success: true, error: null, affected_rows: null, executionTimeMs: 0 },
          'markdown',
        );
        break;
      case 'exportSelectionCsv': {
        const matrix = selection.getSelectedMatrix();
        if (matrix) await copy.exportSelectionToFile(matrix, 'csv');
        break;
      }
      case 'exportSelectionJson': {
        const matrix = selection.getSelectedMatrix();
        if (matrix) await copy.exportSelectionToFile(matrix, 'json');
        break;
      }
      case 'columnTogglePin':
        if (contextMenu?.colId) gridColumns.togglePinColumn(contextMenu.colId);
        break;
      case 'columnHide':
        if (contextMenu?.colId) gridColumns.hideColumn(contextMenu.colId);
        break;
      case 'columnAutoSizeThis':
        if (contextMenu?.colId) gridColumns.autoSizeColumn(contextMenu.colId);
        break;
      case 'columnAutoSizeAll':
        gridColumns.autoSizeAllColumns();
        break;
      case 'columnShowAll':
        gridColumns.showAllColumns();
        break;
      case 'columnResetLayout':
        gridColumns.resetColumnLayout();
        break;
      case 'sortAsc':
        if (contextMenu?.colId) gridColumns.setColumnSort(contextMenu.colId, 'asc');
        break;
      case 'sortDesc':
        if (contextMenu?.colId) gridColumns.setColumnSort(contextMenu.colId, 'desc');
        break;
      case 'sortClear':
        if (contextMenu?.colId) gridColumns.setColumnSort(contextMenu.colId, null);
        break;
      case 'viewCellDetail':
        if (contextMenu?.cellValue != null) {
          setCellDetail({ value: contextMenu.cellValue, header: contextMenu.headerName });
        }
        break;
    }
    closeContextMenu();
  }, [contextMenu, copy, selection, gridColumns, columns, fullRows, statement, closeContextMenu]);

  const handleCellContextMenu = useCallback(
    (event: CellContextMenuEvent) => {
      const ev = event.event as MouseEvent | undefined;
      ev?.preventDefault?.();

      const rowIndex = event.rowIndex;
      const colId = event.colDef.field || event.column?.getColId() || null;
      const cellValue = event.value !== undefined && event.value !== null
        ? String(event.value)
        : null;
      const headerName = event.colDef.headerName || null;
      if (rowIndex === null || rowIndex === undefined) {
        return;
      }

      const isRowNumCell = colId === ROWNUM_COL_ID;

      if (isRowNumCell) {
        const rowCompletelyIn = (() => {
          const m = selection.getSelectedMatrix();
          if (!m) return false;
          const rowSet = m.get(rowIndex);
          if (!rowSet) return false;
          return allColIds.every(c => rowSet.has(c));
        })();

        const modifier = ev as MouseEvent | undefined;
        if (!rowCompletelyIn) {
          if (modifier?.ctrlKey || modifier?.metaKey) {
            selection.appendRow(rowIndex);
          } else if (modifier?.shiftKey) {
            selection.extendRowsTo(rowIndex);
          } else {
            selection.selectRow(rowIndex);
          }
        }

        closeContextMenu();
        setContextMenu({
          x: ev?.clientX ?? 0,
          y: ev?.clientY ?? 0,
          rowIndex,
          colId,
          cellValue,
          headerName,
          rowNumberCellClicked: true,
        });
        return;
      }

      if (colId && rowIndex >= 0) {
        const cellInSelection = selection.isCellSelected(rowIndex, colId);
        if (!cellInSelection) {
          selection.appendRow(rowIndex);
        }
      }

      closeContextMenu();
      setContextMenu({
        x: ev?.clientX ?? 0,
        y: ev?.clientY ?? 0,
        rowIndex,
        colId,
        cellValue,
        headerName,
      });
    },
    [allColIds, closeContextMenu, selection],
  );

  // ===== 键盘事件 =====
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // Ctrl+C 复制选区
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        const matrix = selection.getSelectedMatrix();
        if (matrix && matrix.size > 0) {
          e.preventDefault();
          void copy.copyFromKeyboard(matrix);
        }
        return;
      }
      // 其余交给选区引擎（Ctrl+A / Escape / 方向键）
      selection.handleKeyDown(e);
    },
    [selection, copy],
  );

  // ===== 翻页清空选区 =====
  const prevPageRef = useRef(0);
  const handlePaginationChanged = useCallback(
    (event: PaginationChangedEvent) => {
      const newPage = event.api.paginationGetCurrentPage();
      if (prevPageRef.current !== newPage) {
        prevPageRef.current = newPage;
        selection.clearSelection();
      }
    },
    [selection],
  );

  // ===== 数据替换时清空选区 =====
  useEffect(() => {
    selection.clearSelection();
    prevPageRef.current = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, displayRows]);

  // ===== 绑定列头/行头 CustomEvent（Task 2 dispatch 的事件） =====
  useEffect(() => {
    const onColumnHeaderContextMenu = ((e: CustomEvent) => {
      const d = e.detail as {
        colId?: string; headerName?: string; x?: number; y?: number;
        ctrlKey?: boolean; shiftKey?: boolean; metaKey?: boolean;
      };
      if (!d || d.x == null || d.y == null) return;
      selection.handleColumnHeaderContextMenu({
        column: d.colId ? { getColId: () => d.colId as string } : undefined,
        event: { ctrlKey: d.ctrlKey, shiftKey: d.shiftKey, metaKey: d.metaKey } as unknown as MouseEvent,
      });
      closeContextMenu();
      setContextMenu({
        x: d.x,
        y: d.y,
        rowIndex: null,
        colId: d.colId ?? null,
        cellValue: null,
        headerName: d.headerName ?? null,
        headerKind: 'data',
        columnCellClicked: true,
      });
    }) as EventListener;

    const onRowHeaderClicked = ((e: CustomEvent) => {
      const d = e.detail as { ctrlKey?: boolean; shiftKey?: boolean; metaKey?: boolean };
      selection.handleRowHeaderClicked({
        ctrlKey: d?.ctrlKey,
        shiftKey: d?.shiftKey,
        metaKey: d?.metaKey,
      });
    }) as EventListener;

    const onRowHeaderContextMenu = ((e: CustomEvent) => {
      const d = e.detail as { x?: number; y?: number; ctrlKey?: boolean; shiftKey?: boolean; metaKey?: boolean };
      if (!d || d.x == null || d.y == null) return;
      selection.selectAllRows();
      closeContextMenu();
      setContextMenu({
        x: d.x,
        y: d.y,
        rowIndex: null,
        colId: null,
        cellValue: null,
        headerName: '#',
        headerKind: 'row',
      });
    }) as EventListener;

    document.addEventListener('grid:columnHeaderContextMenu', onColumnHeaderContextMenu);
    document.addEventListener('grid:rowHeaderClicked', onRowHeaderClicked);
    document.addEventListener('grid:rowHeaderContextMenu', onRowHeaderContextMenu);

    return () => {
      document.removeEventListener('grid:columnHeaderContextMenu', onColumnHeaderContextMenu);
      document.removeEventListener('grid:rowHeaderClicked', onRowHeaderClicked);
      document.removeEventListener('grid:rowHeaderContextMenu', onRowHeaderContextMenu);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection]);

  // ===== 构建右键菜单树 =====
  const menuItems = useMemo<MenuItem[]>(() => {
    if (!contextMenu) return [];

    const hasSelection = selection.hasSelection;
    const matrix = selection.getSelectedMatrix();
    const contextRow = contextMenu.rowIndex;
    const contextColId = contextMenu.colId;
    const cellValue = contextMenu.cellValue;
    const showFullOption = totalRows > displayRowCount;
    const isRownumCol = contextColId === ROWNUM_COL_ID;

    const isColumnHeaderTrigger = contextMenu.headerKind === 'data' || contextMenu.columnCellClicked === true;
    const isRowHeaderTrigger = contextMenu.headerKind === 'row' || contextMenu.rowNumberCellClicked === true;

    const createMenuClick = (action: MenuAction) => () => { void handleMenuClick(action); };

    // === 复制为 ===
    const copyItems: MenuItem[] = [];

    if (cellValue !== null && cellValue !== undefined) {
      copyItems.push({
        label: t('grid.copy.cell'),
        action: 'copyCell',
        onClick: createMenuClick('copyCell'),
      });
    }

    if (hasSelection && matrix) {
      copyItems.push({ label: '', separatorBefore: true });
      copyItems.push({
        label: t('grid.copy.tsvHeader'),
        action: 'copySelectionTsvHeader',
        onClick: createMenuClick('copySelectionTsvHeader'),
      });
      copyItems.push({
        label: t('grid.copy.tsvNoHeader'),
        action: 'copySelectionTsvNoHeader',
        onClick: createMenuClick('copySelectionTsvNoHeader'),
      });
      copyItems.push({
        label: t('grid.copy.csv'),
        action: 'copySelectionCsv',
        onClick: createMenuClick('copySelectionCsv'),
      });
      copyItems.push({
        label: t('grid.copy.markdown'),
        action: 'copySelectionMarkdown',
        onClick: createMenuClick('copySelectionMarkdown'),
      });
      copyItems.push({
        label: t('grid.copy.json'),
        action: 'copySelectionJson',
        onClick: createMenuClick('copySelectionJson'),
      });
      copyItems.push({
        label: t('grid.copy.insert'),
        action: 'copySelectionInsert',
        onClick: createMenuClick('copySelectionInsert'),
      });
    }

    if (contextRow !== null) {
      copyItems.push({ label: '', separatorBefore: true });
      copyItems.push({
        label: t('grid.copy.currentRow'),
        action: 'copyCurrentRow',
        onClick: createMenuClick('copyCurrentRow'),
      });
    }

    // ======== 复制选中行 / 复制选中列 分组 ========
    if (hasSelection) {
      copyItems.push({ label: '', separatorBefore: true });

      const rowsChildren: MenuItem[] = [
        { label: t('grid.menu.tsvNoHeader'), action: 'copySelectedRowsAsTsv', onClick: createMenuClick('copySelectedRowsAsTsv') },
        { label: t('grid.menu.tsvWithHeader'), action: 'copySelectedRowsAsTsvWithHeader', onClick: createMenuClick('copySelectedRowsAsTsvWithHeader') },
        { label: t('grid.menu.csvNoHeader'), action: 'copySelectedRowsAsCsv', onClick: createMenuClick('copySelectedRowsAsCsv') },
        { label: t('grid.menu.csvWithHeader'), action: 'copySelectedRowsAsCsvWithHeader', onClick: createMenuClick('copySelectedRowsAsCsvWithHeader') },
        { label: t('grid.menu.mdNoHeader'), action: 'copySelectedRowsAsMd', onClick: createMenuClick('copySelectedRowsAsMd') },
        { label: t('grid.menu.mdWithHeader'), action: 'copySelectedRowsAsMdWithHeader', onClick: createMenuClick('copySelectedRowsAsMdWithHeader') },
        { label: 'JSON', action: 'copySelectedRowsAsJson', onClick: createMenuClick('copySelectedRowsAsJson') },
        { label: 'SQL INSERT', action: 'copySelectedRowsAsSqlInsert', onClick: createMenuClick('copySelectedRowsAsSqlInsert') },
      ];
      copyItems.push({
        label: t('grid.menu.copySelectedRowsLabel'),
        children: rowsChildren,
        recommended: isRowHeaderTrigger,
        disabled: !hasSelection,
      });

      const colsChildren: MenuItem[] = [
        { label: t('grid.menu.tsvNoHeader'), action: 'copySelectedColsAsTsv', onClick: createMenuClick('copySelectedColsAsTsv') },
        { label: t('grid.menu.tsvWithHeader'), action: 'copySelectedColsAsTsvWithHeader', onClick: createMenuClick('copySelectedColsAsTsvWithHeader') },
        { label: t('grid.menu.csvNoHeader'), action: 'copySelectedColsAsCsv', onClick: createMenuClick('copySelectedColsAsCsv') },
        { label: t('grid.menu.csvWithHeader'), action: 'copySelectedColsAsCsvWithHeader', onClick: createMenuClick('copySelectedColsAsCsvWithHeader') },
        { label: t('grid.menu.mdNoHeader'), action: 'copySelectedColsAsMd', onClick: createMenuClick('copySelectedColsAsMd') },
        { label: t('grid.menu.mdWithHeader'), action: 'copySelectedColsAsMdWithHeader', onClick: createMenuClick('copySelectedColsAsMdWithHeader') },
        { label: 'JSON', action: 'copySelectedColsAsJson', onClick: createMenuClick('copySelectedColsAsJson') },
        { label: 'SQL INSERT', action: 'copySelectedColsAsSqlInsert', onClick: createMenuClick('copySelectedColsAsSqlInsert') },
      ];
      copyItems.push({
        label: t('grid.menu.copySelectedColsLabel'),
        children: colsChildren,
        recommended: isColumnHeaderTrigger,
        disabled: !hasSelection,
      });
    } else {
      const rowsChildren: MenuItem[] = [
        { label: t('grid.menu.tsvNoHeader'), disabled: true, action: 'copySelectedRowsAsTsv', onClick: createMenuClick('copySelectedRowsAsTsv') },
        { label: t('grid.menu.tsvWithHeader'), disabled: true, action: 'copySelectedRowsAsTsvWithHeader', onClick: createMenuClick('copySelectedRowsAsTsvWithHeader') },
        { label: t('grid.menu.csvNoHeader'), disabled: true, action: 'copySelectedRowsAsCsv', onClick: createMenuClick('copySelectedRowsAsCsv') },
        { label: t('grid.menu.csvWithHeader'), disabled: true, action: 'copySelectedRowsAsCsvWithHeader', onClick: createMenuClick('copySelectedRowsAsCsvWithHeader') },
        { label: t('grid.menu.mdNoHeader'), disabled: true, action: 'copySelectedRowsAsMd', onClick: createMenuClick('copySelectedRowsAsMd') },
        { label: t('grid.menu.mdWithHeader'), disabled: true, action: 'copySelectedRowsAsMdWithHeader', onClick: createMenuClick('copySelectedRowsAsMdWithHeader') },
        { label: 'JSON', disabled: true, action: 'copySelectedRowsAsJson', onClick: createMenuClick('copySelectedRowsAsJson') },
        { label: 'SQL INSERT', disabled: true, action: 'copySelectedRowsAsSqlInsert', onClick: createMenuClick('copySelectedRowsAsSqlInsert') },
      ];
      copyItems.push({ label: '', separatorBefore: true });
      copyItems.push({
        label: t('grid.menu.copySelectedRowsLabel'),
        children: rowsChildren,
        disabled: true,
        recommended: isRowHeaderTrigger,
      });

      const colsChildren: MenuItem[] = [
        { label: t('grid.menu.tsvNoHeader'), disabled: true, action: 'copySelectedColsAsTsv', onClick: createMenuClick('copySelectedColsAsTsv') },
        { label: t('grid.menu.tsvWithHeader'), disabled: true, action: 'copySelectedColsAsTsvWithHeader', onClick: createMenuClick('copySelectedColsAsTsvWithHeader') },
        { label: t('grid.menu.csvNoHeader'), disabled: true, action: 'copySelectedColsAsCsv', onClick: createMenuClick('copySelectedColsAsCsv') },
        { label: t('grid.menu.csvWithHeader'), disabled: true, action: 'copySelectedColsAsCsvWithHeader', onClick: createMenuClick('copySelectedColsAsCsvWithHeader') },
        { label: t('grid.menu.mdNoHeader'), disabled: true, action: 'copySelectedColsAsMd', onClick: createMenuClick('copySelectedColsAsMd') },
        { label: t('grid.menu.mdWithHeader'), disabled: true, action: 'copySelectedColsAsMdWithHeader', onClick: createMenuClick('copySelectedColsAsMdWithHeader') },
        { label: 'JSON', disabled: true, action: 'copySelectedColsAsJson', onClick: createMenuClick('copySelectedColsAsJson') },
        { label: 'SQL INSERT', disabled: true, action: 'copySelectedColsAsSqlInsert', onClick: createMenuClick('copySelectedColsAsSqlInsert') },
      ];
      copyItems.push({
        label: t('grid.menu.copySelectedColsLabel'),
        children: colsChildren,
        disabled: true,
        recommended: isColumnHeaderTrigger,
      });
    }

    if (displayRowCount > 0) {
      copyItems.push({
        label: t('grid.copy.all'),
        separatorBefore: true,
        children: [
          {
            label: t('grid.copy.allDisplayed', { count: displayRowCount }),
            action: 'copyAllDisplayed',
            onClick: createMenuClick('copyAllDisplayed'),
          },
          ...(showFullOption
            ? [
                {
                  label: t('grid.copy.allFull', { count: totalRows }),
                  action: 'copyAllFull',
                  onClick: createMenuClick('copyAllFull'),
                } as MenuItem,
              ]
            : []),
        ],
      });
    }

    const menus: MenuItem[] = [{ label: t('grid.copy.menu'), children: copyItems }];

    const selectedRowsChildren: MenuItem[] = [
      { label: t('grid.menu.tsvNoHeader'), onClick: () => void copy.copySelectedRows('tsv', false) },
      { label: t('grid.menu.tsvWithHeader'), onClick: () => void copy.copySelectedRows('tsv', true) },
      { label: t('grid.menu.csvNoHeader'), onClick: () => void copy.copySelectedRows('csv', false) },
      { label: t('grid.menu.csvWithHeader'), onClick: () => void copy.copySelectedRows('csv', true) },
      { label: t('grid.menu.mdNoHeader'), onClick: () => void copy.copySelectedRows('markdown', false) },
      { label: t('grid.menu.mdWithHeader'), onClick: () => void copy.copySelectedRows('markdown', true) },
      { label: t('grid.menu.jsonFormat'), onClick: () => void copy.copySelectedRows('json', true) },
      { label: t('grid.menu.sqlInsert'), onClick: () => void copy.copySelectedRows('insert', true) },
    ];
    menus.push({
      label: t('grid.menu.selectedRows'),
      children: selectedRowsChildren,
      disabled: !hasSelection,
    });

    const selectedColsChildren: MenuItem[] = [
      { label: t('grid.menu.tsvNoHeader'), onClick: () => void copy.copySelectedCols('tsv', false) },
      { label: t('grid.menu.tsvWithHeader'), onClick: () => void copy.copySelectedCols('tsv', true) },
      { label: t('grid.menu.csvNoHeader'), onClick: () => void copy.copySelectedCols('csv', false) },
      { label: t('grid.menu.csvWithHeader'), onClick: () => void copy.copySelectedCols('csv', true) },
      { label: t('grid.menu.mdNoHeader'), onClick: () => void copy.copySelectedCols('markdown', false) },
      { label: t('grid.menu.mdWithHeader'), onClick: () => void copy.copySelectedCols('markdown', true) },
      { label: t('grid.menu.jsonFormat'), onClick: () => void copy.copySelectedCols('json', true) },
      { label: t('grid.menu.sqlInsert'), onClick: () => void copy.copySelectedCols('insert', true) },
    ];
    menus.push({
      label: t('grid.menu.selectedCols'),
      children: selectedColsChildren,
      disabled: !hasSelection,
    });

    // === 导出 ===
    const exportItems: MenuItem[] = [
      {
        label: t('grid.export.csv'),
        action: 'exportCsv',
        onClick: createMenuClick('exportCsv'),
      },
      {
        label: t('grid.export.json'),
        action: 'exportJson',
        onClick: createMenuClick('exportJson'),
      },
      {
        label: t('grid.export.markdown'),
        action: 'exportMarkdown',
        onClick: createMenuClick('exportMarkdown'),
      },
    ];

    if (hasSelection && matrix) {
      exportItems.push({ label: '', separatorBefore: true });
      exportItems.push({
        label: t('grid.export.selectionCsv'),
        action: 'exportSelectionCsv',
        onClick: createMenuClick('exportSelectionCsv'),
      });
      exportItems.push({
        label: t('grid.export.selectionJson'),
        action: 'exportSelectionJson',
        onClick: createMenuClick('exportSelectionJson'),
      });
    }

    menus.push({ label: t('grid.export.menu'), children: exportItems });

    // === 列操作（非行号列时显示） ===
    if (!isRownumCol && contextColId) {
      const isPinned = gridColumns.columnState.pinnedColumns.has(contextColId);
      const columnItems: MenuItem[] = [
        {
          label: isPinned ? t('grid.column.unpin') : t('grid.column.pinLeft'),
          action: 'columnTogglePin',
          onClick: createMenuClick('columnTogglePin'),
        },
        {
          label: t('grid.column.hide'),
          disabled: gridColumns.visibleColumnCount <= 1,
          action: 'columnHide',
          onClick: createMenuClick('columnHide'),
        },
        { label: '', separatorBefore: true },
        {
          label: t('grid.column.autoSizeThis'),
          action: 'columnAutoSizeThis',
          onClick: createMenuClick('columnAutoSizeThis'),
        },
        {
          label: t('grid.column.autoSizeAll'),
          action: 'columnAutoSizeAll',
          onClick: createMenuClick('columnAutoSizeAll'),
        },
      ];

      if (gridColumns.hasHiddenColumns) {
        columnItems.push({
          label: t('grid.column.showAll'),
          action: 'columnShowAll',
          onClick: createMenuClick('columnShowAll'),
        });
      }

      if (gridColumns.hasLayoutChanges) {
        columnItems.push({
          label: t('grid.column.resetLayout'),
          action: 'columnResetLayout',
          onClick: createMenuClick('columnResetLayout'),
        });
      }

      menus.push({ label: t('grid.column.menu'), children: columnItems });

      // === 排序 ===
      const sortItems: MenuItem[] = [
        {
          label: t('grid.sort.asc'),
          action: 'sortAsc',
          onClick: createMenuClick('sortAsc'),
        },
        {
          label: t('grid.sort.desc'),
          action: 'sortDesc',
          onClick: createMenuClick('sortDesc'),
        },
        {
          label: t('grid.sort.clear'),
          action: 'sortClear',
          onClick: createMenuClick('sortClear'),
        },
      ];

      menus.push({ label: t('grid.sort.menu'), children: sortItems });
    }

    // === 查看 ===
    if (cellValue !== null && cellValue !== undefined) {
      menus.push({
        label: t('grid.view.cellDetail'),
        action: 'viewCellDetail',
        onClick: createMenuClick('viewCellDetail'),
      });
    }

    return menus;
  }, [contextMenu, selection, handleMenuClick, gridColumns, t, totalRows, displayRowCount, columns, fullRows, statement]);

  return (
    <div
      className="rg-grid-wrapper"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className="rg-grid-container ag-theme-alpine"
        style={{ ...gridStyle, height: tableHeight }}
      >
        <AgGridLazy
          domLayout="normal"
          rowData={rowData}
          columnDefs={gridColumns.columnDefs}
          localeText={localeText}
          defaultColDef={defaultColDef}
          getRowId={getRowId}
          onGridReady={handleGridReady}
          onCellMouseDown={selection.handleCellMouseDown}
          onCellMouseOver={selection.handleCellMouseOver}
          onCellClicked={selection.handleCellClicked}
          onCellFocused={selection.handleCellFocused}
          onColumnHeaderClicked={selection.handleHeaderClicked}
          onCellContextMenu={handleCellContextMenu}
          onPaginationChanged={handlePaginationChanged}
          onColumnResized={gridColumns.onColumnResized}
          onColumnPinned={gridColumns.onColumnPinned}
          onColumnVisible={gridColumns.onColumnVisible}
          enableCellTextSelection={false}
          pagination={paginated}
          paginationPageSize={paginated ? pageSize : displayRowCount}
          suppressPaginationPanel={!paginated}
          animateRows={false}
          style={{ width: '100%', height: '100%', minHeight: 0 }}
        />
      </div>

      {/* 分页信息 */}
      <div className="rg-pagination-info">
        <span className="rg-page-text">
          {isTruncated
            ? t('grid.truncated', { displayed: displayRowCount, total: totalRows })
            : `${t('query.totalRows')}: ${totalRows} | ${t('query.page')} 1/${totalPages}`}
        </span>
      </div>

      {/* 超限警告 */}
      {isOverMaxResultRows && (
        <div className="rg-warning-info">
          <span className="rg-warning-text">
            {t('grid.warningOverLimit', { total: totalRows, max: maxResultRows })}
          </span>
        </div>
      )}

      {/* 右键菜单 */}
      {contextMenu && menuItems.length > 0 && (
        <ResultGridContextMenu
          items={menuItems}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={closeContextMenu}
        />
      )}

      {/* 单元格详情弹窗 */}
      {cellDetail && (
        <CellDetailModal
          value={cellDetail.value}
          header={cellDetail.header}
          onClose={() => setCellDetail(null)}
        />
      )}
    </div>
  );
};

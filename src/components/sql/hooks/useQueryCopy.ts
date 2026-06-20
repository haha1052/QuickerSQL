import { useState, useCallback } from 'react';
import { useAppStore } from '../../../store';
import { useLocale } from '../../../context/LocaleContext';
import type { GridApi, CellContextMenuEvent } from 'ag-grid-community';

type QueryRow = Record<string, string | number | boolean | null>;

interface ContextMenuState {
  x: number;
  y: number;
  rowData?: QueryRow;
  colData?: unknown;
  cellValue?: unknown;
  api?: GridApi;
}

export const useQueryCopy = () => {
  const { t } = useLocale();
  const { setMessage } = useAppStore();
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const handleCopyCell = useCallback((cellValue: unknown) => {
    if (cellValue !== undefined && cellValue !== null) {
      navigator.clipboard.writeText(String(cellValue))
        .then(() => {
          setMessage(t('hooks.copiedToClipboard'), 'success');
        })
        .catch((err: unknown) => {
          console.error(t('hooks.copyFail'), err);
          setMessage(t('hooks.copyFail'), 'error');
        });
    }
    setContextMenu(null);
  }, [t, setMessage]);

  const handleCopyRow = useCallback((rowData: unknown) => {
    if (rowData) {
      const values = Object.values(rowData).filter((v: unknown) => typeof v !== 'number' || !String(v).startsWith('col'));
      navigator.clipboard.writeText(values.join('\t'))
        .then(() => {
          setMessage(t('hooks.copiedRow'), 'success');
        })
        .catch((err: unknown) => {
          console.error(t('hooks.copyFail'), err);
          setMessage(t('hooks.copyFail'), 'error');
        });
    }
    setContextMenu(null);
  }, [t, setMessage]);

  const handleCopySelected = useCallback((api: GridApi) => {
    const selectedNodes = api.getSelectedNodes();
    if (selectedNodes.length === 0) {
      setMessage(t('hooks.selectRowsFirst'), 'warning');
      setContextMenu(null);
      return;
    }

    const columns = api.getColumns() || [];
    const filteredColumns = columns.filter((col) => col.getColId() !== 'id');
    const header = filteredColumns.map((col) => col.getColDef().headerName).join('\t');
    
    const rows = selectedNodes.map((node) => {
      return filteredColumns.map((col) => String(node.data?.[col.getColId()] ?? '')).join('\t');
    });
    
    const text = [header, ...rows].join('\n');
    navigator.clipboard.writeText(text)
      .then(() => {
        setMessage(`${t('hooks.copiedRows').replace('{count}', String(selectedNodes.length))}`, 'success');
      })
      .catch((err: unknown) => {
        console.error(t('hooks.copyFail'), err);
        setMessage(t('hooks.copyFail'), 'error');
      });
    setContextMenu(null);
  }, [t, setMessage]);

  const handleCopyAll = useCallback((api: GridApi) => {
    const columns = api.getColumns() || [];
    const filteredColumns = columns.filter((col) => col.getColId() !== 'id');
    const header = filteredColumns.map((col) => col.getColDef().headerName).join('\t');
    
    const rows: string[] = [];
    api.forEachNode((node) => {
      const row = filteredColumns.map((col) => String(node.data?.[col.getColId()] ?? '')).join('\t');
      rows.push(row);
    });
    
    const text = [header, ...rows].join('\n');
    navigator.clipboard.writeText(text)
      .then(() => {
        setMessage(`${t('hooks.copiedAllRows').replace('{count}', String(rows.length))}`, 'success');
      })
      .catch((err: unknown) => {
        console.error(t('hooks.copyFail'), err);
        setMessage(t('hooks.copyFail'), 'error');
      });
    setContextMenu(null);
  }, [t, setMessage]);

  const handleGridContextMenu = useCallback((event: CellContextMenuEvent) => {
    const ev = event.event as MouseEvent | undefined;
    ev?.preventDefault?.();
    setContextMenu({
      x: ev?.clientX ?? 0,
      y: ev?.clientY ?? 0,
      rowData: event.data as QueryRow | undefined,
      colData: event.column,
      cellValue: event.value,
      api: event.api as GridApi,
    });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  return {
    contextMenu,
    setContextMenu,
    handleCopyCell,
    handleCopyRow,
    handleCopySelected,
    handleCopyAll,
    handleGridContextMenu,
    closeContextMenu,
  };
};

import { useState, useCallback } from 'react';
import { useAppStore } from '../../../store';
import { useLocale } from '../../../context/LocaleContext';
import type { GridApi } from 'ag-grid-community';

interface ContextMenuState {
  x: number;
  y: number;
  rowData?: any;
  colData?: any;
  cellValue?: any;
  api?: GridApi;
}

export const useQueryCopy = () => {
  const { t } = useLocale();
  const { setMessage } = useAppStore();
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const handleCopyCell = useCallback((cellValue: any) => {
    if (cellValue !== undefined && cellValue !== null) {
      navigator.clipboard.writeText(String(cellValue))
        .then(() => {
          setMessage(t('hooks.copiedToClipboard'), 'success');
        })
        .catch((err) => {
          console.error(t('hooks.copyFail'), err);
          setMessage(t('hooks.copyFail'), 'error');
        });
    }
    setContextMenu(null);
  }, [t, setMessage]);

  const handleCopyRow = useCallback((rowData: any) => {
    if (rowData) {
      const values = Object.values(rowData).filter((v: any) => typeof v !== 'number' || !String(v).startsWith('col'));
      navigator.clipboard.writeText(values.join('\t'))
        .then(() => {
          setMessage(t('hooks.copiedRow'), 'success');
        })
        .catch((err) => {
          console.error(t('hooks.copyFail'), err);
          setMessage(t('hooks.copyFail'), 'error');
        });
    }
    setContextMenu(null);
  }, [t, setMessage]);

  const handleCopySelected = useCallback((api: GridApi<any>) => {
    const selectedNodes = api.getSelectedNodes();
    if (selectedNodes.length === 0) {
      setMessage(t('hooks.selectRowsFirst'), 'warning');
      setContextMenu(null);
      return;
    }

    const columns = api.getColumns() || [];
    const filteredColumns = columns.filter((col: any) => col.getColId() !== 'id');
    const header = filteredColumns.map((col: any) => col.getColDef().headerName).join('\t');
    
    const rows = selectedNodes.map((node: any) => {
      return filteredColumns.map((col: any) => String(node.data[col.getColId()] || '')).join('\t');
    });
    
    const text = [header, ...rows].join('\n');
    navigator.clipboard.writeText(text)
      .then(() => {
        setMessage(`${t('hooks.copiedRows').replace('{count}', String(selectedNodes.length))}`, 'success');
      })
      .catch((err) => {
        console.error(t('hooks.copyFail'), err);
        setMessage(t('hooks.copyFail'), 'error');
      });
    setContextMenu(null);
  }, [t, setMessage]);

  const handleCopyAll = useCallback((api: GridApi<any>) => {
    const columns = api.getColumns() || [];
    const filteredColumns = columns.filter((col: any) => col.getColId() !== 'id');
    const header = filteredColumns.map((col: any) => col.getColDef().headerName).join('\t');
    
    const rows: string[] = [];
    api.forEachNode((node: any) => {
      const row = filteredColumns.map((col: any) => String(node.data[col.getColId()] || '')).join('\t');
      rows.push(row);
    });
    
    const text = [header, ...rows].join('\n');
    navigator.clipboard.writeText(text)
      .then(() => {
        setMessage(`${t('hooks.copiedAllRows').replace('{count}', String(rows.length))}`, 'success');
      })
      .catch((err) => {
        console.error(t('hooks.copyFail'), err);
        setMessage(t('hooks.copyFail'), 'error');
      });
    setContextMenu(null);
  }, [t, setMessage]);

  const handleGridContextMenu = useCallback((params: any) => {
    params.event.preventDefault();
    setContextMenu({
      x: params.event.clientX,
      y: params.event.clientY,
      rowData: params.data,
      colData: params.column,
      cellValue: params.value,
      api: params.api,
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

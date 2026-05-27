import React from 'react';
import { open, save } from '@tauri-apps/plugin-dialog';
import type { TabType } from '../../types';
import {
  PlusIcon,
  FolderOpenIcon,
  SaveIcon,
  PlayIcon,
  DownloadIcon,
  RefreshCwIcon,
  DatabaseIcon,
  FilePlusIcon,
  CheckSquareIcon,
  GridIcon,
  TrashIcon
} from './Icons';
import { useAppStore, useWorkspaceStore, useImportStore, useQueryStore } from '../../store';
import { tauriService } from '../../services';
import type { WorkspaceTabType, ImportItem } from '../../types';

interface ToolbarProps {
  activeTab: TabType;
  onAddFile?: () => void;
  onBatchImport?: () => void;
  onClearQueue?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  activeTab,
  onAddFile: _onAddFile, // 未使用的参数
  onBatchImport,
  onClearQueue,
}) => {
  const { setMessage, setAllDatabaseStatus } = useAppStore();
  const { addTab } = useWorkspaceStore();
  const { importItems, toggleAllSelected, hasHeader, setHasHeader, updateImportItem, addImportItems, setActiveImportItemId } = useImportStore();

  const selectedCount = importItems.filter(i => i.selected && !i.isParent).length;
  const hasItems = importItems.length > 0;

  const generateTableName = (fileName: string, sheetName?: string): string => {
    const baseName = fileName.replace(/\.(csv|xlsx?|xls)$/i, '');
    if (sheetName) {
      return `${baseName}_${sheetName}`;
    }
    return baseName;
  };

  const loadCsvFile = async (filePath: string, fileName: string): Promise<ImportItem | null> => {
    try {
      const response = await tauriService.loadCsv(filePath);
      if (response.success && response.data) {
        const id = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        return {
          id,
          fileType: 'csv',
          filePath,
          fileName,
          preview: {
            headers: response.data.headers,
            rows: response.data.rows,
          },
          hasHeader: true,
          tableName: generateTableName(fileName),
          fields: response.data.headers.map((name: string) => ({
            name,
            dataType: 'TEXT' as const,
          })),
          selected: true,
          status: 'idle',
          isParent: false,
        };
      }
    } catch (e) {
      setMessage(`加载 CSV 文件失败: ${String(e)}`, 'error');
    }
    return null;
  };

  const loadExcelFile = async (filePath: string, fileName: string): Promise<ImportItem[]> => {
    try {
      const sheetsResponse = await tauriService.getExcelSheets(filePath);
      if (!sheetsResponse.success || !sheetsResponse.data) {
        setMessage('获取 Excel Sheet 列表失败', 'error');
        return [];
      }

      const parentId = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const items: ImportItem[] = [];
      
      for (const sheet of sheetsResponse.data.sheets) {
        const sheetName = typeof sheet === 'string' ? sheet : sheet.name;
        const previewResponse = await tauriService.loadExcelSheet(filePath, sheetName);
        if (previewResponse.success && previewResponse.data) {
          const sheetId = `${parentId}_${sheetName}`;
          items.push({
            id: sheetId,
            fileType: 'excel',
            filePath,
            fileName,
            sheetName,
            preview: {
              headers: previewResponse.data.headers,
              rows: previewResponse.data.rows,
            },
            hasHeader: true,
            tableName: generateTableName(fileName, sheetName),
            fields: previewResponse.data.headers.map((name: string) => ({
              name,
              dataType: 'TEXT' as const,
            })),
            selected: true,
            status: 'idle',
            parentId,
            isParent: false,
          });
        }
      }

      if (items.length > 0) {
        items.unshift({
          id: parentId,
          fileType: 'excel',
          filePath,
          fileName,
          preview: {
            headers: [],
            rows: [],
          },
          hasHeader: true,
          tableName: generateTableName(fileName),
          fields: [],
          selected: false,
          status: 'idle',
          isParent: true,
          sheets: sheetsResponse.data.sheets.map((s: any) => typeof s === 'string' ? s : s.name),
          isExpanded: true,
        });
      }

      return items;
    } catch (e) {
      setMessage(`加载 Excel 文件失败: ${String(e)}`, 'error');
      return [];
    }
  };

  const handleAddFiles = async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: '数据文件',
            extensions: ['csv', 'xlsx', 'xls'],
          },
        ],
      });

      if (!selected) return;

      const files = Array.isArray(selected) ? selected : [selected];
      const newItems: ImportItem[] = [];

      for (const filePath of files) {
        const fileName = filePath.split(/[\\/]/).pop() || 'unknown';
        const extension = fileName.split('.').pop()?.toLowerCase();

        if (extension === 'csv') {
          const item = await loadCsvFile(filePath, fileName);
          if (item) newItems.push(item);
        } else if (['xlsx', 'xls'].includes(extension || '')) {
          const items = await loadExcelFile(filePath, fileName);
          newItems.push(...items);
        }
      }

      if (newItems.length > 0) {
        addImportItems(newItems);
        const selectableItems = newItems.filter(i => !i.isParent);
        if (selectableItems.length > 0) {
          setActiveImportItemId(selectableItems[0].id);
        }
        setMessage(`已添加 ${newItems.filter(i => !i.isParent).length} 个文件`, 'success');
      }
    } catch (e) {
      setMessage(`选择文件失败: ${String(e)}`, 'error');
    }
  };

  const handleNewSqlTab = () => {
    addTab({
      title: `SQL Query ${Date.now()}`,
      type: 'sql' as WorkspaceTabType,
      panels: [
        {
          id: 'editor',
          type: 'sql_editor',
          title: 'SQL Editor',
          size: 50,
          active: true,
          content: null,
        },
        {
          id: 'results',
          type: 'results_grid',
          title: 'Results',
          size: 50,
          active: true,
          content: null,
        },
      ],
      active: true,
    });
  };

  const handleRefresh = async () => {
    const response = await tauriService.getDatabaseStatus();
    if (response.success && response.data) {
      setAllDatabaseStatus([response.data]);
      setMessage('数据库状态已刷新', 'success');
    }
  };

  const handleRunQuery = async () => {
    const { sqlQueries, activeQueryId } = useQueryStore.getState();
    const activeQuery = sqlQueries.find((q: any) => q.id === activeQueryId);
    
    if (!activeQuery || !activeQuery.sql.trim()) {
      setMessage('请输入SQL查询语句', 'warning');
      return;
    }

    try {
      const response = await tauriService.executeSql(activeQuery.sql);
      
      if (response.success && response.data) {
        setMessage('查询成功', 'success');
        
        const { setBatchResults, addToHistory } = useQueryStore.getState();
        setBatchResults(activeQueryId, response.data.results);
        
        // 添加到查询历史
        const firstResult = response.data.results[0];
        const rowCount = firstResult?.rows?.length;
        addToHistory(activeQuery.sql, true, rowCount);
      } else {
        setMessage(`查询失败: ${response.error}`, 'error');
        
        const { addToHistory } = useQueryStore.getState();
        addToHistory(activeQuery.sql, false);
      }
    } catch (e) {
      setMessage(`查询失败: ${String(e)}`, 'error');
      
      const { addToHistory } = useQueryStore.getState();
      addToHistory(activeQuery.sql, false);
    }
  };

  const handleOpenFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: 'SQL文件',
            extensions: ['sql'],
          },
        ],
      });

      if (selected) {
        const { invoke } = await import('@tauri-apps/api/core');
        const content = await invoke<string>('read_text_file', { path: selected });
        
        const { addSqlQuery, updateSqlQuery, setActiveQueryId } = useQueryStore.getState();
        addSqlQuery();
        
        const { sqlQueries } = useQueryStore.getState();
        const newQuery = sqlQueries[sqlQueries.length - 1];
        
        updateSqlQuery(newQuery.id, { sql: content });
        setActiveQueryId(newQuery.id);
        
        const fileName = selected.split(/[\\/]/).pop() || 'query.sql';
        updateSqlQuery(newQuery.id, { name: fileName.replace('.sql', '') });
        
        setMessage(`已打开文件: ${fileName}`, 'success');
      }
    } catch (e) {
      setMessage(`打开文件失败: ${String(e)}`, 'error');
    }
  };

  const handleSaveFile = async () => {
    const { sqlQueries, activeQueryId } = useQueryStore.getState();
    const activeQuery = sqlQueries.find(q => q.id === activeQueryId);
    
    if (!activeQuery) {
      setMessage('没有选中的查询', 'warning');
      return;
    }

    try {
      const path = await save({
        defaultPath: `${activeQuery.name || 'query'}.sql`,
        filters: [
          {
            name: 'SQL文件',
            extensions: ['sql'],
          },
        ],
      });

      if (path) {
        await tauriService.writeTextFile(path, activeQuery.sql);
        setMessage(`已保存到: ${path}`, 'success');
      }
    } catch (e) {
      setMessage(`保存失败: ${String(e)}`, 'error');
    }
  };

  const handleExportResults = async () => {
    const { sqlQueries, activeQueryId } = useQueryStore.getState();
    const activeQuery = sqlQueries.find(q => q.id === activeQueryId);
    
    if (!activeQuery || !activeQuery.batchResults) {
      setMessage('没有可导出的查询结果', 'warning');
      return;
    }

    try {
      const path = await save({
        defaultPath: `${activeQuery.name || 'result'}.csv`,
        filters: [
          {
            name: 'CSV文件',
            extensions: ['csv'],
          },
        ],
      });

      if (path) {
        const results = activeQuery.batchResults;
        let csvContent = '';
        
        results.forEach((result: any) => {
          if (result.columns && result.rows) {
            csvContent += result.columns.join(',') + '\n';
            result.rows.forEach((row: any[]) => {
              csvContent += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\n';
            });
          }
        });

        await tauriService.writeTextFile(path, csvContent);
        setMessage(`已导出到: ${path}`, 'success');
      }
    } catch (e) {
      setMessage(`导出失败: ${String(e)}`, 'error');
    }
  };

  const handleToggleAllHeader = () => {
    const newValue = !hasHeader;
    setHasHeader(newValue);
    importItems.forEach(item => {
      if (!item.isParent) {
        updateImportItem(item.id, { hasHeader: newValue });
      }
    });
  };

  if (activeTab === 'csv') {
    return (
      <div style={styles.toolbar}>
        <div style={styles.toolbarLeft}>
          <button
            style={styles.toolbarBtnPrimary}
            onClick={handleAddFiles}
            title="添加文件"
          >
            <FilePlusIcon size={18} />
            <span style={styles.btnText}>添加文件</span>
          </button>

          {hasItems && (
            <>
              <div style={styles.divider} />

              <button
                style={styles.toolbarBtn}
                onClick={toggleAllSelected}
                title="全选/取消全选"
              >
                <CheckSquareIcon size={18} />
                <span style={styles.btnText}>全选</span>
              </button>

              <button
                style={{
                  ...styles.toolbarBtn,
                  ...(hasHeader ? styles.toolbarBtnActive : {}),
                }}
                onClick={handleToggleAllHeader}
                title="全部表头开关"
              >
                <GridIcon size={18} />
                <span style={styles.btnText}>全部表头</span>
              </button>

              <button
                style={styles.toolbarBtnPrimary}
                onClick={onBatchImport}
                disabled={selectedCount === 0}
                title="批量导入"
              >
                <PlayIcon size={18} />
                <span style={styles.btnText}>
                  批量导入{selectedCount > 0 ? ` (${selectedCount})` : ''}
                </span>
              </button>

              <button
                style={styles.toolbarBtnDanger}
                onClick={onClearQueue}
                title="清空队列"
              >
                <TrashIcon size={18} />
                <span style={styles.btnText}>清空</span>
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.toolbar}>
      <div style={styles.toolbarLeft}>
        <button
          style={styles.toolbarBtn}
          onClick={handleNewSqlTab}
          title="新建SQL查询"
        >
          <PlusIcon size={18} />
          <span style={styles.btnText}>新建</span>
        </button>

        <button style={styles.toolbarBtn} onClick={handleOpenFile} title="打开SQL文件">
          <FolderOpenIcon size={18} />
          <span style={styles.btnText}>打开</span>
        </button>

        <button style={styles.toolbarBtn} onClick={handleSaveFile} title="保存SQL文件">
          <SaveIcon size={18} />
          <span style={styles.btnText}>保存</span>
        </button>

        <div style={styles.divider} />

        <button style={styles.toolbarBtnPrimary} onClick={handleRunQuery} title="运行查询">
          <PlayIcon size={18} />
          <span style={styles.btnText}>运行</span>
        </button>

        <div style={styles.divider} />

        <button
          style={styles.toolbarBtn}
          onClick={handleRefresh}
          title="刷新数据库状态"
        >
          <RefreshCwIcon size={18} />
          <span style={styles.btnText}>刷新</span>
        </button>

        <button style={styles.toolbarBtn} onClick={handleExportResults} title="导出查询结果">
          <DownloadIcon size={18} />
          <span style={styles.btnText}>导出</span>
        </button>
      </div>

      <div style={styles.toolbarRight}>
        <button style={styles.toolbarBtn} title="数据库信息">
          <DatabaseIcon size={18} />
        </button>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 16px',
    borderBottom: '1px solid #e0e0e0',
    background: '#f5f5f5',
  },
  toolbarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  toolbarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  toolbarBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    color: '#333',
    transition: 'all 0.2s',
  },
  toolbarBtnPrimary: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    background: '#007bff',
    color: 'white',
    border: '1px solid #007bff',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  toolbarBtnActive: {
    background: '#e3f2fd',
    borderColor: '#007bff',
    color: '#007bff',
  },
  toolbarBtnDanger: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    color: '#dc3545',
    transition: 'all 0.2s',
  },
  btnText: {
    display: 'inline-block',
  },
  divider: {
    width: '1px',
    height: '24px',
    background: '#ddd',
    margin: '0 8px',
  },
};

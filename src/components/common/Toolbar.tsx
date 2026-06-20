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
  TrashIcon,
  BarChart2Icon
} from './Icons';
import { useAppStore, useWorkspaceStore, useImportStore, useQueryStore } from '../../store';
import { tauriService } from '../../services';
import type { WorkspaceTabType, ImportItem } from '../../types';
import { useLocale } from '../../context/LocaleContext';

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
  const { t } = useLocale();

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
      setMessage(`${t('common.loading')}: ${String(e)}`, 'error');
    }
    return null;
  };

  const loadExcelFile = async (filePath: string, fileName: string): Promise<ImportItem[]> => {
    try {
      const sheetsResponse = await tauriService.getExcelSheets(filePath);
      if (!sheetsResponse.success || !sheetsResponse.data) {
        setMessage(`${t('common.error')}: Excel Sheet list`, 'error');
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
          sheets: sheetsResponse.data.sheets.map((s: unknown) => typeof s === 'string' ? s : (s as { name: string }).name),
          isExpanded: true,
        });
      }

      return items;
    } catch (e) {
      setMessage(`${t('common.loading')}: ${String(e)}`, 'error');
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
        setMessage(`${t('common.success')}: ${newItems.filter(i => !i.isParent).length} files`, 'success');
      }
    } catch (e) {
      setMessage(`${t('common.error')}: ${String(e)}`, 'error');
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
      setMessage(`${t('common.refresh')}: ${t('common.success')}`, 'success');
    }
  };

  // 记录历史 - 仅写入前端 store（后端 execute_sql 内部会自动持久化，避免重复记录）
  const recordQueryHistoryToStore = (
    sql: string,
    success: boolean,
    rowCount: number | null,
    _errorMessage: string | null,
    _name?: string | null,
  ) => {
    // 同步到前端 store （用于立即刷新查询历史面板）
    useQueryStore.getState().addToHistory(sql, success, rowCount);
  };

  const handleRunQuery = async () => {
    const { sqlQueries, activeQueryId } = useQueryStore.getState();
    const activeQuery = sqlQueries.find((q) => q.id === activeQueryId);
    
    if (!activeQuery || !activeQuery.sql.trim()) {
      setMessage(t('toolbar.pleaseEnterSQL'), 'warning');
      return;
    }

    try {
      const response = await tauriService.executeSql(activeQuery.sql);
      
      if (response.success && response.data) {
        setMessage(t('toolbar.querySuccess'), 'success');
        
        const { setBatchResults } = useQueryStore.getState();
        setBatchResults(activeQueryId, response.data.results);
        
        // 计算总行数
        const totalRowCount = response.data.results
          .filter((r) => r.success && r.rows)
          .reduce((sum: number, r) => sum + (r.rows?.length ?? 0), 0);
        
        // 统一记录到历史（双重写入）
        recordQueryHistoryToStore(
          activeQuery.sql,
          true,
          totalRowCount || null,
          null,
          activeQuery.name
        );
      } else {
        setMessage(`${t('toolbar.queryFail')}: ${response.error}`, 'error');
        
        // 统一记录到历史（失败情况）
        recordQueryHistoryToStore(
          activeQuery.sql,
          false,
          null,
          response.error || null,
          activeQuery.name
        );
      }
    } catch (e) {
      setMessage(`${t('toolbar.queryFail')}: ${String(e)}`, 'error');
      
      // 统一记录到历史（异常情况）
      recordQueryHistoryToStore(
        activeQuery.sql,
        false,
        null,
        String(e),
        activeQuery.name
      );
    }
  };

  const handleOpenFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: 'SQL',
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
        
        setMessage(`${t('common.success')}: ${fileName}`, 'success');
      }
    } catch (e) {
      setMessage(`${t('common.error')}: ${String(e)}`, 'error');
    }
  };

  const handleSaveFile = async () => {
    const { sqlQueries, activeQueryId } = useQueryStore.getState();
    const activeQuery = sqlQueries.find(q => q.id === activeQueryId);
    
    if (!activeQuery) {
      setMessage(t('toolbar.noSelection'), 'warning');
      return;
    }

    try {
      const path = await save({
        defaultPath: `${activeQuery.name || 'query'}.sql`,
        filters: [
          {
            name: 'SQL',
            extensions: ['sql'],
          },
        ],
      });

      if (path) {
        await tauriService.writeTextFile(path, activeQuery.sql);
        setMessage(`${t('common.save')}: ${path}`, 'success');
      }
    } catch (e) {
      setMessage(`${t('common.error')}: ${String(e)}`, 'error');
    }
  };

  const handleExportResults = async () => {
    const { sqlQueries, activeQueryId } = useQueryStore.getState();
    const activeQuery = sqlQueries.find(q => q.id === activeQueryId);
    
    if (!activeQuery || !activeQuery.batchResults) {
      setMessage(t('toolbar.noExportData'), 'warning');
      return;
    }

    try {
      const path = await save({
        defaultPath: `${activeQuery.name || 'result'}.csv`,
        filters: [
          {
            name: 'CSV',
            extensions: ['csv'],
          },
        ],
      });

      if (path) {
        const results = activeQuery.batchResults;
        let csvContent = '';
        
        results.forEach((result) => {
          if (result.columns && result.rows) {
            csvContent += result.columns.join(',') + '\n';
            result.rows.forEach((row: unknown[]) => {
              csvContent += row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\n';
            });
          }
        });

        await tauriService.writeTextFile(path, csvContent);
        setMessage(`${t('toolbar.exportResult')}: ${path}`, 'success');
      }
    } catch (e) {
      setMessage(`${t('toolbar.exportFail')}: ${String(e)}`, 'error');
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

  // 添加图表功能（M3）
  const handleAddChartPanel = () => {
    const { sqlQueries, activeQueryId } = useQueryStore.getState();
    const activeQuery = sqlQueries.find((q) => q.id === activeQueryId);
    
    if (!activeQuery || !activeQuery.batchResults || activeQuery.batchResults.length === 0) {
      setMessage(t('toolbar.noDataToChart'), 'warning');
      return;
    }

    const { tabs, activeTabId, addPanel } = useWorkspaceStore.getState();
    const activeTab = tabs.find((t) => t.id === activeTabId);
    
    if (!activeTab) return;

    // 检查是否已存在图表面板
    const hasChartPanel = activeTab.panels.some((p) => p.type === 'chart');
    if (hasChartPanel) {
      setMessage(t('toolbar.chartAlreadyAdded'), 'warning');
      return;
    }

    // 动态调整面板大小
    const panelCount = activeTab.panels.length;
    const newSize = Math.max(25, Math.floor(80 / (panelCount + 1)));
    
    addPanel(activeTabId, {
      type: 'chart',
      title: t('chart.title'),
      size: newSize,
      active: true,
      content: null,
    });

    setMessage(t('toolbar.chartAdded'), 'success');
  };

  if (activeTab === 'csv') {
    return (
      <div style={styles.toolbar}>
        <div style={styles.toolbarLeft}>
          <button
            style={styles.toolbarBtnPrimary}
            onClick={handleAddFiles}
            title={t('toolbar.addFiles')}
          >
            <FilePlusIcon size={18} />
            <span style={styles.btnText}>{t('toolbar.addFiles')}</span>
          </button>

          {hasItems && (
            <>
              <div style={styles.divider} />

              <button
                style={styles.toolbarBtn}
                onClick={toggleAllSelected}
                title={t('toolbar.selectAll')}
              >
                <CheckSquareIcon size={18} />
                <span style={styles.btnText}>{t('toolbar.select')}</span>
              </button>

              <button
                style={{
                  ...styles.toolbarBtn,
                  ...(hasHeader ? styles.toolbarBtnActive : {}),
                }}
                onClick={handleToggleAllHeader}
                title={t('toolbar.toggleHeader')}
              >
                <GridIcon size={18} />
                <span style={styles.btnText}>{t('toolbar.header')}</span>
              </button>

              <button
                style={styles.toolbarBtnPrimary}
                onClick={onBatchImport}
                disabled={selectedCount === 0}
                title={t('toolbar.batchImport')}
              >
                <PlayIcon size={18} />
                <span style={styles.btnText}>
                  {t('import.button')}{selectedCount > 0 ? ` (${selectedCount})` : ''}
                </span>
              </button>

              <button
                style={styles.toolbarBtnDanger}
                onClick={onClearQueue}
                title={t('toolbar.clear')}
              >
                <TrashIcon size={18} />
                <span style={styles.btnText}>{t('toolbar.clear')}</span>
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // 仪表盘 Tab：简洁工具栏（仅显示仪表盘相关操作）
  if (activeTab === 'dashboard') {
    return (
      <div style={styles.toolbar}>
        <div style={styles.toolbarLeft}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
            📊 仪表盘模式
          </span>
        </div>
        <div style={styles.toolbarRight}>
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
          title={t('toolbar.newSQL')}
        >
          <PlusIcon size={18} />
          <span style={styles.btnText}>{t('toolbar.new')}</span>
        </button>

        <button style={styles.toolbarBtn} onClick={handleOpenFile} title={t('toolbar.openSQLFile')}>
          <FolderOpenIcon size={18} />
          <span style={styles.btnText}>{t('toolbar.open')}</span>
        </button>

        <button style={styles.toolbarBtn} onClick={handleSaveFile} title={t('toolbar.saveSQLFile')}>
          <SaveIcon size={18} />
          <span style={styles.btnText}>{t('toolbar.save')}</span>
        </button>

        <div style={styles.divider} />

        <button style={styles.toolbarBtnPrimary} onClick={handleRunQuery} title={t('toolbar.runQuery')}>
          <PlayIcon size={18} />
          <span style={styles.btnText}>{t('toolbar.run')}</span>
        </button>

        <div style={styles.divider} />

        <button
          style={styles.toolbarBtn}
          onClick={handleRefresh}
          title={t('toolbar.refreshDBStatus')}
        >
          <RefreshCwIcon size={18} />
          <span style={styles.btnText}>{t('common.refresh')}</span>
        </button>

        <button style={styles.toolbarBtn} onClick={handleExportResults} title={t('toolbar.exportResult')}>
          <DownloadIcon size={18} />
          <span style={styles.btnText}>{t('toolbar.export')}</span>
        </button>

        <div style={styles.divider} />

        <button style={styles.toolbarBtn} onClick={handleAddChartPanel} title={t('toolbar.addChart')}>
          <BarChart2Icon size={18} />
          <span style={styles.btnText}>{t('toolbar.chart')}</span>
        </button>
      </div>

      <div style={styles.toolbarRight}>
        <button style={styles.toolbarBtn} title={t('toolbar.databaseInfo')}>
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
    borderBottom: '1px solid var(--border-primary)',
    background: 'var(--bg-tertiary)',
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
    color: 'var(--text-primary)',
    transition: 'all 0.2s',
  },
  toolbarBtnPrimary: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    background: 'var(--primary)',
    color: 'white',
    border: '1px solid var(--primary)',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  toolbarBtnActive: {
    background: 'var(--primary-bg)',
    borderColor: 'var(--primary)',
    color: 'var(--primary)',
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
    color: 'var(--error)',
    transition: 'all 0.2s',
  },
  btnText: {
    display: 'inline-block',
  },
  divider: {
    width: '1px',
    height: '24px',
    background: 'var(--border-primary)',
    margin: '0 8px',
  },
};

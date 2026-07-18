import React, { useState, useRef, useEffect } from 'react';
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
  ChevronDownIcon
} from './Icons';
import { useAppStore, useWorkspaceStore, useImportStore, useQueryStore } from '../../store';
import { tauriService } from '../../services';
import type { WorkspaceTabType, ImportItem } from '../../types';
import { useLocale } from '../../context/LocaleContext';

interface LayoutMenuItemProps {
  /** 菜单项显示文本 */
  label: string;
  /** 点击菜单项的回调 */
  onClick: () => void;
  /** 是否为菜单第一项（用于边框样式） */
  isFirst?: boolean;
  /** 是否为菜单最后一项（用于边框样式） */
  isLast?: boolean;
}

/**
 * 布局菜单项组件（用于 Toolbar 的布局下拉菜单）
 *
 * @param props - 见 LayoutMenuItemProps
 */
const LayoutMenuItem: React.FC<LayoutMenuItemProps> = ({ label, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      style={{
        padding: '8px 12px',
        fontSize: '12px',
        color: 'var(--text-primary)',
        cursor: 'pointer',
        background: isHovered ? 'var(--bg-tertiary)' : 'transparent',
        transition: 'background 0.15s',
      }}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {label}
    </div>
  );
};

interface ToolbarProps {
  /** 当前激活的 Tab 类型，决定渲染哪一种工具栏（csv / sql / dashboard / automation） */
  activeTab: TabType;
  /** 添加文件回调（保留接口，当前未使用） */
  onAddFile?: () => void;
  /** 批量导入回调；csv Tab 下点击「批量导入」按钮时触发 */
  onBatchImport?: () => void;
  /** 清空队列回调；csv Tab 下点击「清空」按钮时触发 */
  onClearQueue?: () => void;
  /** 是否使用紧凑模式（更小的按钮与间距）；默认 false */
  compact?: boolean;
}

/**
 * 顶部工具栏组件
 *
 * 职责：
 * - 根据 activeTab 渲染不同工具栏：
 *   - csv：添加文件、全选、表头切换、批量导入、清空队列
 *   - sql：新建 SQL、打开/保存 .sql 文件、刷新数据库状态、导出结果 CSV、布局切换
 *   - dashboard / automation：返回 null（不显示工具栏）
 * - 布局下拉菜单提供 4 种预设：100/0、80/20、50/50、20/80
 * - 通过 tauriService 调用 loadCsv / getExcelSheets / loadExcelSheet 等接口
 *
 * 副作用：
 * - 点击外部时关闭布局下拉菜单（document mousedown 监听）
 *
 * @param props - 见 ToolbarProps
 */
export const Toolbar: React.FC<ToolbarProps> = ({
  activeTab,
  onAddFile: _onAddFile, // 未使用的参数
  onBatchImport,
  onClearQueue,
  compact = false,
}) => {
  const { setMessage, setAllDatabaseStatus } = useAppStore();
  const { tabs, addTab } = useWorkspaceStore();
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
          sheets: sheetsResponse.data.sheets,
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
      title: `QUERY ${tabs.filter(t => t.type === 'sql').length + 1}`,
      type: 'sql' as WorkspaceTabType,
      panels: [
        {
          id: 'editor',
          type: 'sql_editor',
          title: 'SQL Editor',
          size: 100,
          active: true,
          content: null,
        },
        {
          id: 'results',
          type: 'results_grid',
          title: 'Results',
          size: 0,
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
        const result = await tauriService.readTextFile(selected);
        if (!result.success || result.data === undefined) {
          setMessage(`${t('common.error')}: ${result.error || 'Failed to read file'}`, 'error');
          return;
        }
        const content = result.data;
        
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

  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const layoutButtonRef = useRef<HTMLButtonElement>(null);
  const layoutMenuRef = useRef<HTMLDivElement>(null);

  const { activeTabId, updatePanel } = useWorkspaceStore();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        layoutButtonRef.current &&
        !layoutButtonRef.current.contains(event.target as Node) &&
        layoutMenuRef.current &&
        !layoutMenuRef.current.contains(event.target as Node)
      ) {
        setLayoutMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLayoutChange = (editorSize: number, resultsSize: number) => {
    updatePanel(activeTabId, 'editor', { size: editorSize });
    updatePanel(activeTabId, 'results', { size: resultsSize });
    setLayoutMenuOpen(false);
  };

  const layoutOptions = [
    { label: '100% 编辑器', editorSize: 100, resultsSize: 0 },
    { label: '80% 编辑器 / 20% 结果', editorSize: 80, resultsSize: 20 },
    { label: '50% 编辑器 / 50% 结果', editorSize: 50, resultsSize: 50 },
    { label: '20% 编辑器 / 80% 结果', editorSize: 20, resultsSize: 80 },
  ];

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
    return null;
  }

  // 自动化任务 Tab：不显示工具栏
  if (activeTab === 'automation') {
    return null;
  }

  const toolbarStyle = compact ? styles.toolbarCompact : styles.sqlToolbar;
  const toolbarBtnStyle = compact ? styles.toolbarBtnCompact : styles.sqlToolbarBtn;
  const dividerStyle = compact ? styles.divider : styles.sqlDivider;
  const iconSize = compact ? 14 : 14;

  return (
    <div style={toolbarStyle}>
      <div style={styles.toolbarLeft}>
        <button
          style={toolbarBtnStyle}
          onClick={handleNewSqlTab}
          title={t('toolbar.newSQL')}
        >
          <PlusIcon size={iconSize} />
          {!compact && <span style={styles.btnText}>{t('toolbar.new')}</span>}
        </button>

        <button style={toolbarBtnStyle} onClick={handleOpenFile} title={t('toolbar.openSQLFile')}>
          <FolderOpenIcon size={iconSize} />
          {!compact && <span style={styles.btnText}>{t('toolbar.open')}</span>}
        </button>

        <button style={toolbarBtnStyle} onClick={handleSaveFile} title={t('toolbar.saveSQLFile')}>
          <SaveIcon size={iconSize} />
          {!compact && <span style={styles.btnText}>{t('toolbar.save')}</span>}
        </button>

        {!compact && <div style={dividerStyle} />}

        <button
          style={toolbarBtnStyle}
          onClick={handleRefresh}
          title={t('toolbar.refreshDBStatus')}
        >
          <RefreshCwIcon size={iconSize} />
          {!compact && <span style={styles.btnText}>{t('common.refresh')}</span>}
        </button>

        <button style={toolbarBtnStyle} onClick={handleExportResults} title={t('toolbar.exportResult')}>
          <DownloadIcon size={iconSize} />
          {!compact && <span style={styles.btnText}>{t('toolbar.export')}</span>}
        </button>

        {!compact && <div style={dividerStyle} />}

        <div style={{ position: 'relative' }}>
          <button
            ref={layoutButtonRef}
            style={toolbarBtnStyle}
            onClick={() => setLayoutMenuOpen(!layoutMenuOpen)}
            title={t('common.layout')}
          >
            <GridIcon size={iconSize} />
            {!compact && <span style={styles.btnText}>{t('common.layout')}</span>}
            <ChevronDownIcon size={12} />
          </button>
          {layoutMenuOpen && (
            <div ref={layoutMenuRef} style={styles.layoutDropdown}>
              {layoutOptions.map((option, index) => (
                <LayoutMenuItem
                  key={option.label}
                  label={option.label}
                  onClick={() => handleLayoutChange(option.editorSize, option.resultsSize)}
                  isFirst={index === 0}
                  isLast={index === layoutOptions.length - 1}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={styles.toolbarRight}>
        <button style={toolbarBtnStyle} title={t('toolbar.databaseInfo')}>
          <DatabaseIcon size={iconSize} />
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
  toolbarCompact: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: '2px 8px',
    background: 'transparent',
    gap: '2px',
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
  toolbarBtnCompact: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px 8px',
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    color: 'var(--text-primary)',
    transition: 'all 0.2s',
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
  sqlToolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: '32px',
    padding: '0 12px',
    borderBottom: '1px solid var(--border-primary)',
    background: 'var(--bg-tertiary)',
  },
  sqlToolbarBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    height: '24px',
    padding: '0 10px',
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    color: 'var(--text-primary)',
    transition: 'all 0.2s',
  },
  sqlDivider: {
    width: '1px',
    height: '20px',
    background: 'var(--border-primary)',
    margin: '0 8px',
  },
  layoutDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: '4px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: '4px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    zIndex: 1000,
    minWidth: '200px',
    overflow: 'hidden',
  },
  layoutMenuItem: {
    padding: '8px 12px',
    fontSize: '12px',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
};

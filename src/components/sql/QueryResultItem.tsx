import React, { useEffect, useState } from 'react';
// P0-2 启动优化：ag-grid 懒加载
import { AgGridLazy } from '../common/AgGridLazy';
import { Button, DropdownMenu } from '../common';
import { ChartPanel } from '../chart/ChartPanel';
import { useQueryCopy } from './hooks/useQueryCopy';
import { useQueryExport } from './hooks/useQueryExport';
import { useSetting } from '../../context/SettingsContext';
import { useLocale } from '../../context/LocaleContext';
import type { SqlStatementResult } from '../../types';

// ModuleRegistry.registerModules([AllCommunityModule]);  // ← 已在 AgGridLazy 中动态处理

interface QueryResultItemProps {
  result: SqlStatementResult;
  index: number;
}

export const QueryResultItem: React.FC<QueryResultItemProps> = ({ result, index }) => {
  const [showChart, setShowChart] = useState(false);
  const [fontSize] = useSetting('appearance', 'fontSize');
  const [fontFamily] = useSetting('appearance', 'fontFamily');
  const { t, localeText } = useLocale();
  
  const {
    contextMenu,
    handleCopyCell,
    handleCopyRow,
    handleCopySelected,
    handleCopyAll,
    handleGridContextMenu,
    closeContextMenu,
  } = useQueryCopy();

  const { handleExport } = useQueryExport();

  const displayStatement = result.statement.length > 50 
    ? result.statement.substring(0, 47) + '...' 
    : result.statement;

  const fontSizeNum = parseInt(fontSize || '14', 10);
  const gridStyle = {
    '--ag-font-size': `${fontSizeNum}px`,
    '--ag-font-family': fontFamily || 'Monaco, Menlo, "Ubuntu Mono", monospace',
  } as React.CSSProperties;

  // 点击外部关闭右键菜单
  useEffect(() => {
    const handleClickOutside = () => {
      closeContextMenu();
    };

    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => {
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [contextMenu, closeContextMenu]);

  // 按ESC键关闭右键菜单
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeContextMenu();
      }
    };

    if (contextMenu) {
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [contextMenu, closeContextMenu]);

  // 计算总行数
  const totalRows = result.rows?.length || 0;
  // 默认每页显示50行
  const pageSize = 50;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.statementInfo}>
          <span style={styles.indexBadge}>#{index + 1}</span>
          <span style={styles.statementText} title={result.statement}>
            {displayStatement}
          </span>
        </div>
        <div style={styles.headerActions}>
          <div style={result.success ? styles.successBadge : styles.errorBadge}>
            {result.success ? t('query.success') : t('query.fail')}
          </div>
          {result.success && result.columns && result.rows && (
            <>
              <div style={styles.viewToggle}>
                <Button
                  variant={!showChart ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setShowChart(false)}
                >
                  {t('query.table')}
                </Button>
                <Button
                  variant={showChart ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setShowChart(true)}
                >
                  {t('query.chart')}
                </Button>
              </div>
              <DropdownMenu
                trigger={<Button variant="outline" size="sm">{t('query.exportMenu')} ▼</Button>}
                items={[
                  { label: t('query.exportCSV'), onClick: () => handleExport(result, 'csv') },
                  { label: t('query.exportJSON'), onClick: () => handleExport(result, 'json') },
                ]}
              />
            </>
          )}
        </div>
      </div>

      {!result.success ? (
        <div style={styles.errorContainer}>
          <span style={styles.errorText}>{result.error}</span>
        </div>
      ) : result.columns !== null && result.columns !== undefined && result.columns.length > 0 ? (
        <>
          {showChart ? (
            <div style={styles.chartContainer}>
              <ChartPanel
                queryResult={{
                  columns: result.columns,
                  rows: result.rows ?? []
                }}
              />
            </div>
          ) : (
            <div style={styles.tableWrapper}>
              <div style={{ ...styles.tableContainer, ...gridStyle }} className="ag-theme-alpine">
                <AgGridLazy
                  key={`query-item-${index}-${result.columns.length}-${result.rows?.length || 0}`}
                  rowData={(result.rows ?? []).map((row, rowIndex) => {
                      const rowObj: Record<string, string | number | boolean | null> = { id: rowIndex };
                      row.forEach((cell, colIndex) => {
                        rowObj[`col${colIndex}`] = cell;
                      });
                      return rowObj;
                    })}
                  columnDefs={result.columns.map((col, colIndex) => ({
                    field: `col${colIndex}`,
                    headerName: col,
                  }))}
                  localeText={localeText}
                  defaultColDef={{
                    filter: true,
                    sortable: true,
                    resizable: true,
                    minWidth: 120,
                  }}
                  onCellContextMenu={handleGridContextMenu}
                  rowSelection="multiple"
                  enableCellTextSelection={true}
                  pagination={true}
                  paginationPageSize={pageSize}
                  suppressPaginationPanel={false}
                  domLayout="autoHeight"
                />
              </div>
              {/* 分页信息 */}
              <div style={styles.paginationInfo}>
                <span style={styles.pageText}>
                  {t('query.totalRows')}: {totalRows} | {t('query.page')} 1/{totalPages}
                </span>
              </div>
            </div>
          )}
        </>
      ) : result.success && result.affected_rows !== null ? (
        <div style={styles.affectedRowsContainer}>
          <span style={styles.affectedRowsText}>{t('query.affectedRows')}: {result.affected_rows}</span>
        </div>
      ) : result.success ? (
        <div style={styles.emptyContainer}>
          <span style={styles.emptyText}>{t('query.noResults')}</span>
        </div>
      ) : null}

      {contextMenu && (
        <div style={{ ...styles.contextMenu, left: contextMenu.x, top: contextMenu.y }}>
          {contextMenu.cellValue !== undefined && (
            <button 
              style={styles.contextMenuItem} 
              onClick={(e) => { e.stopPropagation(); handleCopyCell(contextMenu.cellValue); }}
            >
              {t('query.copyCell')}
            </button>
          )}
          {contextMenu.rowData && (
            <button 
              style={styles.contextMenuItem} 
              onClick={(e) => { e.stopPropagation(); handleCopyRow(contextMenu.rowData); }}
            >
              {t('query.copyRow')}
            </button>
          )}
          {contextMenu.api && (
            <>
              <button 
                style={styles.contextMenuItem} 
                onClick={(e) => { e.stopPropagation(); handleCopySelected(contextMenu.api!); }}
              >
                {t('query.copySelectedRows')}
              </button>
              <button 
                style={styles.contextMenuItem} 
                onClick={(e) => { e.stopPropagation(); handleCopyAll(contextMenu.api!); }}
              >
                {t('query.copyAll')}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginBottom: '16px',
    border: '1px solid var(--border-primary)',
    borderRadius: '8px',
    overflow: 'hidden',
    background: 'var(--bg-secondary)',
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 120,
    maxHeight: 600,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 16px',
    background: 'var(--bg-tertiary)',
    borderBottom: '1px solid var(--border-primary)',
    flexShrink: 0,
  },
  statementInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    overflow: 'hidden',
    flex: 1,
  },
  indexBadge: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: 'var(--primary)',
    background: 'var(--primary-bg)',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  statementText: {
    fontSize: '13px',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  viewToggle: {
    display: 'flex',
    gap: '4px',
  },
  chartContainer: {
    flex: 1,
    minHeight: 300,
    maxHeight: 460,
    background: 'var(--bg-secondary)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'auto',
  },
  tableWrapper: {
    flex: 1,
    minHeight: 80,
    maxHeight: 560,
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-primary)',
    minWidth: '100%',
    overflow: 'hidden',
  },
  tableContainer: {
    flex: 1,
    minHeight: 60,
    maxHeight: 520,
    minWidth: '100%',
    background: 'var(--bg-primary)',
    overflow: 'auto',
  },
  paginationInfo: {
    padding: '8px 16px',
    background: 'var(--bg-tertiary)',
    borderTop: '1px solid var(--border-primary)',
    flexShrink: 0,
  },
  pageText: {
    fontSize: '12px',
    color: 'var(--text-tertiary)',
  },
  successBadge: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: 'var(--success)',
    background: 'var(--success-bg)',
    padding: '4px 10px',
    borderRadius: '4px',
  },
  errorBadge: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: 'var(--error)',
    background: 'var(--error-bg)',
    padding: '4px 10px',
    borderRadius: '4px',
  },
  errorContainer: {
    padding: '16px',
    background: 'var(--error-bg)',
  },
  errorText: {
    fontSize: '13px',
    color: 'var(--error)',
  },
  affectedRowsContainer: {
    padding: '16px',
    background: 'var(--primary-bg)',
  },
  affectedRowsText: {
    fontSize: '13px',
    color: 'var(--primary)',
  },
  contextMenu: {
    position: 'fixed',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: '8px',
    boxShadow: 'var(--shadow)',
    padding: '4px',
    zIndex: 1000,
    minWidth: '140px',
  },
  contextMenuItem: {
    width: '100%',
    padding: '8px 16px',
    border: 'none',
    background: 'transparent',
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: '13px',
    color: 'var(--text-primary)',
    borderRadius: '4px',
    transition: 'background 0.2s',
  },
};
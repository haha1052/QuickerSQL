import React, { useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import { Button, DropdownMenu } from '../common';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../styles/design-system';
import { useQueryCopy } from './hooks/useQueryCopy';
import { useQueryExport } from './hooks/useQueryExport';
import type { SqlStatementResult } from '../../types';

ModuleRegistry.registerModules([AllCommunityModule]);

interface QueryResultItemProps {
  result: SqlStatementResult;
  index: number;
}

const zhCNLocaleText = {
  equals: '等于',
  notEqual: '不等于',
  lessThan: '小于',
  greaterThan: '大于',
  filterOoo: '筛选...',
  applyFilter: '应用筛选',
  resetFilter: '重置筛选',
  noRowsToShow: '暂无数据',
};

export const QueryResultItem: React.FC<QueryResultItemProps> = ({ result, index }) => {
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
            {result.success ? '成功' : '失败'}
          </div>
          {result.success && result.columns && result.rows && (
            <DropdownMenu
              trigger={<Button variant="outline" size="sm">导出 ▼</Button>}
              items={[
                { label: '导出 CSV', onClick: () => handleExport(result, 'csv') },
                { label: '导出 JSON', onClick: () => handleExport(result, 'json') },
              ]}
            />
          )}
        </div>
      </div>

      {!result.success ? (
        <div style={styles.errorContainer}>
          <span style={styles.errorText}>{result.error}</span>
        </div>
      ) : (
        <>
          {result.affected_rows !== null && !result.columns ? (
            <div style={styles.affectedRowsContainer}>
              <span style={styles.affectedRowsText}>影响行数: {result.affected_rows}</span>
            </div>
          ) : null}

          {result.columns && result.rows ? (
            <div style={{ height: '300px' }} className="ag-theme-alpine">
              <AgGridReact<any>
                rowData={result.rows.map((row, rowIndex) => {
                  const rowObj: Record<string, any> = { id: rowIndex };
                  row.forEach((cell, colIndex) => {
                    rowObj[`col${colIndex}`] = cell;
                  });
                  return rowObj;
                })}
                columnDefs={result.columns.map((col, colIndex) => ({
                  field: `col${colIndex}`,
                  headerName: col,
                }))}
                localeText={zhCNLocaleText}
                defaultColDef={{
                  filter: true,
                  sortable: true,
                  resizable: true,
                  minWidth: 120,
                }}
                onCellContextMenu={handleGridContextMenu}
                rowSelection="multiple"
                enableCellTextSelection={true}
              />
            </div>
          ) : null}
        </>
      )}

      {contextMenu && (
        <div style={{ ...styles.contextMenu, left: contextMenu.x, top: contextMenu.y }}>
          {contextMenu.cellValue !== undefined && (
            <button 
              style={styles.contextMenuItem} 
              onClick={(e) => { e.stopPropagation(); handleCopyCell(contextMenu.cellValue); }}
            >
              复制单元格
            </button>
          )}
          {contextMenu.rowData && (
            <button 
              style={styles.contextMenuItem} 
              onClick={(e) => { e.stopPropagation(); handleCopyRow(contextMenu.rowData); }}
            >
              复制整行
            </button>
          )}
          {contextMenu.api && (
            <>
              <button 
                style={styles.contextMenuItem} 
                onClick={(e) => { e.stopPropagation(); handleCopySelected(contextMenu.api!); }}
              >
                复制选中行
              </button>
              <button 
                style={styles.contextMenuItem} 
                onClick={(e) => { e.stopPropagation(); handleCopyAll(contextMenu.api!); }}
              >
                复制全部数据
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
    marginBottom: Spacing.md,
    border: `1px solid ${Colors.border}`,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    background: Colors.background,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${Spacing.sm} ${Spacing.md}`,
    background: Colors.backgroundLight,
    borderBottom: `1px solid ${Colors.border}`,
  },
  statementInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: Spacing.sm,
    overflow: 'hidden',
    flex: 1,
  },
  indexBadge: {
    fontSize: FontSizes.small,
    fontWeight: 'bold',
    color: Colors.primary,
    background: Colors.primaryLight,
    padding: '2px 8px',
    borderRadius: BorderRadius.sm,
  },
  statementText: {
    fontSize: FontSizes.small,
    color: Colors.textPrimary,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  successBadge: {
    fontSize: FontSizes.caption,
    fontWeight: 'bold',
    color: Colors.success,
    background: '#d4edda',
    padding: '4px 10px',
    borderRadius: BorderRadius.sm,
  },
  errorBadge: {
    fontSize: FontSizes.caption,
    fontWeight: 'bold',
    color: Colors.danger,
    background: '#f8d7da',
    padding: '4px 10px',
    borderRadius: BorderRadius.sm,
  },
  errorContainer: {
    padding: Spacing.md,
    background: '#fff5f5',
  },
  errorText: {
    fontSize: FontSizes.small,
    color: Colors.danger,
  },
  affectedRowsContainer: {
    padding: Spacing.md,
    background: '#f0f9ff',
  },
  affectedRowsText: {
    fontSize: FontSizes.small,
    color: Colors.primary,
  },
  contextMenu: {
    position: 'fixed',
    background: Colors.background,
    border: `1px solid ${Colors.border}`,
    borderRadius: BorderRadius.md,
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
    padding: Spacing.xs,
    zIndex: 1000,
    minWidth: '140px',
  },
  contextMenuItem: {
    width: '100%',
    padding: `${Spacing.sm} ${Spacing.md}`,
    border: 'none',
    background: 'transparent',
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: FontSizes.small,
    color: Colors.textPrimary,
    borderRadius: BorderRadius.sm,
    transition: 'background 0.2s',
  },
};

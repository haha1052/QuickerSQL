import React, { useState } from 'react';
import type { SqlQuery, SqlStatementResult } from '../../types';
import { SQLEditor } from './SQLEditor';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';

ModuleRegistry.registerModules([AllCommunityModule]);

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

interface SqlQueryPageProps {
  query: SqlQuery;
  onChange: (sql: string) => void;
  onExecute: () => void;
  isLoading: boolean;
}

export const SqlQueryPage: React.FC<SqlQueryPageProps> = ({
  query,
  onChange,
  onExecute,
  isLoading,
}) => {
  const [editorSize, setEditorSize] = useState(50); // 编辑器占50%
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartSize, setDragStartSize] = useState(50);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStartY(e.clientY);
    setDragStartSize(editorSize);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    const container = document.getElementById('sql-query-container');
    if (!container) return;

    const containerHeight = container.clientHeight;
    const delta = e.clientY - dragStartY;
    const deltaPercent = (delta / containerHeight) * 100;

    let newSize = dragStartSize + deltaPercent;
    newSize = Math.max(20, Math.min(80, newSize));
    setEditorSize(newSize);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStartY, dragStartSize]);

  // 渲染单个查询结果的组件
  const renderSingleResult = (result: SqlStatementResult, index: number) => {
    const displayStatement = result.statement.length > 50 
      ? result.statement.substring(0, 47) + '...' 
      : result.statement;
    
    return (
      <div key={index} style={styles.singleResultContainer}>
        <div style={styles.singleResultHeader}>
          <div style={styles.statementInfo}>
            <span style={styles.statementIndex}>#{index + 1}</span>
            <span style={styles.statementText} title={result.statement}>{displayStatement}</span>
          </div>
          <div style={result.success ? styles.successBadge : styles.errorBadge}>
            {result.success ? '成功' : '失败'}
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
                />
              </div>
            ) : null}
          </>
        )}
      </div>
    );
  };

  return (
    <div id="sql-query-container" style={styles.container}>
      <div style={{ ...styles.panel, height: `${editorSize}%` }}>
        {/* 移除了多余的面板标题 */}
        <div style={styles.panelContent}>
          <SQLEditor
            query={query}
            onChange={onChange}
            onExecute={onExecute}
            isLoading={isLoading}
          />
        </div>
      </div>

      <div
        style={{
          ...styles.resizer,
          cursor: isDragging ? 'row-resize' : 'ns-resize',
          background: isDragging ? '#007bff' : '#e0e0e0',
        }}
        onMouseDown={handleMouseDown}
      />

      <div style={{ ...styles.panel, height: `${100 - editorSize}%` }}>
        {/* 移除了多余的面板标题 */}
        <div style={styles.panelContent}>
          {query?.batchResults && query.batchResults.length > 0 ? (
            <div style={styles.resultsStackedContainer}>
              {query.batchResults.map((result, index) => 
                renderSingleResult(result, index)
              )}
            </div>
          ) : query?.result ? (
            <div style={{ height: '100%' }} className="ag-theme-alpine">
              <AgGridReact<any>
                rowData={query.result.rows.map((row, rowIndex) => {
                  const rowObj: Record<string, any> = { id: rowIndex };
                  row.forEach((cell, colIndex) => {
                    rowObj[`col${colIndex}`] = cell;
                  });
                  return rowObj;
                })}
                columnDefs={query.result.columns.map((col, index) => ({
                  field: `col${index}`,
                  headerName: col,
                }))}
                localeText={zhCNLocaleText}
                defaultColDef={{
                  filter: true,
                  sortable: true,
                  resizable: true,
                  minWidth: 120,
                }}
              />
            </div>
          ) : (
            <div style={styles.placeholder}>
              暂无查询结果
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: '#fff',
  },
  panel: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  panelHeader: {
    padding: '8px 12px',
    background: '#f5f5f5',
    borderBottom: '1px solid #e0e0e0',
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#333',
  },
  panelContent: {
    flex: 1,
    overflow: 'auto',
  },
  resizer: {
    height: '4px',
    width: '100%',
    transition: 'background 0.2s',
  },
  placeholder: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#999',
  },
  // 堆叠结果样式
  resultsStackedContainer: {
    height: '100%',
    overflowY: 'auto',
    padding: '12px',
  },
  singleResultContainer: {
    marginBottom: '16px',
    border: '1px solid #e0e0e0',
    borderRadius: '6px',
    overflow: 'hidden',
    background: '#fff',
  },
  singleResultHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    background: '#f5f7fa',
    borderBottom: '1px solid #e0e0e0',
  },
  statementInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    overflow: 'hidden',
  },
  statementIndex: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#007bff',
    background: '#e3f2fd',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  statementText: {
    fontSize: '13px',
    color: '#333',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  successBadge: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#28a745',
    background: '#d4edda',
    padding: '4px 10px',
    borderRadius: '4px',
  },
  errorBadge: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#dc3545',
    background: '#f8d7da',
    padding: '4px 10px',
    borderRadius: '4px',
  },
  errorContainer: {
    padding: '12px',
    background: '#fff5f5',
  },
  errorText: {
    fontSize: '13px',
    color: '#dc3545',
  },
  affectedRowsContainer: {
    padding: '12px',
    background: '#f0f9ff',
  },
  affectedRowsText: {
    fontSize: '13px',
    color: '#0066cc',
  },
};

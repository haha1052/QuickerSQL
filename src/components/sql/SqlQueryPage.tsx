import React, { useState } from 'react';
import type { SqlQuery, SqlStatementResult } from '../../types';
import { SQLEditor } from './SQLEditor';
// P0-2 启动优化：ag-grid 懒加载（详见 ../common/AgGridLazy.tsx）
import { AgGridLazy } from '../common/AgGridLazy';
import { useLocale } from '../../context/LocaleContext';
import { TaskEditorModal } from '../automation/TaskEditorModal';

// ModuleRegistry.registerModules([AllCommunityModule]);  // ← 已在 AgGridLazy 中动态处理

interface SqlQueryPageProps {
  query: SqlQuery;
  onChange: (sql: string) => void;
}

export const SqlQueryPage: React.FC<SqlQueryPageProps> = ({
  query,
  onChange,
}) => {
  const [editorSize, setEditorSize] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartSize, setDragStartSize] = useState(50);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const { t, locale, localeText } = useLocale();

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
            {result.success ? t('query.success') : t('query.fail')}
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
                <span style={styles.affectedRowsText}>{t('query.affectedRows')}: {result.affected_rows}</span>
              </div>
            ) : null}

            {result.columns !== null && result.columns !== undefined && result.columns.length > 0 ? (
              <div style={{ 
                maxHeight: '400px',
                minHeight: '100px',
                height: Math.min(Math.max((result.rows?.length || 0) * 28 + 40, 100), 400)
              }} className="ag-theme-alpine">
                <AgGridLazy
                  key={locale}
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
                />
              </div>
            ) : result.success && result.affected_rows !== null ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                <span>{t('query.affectedRows')}: {result.affected_rows}</span>
              </div>
            ) : result.success ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                <span>{t('query.noResults')}</span>
              </div>
            ) : null}
          </>
        )}
      </div>
    );
  };

  return (
    <div id="sql-query-container" style={styles.container}>
      <div style={styles.toolbarContainer}>
        <button
          style={styles.scheduleBtn}
          onClick={() => setShowScheduleModal(true)}
          title={t('task.scheduleHint')}
        >
          {t('sqlEditor.scheduleExecution')}
        </button>
      </div>
      <div style={{ ...styles.panel, height: `${editorSize}%` }}>
        <div style={styles.panelContent}>
          <SQLEditor
            query={query}
            onChange={onChange}
          />
        </div>
      </div>

      <div
        style={{
          ...styles.resizer,
          cursor: isDragging ? 'row-resize' : 'ns-resize',
          background: isDragging ? 'var(--primary)' : 'var(--border-primary)',
        }}
        onMouseDown={handleMouseDown}
      />

      <div style={{ ...styles.panel, height: `${100 - editorSize}%` }}>
        <div style={styles.panelContent}>
          {query?.batchResults !== null && query?.batchResults !== undefined ? (
            <div style={styles.resultsStackedContainer}>
              {query.batchResults.length > 0 ? (
                query.batchResults.map((result, index) =>
                  renderSingleResult(result, index)
                )
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                  <span>{t('sqlEditor.querySuccessNoResults')}</span>
                </div>
              )}
            </div>
          ) : query?.result ? (
            <div style={{ height: '100%' }} className="ag-theme-alpine">
              <AgGridLazy
                key={locale}
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
                localeText={localeText}
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
              {t('common.noResult')}
            </div>
          )}
        </div>
      </div>
      <TaskEditorModal
        open={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        initialTaskType="sql"
        initialPayload={{ sql: query.sql || '' }}
        initialName={t('task.scheduleExecution')}
      />
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    minHeight: '600px',
    background: 'var(--bg-primary)',
    position: 'relative',
  },
  toolbarContainer: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 12px',
    borderBottom: '1px solid var(--border-primary)',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
  },
  scheduleBtn: {
    padding: '6px 12px',
    background: 'var(--primary)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
    fontWeight: 500,
  },
  panel: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minHeight: '200px',
  },
  panelHeader: {
    padding: '8px 12px',
    background: 'var(--bg-tertiary)',
    borderBottom: '1px solid var(--border-primary)',
    fontSize: '13px',
    fontWeight: 'bold',
    color: 'var(--text-primary)',
  },
  panelContent: {
    flex: 1,
    overflow: 'auto',
    minHeight: '200px',
  },
  resizer: {
    height: '4px',
    width: '100%',
    cursor: 'ns-resize',
    transition: 'background 0.2s',
    background: 'var(--border-primary)',
    flexShrink: 0,
  },
  placeholder: {
    height: '100%',
    minHeight: '200px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-tertiary)',
  },
  resultsStackedContainer: {
    height: '100%',
    minHeight: '200px',
    overflowY: 'auto',
    padding: '12px',
  },
  singleResultContainer: {
    marginBottom: '16px',
    border: '1px solid var(--border-primary)',
    borderRadius: '6px',
    overflow: 'hidden',
    background: 'var(--bg-secondary)',
  },
  singleResultHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    background: 'var(--bg-tertiary)',
    borderBottom: '1px solid var(--border-primary)',
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
    padding: '12px',
    background: 'var(--error-bg)',
  },
  errorText: {
    fontSize: '13px',
    color: 'var(--error)',
  },
  affectedRowsContainer: {
    padding: '12px',
    background: 'var(--primary-bg)',
  },
  affectedRowsText: {
    fontSize: '13px',
    color: 'var(--primary)',
  },
};

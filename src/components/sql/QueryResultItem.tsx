import React, { useState, useMemo, useCallback } from 'react';
import { Button } from '../common';
import { ChartPanel } from '../chart/ChartPanel';
import { ResultGrid } from './result-grid/ResultGrid';
import { useSetting } from '../../context/SettingsContext';
import { useLocale } from '../../context/LocaleContext';
import { useQueryStore } from '../../store';
import type { SqlStatementResult } from '../../types';
import { parseSqlError, calculateErrorLineOffset } from '../../utils/sqlErrorParser';
import { QueryPlanTree, isExplainResult } from './QueryPlanTree';

interface QueryResultItemProps {
  result: SqlStatementResult;
  index: number;
}

const QueryResultItemInner: React.FC<QueryResultItemProps> = ({ result, index }) => {
  const [showChart, setShowChart] = useState(false);
  const [fontSize] = useSetting('appearance', 'fontSize');
  const [fontFamily] = useSetting('appearance', 'fontFamily');
  const [resultLimitStr] = useSetting('sql', 'resultLimit');
  const [showExecutionTimeStr] = useSetting('sql', 'showExecutionTime');
  const [maxResultRowsStr] = useSetting('database', 'maxResultRows');
  const [resultPageSizeStr] = useSetting('performance', 'result_page_size');
  const [resultMinHeightStr] = useSetting('performance', 'result_min_height');
  const [resultMaxHeightStr] = useSetting('performance', 'result_max_height');
  const { t, localeText } = useLocale();
  const sqlQueries = useQueryStore(s => s.sqlQueries);
  const activeQueryId = useQueryStore(s => s.activeQueryId);
  const setJumpToLine = useQueryStore(s => s.setJumpToLine);

  const activeQuery = sqlQueries.find(q => q.id === activeQueryId);

  const showExecutionTime = showExecutionTimeStr === undefined ? true : showExecutionTimeStr === 'true';

  const parsedError = !result.success && result.error ? parseSqlError(result.error) : null;
  const hasErrorLineNumber = parsedError !== null && parsedError.lineNumber !== null;

  const handleJumpToError = () => {
    if (!activeQuery || !parsedError || parsedError.lineNumber === null) return;

    const offset = calculateErrorLineOffset(activeQuery.sql, result.statement);
    const actualLine = offset + parsedError.lineNumber;
    setJumpToLine(actualLine);
  };

  const formatExecutionTime = useCallback((ms: number): string => {
    if (ms < 1000) {
      return t('query.executionTimeMs', { ms: ms.toFixed(0) });
    }
    return t('query.executionTimeSec', { sec: (ms / 1000).toFixed(2) });
  }, [t]);

  const displayStatement = result.statement.length > 50
    ? result.statement.substring(0, 47) + '...'
    : result.statement;

  const fontSizeNum = useMemo(() => parseInt(fontSize || '14', 10), [fontSize]);

  // 结果相关计算，用 useMemo 避免每次渲染重复计算
  const {
    totalRows,
    displayRows,
    displayRowCount,
    isTruncated,
    maxResultRows,
    isOverMaxResultRows,
    pageSize,
    totalPages,
    resultMinHeight,
    resultMaxHeight,
    tableHeight,
  } = useMemo(() => {
    const MIN_RESULT_HEIGHT = 64;
    const MAX_RESULT_HEIGHT = 1000;
    const RESULT_HEADER_HEIGHT = 48;
    const GRID_HEADER_HEIGHT = 36;
    const SCROLLBAR_HEIGHT = 17;
    
    const rl = parseInt(resultLimitStr || '1000', 10) || 1000;
    const tr = result.rows?.length || 0;
    const dr = result.rows ? result.rows.slice(0, rl) : [];
    const drc = dr.length;
    const it = tr > rl;
    const mrr = parseInt(maxResultRowsStr || '10000', 10) || 10000;
    const iom = tr > mrr;
    const ps = parseInt(resultPageSizeStr || '100', 10) || 100;
    const tp = Math.max(1, Math.ceil(drc / ps));
    
    const rmhRaw = parseInt(resultMinHeightStr || '200', 10) || 200;
    const rmhxRaw = parseInt(resultMaxHeightStr || '800', 10) || 800;
    const rmh = Math.max(MIN_RESULT_HEIGHT, Math.min(MAX_RESULT_HEIGHT, rmhRaw));
    const rmhx = Math.max(MIN_RESULT_HEIGHT, Math.min(MAX_RESULT_HEIGHT, rmhxRaw));
    
    const rowHeight = fontSizeNum < 14 ? 24 : fontSizeNum < 16 ? 26 : 28;
    const rowsToShow = Math.min(ps, drc);
    const calculatedTableHeight = GRID_HEADER_HEIGHT + rowsToShow * rowHeight + SCROLLBAR_HEIGHT;
    const clampedTableHeight = Math.min(calculatedTableHeight, rmhx - RESULT_HEADER_HEIGHT - 80);
    
    return {
      resultLimit: rl,
      totalRows: tr,
      displayRows: dr,
      displayRowCount: drc,
      isTruncated: it,
      maxResultRows: mrr,
      isOverMaxResultRows: iom,
      pageSize: ps,
      totalPages: tp,
      resultMinHeight: rmh,
      resultMaxHeight: rmhx,
      tableHeight: clampedTableHeight,
    };
  }, [resultLimitStr, result.rows, maxResultRowsStr, resultPageSizeStr, resultMinHeightStr, resultMaxHeightStr, fontSizeNum]);

  return (
    <div style={{ 
      ...styles.container, 
      minHeight: Math.max(resultMinHeight, tableHeight + 80),
      maxHeight: resultMaxHeight,
    }}>
      <div style={styles.header}>
        <div style={styles.statementInfo}>
          <span style={styles.indexBadge}>#{index + 1}</span>
          <span style={styles.statementText} title={result.statement}>
            {displayStatement}
          </span>
          {showExecutionTime && result.executionTimeMs !== undefined && (
            <span style={styles.executionTimeBadge}>
              {formatExecutionTime(result.executionTimeMs)}
            </span>
          )}
          {result.engine && (
            <span style={{
              ...styles.engineBadge,
              ...(result.engine === 'duckdb' ? styles.duckdbBadge : styles.sqliteBadge),
            }}>
              {result.engine === 'duckdb' ? 'DuckDB' : 'SQLite'}
            </span>
          )}
          {result.success && result.columns && result.rows && result.columns.length > 0 && (
            <span style={styles.rowCountBadge}>
              {totalRows.toLocaleString()} 行
            </span>
          )}
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
            </>
          )}
        </div>
      </div>

      <div style={styles.contentWrapper}>
      {!result.success ? (
        <div style={styles.errorContainer}>
          <div style={styles.errorHeader}>
            <span style={styles.errorText}>{result.error}</span>
            {hasErrorLineNumber && (
              <button style={styles.jumpToErrorBtn} onClick={handleJumpToError}>
                定位到错误行
              </button>
            )}
          </div>
        </div>
      ) : result.columns !== null && result.columns !== undefined && result.columns.length > 0 ? (
        <>
          {isExplainResult(result.statement) ? (
            <div style={styles.tableWrapper}>
              <QueryPlanTree
                columns={result.columns}
                rows={displayRows}
                statement={result.statement}
              />
            </div>
          ) : showChart ? (
            <div style={styles.chartContainer}>
              <ChartPanel
                queryResult={{
                  columns: result.columns,
                  rows: displayRows
                }}
              />
            </div>
          ) : (
            <ResultGrid
              columns={result.columns || []}
              displayRows={displayRows}
              fullRows={result.rows || []}
              totalRows={totalRows}
              statement={result.statement}
              displayRowCount={displayRowCount}
              isTruncated={isTruncated}
              isOverMaxResultRows={isOverMaxResultRows}
              maxResultRows={maxResultRows}
              pageSize={pageSize}
              paginated={totalPages > 1}
              totalPages={totalPages}
              tableHeight={tableHeight}
              fontSizeNum={fontSizeNum}
              fontFamily={fontFamily || ''}
              localeText={localeText}
            />
          )}
        </>
      ) : result.success && result.affected_rows !== null ? (
        <div style={styles.affectedRowsContainer}>
          <span style={styles.affectedRowsText}>{t('query.affectedRows')}: {result.affected_rows}</span>
        </div>
      ) : result.success ? (
        <div style={styles.emptyResultContainer}>
          <div style={styles.emptyResultIcon}>📋</div>
          <div style={styles.emptyResultTitle}>查询无结果</div>
          <div style={styles.emptyResultDesc}>SQL 执行成功，但没有返回任何数据行</div>
        </div>
      ) : null}
      </div>
    </div>
  );
};

export const QueryResultItem = QueryResultItemInner;

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginBottom: '16px',
    border: '1px solid var(--border-primary)',
    borderRadius: '8px',
    overflow: 'hidden',
    background: 'var(--bg-secondary)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
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
  contentWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    height: 0,
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
  executionTimeBadge: {
    fontSize: '12px',
    color: 'var(--text-tertiary)',
    background: 'var(--bg-secondary)',
    padding: '2px 8px',
    borderRadius: '4px',
    flexShrink: 0,
  },
  engineBadge: {
    fontSize: '11px',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: '4px',
    flexShrink: 0,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  duckdbBadge: {
    color: '#fff',
    background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
  },
  sqliteBadge: {
    color: '#fff',
    background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
  },
  rowCountBadge: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    background: 'var(--bg-secondary)',
    padding: '2px 8px',
    borderRadius: '4px',
    flexShrink: 0,
    fontWeight: 500,
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
    minHeight: 300,
    maxHeight: 660,
    background: 'var(--bg-secondary)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'auto',
  },
  tableWrapper: {
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-primary)',
    minWidth: '100%',
    overflow: 'hidden',
    flex: 1,
    height: 0,
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
  errorHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
  },
  errorText: {
    fontSize: '13px',
    color: 'var(--error)',
    flex: 1,
    lineHeight: 1.5,
  },
  jumpToErrorBtn: {
    padding: '4px 12px',
    fontSize: '12px',
    color: 'var(--error)',
    background: 'transparent',
    border: '1px solid var(--error)',
    borderRadius: '4px',
    cursor: 'pointer',
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  affectedRowsContainer: {
    padding: '16px',
    background: 'var(--primary-bg)',
  },
  affectedRowsText: {
    fontSize: '13px',
    color: 'var(--primary)',
  },
  emptyResultContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    gap: '12px',
  },
  emptyResultIcon: {
    fontSize: '48px',
  },
  emptyResultTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  emptyResultDesc: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    textAlign: 'center',
  },
};
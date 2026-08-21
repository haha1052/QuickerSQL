import React, { useState, useCallback } from 'react';
import type { Panel, SqlStatementResult } from '../../types';
import { useWorkspaceStore, useQueryStore, useAppStore } from '../../store';
import { SQLEditor } from '../sql/SQLEditor';
import { QueryResult } from '../sql/QueryResult';
import { ChartPanel } from '../chart/ChartPanel';
import { useQueryExecution } from '../sql/hooks';
import { tauriService } from '../../services';
import { useSetting } from '../../context/SettingsContext';
import { useLocale } from '../../context/LocaleContext';
import { applyDefaultSelectLimit } from '../../utils/sqlStatementParser';

interface PanelManagerProps {
  tabId: string;
  panels: Panel[];
}

export const PanelManager: React.FC<PanelManagerProps> = ({ tabId, panels }) => {
  const { updatePanel, tabs } = useWorkspaceStore();
  const sqlQueries = useQueryStore(s => s.sqlQueries);
  const activeQueryId = useQueryStore(s => s.activeQueryId);
  const updateSqlQuery = useQueryStore(s => s.updateSqlQuery);
  const setActiveQueryId = useQueryStore(s => s.setActiveQueryId);
  const setQueryLoading = useQueryStore(s => s.setQueryLoading);
  const setBatchResults = useQueryStore(s => s.setBatchResults);
  const addToHistory = useQueryStore(s => s.addToHistory);
  const { setMessage } = useAppStore();
  const { executeQuery } = useQueryExecution();
  const { t } = useLocale();
  const [defaultSelectLimitStr] = useSetting('sql', 'defaultSelectLimit');
  const defaultSelectLimit = parseInt(defaultSelectLimitStr || '0', 10) || 0;
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartSizes, setDragStartSizes] = useState<number[]>([]);

  // 当前 Tab 绑定的 queryId（从 tab 数据里拿，而不是全局 activeQueryId）
  const tabData = tabs.find(t => t.id === tabId);
  const tabQueryId = tabData?.queryId || activeQueryId;
  
  // 确保全局 activeQueryId 与当前 tab.queryId 同步（仅当 queryId 真实存在时才同步）
  React.useEffect(() => {
    if (tabQueryId && activeQueryId !== tabQueryId && sqlQueries.some(q => q.id === tabQueryId)) {
      setActiveQueryId(tabQueryId);
    }
  }, [tabQueryId, activeQueryId, setActiveQueryId, sqlQueries]);

  const activeQuery = sqlQueries.find(q => q.id === tabQueryId);

  const executeSingleStatement = useCallback(async (sql: string) => {
    if (!tabQueryId) return;

    setQueryLoading(tabQueryId);
    const startTime = performance.now();
    try {
      const sqlToExecute = applyDefaultSelectLimit(sql, defaultSelectLimit);
      const response = await tauriService.executeSql(sqlToExecute);
      
      if (response.success && response.data) {
        const batchResults = response.data.results as SqlStatementResult[];
        
        if (!batchResults || !Array.isArray(batchResults)) {
          console.error('[PanelManager] Invalid batchResults format:', response.data);
          setMessage('error.query.parse_failed', 'error');
          return;
        }

        const endTime = performance.now();
        const totalExecutionMs = endTime - startTime;
        
        const resultsWithTime = batchResults.map((result) => ({
          ...result,
          executionTimeMs: result.executionTimeMs ?? totalExecutionMs,
        }));
        
        setBatchResults(tabQueryId, resultsWithTime);
        
        const successResults = resultsWithTime.filter(r => r.success);
        const totalRows = successResults.reduce((sum, item) => sum + (item.rows?.length || 0), 0);
        const hasSuccess = successResults.length > 0;
        addToHistory(sql, hasSuccess, totalRows, 100);
        
        if (hasSuccess) {
          setMessage({ key: 'query.execute.success', vars: { count: successResults.length } }, 'success');
        } else {
          setMessage('query.execute.failed', 'error');
        }
      } else {
        console.error('[PanelManager] SQL execution error:', response.error);
        setMessage('error.query.check_syntax', 'error');
        addToHistory(sql, false, null, 100);
      }
    } catch (error) {
      console.error('[PanelManager] SQL execution exception:', error);
      setMessage('error.query.check_syntax', 'error');
      addToHistory(sql, false, null, 100);
    } finally {
      setQueryLoading(null);
    }
  }, [tabQueryId, setQueryLoading, setBatchResults, addToHistory, setMessage, defaultSelectLimit]);

  const isAnalyticalQuery = (sql: string): boolean => {
    const upper = sql.toUpperCase();
    const analyticalKeywords = [
      'GROUP BY', 'HAVING', 'OVER', 'WINDOW',
      'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'LAG', 'LEAD',
      'ARRAY_AGG', 'STRING_AGG',
      'COUNT(DISTINCT', 'AVG(', 'SUM(', 'MIN(', 'MAX(',
      'SELECT DISTINCT', ' JOIN ', // safe_sql: SQL 关键字检测逻辑（用于判断是否为分析型查询）
    ];
    return analyticalKeywords.some(kw => upper.includes(kw));
  };

  const addExplainPrefix = (sql: string): string => {
    const trimmed = sql.trimStart();
    if (/^explain\s+/i.test(trimmed)) {
      return sql;
    }
    // For analytical queries, use DuckDB EXPLAIN (routes to DuckDB)
    // For simple queries, use SQLite EXPLAIN QUERY PLAN (routes to SQLite)
    if (isAnalyticalQuery(sql)) {
      return 'EXPLAIN ' + sql;
    }
    return 'EXPLAIN QUERY PLAN ' + sql;
  };

  const executeExplainStatement = useCallback(async (sql: string) => {
    const explainSql = addExplainPrefix(sql);
    await executeSingleStatement(explainSql);
  }, [executeSingleStatement]);

  const executeExplain = useCallback(async () => {
    if (!activeQuery) return;
    const explainSql = addExplainPrefix(activeQuery.sql);
    await executeSingleStatement(explainSql);
  }, [activeQuery, executeSingleStatement]);

  const handleEditorChange = useCallback((sql: string) => {
    const displayedQuery = activeQuery || sqlQueries[0];
    const displayedQueryId = displayedQuery?.id || tabQueryId;
    updateSqlQuery(displayedQueryId, { sql });
  }, [activeQuery, sqlQueries, tabQueryId, updateSqlQuery]);

  const handleMouseDown = useCallback((index: number, e: React.MouseEvent) => {
    setIsDragging(true);
    setDragIndex(index);
    setDragStartY(e.clientY);
    setDragStartSizes(panels.map(p => p.size));
  }, [panels]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || dragIndex === null) return;
    
    const container = document.getElementById('panel-container');
    if (!container) return;

    const containerHeight = container.clientHeight;
    const delta = e.clientY - dragStartY;
    const deltaPercent = (delta / containerHeight) * 100;
    
    const newSizes = [...dragStartSizes];
    newSizes[dragIndex] += deltaPercent;
    newSizes[dragIndex + 1] -= deltaPercent;
    
    // 确保面板大小在合理范围内
    newSizes.forEach((size, i) => {
      if (size < 20) {
        const diff = 20 - size;
        newSizes[i] = 20;
        if (i < newSizes.length - 1) newSizes[i + 1] -= diff;
      }
    });
    
    panels.forEach((panel, idx) => {
      updatePanel(tabId, panel.id, { size: newSizes[idx] });
    });
  }, [isDragging, dragIndex, dragStartY, dragStartSizes, panels, tabId, updatePanel]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragIndex(null);
  }, []);

  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const renderPanelContent = (panel: Panel) => {
    switch (panel.type) {
      case 'sql_editor':
        // 使用当前 Tab 绑定的 queryId，确保每个 Tab 显示自己的查询
        const displayedQuery = activeQuery || sqlQueries[0];
        
        return (
          <SQLEditor
            query={displayedQuery}
            onChange={handleEditorChange}
            onExecute={executeQuery}
            onExecuteStatement={executeSingleStatement}
            onExplain={executeExplain}
            onExplainStatement={executeExplainStatement}
          />
        );
      case 'results_grid':
        return <QueryResult />;
      case 'chart':
        return (
          <ChartPanel
            queryResult={activeQuery?.result ? {
              columns: activeQuery.result.columns || [],
              rows: activeQuery.result.rows || []
            } : null}
          />
        );
      case 'query_plan':
        return (
          <div style={styles.placeholderPanel}>
            {t('queryPlan.comingSoon')}
          </div>
        );
      default:
        return (
          <div style={styles.placeholderPanel}>
            {panel.title}
          </div>
        );
    }
  };

  return (
    <div id="panel-container" style={styles.panelContainer}>
      {panels.map((panel, index) => {
        // size === 0 时跳过渲染（only-editor / only-results 模式）
        if (panel.size === 0) return null;

        return (
          <React.Fragment key={panel.id}>
            <div style={{
              ...styles.panel,
              height: `${panel.size}%`,
            }}>
              <div style={styles.panelContent}>
                {renderPanelContent(panel)}
              </div>
            </div>

            {index < panels.length - 1 && panels[index + 1]?.size !== 0 && (
              <div
                style={{
                  ...styles.resizer,
                  cursor: isDragging && dragIndex === index ? 'row-resize' : 'ns-resize',
                  background: isDragging && dragIndex === index ? 'var(--primary)' : 'var(--border-primary)',
                }}
                onMouseDown={(e) => handleMouseDown(index, e)}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  panelContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    background: 'var(--bg-primary)',
  },
  panel: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  panelContent: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'auto',
  },
  resizer: {
    height: '4px',
    width: '100%',
    transition: 'background 0.2s',
  },
  placeholderPanel: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-secondary)',
  },
};
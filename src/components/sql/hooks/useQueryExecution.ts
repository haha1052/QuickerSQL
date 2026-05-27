import { useCallback } from 'react';
import { useQueryStore, useAppStore } from '../../../store';
import { tauriService } from '../../../services';
import type { SqlStatementResult } from '../../../types';

export const useQueryExecution = () => {
  const { sqlQueries, activeQueryId, setQueryLoading, setQueryResult, setBatchResults, addToHistory } = useQueryStore();
  const { setMessage } = useAppStore();

  const activeQuery = sqlQueries.find(q => q.id === activeQueryId);

  const executeQuery = useCallback(async () => {
    if (!activeQuery) {
      setMessage('请先选择或创建一个查询', 'warning');
      return;
    }

    setQueryLoading(activeQueryId);
    try {
      const response = await tauriService.executeSql(activeQuery.sql);
      
      if (response.success && response.data) {
        const batchResults = response.data.results as SqlStatementResult[];
        
        setBatchResults(activeQueryId, batchResults);
        
        const successResults = batchResults.filter(r => r.success);
        const lastQueryResult = successResults.length > 0 ? successResults[successResults.length - 1] : null;
        
        if (lastQueryResult && lastQueryResult.columns && lastQueryResult.rows) {
          setQueryResult(activeQueryId, {
            columns: lastQueryResult.columns,
            rows: lastQueryResult.rows,
          });
        }
        
        // 添加到查询历史
        const successCount = successResults.length;
        const hasSuccess = successCount > 0;
        const rowCount = lastQueryResult?.rows?.length;
        addToHistory(activeQuery.sql, hasSuccess, rowCount);
        
        if (hasSuccess) {
          setMessage(`查询执行成功，${successCount} 个语句成功`, 'success');
        } else {
          setMessage('查询执行失败', 'error');
        }
      } else {
        console.error('查询失败:', response.error);
        setMessage(response.error || '查询失败', 'error');
        addToHistory(activeQuery.sql, false);
      }
    } catch (error) {
      console.error('查询异常:', error);
      setMessage('查询执行异常', 'error');
      addToHistory(activeQuery.sql, false);
    } finally {
      setQueryLoading(null);
    }
  }, [activeQuery, activeQueryId, setQueryLoading, setQueryResult, setBatchResults, addToHistory, setMessage]);

  return {
    executeQuery,
    isLoading: useQueryStore(state => state.queryLoading) === activeQueryId,
  };
};

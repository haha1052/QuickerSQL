import { useCallback } from 'react';
import { useQueryStore, useAppStore } from '../../../store';
import { tauriService } from '../../../services';
import { useLocale } from '../../../context/LocaleContext';
import type { SqlStatementResult } from '../../../types';

export const useQueryExecution = () => {
  const { t } = useLocale();
  const { sqlQueries, activeQueryId, setQueryLoading, setQueryResult, setBatchResults, addToHistory } = useQueryStore();
  const { setMessage } = useAppStore();

  const activeQuery = sqlQueries.find(q => q.id === activeQueryId);

  const executeQuery = useCallback(async () => {
    if (!activeQuery) {
      setMessage(t('hooks.pleaseSelectQuery'), 'warning');
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
          setMessage(`${t('hooks.querySuccess').replace('{count}', String(successCount))}`, 'success');
        } else {
          setMessage(t('hooks.queryFail'), 'error');
        }
      } else {
        console.error(t('hooks.queryError'), response.error);
        setMessage(response.error || t('hooks.queryFail'), 'error');
        addToHistory(activeQuery.sql, false);
      }
    } catch (error) {
      console.error(t('hooks.queryError'), error);
      setMessage(t('hooks.queryError'), 'error');
      addToHistory(activeQuery.sql, false);
    } finally {
      setQueryLoading(null);
    }
  }, [t, activeQuery, activeQueryId, setQueryLoading, setQueryResult, setBatchResults, addToHistory, setMessage]);

  return {
    executeQuery,
    isLoading: useQueryStore(state => state.queryLoading) === activeQueryId,
  };
};

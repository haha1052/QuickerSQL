import { useCallback } from 'react';
import { useQueryStore, useAppStore } from '../../../store';
import { tauriService } from '../../../services';
import { useLocale } from '../../../context/LocaleContext';
import type { SqlStatementResult } from '../../../types';

export const useQueryExecution = () => {
  const { t } = useLocale();
  const { sqlQueries, activeQueryId, setQueryLoading, setBatchResults, addToHistory } = useQueryStore();
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
      
      console.log('[useQueryExecution] Response:', response);
      
      if (response.success && response.data) {
        const batchResults = response.data.results as SqlStatementResult[];
        
        console.log('[useQueryExecution] batchResults:', batchResults);
        
        if (!batchResults || !Array.isArray(batchResults)) {
          console.error('[useQueryExecution] Invalid batchResults format:', response.data);
          setMessage('查询结果格式错误', 'error');
          return;
        }
        
        // 唯一数据源写入，无异步时序冲突
        setBatchResults(activeQueryId, batchResults);
        
        // 添加到查询历史（基于批量结果）
        const successResults = batchResults.filter(r => r.success);
        const totalRows = successResults.reduce((sum, item) => sum + (item.rows?.length || 0), 0);
        const hasSuccess = successResults.length > 0;
        addToHistory(activeQuery.sql, hasSuccess, totalRows);
        
        if (hasSuccess) {
          setMessage(`${t('hooks.querySuccess').replace('{count}', String(successResults.length))}`, 'success');
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
  }, [t, activeQuery, activeQueryId, setQueryLoading, setBatchResults, addToHistory, setMessage]);

  return {
    executeQuery,
    isLoading: useQueryStore(state => state.queryLoading) === activeQueryId,
  };
};

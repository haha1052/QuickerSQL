import { useCallback, useEffect } from 'react';
import { useQueryStore, useAppStore } from '../../../store';
import { tauriService } from '../../../services';
import { useLocale } from '../../../context/LocaleContext';
import { useSetting } from '../../../context/SettingsContext';
import type { SqlStatementResult } from '../../../types';
import { applyDefaultSelectLimit } from '../../../utils/sqlStatementParser';

/**
 * 模块级选中文本获取器
 * SQLEditor 在 mount 时注册，unmount 时清除
 * 用于执行按钮点击时获取编辑器当前选中的 SQL 文本
 */
export const editorSelectionGetter: { current: (() => string | undefined) | null } = {
  current: null,
};

export const useQueryExecution = () => {
  const { t } = useLocale();
  const sqlQueries = useQueryStore(s => s.sqlQueries);
  const activeQueryId = useQueryStore(s => s.activeQueryId);
  const setQueryLoading = useQueryStore(s => s.setQueryLoading);
  const setBatchResults = useQueryStore(s => s.setBatchResults);
  const addToHistory = useQueryStore(s => s.addToHistory);
  const trimHistory = useQueryStore(s => s.trimHistory);
  const { setMessage } = useAppStore();
  const [maxHistorySizeStr] = useSetting('sql', 'maxHistorySize');
  const [defaultSelectLimitStr] = useSetting('sql', 'defaultSelectLimit');
  const maxHistorySize = parseInt(maxHistorySizeStr || '100', 10) || 100;
  const defaultSelectLimit = parseInt(defaultSelectLimitStr || '0', 10) || 0;

  useEffect(() => {
    trimHistory(maxHistorySize);
  }, [maxHistorySize, trimHistory]);

  const activeQuery = sqlQueries.find(q => q.id === activeQueryId);

  const executeSelectedOrAll = useCallback(async (selectedSql?: string) => {
    if (!activeQuery) {
      setMessage(t('hooks.pleaseSelectQuery'), 'warning');
      return;
    }

    // 优先使用选中文本，trim 后非空则用之；否则回退到 activeQuery.sql
    const trimmedSelected = selectedSql?.trim();
    const hasSelection = !!trimmedSelected && trimmedSelected.length > 0;
    const sqlSource = hasSelection ? (trimmedSelected as string) : activeQuery.sql;

    setQueryLoading(activeQueryId);
    const startTime = performance.now();
    try {
      const sqlToExecute = applyDefaultSelectLimit(sqlSource, defaultSelectLimit);
      const response = await tauriService.executeSql(sqlToExecute);

      if (response.success && response.data) {
        const batchResults = response.data.results as SqlStatementResult[];

        if (!batchResults || !Array.isArray(batchResults)) {
          console.error('[useQueryExecution] Invalid batchResults format:', response.data);
          setMessage(t('error.query.parse_failed'), 'error');
          return;
        }

        const endTime = performance.now();
        const totalExecutionMs = endTime - startTime;

        const resultsWithTime = batchResults.map((result) => ({
          ...result,
          executionTimeMs: result.executionTimeMs ?? totalExecutionMs,
        }));

        // 唯一数据源写入，无异步时序冲突
        setBatchResults(activeQueryId, resultsWithTime);

        // 添加到查询历史（基于批量结果，记录实际执行的 SQL：选中部分或全部）
        const successResults = resultsWithTime.filter(r => r.success);
        const totalRows = successResults.reduce((sum, item) => sum + (item.rows?.length || 0), 0);
        const hasSuccess = successResults.length > 0;
        addToHistory(sqlSource, hasSuccess, totalRows, maxHistorySize);

        if (hasSuccess) {
          setMessage(`${t('hooks.querySuccess').replace('{count}', String(successResults.length))}`, 'success');
        } else {
          setMessage(t('hooks.queryFail'), 'error');
        }
      } else {
        console.error('[useQueryExecution] SQL execution error:', response.error);
        setMessage(t('error.query.check_syntax'), 'error');
        addToHistory(sqlSource, false, null, maxHistorySize);
      }
    } catch (error) {
      console.error('[useQueryExecution] SQL execution exception:', error);
      setMessage(t('error.query.check_syntax'), 'error');
      addToHistory(sqlSource, false, null, maxHistorySize);
    } finally {
      setQueryLoading(null);
    }
  }, [t, activeQuery, activeQueryId, setQueryLoading, setBatchResults, addToHistory, setMessage, maxHistorySize, defaultSelectLimit]);

  const executeQuery = useCallback(async () => {
    await executeSelectedOrAll(undefined);
  }, [executeSelectedOrAll]);

  return {
    executeQuery,
    executeSelectedOrAll,
    isLoading: useQueryStore(state => state.queryLoading) === activeQueryId,
  };
};

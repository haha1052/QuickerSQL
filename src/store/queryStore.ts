import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SqlQuery, QueryResult, QueryHistoryItem, SqlStatementResult } from '../types';

interface QueryState {
  sqlQueries: SqlQuery[];
  activeQueryId: string;
  queryLoading: string | null;
  queryHistory: QueryHistoryItem[];
  jumpToLine: number | null;
  
  setSqlQueries: (queries: SqlQuery[]) => void;
  addSqlQuery: () => void;
  updateSqlQuery: (id: string, updates: Partial<SqlQuery>) => void;
  removeSqlQuery: (id: string) => void;
  setActiveQueryId: (id: string) => void;
  setQueryLoading: (id: string | null) => void;
  setQueryResult: (id: string, result: QueryResult | null) => void;
  setBatchResults: (id: string, batchResults: SqlStatementResult[] | null) => void;
  setJumpToLine: (lineNumber: number | null) => void;
  addToHistory: (sql: string, success?: boolean, rowCount?: number | null, maxSize?: number) => void;
  trimHistory: (maxSize: number) => void;
  removeFromHistory: (id: string) => void;
  clearHistory: () => void;
}

export const useQueryStore = create<QueryState>()(
  persist(
    (set) => ({
      sqlQueries: [
        { 
          id: '1', 
          name: '查询 1', 
          sql: 'SELECT * FROM my_table', // safe_sql: 默认 SQL 示例文案（用户首次打开查询页的初始内容）
          result: null, 
          batchResults: null 
        }
      ],
      activeQueryId: '1',
      queryLoading: null,
      queryHistory: [],
      jumpToLine: null,

      setSqlQueries: (queries) => set({ sqlQueries: queries }),
      
      addSqlQuery: () => set((state) => {
        const newId = Date.now().toString();
        const queryNumber = state.sqlQueries.length + 1;
        const newQueries = [
          ...state.sqlQueries,
          { 
            id: newId, 
            name: `查询 ${queryNumber}`, 
            sql: '', 
            result: null, 
            batchResults: null 
          }
        ];
        return { 
          sqlQueries: newQueries, 
          activeQueryId: newId 
        };
      }),
      
      updateSqlQuery: (id, updates) => set((state) => ({
        sqlQueries: state.sqlQueries.map((query) =>
          query.id === id ? { ...query, ...updates } : query
        ),
      })),
      
      removeSqlQuery: (id) => set((state) => {
        if (state.sqlQueries.length <= 1) return state;
        
        const filtered = state.sqlQueries.filter((query) => query.id !== id);
        return {
          sqlQueries: filtered,
          activeQueryId: state.activeQueryId === id 
            ? (filtered[0]?.id || '1')
            : state.activeQueryId,
        };
      }),
      
      setActiveQueryId: (id) => set({ activeQueryId: id }),
      
      setQueryLoading: (id) => set({ queryLoading: id }),
      
      setQueryResult: (id, result) => set((state) => ({
        sqlQueries: state.sqlQueries.map((query) =>
          query.id === id ? { ...query, result } : query
        ),
      })),
      
      setBatchResults: (id, batchResults) => set((state) => ({
        sqlQueries: state.sqlQueries.map((query) =>
          query.id === id ? { ...query, batchResults } : query
        ),
      })),
      
      setJumpToLine: (lineNumber) => set({ jumpToLine: lineNumber }),
      
      addToHistory: (sql, success, rowCount, maxSize) => set((state) => {
        const newItem: QueryHistoryItem = {
          id: `history_${Date.now()}`,
          sql,
          executed_at: new Date().toISOString(),
          success: success ?? false,
          row_count: rowCount ?? null,
          is_favorite: false,
        };
        const limit = maxSize ?? 100;
        const filtered = state.queryHistory.filter(h => h.sql !== sql);
        return {
          queryHistory: [newItem, ...filtered].slice(0, limit),
        };
      }),

      trimHistory: (maxSize) => set((state) => {
        if (state.queryHistory.length <= maxSize) return state;
        return {
          queryHistory: state.queryHistory.slice(0, maxSize),
        };
      }),

      removeFromHistory: (id) => set((state) => ({
        queryHistory: state.queryHistory.filter(h => h.id !== id),
      })),
      
      clearHistory: () => set({ queryHistory: [] }),
    }),
    {
      name: 'quickersql-query',
      partialize: (state) => ({
        queryHistory: state.queryHistory,
        sqlQueries: state.sqlQueries.map((q) => ({
          id: q.id,
          name: q.name,
          sql: q.sql,
          result: null,
          batchResults: null,
        })),
        activeQueryId: state.activeQueryId,
      }),
    }
  )
);

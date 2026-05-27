import { create } from 'zustand';
import type { SqlQuery, QueryResult } from '../types';

interface QueryState {
  sqlQueries: SqlQuery[];
  activeQueryId: string;
  queryLoading: string | null;
  
  setSqlQueries: (queries: SqlQuery[]) => void;
  addSqlQuery: () => void;
  updateSqlQuery: (id: string, updates: Partial<SqlQuery>) => void;
  removeSqlQuery: (id: string) => void;
  setActiveQueryId: (id: string) => void;
  setQueryLoading: (id: string | null) => void;
  setQueryResult: (id: string, result: QueryResult | null) => void;
}

export const useQueryStore = create<QueryState>((set) => ({
  sqlQueries: [
    { 
      id: '1', 
      name: '查询 1', 
      sql: 'SELECT * FROM my_table', 
      result: null, 
      batchResults: null 
    }
  ],
  activeQueryId: '1',
  queryLoading: null,

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
}));

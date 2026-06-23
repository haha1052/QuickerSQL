import { create } from 'zustand';
import { tauriService } from '../services/tauri';
import { useToastStore } from './toastStore';
import type { ColumnInfo, TableInfo } from '../types';
import type { TableMetaInfo } from '../types/table';

interface TableStoreState {
  /** 表列表（由 listTables 加载得到） */
  tables: TableInfo[];
  /** 表列表是否正在加载 */
  loading: boolean;
  /** 当前选中的表名（可选，供其他组件订阅） */
  currentTable: string | null;
  /** 最近一次错误消息 */
  error: string | null;
  /** 列信息缓存（按表名），由 DatabaseExplorer 按需加载 */
  columnsCache: Record<string, ColumnInfo[]>;
  /** 每张表是否正处于加载中状态 */
  columnsLoading: Record<string, boolean>;
  /** 元数据缓存（index_count, size_bytes） */
  metaCache: Record<string, TableMetaInfo>;

  // ===== 操作 =====
  listTables: () => Promise<void>;
  getTableColumns: (tableName: string) => Promise<void>;
  moveToTrash: (tableName: string) => Promise<boolean>;
  renameTable: (oldTableName: string, newTableName: string) => Promise<boolean>;
  getTableMeta: (tableName: string) => Promise<void>;
  setCurrentTable: (tableName: string | null) => void;
  setTables: (tables: TableInfo[]) => void;
}

export const useTableStore = create<TableStoreState>((set, get) => ({
  tables: [],
  loading: false,
  currentTable: null,
  error: null,
  columnsCache: {},
  columnsLoading: {},
  metaCache: {},

  setCurrentTable: (tableName) => set({ currentTable: tableName }),

  setTables: (tables) => set({ tables }),

  async listTables() {
    set({ loading: true, error: null });
    try {
      const response = await tauriService.listTables();
      if (!response.success) {
        throw new Error(response.error || '加载表列表失败');
      }
      set({ tables: response.data ?? [], error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      useToastStore.getState().addToast(`加载表列表失败: ${message}`, 'error');
      set({ error: message });
    } finally {
      set({ loading: false });
    }
  },

  async getTableColumns(tableName) {
    const prevLoading = get().columnsLoading;
    if (get().columnsCache[tableName] || prevLoading[tableName]) return;

    set({
      columnsLoading: { ...prevLoading, [tableName]: true },
    });
    try {
      const response = await tauriService.getTableColumns(tableName);
      if (response.success && response.data) {
        set((state) => ({
          columnsCache: {
            ...state.columnsCache,
            [tableName]: response.data ?? [],
          },
        }));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[tableStore] getTableColumns 失败:', err);
      set({ error: message });
    } finally {
      set((state) => {
        const nextLoading = { ...state.columnsLoading };
        delete nextLoading[tableName];
        return { columnsLoading: nextLoading };
      });
    }
  },

  async getTableMeta(tableName) {
    if (get().metaCache[tableName]) return;
    try {
      const response = await tauriService.getTableMeta(tableName);
      if (response.success && response.data) {
        set((state) => ({
          metaCache: {
            ...state.metaCache,
            [tableName]: response.data as TableMetaInfo,
          },
        }));
      }
    } catch (err) {
      console.error('[tableStore] getTableMeta 失败:', err);
    }
  },

  async moveToTrash(tableName) {
    try {
      const response = await tauriService.moveToTrash(tableName);
      if (!response.success) {
        throw new Error(response.error || '移到回收站失败');
      }
      useToastStore.getState().addToast(`表 "${tableName}" 已移到回收站`, 'success');
      // 刷新表列表
      await get().listTables();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      useToastStore.getState().addToast(`删除失败: ${message}`, 'error');
      set({ error: message });
      return false;
    }
  },

  async renameTable(oldTableName, newTableName) {
    try {
      const response = await tauriService.renameTable(oldTableName, newTableName);
      if (!response.success) {
        throw new Error(response.error || '重命名表失败');
      }
      useToastStore.getState().addToast(`表已重命名为 "${newTableName}"`, 'success');
      // 清除旧表名的缓存，并刷新表列表
      set((state) => {
        const nextCols = { ...state.columnsCache };
        delete nextCols[oldTableName];
        const nextMeta = { ...state.metaCache };
        delete nextMeta[oldTableName];
        return { columnsCache: nextCols, metaCache: nextMeta };
      });
      await get().listTables();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      useToastStore.getState().addToast(`重命名失败: ${message}`, 'error');
      set({ error: message });
      return false;
    }
  },
}));

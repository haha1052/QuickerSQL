/**
 * 数据表状态管理 Store
 *
 * 基于 Zustand 实现，负责管理数据库表相关的状态与操作，包括：
 *   - 表列表的加载与缓存
 *   - 表列信息的按需加载与缓存
 *   - 表元数据（索引数、大小等）的加载与缓存
 *   - 表的删除（移至回收站）与重命名操作
 *   - 当前选中表的状态管理
 *
 * 设计特点：
 *   1. 采用按需加载 + 缓存策略，避免重复请求后端
 *   2. 列信息和元数据按表名独立缓存，提升浏览体验
 *   3. 操作失败时通过 toastStore 统一提示用户
 */

import { create } from 'zustand';
import { tauriService } from '../services/tauri';
import { useToastStore } from './toastStore';
import type { ColumnInfo, TableInfo } from '../types';
import type { TableMetaInfo } from '../types/table';

/**
 * 数据表 Store 状态与操作接口
 *
 * 管理表列表、列信息、元数据的加载与缓存，
 * 以及表的删除、重命名等操作。
 */
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
  /** 加载数据库中的所有表列表 */
  listTables: () => Promise<void>;
  /**
   * 加载指定表的列信息（带缓存，已加载或加载中则跳过）
   *
   * @param tableName 目标表名
   */
  getTableColumns: (tableName: string) => Promise<void>;
  /**
   * 将表移至回收站
   *
   * @param tableName 目标表名
   * @returns 操作是否成功
   */
  moveToTrash: (tableName: string) => Promise<boolean>;
  /**
   * 重命名表
   *
   * @param oldTableName 原表名
   * @param newTableName 新表名
   * @returns 操作是否成功
   */
  renameTable: (oldTableName: string, newTableName: string) => Promise<boolean>;
  /**
   * 加载指定表的元数据（索引数、大小等，带缓存）
   *
   * @param tableName 目标表名
   */
  getTableMeta: (tableName: string) => Promise<void>;
  /**
   * 设置当前选中的表
   *
   * @param tableName 目标表名，null 表示取消选中
   */
  setCurrentTable: (tableName: string | null) => void;
  /**
   * 直接设置表列表（用于外部批量更新）
   *
   * @param tables 表列表数据
   */
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
        throw new Error(response.error || 'error.table.loadListFailed');
      }
      set({ tables: response.data ?? [], error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[listTables] failed:', err);
      useToastStore.getState().addToast({ key: 'error.table.load_failed' }, 'error');
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
        throw new Error(response.error || 'error.table.trashFailed');
      }
      useToastStore.getState().addToast({ key: 'table.movedToTrash', vars: { name: tableName } }, 'success');
      // 刷新表列表
      await get().listTables();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[moveToTrash] failed:', err);
      useToastStore.getState().addToast({ key: 'error.table.delete_failed' }, 'error');
      set({ error: message });
      return false;
    }
  },

  async renameTable(oldTableName, newTableName) {
    try {
      const response = await tauriService.renameTable(oldTableName, newTableName);
      if (!response.success) {
        throw new Error(response.error || 'error.table.renameFailed');
      }
      useToastStore.getState().addToast({ key: 'table.renamed', vars: { name: newTableName } }, 'success');
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
      console.error('[renameTable] failed:', err);
      useToastStore.getState().addToast({ key: 'error.table.rename_failed' }, 'error');
      set({ error: message });
      return false;
    }
  },
}));

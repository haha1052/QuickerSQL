import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  WorkspaceState,
  WorkspaceTab,
  Panel,
  PanelType,
  WorkspaceTabType
} from '../types';
import { useQueryStore } from './queryStore';
import { tauriService } from '../services';

// ============ 侧栏宽度常量（与 SidebarResizeHandle.tsx 保持一致） ============
export const SIDEBAR_MIN_WIDTH = 180;
export const SIDEBAR_DEFAULT_WIDTH = 250;
export const SIDEBAR_MAX_WIDTH = 600;

interface WorkspaceStore extends WorkspaceState {
  // ============ 标签页操作 ============
  addTab: (tab: Omit<WorkspaceTab, 'id' | 'createdAt' | 'queryId'>, options?: { queryId?: string; initialSql?: string }) => void;
  removeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<WorkspaceTab>) => void;

  // ============ 面板操作 ============
  addPanel: (tabId: string, panel: Omit<Panel, 'id'>) => void;
  removePanel: (tabId: string, panelId: string) => void;
  updatePanel: (tabId: string, panelId: string, updates: Partial<Panel>) => void;

  // ============ 侧边栏 ============
  toggleSidebar: () => void;
  /** 设置侧栏宽度（只改 state，不主动触发 DB 同步；拖拽结束时外部显式调用 triggerAutoSave） */
  setSidebarWidth: (width: number) => void;
  /** 复位侧栏宽度到默认值（主动触发 DB 同步） */
  resetSidebarWidth: () => void;
  setSidebarActiveTab: (tab: 'explorer' | 'history' | 'snippets' | 'trash') => void;

  // ============ 查询面板布局模式 ============
  /** 设置面板模式：default / editor / results / only-editor / only-results */
  setPanelMode: (tabId: string, mode: 'default' | 'editor' | 'results' | 'only-editor' | 'only-results') => void;

  // ============ 后端同步 ============
  /** 从后端数据库加载工作区布局 */
  loadFromBackend: () => Promise<void>;
  /** 将工作区布局同步到后端数据库 */
  syncToBackend: () => Promise<void>;
  /** 触发一次延迟自动保存（debounced） */
  triggerAutoSave: () => void;
  /** 是否已连接到后端 */
  isBackedUp: boolean;
  /** 上次保存时间 */
  lastSavedAt: number | null;
}

/** 将前端 WorkspaceTab 转换为后端 save_workspace 需要的格式 */
function tabsToBackendFormat(tabs: WorkspaceTab[]): Array<{
  id: string;
  title: string;
  tab_type: string;
  position: number;
  is_active: boolean;
  panels: Array<{
    id: string;
    panel_type: string;
    title: string;
    size: number;
    sql_content: string | null;
    is_active: boolean;
    position: number;
  }>;
}> {
  return tabs.map((tab, tabIdx) => ({
    id: tab.id,
    title: tab.title,
    tab_type: tab.type,
    position: tabIdx,
    is_active: tab.active,
    panels: tab.panels.map((panel, panelIdx) => ({
      id: panel.id,
      panel_type: panel.type,
      title: panel.title,
      size: Math.round(panel.size),
      sql_content: panel.content,
      is_active: panel.active,
      position: panelIdx,
    })),
  }));
}

interface BackendTabPanel {
  id: string;
  panel_type?: string;
  type?: string;
  title?: string;
  size?: number;
  sql_content?: unknown;
  active?: boolean;
  is_active?: boolean;
  position?: number;
}

interface BackendWorkspaceTab {
  id: string;
  title?: string;
  tab_type?: string;
  type?: string;
  position?: number;
  is_active?: boolean;
  active?: boolean;
  panels?: BackendTabPanel[];
}

/** 将后端返回的 tabs 数据转换为前端 WorkspaceTab 格式 */
function tabsFromBackendFormat(backendTabs: BackendWorkspaceTab[] | undefined | null): WorkspaceTab[] {
  if (!backendTabs || backendTabs.length === 0) return [];

  return backendTabs.map((tab: BackendWorkspaceTab) => ({
    id: tab.id,
    title: tab.title || '',
    type: (tab.tab_type || tab.type || 'sql') as WorkspaceTabType,
    panels: (tab.panels || []).map((panel: BackendTabPanel) => ({
      id: panel.id,
      type: (panel.panel_type || panel.type || 'sql_editor') as PanelType,
      title: panel.title || '',
      size: typeof panel.size === 'number' ? panel.size : parseInt(String(panel.size ?? '0'), 10) || 100,
      active: typeof panel.is_active === 'boolean' ? panel.is_active : panel.active !== false,
      content: (panel.sql_content ?? null) as string | null,
    })),
    active: typeof tab.is_active === 'boolean' ? tab.is_active : tab.active !== false,
    createdAt: Date.now(),
    queryId: '',
  }));
}

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
const AUTO_SAVE_DELAY = 1500;

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set, get) => ({
      // ============ 初始状态 ============
      tabs: [
        {
          id: 'default_sql',
          title: 'SQL Query 1',
          type: 'sql' as WorkspaceTabType,
          panels: [
            {
              id: 'editor',
              type: 'sql_editor' as PanelType,
              title: 'SQL Editor',
              size: 50,
              active: true,
              content: null,
            },
            {
              id: 'results',
              type: 'results_grid' as PanelType,
              title: 'Results',
              size: 50,
              active: true,
              content: null,
            },
          ],
          active: true,
          createdAt: Date.now(),
          queryId: '1', // 关联到初始查询
        },
      ],
      activeTabId: 'default_sql',

      sidebar: {
        collapsed: false,
        width: 250,
        activeTab: 'explorer',
      },

      isBackedUp: false,
      lastSavedAt: null,

      // ============ 标签页操作 ============
      addTab: (tab, options = {}) => {
        const { queryId: existingQueryId, initialSql } = options;
        const { addSqlQuery, updateSqlQuery, setActiveQueryId } = useQueryStore.getState();

        let finalQueryId: string;
        if (existingQueryId) {
          // 使用已存在的 queryId，不再创建新查询
          finalQueryId = existingQueryId;
        } else {
          // 创建新查询（可选：带上初始 SQL）
          addSqlQuery();
          const { sqlQueries } = useQueryStore.getState();
          const newQuery = sqlQueries[sqlQueries.length - 1];
          finalQueryId = newQuery.id;
          if (initialSql) {
            updateSqlQuery(finalQueryId, { sql: initialSql });
          }
        }

        // 激活当前 query
        setActiveQueryId(finalQueryId);

        const newId = `tab_${Date.now()}`;
        set((state) => ({
          tabs: [
            ...state.tabs.map((t) => ({ ...t, active: false })),
            {
              ...tab,
              id: newId,
              active: true,
              createdAt: Date.now(),
              queryId: finalQueryId,
            },
          ],
          activeTabId: newId,
        }));

        get().triggerAutoSave();
      },

      removeTab: (tabId) => {
        const state = get();
        if (state.tabs.length <= 1) return;

        // 获取要删除的标签页的 queryId
        const tabToRemove = state.tabs.find((t) => t.id === tabId);
        if (tabToRemove && tabToRemove.queryId) {
          const { removeSqlQuery } = useQueryStore.getState();
          try {
            removeSqlQuery(tabToRemove.queryId);
          } catch (e) {
            console.warn('Query already removed:', tabToRemove.queryId);
          }
        }

        const filtered = state.tabs.filter((t) => t.id !== tabId);
        const newActiveId = filtered[filtered.length - 1].id;

        const newActiveTab = filtered.find((t) => t.id === newActiveId);
        if (newActiveTab && newActiveTab.queryId) {
          const { setActiveQueryId } = useQueryStore.getState();
          setActiveQueryId(newActiveTab.queryId);
        }

        set({
          tabs: filtered.map((t) =>
            t.id === newActiveId ? { ...t, active: true } : t
          ),
          activeTabId: newActiveId,
        });

        get().triggerAutoSave();
      },

      setActiveTab: (tabId) => {
        set((state) => {
          const targetTab = state.tabs.find((t) => t.id === tabId);

          if (targetTab && targetTab.queryId) {
            const { setActiveQueryId } = useQueryStore.getState();
            setActiveQueryId(targetTab.queryId);
          }

          return {
            tabs: state.tabs.map((t) => ({
              ...t,
              active: t.id === tabId,
            })),
            activeTabId: tabId,
          };
        });
      },

      updateTab: (tabId, updates) => {
        set((state) => ({
          tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, ...updates } : t)),
        }));
        get().triggerAutoSave();
      },

      // ============ 面板操作 ============
      addPanel: (tabId, panel) => {
        set((state) => ({
          tabs: state.tabs.map((t) => {
            if (t.id === tabId) {
              return {
                ...t,
                panels: [...t.panels, { ...panel, id: `panel_${Date.now()}` }],
              };
            }
            return t;
          }),
        }));
        get().triggerAutoSave();
      },

      removePanel: (tabId, panelId) => {
        set((state) => ({
          tabs: state.tabs.map((t) => {
            if (t.id === tabId) {
              return {
                ...t,
                panels: t.panels.filter((p) => p.id !== panelId),
              };
            }
            return t;
          }),
        }));
        get().triggerAutoSave();
      },

      updatePanel: (tabId, panelId, updates) => {
        set((state) => ({
          tabs: state.tabs.map((t) => {
            if (t.id === tabId) {
              return {
                ...t,
                panels: t.panels.map((p) =>
                  p.id === panelId ? { ...p, ...updates } : p
                ),
              };
            }
            return t;
          }),
        }));
        get().triggerAutoSave();
      },

      // ============ 侧边栏 ============
      toggleSidebar: () => {
        set((state) => ({
          sidebar: { ...state.sidebar, collapsed: !state.sidebar.collapsed },
        }));
        get().triggerAutoSave();
      },

      setSidebarWidth: (width) => {
        // 只更新宽度，不触发 DB 同步（拖拽频繁，避免频繁写库）
        set((state) => ({
          sidebar: {
            ...state.sidebar,
            width: Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width)),
          },
        }));
        // 注意：这里不 triggerAutoSave，由调用方（手柄 mouseup / reset）主动调
      },

      resetSidebarWidth: () => {
        set((state) => ({
          sidebar: { ...state.sidebar, width: SIDEBAR_DEFAULT_WIDTH },
        }));
        get().triggerAutoSave();
      },

      setSidebarActiveTab: (tab) => {
        set((state) => ({
          sidebar: { ...state.sidebar, activeTab: tab },
        }));
      },

      // ============ 查询面板布局模式 ============
      setPanelMode: (tabId, mode) => {
        const PANEL_MODE_SIZES: Record<string, [number, number]> = {
          'default': [50, 50],          // 默认 50/50
          'editor': [80, 20],            // 编辑器优先
          'results': [20, 80],           // 结果优先
          'only-editor': [100, 0],       // 仅编辑器
          'only-results': [0, 100],      // 仅结果
        };
        const [editorSize, resultsSize] = PANEL_MODE_SIZES[mode] || [50, 50];

        set((state) => ({
          tabs: state.tabs.map((t) => {
            if (t.id !== tabId) return t;
            return {
              ...t,
              panels: t.panels.map((p) => {
                if (p.id === 'editor') return { ...p, size: editorSize };
                if (p.id === 'results') return { ...p, size: resultsSize };
                return p;
              }),
            };
          }),
        }));
        get().triggerAutoSave();
      },

      // ============ 后端同步 ============
      triggerAutoSave: () => {
        if (autoSaveTimer) {
          clearTimeout(autoSaveTimer);
        }
        autoSaveTimer = setTimeout(() => {
          get().syncToBackend();
        }, AUTO_SAVE_DELAY);
      },

      syncToBackend: async () => {
        try {
          const { tabs } = get();
          const formattedTabs = tabsToBackendFormat(tabs);
          await tauriService.saveWorkspace(formattedTabs);
          set({ isBackedUp: true, lastSavedAt: Date.now() });
        } catch (err) {
          console.warn('[workspace] 保存到后端失败, 使用本地缓存:', err);
          set({ isBackedUp: false });
        }
      },

      loadFromBackend: async () => {
        try {
          const result = await tauriService.loadWorkspace();

          if (!result.success || !result.data || result.data.length === 0) {
            // 后端没有数据, 继续使用当前状态 (或本地 fallback)
            return;
          }

          const convertedTabs = tabsFromBackendFormat(result.data);
          if (convertedTabs.length === 0) return;

          // 基于 SqlQuery.id 精确关联，而不是依赖数组索引
          // 策略：
          //   1. 优先从现有 sqlQueries 中按 id 精确查找（保留持久化后的对应关系）
          //   2. 找不到匹配的 id 时，从第一个未被占用的 SqlQuery 分配
          //   3. 不够用时新建查询
          const queryState = useQueryStore.getState();
          const usedQueryIds = new Set<string>();
          const findUnusedQuery = (): typeof queryState.sqlQueries[number] | undefined => {
            return queryState.sqlQueries.find(q => !usedQueryIds.has(q.id));
          };

          const mappedTabs = convertedTabs.map((tab) => {
            // 优先：sqlQueries 中按 id 精确匹配
            let matchedQuery = queryState.sqlQueries.find(q => q.id === tab.queryId && !usedQueryIds.has(q.id));

            if (matchedQuery) {
              usedQueryIds.add(matchedQuery.id);
              return { ...tab, queryId: matchedQuery.id };
            }

            // 回退：从第一个未被占用的查询分配
            const unused = findUnusedQuery();
            if (unused) {
              usedQueryIds.add(unused.id);
              return { ...tab, queryId: unused.id };
            }

            // 不足：新建查询并关联
            queryState.addSqlQuery();
            const { sqlQueries: updated } = useQueryStore.getState();
            const newQuery = updated[updated.length - 1];
            usedQueryIds.add(newQuery.id);
            return { ...tab, queryId: newQuery.id };
          });

          // 确保 activeTabId 有效
          const activeTab = mappedTabs.find((t) => t.active) || mappedTabs[0];

          set({
            tabs: mappedTabs,
            activeTabId: activeTab.id,
            isBackedUp: true,
            lastSavedAt: Date.now(),
          });

          // 同步激活的查询
          if (activeTab.queryId) {
            useQueryStore.getState().setActiveQueryId(activeTab.queryId);
          }
        } catch (err) {
          console.warn('[workspace] 从后端加载失败, 使用本地缓存:', err);
        }
      },
    }),
    {
      name: 'quickersql-workspace',
      partialize: (state) => ({
        tabs: state.tabs,
        sidebar: state.sidebar,
      }),
      version: 1,
      migrate: (persistedState: unknown, version: number) => {
        if (version < 1) {
          const { sqlQueries } = useQueryStore.getState();

          if (persistedState && typeof persistedState === 'object' && 'tabs' in (persistedState as Record<string, unknown>)) {
            const casted = persistedState as { tabs: Array<{ queryId?: string; [k: string]: unknown }> };
            casted.tabs = casted.tabs.map(
              (tab, index: number) => {
                if (!tab.queryId) {
                  const queryId =
                    sqlQueries[index]?.id ||
                    `migrated_query_${Date.now()}_${index}`;
                  return { ...tab, queryId };
                }
                return tab;
              }
            );
          }
        }
        // 版本 >=1 时：rightPanel 字段已废弃，直接丢弃
        return persistedState;
      },
    }
  )
);

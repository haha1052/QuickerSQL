/**
 * 工作区状态管理 Store
 *
 * 基于 Zustand 实现，负责管理 SQL 编辑器工作区的整体布局状态，包括：
 *   - 标签页（Tabs）的增删改查与激活切换
 *   - 面板（Panels）的布局管理（SQL 编辑器、结果面板等）
 *   - 侧边栏的折叠、宽度与激活标签
 *   - 查询面板布局模式切换
 *   - 与后端数据库的双向同步（自动保存 + 手动加载）
 *
 * 设计特点：
 *   1. 使用 persist 中间件将关键状态持久化到 localStorage，作为后端同步失败时的 fallback
 *   2. 自动保存采用 debounce 策略（1.5 秒），避免频繁写库
 *   3. 启动时优先消费 StartupContext 缓存的 workspaceLayout，减少一次 IPC 调用
 *   4. 标签页与 SqlQuery 一一对应，通过 queryId 关联
 */

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
/** 侧边栏最小宽度（像素） */
export const SIDEBAR_MIN_WIDTH = 180;
/** 侧边栏默认宽度（像素） */
export const SIDEBAR_DEFAULT_WIDTH = 250;
/** 侧边栏最大宽度（像素） */
export const SIDEBAR_MAX_WIDTH = 600;

/**
 * 工作区 Store 状态与操作接口
 *
 * 继承自 WorkspaceState，扩展了标签页、面板、侧边栏、布局模式等操作方法，
 * 以及与后端同步相关的状态与方法。
 */
interface WorkspaceStore extends WorkspaceState {
  // ============ 标签页操作 ============
  /**
   * 新增一个标签页
   *
   * @param tab 标签页数据（不含 id、createdAt、queryId，由内部生成）
   * @param options 可选配置：queryId 复用已有查询 / initialSql 初始 SQL 内容
   */
  addTab: (tab: Omit<WorkspaceTab, 'id' | 'createdAt' | 'queryId'>, options?: { queryId?: string; initialSql?: string }) => void;
  /**
   * 移除指定标签页
   *
   * @param tabId 要移除的标签页 ID
   */
  removeTab: (tabId: string) => void;
  /**
   * 设置激活的标签页
   *
   * @param tabId 目标标签页 ID
   */
  setActiveTab: (tabId: string) => void;
  /**
   * 更新指定标签页的属性
   *
   * @param tabId 目标标签页 ID
   * @param updates 要更新的属性
   */
  updateTab: (tabId: string, updates: Partial<WorkspaceTab>) => void;

  // ============ 面板操作 ============
  /**
   * 向指定标签页添加一个面板
   *
   * @param tabId 目标标签页 ID
   * @param panel 面板数据（不含 id，由内部生成）
   */
  addPanel: (tabId: string, panel: Omit<Panel, 'id'>) => void;
  /**
   * 从指定标签页移除一个面板
   *
   * @param tabId 目标标签页 ID
   * @param panelId 要移除的面板 ID
   */
  removePanel: (tabId: string, panelId: string) => void;
  /**
   * 更新指定标签页中某个面板的属性
   *
   * @param tabId 目标标签页 ID
   * @param panelId 目标面板 ID
   * @param updates 要更新的属性
   */
  updatePanel: (tabId: string, panelId: string, updates: Partial<Panel>) => void;

  // ============ 侧边栏 ============
  /** 切换侧边栏的展开/折叠状态 */
  toggleSidebar: () => void;
  /**
   * 设置侧栏宽度（只改 state，不主动触发 DB 同步；拖拽结束时外部显式调用 triggerAutoSave）
   *
   * @param width 目标宽度（像素），会被限制在 MIN~MAX 范围内
   */
  setSidebarWidth: (width: number) => void;
  /** 复位侧栏宽度到默认值（主动触发 DB 同步） */
  resetSidebarWidth: () => void;
  /**
   * 设置侧边栏激活的标签页
   *
   * @param tab 侧边栏标签名
   */
  setSidebarActiveTab: (tab: 'explorer' | 'history' | 'snippets' | 'trash') => void;

  // ============ 查询面板布局模式 ============
  /**
   * 设置查询面板布局模式
   *
   * 四种预设模式：
   *   - `only-editor`: 仅编辑器（100%）
   *   - `editor`: 编辑器为主（80% / 20%）
   *   - `default`: 等分（50% / 50%）
   *   - `results`: 结果为主（20% / 80%）
   *
   * @param tabId 目标标签页 ID
   * @param mode 布局模式
   */
  setPanelMode: (tabId: string, mode: 'only-editor' | 'editor' | 'default' | 'results') => void;

  // ============ 后端同步 ============
  /** 从后端数据库加载工作区布局 */
  loadFromBackend: () => Promise<void>;
  /** 将工作区布局同步到后端数据库 */
  syncToBackend: () => Promise<void>;
  /** 触发一次延迟自动保存（debounced，延迟 1.5 秒） */
  triggerAutoSave: () => void;
  /** 是否已成功连接并同步到后端 */
  isBackedUp: boolean;
  /** 上次成功保存到后端的时间戳（毫秒），null 表示从未保存 */
  lastSavedAt: number | null;

  // ============ v2 启动优化：直接消费 StartupContext 的 workspaceLayout ============
  /**
   * 从 get_startup_status 的返回数据直接设置 tabs（避免二次 IPC）
   *
   * 启动优化：直接消费 StartupContext 缓存的 workspaceLayout 数据，
   * 避免 Workspace.tsx 再发一次 loadWorkspace IPC，减少启动时的并发调用。
   *
   * @param layout 后端返回的工作区布局数据
   */
  setTabsFromStartup: (layout: Array<{
    id: string;
    title: string;
    tabType: string;
    position: number;
    isActive: boolean;
    panels: Array<{
      id: string;
      panelType: string;
      title: string;
      size: number;
      sqlContent: string | null;
      isActive: boolean;
      position: number;
    }>;
  }>) => void;
}

/**
 * 将前端 WorkspaceTab 转换为后端 save_workspace 需要的格式（snake_case）
 *
 * @param tabs 前端标签页数组
 * @returns 后端格式的标签页数组（字段名使用 snake_case）
 */
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

/**
 * 后端返回的面板数据格式（兼容 snake_case / camelCase 两种命名）
 *
 * 由于历史原因，后端可能返回 snake_case 或 camelCase 字段名，
 * 此处同时支持两种格式，由转换函数统一处理。
 */
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

/**
 * 后端返回的标签页数据格式（兼容 snake_case / camelCase 两种命名）
 *
 * 由于历史原因，后端可能返回 snake_case 或 camelCase 字段名，
 * 此处同时支持两种格式，由转换函数统一处理。
 */
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

/**
 * 将后端返回的 tabs 数据转换为前端 WorkspaceTab 格式（camelCase）
 *
 * 兼容后端返回的 snake_case 和 camelCase 两种命名风格，
 * 并对缺失字段提供合理的默认值。
 *
 * @param backendTabs 后端返回的标签页数据
 * @returns 前端格式的标签页数组；输入为空时返回空数组
 */
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
              size: 100,
              active: true,
              content: null,
            },
            {
              id: 'results',
              type: 'results_grid' as PanelType,
              title: 'Results',
              size: 0,
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
          'only-editor': [100, 0],       // 100% SQL编辑器
          'editor': [80, 20],            // 80% SQL编辑器，20%结果框
          'default': [50, 50],           // 50% SQL编辑器，50%结果框
          'results': [20, 80],           // 20% SQL编辑器，80%结果框
        };
        const [editorSize, resultsSize] = PANEL_MODE_SIZES[mode] || [100, 0];

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

      // v2 优化：启动阶段直接消费 StartupContext 的 workspaceLayout
      // 避免 Workspace.tsx 再发一次 loadWorkspace IPC
      setTabsFromStartup: (layout) => {
        if (!layout || layout.length === 0) return;

        let queryState = useQueryStore.getState();
        const usedQueryIds = new Set<string>();
        const findUnusedQuery = (): typeof queryState.sqlQueries[number] | undefined => {
          return queryState.sqlQueries.find((q) => !usedQueryIds.has(q.id));
        };

        const mappedTabs: WorkspaceTab[] = layout.map((tab) => {
          // 1. 尝试按 tab.id 在 sqlQueries 中精确匹配（保留持久化后的对应关系）
          let matchedQuery = queryState.sqlQueries.find(
            (q) => q.id === tab.id && !usedQueryIds.has(q.id),
          );

          let queryId: string;
          if (matchedQuery) {
            usedQueryIds.add(matchedQuery.id);
            queryId = matchedQuery.id;
          } else {
            const unused = findUnusedQuery();
            if (unused) {
              usedQueryIds.add(unused.id);
              queryId = unused.id;
            } else {
              // 2. 找不到未被占用的查询 → 真正新建一个 SqlQuery，避免使用不存在的占位 ID
              queryState.addSqlQuery();
              queryState = useQueryStore.getState();
              const newQuery = queryState.sqlQueries[queryState.sqlQueries.length - 1];
              usedQueryIds.add(newQuery.id);
              queryId = newQuery.id;
            }
          }

          let panels: Panel[] = (tab.panels || []).map((p) => ({
            id: p.id,
            type: (p.panelType || 'sql_editor') as PanelType,
            title: p.title || '',
            size: typeof p.size === 'number' && p.size > 0 && p.size <= 100 ? p.size : 50,
            active: p.isActive,
            content: p.sqlContent ?? null,
          }));

          // 确保至少有两个面板：编辑器和结果
          if (panels.length === 0) {
            panels = [
              { id: 'editor', type: 'sql_editor', title: 'SQL Editor', size: 50, active: true, content: null },
              { id: 'results', type: 'results_grid', title: 'Results', size: 50, active: true, content: null },
            ];
          } else if (panels.length === 1) {
            // 如果只有一个面板，添加另一个面板
            panels[0].size = 50;
            const newType: PanelType = panels[0].type === 'sql_editor' ? 'results_grid' : 'sql_editor';
            panels.push({
              id: panels[0].type === 'sql_editor' ? 'results' : 'editor',
              type: newType,
              title: newType === 'sql_editor' ? 'SQL Editor' : 'Results',
              size: 50,
              active: true,
              content: null,
            });
          } else {
            // 确保面板大小总和为100%
            const totalSize = panels.reduce((sum, p) => sum + p.size, 0);
            if (totalSize !== 100) {
              panels.forEach((p, i) => {
                p.size = i === 0 ? 50 : 50;
              });
            }
          }

          return {
            id: tab.id,
            title: tab.title || '',
            type: (tab.tabType || 'sql') as WorkspaceTabType,
            panels,
            active: tab.isActive,
            createdAt: Date.now(),
            queryId,
          };
        });

        const activeTab = mappedTabs.find((t) => t.active)?.id ?? mappedTabs[0]?.id ?? '';
        set({ tabs: mappedTabs, activeTabId: activeTab, isBackedUp: true });
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

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

interface WorkspaceStore extends WorkspaceState {
  // 标签页操作
  addTab: (tab: Omit<WorkspaceTab, 'id' | 'createdAt' | 'queryId'>) => void;
  removeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<WorkspaceTab>) => void;
  
  // 面板操作
  addPanel: (tabId: string, panel: Omit<Panel, 'id'>) => void;
  removePanel: (tabId: string, panelId: string) => void;
  updatePanel: (tabId: string, panelId: string, updates: Partial<Panel>) => void;
  
  // 侧边栏
  toggleSidebar: () => void;
  setSidebarActiveTab: (tab: 'explorer' | 'history' | 'snippets') => void;
  
  // 右侧面板
  toggleRightPanel: () => void;
  setRightPanelActiveTab: (tab: 'explorer' | 'history' | 'schema') => void;
}

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set) => ({
      // 初始状态
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
      
      rightPanel: {
        collapsed: true,
        width: 280,
        activeTab: 'explorer',
      },
      
      // 标签页操作
      addTab: (tab) => {
        // 先创建查询
        const { addSqlQuery } = useQueryStore.getState();
        addSqlQuery();
        
        // 获取刚创建的查询
        const { sqlQueries } = useQueryStore.getState();
        const newQuery = sqlQueries[sqlQueries.length - 1];
        
        const newId = `tab_${Date.now()}`;
        set((state) => ({
          tabs: [
            ...state.tabs.map(t => ({ ...t, active: false })),
            {
              ...tab,
              id: newId,
              active: true,
              createdAt: Date.now(),
              queryId: newQuery.id, // 关联查询 id
            },
          ],
          activeTabId: newId,
        }));
      },
      
      removeTab: (tabId) => set((state) => {
        if (state.tabs.length <= 1) return state;
        
        // 获取要删除的标签页的 queryId
        const tabToRemove = state.tabs.find(t => t.id === tabId);
        if (tabToRemove && tabToRemove.queryId) {
          // 删除对应的查询
          const { removeSqlQuery } = useQueryStore.getState();
          try {
            removeSqlQuery(tabToRemove.queryId);
          } catch (e) {
            // 如果查询已被删除，忽略错误
            console.warn('Query already removed:', tabToRemove.queryId);
          }
        }
        
        const filtered = state.tabs.filter(t => t.id !== tabId);
        const newActiveId = filtered[filtered.length - 1].id;
        
        // 切换到新的活动查询
        const newActiveTab = filtered.find(t => t.id === newActiveId);
        if (newActiveTab && newActiveTab.queryId) {
          const { setActiveQueryId } = useQueryStore.getState();
          setActiveQueryId(newActiveTab.queryId);
        }
        
        return {
          tabs: filtered.map(t => t.id === newActiveId ? { ...t, active: true } : t),
          activeTabId: newActiveId,
        };
      }),
      
      setActiveTab: (tabId) => {
        set((state) => {
          // 找到要切换的标签页
          const targetTab = state.tabs.find(t => t.id === tabId);
          
          // 如果找到，切换对应的查询
          if (targetTab && targetTab.queryId) {
            const { setActiveQueryId } = useQueryStore.getState();
            setActiveQueryId(targetTab.queryId);
          }
          
          return {
            tabs: state.tabs.map(t => ({
              ...t,
              active: t.id === tabId,
            })),
            activeTabId: tabId,
          };
        });
      },
      
      updateTab: (tabId, updates) => set((state) => ({
        tabs: state.tabs.map(t => t.id === tabId ? { ...t, ...updates } : t),
      })),
      
      // 面板操作
      addPanel: (tabId, panel) => set((state) => ({
        tabs: state.tabs.map(t => {
          if (t.id === tabId) {
            return {
              ...t,
              panels: [
                ...t.panels,
                { ...panel, id: `panel_${Date.now()}` },
              ],
            };
          }
          return t;
        }),
      })),
      
      removePanel: (tabId, panelId) => set((state) => ({
        tabs: state.tabs.map(t => {
          if (t.id === tabId) {
            return {
              ...t,
              panels: t.panels.filter(p => p.id !== panelId),
            };
          }
          return t;
        }),
      })),
      
      updatePanel: (tabId, panelId, updates) => set((state) => ({
        tabs: state.tabs.map(t => {
          if (t.id === tabId) {
            return {
              ...t,
              panels: t.panels.map(p => p.id === panelId ? { ...p, ...updates } : p),
            };
          }
          return t;
        }),
      })),
      
      // 侧边栏
      toggleSidebar: () => set((state) => ({
        sidebar: { ...state.sidebar, collapsed: !state.sidebar.collapsed },
      })),
      
      setSidebarActiveTab: (tab) => set((state) => ({
        sidebar: { ...state.sidebar, activeTab: tab },
      })),
      
      // 右侧面板
      toggleRightPanel: () => set((state) => ({
        rightPanel: { ...state.rightPanel, collapsed: !state.rightPanel.collapsed },
      })),
      
      setRightPanelActiveTab: (tab) => set((state) => ({
        rightPanel: { ...state.rightPanel, activeTab: tab },
      })),
    }),
    {
      name: 'la-duck-workspace',
      partialize: (state) => ({
        tabs: state.tabs,
        sidebar: state.sidebar,
        rightPanel: state.rightPanel,
      }),
      version: 1,
      migrate: (persistedState: any, version: number) => {
        if (version < 1) {
          // 迁移旧数据，为没有 queryId 的标签页添加 queryId
          const { sqlQueries } = useQueryStore.getState();
          
          if (persistedState && persistedState.tabs) {
            persistedState.tabs = persistedState.tabs.map((tab: any, index: number) => {
              if (!tab.queryId) {
                // 如果没有 queryId，尝试关联到对应索引的查询，否则创建一个新的
                const queryId = sqlQueries[index]?.id || `migrated_query_${Date.now()}_${index}`;
                return { ...tab, queryId };
              }
              return tab;
            });
          }
        }
        return persistedState;
      },
    }
  )
);

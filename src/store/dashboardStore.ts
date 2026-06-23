import { create } from 'zustand';
import type { Dashboard, SavedChart, DashboardItem, GridPosition, CreateSavedChartParams } from '../types/dashboard';
import { tauriService } from '../services/tauri';

interface DashboardStore {
  dashboards: Dashboard[];
  savedCharts: SavedChart[];
  activeDashboardId: string | null;
  loading: boolean;
  error: string | null;

  // 图表选择状态
  selectedChartId: string | null; // 当前选中的图表（用于侧边编辑）

  // Phase 4: 筛选器状态
  filterValues: Record<string, string | string[]>;
  isFullscreen: boolean;

  // SavedChart actions
  loadSavedCharts: (queryId?: string, tags?: string[]) => Promise<void>;
  createSavedChart: (params: CreateSavedChartParams) => Promise<SavedChart | null>;
  updateSavedChart: (params: { id: string; updates: Partial<SavedChart> }) => Promise<SavedChart | null>;
  deleteSavedChart: (id: string) => Promise<void>;
  setSelectedChartId: (id: string | null) => void;

  // Dashboard actions
  loadDashboards: () => Promise<void>;
  createDashboard: (name: string, description?: string) => Promise<Dashboard | null>;
  updateDashboard: (id: string, updates: Partial<Dashboard>) => Promise<void>;
  deleteDashboard: (id: string) => Promise<void>;
  setActiveDashboard: (id: string | null) => void;

  // v3 启动优化：直接消费 get_startup_status 缓存的数据，避免独立 IPC
  setDashboardsFromStartup: (dashboards: Array<{ id: string; name: string; description: string; isDefault: boolean; refreshIntervalSecs: number; createdAt: number; updatedAt: number; }>) => void;
  setSavedChartsFromStartup: (charts: Array<{ id: string; name: string; chartType: string; xAxis: string; yAxis: string[]; title: string; tags: string[]; description: string; visibility: string; createdAt: number; updatedAt: number; }>) => void;

  // DashboardItem actions
  addChartToDashboard: (dashboardId: string, chartId: string, position: GridPosition) => Promise<boolean>;
  updateDashboardItem: (itemId: string, updates: Partial<DashboardItem>) => Promise<void>;
  removeChartFromDashboard: (itemId: string) => Promise<void>;

  // T2: 保存仪表盘布局（编辑模式退出时调用）
  saveLayout: (dashboardId: string) => Promise<void>;

  // Phase 4: 筛选器 actions
  setFilterValue: (field: string, value: string | string[]) => void;
  resetFilters: () => void;
  refreshChartsVersion: number;
  refreshCharts: () => void;

  // Phase 6: 全屏模式
  toggleFullscreen: () => void;
  setFullscreen: (isFull: boolean) => void;

  // Utility
  clearError: () => void;
}

export const useDashboardStore = create<DashboardStore>()(
  (set, get) => ({
    dashboards: [],
    savedCharts: [],
    activeDashboardId: null,
    loading: false,
    error: null,
    selectedChartId: null,
    filterValues: {},
    isFullscreen: false,
    refreshChartsVersion: 0,

    // SavedChart actions
    loadSavedCharts: async (queryId?: string, tags?: string[]) => {
      set({ loading: true, error: null });
      try {
        const response = await tauriService.getSavedCharts(queryId, tags);
        if (response.success && response.data) {
          set({ savedCharts: response.data, loading: false });
        } else {
          set({ error: response.error || '加载保存的图表失败', loading: false });
        }
      } catch (e) {
        set({ error: String(e), loading: false });
      }
    },

    createSavedChart: async (params: CreateSavedChartParams) => {
      set({ loading: true, error: null });
      try {
        const response = await tauriService.createSavedChart({
          ...params,
          visibility: params.visibility || 'all',
          authorizedDashboardIds: params.authorizedDashboardIds || [],
        });
        if (response.success && response.data) {
          set((state) => ({
            savedCharts: [response.data!, ...state.savedCharts],
            loading: false,
          }));
          return response.data;
        } else {
          set({ error: response.error || '创建保存的图表失败', loading: false });
          return null;
        }
      } catch (e) {
        set({ error: String(e), loading: false });
        return null;
      }
    },

    updateSavedChart: async ({ id, updates }: { id: string; updates: Partial<SavedChart> }) => {
      set({ loading: true, error: null });
      try {
        const cleaned: Record<string, unknown> = { id };
        if (updates.name !== undefined) cleaned.name = updates.name;
        if (updates.chartType !== undefined) cleaned.chartType = updates.chartType;
        if (updates.xAxis !== undefined) cleaned.xAxis = updates.xAxis;
        if (updates.yAxis !== undefined) cleaned.yAxis = updates.yAxis;
        if (updates.title !== undefined) cleaned.title = updates.title;
        if (updates.description !== undefined) cleaned.description = updates.description;
        if (updates.tags !== undefined) cleaned.tags = updates.tags;
        if (updates.config !== undefined && updates.config !== null) cleaned.config = updates.config;
        if (updates.visibility !== undefined) cleaned.visibility = updates.visibility;
        if (updates.authorizedDashboardIds !== undefined) cleaned.authorizedDashboardIds = updates.authorizedDashboardIds;
        if (updates.sql !== undefined) cleaned.sql = updates.sql;

        const response = await tauriService.updateSavedChart(cleaned as Parameters<typeof tauriService.updateSavedChart>[0]);
        if (response.success && response.data) {
          set((state) => ({
            savedCharts: state.savedCharts.map((c) => (c.id === id ? response.data! : c)),
            loading: false,
          }));
          return response.data;
        } else {
          set({ error: response.error || '更新图表失败', loading: false });
          return null;
        }
      } catch (e) {
        set({ error: String(e), loading: false });
        return null;
      }
    },

    deleteSavedChart: async (id: string) => {
      set({ loading: true, error: null });
      try {
        const response = await tauriService.deleteSavedChart(id);
        if (response.success) {
          set((state) => ({
            savedCharts: state.savedCharts.filter((c) => c.id !== id),
            loading: false,
          }));
        } else {
          set({ error: response.error || '删除保存的图表失败', loading: false });
        }
      } catch (e) {
        set({ error: String(e), loading: false });
      }
    },

    // Dashboard actions
    loadDashboards: async () => {
      set({ loading: true, error: null });
      try {
        const response = await tauriService.getDashboards();
        if (response.success && response.data) {
          set({ dashboards: response.data, loading: false });
        } else {
          set({ error: response.error || '加载仪表盘列表失败', loading: false });
        }
      } catch (e) {
        set({ error: String(e), loading: false });
      }
    },

    createDashboard: async (name: string, description?: string) => {
      set({ loading: true, error: null });
      try {
        const response = await tauriService.createDashboard(name, description);
        if (response.success && response.data) {
          set((state) => ({
            dashboards: [response.data!, ...state.dashboards],
            loading: false,
          }));
          return response.data;
        } else {
          set({ error: response.error || '创建仪表盘失败', loading: false });
          return null;
        }
      } catch (e) {
        set({ error: String(e), loading: false });
        return null;
      }
    },

    updateDashboard: async (id: string, updates: Partial<Dashboard>) => {
      set({ loading: true, error: null });
      try {
        const response = await tauriService.updateDashboard(id, updates);
        if (response.success && response.data) {
          set((state) => ({
            dashboards: state.dashboards.map((d) =>
              d.id === id ? response.data! : d
            ),
            loading: false,
          }));
        } else {
          set({ error: response.error || '更新仪表盘失败', loading: false });
        }
      } catch (e) {
        set({ error: String(e), loading: false });
      }
    },

    deleteDashboard: async (id: string) => {
      set({ loading: true, error: null });
      try {
        const response = await tauriService.deleteDashboard(id);
        if (response.success) {
          set((state) => ({
            dashboards: state.dashboards.filter((d) => d.id !== id),
            activeDashboardId:
              state.activeDashboardId === id ? null : state.activeDashboardId,
            loading: false,
          }));
        } else {
          set({ error: response.error || '删除仪表盘失败', loading: false });
        }
      } catch (e) {
        set({ error: String(e), loading: false });
      }
    },

    setActiveDashboard: (id: string | null) => {
      set({ activeDashboardId: id });
    },

    // DashboardItem actions
    addChartToDashboard: async (
      dashboardId: string,
      chartId: string,
      position: GridPosition
    ): Promise<boolean> => {
      set({ loading: true, error: null });
      try {
        const response = await tauriService.addChartToDashboard(
          dashboardId,
          chartId,
          position
        );
        if (response.success && response.data) {
          const dashResponse = await tauriService.getDashboard(dashboardId);
          if (dashResponse.success && dashResponse.data) {
            set((state) => ({
              dashboards: state.dashboards.map((d) =>
                d.id === dashboardId ? dashResponse.data! : d
              ),
              loading: false,
            }));
            return true;
          }
          set({ loading: false });
          return true;
        } else {
          set({ error: response.error || '添加图表到仪表盘失败', loading: false });
          return false;
        }
      } catch (e) {
        set({ error: String(e), loading: false });
        return false;
      }
    },

    updateDashboardItem: async (itemId: string, updates: Partial<DashboardItem>) => {
      set({ loading: true, error: null });
      try {
        const response = await tauriService.updateDashboardItem(itemId, updates);
        if (response.success && response.data) {
          // Find the dashboard containing this item and reload it
          const { dashboards } = get();
          const dashboard = dashboards.find((d) =>
            d.layout.some((item) => item.id === itemId)
          );
          if (dashboard) {
            const dashResponse = await tauriService.getDashboard(dashboard.id);
            if (dashResponse.success && dashResponse.data) {
              set((state) => ({
                dashboards: state.dashboards.map((d) =>
                  d.id === dashboard.id ? dashResponse.data! : d
                ),
                loading: false,
              }));
              return;
            }
          }
          set({ loading: false });
        } else {
          set({ error: response.error || '更新仪表盘项目失败', loading: false });
        }
      } catch (e) {
        set({ error: String(e), loading: false });
      }
    },

    removeChartFromDashboard: async (itemId: string) => {
      set({ loading: true, error: null });
      try {
        const response = await tauriService.removeChartFromDashboard(itemId);
        if (response.success) {
          // Find the dashboard containing this item and reload it
          const { dashboards } = get();
          const dashboard = dashboards.find((d) =>
            d.layout.some((item) => item.id === itemId)
          );
          if (dashboard) {
            const dashResponse = await tauriService.getDashboard(dashboard.id);
            if (dashResponse.success && dashResponse.data) {
              set((state) => ({
                dashboards: state.dashboards.map((d) =>
                  d.id === dashboard.id ? dashResponse.data! : d
                ),
                loading: false,
              }));
              return;
            }
          }
          set({ loading: false });
        } else {
          set({ error: response.error || '从仪表盘移除图表失败', loading: false });
        }
      } catch (e) {
        set({ error: String(e), loading: false });
      }
    },

    // T2: 保存布局：遍历当前仪表盘的 layout，将每个 item 的 x/y/width/height 写回后端
    saveLayout: async (dashboardId: string) => {
      set({ loading: true, error: null });
      try {
        const { dashboards } = get();
        const dashboard = dashboards.find((d) => d.id === dashboardId);
        if (!dashboard) {
          set({ loading: false });
          return;
        }

        const layout = dashboard.layout || [];
        for (const item of layout) {
          await tauriService.updateDashboardItem(item.id, {
            x: item.x,
            y: item.y,
            width: item.width,
            height: item.height,
          });
        }

        // 重新加载仪表盘（确保 store 状态与后端一致）
        const dashResponse = await tauriService.getDashboard(dashboardId);
        if (dashResponse.success && dashResponse.data) {
          set((state) => ({
            dashboards: state.dashboards.map((d) =>
              d.id === dashboardId ? dashResponse.data! : d
            ),
            loading: false,
          }));
        } else {
          set({ loading: false });
        }
      } catch (e) {
        set({ error: String(e), loading: false });
      }
    },
    setFilterValue: (field: string, value: string | string[]) => {
      set((state) => ({
        filterValues: { ...state.filterValues, [field]: value },
      }));
    },
    resetFilters: () => {
      const { dashboards, activeDashboardId } = get();
      const active = dashboards.find((d) => d.id === activeDashboardId);
      if (active) {
        const defaults: Record<string, string | string[]> = {};
        for (const f of active.filters) {
          defaults[f.field] = f.defaultValue;
        }
        set({ filterValues: defaults });
      } else {
        set({ filterValues: {} });
      }
    },
    refreshCharts: () => {
      // 通过版本号递增触发订阅组件刷新，而不是无意义的深拷贝整份 state
      set((state) => ({ refreshChartsVersion: (state.refreshChartsVersion || 0) + 1 }));
    },

    // Phase 6: 全屏模式
    toggleFullscreen: () => {
      set((state) => ({ isFullscreen: !state.isFullscreen }));
    },
    setFullscreen: (isFull: boolean) => {
      set({ isFullscreen: isFull });
    },

    // 图表选择
    setSelectedChartId: (id: string | null) => {
      set({ selectedChartId: id });
    },

    // v3 启动优化：直接消费 StartupContext 缓存，避免独立 IPC
    setDashboardsFromStartup: (dashboards) => {
      set({ dashboards: dashboards.map((d) => ({
        id: d.id,
        name: d.name,
        description: d.description,
        layout: [],
        filters: [],
        refreshIntervalSecs: d.refreshIntervalSecs,
        isDefault: d.isDefault,
        createdBy: '',
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      })) });
    },
    setSavedChartsFromStartup: (charts) => {
      set({ savedCharts: charts.map((c) => ({
        id: c.id,
        name: c.name,
        queryId: '',
        sql: '',
        chartType: c.chartType as SavedChart['chartType'],
        xAxis: c.xAxis,
        yAxis: c.yAxis,
        title: c.title,
        filters: [],
        tags: c.tags,
        description: c.description,
        thumbnail: null,
        config: null,
        visibility: c.visibility as SavedChart['visibility'],
        authorizedDashboardIds: [],
        lastResult: null,
        lastRunAt: null,
        createdBy: '',
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })) });
    },

    // Utility
    clearError: () => {
      set({ error: null });
    },
  })
);

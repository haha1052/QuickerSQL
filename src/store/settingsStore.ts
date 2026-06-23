import { create } from 'zustand';
import type {
  SettingItem,
  SettingCategory,
  QueryCacheStats,
} from '../types';
import { tauriService } from '../services';

interface SettingsState {
  // 数据
  categories: SettingCategory[];
  activeCategory: string;
  loading: boolean;
  error: string | null;

  // 查询缓存统计
  cacheStats: QueryCacheStats | null;
  cacheStatsLoading: boolean;
  cacheStatsError: string | null;
  
  // Actions
  loadSettings: () => Promise<void>;
  updateSetting: (category: string, key: string, value: string) => Promise<void>;
  resetSettings: (category?: string) => Promise<void>;
  setActiveCategory: (category: string) => void;
  clearError: () => void;

  // 查询缓存相关 actions
  loadCacheStats: () => Promise<void>;
  configureCache: (
    capacity: number,
    ttlSeconds: number,
    enabled: boolean
  ) => Promise<void>;
  clearCache: () => Promise<void>;

  // v2 优化：直接将 get_startup_status 返回的精简 settings 转换为 categories
  // 避免启动阶段再发一次 IPC
  setSettingsFromStartup: (items: Array<{ category: string; key: string; value: string }>) => void;
  
  // 辅助方法
  getSetting: (category: string, key: string) => SettingItem | undefined;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  categories: [],
  activeCategory: 'appearance',
  loading: false,
  error: null,

  cacheStats: null,
  cacheStatsLoading: false,
  cacheStatsError: null,

  loadSettings: async () => {
    set({ loading: true, error: null });
    try {
      const response = await tauriService.getAllSettings();
      if (response.success && response.data) {
        const categories = response.data.categories;
        set({ categories, loading: false });
        
        // 如果当前选中的分类不存在，设置为第一个
        const state = get();
        if (!categories.find(c => c.id === state.activeCategory) && categories.length > 0) {
          set({ activeCategory: categories[0].id });
        }
      } else {
        throw new Error(response.error || 'Failed to load settings');
      }
    } catch (error) {
      set({ error: String(error), loading: false });
    }
  },
  
  updateSetting: async (category: string, key: string, value: string) => {
    try {
      const response = await tauriService.updateSetting(category, key, value);
      if (response.success && response.data) {
        // 更新本地状态
        set((state) => ({
          categories: state.categories.map(cat => {
            if (cat.id === category) {
              return {
                ...cat,
                items: cat.items.map(item => {
                  if (item.key === key) {
                    return response.data!;
                  }
                  return item;
                }),
              };
            }
            return cat;
          }),
        }));
      } else {
        throw new Error(response.error || 'Failed to update setting');
      }
    } catch (error) {
      set({ error: String(error) });
    }
  },
  
  resetSettings: async (category?: string) => {
    set({ loading: true, error: null });
    try {
      await tauriService.resetSettings(category);
      // 重新加载设置
      await get().loadSettings();
    } catch (error) {
      set({ error: String(error), loading: false });
    }
  },
  
  setActiveCategory: (category: string) => set({ activeCategory: category }),
  
  clearError: () => set({ error: null }),

  // v2 优化：将 startup 返回的精简 settings 转换为 categories
  // 保留 id/description/value_type 等字段时使用合理默认值
  // 用户首次打开设置页时若需要更详细字段，可再次调用 loadSettings
  setSettingsFromStartup: (items) => {
    if (!items || items.length === 0) return;
    const map = new Map<string, SettingCategory>();
    items.forEach((it) => {
      const defaulted: SettingItem = {
        id: `${it.category}-${it.key}`,
        category: it.category,
        key: it.key,
        value: it.value,
        value_type: 'string',
        description: null,
        options: null,
        is_visible: true,
        is_system: false,
        updated_at: '',
      };
      const existing = map.get(it.category);
      if (existing) {
        existing.items.push(defaulted);
      } else {
        map.set(it.category, {
          id: it.category,
          name: it.category,
          icon: null,
          items: [defaulted],
        });
      }
    });
    const categories = Array.from(map.values());
    set({ categories, loading: false });
    const state = get();
    if (!categories.find((c) => c.id === state.activeCategory) && categories.length > 0) {
      set({ activeCategory: categories[0].id });
    }
  },
  
  getSetting: (category: string, key: string) => {
    const state = get();
    const cat = state.categories.find(c => c.id === category);
    return cat?.items.find(item => item.key === key);
  },

  loadCacheStats: async () => {
    set({ cacheStatsLoading: true, cacheStatsError: null });
    try {
      const response = await tauriService.getQueryCacheStats();
      if (response.success && response.data) {
        set({ cacheStats: response.data, cacheStatsLoading: false });
      } else {
        throw new Error(response.error || 'Failed to load cache stats');
      }
    } catch (error) {
      set({ cacheStatsError: String(error), cacheStatsLoading: false });
    }
  },

  configureCache: async (capacity: number, ttlSeconds: number, enabled: boolean): Promise<void> => {
    set({ cacheStatsLoading: true, cacheStatsError: null });
    try {
      const response = await tauriService.configureQueryCache({
        capacity,
        ttlSeconds,
        enabled,
      });
      if (response.success) {
        await get().loadCacheStats();
      } else {
        throw new Error(response.error || 'Failed to configure cache');
      }
    } catch (error) {
      set({ cacheStatsError: String(error), cacheStatsLoading: false });
    }
  },

  clearCache: async (): Promise<void> => {
    set({ cacheStatsLoading: true, cacheStatsError: null });
    try {
      const response = await tauriService.clearQueryCache();
      if (response.success && response.data) {
        set({ cacheStats: response.data, cacheStatsLoading: false });
      } else {
        throw new Error(response.error || 'Failed to clear cache');
      }
    } catch (error) {
      set({ cacheStatsError: String(error), cacheStatsLoading: false });
    }
  },
}));

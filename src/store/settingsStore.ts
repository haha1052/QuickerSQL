import { create } from 'zustand';
import type {
  SettingItem,
  SettingCategory,
} from '../types';
import { tauriService } from '../services';

interface SettingsState {
  // 数据
  categories: SettingCategory[];
  activeCategory: string;
  loading: boolean;
  error: string | null;
  
  // Actions
  loadSettings: () => Promise<void>;
  updateSetting: (category: string, key: string, value: string) => Promise<void>;
  resetSettings: (category?: string) => Promise<void>;
  setActiveCategory: (category: string) => void;
  clearError: () => void;
  
  // 辅助方法
  getSetting: (category: string, key: string) => SettingItem | undefined;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  categories: [],
  activeCategory: 'appearance',
  loading: false,
  error: null,
  
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
  
  getSetting: (category: string, key: string) => {
    const state = get();
    const cat = state.categories.find(c => c.id === category);
    return cat?.items.find(item => item.key === key);
  },
}));

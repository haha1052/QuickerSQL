import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSettingsStore } from '../store';
import type { SettingItem } from '../types';
import { useStartupContext } from '../AppWrapper';

interface SettingsContextValue {
  settings: Map<string, SettingItem>;
  getSetting: (category: string, key: string) => string | undefined;
  isLoading: boolean;
  error: string | null;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { categories, loading, error, setSettingsFromStartup } = useSettingsStore();
  const startupCtx = useStartupContext();
  const [settings, setSettings] = useState<Map<string, SettingItem>>(new Map());

  // v2 优化：启动阶段优先消费 StartupContext 的 settings（避免再发一次 IPC）
  useEffect(() => {
    if (!startupCtx.isStartupLoaded) return;
    // 启动数据已加载 → 无论 settings 是否为空都使用它（空代表数据库中没有设置）
    setSettingsFromStartup(startupCtx.startupData?.settings ?? []);
  }, [startupCtx.isStartupLoaded, startupCtx.startupData]);

  useEffect(() => {
    const settingsMap = new Map<string, SettingItem>();
    categories.forEach(category => {
      category.items.forEach(item => {
        settingsMap.set(`${item.category}-${item.key}`, item);
      });
    });
    setSettings(settingsMap);
  }, [categories]);

  const getSetting = (category: string, key: string): string | undefined => {
    const setting = settings.get(`${category}-${key}`);
    return setting?.value;
  };

  return (
    <SettingsContext.Provider value={{ settings, getSetting, isLoading: loading, error }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSetting = (category: string, key: string): [string | undefined, boolean] => {
  const context = useContext(SettingsContext);
  if (!context) {
    return [undefined, false];
  }
  const setting = context.settings.get(`${category}-${key}`);
  return [setting?.value, setting !== undefined];
};

export default SettingsContext;

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSettingsStore } from '../store';
import type { SettingItem } from '../types';

interface SettingsContextValue {
  settings: Map<string, SettingItem>;
  getSetting: (category: string, key: string) => string | undefined;
  isLoading: boolean;
  error: string | null;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { categories, loading, error, loadSettings } = useSettingsStore();
  const [settings, setSettings] = useState<Map<string, SettingItem>>(new Map());

  useEffect(() => {
    loadSettings();
  }, []);

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

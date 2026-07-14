import React, { useEffect, useState } from 'react';
import { useSetting } from './SettingsContext';

export interface AdvancedSettings {
  developerMode: boolean;
  showDebugInfo: boolean;
  logLevel: string;
}

const AdvancedSettingsContext = React.createContext<AdvancedSettings | null>(null);

export const useAdvancedSettings = (): AdvancedSettings => {
  const ctx = React.useContext(AdvancedSettingsContext);
  return ctx ?? {
    developerMode: false,
    showDebugInfo: false,
    logLevel: 'info',
  };
};

export const AdvancedSettingsSync: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const [developerModeStr] = useSetting('advanced', 'developerMode');
  const [showDebugInfoStr] = useSetting('advanced', 'showDebugInfo');
  const [logLevel] = useSetting('advanced', 'logLevel');

  const [settings, setSettings] = useState<AdvancedSettings>({
    developerMode: false,
    showDebugInfo: false,
    logLevel: 'info',
  });

  useEffect(() => {
    const developerMode = developerModeStr === 'true';
    const showDebugInfo = showDebugInfoStr === 'true';
    const level = logLevel ?? 'info';

    setSettings({
      developerMode,
      showDebugInfo,
      logLevel: level,
    });

    if (developerMode) {
      console.info('[Advanced] 开发者模式已启用');
    }
    if (showDebugInfo) {
      console.info('[Advanced] 显示调试信息已启用');
    }
    console.info('[Advanced] 当前日志级别:', level);
  }, [developerModeStr, showDebugInfoStr, logLevel]);

  return (
    <AdvancedSettingsContext.Provider value={settings}>
      {children}
    </AdvancedSettingsContext.Provider>
  );
};

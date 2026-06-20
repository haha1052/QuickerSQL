import React, { createContext, useContext, useEffect, useState } from 'react';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  mode: ThemeMode;
  actualTheme: 'light' | 'dark';
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_KEY = 'laduck-theme';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>('light');
  const [actualTheme, setActualTheme] = useState<'light' | 'dark'>('light');

  // 检测系统主题
  const getSystemTheme = (): 'light' | 'dark' => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  };

  // 应用主题到DOM
  const applyTheme = (theme: 'light' | 'dark') => {
    if (document.documentElement) {
      document.documentElement.setAttribute('data-theme', theme);
    }
    setActualTheme(theme);
  };

  // 设置主题
  const setTheme = (newMode: ThemeMode) => {
    setModeState(newMode);
    try {
      localStorage.setItem(THEME_KEY, newMode);
    } catch (e) {
      console.warn('无法访问 localStorage', e);
    }
    
    if (newMode === 'system') {
      applyTheme(getSystemTheme());
    } else {
      applyTheme(newMode);
    }
  };

  // 初始化
  useEffect(() => {
    try {
      const savedMode = localStorage.getItem(THEME_KEY) as ThemeMode | null;
      const initialMode = savedMode || 'light';
      setModeState(initialMode);
      
      if (initialMode === 'system') {
        applyTheme(getSystemTheme());
      } else {
        applyTheme(initialMode);
      }
    } catch (e) {
      console.warn('初始化主题时出错', e);
      applyTheme('light');
    }
  }, []);

  // 监听系统主题变化
  useEffect(() => {
    if (mode !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      applyTheme(e.matches ? 'dark' : 'light');
    };
    
    mediaQuery.addEventListener('change', handleSystemThemeChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, [mode]);

  return (
    <ThemeContext.Provider value={{ mode, actualTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    // 提供安全的默认值
    return {
      mode: 'light',
      actualTheme: 'light',
      setTheme: () => {}
    };
  }
  return context;
};

export default ThemeContext;

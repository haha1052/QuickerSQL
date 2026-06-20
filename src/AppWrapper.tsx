import React, { useState, useEffect, createContext, useContext } from 'react';
import { tauriService } from './services/tauri';
import App from './App';
import Welcome from './pages/Welcome';
import Guide from './pages/Guide';
import Settings from './pages/Settings';
import ActivityLog from './pages/ActivityLog';
import { SettingsProvider } from './context/SettingsContext';
import { ThemeProvider } from './context/ThemeContext';
import { ThemeSettingsSync } from './context/ThemeSettingsSync';
import { LocaleProvider } from './context/LocaleContext';
import './styles/theme.css';

// AppPageState: 应用视图状态（区分于后端 Rust AppState）
type AppPageState = 'welcome' | 'guide' | 'workspace' | 'settings' | 'activity_log' | 'loading';

interface AppContextType {
  goToSettings: () => void;
  goToWorkspace: () => void;
  goToActivityLog: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppWrapper');
  }
  return context;
};

const AppWrapper: React.FC = () => {
  const [state, setState] = useState<AppPageState>('loading');
  const [isLoading, setIsLoading] = useState(true);

  // 启动时从后端读取"是否已启动过"状态
  useEffect(() => {
    (async () => {
      console.log('[DIAG] AppWrapper useEffect started');
      try {
        console.log('[DIAG] Calling getAppState...');
        const response = await tauriService.getAppState('welcome', 'has_launched');
        console.log('[DIAG] getAppState response:', response.success, response.data);
        if (response.success && response.data && response.data.value === 'true') {
          // 更新启动计数
          try {
            await tauriService.updateAppState('welcome', 'last_launched_at',
              new Date().toISOString(), '上次启动时间');
          } catch {
            // 忽略
          }
          console.log('[DIAG] Setting state to workspace');
          setState('workspace');
        } else {
          console.log('[DIAG] Setting state to welcome');
          setState('welcome');
        }
      } catch (e) {
        console.error('[DIAG] AppWrapper error:', e);
        // 后端不可用时，降级到直接进入工作区
        setState('workspace');
      } finally {
        console.log('[DIAG] Setting isLoading=false');
        setIsLoading(false);
      }
    })();
  }, []);

  const handleGetStarted = async () => {
    // 标记为已启动（写入后端数据库）
    try {
      await tauriService.updateAppState('welcome', 'has_launched', 'true', '是否已启动过');
      await tauriService.updateAppState('welcome', 'first_launch_at',
        new Date().toISOString(), '首次启动时间');
    } catch {
      // 即使失败也允许继续
    }
    setState('workspace');
  };

  const handleGuideComplete = () => {
    setState('workspace');
  };

  const handleGuideSkip = () => {
    setState('workspace');
  };

  const goToSettings = () => setState('settings');
  const goToWorkspace = () => setState('workspace');
  const goToActivityLog = () => setState('activity_log');

  if (isLoading || state === 'loading') {
    return (
      <ThemeProvider>
        <SettingsWrapper>
          <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            opacity: 0.7,
          }}>
            Loading...
          </div>
        </SettingsWrapper>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <AppContext.Provider value={{ goToSettings, goToWorkspace, goToActivityLog }}>
        <SettingsWrapper>
          {state === 'welcome' && <Welcome onGetStarted={handleGetStarted} />}
          {state === 'guide' && <Guide onComplete={handleGuideComplete} onSkip={handleGuideSkip} />}
          {state === 'workspace' && <App />}
          {state === 'settings' && <Settings />}
          {state === 'activity_log' && <ActivityLog />}
        </SettingsWrapper>
      </AppContext.Provider>
    </ThemeProvider>
  );
};

const SettingsWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <SettingsProvider>
      <ThemeSettingsSync />
      <LocaleProvider>
        {children}
      </LocaleProvider>
    </SettingsProvider>
  );
};

export default AppWrapper;

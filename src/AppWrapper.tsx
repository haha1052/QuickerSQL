import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { tauriService } from './services/tauri';
import type { ProjectInfo } from './types';
import App from './App';
import Welcome from './pages/Welcome';
import Guide from './pages/Guide';
import ActivityLog from './pages/ActivityLog';
import { SettingsModal, ErrorBoundary } from './components/common';
import { SettingsProvider } from './context/SettingsContext';
import { ThemeProvider } from './context/ThemeContext';
import { ThemeSettingsSync } from './context/ThemeSettingsSync';
import { CacheSettingsSync } from './context/CacheSettingsSync';
import { AdvancedSettingsSync } from './context/AdvancedSettingsSync';
import { LocaleProvider } from './context/LocaleContext';
import { ShortcutProvider } from './context/ShortcutProvider';
import { useSettingsStore, useToastStore } from './store';
import './styles/theme.css';

// P0-2 启动优化：启动数据的共享 context
// 后端 get_startup_status 一次性返回所有启动所需数据
// 避免 App.tsx / Workspace.tsx 再次发出 IPC 请求
export interface StartupLayoutPanel {
  id: string;
  panelType: string;
  title: string;
  size: number;
  sqlContent: string | null;
  isActive: boolean;
  position: number;
}

export interface StartupLayoutTab {
  id: string;
  title: string;
  tabType: string;
  position: number;
  isActive: boolean;
  panels: StartupLayoutPanel[];
}

export interface StartupData {
  hasLaunched: boolean;
  currentDbPath: string;
  projectList: ProjectInfo[];
  databaseStatus: { isConnected: boolean; path: string; tableCount: number };
  workspaceLayout: StartupLayoutTab[] | null;
  // v2 新增：SettingsContext 与 DatabaseExplorer 直接消费，减少启动 IPC
  settings: Array<{ category: string; key: string; value: string }>;
  tablesList: string[] | null;
  // v3 新增：DashboardPage / TaskCenterPage 直接消费，避免独立 IPC
  dashboards: Array<{
    id: string;
    name: string;
    description: string;
    isDefault: boolean;
    refreshIntervalSecs: number;
    createdAt: number;
    updatedAt: number;
  }>;
  savedCharts: Array<{
    id: string;
    name: string;
    chartType: string;
    xAxis: string;
    yAxis: string[];
    title: string;
    tags: string[];
    description: string;
    visibility: string;
    authorizedDashboardIds: string[];
    createdAt: number;
    updatedAt: number;
  }>;
  tasks: Array<{
    id: string;
    name: string;
    description: string;
    taskType: string;
    scheduleMode: string;
    scheduleValue: string;
    state: string;
    nextRunAt: number | null;
    lastRunStatus: string | null;
    lastRunDurationMs: number | null;
    totalRuns: number;
    successRuns: number;
    failedRuns: number;
    createdAt: number;
    updatedAt: number;
  }>;
  timing: {
    appInitTsMs: number;
    rustAppInitMs?: number;          // v9.3: Rust TauriAppState::new() 总耗时
    rustSqliteConnectMs?: number;    // v9.3: Rust SQLite 建立连接耗时
    rustSystemTablesInitMs?: number; // v9.3: Rust 系统表初始化耗时
    dbConnectMs: number;
    hasLaunchedMs: number;
    dbPathMs: number;
    projectListMs: number;
    databaseStatusMs: number;
    workspaceMs: number;
    settingsMs: number;
    tablesListMs: number;
    dashboardsMs: number;
    savedChartsMs: number;
    tasksMs: number;
    totalBackendMs: number;
  } | null;
  startupTimestampMs: number;
}

interface ThemeData {
  transparencyEffective?: boolean;
  needsFallback?: boolean;
}

interface StartupContextType {
  startupData: StartupData | null;
  isStartupLoaded: boolean;
}

const StartupContext = createContext<StartupContextType | undefined>(undefined);

export const useStartupContext = (): StartupContextType => {
  const ctx = useContext(StartupContext);
  return ctx ?? { startupData: null, isStartupLoaded: false };
};

// AppPageState: 应用视图状态（区分于后端 Rust AppState）
type AppPageState = 'welcome' | 'guide' | 'workspace' | 'activity_log' | 'loading';

// AppContext: 全局 UI 导航与页面切换
// ============================================
// 职责边界：
// - 负责页面级别的导航切换（welcome/guide/workspace/activity_log）
// - 不负责业务数据状态（由各 Store 管理）
// - 不负责业务相关的模态框控制（由对应业务 Store 管理，如 settingsStore 的 showSettingsModal）
//
// 为什么页面导航放在 Context 而不是 Store？
// - 页面导航是应用级 UI 路由，与业务数据无关
// - 导航状态变化通常伴随整个页面的切换，属于顶层 UI 控制
// - 与启动流程（get_startup_status）紧密耦合，放在 AppWrapper 内更内聚
interface AppContextType {
  goToWorkspace: () => void;
  goToActivityLog: () => void;
  goToWelcome: () => void;
  goToGuide: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppWrapper');
  }
  return context;
};

/**
 * v12 启动策略（单一 HTML splash 方案）：
 * - 启动视觉完全由 index.html 的内联 splash 卡片负责（圆形 380×380 渐变卡片）
 * - React 加载阶段不渲染任何视觉内容（避免 ThemeProvider 容器带背景色产生白色矩形）
 * - 启动完成后：由 windowResizeToMain() 放大窗口 + 移除 startup-phase 类 + 设置 body 背景色
 */

/**
 * v9.3 启动计时关键说明：
 * - performance.timeOrigin: 浏览器上下文创建时刻（Tauri 创建 WebView 的时刻），
 *   是"真正接近用户双击应用图标"的时间点
 * - window.__STARTUP_HTML_LOAD_MS__: HTML 解析完成（进入 React 前）的相对耗时，
 *   从 performance.timeOrigin 算起
 * - performance.now(): React JSX 开始执行时的相对耗时（我们在 JS 代码里可以拿到）
 * - Rust 初始化耗时由后端返回：rust_app_init_ms、rust_sqlite_connect_ms 等
 *
 * 全链路完整总耗时 = (Date.now() - performance.timeOrigin)  // WebView 已存在的时间
 *                   + rust_app_init_ms（估计值，因为 timeOrigin 实际在 Rust 之后）
 * 但由于 timeOrigin 是 WebView 上下文创建时刻，最精确的公式是：
 *   总耗时 ≈ performance.now() + rust_app_init_ms（Rust 发生在 WebView 创建之前，大约同时）
 * 实际效果：让用户看到真实的"点击到可用"时间
 */
// v9.3: 静态骨架屏由 index.html 直接显示（零依赖、零延迟）
// React 渲染过程中，静态骨架屏一直"挡在最上面"给用户持续视觉反馈
// 启动完成后，调用 window.__HIDE_HTML_SKELETON__() 淡出它
// 因此 React 侧不需要额外的最小等待时间
const MIN_SKELETON_MS = 0;

// v10: 声明 window 扩展类型（index.html 内原生 JS 注入的全局函数）
// 启动流程：html splash（0-400ms） → 等待 IPC 返回 → resize + 淡出
declare global {
  interface Window {
    /** 由 index.html 在解析过程中注入，记录 JS 加载前的启动耗时 */
    __STARTUP_HTML_LOAD_MS__?: number;
    __STARTUP_TIME_ORIGIN__?: number;
    /** 触发椭圆 splash 淡出过渡，同时从 DOM 中移除 */
    __TRIGGER_SPLASH_TRANSITION__?: (transitionMs?: number) => void;
    /** 强制进入主应用（启动异常时的兜底入口） */
    __FORCE_TRANSITION__?: () => void;
    /** 停止 splash 上的计时 setInterval（避免内存泄漏） */
    __CLEAR_SPLASH_TIMER__?: () => void;
  }
}

const AppWrapper: React.FC = () => {
  const [state, setState] = useState<AppPageState>('loading');
  const [isLoading, setIsLoading] = useState(true);
  const [startupData, setStartupData] = useState<StartupData | null>(null);

  const startupHasRunRef = useRef(false);
  const duckDbListenedRef = useRef(false);
  const duckDbUnlistenRef = useRef<(() => void) | null>(null);
  const duckDbCancelledRef = useRef(false);

  // v12: 启动计时状态（React 内部计时，不渲染到 UI，由 index.html splash 显示计时）
  const [, setRuntimeMs] = useState<number>(0);
  const [, setStageText] = useState<string>('正在初始化...');

  // v9.3: 仅在 isLoading=true 期间动态刷新计时；一旦加载完成，停止刷新
  useEffect(() => {
    if (!isLoading) return;
    const timer = setInterval(() => {
      const nowMs = performance.now();
      setRuntimeMs(nowMs);
      if (nowMs < 300) setStageText('正在初始化...');
      else if (nowMs < 700) setStageText('正在加载资源...');
      else if (nowMs < 1100) setStageText('正在读取数据...');
      else setStageText('即将完成...');
    }, 50);
    return () => clearInterval(timer);
  }, [isLoading]);

  // DuckDB 初始化完成事件监听
  useEffect(() => {
    if (duckDbListenedRef.current) return;
    duckDbListenedRef.current = true;

    tauriService.onDuckDbInitCompleted((status) => {
      if (duckDbCancelledRef.current) return;
      if (status.success) {
        useToastStore.getState().addToast(
          `DuckDB 初始化完成，已同步 ${status.view_count} 个表（耗时 ${status.duration_ms}ms）`,
          'success',
          3000
        );
      } else {
        useToastStore.getState().addToast(
          'DuckDB 初始化失败',
          'error',
          5000
        );
      }
    }).then((unlisten) => {
      if (duckDbCancelledRef.current) {
        unlisten();
      } else {
        duckDbUnlistenRef.current = unlisten;
      }
    }).catch((e) => {
      console.error('[DuckDB] 注册初始化事件监听失败:', e);
    });

    return () => {
      duckDbCancelledRef.current = true;
      if (duckDbUnlistenRef.current) {
        duckDbUnlistenRef.current();
        duckDbUnlistenRef.current = null;
      }
    };
  }, []);

  // DuckDB 预加载：启动完成后5秒自动触发，避免首次分析查询卡住
  useEffect(() => {
    if (!isLoading && state !== 'loading') {
      const preloadTimer = setTimeout(() => {
        tauriService.preloadDuckdb().catch((e) => {
          console.error('[DuckDB] 预加载失败:', e);
        });
      }, 5000);
      return () => clearTimeout(preloadTimer);
    }
  }, [isLoading, state]);

  // v14（事件驱动过渡 · S2 方案）: 启动完成时执行完整的过渡流程：
  // 2) 异步调用 windowResizeToMain() 把窗口从 400×400 放大到 1200×800
  // 3) IPC 返回后：把 html/body background 从 transparent 设为 #f5f7fa
  // 4) 使用 requestAnimationFrame 双帧对齐替代静态 setTimeout(80ms)：
  //    - 第 1 帧：浏览器确认 body 背景色已入布局树
  //    - 第 2 帧：DWM 合成器已把背景色合成到窗口画面
  //    - 此后再调用 __TRIGGER_SPLASH_TRANSITION__ 淡出 splash 卡片
  // 5) 失败路径（catch）同样改为事件驱动，不再依赖静态延迟
  // v14（事件驱动过渡 · S2 方案）: 启动完成时执行完整的过渡流程
  const hasDoneTransitionRef = useRef(false);
  
  useEffect(() => {
    if (!isLoading && !hasDoneTransitionRef.current) {
      hasDoneTransitionRef.current = true;
      
      const now = performance.now();

      const transitionMs = Math.max(150, Math.min(300, Math.round(now / 5)));

      if (typeof window.__CLEAR_SPLASH_TIMER__ === 'function') {
        window.__CLEAR_SPLASH_TIMER__();
      }

      let rafId1: number | null = null;
      let rafId2: number | null = null;
      let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

      const doTransition = () => {
        if (typeof window.__TRIGGER_SPLASH_TRANSITION__ === 'function') {
          window.__TRIGGER_SPLASH_TRANSITION__(transitionMs);
        }
      };

      const clearAllTimers = () => {
        if (rafId1 !== null) {
          cancelAnimationFrame(rafId1);
          rafId1 = null;
        }
        if (rafId2 !== null) {
          cancelAnimationFrame(rafId2);
          rafId2 = null;
        }
        if (fallbackTimer !== null) {
          clearTimeout(fallbackTimer);
          fallbackTimer = null;
        }
      };

      const paintAfterBgChange = () => {
        if (typeof requestAnimationFrame === 'function') {
          rafId1 = requestAnimationFrame(() => {
            rafId2 = requestAnimationFrame(() => {
              doTransition();
            });
          });
        } else {
          fallbackTimer = setTimeout(doTransition, 50);
        }
      };

      tauriService.windowResizeToMain()
        .then((resizeResp) => {
          const data = resizeResp?.data ?? null;
          const transparencyEffective =
            data && typeof (data as ThemeData).transparencyEffective === 'boolean'
              ? (data as ThemeData).transparencyEffective
              : true;
          const needsFallback = data && (data as ThemeData).needsFallback === true;

          const html = document.documentElement;
          if (needsFallback || !transparencyEffective) {
            if (html) html.classList.add('fallback-l1');
            console.info('[DIAG] 透明窗口未生效，启用 L1 降级（卡片填充）');
          } else {
            if (html) html.classList.remove('fallback-l1', 'fallback-l2', 'fallback-l3');
            console.info('[DIAG] 透明窗口生效，使用默认 splash 样式');
          }

          if (document.body) document.body.style.background = '#f5f7fa';
          if (document.documentElement) document.documentElement.style.background = '#f5f7fa';
          paintAfterBgChange();
        })
        .catch((err) => {
          console.warn('[DIAG] windowResizeToMain failed, forcing transition:', err);
          const html = document.documentElement;
          if (html) html.classList.add('fallback-l1');
          if (document.body) document.body.style.background = '#f5f7fa';
          if (document.documentElement) document.documentElement.style.background = '#f5f7fa';
          if (typeof requestAnimationFrame === 'function') {
            rafId1 = requestAnimationFrame(() => {
              rafId2 = requestAnimationFrame(() => doTransition());
            });
          } else {
            fallbackTimer = setTimeout(doTransition, 50);
          }
        });

      return clearAllTimers;
    }
  }, [isLoading]);

  // v10: 超时保护（5 秒没完成启动 → 显示"点击进入应用"按钮）
  useEffect(() => {
    const timeoutMs = 5000;
    const timer = setTimeout(() => {
      if (isLoading && typeof window.__FORCE_TRANSITION__ === 'function') {
        window.__FORCE_TRANSITION__();
      }
    }, timeoutMs);
    return () => clearTimeout(timer);
  }, [isLoading]);

  // P0-2 启动优化：调用合并后的 get_startup_status，1 次 IPC 搞定
  // 代替原先的：getAppState + getDefaultDbPath + listProjects + databaseStatus + loadWorkspace
  useEffect(() => {
    if (startupHasRunRef.current) return;
    startupHasRunRef.current = true;
    
    (async () => {
      const jsStartMs = performance.now();
      
      try {
        const response = await tauriService.getStartupStatus();
        const ipcEndMs = performance.now();

        // v9.3: 确保骨架屏至少显示 MIN_SKELETON_MS（避免 IPC 极快时一闪而过）
        const elapsedSinceMount = ipcEndMs - jsStartMs;
        const needWait = Math.max(0, MIN_SKELETON_MS - elapsedSinceMount);
        if (needWait > 0) {
          await new Promise((resolve) => setTimeout(resolve, needWait));
        }

        if (response.success && response.data) {
          const raw = response.data;
          const data: StartupData = {
            hasLaunched: raw.hasLaunched,
            currentDbPath: raw.currentDbPath,
            projectList: raw.projectList,
            databaseStatus: raw.databaseStatus,
            workspaceLayout: raw.workspaceLayout ?? null,
            settings: raw.settings ?? [],
            tablesList: raw.tablesList ?? null,
            dashboards: raw.dashboards ?? [],
            savedCharts: raw.savedCharts ?? [],
            tasks: raw.tasks ?? [],
            timing: raw.timing ?? null,
            startupTimestampMs: raw.startupTimestampMs,
          };
          setStartupData(data);

          const totalMs = Math.round(performance.now() - jsStartMs);
          const rustMs = data.timing?.rustAppInitMs ?? 0;
          const ipcMs = Math.max(1, Math.round(ipcEndMs - jsStartMs));
          useToastStore.getState().addToast(
            `启动完成 ${totalMs}ms · Rust ${rustMs}ms / IPC ${ipcMs}ms`,
            'info',
            3000
          );

          if (data.hasLaunched) {
            tauriService.updateAppState(
              'welcome', 'last_launched_at',
              new Date().toISOString(), '上次启动时间'
            ).catch(() => {});
            setState('workspace');
          } else {
            setState('welcome');
          }
        } else {
          setState('workspace');
        }
      } catch (e) {
        console.error('[DIAG] AppWrapper getStartupStatus failed:', e);
        setState('workspace');
        // 出错也要确保骨架屏不闪
        const elapsedSinceMount = performance.now() - jsStartMs;
        if (elapsedSinceMount < MIN_SKELETON_MS) {
          await new Promise((resolve) => setTimeout(resolve, MIN_SKELETON_MS - elapsedSinceMount));
        }
      } finally {
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

  const handleGoToGuide = () => {
    setState('guide');
  };

  const goToWorkspace = () => setState('workspace');
  const goToActivityLog = () => setState('activity_log');
  const goToWelcome = () => setState('welcome');
  const goToGuide = () => setState('guide');

  const { openSettingsModal } = useSettingsStore();

  // —— 启动阶段（正在加载时）：完全不渲染任何内容
  //    启动视觉由 index.html 的内联 splash 卡片负责
  //    避免 React 容器（ThemeProvider/SettingsWrapper）带背景色产生白色矩形
  if (isLoading || state === 'loading') {
    return null;
  }

  return (
    // P1-14：最外层 OuterErrorBoundary 兜底，捕获任何逃逸 SettingsWrapper 内层 ErrorBoundary 的错误
    <OuterErrorBoundary>
    <ThemeProvider>
      {/* ⭐ v11：主应用背景色必须显式设置（html/body 已透明化）
         加一层 div 设 background-color 填充整个 1200×800 窗口 */}
      <div style={{
        minHeight: '100vh',
        width: '100%',
        background: 'var(--bg-primary, #f5f7fa)',
        color: 'var(--text-primary, #1f2328)',
      }}>
        <AppContext.Provider value={{ goToWorkspace, goToActivityLog, goToWelcome, goToGuide }}>
          <StartupContext.Provider value={{ startupData, isStartupLoaded: true }}>
            <SettingsWrapper>
              {state === 'welcome' && <Welcome onGetStarted={handleGetStarted} onGoToGuide={handleGoToGuide} onGoToSettings={openSettingsModal} />}
              {state === 'guide' && <Guide onComplete={handleGuideComplete} onSkip={handleGuideSkip} />}
              {state === 'workspace' && <App />}
              {state === 'activity_log' && <ActivityLog />}
              <SettingsModal />
            </SettingsWrapper>
          </StartupContext.Provider>
        </AppContext.Provider>
      </div>
      
    </ThemeProvider>
    </OuterErrorBoundary>
  );
};

const SettingsWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <SettingsProvider>
      <ThemeSettingsSync />
      <CacheSettingsSync />
      <AdvancedSettingsSync>
        <LocaleProvider>
          <ShortcutProvider>
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </ShortcutProvider>
        </LocaleProvider>
      </AdvancedSettingsSync>
    </SettingsProvider>
  );
};

/**
 * OuterErrorBoundary（P1-14）：
 *
 * 最外层兜底 ErrorBoundary，捕获任何逃逸 SettingsWrapper 内层 ErrorBoundary 的错误
 * （如 ThemeProvider / AppContext.Provider / StartupContext.Provider 渲染时抛错）。
 *
 * 设计动机：
 * - 原本 ErrorBoundary 嵌在 SettingsWrapper 内部，无法捕获 SettingsProvider
 *   之外所有 Context Provider 的渲染错误
 * - 加一层外层兜底确保用户永远看到友好的错误界面，而不是白屏
 */
const OuterErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <ErrorBoundary>{children}</ErrorBoundary>;
};

export default AppWrapper;
import React, { Suspense } from 'react';
import {
  useAppStore,
  useProjectStore,
  useImportStore,
  useSettingsStore,
  useTableStore,
  useWorkspaceStore,
  useQueryStore,
  useDashboardStore,
  useTaskStore,
} from './store';
import { Header, Toast } from './components/common';
import { useStartupContext } from './AppWrapper';
import { useSetting } from './context/SettingsContext';
import { setDeveloperMode, setLogLevel } from './utils/logger';
import { tauriService } from './services/tauri';
import type { ProjectInfo } from './types';
import './App.css';

// ============================================================
// M7.2 代码分割：重量级组件通过 React.lazy 动态加载
// - Workspace: 核心工作区（包含 SQL 编辑器、表格、查询历史等）
// - ProjectManager: 项目管理弹窗（仅在打开时加载）
// 好处：首屏 JS 体积显著下降，用户先看到骨架，模块按需加载
// ============================================================
const LazyWorkspace = React.lazy(() =>
  import('./components/workspace/Workspace').then(m => ({ default: m.Workspace })),
);
const LazyProjectManager = React.lazy(() =>
  import('./components/project').then(m => ({ default: m.ProjectManager })),
);

/**
 * 统一的懒加载占位组件：与主题色保持一致的骨架屏
 * 在 Suspense fallback 中复用可确保视觉一致性
 */
function LoadingSkeleton() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
        color: 'var(--text-secondary)',
        fontSize: 14,
        gap: 8,
      }}
    >
      <div
        aria-hidden
        style={{
          width: 14,
          height: 14,
          border: '2px solid var(--border-default)',
          borderTopColor: 'var(--accent-primary)',
          borderRadius: '50%',
          animation: 'quicker-skeleton-spin 0.8s linear infinite',
        }}
      />
      <span>加载中...</span>
    </div>
  );
}

function App() {
  const { startupData, isStartupLoaded } = useStartupContext();
  const { openSettingsModal } = useSettingsStore();
  const [developerMode] = useSetting('advanced', 'developerMode');
  const [showDebugInfo] = useSetting('advanced', 'showDebugInfo');
  const [logLevel] = useSetting('advanced', 'logLevel');
  const [sessionTimeout] = useSetting('security', 'sessionTimeout');

  // 密码保护状态
  const [isLocked, setIsLocked] = React.useState(false);
  const [passwordInput, setPasswordInput] = React.useState('');
  const [passwordError, setPasswordError] = React.useState('');
  const [enablePasswordProtect] = useSetting('security', 'enablePasswordProtect');
  const [autoLock] = useSetting('security', 'autoLock');
  const [lockTimeout] = useSetting('security', 'lockTimeout');

  // Advanced 设置项
  const [enableTelemetry] = useSetting('advanced', 'enableTelemetry');
  const [checkForUpdates] = useSetting('advanced', 'checkForUpdates');
  const [dataDir] = useSetting('advanced', 'dataDir');
  const [tempDir] = useSetting('advanced', 'tempDir');

  // 检查是否需要锁定（启动时检查密码保护）
  React.useEffect(() => {
    if (enablePasswordProtect === 'true') {
      const storedHash = localStorage.getItem('__app_password_hash');
      if (!storedHash) {
        // 首次启用，需要设置密码
        // 暂时不锁定，等用户设置
      } else {
        // 需要解锁
        setIsLocked(true);
      }
    }
  }, [enablePasswordProtect]);

  // 自动锁定空闲计时器
  React.useEffect(() => {
    if (autoLock !== 'true' || enablePasswordProtect !== 'true') return;

    const timeoutMinutes = parseInt(lockTimeout || '5', 10);
    if (timeoutMinutes <= 0) return;

    const timeoutMs = timeoutMinutes * 60 * 1000;
    let timeoutId: number | null = null;

    const lockApp = () => {
      setIsLocked(true);
      setPasswordInput('');
      setPasswordError('');
    };

    const resetTimer = () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      // 如果已经锁定，不重置计时器
      if (!isLocked) {
        timeoutId = window.setTimeout(lockApp, timeoutMs);
      }
    };

    const handleActivity = () => {
      if (!isLocked) {
        resetTimer();
      }
    };

    resetTimer();

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('mousedown', handleActivity);
    window.addEventListener('touchstart', handleActivity);

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
    };
  }, [autoLock, lockTimeout, enablePasswordProtect, isLocked]);

  // 密码验证逻辑
  const handlePasswordSubmit = () => {
    const storedHash = localStorage.getItem('__app_password_hash');
    if (!storedHash) {
      // 设置新密码（简单哈希存储）
      const hash = btoa(passwordInput); // 简化实现，生产环境应使用更安全的哈希
      localStorage.setItem('__app_password_hash', hash);
      setIsLocked(false);
      setPasswordInput('');
      setPasswordError('');
    } else {
      // 验证密码
      const hash = btoa(passwordInput);
      if (hash === storedHash) {
        setIsLocked(false);
        setPasswordInput('');
        setPasswordError('');
      } else {
        setPasswordError('密码错误');
      }
    }
  };

  // developerMode: 控制控制台日志输出
  React.useEffect(() => {
    setDeveloperMode(developerMode === 'true');
  }, [developerMode]);

  // logLevel: 控制日志输出级别
  React.useEffect(() => {
    const validLevels = ['debug', 'info', 'warn', 'error'];
    if (logLevel && validLevels.includes(logLevel)) {
      setLogLevel(logLevel as 'debug' | 'info' | 'warn' | 'error');
    }
  }, [logLevel]);

  // sessionTimeout: 会话超时后清除敏感数据（自动保存的 SQL）
  React.useEffect(() => {
    const timeoutMinutes = parseInt(sessionTimeout || '120', 10);
    if (timeoutMinutes <= 0) return;

    const timeoutMs = timeoutMinutes * 60 * 1000;

    const cleanupSensitiveData = () => {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('__autosave_') || key.startsWith('__autorecover_'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      if (keysToRemove.length > 0) {
        console.info(`[SessionTimeout] 会话超时，已清除 ${keysToRemove.length} 个自动保存文件`);
      }
    };

    let timeoutId: number | null = null;

    const resetTimer = () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(cleanupSensitiveData, timeoutMs);
    };

    const handleActivity = () => {
      resetTimer();
    };

    resetTimer();

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('mousedown', handleActivity);
    window.addEventListener('touchstart', handleActivity);

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
    };
  }, [sessionTimeout]);

  // advanced.enableTelemetry: 遥测开关（读取设置并记录日志）
  React.useEffect(() => {
    if (enableTelemetry === 'true') {
      console.info('[Telemetry] 遥测功能已启用，使用数据将被记录以帮助改进应用');
    }
  }, [enableTelemetry]);

  // advanced.checkForUpdates: 更新检查（读取设置）
  React.useEffect(() => {
    if (checkForUpdates === 'true') {
      console.info('[Updates] 自动检查更新已启用');
    }
  }, [checkForUpdates]);

  // advanced.dataDir: 数据目录配置（读取设置）
  React.useEffect(() => {
    if (dataDir) {
      console.info(`[Config] 数据目录设置为: ${dataDir}`);
    }
  }, [dataDir]);

  // advanced.tempDir: 临时目录配置（读取设置）
  React.useEffect(() => {
    if (tempDir) {
      console.info(`[Config] 临时目录设置为: ${tempDir}`);
    }
  }, [tempDir]);

  const {
    activeTab,
    setActiveTab,
    setMessage,
  } = useAppStore();

  const {
    currentProject,
    showProjectModal,
    setProjects,
    setCurrentProject,
    setCurrentProjectId,
    setShowProjectModal,
    setCurrentDbPath,
    getDatabaseStatus,
    loadProjects,
    importDataV2,
    setAllDatabaseStatus,
  } = useProjectStore();

  const {
    importItems,
    clearImportItems,
    setLoading,
  } = useImportStore();

  const { listTables } = useTableStore();

  // P0-2 启动优化：优先使用 startup context 中的缓存数据
  // 避免启动时重复发出 IPC 调用；如果 isStartupLoaded=true 时直接消费
  React.useEffect(() => {
    if (!isStartupLoaded || !startupData) return;
    // 直接消费 startupData，不触发任何 fallback IPC
    if (startupData.projectList?.length) {
      setProjects(startupData.projectList);
    }
    if (startupData.currentDbPath) {
      setCurrentDbPath(startupData.currentDbPath);
      // 新架构下项目目录名为 UUID，无法再从路径反推项目名，
      // 改为通过 getCurrentProjectId 获取项目 ID，再从 projectList 查找名称
      void (async () => {
        const response = await tauriService.getCurrentProjectId();
        if (response.success && response.data) {
          const projectId = response.data;
          setCurrentProjectId(projectId);
          const project = startupData.projectList?.find((p) => p.id === projectId);
          if (project) {
            setCurrentProject(project.name);
          }
        }
      })();
    }
    if (startupData.databaseStatus) {
      setAllDatabaseStatus([{
        db_type: 'sqlite',
        tables: [],
        row_count: [],
        is_connected: startupData.databaseStatus.isConnected,
        path: startupData.databaseStatus.path,
        tableCount: startupData.databaseStatus.tableCount,
      }]);
    }
  }, [isStartupLoaded, startupData]);

  const refreshDatabaseStatus = () => {
    void getDatabaseStatus();
  };

  /**
   * 切换项目后的统一刷新协调函数。
   *
   * 刷新策略（满足 G4 性能要求 < 200ms）：
   *   1. 串行：先刷新 projectStore（其他 Store 的刷新可能依赖 currentProjectId）
   *   2. 并行：独立 Store 同时刷新，互不阻塞
   *
   * 错误隔离：单个 Store 刷新失败不会阻塞其他 Store，
   * 整体 Promise.all 用 catch 兜底，仅记录错误日志。
   */
  const handleProjectSwitchRefresh = async (
    newProjectId: string,
    newProjectInfo?: ProjectInfo,
  ) => {
    // 1. 串行：先更新 projectStore（currentProjectId / currentProject / currentDbPath）
    await useProjectStore.getState().refreshAfterProjectSwitch(newProjectId, newProjectInfo);

    // 1.5 重置 dashboardStore，避免旧项目 activeDashboardId 残留
    useDashboardStore.getState().resetForProjectSwitch();

    // 2. 并行：独立 Store 同时刷新
    await Promise.all([
      // workspaceStore：从新项目数据库加载 tabs / panels
      useWorkspaceStore.getState().loadFromBackend(),
      // tableStore：加载新项目的表列表（只加载表名，行数异步）
      listTables(),
      // queryStore：清空查询历史（新项目的历史按需从后端加载）
      Promise.resolve(useQueryStore.getState().clearHistory()),
      // dashboardStore：加载新项目的仪表盘数据
      useDashboardStore.getState().loadDashboards(),
      // taskStore：加载新项目的任务数据
      useTaskStore.getState().loadTasks(),
      // 刷新数据库状态（表数量等）
      getDatabaseStatus(),
      // 切换项目后重新预加载 DuckDB（异步，不阻塞）
      tauriService.preloadDuckdb().catch((e) => {
        console.error('[ProjectSwitch] DuckDB 预加载失败:', e);
      }),
    ]).catch((err) => {
      // 单个 Store 刷新失败不阻塞整体流程，仅记录日志
      console.error('[ProjectSwitch] 部分 Store 刷新失败:', err);
    });
  };

  const handleImportComplete = () => {
    refreshDatabaseStatus();
  };

  const handleBatchImport = async () => {
    const selectedItems = importItems.filter(i => i.selected && !i.isParent);
    if (selectedItems.length === 0) {
      setMessage('请先选择要导入的文件', 'warning');
      return;
    }

    setLoading(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (const item of selectedItems) {
        useImportStore.getState().updateImportItem(item.id, { status: 'importing' });

        const ok = await importDataV2({
          file_path: item.filePath,
          sheet_name: item.sheetName,
          table_name: item.tableName,
          has_header: item.hasHeader,
          fields: item.fields,
        });

        if (ok) {
          useImportStore.getState().updateImportItem(item.id, { status: 'success' });
          successCount++;
        } else {
          useImportStore.getState().updateImportItem(item.id, { status: 'error' });
          failCount++;
        }
      }

      if (successCount > 0) {
        const message = failCount > 0
          ? `成功导入 ${successCount} 个文件，失败 ${failCount} 个`
          : `成功导入 ${successCount} 个文件`;
        setMessage(message, failCount > 0 ? 'warning' : 'success');
        handleImportComplete();
      } else if (failCount > 0) {
        setMessage(`导入失败：${failCount} 个文件`, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClearQueue = () => {
    clearImportItems();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'system-ui', background: 'var(--bg-primary)' }}>
      {/* 锁定界面 */}
      {isLocked && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'var(--bg-primary)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
          }}
        >
          <div
            style={{
              background: 'var(--bg-secondary)',
              borderRadius: 12,
              padding: '32px 48px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
              textAlign: 'center',
              minWidth: 320,
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
            <h2 style={{ margin: '0 0 24px 0', color: 'var(--text-primary)' }}>
              {localStorage.getItem('__app_password_hash') ? '应用已锁定' : '设置密码'}
            </h2>
            <div style={{ marginBottom: 16 }}>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                placeholder={localStorage.getItem('__app_password_hash') ? '输入密码解锁' : '设置密码'}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: 16,
                  border: '1px solid var(--border-default)',
                  borderRadius: 6,
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                autoFocus
              />
            </div>
            {passwordError && (
              <div style={{ color: 'var(--accent-error)', marginBottom: 16, fontSize: 14 }}>
                {passwordError}
              </div>
            )}
            <button
              onClick={handlePasswordSubmit}
              style={{
                width: '100%',
                padding: '12px 24px',
                fontSize: 16,
                fontWeight: 500,
                background: 'var(--accent-primary)',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              {localStorage.getItem('__app_password_hash') ? '解锁' : '确认'}
            </button>
            {enablePasswordProtect !== 'true' && (
              <button
                onClick={() => {
                  localStorage.removeItem('__app_password_hash');
                  setIsLocked(false);
                }}
                style={{
                  marginTop: 16,
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                关闭密码保护
              </button>
            )}
          </div>
        </div>
      )}

      <Header
        currentProject={currentProject}
        activeTab={activeTab}
        onProjectClick={() => setShowProjectModal(true)}
        onTabChange={setActiveTab}
        onSettingsClick={openSettingsModal}
      />

      {/* Workspace 是最大的子树之一，懒加载以降低首屏体积 */}
      <Suspense fallback={<LoadingSkeleton />}>
        <LazyWorkspace
          activeTab={activeTab}
          onImportComplete={handleImportComplete}
          onAddFile={() => {}}
          onBatchImport={handleBatchImport}
          onClearQueue={handleClearQueue}
        />
      </Suspense>

      {/* 项目管理弹窗仅在打开时动态加载，平时不占用首屏体积 */}
      {showProjectModal && (
        <Suspense fallback={<LoadingSkeleton />}>
          <LazyProjectManager
            onClose={() => setShowProjectModal(false)}
            onProjectSwitch={(newProjectId?: string, newProjectInfo?: ProjectInfo) => {
              if (newProjectId) {
                // 切换项目：后端已切换连接，前端统一刷新所有 Store
                void handleProjectSwitchRefresh(newProjectId, newProjectInfo);
              } else {
                // 仅刷新项目列表（如删除、复制后未切换）
                void loadProjects();
              }
            }}
            onProjectRename={(newName: string, isCurrent: boolean) => {
              void loadProjects();
              if (newName && isCurrent) {
                setCurrentProject(newName);
                // 重命名不动数据，不需要刷新表/查询/仪表盘
              }
            }}
          />
        </Suspense>
      )}

      <Toast />

      {/* 调试信息面板 */}
      {showDebugInfo === 'true' && (
        <div
          style={{
            position: 'fixed',
            bottom: 8,
            right: 8,
            background: 'rgba(0,0,0,0.85)',
            color: '#00ff00',
            padding: '8px 12px',
            borderRadius: 4,
            fontSize: 11,
            fontFamily: 'monospace',
            zIndex: 9999,
            maxWidth: 300,
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: 4 }}>🔧 Debug Info</div>
          <div>Project: {currentProject || 'None'}</div>
          <div>Active Tab: {activeTab || 'None'}</div>
          <div>Import Queue: {importItems.length}</div>
          <div>DB Status: {currentProject ? 'Connected' : 'Disconnected'}</div>
          <div>Time: {new Date().toLocaleTimeString()}</div>
        </div>
      )}
    </div>
  );
}

export default App;
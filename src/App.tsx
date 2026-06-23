import React, { Suspense } from 'react';
import { useAppStore, useProjectStore, useImportStore } from './store';
import { Header, Toast } from './components/common';
import { useStartupContext } from './AppWrapper';
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
    setShowProjectModal,
    setCurrentDbPath,
    getDatabaseStatus,
    loadProjects,
    loadCurrentDbPath,
    importDataV2,
    setAllDatabaseStatus,
  } = useProjectStore();

  const {
    importItems,
    clearImportItems,
    setLoading,
  } = useImportStore();

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
      const parts = startupData.currentDbPath.split(/[\\/]/);
      const projectName = parts[parts.length - 2];
      if (projectName && projectName !== 'quickersql') {
        setCurrentProject(projectName);
      }
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
      <Header
        currentProject={currentProject}
        activeTab={activeTab}
        onProjectClick={() => setShowProjectModal(true)}
        onTabChange={setActiveTab}
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
            onProjectSwitch={() => {
              void loadProjects();
              void loadCurrentDbPath();
              refreshDatabaseStatus();
            }}
          />
        </Suspense>
      )}

      <Toast />
    </div>
  );
}

export default App;
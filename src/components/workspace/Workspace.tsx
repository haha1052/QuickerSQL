import React from 'react';
import type { TabType } from '../../types';
import { Toolbar } from '../common/Toolbar';
import { Sidebar } from '../common/Sidebar';
import SidebarResizeHandle from './SidebarResizeHandle';
import { WorkspaceTabs } from './WorkspaceTabs';
import { PanelManager } from './PanelManager';
import { useWorkspaceStore, useQueryStore, SIDEBAR_DEFAULT_WIDTH } from '../../store';
import { useStartupContext } from '../../AppWrapper';
import { useQueryExecution, editorSelectionGetter } from '../sql/hooks';
import { useLocale } from '../../context/LocaleContext';

// v2 启动优化：非 SQL Tab 的页面组件改为 React.lazy，减少首屏 bundle 体积
// DataImport / DashboardPage / TaskCenterPage 在用户切换到对应 tab 时才加载
const DataImport = React.lazy(() =>
  import('../import/DataImport').then((m) => ({ default: m.DataImport })),
);
const DashboardPage = React.lazy(() =>
  import('../dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const TaskCenterPage = React.lazy(() =>
  import('../automation/TaskCenterPage').then((m) => ({ default: m.TaskCenterPage })),
);

interface WorkspaceProps {
  activeTab: TabType;
  onImportComplete?: () => void;
  onAddFile?: () => void;
  onBatchImport?: () => void;
  onClearQueue?: () => void;
}

export const Workspace: React.FC<WorkspaceProps> = ({
  activeTab,
  onImportComplete,
  onAddFile,
  onBatchImport,
  onClearQueue,
}) => {
  const { tabs, activeTabId, loadFromBackend, setTabsFromStartup, sidebar } = useWorkspaceStore();
  const setActiveQueryId = useQueryStore(s => s.setActiveQueryId);
  const sqlQueries = useQueryStore(s => s.sqlQueries);
  const addSqlQuery = useQueryStore(s => s.addSqlQuery);
  const startupCtx = useStartupContext();
  const { t } = useLocale();
  const { executeSelectedOrAll, isLoading } = useQueryExecution();
  const activeTabData = tabs.find(t => t.id === activeTabId);

  // v2 优化：优先消费 StartupContext 已返回的 workspaceLayout
  // 只有当它为 null/空数组时才发起独立 IPC
  React.useEffect(() => {
    if (!startupCtx.isStartupLoaded) return;
    if (startupCtx.startupData?.workspaceLayout && startupCtx.startupData.workspaceLayout.length > 0) {
      setTabsFromStartup(startupCtx.startupData.workspaceLayout);
      return;
    }
    loadFromBackend();
  }, [startupCtx.isStartupLoaded, startupCtx.startupData?.workspaceLayout?.length]);

  // 初始化时确保查询和标签页正确关联（基于 SqlQuery.id 精确匹配，不依赖数组索引）
  React.useEffect(() => {
    if (activeTab === 'sql' && activeTabData) {
      // 检查标签页是否有 queryId
      if (!activeTabData.queryId) {
        // 如果没有，找到或创建一个查询并关联
        const { updateTab } = useWorkspaceStore.getState();

        let targetQueryId: string;

        // 策略：从第一个未被其他 Tab 占用的 SqlQuery 分配
        const usedIds = new Set(
          tabs.filter(t => t.id !== activeTabId && t.queryId).map(t => t.queryId)
        );
        const availableQuery = sqlQueries.find(q => !usedIds.has(q.id));

        if (availableQuery) {
          targetQueryId = availableQuery.id;
        } else {
          // 如果没有，创建一个新的
          addSqlQuery();
          const { sqlQueries: newQueries } = useQueryStore.getState();
          targetQueryId = newQueries[newQueries.length - 1].id;
        }

        // 更新标签页的 queryId
        updateTab(activeTabId, { queryId: targetQueryId });
      } else {
        // 已经有 queryId，先校验该查询是否真实存在（修复启动布局映射产生的无效 ID）
        const queryExists = sqlQueries.some(q => q.id === activeTabData.queryId);
        if (!queryExists) {
          const { updateTab } = useWorkspaceStore.getState();
          addSqlQuery();
          const { sqlQueries: newQueries } = useQueryStore.getState();
          const targetQueryId = newQueries[newQueries.length - 1].id;
          updateTab(activeTabId, { queryId: targetQueryId });
          setActiveQueryId(targetQueryId);
        } else if (useQueryStore.getState().activeQueryId !== activeTabData.queryId) {
          setActiveQueryId(activeTabData.queryId);
        }
      }
    }
  }, [activeTab, activeTabId, activeTabData, sqlQueries, tabs, addSqlQuery, setActiveQueryId]);

  const handleImportComplete = () => {
    if (onImportComplete) {
      onImportComplete();
    }
  };

  if (activeTab === 'csv') {
    return (
      <div style={styles.container}>
        <Toolbar
          activeTab={activeTab}
          onAddFile={onAddFile}
          onBatchImport={onBatchImport}
          onClearQueue={onClearQueue}
        />
        <div style={styles.importContent}>
          <React.Suspense fallback={<div style={styles.lazyFallback}>加载数据导入模块...</div>}>
            <DataImport onImportComplete={handleImportComplete} />
          </React.Suspense>
        </div>
      </div>
    );
  }

  // 仪表盘 Tab：不显示 SQL 查询的 Sidebar（数据库浏览器/查询历史/回收站等）
  if (activeTab === 'dashboard') {
    return (
      <div style={styles.container}>
        <Toolbar
          activeTab={activeTab}
          onAddFile={onAddFile}
          onBatchImport={onBatchImport}
          onClearQueue={onClearQueue}
        />
        <div style={styles.dashboardContent}>
          <React.Suspense fallback={<div style={styles.lazyFallback}>加载仪表盘模块...</div>}>
            <DashboardPage />
          </React.Suspense>
        </div>
      </div>
    );
  }

  // 自动化任务 Tab：任务中心主页
  if (activeTab === 'automation') {
    return (
      <div style={styles.container}>
        <Toolbar
          activeTab={activeTab}
          onAddFile={onAddFile}
          onBatchImport={onBatchImport}
          onClearQueue={onClearQueue}
        />
        <div style={styles.dashboardContent}>
          <React.Suspense fallback={<div style={styles.lazyFallback}>加载自动化任务模块...</div>}>
            <TaskCenterPage />
          </React.Suspense>
        </div>
      </div>
    );
  }

  // SQL 查询 Tab：显示 Sidebar（数据库浏览器/查询历史/回收站）
  return (
    <div style={styles.container}>
      <div style={styles.mainContent}>
        <div
          id="sidebar-container"
          style={{
            width: sidebar.collapsed ? 48 : (sidebar.width ?? SIDEBAR_DEFAULT_WIDTH),
            height: '100%',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-secondary)',
            borderRight: '1px solid var(--border-primary)',
            position: 'relative',
            overflow: 'visible',
          }}
        >
          <Sidebar />
          {!sidebar.collapsed && <SidebarResizeHandle />}
        </div>
        <div style={styles.workspaceArea}>
          {/* 第一行：工具栏 */}
          <Toolbar
            activeTab={activeTab}
            onAddFile={onAddFile}
            onBatchImport={onBatchImport}
            onClearQueue={onClearQueue}
          />
          {/* 第二行：标签栏 + 执行栏 */}
          <div style={styles.tabsAndExecutionRow}>
            <div style={styles.tabsSection}>
              <WorkspaceTabs />
            </div>
            <div style={styles.executeButtonSection}>
              <button
                style={{
                  ...styles.executeButton,
                  opacity: isLoading ? 0.7 : 1,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                }}
                onClick={() => {
                  const selectedSql = editorSelectionGetter.current?.();
                  executeSelectedOrAll(selectedSql);
                }}
                disabled={isLoading}
              >
                <span style={styles.executeIcon}>▶</span>
                {isLoading ? t('sqlEditor.executing') : `${t('query.execute')} SQL`}
              </button>
            </div>
          </div>
          {/* 第三行：编辑器 */}
          <div style={styles.workspaceContent}>
            {activeTabData && (
              <PanelManager
                tabId={activeTabData.id}
                panels={activeTabData.panels}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    background: 'var(--bg-secondary)',
  },
  mainContent: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  importContent: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  workspaceArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  tabsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'var(--bg-tertiary)',
    borderBottom: '1px solid var(--border-primary)',
    flexShrink: 0,
  },
  tabsAndExecutionRow: {
    display: 'flex',
    alignItems: 'center',
    background: 'var(--bg-tertiary)',
    borderBottom: '1px solid var(--border-primary)',
    flexShrink: 0,
    height: '40px',
  },
  tabsSection: {
    flex: 1,
    display: 'flex',
    alignItems: 'stretch',
    overflow: 'hidden',
    height: '100%',
    minWidth: 0,
  },
  executeButtonSection: {
    display: 'flex',
    alignItems: 'center',
    paddingRight: '12px',
    paddingLeft: '8px',
    flexShrink: 0,
  },
  executeButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    height: '24px',
    padding: '0 10px',
    background: 'var(--primary)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
    transition: 'opacity 0.15s ease',
  },
  executeIcon: {
    fontSize: '10px',
  },
  workspaceContent: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  dashboardContent: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
    background: 'var(--bg-primary)',
    minHeight: 0,
  },
  dashboardPlaceholder: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-secondary)',
    padding: '48px 24px',
    gap: '16px',
  },
  dashboardIcon: {
    fontSize: '64px',
    marginBottom: '8px',
  },
  lazyFallback: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-secondary)',
    fontSize: 13,
    opacity: 0.7,
  },
  dashboardTitle: {
    fontSize: '24px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  dashboardDescription: {
    fontSize: '14px',
    maxWidth: '420px',
    textAlign: 'center',
    lineHeight: 1.6,
  },
};

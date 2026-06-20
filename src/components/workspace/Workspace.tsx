import React from 'react';
import type { TabType } from '../../types';
import { Toolbar } from '../common/Toolbar';
import { Sidebar } from '../common/Sidebar';
import SidebarResizeHandle from './SidebarResizeHandle';
import { WorkspaceTabs } from './WorkspaceTabs';
import { PanelManager } from './PanelManager';
import { DataImport } from '../import/DataImport';
import { DashboardPage } from '../dashboard/DashboardPage';
import { TaskCenterPage } from '../automation/TaskCenterPage';
import { useWorkspaceStore, useQueryStore, SIDEBAR_DEFAULT_WIDTH } from '../../store';

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
  const { tabs, activeTabId, loadFromBackend, sidebar } = useWorkspaceStore();
  const { setActiveQueryId, sqlQueries, addSqlQuery } = useQueryStore();
  const activeTabData = tabs.find(t => t.id === activeTabId);

  // 挂载时尝试从后端数据库加载工作区布局
  React.useEffect(() => {
    loadFromBackend();
  }, []);

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
        // 已经有 queryId，确保查询存储中的 activeQueryId 是对的
        if (useQueryStore.getState().activeQueryId !== activeTabData.queryId) {
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
          <DataImport
            onImportComplete={handleImportComplete}
          />
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
          <DashboardPage />
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
          <TaskCenterPage />
        </div>
      </div>
    );
  }

  // SQL 查询 Tab：显示 Sidebar（数据库浏览器/查询历史/回收站）
  return (
    <div style={styles.container}>
      <Toolbar
        activeTab={activeTab}
        onAddFile={onAddFile}
        onBatchImport={onBatchImport}
        onClearQueue={onClearQueue}
      />
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
          <WorkspaceTabs />
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

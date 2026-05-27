import React from 'react';
import type { TabType } from '../../types';
import { Toolbar } from '../common/Toolbar';
import { Sidebar } from '../common/Sidebar';
import { WorkspaceTabs } from './WorkspaceTabs';
import { PanelManager } from './PanelManager';
import { DataImport } from '../import/DataImport';
import { useWorkspaceStore, useQueryStore } from '../../store';

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
  const { tabs, activeTabId } = useWorkspaceStore();
  const { setActiveQueryId, sqlQueries, addSqlQuery } = useQueryStore();
  const activeTabData = tabs.find(t => t.id === activeTabId);

  // 初始化时确保查询和标签页正确关联
  React.useEffect(() => {
    if (activeTab === 'sql' && activeTabData) {
      // 检查标签页是否有 queryId
      if (!activeTabData.queryId) {
        // 如果没有，找到或创建一个查询并关联
        const { updateTab } = useWorkspaceStore.getState();
        
        let targetQueryId: string;
        
        // 尝试找到对应的查询
        const index = tabs.findIndex(t => t.id === activeTabId);
        if (sqlQueries[index]) {
          targetQueryId = sqlQueries[index].id;
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
  }, [activeTab, activeTabId, activeTabData, sqlQueries]);

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

  return (
    <div style={styles.container}>
      <Toolbar
        activeTab={activeTab}
        onAddFile={onAddFile}
        onBatchImport={onBatchImport}
        onClearQueue={onClearQueue}
      />
      <div style={styles.mainContent}>
        <Sidebar />
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
        <div style={styles.rightPanel} />
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
    background: '#fff',
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
  rightPanel: {
    width: '0px',
    borderLeft: '1px solid #e0e0e0',
    background: '#fafafa',
  },
};

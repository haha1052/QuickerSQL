import React, { useState } from 'react';
import { useAppStore, useProjectStore, useImportStore } from './store';
import type { TabType } from './types';
import { Header, Toast } from './components/common';
import { ProjectManager } from './components/project';
import { Workspace } from './components/workspace/Workspace';
import { tauriService } from './services';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('sql');

  const {
    setMessage,
  } = useAppStore();

  const {
    currentProject,
    showProjectModal,
    setProjects,
    setCurrentProject,
    setShowProjectModal,
    setCurrentDbPath,
  } = useProjectStore();

  const {
    importItems,
    clearImportItems,
    setLoading,
  } = useImportStore();

  const refreshDatabaseStatus = async () => {
    const response = await tauriService.getDatabaseStatus();
    if (response.success && response.data) {
      useAppStore.getState().setAllDatabaseStatus([response.data]);
    }
  };

  React.useEffect(() => {
    console.log('[DIAG] App useEffect started');
    loadProjects();
    loadCurrentDbPath();
    refreshDatabaseStatus();
  }, []);

  const loadProjects = async () => {
    console.log('[DIAG] loadProjects start');
    const response = await tauriService.listProjects();
    console.log('[DIAG] loadProjects done:', response.success);
    if (response.success && response.data) {
      setProjects(response.data);
    }
  };

  const loadCurrentDbPath = async () => {
    console.log('[DIAG] loadCurrentDbPath start');
    const response = await tauriService.getCurrentDbPath();
    console.log('[DIAG] loadCurrentDbPath done:', response.success);
    if (response.success && response.data) {
      setCurrentDbPath(response.data);
      const parts = response.data.split(/[\\/]/);
      const projectName = parts[parts.length - 2];
      if (projectName && projectName !== 'quickersql') {
        setCurrentProject(projectName);
      }
    }
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
    const successDetails: string[] = [];
    const failDetails: string[] = [];

    try {
      for (const item of selectedItems) {
        try {
          useImportStore.getState().updateImportItem(item.id, { status: 'importing' });
          
          const response = await tauriService.importDataV2({
            file_path: item.filePath,
            sheet_name: item.sheetName,
            table_name: item.tableName,
            has_header: item.hasHeader,
            fields: item.fields,
          });

          if (response.success) {
            useImportStore.getState().updateImportItem(item.id, { status: 'success' });
            successCount++;
            successDetails.push(`${item.tableName}: ${response.data || '成功'}`);
          } else {
            useImportStore.getState().updateImportItem(item.id, { status: 'error', error: response.error });
            failCount++;
            failDetails.push(`${item.tableName}: ${response.error || '未知错误'}`);
          }
        } catch (e) {
          useImportStore.getState().updateImportItem(item.id, { status: 'error', error: String(e) });
          failCount++;
          failDetails.push(`${item.tableName}: ${String(e)}`);
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
        onTabChange={(tab) => setActiveTab(tab as TabType)}
      />

      {/* {message && (
        <Message
          message={message}
          type={messageType}
          onClose={clearMessage}
        />
      )} */}

      <Workspace
        activeTab={activeTab}
        onImportComplete={handleImportComplete}
        onAddFile={() => {}}
        onBatchImport={handleBatchImport}
        onClearQueue={handleClearQueue}
      />

      {showProjectModal && (
        <ProjectManager
          onClose={() => setShowProjectModal(false)}
          onProjectSwitch={() => {
            loadProjects();
            loadCurrentDbPath();
            refreshDatabaseStatus();
          }}
        />
      )}

      <Toast />
    </div>
  );
}

export default App;

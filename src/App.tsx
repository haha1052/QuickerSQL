import React, { useState } from 'react';
import { useAppStore, useProjectStore, useImportStore } from './store';
import type { TabType } from './types';
import { Header, Message, StatusBar } from './components/common';
import { ProjectManager } from './components/project';
import { Workspace } from './components/workspace/Workspace';
import { tauriService } from './services';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('sql');
  
  const {
    message,
    messageType,
    allDatabaseStatus,
    setAllDatabaseStatus,
    setMessage,
    clearMessage,
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
      setAllDatabaseStatus([response.data]);
    }
  };

  React.useEffect(() => {
    loadProjects();
    loadCurrentDbPath();
    refreshDatabaseStatus();
  }, []);

  const loadProjects = async () => {
    const response = await tauriService.listProjects();
    if (response.success && response.data) {
      setProjects(response.data);
    }
  };

  const loadCurrentDbPath = async () => {
    const response = await tauriService.getCurrentDbPath();
    if (response.success && response.data) {
      setCurrentDbPath(response.data);
      const parts = response.data.split(/[\\/]/);
      const projectName = parts[parts.length - 2];
      if (projectName && projectName !== 'la-duck') {
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
        
        if (failCount > 0) {
          console.log('导入失败详情:', failDetails);
        }
      } else if (failCount > 0) {
        setMessage(`导入失败：${failCount} 个文件`, 'error');
        console.log('导入失败详情:', failDetails);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClearQueue = () => {
    clearImportItems();
  };

  const isConnected = allDatabaseStatus.length > 0 && allDatabaseStatus[0].is_connected;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'system-ui' }}>
      <Header
        currentProject={currentProject}
        currentDbPath={useProjectStore.getState().currentDbPath}
        activeTab={activeTab}
        onProjectClick={() => setShowProjectModal(true)}
        onTabChange={(tab) => setActiveTab(tab as TabType)}
        onRefresh={refreshDatabaseStatus}
        isConnected={isConnected}
      />

      {message && (
        <Message
          message={message}
          type={messageType}
          onClose={clearMessage}
        />
      )}

      <Workspace
        activeTab={activeTab}
        onImportComplete={handleImportComplete}
        onAddFile={() => {}} // 空回调，实际处理在 DataImport 内部
        onBatchImport={handleBatchImport}
        onClearQueue={handleClearQueue}
      />

      <StatusBar />

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
    </div>
  );
}

export default App;

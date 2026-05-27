import { useEffect } from 'react';
import { useAppStore, useProjectStore, useQueryStore } from './store';
import { tauriService } from './services';
import { Header, Message } from './components/common';
import { ProjectManager } from './components/project';
import { SQLEditor } from './components/sql';
import { DataImport } from './components/import';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import './App.css';

ModuleRegistry.registerModules([AllCommunityModule]);

const zhCNLocaleText = {
  equals: '等于',
  notEqual: '不等于',
  lessThan: '小于',
  greaterThan: '大于',
  filterOoo: '筛选...',
  applyFilter: '应用筛选',
  resetFilter: '重置筛选',
  noRowsToShow: '暂无数据',
};

function App() {
  const {
    activeTab,
    message,
    messageType,
    setActiveTab,
    setMessage,
    clearMessage,
    setAllDatabaseStatus,
    allDatabaseStatus,
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
    sqlQueries,
    activeQueryId,
    queryLoading,
    updateSqlQuery,
    setActiveQueryId,
    setQueryLoading,
    setQueryResult,
    addSqlQuery,
    removeSqlQuery,
  } = useQueryStore();

  useEffect(() => {
    loadProjects();
    loadCurrentDbPath();
    refreshAllDatabaseStatus();
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

  const refreshAllDatabaseStatus = async () => {
    const response = await tauriService.getDatabaseStatus();
    if (response.success && response.data) {
      setAllDatabaseStatus([response.data]);
    }
  };

  const handleExecuteQuery = async () => {
    const query = sqlQueries.find(q => q.id === activeQueryId);
    if (!query || !query.sql.trim()) {
      setMessage('请输入 SQL 查询语句', 'warning');
      return;
    }

    setQueryLoading(activeQueryId);
    try {
      const response = await tauriService.executeSql(query.sql);
      if (response.success && response.data) {
        const batchResults = response.data.results;
        const successResults = batchResults.filter(r => r.success);
        const lastQueryResult = successResults.find(r => r.columns && r.rows);

        if (lastQueryResult && lastQueryResult.columns && lastQueryResult.rows) {
          setQueryResult(activeQueryId, {
            columns: lastQueryResult.columns,
            rows: lastQueryResult.rows,
          });
        }

        const failedCount = response.data.fail_count;
        const successCount = response.data.success_count;

        if (failedCount > 0) {
          const failedMessages = batchResults
            .filter(r => !r.success && r.error)
            .map(r => `${r.statement}: ${r.error}`)
            .join('\n');
          setMessage(`执行完成: ${successCount} 成功, ${failedCount} 失败\n${failedMessages}`, 'error');
        } else {
          setMessage(`执行成功: ${successCount} 条语句`, 'success');
        }

        refreshAllDatabaseStatus();
      } else {
        setMessage('执行失败: ' + response.error, 'error');
      }
    } catch (e) {
      setMessage('执行失败: ' + e, 'error');
    } finally {
      setQueryLoading(null);
    }
  };

  const activeQuery = sqlQueries.find(q => q.id === activeQueryId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'system-ui' }}>
      <Header
        currentProject={currentProject}
        currentDbPath={useProjectStore.getState().currentDbPath}
        activeTab={activeTab}
        onProjectClick={() => setShowProjectModal(true)}
        onTabChange={setActiveTab}
        onRefresh={refreshAllDatabaseStatus}
        isConnected={allDatabaseStatus.length > 0 && allDatabaseStatus[0].is_connected}
      />

      {message && (
        <Message
          message={message}
          type={messageType}
          onClose={clearMessage}
        />
      )}

      {activeTab === 'csv' && (
        <DataImport onImportComplete={refreshAllDatabaseStatus} />
      )}

      {activeTab === 'sql' && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{ width: '250px', borderRight: '1px solid #ddd', overflowY: 'auto', background: '#f8f9fa' }}>
            <div style={{ padding: '12px', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold', fontSize: '14px' }}>查询列表</span>
              <button
                style={{ padding: '4px 8px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                onClick={addSqlQuery}
              >
                + 新建
              </button>
            </div>
            {sqlQueries.map(query => (
              <div
                key={query.id}
                style={{
                  padding: '12px',
                  borderBottom: '1px solid #eee',
                  cursor: 'pointer',
                  background: activeQueryId === query.id ? '#e3f2fd' : 'transparent',
                  borderLeft: activeQueryId === query.id ? '3px solid #007bff' : '3px solid transparent',
                }}
                onClick={() => setActiveQueryId(query.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', fontWeight: activeQueryId === query.id ? 'bold' : 'normal' }}>
                    {query.name}
                  </span>
                  {sqlQueries.length > 1 && (
                    <button
                      style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '16px', padding: '0 4px' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSqlQuery(query.id);
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ height: '40%', borderBottom: '1px solid #ddd', display: 'flex', flexDirection: 'column' }}>
              <SQLEditor
                query={activeQuery || sqlQueries[0]}
                onChange={(sql) => updateSqlQuery(activeQueryId, { sql })}
                onExecute={handleExecuteQuery}
                isLoading={queryLoading === activeQueryId}
              />
            </div>

            <div style={{ flex: 1, overflow: 'hidden' }}>
              {activeQuery?.result ? (
                <div style={{ height: '100%' }} className="ag-theme-alpine">
                  <AgGridReact<any>
                    rowData={activeQuery.result.rows}
                    columnDefs={activeQuery.result.columns.map((col, index) => ({
                      field: `col${index}`,
                      headerName: col,
                    }))}
                    localeText={zhCNLocaleText}
                    defaultColDef={{
                      filter: true,
                      sortable: true,
                      resizable: true,
                      minWidth: 120,
                    }}
                  />
                </div>
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                  暂无查询结果
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showProjectModal && (
        <ProjectManager
          onClose={() => setShowProjectModal(false)}
          onProjectSwitch={() => {
            loadProjects();
            loadCurrentDbPath();
            refreshAllDatabaseStatus();
          }}
        />
      )}
    </div>
  );
}

export default App;

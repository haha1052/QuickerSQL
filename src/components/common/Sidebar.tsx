import React from 'react';
import {
  DatabaseIcon,
  ClockIcon,
  FileCodeIcon,
  TrashIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from './Icons';
import { useWorkspaceStore, useAppStore, useQueryStore } from '../../store';
import { useLocale } from '../../context/LocaleContext';
import { DatabaseExplorer } from './DatabaseExplorer';
import QueryHistory from './QueryHistory';
import TrashPanel from '../trash';
import { SnippetsPanel } from './SnippetsPanel';
import type { SqlStatementResult } from '../../types';

/**
 * 应用左侧导航栏组件
 *
 * 职责：
 * - 提供四个导航项：数据浏览器、查询历史、代码片段、回收站
 * - 折叠状态下仅显示图标列，点击图标展开并切换到对应面板
 * - 展开状态下显示图标 + 文字，并通过 setSidebarActiveTab 切换内容区
 * - 内容区根据 activeTab 渲染 DatabaseExplorer / QueryHistory / SnippetsPanel / TrashPanel
 *
 * 副作用：
 * - handleExecuteSqlFromHistory 会创建新 SQL Tab 并立即执行 SQL
 * - handleInsertSql 将 SQL 片段追加到当前激活的查询编辑器
 *
 * @param props - 无 props（仅作为容器组件）
 */
export const Sidebar: React.FC = () => {
  const { sidebar, toggleSidebar, setSidebarActiveTab } = useWorkspaceStore();
  const { setActiveTab, setMessage } = useAppStore();
  const { t } = useLocale();

  /**
   * 从查询历史中执行 SQL：创建新 SQL Tab、写入 SQL 文本、立即调用 executeSql
   * 成功时把批量结果写回 queryStore 并 addToHistory；失败时通过 setMessage 报错
   *
   * @param sql - 要执行的 SQL 语句
   */
  const handleExecuteSqlFromHistory = async (sql: string) => {
    try {
      setActiveTab('sql');
      
      const { useWorkspaceStore, useQueryStore } = await import('../../store');
      const workspaceState = useWorkspaceStore.getState();
      const queryState = useQueryStore.getState();
      
      queryState.addSqlQuery();
      const { sqlQueries } = useQueryStore.getState();
      const newQuery = sqlQueries[sqlQueries.length - 1];
      queryState.updateSqlQuery(newQuery.id, { sql });
      queryState.setActiveQueryId(newQuery.id);
      
      workspaceState.addTab(
        {
          title: t('queryHistory.execute'),
          type: 'sql',
          panels: [
            { id: 'editor', type: 'sql_editor' as const, title: 'SQL Editor', size: 50, active: true, content: null },
            { id: 'results', type: 'results_grid' as const, title: 'Results', size: 50, active: true, content: null },
          ],
          active: true,
        },
        { queryId: newQuery.id, initialSql: sql }
      );

      const newTabId = useWorkspaceStore.getState().activeTabId;
      useWorkspaceStore.getState().setPanelMode(newTabId, 'default');
      
      queryState.setQueryLoading(newQuery.id);
      try {
        const { tauriService } = await import('../../services');
        const response = await tauriService.executeSql(sql);
        if (response.success && response.data) {
          const batchResults = response.data.results as SqlStatementResult[];
          queryState.setBatchResults(newQuery.id, batchResults);
          const successResults = batchResults.filter((r: SqlStatementResult) => r.success);
          const totalRows = successResults.reduce((sum: number, item: SqlStatementResult) => sum + (item.rows?.length || 0), 0);
          const hasSuccess = successResults.length > 0;
          queryState.addToHistory(sql, hasSuccess, totalRows);
          if (hasSuccess) {
            setMessage(`${successResults.length} 条语句执行成功`, 'success');
          } else {
            console.error('[Sidebar] Query execution failed: no successful results');
            setMessage('操作失败，请重试或查看控制台了解详情', 'error');
          }
        } else {
          console.error('[Sidebar] Query execution error:', response.error);
          setMessage('操作失败，请重试或查看控制台了解详情', 'error');
          queryState.addToHistory(sql, false);
        }
      } catch (err) {
        console.error('Execute SQL error:', err);
        setMessage('操作失败，请重试或查看控制台了解详情', 'error');
        queryState.addToHistory(sql, false);
      } finally {
        queryState.setQueryLoading(null);
      }
    } catch (err) {
      console.error('Failed to execute SQL from history:', err);
      setMessage('操作失败，请重试或查看控制台了解详情', 'error');
    }
  };

  /**
   * 将 SQL 片段追加到当前激活查询编辑器的末尾（用换行符分隔）
   *
   * @param sql - 要追加的 SQL 片段
   */
  const handleInsertSql = (sql: string) => {
    try {
      setActiveTab('sql');
      const queryState = useQueryStore.getState();
      const activeQueryId = queryState.activeQueryId;
      if (activeQueryId) {
        const currentQuery = queryState.sqlQueries.find(q => q.id === activeQueryId);
        const currentSql = currentQuery?.sql || '';
        const newSql = currentSql ? currentSql + '\n' + sql : sql;
        queryState.updateSqlQuery(activeQueryId, { sql: newSql });
      }
    } catch (err) {
      console.error('Failed to insert SQL:', err);
      setMessage('操作失败，请重试或查看控制台了解详情', 'error');
    }
  };

  const sidebarItems = [
    { id: 'explorer' as const, icon: DatabaseIcon, label: t('sidebar.dataExplorer') },
    { id: 'history' as const, icon: ClockIcon, label: t('sidebar.queryHistory') },
    { id: 'snippets' as const, icon: FileCodeIcon, label: t('sidebar.snippets') },
    { id: 'trash' as const, icon: TrashIcon, label: t('sidebar.trash') },
  ];

  if (sidebar.collapsed) {
    return (
      <div style={styles.sidebarCollapsed}>
        <button style={styles.collapseBtn} onClick={toggleSidebar}>
          <ChevronRightIcon size={20} />
        </button>
        {sidebarItems.map(item => (
          <button
            key={item.id}
            style={{
              ...styles.iconBtn,
              background: sidebar.activeTab === item.id ? 'var(--primary-bg)' : 'transparent',
              color: sidebar.activeTab === item.id ? 'var(--primary)' : 'var(--text-secondary)',
            }}
            onClick={() => {
              setSidebarActiveTab(item.id);
              toggleSidebar();
            }}
            title={item.label}
          >
            <item.icon size={20} />
          </button>
        ))}
      </div>
    );
  }

  return (
    // 外层 wrapper: width 由 #sidebar-container 控制；height: 100% + flex: 1 确保子组件的 height: 100% 有效
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div style={styles.sidebarHeader}>
        <span style={styles.sidebarTitle}>{t('common.navigation')}</span>
        <button style={styles.collapseBtn} onClick={toggleSidebar}>
          <ChevronLeftIcon size={18} />
        </button>
      </div>

      <div style={styles.sidebarNav}>
        {sidebarItems.map(item => (
          <button
            key={item.id}
            style={{
              ...styles.navItem,
              background: sidebar.activeTab === item.id ? 'var(--primary-bg)' : 'transparent',
              color: sidebar.activeTab === item.id ? 'var(--primary)' : 'var(--text-primary)',
              borderLeft: sidebar.activeTab === item.id ? '3px solid var(--primary)' : '3px solid transparent',
            }}
            onClick={() => setSidebarActiveTab(item.id)}
          >
            <item.icon size={18} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      <div style={styles.sidebarContent}>
        {sidebar.activeTab === 'explorer' && <DatabaseExplorer />}
        {sidebar.activeTab === 'history' && <QueryHistory onExecuteSql={handleExecuteSqlFromHistory} />}
        {sidebar.activeTab === 'snippets' && <SnippetsPanel onInsertSql={handleInsertSql} />}
        {sidebar.activeTab === 'trash' && <TrashPanel />}
      </div>
    </div>
  );
};

export default Sidebar;

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    // 已废弃，外层 div 使用 inline style
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-secondary)',
  },
  sidebarCollapsed: {
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-secondary)',
    width: '48px',
    padding: '8px 0',
    height: '100%',
  },
  sidebarHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border-primary)',
  },
  sidebarTitle: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: 'var(--text-primary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  collapseBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '4px',
    color: 'var(--text-secondary)',
  },
  sidebarNav: {
    borderBottom: '1px solid var(--border-primary)',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '8px 12px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    fontSize: '12px',
    color: 'var(--text-primary)',
    transition: 'all 0.2s',
  },
  iconBtn: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    padding: '8px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
  },
  sidebarContent: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    minHeight: 0,
  },
};

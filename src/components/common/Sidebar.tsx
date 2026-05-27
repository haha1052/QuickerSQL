import React from 'react';
import { 
  DatabaseIcon, 
  ClockIcon, 
  FileCodeIcon, 
  ChevronLeftIcon, 
  ChevronRightIcon 
} from './Icons';
import { useWorkspaceStore } from '../../store';
import { DatabaseExplorer } from './DatabaseExplorer';
import { QueryHistory } from './QueryHistory';

export const Sidebar: React.FC = () => {
  const { sidebar, toggleSidebar, setSidebarActiveTab } = useWorkspaceStore();

  const sidebarItems = [
    { id: 'explorer' as const, icon: DatabaseIcon, label: '数据浏览器' },
    { id: 'history' as const, icon: ClockIcon, label: '查询历史' },
    { id: 'snippets' as const, icon: FileCodeIcon, label: '代码片段' },
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
              background: sidebar.activeTab === item.id ? '#e3f2fd' : 'transparent',
              color: sidebar.activeTab === item.id ? '#007bff' : '#666',
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
    <div style={{ ...styles.sidebar, width: sidebar.width }}>
      <div style={styles.sidebarHeader}>
        <span style={styles.sidebarTitle}>导航</span>
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
              background: sidebar.activeTab === item.id ? '#e3f2fd' : 'transparent',
              color: sidebar.activeTab === item.id ? '#007bff' : '#333',
              borderLeft: sidebar.activeTab === item.id ? '3px solid #007bff' : '3px solid transparent',
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
        {sidebar.activeTab === 'history' && <QueryHistory />}
        {sidebar.activeTab === 'snippets' && <SnippetsPlaceholder />}
      </div>
    </div>
  );
};

const SnippetsPlaceholder: React.FC = () => (
  <div style={styles.placeholder}>
    <FileCodeIcon size={32} color="#ccc" />
    <p>代码片段</p>
    <p style={{ fontSize: '12px', color: '#999' }}>即将推出...</p>
  </div>
);

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    background: '#f8f9fa',
    borderRight: '1px solid #e0e0e0',
  },
  sidebarCollapsed: {
    display: 'flex',
    flexDirection: 'column',
    background: '#f8f9fa',
    borderRight: '1px solid #e0e0e0',
    width: '48px',
    padding: '8px 0',
  },
  sidebarHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid #e0e0e0',
  },
  sidebarTitle: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#333',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  collapseBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '4px',
    color: '#666',
  },
  sidebarNav: {
    borderBottom: '1px solid #e0e0e0',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    padding: '10px 16px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    fontSize: '13px',
    color: '#333',
    transition: 'all 0.2s',
  },
  iconBtn: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    padding: '12px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: '#666',
  },
  sidebarContent: {
    flex: 1,
    overflow: 'auto',
  },
  placeholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    color: '#666',
    textAlign: 'center',
  },
};

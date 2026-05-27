import React from 'react';
import type { TabType } from '../../types';

interface HeaderProps {
  currentProject: string;
  currentDbPath: string;
  activeTab: TabType;
  onProjectClick: () => void;
  onTabChange: (tab: TabType) => void;
  onRefresh: () => void;
  isConnected: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentProject,
  currentDbPath,
  activeTab,
  onProjectClick,
  onTabChange,
  onRefresh,
  isConnected,
}) => {
  return (
    <div style={styles.header}>
      <div style={styles.projectSection}>
        <button style={styles.projectButton} onClick={onProjectClick}>
          <svg style={styles.icon} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          <span style={styles.projectLabel}>项目</span>
          <span style={styles.projectName}>
            {currentProject || '未选择'}
          </span>
        </button>
      </div>

      <button
        style={activeTab === 'csv' ? styles.activeTab : styles.tab}
        onClick={() => onTabChange('csv')}
      >
        CSV 导入
      </button>
      
      <button
        style={activeTab === 'sql' ? styles.activeTab : styles.tab}
        onClick={() => onTabChange('sql')}
      >
        SQL 查询
      </button>

      <div style={styles.rightSection}>
        {currentDbPath && (
          <div style={styles.dbPath} title={currentDbPath}>
            当前路径: {currentDbPath}
          </div>
        )}
        
        <div style={styles.status}>
          <span style={{
            ...styles.statusDot,
            background: isConnected ? '#28a745' : '#dc3545'
          }}></span>
          <span>SQLite {isConnected ? '已连接' : '未连接'}</span>
          <button style={styles.refreshButton} onClick={onRefresh}>
            刷新
          </button>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex',
    alignItems: 'center',
    borderBottom: '1px solid #ddd',
    background: '#f8f9fa',
    height: '56px',
  },
  projectSection: {
    borderRight: '1px solid #ddd',
  },
  projectButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 20px',
    border: 'none',
    background: 'transparent',
    color: '#333',
    cursor: 'pointer',
    fontSize: '14px',
  },
  icon: {
    width: '18px',
    height: '18px',
  },
  projectLabel: {
    fontWeight: 500,
  },
  projectName: {
    color: '#666',
    background: '#e9ecef',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '13px',
  },
  tab: {
    padding: '12px 24px',
    border: 'none',
    background: 'transparent',
    color: '#333',
    cursor: 'pointer',
    fontSize: '14px',
  },
  activeTab: {
    padding: '12px 24px',
    border: 'none',
    background: '#007bff',
    color: 'white',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
  },
  rightSection: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: '20px',
    gap: '12px',
  },
  dbPath: {
    fontSize: '12px',
    color: '#666',
    maxWidth: '300px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  status: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: '#666',
  },
  statusDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
  },
  refreshButton: {
    padding: '4px 10px',
    background: '#e9ecef',
    border: '1px solid #dee2e6',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
};

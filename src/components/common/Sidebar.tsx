import React from 'react';
import {
  DatabaseIcon,
  ClockIcon,
  FileCodeIcon,
  TrashIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from './Icons';
import { useWorkspaceStore } from '../../store';
import { useLocale } from '../../context/LocaleContext';
import { DatabaseExplorer } from './DatabaseExplorer';
import QueryHistory from './QueryHistory';
import TrashPanel from '../trash';

export const Sidebar: React.FC = () => {
  const { sidebar, toggleSidebar, setSidebarActiveTab } = useWorkspaceStore();
  const { t } = useLocale();

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
        {sidebar.activeTab === 'history' && <QueryHistory />}
        {sidebar.activeTab === 'snippets' && <SnippetsPlaceholder t={t} />}
        {sidebar.activeTab === 'trash' && <TrashPanel />}
      </div>
    </div>
  );
};

const SnippetsPlaceholder: React.FC<{ t: (key: string) => string }> = ({ t }) => (
  <div style={styles.placeholder}>
    <FileCodeIcon size={32} color="var(--text-tertiary)" />
    <p>{t('sidebar.snippets')}</p>
    <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{t('common.comingSoon')}</p>
  </div>
);

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
    gap: '10px',
    width: '100%',
    padding: '10px 16px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    fontSize: '13px',
    color: 'var(--text-primary)',
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
    color: 'var(--text-secondary)',
  },
  sidebarContent: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    minHeight: 0,
  },
  placeholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minHeight: 0,
    padding: '40px 20px',
    color: 'var(--text-secondary)',
    textAlign: 'center',
  },
};

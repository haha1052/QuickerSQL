import React from 'react';
import { XIcon, PlusIcon } from '../common/Icons';
import { useWorkspaceStore } from '../../store';
import { useLocale } from '../../context/LocaleContext';
export const WorkspaceTabs: React.FC = () => {
  const { t } = useLocale();
  const { tabs, activeTabId, removeTab, setActiveTab, addTab } = useWorkspaceStore();

  const handleNewTab = () => {
    addTab({
      title: `QUERY ${tabs.filter(t => t.type === 'sql').length + 1}`,
      type: 'sql',
      panels: [
        {
          id: 'editor',
          type: 'sql_editor',
          title: t('workspace.sqlEditor'),
          size: 100,
          active: true,
          content: null,
        },
        {
          id: 'results',
          type: 'results_grid',
          title: t('workspace.results'),
          size: 0,
          active: true,
          content: null,
        },
      ],
      active: true,
    });
  };

  return (
    <div className="workspace-tabs-container" style={styles.tabsContainer}>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          style={{
            ...styles.tab,
            background: tab.id === activeTabId ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
            borderBottom:
              tab.id === activeTabId ? '2px solid var(--primary)' : '2px solid transparent',
            color: tab.id === activeTabId ? 'var(--primary)' : 'var(--text-secondary)',
          }}
          onClick={() => setActiveTab(tab.id)}
        >
          <span style={styles.tabTitle}>{tab.title}</span>
          {tabs.length > 1 && (
            <button
              style={styles.tabClose}
              onClick={(e) => {
                e.stopPropagation();
                removeTab(tab.id);
              }}
            >
              <XIcon size={14} />
            </button>
          )}
        </div>
      ))}
      <button
        style={styles.addTabButton}
        onClick={handleNewTab}
        title={t('workspace.newTab')}
      >
        <PlusIcon size={14} />
      </button>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  tabsContainer: {
    background: 'var(--bg-tertiary)',
    width: '100%',
    minWidth: 0,
    overflowX: 'auto',
    overflowY: 'hidden',
    WebkitOverflowScrolling: 'touch',
    height: '100%',
    whiteSpace: 'nowrap',
    lineHeight: '40px',
  },
  tab: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    height: '28px',
    padding: '0 10px',
    cursor: 'pointer',
    fontSize: '12px',
    borderTopLeftRadius: '4px',
    borderTopRightRadius: '4px',
    marginLeft: '4px',
    whiteSpace: 'nowrap',
    verticalAlign: 'middle',
  },
  tabTitle: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '150px',
  },
  tabClose: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '2px',
    borderRadius: '2px',
    opacity: 0.6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTabButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    marginLeft: '4px',
    background: 'transparent',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    verticalAlign: 'middle',
  },
};
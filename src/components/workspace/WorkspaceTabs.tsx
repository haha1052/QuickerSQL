import React from 'react';
import { PlusIcon, XIcon } from '../common/Icons';
import { useWorkspaceStore } from '../../store';
import type { WorkspaceTabType } from '../../types';

export const WorkspaceTabs: React.FC = () => {
  const { tabs, activeTabId, addTab, removeTab, setActiveTab } = useWorkspaceStore();

  const handleAddSqlTab = () => {
    addTab({
      title: `SQL Query ${tabs.length + 1}`,
      type: 'sql' as WorkspaceTabType,
      panels: [
        {
          id: 'editor',
          type: 'sql_editor',
          title: 'SQL Editor',
          size: 50,
          active: true,
          content: null,
        },
        {
          id: 'results',
          type: 'results_grid',
          title: 'Results',
          size: 50,
          active: true,
          content: null,
        },
      ],
      active: true,
    });
  };

  return (
    <div style={styles.tabsContainer}>
      <div style={styles.tabsList}>
        {tabs.map(tab => (
          <div
            key={tab.id}
            style={{
              ...styles.tab,
              background: tab.id === activeTabId ? 'white' : '#f0f0f0',
              borderBottom: tab.id === activeTabId ? '2px solid #007bff' : '2px solid transparent',
              color: tab.id === activeTabId ? '#007bff' : '#666',
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

        <button style={styles.addTabBtn} onClick={handleAddSqlTab} title="新建标签页">
          <PlusIcon size={16} />
        </button>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  tabsContainer: {
    background: '#f0f0f0',
    borderBottom: '1px solid #e0e0e0',
  },
  tabsList: {
    display: 'flex',
    alignItems: 'flex-end',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    cursor: 'pointer',
    fontSize: '13px',
    borderTopLeftRadius: '4px',
    borderTopRightRadius: '4px',
    marginLeft: '4px',
    marginTop: '4px',
  },
  tabTitle: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '200px',
  },
  tabClose: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '2px',
    borderRadius: '2px',
    opacity: 0.6,
  },
  addTabBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px',
    marginLeft: '4px',
    marginTop: '4px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    borderRadius: '4px',
    color: '#666',
  },
};

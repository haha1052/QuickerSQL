import React, { useState } from 'react';
import { PlusIcon, XIcon } from '../common/Icons';
import { useWorkspaceStore } from '../../store';
import type { WorkspaceTabType } from '../../types';
import { useLocale } from '../../context/LocaleContext';

type PanelMode = 'default' | 'editor' | 'results' | 'only-editor' | 'only-results';

export const WorkspaceTabs: React.FC = () => {
  const { tabs, activeTabId, addTab, removeTab, setActiveTab, setPanelMode } = useWorkspaceStore();
  const { t } = useLocale();
  const [modeDropdownOpen, setModeDropdownOpen] = useState(false);

  const panelModes: { key: PanelMode; label: string }[] = [
    { key: 'default', label: '默认布局（50/50）' },
    { key: 'editor', label: '优先编辑器（80/20）' },
    { key: 'results', label: '优先结果（20/80）' },
    { key: 'only-editor', label: '仅编辑器' },
    { key: 'only-results', label: '仅结果' },
  ];

  const handleAddSqlTab = () => {
    addTab(
      {
        title: `${t('workspace.sqlQuery')} ${tabs.length + 1}`,
        type: 'sql' as WorkspaceTabType,
        panels: [
          {
            id: 'editor',
            type: 'sql_editor',
            title: t('workspace.sqlEditor'),
            size: 50,
            active: true,
            content: null,
          },
          {
            id: 'results',
            type: 'results_grid',
            title: t('workspace.results'),
            size: 50,
            active: true,
            content: null,
          },
        ],
        active: true,
      },
      { initialSql: undefined }
    );
  };

  const activeTab = tabs.find((tb) => tb.id === activeTabId);

  const handleModeClick = (mode: PanelMode) => {
    if (activeTab) {
      setPanelMode(activeTab.id, mode);
    }
    setModeDropdownOpen(false);
  };

  return (
    <div style={styles.tabsContainer}>
      <div style={styles.tabsList}>
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

        <button style={styles.addTabBtn} onClick={handleAddSqlTab} title={t('workspace.newTab')}>
          <PlusIcon size={16} />
        </button>
      </div>

      {/* 面板模式切换 */}
      <div style={styles.modeGroup}>
        <button
          style={styles.modeBtn}
          onClick={() => setModeDropdownOpen((v) => !v)}
          title="切换查询面板布局"
        >
          <span style={styles.modeIcon}>▤</span>
          <span style={styles.modeLabel}>布局</span>
        </button>
        {modeDropdownOpen && activeTab && (
          <div
            style={styles.modeDropdown}
            onMouseLeave={() => setModeDropdownOpen(false)}
          >
            {panelModes.map((m, idx) => (
              <div
                key={m.key}
                style={{
                  ...styles.modeOption,
                  ...(idx === panelModes.length - 1 ? { borderBottom: 'none' } : {}),
                }}
                onClick={() => handleModeClick(m.key)}
              >
                {m.label}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  tabsContainer: {
    background: 'var(--bg-tertiary)',
    borderBottom: '1px solid var(--border-primary)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  tabsList: {
    display: 'flex',
    alignItems: 'flex-end',
    flex: 1,
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
    color: 'var(--text-secondary)',
  },
  modeGroup: {
    position: 'relative',
    display: 'inline-block',
    paddingRight: '12px',
    paddingBottom: '4px',
  },
  modeBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: '4px',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    fontSize: '12px',
  },
  modeIcon: {
    fontSize: '12px',
    lineHeight: 1,
  },
  modeLabel: {
    fontWeight: 500,
  },
  modeDropdown: {
    position: 'absolute',
    right: '12px',
    bottom: '-100%',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: '4px',
    boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
    zIndex: 100,
    minWidth: '160px',
  },
  modeOption: {
    padding: '8px 12px',
    cursor: 'pointer',
    fontSize: '12px',
    color: 'var(--text-secondary)',
    whiteSpace: 'nowrap',
    borderBottom: '1px solid var(--border-primary)',
  },
};

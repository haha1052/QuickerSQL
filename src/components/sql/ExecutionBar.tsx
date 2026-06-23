import React from 'react';
import { useWorkspaceStore } from '../../store';
import { useLocale } from '../../context/LocaleContext';
import { PlusIcon } from '../common/Icons';
import { useQueryStore } from '../../store';

interface ExecutionBarProps {
  onExecute: () => void;
  isLoading: boolean;
}

export const ExecutionBar: React.FC<ExecutionBarProps> = ({
  onExecute,
  isLoading,
}) => {
  const { t } = useLocale();
  const { tabs, activeTabId, addTab } = useWorkspaceStore();
  const { sqlQueries, activeQueryId } = useQueryStore();
  
  const activeTabData = tabs.find(t => t.id === activeTabId);
  const activeQuery = sqlQueries.find(q => q.id === activeQueryId);
  
  const handleNewTab = () => {
    addTab({
      title: `${t('workspace.sqlQuery')} ${tabs.length + 1}`,
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
    <div style={styles.container}>
      <button
        style={styles.newTabButton}
        onClick={handleNewTab}
        title={t('workspace.newTab')}
      >
        <PlusIcon size={12} />
        <span style={styles.buttonText}>{t('workspace.newTab')}</span>
      </button>
      <div style={styles.queryName}>
        {activeQuery?.name || activeTabData?.title || 'Query'}
      </div>
      <button
        style={{
          ...styles.executeButton,
          opacity: isLoading ? 0.7 : 1,
          cursor: isLoading ? 'not-allowed' : 'pointer',
        }}
        onClick={onExecute}
        disabled={isLoading}
      >
        <span style={styles.executeIcon}>▶</span>
        {isLoading ? t('sqlEditor.executing') : t('query.execute')}
      </button>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '8px',
    padding: '4px 12px',
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border-primary)',
    height: '28px',
    flexShrink: 0,
  },
  newTabButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '3px 8px',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '11px',
  },
  buttonText: {
    fontSize: '11px',
  },
  queryName: {
    flex: 1,
    fontSize: '12px',
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  executeButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '3px 10px',
    background: 'var(--primary)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '11px',
  },
  executeIcon: {
    fontSize: '10px',
  },
};

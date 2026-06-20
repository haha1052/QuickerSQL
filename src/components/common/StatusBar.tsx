import React from 'react';
import { DatabaseIcon, ClockIcon, CheckCircleIcon, AlertCircleIcon } from './Icons';
import { useAppStore } from '../../store';
import { useLocale } from '../../context/LocaleContext';

export const StatusBar: React.FC = () => {
  const { allDatabaseStatus } = useAppStore();
  const { t } = useLocale();

  const isConnected = allDatabaseStatus.length > 0 && allDatabaseStatus[0].is_connected;
  const dbType = allDatabaseStatus[0]?.db_type || 'Unknown';
  const tableCount = allDatabaseStatus[0]?.tables?.length || 0;

  return (
    <div style={styles.statusBar}>
      <div style={styles.statusLeft}>
        <div style={styles.statusItem}>
          <DatabaseIcon size={14} color={isConnected ? 'var(--success)' : 'var(--error)'} />
          <span style={{ color: isConnected ? 'var(--success)' : 'var(--error)', marginLeft: '4px' }}>
            {dbType}
          </span>
        </div>

        <div style={styles.statusItem}>
          {isConnected ? <CheckCircleIcon size={14} color="var(--success)" /> : <AlertCircleIcon size={14} color="var(--error)" />}
          <span style={{ marginLeft: '4px' }}>
            {isConnected ? t('status.connected') : t('status.notConnected')}
          </span>
        </div>

        <div style={styles.statusItem}>
          <span>{tableCount} {t('status.tables')}</span>
        </div>
      </div>

      <div style={styles.statusRight}>
        <div style={styles.statusItem}>
          <ClockIcon size={14} />
          <span style={{ marginLeft: '4px' }}>{t('status.ready')}</span>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  statusBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 16px',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    fontSize: '12px',
    borderTop: '1px solid var(--border-primary)',
  },
  statusLeft: {
    display: 'flex',
    gap: '20px',
  },
  statusRight: {
    display: 'flex',
    gap: '20px',
  },
  statusItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
};

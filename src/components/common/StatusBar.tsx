import React from 'react';
import { DatabaseIcon, ClockIcon, CheckCircleIcon, AlertCircleIcon } from './Icons';
import { useAppStore } from '../../store';

export const StatusBar: React.FC = () => {
  const { allDatabaseStatus } = useAppStore();

  const isConnected = allDatabaseStatus.length > 0 && allDatabaseStatus[0].is_connected;
  const dbType = allDatabaseStatus[0]?.db_type || 'Unknown';
  const tableCount = allDatabaseStatus[0]?.tables?.length || 0;

  return (
    <div style={styles.statusBar}>
      <div style={styles.statusLeft}>
        <div style={styles.statusItem}>
          <DatabaseIcon size={14} color={isConnected ? '#28a745' : '#dc3545'} />
          <span style={{ color: isConnected ? '#28a745' : '#dc3545', marginLeft: '4px' }}>
            {dbType}
          </span>
        </div>

        <div style={styles.statusItem}>
          {isConnected ? <CheckCircleIcon size={14} color="#28a745" /> : <AlertCircleIcon size={14} color="#dc3545" />}
          <span style={{ marginLeft: '4px' }}>
            {isConnected ? '已连接' : '未连接'}
          </span>
        </div>

        <div style={styles.statusItem}>
          <span>{tableCount} 个表</span>
        </div>
      </div>

      <div style={styles.statusRight}>
        <div style={styles.statusItem}>
          <ClockIcon size={14} />
          <span style={{ marginLeft: '4px' }}>准备就绪</span>
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
    background: '#333',
    color: '#fff',
    fontSize: '12px',
    borderTop: '1px solid #444',
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

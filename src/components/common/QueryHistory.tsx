import React, { useState } from 'react';
import { ClockIcon, TrashIcon, PlayIcon, SearchIcon, CopyIcon } from './Icons';
import { useWorkspaceStore, useQueryStore } from '../../store';
import type { QueryHistoryItem } from '../../types';

export const QueryHistory: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const { addTab } = useWorkspaceStore();
  const { setActiveQueryId, updateSqlQuery, addSqlQuery, queryHistory, removeFromHistory, clearHistory } = useQueryStore();

  const filteredHistory = queryHistory.filter(item =>
    item.sql.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggleSelect = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const handleDoubleClick = (item: QueryHistoryItem) => {
    const { sqlQueries } = useQueryStore.getState();
    
    let targetQuery = sqlQueries.find(q => q.sql === item.sql);
    
    if (!targetQuery) {
      addSqlQuery();
      const { sqlQueries: newQueries } = useQueryStore.getState();
      targetQuery = newQueries[newQueries.length - 1];
    }
    
    updateSqlQuery(targetQuery.id, { sql: item.sql });
    setActiveQueryId(targetQuery.id);
    
    addTab({
      title: `SQL Query ${sqlQueries.length + 1}`,
      type: 'sql',
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

  const handleExecute = (item: QueryHistoryItem) => {
    handleDoubleClick(item);
  };

  const handleCopy = (sql: string) => {
    navigator.clipboard.writeText(sql);
  };

  const handleDeleteSelected = () => {
    selectedItems.forEach(id => removeFromHistory(id));
    setSelectedItems(new Set());
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - timestamp;

    if (diff < 60000) {
      return '刚刚';
    } else if (diff < 3600000) {
      return `${Math.floor(diff / 60000)}分钟前`;
    } else if (diff < 86400000) {
      return `${Math.floor(diff / 3600000)}小时前`;
    } else if (date.toDateString() === now.toDateString()) {
      return `今天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    } else {
      return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
  };

  const truncateSql = (sql: string, maxLength: number = 80) => {
    if (sql.length <= maxLength) return sql;
    return sql.substring(0, maxLength - 3) + '...';
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.searchBox}>
          <SearchIcon size={14} color="#999" />
          <input
            type="text"
            placeholder="搜索历史..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
        </div>
        {selectedItems.size > 0 && (
          <button
            style={{ ...styles.actionBtn, color: '#dc3545' }}
            onClick={handleDeleteSelected}
          >
            <TrashIcon size={14} />
            <span>删除 ({selectedItems.size})</span>
          </button>
        )}
        {queryHistory.length > 0 && selectedItems.size === 0 && (
          <button
            style={{ ...styles.actionBtn, color: '#dc3545' }}
            onClick={clearHistory}
          >
            <TrashIcon size={14} />
            <span>清空</span>
          </button>
        )}
      </div>

      <div style={styles.historyList}>
        {queryHistory.length === 0 ? (
          <div style={styles.empty}>
            <ClockIcon size={32} color="#ccc" />
            <p>暂无查询历史</p>
            <p style={{ fontSize: '12px', color: '#999' }}>执行 SQL 查询后会自动保存到这里</p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div style={styles.empty}>
            未找到匹配的历史记录
          </div>
        ) : (
          filteredHistory.map((item) => (
            <div
              key={item.id}
              style={{
                ...styles.historyItem,
                background: selectedItems.has(item.id) ? '#e3f2fd' : 'transparent',
              }}
              onClick={() => handleToggleSelect(item.id)}
              onDoubleClick={() => handleDoubleClick(item)}
            >
              <input
                type="checkbox"
                checked={selectedItems.has(item.id)}
                onChange={(e) => {
                  e.stopPropagation();
                  handleToggleSelect(item.id);
                }}
                style={styles.checkbox}
              />

              <div style={styles.historyContent}>
                <div style={styles.sqlLine}>
                  <span style={styles.sqlText} title={item.sql}>
                    {truncateSql(item.sql)}
                  </span>
                </div>
                <div style={styles.metaLine}>
                  <span style={styles.time}>{formatTime(item.timestamp)}</span>
                  {item.success !== undefined && (
                    <span style={item.success ? styles.successBadge : styles.errorBadge}>
                      {item.success ? '成功' : '失败'}
                    </span>
                  )}
                  {item.rowCount !== undefined && item.rowCount !== null && (
                    <span style={styles.rowCount}>{item.rowCount} 行</span>
                  )}
                </div>
              </div>

              <div style={styles.actions}>
                <button
                  style={styles.actionIcon}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopy(item.sql);
                  }}
                  title="复制"
                >
                  <CopyIcon size={14} />
                </button>
                <button
                  style={styles.actionIcon}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExecute(item);
                  }}
                  title="执行"
                >
                  <PlayIcon size={14} />
                </button>
                <button
                  style={styles.actionIcon}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFromHistory(item.id);
                  }}
                  title="删除"
                >
                  <TrashIcon size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px',
    borderBottom: '1px solid #e0e0e0',
    background: '#fff',
  },
  searchBox: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 8px',
    background: '#f5f5f5',
    borderRadius: '4px',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    background: 'transparent',
    fontSize: '13px',
    outline: 'none',
    padding: '4px 0',
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    transition: 'background 0.2s',
  },
  historyList: {
    flex: 1,
    overflow: 'auto',
    padding: '8px',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    color: '#666',
    textAlign: 'center',
  },
  historyItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px',
    marginBottom: '4px',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background 0.2s',
    border: '1px solid transparent',
  },
  checkbox: {
    cursor: 'pointer',
  },
  historyContent: {
    flex: 1,
    minWidth: 0,
  },
  sqlLine: {
    marginBottom: '4px',
  },
  sqlText: {
    fontSize: '13px',
    color: '#333',
    wordBreak: 'break-all',
  },
  metaLine: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  time: {
    fontSize: '12px',
    color: '#999',
  },
  successBadge: {
    fontSize: '11px',
    color: '#28a745',
    background: '#d4edda',
    padding: '2px 6px',
    borderRadius: '3px',
  },
  errorBadge: {
    fontSize: '11px',
    color: '#dc3545',
    background: '#f8d7da',
    padding: '2px 6px',
    borderRadius: '3px',
  },
  rowCount: {
    fontSize: '12px',
    color: '#666',
  },
  actions: {
    display: 'flex',
    gap: '4px',
    opacity: 0,
    transition: 'opacity 0.2s',
  },
  actionIcon: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '4px',
    color: '#666',
    transition: 'all 0.2s',
  },
};
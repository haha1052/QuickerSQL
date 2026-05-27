import React, { useState, useEffect } from 'react';
import { TableIcon, ChevronRightIcon, RefreshCwIcon, SearchIcon } from './Icons';
import { useWorkspaceStore, useQueryStore } from '../../store';
import type { TableInfo } from '../../types';

export const DatabaseExplorer: React.FC = () => {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const { addTab } = useWorkspaceStore();
  const { setActiveQueryId, updateSqlQuery, addSqlQuery } = useQueryStore();

  const loadTables = async () => {
    setLoading(true);
    try {
      const { tauriService } = await import('../../services');
      const response = await tauriService.listTables();
      if (response.success && response.data) {
        // 转换格式为 TableInfo[]
        const tableInfos: TableInfo[] = response.data.map((name: string) => ({
          name,
          rowCount: 0,
        }));
        setTables(tableInfos);
      }
    } catch (e) {
      console.error('Failed to load tables:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTables();
  }, []);

  const toggleTableExpand = (tableName: string) => {
    const newExpanded = new Set(expandedTables);
    if (newExpanded.has(tableName)) {
      newExpanded.delete(tableName);
    } else {
      newExpanded.add(tableName);
    }
    setExpandedTables(newExpanded);
  };

  const handleDoubleClickTable = async (tableName: string) => {
    const { sqlQueries } = useQueryStore.getState();
    
    let targetQuery = sqlQueries.find(q => q.sql === `SELECT * FROM ${tableName}`);
    
    if (!targetQuery) {
      addSqlQuery();
      const { sqlQueries: newQueries } = useQueryStore.getState();
      targetQuery = newQueries[newQueries.length - 1];
    }
    
    updateSqlQuery(targetQuery.id, { sql: `SELECT * FROM ${tableName}` });
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

  const filteredTables = tables.filter(table =>
    table.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.searchBox}>
          <SearchIcon size={14} color="#999" />
          <input
            type="text"
            placeholder="搜索表..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
        </div>
        <button
          style={styles.refreshBtn}
          onClick={loadTables}
          title="刷新"
        >
          <RefreshCwIcon size={16} />
        </button>
      </div>

      <div style={styles.tablesList}>
        {loading ? (
          <div style={styles.loading}>
            <RefreshCwIcon size={16} />
            <span>加载中...</span>
          </div>
        ) : filteredTables.length === 0 ? (
          <div style={styles.empty}>
            {searchTerm ? '未找到匹配的表' : '暂无数据表'}
          </div>
        ) : (
          filteredTables.map((table) => (
            <div key={table.name} style={styles.tableItem}>
              <div
                style={styles.tableHeader}
                onClick={() => toggleTableExpand(table.name)}
                onDoubleClick={() => handleDoubleClickTable(table.name)}
              >
                <ChevronRightIcon size={14} className={expandedTables.has(table.name) ? 'rotated-icon' : ''} />
                <TableIcon size={14} color="#007bff" />
                <span style={styles.tableName}>{table.name}</span>
                <span style={styles.tableRowCount}>({table.rowCount})</span>
              </div>

              {expandedTables.has(table.name) && table.columns && (
                <div style={styles.columnsList}>
                  {table.columns.map((col: { name: string; type: string }, index: number) => (
                    <div key={index} style={styles.columnItem}>
                      <span style={styles.columnName}>{col.name}</span>
                      <span style={styles.columnType}>{col.type}</span>
                    </div>
                  ))}
                </div>
              )}
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
  rotated: {
    transform: 'rotate(90deg)',
    transition: 'transform 0.2s',
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
  refreshBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '6px',
    borderRadius: '4px',
    color: '#666',
    transition: 'background 0.2s',
  },
  tablesList: {
    flex: 1,
    overflow: 'auto',
    padding: '8px',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '20px',
    color: '#666',
    fontSize: '13px',
  },
  empty: {
    padding: '20px',
    color: '#999',
    fontSize: '13px',
    textAlign: 'center',
  },
  tableItem: {
    marginBottom: '2px',
  },
  tableHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 8px',
    cursor: 'pointer',
    borderRadius: '4px',
    transition: 'background 0.2s',
  },
  tableName: {
    flex: 1,
    fontSize: '13px',
    color: '#333',
  },
  tableRowCount: {
    fontSize: '12px',
    color: '#999',
  },
  columnsList: {
    paddingLeft: '24px',
    borderLeft: '2px solid #e0e0e0',
    marginLeft: '8px',
  },
  columnItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '4px 8px',
    fontSize: '12px',
  },
  columnName: {
    color: '#666',
  },
  columnType: {
    color: '#999',
    fontStyle: 'italic',
  },
};
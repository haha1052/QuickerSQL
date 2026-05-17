import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { useState } from 'react';
import './App.css';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ModuleRegistry } from 'ag-grid-community';
import { AllCommunityModule } from 'ag-grid-community';
import { useEffect } from 'react';

ModuleRegistry.registerModules([AllCommunityModule]);

const zhCNLocaleText = {
  equals: '等于',
  notEqual: '不等于',
  lessThan: '小于',
  greaterThan: '大于',
  lessThanOrEqual: '小于等于',
  greaterThanOrEqual: '大于等于',
  inRange: '在范围内',
  contains: '包含',
  notContains: '不包含',
  startsWith: '开头为',
  endsWith: '结尾为',
  filterOoo: '筛选...',
  andCondition: '且',
  orCondition: '或',
  applyFilter: '应用筛选',
  resetFilter: '重置筛选',
  blank: '空白',
  notBlank: '非空白',
  selectAll: '全选',
  searchOoo: '搜索...',
  noMatches: '无匹配项',
  page: '页',
  more: '更多',
  to: '至',
  of: '共',
  next: '下一页',
  last: '最后一页',
  first: '第一页',
  previous: '上一页',
  loadingOoo: '加载中...',
  noRowsToShow: '暂无数据',
};

interface FieldMeta {
  name: string;
  dataType: string;
}

interface CsvPreview {
  headers: string[];
  rows: string[][];
}

interface QueryResult {
  columns: string[];
  rows: string[][];
}

interface SqlQuery {
  id: string;
  name: string;
  sql: string;
  result: QueryResult | null;
}

interface DuckDbStatus {
  tables: string[];
  row_count: [string, number][];
  is_connected: boolean;
}

const DATA_TYPES = ['VARCHAR', 'INTEGER', 'DOUBLE', 'DATE', 'BOOLEAN'];

function App() {
  const [csvData, setCsvData] = useState<CsvPreview | null>(null);
  const [rawCsvData, setRawCsvData] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [tableName, setTableName] = useState('my_table');
  const [fields, setFields] = useState<FieldMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [tables, setTables] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'csv' | 'sql'>('csv');
  const [hasHeader, setHasHeader] = useState(true);
  const [duckdbStatus, setDuckdbStatus] = useState<DuckDbStatus | null>(null);
  const [sqlQueries, setSqlQueries] = useState<SqlQuery[]>([
    { id: '1', name: '查询 1', sql: 'SELECT * FROM my_table', result: null }
  ]);
  const [activeQueryId, setActiveQueryId] = useState('1');
  const [queryLoading, setQueryLoading] = useState<string | null>(null);

  const refreshDuckdbStatus = async () => {
    try {
      const status = await invoke<DuckDbStatus>('get_duckdb_status');
      setDuckdbStatus(status);
    } catch (e) {
      console.error('获取状态失败:', e);
    }
  };

  useEffect(() => {
    refreshDuckdbStatus();
  }, []);

  const handleLoadCsv = async () => {
    setLoading(true);
    setMessage('');
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      });

      if (!selected) {
        alert('未选择文件');
        return;
      }

      const filePath = Array.isArray(selected) ? selected[0] : selected;

      if (typeof filePath === 'string') {
        const result = await invoke<CsvPreview>('load_csv', { filePath });

        setRawCsvData({ headers: result.headers, rows: result.rows });
        updateCsvData(result.headers, result.rows, hasHeader);

        const fileName = filePath.split(/[\\/]/).pop() || 'my_table';
        const suggestedName = fileName.replace('.csv', '').replace(/[^a-zA-Z0-9_]/g, '_');
        setTableName(suggestedName || 'my_table');

        setMessage(`成功读取 ${result.rows.length} 行数据`);
      }
    } catch (e) {
      console.error('错误:', e);
      setMessage('读取失败: ' + e);
    } finally {
      setLoading(false);
    }
  };

  const updateCsvData = (headers: string[], rows: string[][], useHeader: boolean) => {
    if (useHeader) {
      setCsvData({ headers, rows });
      const initialFields = headers.map((header, index) => ({
        name: header || `column${index + 1}`,
        dataType: 'VARCHAR'
      }));
      setFields(initialFields);
    } else {
      const newHeaders = headers.map((_, index) => `column${index + 1}`);
      const allRows = [headers, ...rows];
      setCsvData({ headers: newHeaders, rows: allRows });
      const initialFields = newHeaders.map((header) => ({
        name: header,
        dataType: 'VARCHAR'
      }));
      setFields(initialFields);
    }
  };

  const handleHasHeaderChange = (checked: boolean) => {
    setHasHeader(checked);
    if (rawCsvData) {
      updateCsvData(rawCsvData.headers, rawCsvData.rows, checked);
    }
  };

  const handleImport = async () => {
    if (!csvData) return;

    setLoading(true);
    setMessage('');
    try {
      const result = await invoke<string>('import_to_duckdb', {
        request: {
          rows: csvData.rows,
          table_name: tableName,
          fields: fields.map(f => ({
            name: f.name,
            data_type: f.dataType
          })),
        }
      });

      setMessage(result);
      await refreshTables();
      await refreshDuckdbStatus();
      
      const newSql = `SELECT * FROM ${tableName.replace(/[^a-zA-Z0-9_]/g, '_')}`;
      setSqlQueries(prev => prev.map(q => ({
        ...q,
        sql: q.sql === 'SELECT * FROM my_table' ? newSql : q.sql
      })));
    } catch (e) {
      console.error('错误:', e);
      setMessage('导入失败: ' + e);
    } finally {
      setLoading(false);
    }
  };

  const refreshTables = async () => {
    try {
      const result = await invoke<string[]>('list_tables');
      setTables(result);
    } catch (e) {
      console.error('获取表列表失败:', e);
    }
  };

  const addNewQuery = () => {
    const newId = Date.now().toString();
    const queryNumber = sqlQueries.length + 1;
    setSqlQueries(prev => [
      ...prev,
      { id: newId, name: `查询 ${queryNumber}`, sql: '', result: null }
    ]);
    setActiveQueryId(newId);
  };

  const deleteQuery = (id: string) => {
    if (sqlQueries.length <= 1) return;
    setSqlQueries(prev => prev.filter(q => q.id !== id));
    if (activeQueryId === id) {
      setActiveQueryId(sqlQueries[0].id);
    }
  };

  const updateQuerySql = (id: string, newSql: string) => {
    setSqlQueries(prev => prev.map(q => q.id === id ? { ...q, sql: newSql } : q));
  };

  const handleExecuteQuery = async (id: string) => {
    const query = sqlQueries.find(q => q.id === id);
    if (!query || !query.sql.trim()) return;

    setQueryLoading(id);
    try {
      const result = await invoke<QueryResult>('execute_sql', { sql: query.sql });
      setSqlQueries(prev => prev.map(q => q.id === id ? { ...q, result } : q));
      setMessage(`查询成功，返回 ${result.rows.length} 行`);
      await refreshDuckdbStatus();
    } catch (e) {
      console.error('错误:', e);
      setMessage('执行失败: ' + e);
    } finally {
      setQueryLoading(null);
    }
  };

  const activeQuery = sqlQueries.find(q => q.id === activeQueryId);

  const previewGridOptions = {
    localeText: zhCNLocaleText,
    defaultColDef: {
      filter: true,
      sortable: true,
      resizable: true,
      minWidth: 120,
    },
  };

  const queryGridOptions = {
    localeText: zhCNLocaleText,
    defaultColDef: {
      filter: true,
      sortable: true,
      resizable: true,
      minWidth: 120,
    },
  };

  const previewColDefs: ColDef[] = csvData
    ? csvData.headers.map((header, index) => ({
        field: `col${index}`,
        headerName: header || `Column ${index + 1}`,
        valueGetter: (params: any) => params.data[index],
      }))
    : [];

  const previewRowData = csvData
    ? csvData.rows.map((row, index) => ({ rowIndex: index, ...row }))
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'system-ui' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid #ddd', background: '#f8f9fa' }}>
        <button
          onClick={() => setActiveTab('csv')}
          style={{
            padding: '12px 24px',
            border: 'none',
            background: activeTab === 'csv' ? '#007bff' : 'transparent',
            color: activeTab === 'csv' ? 'white' : '#333',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: activeTab === 'csv' ? 'bold' : 'normal',
          }}
        >
          CSV 导入
        </button>
        <button
          onClick={() => { setActiveTab('sql'); refreshTables(); refreshDuckdbStatus(); }}
          style={{
            padding: '12px 24px',
            border: 'none',
            background: activeTab === 'sql' ? '#007bff' : 'transparent',
            color: activeTab === 'sql' ? 'white' : '#333',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: activeTab === 'sql' ? 'bold' : 'normal',
          }}
        >
          SQL 查询
        </button>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '20px', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#666' }}>
            <span style={{ 
              width: '10px', 
              height: '10px', 
              borderRadius: '50%', 
              background: duckdbStatus?.is_connected ? '#28a745' : '#dc3545',
              display: 'inline-block'
            }}></span>
            <span>{duckdbStatus?.is_connected ? 'SQLite 已连接' : '未连接'}</span>
            <button
              onClick={refreshDuckdbStatus}
              style={{
                padding: '4px 10px',
                background: '#e9ecef',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              刷新
            </button>
          </div>
          {duckdbStatus && (
            <div style={{ fontSize: '12px', color: '#666' }}>
              {duckdbStatus.tables.length} 个表
            </div>
          )}
        </div>
      </div>

      {message && (
        <div style={{
          padding: '12px 20px',
          background: message.includes('失败') ? '#f8d7da' : '#d4edda',
          color: message.includes('失败') ? '#721c24' : '#155724',
          borderBottom: '1px solid #c3e6cb',
        }}>
          {message}
        </div>
      )}

      {activeTab === 'csv' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #ddd', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={handleLoadCsv}
              disabled={loading}
              style={{
                padding: '10px 20px',
                background: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                opacity: loading ? 0.7 : 1,
              }}
            >
              选择 CSV 文件
            </button>

            {csvData && (
              <>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={hasHeader}
                      onChange={(e) => handleHasHeaderChange(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    CSV 包含表头
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <label style={{ fontSize: '14px', color: '#666' }}>表名:</label>
                  <input
                    type="text"
                    value={tableName}
                    onChange={(e) => setTableName(e.target.value)}
                    style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', minWidth: '180px' }}
                  />
                </div>

                <button
                  onClick={handleImport}
                  disabled={loading}
                  style={{
                    padding: '10px 20px',
                    background: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    opacity: loading ? 0.7 : 1,
                  }}
                >
                  导入到 DuckDB
                </button>

                {loading && <span style={{ color: '#666', fontSize: '14px' }}>处理中...</span>}
              </>
            )}
          </div>

          {csvData && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '12px 20px', borderBottom: '1px solid #eee', background: '#fafafa' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#333' }}>字段信息</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                  {fields.map((field, index) => (
                    <div key={index} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={field.name}
                        onChange={(e) => {
                          const newFields = [...fields];
                          newFields[index].name = e.target.value;
                          setFields(newFields);
                        }}
                        style={{ flex: 1, padding: '6px 10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }}
                        placeholder="字段名"
                      />
                      <select
                        value={field.dataType}
                        onChange={(e) => {
                          const newFields = [...fields];
                          newFields[index].dataType = e.target.value;
                          setFields(newFields);
                        }}
                        style={{ padding: '6px 10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', minWidth: '100px' }}
                      >
                        {DATA_TYPES.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ flex: 1, overflow: 'hidden' }}>
                <AgGridReact
                  rowData={previewRowData}
                  columnDefs={previewColDefs}
                  domLayout="normal"
                  pagination={true}
                  paginationPageSize={50}
                  enableCellTextSelection={true}
                  gridOptions={previewGridOptions}
                />
              </div>
            </div>
          )}

          {!csvData && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '16px' }}>
              请选择一个 CSV 文件开始
            </div>
          )}
        </div>
      )}

      {activeTab === 'sql' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #ddd' }}>
            {duckdbStatus && duckdbStatus.tables.length > 0 && (
              <div style={{ 
                padding: '12px',
                background: '#f8f9fa',
                borderRadius: '6px',
                marginBottom: '12px',
                border: '1px solid #dee2e6'
              }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#333' }}>
                  📊 SQLite 状态
                </h4>
                <div style={{ 
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                  gap: '8px',
                  fontSize: '12px'
                }}>
                  {duckdbStatus.row_count.map(([table, count]) => (
                    <div key={table} style={{
                      padding: '6px 10px',
                      background: '#e9ecef',
                      borderRadius: '4px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer'
                    }} onClick={() => updateQuerySql(activeQueryId, `SELECT * FROM "${table}"`)}>
                      <span style={{ fontWeight: 500 }}>{table}</span>
                      <span style={{ color: '#007bff' }}>{count} 行</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tables.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <span style={{ fontSize: '14px', color: '#666', marginRight: '8px' }}>已导入的表:</span>
                {tables.map((table, index) => (
                  <button
                    key={index}
                    onClick={() => updateQuerySql(activeQueryId, `SELECT * FROM ${table}`)}
                    style={{
                      padding: '4px 10px',
                      margin: '0 4px',
                      background: '#e9ecef',
                      border: '1px solid #dee2e6',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '13px',
                    }}
                  >
                    {table}
                  </button>
                ))}
              </div>
            )}

            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              marginBottom: '12px',
              gap: '8px',
              overflowX: 'auto',
              paddingBottom: '4px'
            }}>
              <span style={{ fontSize: '14px', color: '#666', whiteSpace: 'nowrap' }}>查询标签:</span>
              {sqlQueries.map((query) => (
                <div
                  key={query.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 8px',
                    background: activeQueryId === query.id ? '#e3f2fd' : '#f5f5f5',
                    border: activeQueryId === query.id ? '2px solid #2196f3' : '1px solid #ddd',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    whiteSpace: 'nowrap'
                  }}
                  onClick={() => setActiveQueryId(query.id)}
                >
                  <span style={{ fontWeight: activeQueryId === query.id ? 'bold' : 'normal' }}>
                    {query.name}
                  </span>
                  {query.result && (
                    <span style={{ 
                      fontSize: '11px', 
                      color: '#4caf50',
                      background: '#e8f5e9',
                      padding: '2px 6px',
                      borderRadius: '10px'
                    }}>
                      {query.result.rows.length}行
                    </span>
                  )}
                  {sqlQueries.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteQuery(query.id); }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#999',
                        cursor: 'pointer',
                        padding: '0 2px',
                        fontSize: '14px',
                        lineHeight: 1
                      }}
                      title="删除查询"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={addNewQuery}
                style={{
                  padding: '6px 12px',
                  background: '#4caf50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  whiteSpace: 'nowrap'
                }}
                title="新增查询"
              >
                + 新建查询
              </button>
            </div>

            {activeQuery && (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <textarea
                  value={activeQuery.sql}
                  onChange={(e) => updateQuerySql(activeQueryId, e.target.value)}
                  onKeyDown={(e) => e.ctrlKey && e.key === 'Enter' && handleExecuteQuery(activeQueryId)}
                  placeholder="输入 SQL 查询..."
                  style={{
                    flex: 1,
                    minHeight: '100px',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontFamily: 'monospace',
                    resize: 'vertical',
                  }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    onClick={() => handleExecuteQuery(activeQueryId)}
                    disabled={queryLoading === activeQueryId || !activeQuery.sql.trim()}
                    style={{
                      padding: '12px 24px',
                      background: '#007bff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: (queryLoading === activeQueryId || !activeQuery.sql.trim()) ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      opacity: (queryLoading === activeQueryId || !activeQuery.sql.trim()) ? 0.7 : 1,
                    }}
                  >
                    {queryLoading === activeQueryId ? '执行中...' : '执行查询'}
                  </button>
                  <button
                    onClick={() => {
                      updateQuerySql(activeQueryId, '');
                      setSqlQueries(prev => prev.map(q => q.id === activeQueryId ? { ...q, result: null } : q));
                    }}
                    style={{
                      padding: '8px 16px',
                      background: '#f5f5f5',
                      color: '#666',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '13px',
                    }}
                  >
                    清空结果
                  </button>
                </div>
              </div>
            )}
          </div>

          {activeQuery?.result && (
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '8px 20px', background: '#e8f5e9', fontSize: '12px', color: '#2e7d32' }}>
                ✓ 查询返回 {activeQuery.result.rows.length} 行，{activeQuery.result.columns.length} 列
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <AgGridReact
                  rowData={activeQuery.result.rows.map((row, index) => ({ rowIndex: index, ...row })) as any}
                  columnDefs={activeQuery.result.columns.map((header, index) => ({
                    field: `col${index}` as any,
                    headerName: header,
                    valueGetter: (params: any) => params.data[index],
                  })) as ColDef[]}
                  domLayout="normal"
                  pagination={true}
                  paginationPageSize={50}
                  enableCellTextSelection={true}
                  gridOptions={queryGridOptions}
                />
              </div>
            </div>
          )}

          {!activeQuery?.result && !queryLoading && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '16px' }}>
              输入 SQL 并点击"执行查询"
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;

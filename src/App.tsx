import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { useState, useEffect, useRef } from 'react';
import './App.css';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ModuleRegistry } from 'ag-grid-community';
import { AllCommunityModule } from 'ag-grid-community';
import * as duckdb from '@duckdb/duckdb-wasm';

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

// 数据库状态
interface DatabaseStatus {
  db_type: string;
  tables: string[];
  row_count: [string, number][];
  is_connected: boolean;
}

// 数据库信息
interface DatabaseInfo {
  db_type: string;
  name: string;
  is_available: boolean;
  description?: string;
}

// DuckDB 连接管理器
class DuckDBManager {
  private db: duckdb.AsyncDuckDB | null = null;
  private conn: duckdb.AsyncDuckDBConnection | null = null;
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;

    console.log('[DuckDB WASM] 初始化中...');

    try {
      // 使用本地文件
      console.log('[DuckDB WASM] 使用本地文件...');
      const workerUrl = '/duckdb-wasm/duckdb-browser-eh.worker.js';
      const wasmUrl = '/duckdb-wasm/duckdb-eh.wasm';

      console.log('[DuckDB WASM] 创建 Worker:', workerUrl);
      const worker = new Worker(workerUrl);
      const logger = new duckdb.ConsoleLogger();
      this.db = new duckdb.AsyncDuckDB(logger, worker);

      console.log('[DuckDB WASM] 实例化中...');
      await this.db.instantiate(wasmUrl, undefined);

      console.log('[DuckDB WASM] 建立连接...');
      this.conn = await this.db.connect();
      this.initialized = true;
      console.log('[DuckDB WASM] 初始化完成!');
    } catch (e) {
      console.error('[DuckDB WASM] 初始化失败:', e);
      throw e;
    }
  }

  async query(sql: string): Promise<{ columns: string[]; rows: string[][] }> {
    if (!this.conn) throw new Error('DuckDB 未连接');

    const result = await this.conn.query(sql);
    const columns = result.schema.fields.map(f => f.name);
    const rows: string[][] = [];

    // 获取所有行数据
    for (let i = 0; i < result.numRows; i++) {
      const row: string[] = [];
      for (let j = 0; j < columns.length; j++) {
        const val = result.getChildAt(j)?.get(i);
        row.push(val !== null && val !== undefined ? String(val) : 'NULL');
      }
      rows.push(row);
    }

    return { columns, rows };
  }

  async getTables(): Promise<string[]> {
    if (!this.conn) {
      console.log('[DuckDB] getTables: conn 为空');
      return [];
    }
    try {
      console.log('[DuckDB] 执行 getTables 查询...');
      const result = await this.conn.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'main' ORDER BY table_name");
      console.log('[DuckDB] getTables 查询结果行数:', result.numRows);

      const tables: string[] = [];
      for (let i = 0; i < result.numRows; i++) {
        const val = result.getChildAt(0)?.get(i);
        console.log('[DuckDB] 表名', i, ':', val);
        if (val !== null && val !== undefined) {
          tables.push(String(val));
        }
      }
      console.log('[DuckDB] getTables 返回:', tables);
      return tables;
    } catch (e) {
      console.error('[DuckDB] getTables 失败:', e);
      return [];
    }
  }

  async createTable(tableName: string, columns: string[], rows: string[][]): Promise<void> {
    if (!this.conn) throw new Error('DuckDB 未连接');

    console.log('[DuckDB] 开始创建表:', tableName);
    console.log('[DuckDB] 列:', columns);
    console.log('[DuckDB] 行数:', rows.length);

    // 创建表
    const colDefs = columns.map(col => `"${col}" VARCHAR`).join(', ');
    console.log('[DuckDB] 执行: DROP TABLE IF EXISTS "', tableName, '"');
    await this.conn.query(`DROP TABLE IF EXISTS "${tableName}"`);

    console.log('[DuckDB] 执行: CREATE TABLE "', tableName, '" (', colDefs, ')');
    await this.conn.query(`CREATE TABLE "${tableName}" (${colDefs})`);

    // 插入数据
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const values = row.map(v => {
        const escaped = v.replace(/'/g, "''");
        return `'${escaped}'`;
      }).join(', ');
      await this.conn.query(`INSERT INTO "${tableName}" VALUES (${values})`);
      if (i === 0 || i === rows.length - 1 || i % 100 === 0) {
        console.log('[DuckDB] 已插入', i + 1, '/', rows.length, '行');
      }
    }

    console.log('[DuckDB] 表创建完成');

    // 验证表是否存在
    const verifyResult = await this.conn.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'main'");
    console.log('[DuckDB] 验证 - 当前所有表:', verifyResult.numRows, '个');
  }

  async deleteTable(tableName: string): Promise<void> {
    if (!this.conn) throw new Error('DuckDB 未连接');
    await this.conn.query(`DROP TABLE IF EXISTS "${tableName}"`);
  }

  isReady(): boolean {
    return this.initialized && this.conn !== null;
  }
}

const DATA_TYPES = ['VARCHAR', 'INTEGER', 'DOUBLE', 'DATE', 'BOOLEAN'];

function App() {
  const [csvData, setCsvData] = useState<CsvPreview | null>(null);
  const [rawCsvData, setRawCsvData] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [tableName, setTableName] = useState('my_table');
  const [fields, setFields] = useState<FieldMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [, setTables] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'csv' | 'sql'>('csv');
  const [hasHeader, setHasHeader] = useState(true);
  const [allDatabaseStatus, setAllDatabaseStatus] = useState<DatabaseStatus[]>([]);
  const [sqlQueries, setSqlQueries] = useState<SqlQuery[]>([
    { id: '1', name: '查询 1', sql: 'SELECT * FROM my_table', result: null }
  ]);
  const [activeQueryId, setActiveQueryId] = useState('1');
  const [queryLoading, setQueryLoading] = useState<string | null>(null);

  // 当前选中的数据库类型
  const [currentDbType, setCurrentDbType] = useState('sqlite');
  const [availableDatabases, setAvailableDatabases] = useState<DatabaseInfo[]>([]);
  const [duckDbReady, setDuckDbReady] = useState(false);
  const [duckDbInitError, setDuckDbInitError] = useState<string | null>(null);

  // DuckDB 管理器
  const duckDbRef = useRef<DuckDBManager>(new DuckDBManager());

  // 初始化 DuckDB WASM
  useEffect(() => {
    const initDuckDB = async () => {
      console.log('[DuckDB WASM] 开始初始化...');
      try {
        await duckDbRef.current.init();
        setDuckDbReady(true);
        setDuckDbInitError(null);
        console.log('[DuckDB WASM] 准备就绪');
      } catch (e: any) {
        console.error('[DuckDB WASM] 初始化失败:', e);
        setDuckDbInitError(e?.message || String(e));
        setDuckDbReady(false);
      }
    };
    initDuckDB();
  }, []);

  // 当 DuckDB 初始化完成或切换标签时刷新数据库列表
  useEffect(() => {
    fetchAvailableDatabases();
  }, [duckDbReady, duckDbInitError]);

  // 获取可用数据库列表
  const fetchAvailableDatabases = async () => {
    try {
      const dbs = await invoke<DatabaseInfo[]>('list_databases');
      // 过滤掉可能重复的 duckdb，只保留来自后端的数据库
      const filteredDbs = dbs.filter(db => db.db_type !== 'duckdb');

      // 手动添加 DuckDB WASM
      const availableDbs: DatabaseInfo[] = [
        ...filteredDbs,
        {
          db_type: 'duckdb',
          name: 'DuckDB WASM',
          is_available: duckDbReady && !duckDbInitError,
          description: duckDbInitError ? '初始化失败' : 'WebAssembly版本'
        }
      ];
      setAvailableDatabases(availableDbs);
    } catch (e) {
      // 即使后端调用失败，也显示默认数据库列表
      setAvailableDatabases([
        {
          db_type: 'sqlite',
          name: 'SQLite',
          is_available: true,
          description: '本地数据库'
        },
        {
          db_type: 'duckdb',
          name: 'DuckDB WASM',
          is_available: duckDbReady,
          description: 'WebAssembly版本'
        }
      ]);
      console.error('获取数据库列表失败:', e);
    }
  };

  // 强制刷新计数器
  const [forceRefresh, setForceRefresh] = useState(0);

  // 刷新所有数据库状态
  const refreshAllDatabaseStatus = async () => {
    const newStatuses: DatabaseStatus[] = [];

    // 获取 SQLite 状态
    try {
      const sqliteStatus = await invoke<DatabaseStatus>('get_database_status');
      newStatuses.push(sqliteStatus);
    } catch (e) {
      console.error('获取 SQLite 状态失败:', e);
    }

    // 获取 DuckDB 状态（无论是否当前选中）
    if (duckDbReady) {
      try {
        console.log('[DuckDB WASM] 刷新状态，获取表列表...');
        const tables = await duckDbRef.current.getTables();
        console.log('[DuckDB WASM] 获取到的表:', tables);

        // 获取每个表的行数
        const rowCountPromises = tables.map(async (table) => {
          try {
            const result = await duckDbRef.current.query(`SELECT COUNT(*) as cnt FROM "${table}"`);
            // 修复：COUNT(*) 返回的是单行单列，直接取 rows[0][0]
            const count = result.rows.length > 0 && result.rows[0].length > 0
              ? parseInt(result.rows[0][0], 10) || 0
              : 0;
            return [table, count] as [string, number];
          } catch {
            return [table, 0] as [string, number];
          }
        });

        const row_counts = await Promise.all(rowCountPromises);
        console.log('[DuckDB WASM] 行数统计:', row_counts);

        const duckDbStatus: DatabaseStatus = {
          db_type: 'DuckDB',
          tables,
          row_count: row_counts,
          is_connected: true
        };
        newStatuses.push(duckDbStatus);
      } catch (e) {
        console.error('获取 DuckDB 表失败:', e);
      }
    } else {
      console.log('[DuckDB WASM] duckDbReady 为 false，跳过刷新');
    }

    console.log('[状态] 更新数据库状态:', newStatuses.map(s => `${s.db_type}: ${s.tables.length} 个表`));
    setAllDatabaseStatus(newStatuses);
  };

  // 切换数据库
  const handleSwitchDatabase = async (dbType: string) => {
    setCurrentDbType(dbType);
    setMessage(`已切换到 ${dbType === 'sqlite' ? 'SQLite' : 'DuckDB'}`);

    // 刷新表列表
    if (dbType === 'sqlite') {
      try {
        const result = await invoke<string[]>('list_tables');
        setTables(result);
      } catch (e) {
        console.error('获取表列表失败:', e);
      }
    } else {
      // DuckDB WASM
      if (!duckDbReady) {
        setMessage('DuckDB WASM 正在初始化中，请稍候...');
        return;
      }
      try {
        const result = await duckDbRef.current.getTables();
        setTables(result);
      } catch (e) {
        console.error('获取 DuckDB 表列表失败:', e);
      }
    }

    // 强制刷新所有状态
    await refreshAllDatabaseStatus();
    // 强制刷新查询结果
    setForceRefresh(Date.now());
  };

  useEffect(() => {
    fetchAvailableDatabases();
    refreshAllDatabaseStatus();
  }, [duckDbReady, forceRefresh]);

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
      if (currentDbType === 'sqlite') {
        const result = await invoke<string>('import_data', {
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
      } else {
        // 导入到 DuckDB
        const safeTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '_');
        await duckDbRef.current.createTable(
          safeTableName,
          fields.map(f => f.name),
          csvData.rows
        );
        setMessage(`成功导入 ${csvData.rows.length} 行到 DuckDB 表 '${safeTableName}'`);

        // 强制刷新 DuckDB 表列表
        const newTables = await duckDbRef.current.getTables();
        setTables(newTables);
      }

      // 刷新所有数据库状态
      await refreshAllDatabaseStatus();

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
      if (currentDbType === 'sqlite') {
        const result = await invoke<string[]>('list_tables');
        setTables(result);
      } else {
        const result = await duckDbRef.current.getTables();
        setTables(result);
      }
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
      let result: QueryResult;

      if (currentDbType === 'sqlite') {
        result = await invoke<QueryResult>('execute_sql', { sql: query.sql });
      } else {
        result = await duckDbRef.current.query(query.sql);
      }

      setSqlQueries(prev => prev.map(q => q.id === id ? { ...q, result } : q));
      setMessage(`查询成功，返回 ${result.rows.length} 行`);
      await refreshAllDatabaseStatus();
    } catch (e) {
      console.error('错误:', e);
      setMessage('执行失败: ' + e);
    } finally {
      setQueryLoading(null);
    }
  };

  // 删除表
  const handleDeleteTable = async (tableName: string) => {
    if (!confirm(`确定要删除表 "${tableName}" 吗？此操作不可恢复。`)) {
      return;
    }

    try {
      if (currentDbType === 'sqlite') {
        await invoke<string>('delete_table', { tableName });
      } else {
        await duckDbRef.current.deleteTable(tableName);
      }
      setMessage(`表 "${tableName}" 已删除`);
      // 刷新表列表
      await refreshAllDatabaseStatus();
      if (currentDbType === 'sqlite') {
        const tables = await invoke<string[]>('list_tables');
        setTables(tables);
      } else {
        const tables = await duckDbRef.current.getTables();
        setTables(tables);
      }
    } catch (e) {
      console.error('删除表失败:', e);
      setMessage('删除表失败: ' + e);
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

  // 获取当前数据库的显示名称
  const getCurrentDbDisplayName = () => {
    const db = availableDatabases.find(d => d.db_type === currentDbType);
    return db ? db.name : currentDbType.toUpperCase();
  };

  // 获取当前数据库的表
  const getCurrentDbTables = () => {
    const status = allDatabaseStatus.find(s =>
      s.db_type.toLowerCase() === (currentDbType === 'duckdb' ? 'duckdb' : 'sqlite')
    );
    return status?.tables || [];
  };

  

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'system-ui' }}>
      {/* 顶部导航栏 */}
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
          onClick={() => { setActiveTab('sql'); refreshTables(); refreshAllDatabaseStatus(); }}
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
          {/* 数据库选择器 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: '#666' }}>数据库:</span>
            <select
              value={currentDbType}
              onChange={(e) => handleSwitchDatabase(e.target.value)}
              style={{
                padding: '4px 10px',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                fontSize: '13px',
                cursor: 'pointer',
                background: 'white'
              }}
            >
              {availableDatabases.map((db) => (
                <option key={db.db_type} value={db.db_type}>
                  {db.name} {db.description ? `(${db.description})` : ''}
                  {!db.is_available && db.db_type === 'duckdb' ? ' - 初始化中...' : ''}
                </option>
              ))}
            </select>
          </div>
          {/* 状态指示 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#666' }}>
            <span style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: duckDbInitError ? '#dc3545' : (duckDbReady || currentDbType === 'sqlite') ? '#28a745' : '#ffc107',
              display: 'inline-block'
            }}></span>
            <span>
              {getCurrentDbDisplayName()}
              {currentDbType === 'duckdb' && duckDbInitError && ` - 初始化失败: ${duckDbInitError}`}
              {currentDbType === 'duckdb' && !duckDbReady && !duckDbInitError && '(初始化中...)'}
              {currentDbType === 'duckdb' && duckDbReady && ' 已就绪'}
              {currentDbType === 'sqlite' && ' 已连接'}
            </span>
            <button
              onClick={refreshAllDatabaseStatus}
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
        </div>
      </div>

      {/* 消息提示 */}
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

      {/* CSV 导入页面 */}
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
                  导入到 {getCurrentDbDisplayName()}
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

      {/* SQL 查询页面 */}
      {activeTab === 'sql' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #ddd' }}>
            {/* 所有数据库状态显示 */}
            {allDatabaseStatus.length > 0 && (
              <div style={{
                display: 'flex',
                gap: '12px',
                marginBottom: '12px',
                flexWrap: 'wrap'
              }}>
                {allDatabaseStatus.map((dbStatus) => {
                  const isCurrent = dbStatus.db_type.toLowerCase() === (currentDbType === 'duckdb' ? 'duckdb' : 'sqlite');
                  return (
                    <div key={dbStatus.db_type} style={{
                      flex: '1 1 300px',
                      padding: '12px',
                      background: isCurrent ? '#e3f2fd' : '#f8f9fa',
                      borderRadius: '6px',
                      border: isCurrent ? '2px solid #2196f3' : '1px solid #dee2e6',
                      opacity: isCurrent ? 1 : 0.7,
                    }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#333', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: dbStatus.is_connected ? '#28a745' : '#dc3545'
                        }}></span>
                        {dbStatus.db_type}
                        {isCurrent && (
                          <span style={{ fontSize: '11px', background: '#2196f3', color: 'white', padding: '2px 6px', borderRadius: '3px' }}>当前数据库</span>
                        )}
                        <span style={{ fontSize: '12px', color: '#666', marginLeft: 'auto' }}>{dbStatus.tables.length} 个表</span>
                      </h4>
                      {dbStatus.tables.length > 0 && (
                        <div style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '6px',
                          fontSize: '12px'
                        }}>
                          {dbStatus.tables.map((table) => (
                            <div key={table} style={{
                              padding: '4px 10px',
                              background: isCurrent ? '#fff' : '#e9ecef',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              border: '1px solid #dee2e6',
                            }}>
                              <span
                                style={{ fontWeight: 500, fontSize: '11px', cursor: 'pointer' }}
                                onClick={() => updateQuerySql(activeQueryId, `SELECT * FROM "${table}"`)}
                              >
                                {table}
                              </span>
                              {dbStatus.row_count.find(([t]) => t === table) && (
                                <span style={{ color: '#007bff', fontSize: '10px' }}>
                                  ({dbStatus.row_count.find(([t]) => t === table)?.[1]})
                                </span>
                              )}
                              {isCurrent && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteTable(table);
                                  }}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#dc3545',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    padding: '0 2px',
                                  }}
                                  title="删除表"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {dbStatus.tables.length === 0 && (
                        <div style={{ fontSize: '12px', color: '#999', fontStyle: 'italic' }}>暂无表</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* 当前数据库的表快捷选择 */}
            {getCurrentDbTables().length > 0 && (
              <div style={{ marginBottom: '12px', padding: '10px', background: '#fff3cd', borderRadius: '6px', border: '1px solid #ffc107' }}>
                <span style={{ fontSize: '14px', color: '#856404', fontWeight: 'bold' }}>
                  当前数据库: {getCurrentDbDisplayName()}
                </span>
                <span style={{ fontSize: '13px', color: '#856404', marginLeft: '12px' }}>
                  表: {getCurrentDbTables().join(', ')}
                </span>
              </div>
            )}

            {/* 查询标签 */}
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

            {/* SQL 输入区域 */}
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
                    disabled={queryLoading === activeQueryId || !activeQuery.sql.trim() || (currentDbType === 'duckdb' && !duckDbReady)}
                    style={{
                      padding: '12px 24px',
                      background: '#007bff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: (queryLoading === activeQueryId || !activeQuery.sql.trim() || (currentDbType === 'duckdb' && !duckDbReady)) ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      opacity: (queryLoading === activeQueryId || !activeQuery.sql.trim() || (currentDbType === 'duckdb' && !duckDbReady)) ? 0.7 : 1,
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

          {/* 查询结果 */}
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
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { useState, useEffect } from 'react';
import './App.css';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ModuleRegistry } from 'ag-grid-community';
import { AllCommunityModule } from 'ag-grid-community';

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

interface SqlStatementResult {
  statement: string;
  success: boolean;
  error: string | null;
  columns: string[] | null;
  rows: string[][] | null;
  affected_rows: number | null;
}

interface BatchExecuteResult {
  results: SqlStatementResult[];
  success_count: number;
  fail_count: number;
}

interface SqlQuery {
  id: string;
  name: string;
  sql: string;
  result: QueryResult | null;
  batchResults: SqlStatementResult[] | null;
}

interface DatabaseStatus {
  db_type: string;
  tables: string[];
  row_count: [string, number][];
  is_connected: boolean;
}

// Excel Sheet信息
interface SheetInfo {
  name: string;
  rowCount: number;
  columnCount: number;
}

// Excel预览
interface ExcelPreview {
  sheets: SheetInfo[];
  activeSheetPreview?: CsvPreview;
}

// 导入项状态类型
type ImportStatus = 'idle' | 'loading' | 'previewing' | 'importing' | 'success' | 'error';

// 单个导入项接口
interface ImportItem {
  id: string;
  fileType: 'csv' | 'excel';
  filePath: string;
  fileName: string;
  sheets?: SheetInfo[];
  sheetName?: string;
  activeSheetIndex?: number;
  preview: CsvPreview;
  hasHeader: boolean;
  tableName: string;
  fields: FieldMeta[];
  selected: boolean;
  status: ImportStatus;
  error?: string;
  // 新增字段：支持分组
  parentId?: string; // 如果是子项（Sheet），指向父文件ID
  isParent?: boolean; // 是否是父文件（Excel）
  isExpanded?: boolean; // 父文件是否展开
}

const DATA_TYPES = ['VARCHAR', 'INTEGER', 'DOUBLE', 'DATE', 'BOOLEAN'];

function App() {
  // 多文件导入队列状态
  const [importItems, setImportItems] = useState<ImportItem[]>([]);
  const [activeImportItemId, setActiveImportItemId] = useState<string | null>(null);
  
  // 保留原有状态以兼容（向后兼容）
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [, setTables] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'csv' | 'sql'>('csv');
  const [allDatabaseStatus, setAllDatabaseStatus] = useState<DatabaseStatus[]>([]);
  const [sqlQueries, setSqlQueries] = useState<SqlQuery[]>([
    { id: '1', name: '查询 1', sql: 'SELECT * FROM my_table', result: null, batchResults: null }
  ]);
  const [activeQueryId, setActiveQueryId] = useState('1');
  const [queryLoading, setQueryLoading] = useState<string | null>(null);

  // 项目管理状态
  const [projects, setProjects] = useState<string[]>([]);
  const [currentProject, setCurrentProject] = useState<string>('');
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [currentDbPath, setCurrentDbPath] = useState('');
  const [useCustomPath, setUseCustomPath] = useState(false);
  const [customDbPath, setCustomDbPath] = useState('');
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());

  // 初始化项目信息
  useEffect(() => {
    loadProjects();
    loadCurrentDbPath();
  }, []);

  // 加载项目列表
  const loadProjects = async () => {
    try {
      const projectList = await invoke<string[]>('list_projects');
      setProjects(projectList);
    } catch (e) {
      console.error('加载项目列表失败:', e);
    }
  };

  // 加载当前数据库路径
  const loadCurrentDbPath = async () => {
    try {
      const path = await invoke<string>('get_current_db_path');
      setCurrentDbPath(path);
      // 从路径中提取项目名
      const parts = path.split(/[\\/]/);
      const projectName = parts[parts.length - 2];
      if (projectName && projectName !== 'la-duck') {
        setCurrentProject(projectName);
      }
    } catch (e) {
      console.error('获取当前数据库路径失败:', e);
    }
  };

  // 创建项目
  const createProject = async () => {
    if (!newProjectName.trim()) {
      setMessage('请输入项目名称');
      return;
    }

    try {
      await invoke('create_project', { projectName: newProjectName.trim() });
      setMessage(`项目 "${newProjectName}" 创建成功`);
      setNewProjectName('');
      setShowProjectModal(false);
      await loadProjects();
      await loadCurrentDbPath();
      await refreshAllDatabaseStatus();
    } catch (e) {
      console.error('创建项目失败:', e);
      setMessage('创建项目失败: ' + e);
    }
  };

  // 切换项目
  const switchProject = async (projectName: string) => {
    try {
      await invoke('switch_project', { projectName });
      setCurrentProject(projectName);
      setMessage(`已切换到项目 "${projectName}"`);
      await loadCurrentDbPath();
      await refreshAllDatabaseStatus();
    } catch (e) {
      console.error('切换项目失败:', e);
      setMessage('切换项目失败: ' + e);
    }
  };

  // 删除项目
  const handleDeleteProject = async (projectName: string) => {
    try {
      await invoke('delete_project', { projectName });
      setMessage(`项目 "${projectName}" 已删除`);
      await loadProjects();
      if (currentProject === projectName) {
        setCurrentProject('default');
        await loadCurrentDbPath();
      }
    } catch (e) {
      console.error('删除项目失败:', e);
      setMessage('删除项目失败: ' + e);
    }
  };

  // 重命名项目
  const handleRenameProject = async (oldName: string, newName: string) => {
    try {
      await invoke('rename_project', { oldName, newName });
      setMessage(`项目已从 "${oldName}" 重命名为 "${newName}"`);
      await loadProjects();
      if (currentProject === oldName) {
        setCurrentProject(newName);
        await loadCurrentDbPath();
      }
    } catch (e) {
      console.error('重命名项目失败:', e);
      setMessage('重命名项目失败: ' + e);
    }
  };

  // 选择自定义数据库路径
  const selectCustomDbPath = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'SQLite Database', extensions: ['db'] }],
      });

      if (selected) {
        const filePath = Array.isArray(selected) ? selected[0] : selected;
        setCustomDbPath(filePath);
      }
    } catch (e) {
      console.error('选择文件失败:', e);
    }
  };

  // 使用自定义路径打开数据库
  const openCustomDatabase = async () => {
    if (!customDbPath.trim()) {
      setMessage('请先选择数据库文件');
      return;
    }

    try {
      await invoke('open_database_from_path', { dbPath: customDbPath });
      setCurrentProject('自定义数据库');
      setUseCustomPath(true);
      setShowProjectModal(false);
      await loadCurrentDbPath();
      await refreshAllDatabaseStatus();
      setMessage('已切换到自定义数据库');
    } catch (e) {
      console.error('打开自定义数据库失败:', e);
      setMessage('打开自定义数据库失败: ' + e);
    }
  };

  const handleBatchExport = async () => {
    if (selectedProjects.size === 0) {
      setMessage('请先选择要导出的项目');
      return;
    }

    try {
      const destDir = await open({
        directory: true,
        multiple: false,
        title: '选择导出目录',
      });

      if (!destDir) return;

      const dirPath = Array.isArray(destDir) ? destDir[0] : destDir;
      const selectedList = Array.from(selectedProjects);

      const exportedPaths = await invoke<string[]>('export_selected_projects', {
        selectedProjects: selectedList,
        destDir: dirPath,
      });
      setMessage(`成功导出 ${exportedPaths.length} 个项目到: ${dirPath}`);
      setSelectedProjects(new Set());
    } catch (e) {
      console.error('批量导出失败:', e);
      setMessage('导出失败: ' + e);
    }
  };

  const refreshAllDatabaseStatus = async () => {
    const newStatuses: DatabaseStatus[] = [];

    try {
      const sqliteStatus = await invoke<DatabaseStatus>('get_database_status');
      newStatuses.push(sqliteStatus);
    } catch (e) {
      console.error('获取 SQLite 状态失败:', e);
    }

    console.log('[状态] 更新数据库状态:', newStatuses.map(s => `${s.db_type}: ${s.tables.length} 个表`));
    setAllDatabaseStatus(newStatuses);
  };

  const handleLoadFiles = async () => {
    setLoading(true);
    setMessage('');
    try {
      const selected = await open({
        multiple: true,
        directory: false,
        filters: [
          { name: 'CSV/Excel Files', extensions: ['csv', 'xlsx', 'xls'] },
          { name: 'All Files', extensions: ['*'] }
        ],
      });

      if (!selected) {
        return;
      }

      const filePaths = Array.isArray(selected) ? selected : [selected];
      const newItems: ImportItem[] = [];

      for (const filePath of filePaths) {
        const lowerPath = filePath.toLowerCase();
        const isExcel = lowerPath.endsWith('.xlsx') || lowerPath.endsWith('.xls');
        
        try {
          if (isExcel) {
            // Excel文件处理：创建父项 + 多个Sheet子项
            const excelPreview = await invoke<ExcelPreview>('get_excel_sheets', { filePath });
            const fileName = filePath.split(/[\\/]/).pop() || 'excel_file';
            const parentId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
            
            // 创建父项（Excel分组容器）
            const parentItem: ImportItem = {
              id: parentId,
              fileType: 'excel',
              filePath,
              fileName,
              sheets: excelPreview.sheets,
              isParent: true,
              isExpanded: true,
              // 父项不需要预览和其他字段，仅用于分组显示
              preview: { headers: [], rows: [] },
              hasHeader: true,
              tableName: '',
              fields: [],
              selected: false,
              status: 'idle',
            };
            newItems.push(parentItem);
            
            // 为每个Sheet创建子项
            for (let i = 0; i < excelPreview.sheets.length; i++) {
              const sheet = excelPreview.sheets[i];
              try {
                const sheetData = await invoke<CsvPreview>('load_excel_sheet', { filePath, sheetName: sheet.name });
                const suggestedName = `${fileName.replace(/\.(xlsx|xls)$/i, '')}_${sheet.name}`.replace(/[^a-zA-Z0-9_]/g, '_');
                const initialFields = sheetData.headers.map((header, idx) => {
                  // 清理字段名，防止特殊字符导致SQL错误
                  let cleanName: string = (header || `column${idx + 1}`).toString();
                  cleanName = cleanName.split('').map(c => {
                    if (/[a-zA-Z0-9_]/.test(c) || (c >= '\u{4e00}' && c <= '\u{9fff}')) {
                      return c;
                    }
                    return '_';
                  }).join('');
                  // 处理空或全下划线的情况
                  if (!cleanName.trim() || /^_+$/.test(cleanName)) {
                    cleanName = `column_${idx + 1}`;
                  }
                  // 确保不以数字开头
                  if (/^\d/.test(cleanName)) {
                    cleanName = `col_${cleanName}`;
                  }
                  return {
                    name: cleanName,
                    dataType: 'VARCHAR' as const,
                  };
                });
                
                newItems.push({
                  id: `${parentId}_sheet_${i}`,
                  fileType: 'excel',
                  filePath,
                  fileName,
                  sheetName: sheet.name,
                  preview: sheetData,
                  hasHeader: true,
                  tableName: suggestedName,
                  fields: initialFields,
                  selected: true,
                  status: 'previewing',
                  parentId,
                  isParent: false,
                });
              } catch (e) {
                console.warn(`加载Sheet '${sheet.name}' 失败:`, e);
              }
            }
          } else {
            // CSV文件处理：单个项
            const result = await invoke<CsvPreview>('load_csv', { filePath });
            const fileName = filePath.split(/[\\/]/).pop() || 'my_table';
            const suggestedName = fileName.replace('.csv', '').replace(/[^a-zA-Z0-9_]/g, '_');
            
            const initialFields = result.headers.map((header, idx) => {
              // 清理字段名，防止特殊字符导致SQL错误
              let cleanName: string = (header || `column${idx + 1}`).toString();
              cleanName = cleanName.split('').map(c => {
                if (/[a-zA-Z0-9_]/.test(c) || (c >= '\u{4e00}' && c <= '\u{9fff}')) {
                  return c;
                }
                return '_';
              }).join('');
              // 处理空或全下划线的情况
              if (!cleanName.trim() || /^_+$/.test(cleanName)) {
                cleanName = `column_${idx + 1}`;
              }
              // 确保不以数字开头
              if (/^\d/.test(cleanName)) {
                cleanName = `col_${cleanName}`;
              }
              return {
                name: cleanName,
                dataType: 'VARCHAR' as const,
              };
            });

            newItems.push({
              id: Date.now() + Math.random().toString(36).substr(2, 9),
              fileType: 'csv',
              filePath,
              fileName,
              preview: result,
              hasHeader: true,
              tableName: suggestedName,
              fields: initialFields,
              selected: true,
              status: 'previewing',
            });
          }
        } catch (e) {
          console.error(`加载文件失败: ${filePath}`, e);
          const fileName = filePath.split(/[\\/]/).pop() || 'unknown';
          const lowerPath = filePath.toLowerCase();
          const isExcel = lowerPath.endsWith('.xlsx') || lowerPath.endsWith('.xls');
          
          newItems.push({
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            fileType: isExcel ? 'excel' : 'csv',
            filePath,
            fileName,
            preview: { headers: [], rows: [] },
            hasHeader: true,
            tableName: fileName.replace(/\.(csv|xlsx|xls)$/i, '').replace(/[^a-zA-Z0-9_]/g, '_'),
            fields: [],
            selected: true,
            status: 'error',
            error: `加载失败: ${e}`,
          });
        }
      }

      setImportItems(prev => [...prev, ...newItems]);
      
      // 自动选中第一个可预览的项
      const firstSelectable = newItems.find(item => !item.isParent && item.status !== 'error');
      if (firstSelectable) {
        setActiveImportItemId(firstSelectable.id);
      }

      const successCount = newItems.filter(i => i.status !== 'error').length;
      setMessage(`成功加载 ${successCount} 个文件/工作表`);
    } catch (e) {
      console.error('错误:', e);
      setMessage('加载失败: ' + e);
    } finally {
      setLoading(false);
    }
  };

  // 单独导入单个文件
  const handleSingleImport = async (itemId: string) => {
    const item = importItems.find(i => i.id === itemId);
    if (!item) return;

    setLoading(true);
    setMessage('');
    try {
      setImportItems(prev => prev.map(i => 
        i.id === itemId ? { ...i, status: 'importing' as ImportStatus } : i
      ));

      const result = await invoke<string>('import_data', {
        request: {
          rows: item.hasHeader ? item.preview.rows : [item.preview.headers, ...item.preview.rows],
          table_name: item.tableName,
          fields: item.fields,
        },
      });

      setImportItems(prev => prev.map(i => 
        i.id === itemId ? { ...i, status: 'success' as ImportStatus } : i
      ));

      setMessage(result);
      await refreshAllDatabaseStatus();
    } catch (e) {
      console.error('错误:', e);
      setImportItems(prev => prev.map(i => 
        i.id === itemId ? { ...i, status: 'error' as ImportStatus, error: String(e) } : i
      ));
      setMessage('导入失败: ' + e);
    } finally {
      setLoading(false);
    }
  };

  // 批量导入选中的文件
  const handleBatchImport = async () => {
    const selectedItems = importItems.filter(i => i.selected && i.status !== 'success');
    if (selectedItems.length === 0) {
      setMessage('请先选择要导入的文件');
      return;
    }

    setLoading(true);
    setMessage('');
    let successCount = 0;
    let failCount = 0;

    try {
      for (const item of selectedItems) {
        try {
          setImportItems(prev => prev.map(i => 
            i.id === item.id ? { ...i, status: 'importing' as ImportStatus } : i
          ));

          await invoke<string>('import_data', {
            request: {
              rows: item.hasHeader ? item.preview.rows : [item.preview.headers, ...item.preview.rows],
              table_name: item.tableName,
              fields: item.fields,
            },
          });

          setImportItems(prev => prev.map(i => 
            i.id === item.id ? { ...i, status: 'success' as ImportStatus } : i
          ));
          successCount++;
        } catch (e) {
          console.error(`导入 ${item.fileName} 失败:`, e);
          setImportItems(prev => prev.map(i => 
            i.id === item.id ? { ...i, status: 'error' as ImportStatus, error: String(e) } : i
          ));
          failCount++;
        }
      }

      setMessage(`导入完成: ${successCount} 成功, ${failCount} 失败`);
      await refreshAllDatabaseStatus();
    } catch (e) {
      console.error('错误:', e);
      setMessage('批量导入失败: ' + e);
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
      { id: newId, name: `查询 ${queryNumber}`, sql: '', result: null, batchResults: null }
    ]);
    setActiveQueryId(newId);
  };

  const deleteQuery = (id: string) => {
    if (sqlQueries.length <= 1) return;
    setSqlQueries(prev => {
      const filtered = prev.filter(q => q.id !== id);
      if (activeQueryId === id && filtered.length > 0) {
        setActiveQueryId(filtered[0].id);
      }
      return filtered;
    });
  };

  const updateQuerySql = (id: string, newSql: string) => {
    setSqlQueries(prev => prev.map(q => q.id === id ? { ...q, sql: newSql } : q));
  };

  const handleExecuteQuery = async (id: string) => {
    const query = sqlQueries.find(q => q.id === id);
    if (!query || !query.sql.trim()) return;

    setQueryLoading(id);
    try {
      let result: QueryResult = { columns: [], rows: [] };
      let batchResults: SqlStatementResult[] | null = null;

      const batchResult = await invoke<BatchExecuteResult>('execute_sql', { sql: query.sql });
      batchResults = batchResult.results;

      const successResults = batchResults.filter(r => r.success);
      const lastQueryResult = successResults.find(r => r.columns && r.rows);
      
      if (lastQueryResult && lastQueryResult.columns && lastQueryResult.rows) {
        result = { columns: lastQueryResult.columns, rows: lastQueryResult.rows };
      }

      const failedCount = batchResult.fail_count;
      const successCount = batchResult.success_count;
      
      if (failedCount > 0) {
        const failedMessages = batchResults
          .filter(r => !r.success && r.error)
          .map(r => `${r.statement}: ${r.error}`)
          .join('\n');
        setMessage(`执行完成: ${successCount} 成功, ${failedCount} 失败\n${failedMessages}`);
      } else {
        setMessage(`执行成功: ${successCount} 条语句`);
      }

      setSqlQueries(prev => prev.map(q => q.id === id ? { ...q, result, batchResults } : q));
      await refreshAllDatabaseStatus();
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'system-ui' }}>
      {/* 顶部导航栏 */}
      <div style={{ display: 'flex', borderBottom: '1px solid #ddd', background: '#f8f9fa' }}>
        {/* 项目管理按钮 */}
        <div style={{ display: 'flex', borderRight: '1px solid #ddd' }}>
          <button
            onClick={() => setShowProjectModal(true)}
            style={{
              padding: '12px 20px',
              border: 'none',
              background: 'transparent',
              color: '#333',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <span style={{ fontWeight: 500 }}>项目</span>
            <span style={{ 
              color: '#666', 
              background: '#e9ecef', 
              padding: '2px 8px', 
              borderRadius: '4px',
              fontSize: '13px'
            }}>
              {currentProject || '未选择'}
            </span>
          </button>
        </div>

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
          {/* 当前路径显示 */}
          {currentDbPath && (
            <div style={{ fontSize: '12px', color: '#666', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={currentDbPath}>
              当前路径: {currentDbPath}
            </div>
          )}
          {/* 状态指示 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#666' }}>
            <span style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: '#28a745',
              display: 'inline-block'
            }}></span>
            <span>SQLite 已连接</span>
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

      {/* CSV 导入页面 - 多文件队列 */}
      {activeTab === 'csv' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* 顶部操作栏 */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #ddd', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={handleLoadFiles}
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
              + 添加文件 (CSV/Excel)
            </button>

            {importItems.length > 0 && (
              <>
                <div style={{ width: '1px', height: '24px', background: '#ddd' }} />
                <button
                  onClick={() => setImportItems(prev => prev.map(i => ({ ...i, selected: true })))}
                  style={{
                    padding: '8px 16px',
                    background: '#f8f9fa',
                    color: '#333',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  全选
                </button>
                <button
                  onClick={() => setImportItems(prev => prev.map(i => ({ ...i, selected: !i.selected })))}
                  style={{
                    padding: '8px 16px',
                    background: '#f8f9fa',
                    color: '#333',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  反选
                </button>
                <button
                  onClick={handleBatchImport}
                  disabled={loading || importItems.filter(i => i.selected).length === 0}
                  style={{
                    padding: '10px 20px',
                    background: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: (loading || importItems.filter(i => i.selected).length === 0) ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    opacity: (loading || importItems.filter(i => i.selected).length === 0) ? 0.7 : 1,
                  }}
                >
                  全部导入 ({importItems.filter(i => i.selected).length})
                </button>
                <button
                  onClick={() => {
                    if (window.confirm('确定要清空队列吗？')) {
                      setImportItems([]);
                      setActiveImportItemId(null);
                    }
                  }}
                  style={{
                    padding: '8px 16px',
                    background: '#f8f9fa',
                    color: '#dc3545',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  清空队列
                </button>
              </>
            )}
          </div>

          {/* 主体：左右分栏 */}
          {importItems.length > 0 ? (
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              {/* 左侧：队列列表 */}
              <div style={{ width: '380px', borderRight: '1px solid #ddd', overflowY: 'auto', background: '#f8f9fa' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #eee', fontSize: '14px', fontWeight: 'bold', color: '#333', position: 'sticky', top: 0, background: '#f8f9fa' }}>
                  文件队列 ({importItems.length})
                </div>
                
                {(() => {
                  // 构建父子关系
                  const parents = importItems.filter(i => i.isParent);
                  const orphans = importItems.filter(i => !i.isParent && !i.parentId);
                  
                  // 渲染函数
                  const renderItem = (item: ImportItem, indent: number = 0) => {
                    const isActive = activeImportItemId === item.id;
                    
                    // 父项渲染（Excel文件）
                    if (item.isParent && item.sheets) {
                      const childItems = importItems.filter(i => i.parentId === item.id);
                      const allChildrenSelected = childItems.every(i => i.selected);
                      const someChildrenSelected = childItems.some(i => i.selected);
                      
                      return (
                        <div key={item.id}>
                          {/* 父项（Excel文件标题） */}
                          <div
                            style={{
                              padding: '10px 16px',
                              borderBottom: '1px solid #eee',
                              background: '#e9ecef',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                            }}
                            onClick={() => {
                              setImportItems(prev => prev.map(i => 
                                i.id === item.id ? { ...i, isExpanded: !i.isExpanded } : i
                              ));
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={allChildrenSelected}
                              ref={(input) => {
                                if (input) {
                                  input.indeterminate = someChildrenSelected && !allChildrenSelected;
                                }
                              }}
                              onChange={(e) => {
                                e.stopPropagation();
                                // 全选/取消全选子项
                                setImportItems(prev => prev.map(i => 
                                  i.parentId === item.id ? { ...i, selected: !allChildrenSelected } : i
                                ));
                              }}
                              style={{ cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: '12px', fontWeight: 'bold' }}>
                              {item.isExpanded ? '▼' : '▶'}
                            </span>
                            <span style={{ fontSize: '14px', fontWeight: '500', color: '#333', flex: 1 }}>
                              📁 {item.fileName}
                              <span style={{ fontSize: '12px', color: '#666', marginLeft: '8px' }}>
                                ({item.sheets.length} 个工作表)
                              </span>
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`确定要删除 ${item.fileName} 及其所有工作表吗？`)) {
                                  setImportItems(prev => {
                                    const filtered = prev.filter(i => i.id !== item.id && i.parentId !== item.id);
                                    if (activeImportItemId === item.id || filtered.findIndex(i => i.id === activeImportItemId) === -1) {
                                      setActiveImportItemId(filtered[0]?.id || null);
                                    }
                                    return filtered;
                                  });
                                }
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#999',
                                cursor: 'pointer',
                                padding: '0 4px',
                                fontSize: '16px',
                              }}
                              title="删除整个文件"
                            >
                              ×
                            </button>
                          </div>
                          
                          {/* 子项（Sheet） */}
                          {item.isExpanded && childItems.map(child => renderItem(child, 1))}
                        </div>
                      );
                    }
                    
                    // 子项或普通项（Sheet或CSV）
                    return (
                      <div
                        key={item.id}
                        onClick={() => !item.isParent && setActiveImportItemId(item.id)}
                        style={{
                          padding: '10px 16px',
                          paddingLeft: `${16 + indent * 24}px`,
                          borderBottom: '1px solid #eee',
                          background: isActive ? '#e3f2fd' : 'transparent',
                          cursor: item.isParent ? 'default' : 'pointer',
                          borderLeft: isActive ? '3px solid #2196f3' : '3px solid transparent',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onClick={(e) => {
                              e.stopPropagation();
                              setImportItems(prev => prev.map(i => i.id === item.id ? { ...i, selected: !i.selected } : i));
                            }}
                            style={{ cursor: 'pointer' }}
                          />
                          {item.parentId && <span style={{ fontSize: '12px', color: '#666' }}>📄</span>}
                          <span style={{ fontSize: '14px', fontWeight: '500', color: '#333', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.sheetName || item.fileName}>
                            {item.sheetName || item.fileName}
                          </span>
                          {!item.isParent && (
                            <span style={{ fontSize: '12px', color: '#666' }}>
                              {item.preview.rows.length} 行
                            </span>
                          )}
                          {!item.isParent && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`确定要删除 ${item.sheetName || item.fileName} 吗？`)) {
                                  setImportItems(prev => {
                                    const filtered = prev.filter(i => i.id !== item.id);
                                    if (activeImportItemId === item.id) {
                                      setActiveImportItemId(filtered[0]?.id || null);
                                    }
                                    return filtered;
                                  });
                                }
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#999',
                                cursor: 'pointer',
                                padding: '0 2px',
                                fontSize: '16px',
                                lineHeight: 1,
                              }}
                              title="删除"
                            >
                              ×
                            </button>
                          )}
                        </div>
                        {!item.isParent && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '24px' }}>
                            <span style={{ fontSize: '12px', color: '#666' }}>表名:</span>
                            <input
                              type="text"
                              value={item.tableName}
                              onKeyDown={(e) => {
                                if (e.key === '.') {
                                  e.preventDefault();
                                }
                              }}
                              onChange={(e) => {
                                const newName = e.target.value.replace(/\./g, '');
                                setImportItems(prev => prev.map(i => i.id === item.id ? { ...i, tableName: newName } : i));
                              }}
                              style={{
                                padding: '4px 8px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '12px',
                                minWidth: '100px',
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                            {item.status === 'error' && (
                              <span style={{ fontSize: '11px', color: '#dc3545' }}>错误</span>
                            )}
                            {item.status === 'success' && (
                              <span style={{ fontSize: '11px', color: '#28a745' }}>✓ 已导入</span>
                            )}
                            {item.status === 'importing' && (
                              <span style={{ fontSize: '11px', color: '#007bff' }}>导入中...</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  };
                  
                  // 渲染所有内容
                  return (
                    <>
                      {parents.map(p => renderItem(p))}
                      {orphans.map(o => renderItem(o))}
                    </>
                  );
                })()}
              </div>

              {/* 右侧：选中项的预览和配置 */}
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {activeImportItemId ? (() => {
                  const activeItem = importItems.find(i => i.id === activeImportItemId);
                  if (!activeItem) return null;
                  
                  const displayHeaders = activeItem.hasHeader 
                    ? activeItem.preview.headers 
                    : activeItem.preview.headers.map((_, idx) => `column${idx + 1}`);
                  const displayRows = activeItem.hasHeader 
                    ? activeItem.preview.rows 
                    : [activeItem.preview.headers, ...activeItem.preview.rows];
                  
                  const activePreviewColDefs = displayHeaders.map((header, index) => ({
                    field: `col${index}`,
                    headerName: header || `Column ${index + 1}`,
                    valueGetter: (params: any) => params.data[index],
                  }));
                  
                  const activePreviewRowData = displayRows.map((row, index) => ({
                    rowIndex: index, ...row
                  }));

                  return (
                    <>
                      {/* 配置栏 */}
                      <div style={{ padding: '12px 20px', borderBottom: '1px solid #ddd', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {/* 显示文件/工作表信息 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '14px', color: '#666' }}>
                            {activeItem.fileType === 'excel' ? '工作表' : '文件'}:
                          </span>
                          <span style={{ fontSize: '14px', fontWeight: '500', color: '#333' }}>
                            {activeItem.sheetName || activeItem.fileName}
                          </span>
                        </div>
                        
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={activeItem.hasHeader}
                            onChange={() => {
                              const newHasHeader = !activeItem.hasHeader;
                              const newFields = newHasHeader 
                                ? activeItem.preview.headers.map((header, idx) => {
                                    let cleanName: string = (header || `column${idx + 1}`).toString();
                                    cleanName = cleanName.split('').map(c => {
                                      if (/[a-zA-Z0-9_]/.test(c) || (c >= '\u{4e00}' && c <= '\u{9fff}')) {
                                        return c;
                                      }
                                      return '_';
                                    }).join('');
                                    if (!cleanName.trim() || /^_+$/.test(cleanName)) {
                                      cleanName = `column_${idx + 1}`;
                                    }
                                    if (/^\d/.test(cleanName)) {
                                      cleanName = `col_${cleanName}`;
                                    }
                                    return {
                                      name: cleanName,
                                      dataType: 'VARCHAR' as const,
                                    };
                                  })
                                : (activeItem.preview.headers.length > 0 
                                    ? activeItem.preview.headers.map((_, idx) => ({
                                        name: `column_${idx + 1}`,
                                        dataType: 'VARCHAR' as const,
                                      }))
                                    : activeItem.fields);
                              
                              setImportItems(prev => prev.map(i => 
                                i.id === activeImportItemId 
                                  ? { ...i, hasHeader: newHasHeader, fields: newFields } 
                                  : i
                              ));
                            }}
                            style={{ cursor: 'pointer' }}
                          />
                          CSV 包含表头
                        </label>

                        <div style={{ flex: 1 }} />

                        <button
                          onClick={() => handleSingleImport(activeImportItemId)}
                          disabled={loading || activeItem.status === 'success'}
                          style={{
                            padding: '10px 20px',
                            background: '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: (loading || activeItem.status === 'success') ? 'not-allowed' : 'pointer',
                            fontSize: '14px',
                            opacity: (loading || activeItem.status === 'success') ? 0.7 : 1,
                          }}
                        >
                          单独导入
                        </button>

                        <button
                          onClick={() => {
                            if (window.confirm(`确定要删除 ${activeItem.fileName} 吗？`)) {
                              setImportItems(prev => {
                                const filtered = prev.filter(i => i.id !== activeImportItemId);
                                setActiveImportItemId(filtered[0]?.id || null);
                                return filtered;
                              });
                            }
                          }}
                          style={{
                            padding: '10px 20px',
                            background: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px',
                          }}
                        >
                          删除
                        </button>
                      </div>

                      {/* 字段编辑区 */}
                      {activeItem.fields.length > 0 && (
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid #eee', background: '#fafafa', maxHeight: '280px', overflowY: 'auto' }}>
                          <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#333', fontWeight: 600 }}>字段信息</h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
                            {activeItem.fields.map((field, index) => (
                              <div key={index} style={{ 
                                display: 'flex', 
                                gap: '10px', 
                                alignItems: 'center',
                                padding: '8px 12px',
                                background: 'white',
                                border: '1px solid #e0e0e0',
                                borderRadius: '8px',
                                transition: 'all 0.2s',
                              }}>
                                <input
                                  type="text"
                                  value={field.name}
                                  onKeyDown={(e) => {
                                    if (e.key === '.') {
                                      e.preventDefault();
                                    }
                                  }}
                                  onChange={(e) => {
                                    // 清理字段名，防止特殊字符
                                    let newName: string = e.target.value;
                                    newName = newName.split('').map(c => {
                                      if (/[a-zA-Z0-9_]/.test(c) || (c >= '\u{4e00}' && c <= '\u{9fff}')) {
                                        return c;
                                      }
                                      return '_';
                                    }).join('');
                                    // 处理空或全下划线的情况
                                    if (!newName.trim() || /^_+$/.test(newName)) {
                                      newName = `column_${index + 1}`;
                                    }
                                    // 确保不以数字开头
                                    if (/^\d/.test(newName)) {
                                      newName = `col_${newName}`;
                                    }
                                    
                                    setImportItems(prev => prev.map(i => {
                                      if (i.id !== activeImportItemId) return i;
                                      const newFields = [...i.fields];
                                      newFields[index] = { ...newFields[index], name: newName };
                                      return { ...i, fields: newFields };
                                    }));
                                  }}
                                  style={{ 
                                    flex: 2, 
                                    padding: '8px 12px', 
                                    border: '1px solid #ddd', 
                                    borderRadius: '6px', 
                                    fontSize: '14px',
                                    outline: 'none',
                                    transition: 'border-color 0.2s',
                                  }}
                                  placeholder="字段名"
                                  onFocus={(e) => e.target.style.borderColor = '#007bff'}
                                  onBlur={(e) => e.target.style.borderColor = '#ddd'}
                                />
                                <select
                                  value={field.dataType}
                                  onChange={(e) => {
                                    setImportItems(prev => prev.map(i => {
                                      if (i.id !== activeImportItemId) return i;
                                      const newFields = [...i.fields];
                                      newFields[index] = { ...newFields[index], dataType: e.target.value as any };
                                      return { ...i, fields: newFields };
                                    }));
                                  }}
                                  style={{ 
                                    padding: '8px 12px', 
                                    border: '1px solid #ddd', 
                                    borderRadius: '6px', 
                                    fontSize: '14px',
                                    minWidth: '120px',
                                    outline: 'none',
                                    transition: 'border-color 0.2s',
                                  }}
                                  onFocus={(e) => e.target.style.borderColor = '#007bff'}
                                  onBlur={(e) => e.target.style.borderColor = '#ddd'}
                                >
                                  {DATA_TYPES.map((type) => (
                                    <option key={type} value={type}>{type}</option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => {
                                    setImportItems(prev => prev.map(i => {
                                      if (i.id !== activeImportItemId) return i;
                                      const newFields = i.fields.filter((_, idx) => idx !== index);
                                      return { ...i, fields: newFields };
                                    }));
                                  }}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#dc3545',
                                    cursor: 'pointer',
                                    fontSize: '18px',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    transition: 'background 0.2s',
                                  }}
                                  title="删除字段"
                                  onMouseEnter={(e) => e.currentTarget.style.background = '#f8d7da'}
                                  onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 预览表格 */}
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <AgGridReact
                          className="ag-theme-alpine"
                          rowData={activePreviewRowData as any}
                          columnDefs={activePreviewColDefs as any}
                          domLayout="normal"
                          pagination={true}
                          paginationPageSize={50}
                          enableCellTextSelection={true}
                          gridOptions={previewGridOptions}
                        />
                      </div>
                    </>
                  );
                })() : (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '16px' }}>
                    从左侧选择一个文件查看预览
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '16px' }}>
              请点击「+ 添加文件」选择 CSV 文件
            </div>
          )}
        </div>
      )}

      {/* SQL 查询页面 */}
      {activeTab === 'sql' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #ddd', flexShrink: 0 }}>
            {/* 简化的数据库状态栏 */}
            {allDatabaseStatus.length > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '12px',
                padding: '12px',
                background: '#f8f9fa',
                borderRadius: '8px',
                border: '1px solid #dee2e6'
              }}>
                {(() => {
                  const currentDb = allDatabaseStatus.find(d => d.db_type.toLowerCase() === 'sqlite') || allDatabaseStatus[0];
                  const MAX_VISIBLE_TABLES = 3;
                  const visibleTables = currentDb.tables.slice(0, MAX_VISIBLE_TABLES);
                  const hiddenCount = currentDb.tables.length - MAX_VISIBLE_TABLES;
                  return (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          background: currentDb.is_connected ? '#28a745' : '#dc3545'
                        }}></span>
                        <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>{currentDb.db_type}</span>
                        <span style={{ fontSize: '11px', background: '#2196f3', color: 'white', padding: '2px 6px', borderRadius: '3px' }}>当前</span>
                      </div>
                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '6px',
                        flex: 1
                      }}>
                        {visibleTables.map((table) => (
                          <div key={table} style={{
                            padding: '4px 10px',
                            background: '#fff',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            border: '1px solid #dee2e6',
                            fontSize: '12px'
                          }}>
                            <span
                              style={{ fontWeight: 500, cursor: 'pointer' }}
                              onClick={() => updateQuerySql(activeQueryId, `SELECT * FROM "${table}"`)}
                            >
                              {table}
                            </span>
                            {currentDb.row_count.find(([t]) => t === table) && (
                              <span style={{ color: '#007bff', fontSize: '10px' }}>
                                ({currentDb.row_count.find(([t]) => t === table)?.[1]})
                              </span>
                            )}
                          </div>
                        ))}
                        {hiddenCount > 0 && (
                          <div style={{
                            padding: '4px 10px',
                            background: '#e9ecef',
                            borderRadius: '4px',
                            fontSize: '12px',
                            color: '#666'
                          }}>
                            +{hiddenCount} 个表
                          </div>
                        )}
                        {currentDb.tables.length === 0 && (
                          <span style={{ fontSize: '12px', color: '#999', fontStyle: 'italic' }}>暂无表</span>
                        )}
                      </div>
                    </>
                  );
                })()}
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
                  {query.batchResults && query.batchResults.length > 0 && (
                    <span style={{
                      fontSize: '11px',
                      color: '#4caf50',
                      background: '#e8f5e9',
                      padding: '2px 6px',
                      borderRadius: '10px'
                    }}>
                      {query.batchResults.filter(r => r.success).length}成功
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
                      setSqlQueries(prev => prev.map(q => q.id === activeQueryId ? { ...q, result: null, batchResults: null } : q));
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

          {activeQuery?.batchResults && activeQuery.batchResults.length > 0 && (
            <div style={{ flex: 1, overflow: 'auto' }}>
              <div style={{ padding: '8px 20px', background: '#e8f5e9', fontSize: '12px', color: '#2e7d32' }}>
                ✓ 执行完成: {activeQuery.batchResults.filter(r => r.success).length} 成功, {activeQuery.batchResults.filter(r => !r.success).length} 失败
              </div>
              {activeQuery.batchResults.map((stmtResult, index) => (
                <div key={index} style={{ borderBottom: '1px solid #eee' }}>
                  <div style={{ 
                    padding: '12px 20px', 
                    background: stmtResult.success ? '#f8f9fa' : '#fdf2f2',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <span style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: stmtResult.success ? '#28a745' : '#dc3545',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      {stmtResult.success ? '✓' : '✗'}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', color: '#333', fontFamily: 'monospace' }}>
                        {stmtResult.statement.length > 100 ? stmtResult.statement.substring(0, 100) + '...' : stmtResult.statement}
                      </div>
                      {stmtResult.success && stmtResult.affected_rows !== null && (
                        <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                          影响行数: {stmtResult.affected_rows}
                        </div>
                      )}
                      {!stmtResult.success && stmtResult.error && (
                        <div style={{ fontSize: '11px', color: '#dc3545', marginTop: '4px' }}>
                          错误: {stmtResult.error}
                        </div>
                      )}
                    </div>
                  </div>
                  {stmtResult.success && stmtResult.columns && stmtResult.rows && stmtResult.rows.length > 0 && (
                    <div style={{ padding: '0 20px 16px' }}>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                        返回 {stmtResult.rows.length} 行，{stmtResult.columns.length} 列
                      </div>
                      <div style={{ height: '300px', overflow: 'hidden' }}>
                        <AgGridReact
                          className="ag-theme-alpine"
                          rowData={stmtResult.rows.map((row, rowIndex) => ({ rowIndex, ...row })) as any}
                          columnDefs={stmtResult.columns.map((header, colIndex) => ({
                            field: `col${colIndex}` as any,
                            headerName: header,
                            valueGetter: (params: any) => params.data[colIndex],
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
                  {stmtResult.success && stmtResult.columns && stmtResult.rows && stmtResult.rows.length === 0 && (
                    <div style={{ padding: '8px 20px', fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
                      查询返回空结果
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {!activeQuery?.batchResults && !queryLoading && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '16px' }}>
              输入 SQL 并点击"执行查询"
            </div>
          )}
        </div>
      )}

      {/* 项目管理弹窗 */}
      {showProjectModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '8px',
            width: '480px',
            maxWidth: '90%',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '16px 20px',
              background: '#007bff',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h2 style={{ margin: 0, fontSize: '18px' }}>项目管理</h2>
              <button
                onClick={() => setShowProjectModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  fontSize: '24px',
                  cursor: 'pointer',
                  lineHeight: 1,
                  padding: 0,
                  width: '30px',
                  textAlign: 'center'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: '20px' }}>
              {/* 当前项目信息 */}
              <div style={{ marginBottom: '20px', padding: '12px', background: '#e8f5e9', borderRadius: '6px' }}>
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>当前项目</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#2e7d32' }}>
                  {currentProject || '未选择项目'}
                </div>
              </div>

              {/* 创建新项目 */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '14px', color: '#333', marginBottom: '8px', display: 'block' }}>
                  创建新项目
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="输入项目名称..."
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                  <button
                    onClick={createProject}
                    disabled={!newProjectName.trim()}
                    style={{
                      padding: '10px 20px',
                      background: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: !newProjectName.trim() ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      opacity: !newProjectName.trim() ? 0.7 : 1
                    }}
                  >
                    创建
                  </button>
                </div>
              </div>

              {/* 项目列表 */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '14px', color: '#333', margin: 0 }}>
                    现有项目 ({projects.length})
                  </label>
                  {projects.length > 0 && (
                    <button
                      onClick={() => {
                        if (selectedProjects.size === projects.length) {
                          setSelectedProjects(new Set());
                        } else {
                          setSelectedProjects(new Set(projects));
                        }
                      }}
                      style={{
                        padding: '4px 10px',
                        background: '#f5f5f5',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      {selectedProjects.size === projects.length ? '取消全选' : '全选'}
                    </button>
                  )}
                </div>
                {projects.length > 0 ? (
                  <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '8px' }}>
                    {projects.map((project) => (
                      <div
                        key={project}
                        style={{
                          padding: '12px 14px',
                          borderBottom: '1px solid #eee',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: currentProject === project ? '#e3f2fd' : 'transparent',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                          <input
                            type="checkbox"
                            checked={selectedProjects.has(project)}
                            onChange={(e) => {
                              const newSelected = new Set(selectedProjects);
                              if (e.target.checked) {
                                newSelected.add(project);
                              } else {
                                newSelected.delete(project);
                              }
                              setSelectedProjects(newSelected);
                            }}
                            style={{
                              marginRight: '12px',
                              width: '16px',
                              height: '16px',
                              cursor: 'pointer'
                            }}
                          />
                          <div
                            style={{
                              flex: 1,
                              fontSize: '14px',
                              color: currentProject === project ? '#1976d2' : '#333',
                              cursor: 'pointer',
                              padding: '6px 0',
                              fontWeight: currentProject === project ? 600 : 400,
                            }}
                            onClick={(e) => {
                              switchProject(project);
                              if (!e.ctrlKey) {
                                setShowProjectModal(false);
                              }
                            }}
                            title={currentProject !== project ? "Ctrl+点击可保持打开" : ""}
                          >
                            {project}
                            {currentProject === project && <span style={{ marginLeft: '8px', fontSize: '12px', color: '#4caf50' }}>当前</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {/* 重命名按钮 */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const newName = prompt('请输入新的项目名称:', project);
                              if (newName && newName.trim() && newName !== project) {
                                handleRenameProject(project, newName.trim());
                              }
                            }}
                            style={{
                              padding: '6px 10px',
                              border: '1px solid #ff9800',
                              borderRadius: '6px',
                              background: '#fff',
                              color: '#f57c00',
                              cursor: 'pointer',
                              fontSize: '13px',
                              transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#fff3e0';
                              e.currentTarget.style.borderColor = '#f57c00';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = '#fff';
                              e.currentTarget.style.borderColor = '#ff9800';
                            }}
                            title="重命名"
                          >
                            ✏️
                          </button>
                          {/* 删除按钮 */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`确定要删除项目 "${project}" 吗？此操作不可恢复！`)) {
                                handleDeleteProject(project);
                              }
                            }}
                            style={{
                              padding: '6px 10px',
                              border: '1px solid #f44336',
                              borderRadius: '6px',
                              background: '#fff',
                              color: '#d32f2f',
                              cursor: 'pointer',
                              fontSize: '13px',
                              transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#ffebee';
                              e.currentTarget.style.borderColor = '#d32f2f';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = '#fff';
                              e.currentTarget.style.borderColor = '#f44336';
                            }}
                            title="删除"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#999', border: '1px dashed #ddd', borderRadius: '6px' }}>
                    暂无项目，请创建一个新项目
                  </div>
                )}
              </div>

              {selectedProjects.size > 0 && (
                <div style={{ marginBottom: '20px', padding: '12px', background: '#e3f2fd', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', color: '#1976d2' }}>
                      已选择 {selectedProjects.size} 个项目
                    </span>
                    <button
                      onClick={handleBatchExport}
                      style={{
                        padding: '8px 20px',
                        background: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      📤 批量导出
                    </button>
                  </div>
                </div>
              )}

              {/* 自定义数据库路径 */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '14px', color: '#333', marginBottom: '8px', display: 'block' }}>
                  <input
                    type="checkbox"
                    checked={useCustomPath}
                    onChange={(e) => setUseCustomPath(e.target.checked)}
                    style={{ marginRight: '8px', cursor: 'pointer' }}
                  />
                  使用自定义数据库路径
                </label>
                {useCustomPath && (
                  <div style={{ padding: '12px', background: '#f8f9fa', borderRadius: '6px' }}>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                      <input
                        type="text"
                        value={customDbPath}
                        onChange={(e) => setCustomDbPath(e.target.value)}
                        placeholder="选择数据库文件..."
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          border: '1px solid #ddd',
                          borderRadius: '6px',
                          fontSize: '13px'
                        }}
                      />
                      <button
                        onClick={selectCustomDbPath}
                        style={{
                          padding: '8px 16px',
                          background: '#007bff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '13px'
                        }}
                      >
                        浏览
                      </button>
                    </div>
                    <button
                      onClick={openCustomDatabase}
                      disabled={!customDbPath.trim()}
                      style={{
                        width: '100%',
                        padding: '8px',
                        background: '#17a2b8',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: !customDbPath.trim() ? 'not-allowed' : 'pointer',
                        fontSize: '13px',
                        opacity: !customDbPath.trim() ? 0.7 : 1
                      }}
                    >
                      打开自定义数据库
                    </button>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
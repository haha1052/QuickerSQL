# SQL 查询页面设计方案

## 一、概述

本文档详细描述了 QuickerSQL 应用中 SQL 查询页面的完整技术实现方案，包括组件结构、数据链路、状态管理和渲染流程。

## 二、整体架构设计

### 2.1 组件结构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        SQL 查询页面                                    │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    SqlEditor (SQL 编辑器)                        │   │
│  │  - Monaco Editor                                               │   │
│  │  - 语法高亮                                                    │   │
│  │  - 自动补全                                                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                   │                                    │
│                                   ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    QueryResult (查询结果)                        │   │
│  │  ┌───────────────────────────────────────────────────────────┐  │   │
│  │  │              QueryResultItem (单条结果)                    │  │   │
│  │  │  ┌─────────────────────────────────────────────────────┐  │  │   │
│  │  │  │              AgGridLazy (懒加载表格)                  │  │  │   │
│  │  │  │  - 数据渲染                                          │  │  │   │
│  │  │  │  - 列定义                                            │  │  │   │
│  │  │  │  - 右键菜单                                          │  │  │   │
│  │  │  └─────────────────────────────────────────────────────┘  │  │   │
│  │  └───────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 数据链路流程

| 阶段 | 组件/模块 | 文件路径 | 职责 |
|------|----------|----------|------|
| 1. 用户输入 | SqlEditor | `src/components/sql/SqlEditor.tsx` | 接收用户输入的 SQL |
| 2. 触发执行 | useQueryExecution | `src/components/sql/hooks/useQueryExecution.ts` | 调用后端执行 |
| 3. IPC 通信 | tauriService | `src/services/tauri.ts` | 封装 invoke 调用 |
| 4. 后端命令 | sql.rs | `src-tauri/src/commands/sql.rs` | 参数校验和路由 |
| 5. SQL 执行 | SqlExecutionService | `src-tauri/src/services/sql_service.rs` | 实际执行逻辑 |
| 6. 结果返回 | BatchExecuteResult | `src-tauri/src/models/database.rs` | 封装返回数据 |
| 7. 状态更新 | useQueryStore | `src/store/queryStore.ts` | 更新查询状态 |
| 8. 结果渲染 | QueryResult + AgGridLazy | `src/components/sql/QueryResultItem.tsx` | 渲染表格 |

## 三、核心技术实现

### 3.1 查询执行 Hook

**文件**: `src/components/sql/hooks/useQueryExecution.ts`

```typescript
export const useQueryExecution = () => {
  const { t } = useLocale();
  const { sqlQueries, activeQueryId, setQueryLoading, setQueryResult, setBatchResults, addToHistory } = useQueryStore();
  const { setMessage } = useAppStore();

  const activeQuery = sqlQueries.find(q => q.id === activeQueryId);

  const executeQuery = useCallback(async () => {
    if (!activeQuery) {
      setMessage(t('hooks.pleaseSelectQuery'), 'warning');
      return;
    }

    setQueryLoading(activeQueryId);
    try {
      // 调用后端执行 SQL
      const response = await tauriService.executeSql(activeQuery.sql);
      
      if (response.success && response.data) {
        const batchResults = response.data.results as SqlStatementResult[];
        
        // 更新批量结果（关键步骤）
        setBatchResults(activeQueryId, batchResults);
        
        // 更新单条结果（兼容旧逻辑）
        const successResults = batchResults.filter(r => r.success);
        const lastQueryResult = successResults.length > 0 ? successResults[successResults.length - 1] : null;
        
        if (lastQueryResult && lastQueryResult.columns && lastQueryResult.rows) {
          setQueryResult(activeQueryId, {
            columns: lastQueryResult.columns,
            rows: lastQueryResult.rows,
          });
        }
        
        // 添加到查询历史
        addToHistory(activeQuery.sql, successResults.length > 0, lastQueryResult?.rows?.length);
      }
    } catch (error) {
      console.error(t('hooks.queryError'), error);
    } finally {
      setQueryLoading(null);
    }
  }, [t, activeQuery, activeQueryId, setQueryLoading, setQueryResult, setBatchResults, addToHistory, setMessage]);

  return { executeQuery, isLoading: useQueryStore(state => state.queryLoading) === activeQueryId };
};
```

### 3.2 状态管理

**文件**: `src/store/queryStore.ts`

```typescript
interface QueryState {
  sqlQueries: SqlQuery[];           // 查询列表
  activeQueryId: string;            // 当前活动查询 ID
  queryLoading: string | null;      // 加载中的查询 ID
  queryHistory: QueryHistoryItem[]; // 查询历史
  
  setSqlQueries: (queries: SqlQuery[]) => void;
  updateSqlQuery: (id: string, updates: Partial<SqlQuery>) => void;
  setActiveQueryId: (id: string) => void;
  setQueryLoading: (id: string | null) => void;
  setQueryResult: (id: string, result: QueryResult | null) => void;
  setBatchResults: (id: string, batchResults: SqlStatementResult[] | null) => void;
}

// SqlQuery 接口定义
interface SqlQuery {
  id: string;
  name: string;
  sql: string;
  result: QueryResult | null;           // 单条结果（旧版）
  batchResults: SqlStatementResult[] | null; // 批量结果（新版）
}

// SqlStatementResult 接口定义
interface SqlStatementResult {
  statement: string;
  success: boolean;
  error: string | null;
  columns: string[] | null;   // 列名数组
  rows: string[][] | null;    // 行数据（二维数组）
  affected_rows: number | null;
}
```

### 3.3 结果渲染组件

**文件**: `src/components/sql/QueryResult.tsx`

```tsx
export const QueryResult: React.FC = () => {
  const { sqlQueries, activeQueryId, queryLoading } = useQueryStore();
  const activeQuery = sqlQueries.find(q => q.id === activeQueryId);
  
  if (!activeQuery) return null;

  const batchResults = activeQuery.batchResults;
  const isLoading = queryLoading === activeQueryId;

  return (
    <div style={styles.container}>
      {isLoading ? (
        <div style={styles.loadingContainer}>
          <div style={styles.loadingText}>{t('query.running')}</div>
        </div>
      ) : batchResults && batchResults.length > 0 ? (
        <div style={styles.resultsContainer}>
          {batchResults.map((result, index) => (
            <QueryResultItem key={index} result={result} index={index} />
          ))}
        </div>
      ) : (
        <div style={styles.emptyContainer}>
          <span style={styles.emptyText}>{t('query.clickToRun')}</span>
        </div>
      )}
    </div>
  );
};
```

### 3.4 单条结果渲染

**文件**: `src/components/sql/QueryResultItem.tsx`

```tsx
export const QueryResultItem: React.FC<QueryResultItemProps> = ({ result, index }) => {
  const [showChart, setShowChart] = useState(false);
  
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.statementInfo}>
          <span style={styles.indexBadge}>#{index + 1}</span>
          <span style={styles.statementText} title={result.statement}>
            {displayStatement}
          </span>
        </div>
        <div style={styles.headerActions}>
          <div style={result.success ? styles.successBadge : styles.errorBadge}>
            {result.success ? t('query.success') : t('query.fail')}
          </div>
          {result.success && result.columns && result.rows && (
            <>
              <div style={styles.viewToggle}>
                <Button variant={!showChart ? 'primary' : 'outline'} size="sm" onClick={() => setShowChart(false)}>
                  {t('query.table')}
                </Button>
                <Button variant={showChart ? 'primary' : 'outline'} size="sm" onClick={() => setShowChart(true)}>
                  {t('query.chart')}
                </Button>
              </div>
              <DropdownMenu
                trigger={<Button variant="outline" size="sm">{t('query.exportMenu')} ▼</Button>}
                items={[
                  { label: t('query.exportCSV'), onClick: () => handleExport(result, 'csv') },
                  { label: t('query.exportJSON'), onClick: () => handleExport(result, 'json') },
                ]}
              />
            </>
          )}
        </div>
      </div>

      {!result.success ? (
        <div style={styles.errorContainer}>
          <span style={styles.errorText}>{result.error}</span>
        </div>
      ) : (
        <>
          {/* 影响行数提示（非 SELECT 语句） */}
          {result.affected_rows !== null && !result.columns ? (
            <div style={styles.affectedRowsContainer}>
              <span style={styles.affectedRowsText}>{t('query.affectedRows')}: {result.affected_rows}</span>
            </div>
          ) : null}

          {/* 表格/图表展示（SELECT 语句） */}
          {result.columns && result.rows ? (
            showChart ? (
              <div style={styles.chartContainer}>
                <ChartPanel queryResult={{ columns: result.columns, rows: result.rows }} />
              </div>
            ) : (
              <div style={styles.tableWrapper}>
                <div style={{ ...styles.tableContainer, ...gridStyle }} className="ag-theme-alpine">
                  <AgGridLazy
                    key={`query-${index}-${JSON.stringify(result.rows?.length || 0)}`}
                    rowData={result.rows.map((row, rowIndex) => {
                      const rowObj: Record<string, any> = { id: rowIndex };
                      row.forEach((cell, colIndex) => {
                        rowObj[`col${colIndex}`] = cell;
                      });
                      return rowObj;
                    })}
                    columnDefs={result.columns.map((col, colIndex) => ({
                      field: `col${colIndex}`,
                      headerName: col,
                    }))}
                    localeText={localeText}
                    defaultColDef={{
                      filter: true,
                      sortable: true,
                      resizable: true,
                      minWidth: 120,
                    }}
                    onCellContextMenu={handleGridContextMenu}
                    rowSelection="multiple"
                    enableCellTextSelection={true}
                  />
                </div>
              </div>
            )
          ) : null}
        </>
      )}
    </div>
  );
};
```

### 3.5 后端命令实现

**文件**: `src-tauri/src/commands/sql.rs`

```rust
#[tauri::command]
pub fn execute_sql(
    state: State<'_, TauriAppState>,
    sql: String,
) -> Result<BatchExecuteResult, String> {
    // 1. 连接检查
    if !state.db_manager.is_connected() {
        return Err("未连接到数据库".to_string());
    }

    // 2. 获取数据库连接
    let sqlite_conn = state.db_manager.get_connection().map_err(|e| e.to_string())?;
    let duckdb_opt = match state.get_duckdb_connection() {
        Ok(arc) => Some(arc),
        Err(e) => {
            log::warn!("DuckDB not initialized, using SQLite: {}", e);
            None
        }
    };

    // 3. 缓存快路径检查（单语句或多语句全命中）
    if state.query_cache.is_enabled() {
        // ... 缓存检查逻辑
    }

    // 4. 执行 SQL（核心逻辑）
    let result = SqlExecutionService::execute_sql_batch(
        &sqlite_conn,
        duckdb_opt,
        &state.db_manager,
        &sql,
        query_cache_ref,
    );

    result
}
```

### 3.6 SQL 执行服务

**文件**: `src-tauri/src/services/sql_service.rs`

```rust
pub fn execute_sql_batch(
    sqlite_conn: &MutexGuardConnection<'_>,
    duckdb_conn_opt: Option<Arc<Mutex<Box<dyn DatabaseConnection>>>>,
    db_manager: &DatabaseManager,
    sql: &str,
    query_cache: Option<&QueryCacheService>,
) -> Result<BatchExecuteResult, String> {
    // 1. 拆分 SQL 语句
    let statements = Self::split_sql_statements(sql);
    if statements.is_empty() {
        return Err("没有有效的SQL语句".to_string());
    }

    // 2. 检查是否包含写操作（用于缓存失效）
    if let Some(qc) = query_cache {
        if Self::contains_write_operation(&statements) {
            qc.invalidate_all();
        }
    }

    // 3. 逐条执行
    let mut results: Vec<SqlStatementResult> = Vec::new();
    for stmt in statements.iter() {
        let trimmed_stmt = stmt.trim();
        
        // 检查缓存
        if let Some(qc) = query_cache {
            if let Some(cached) = qc.get(&cache_key) {
                results.push(SqlStatementResult {
                    statement: trimmed_stmt.to_string(),
                    success: true,
                    error: None,
                    columns: Some(cached.columns),
                    rows: Some(cached.rows),
                    affected_rows: None,
                });
                continue;
            }
        }

        // 路由到 DuckDB 或 SQLite
        let use_duckdb = QueryRouter::should_use_duckdb(trimmed_stmt);
        if use_duckdb {
            // DuckDB 执行逻辑
            match duckdb_conn_opt {
                Some(duckdb_conn_mutex) => {
                    let duckdb_conn_guard = duckdb_conn_mutex.lock()?;
                    let result = duckdb_conn_guard.query(&routed_sql, &[])?;
                    results.push(SqlStatementResult {
                        statement: trimmed_stmt.to_string(),
                        success: true,
                        error: None,
                        columns: Some(result.columns),
                        rows: Some(result.rows),
                        affected_rows: None,
                    });
                    // 写回缓存
                    if let Some(qc) = query_cache {
                        qc.set(cache_key, result);
                    }
                }
                None => {
                    // 回退到 SQLite
                    // ...
                }
            }
        } else {
            // SQLite 执行逻辑
            // ...
        }
    }

    Ok(BatchExecuteResult {
        results,
        success_count: success_count,
        fail_count: fail_count,
    })
}
```

## 四、数据结构定义

### 4.1 前端类型

**文件**: `src/types/index.ts`

```typescript
export interface SqlStatementResult {
  statement: string;           // 执行的 SQL 语句
  success: boolean;            // 是否成功
  error: string | null;        // 错误信息
  columns: string[] | null;    // 列名数组
  rows: string[][] | null;     // 行数据（二维字符串数组）
  affected_rows: number | null; // 影响的行数（非 SELECT 语句）
}

export interface BatchExecuteResult {
  results: SqlStatementResult[]; // 多条语句的执行结果
  success_count: number;         // 成功数量
  fail_count: number;            // 失败数量
}

export interface QueryResult {
  columns: string[];   // 列名
  rows: string[][];    // 行数据
}
```

### 4.2 后端类型

**文件**: `src-tauri/src/models/database.rs`

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SqlStatementResult {
    pub statement: String,
    pub success: bool,
    pub error: Option<String>,
    pub columns: Option<Vec<String>>,
    pub rows: Option<Vec<Vec<String>>>,
    pub affected_rows: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchExecuteResult {
    pub results: Vec<SqlStatementResult>,
    pub success_count: usize,
    pub fail_count: usize,
}
```

## 五、关键问题与解决方案

### 5.1 查询结果不显示问题

**问题现象**：查询执行成功（显示"成功"标签），但表格区域空白。

**可能原因**：

| 原因 | 表现 | 排查方法 |
|------|------|----------|
| `columns` 或 `rows` 为 null | 条件 `result.columns && result.rows` 不满足 | 检查后端返回数据 |
| 表格容器高度为 0 | 数据存在但不可见 | 检查 CSS 样式 |
| AgGrid 组件 key 未更新 | 数据变化但组件未重新渲染 | 检查 key 属性 |
| AgGrid 懒加载失败 | 组件未正确加载 | 检查控制台错误 |

**解决方案**：

1. **确保数据结构正确**：后端必须返回非 null 的 `columns` 和 `rows`
2. **设置最小高度**：表格容器需要设置 `minHeight`
3. **动态 key 属性**：使用包含数据长度的 key，确保数据变化时重新渲染

```tsx
// 修复后的 key
<AgGridLazy
  key={`query-${index}-${JSON.stringify(result.rows?.length || 0)}`}
  // ...
/>

// 修复后的样式
const styles = {
  tableWrapper: {
    flex: 1,
    minHeight: 200,  // 确保容器有最小高度
    display: 'flex',
    flexDirection: 'column',
  },
  tableContainer: {
    flex: 1,
    minHeight: 200,
    height: '100%',
  },
};
```

### 5.2 数据链路调试流程

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        调试流程                                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  1. 检查后端返回                                                        │
│     └── 查看 execute_sql 返回的 BatchExecuteResult                      │
│         └── 确认 columns 和 rows 不为 null                              │
│                                                                        │
│  2. 检查前端状态                                                        │
│     └── 查看 queryStore 中的 batchResults                              │
│         └── 确认数据已正确存储                                          │
│                                                                        │
│  3. 检查组件渲染                                                        │
│     └── 查看 QueryResult 组件的 batchResults                           │
│         └── 确认 result.columns 和 result.rows 存在                     │
│                                                                        │
│  4. 检查 AgGridLazy                                                    │
│     └── 确认 rowData 和 columnDefs 正确生成                             │
│         └── 检查 key 属性是否随数据变化                                 │
│                                                                        │
│  5. 检查样式                                                            │
│     └── 使用开发者工具检查表格容器高度                                    │
│         └── 确认 minHeight 已设置                                       │
│                                                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.3 调试代码示例

**前端调试（浏览器控制台）**：

```javascript
// 检查状态管理中的数据
const store = useQueryStore.getState();
console.log('Active Query:', store.activeQueryId);
console.log('Queries:', store.sqlQueries);
const active = store.sqlQueries.find(q => q.id === store.activeQueryId);
console.log('Batch Results:', active?.batchResults);

// 检查具体结果
if (active?.batchResults) {
  const result = active.batchResults[0];
  console.log('Columns:', result.columns);
  console.log('Rows:', result.rows);
  console.log('Row count:', result.rows?.length);
}
```

**后端调试（日志）**：

```rust
// 在 sql_service.rs 中添加日志
log::info!("执行结果: columns={:?}, rows_count={}", 
    query_result.columns, 
    query_result.rows.len());

// 在 sql.rs 中添加日志
log::info!("返回结果: success_count={}, fail_count={}", 
    result.success_count, 
    result.fail_count);
```

## 六、性能优化策略

### 6.1 查询缓存

- **缓存策略**：LRU + TTL
- **缓存键**：SQL 语句 + 参数
- **失效时机**：写操作（INSERT/UPDATE/DELETE/DROP）触发全量失效
- **命中场景**：
  - 单条 SELECT/PRAGMA/WITH/EXPLAIN 语句
  - 多条只读语句全命中

### 6.2 懒加载

- **AgGridLazy**：动态 import ag-grid 模块，减少首屏加载时间
- **按需渲染**：只有当数据存在时才渲染表格组件

### 6.3 DuckDB 路由

- **自动路由**：SELECT 语句优先使用 DuckDB
- **回退机制**：DuckDB 失败时自动回退到 SQLite

## 七、常见问题排查

### 7.1 查询结果为空

**排查步骤**：

1. **检查 SQL 语句**：确保表名和列名正确
2. **检查数据库连接**：确认已连接到正确的数据库
3. **检查数据导入**：确认数据已成功导入
4. **检查权限**：确认用户有读取权限

### 7.2 查询执行缓慢

**排查步骤**：

1. **检查 SQL 优化**：添加索引、优化查询计划
2. **检查数据量**：使用 LIMIT 限制返回行数
3. **检查缓存**：确认查询缓存已启用
4. **检查数据库类型**：SELECT 语句应使用 DuckDB

### 7.3 表格渲染异常

**排查步骤**：

1. **检查样式**：确认容器高度和宽度
2. **检查数据格式**：确认 rows 和 columns 格式正确
3. **检查 AgGrid 配置**：确认 columnDefs 与 rowData 匹配
4. **检查控制台错误**：查看是否有 JavaScript 错误

## 八、代码优化建议

### 8.1 待优化项

| 优先级 | 优化点 | 说明 |
|--------|--------|------|
| P0 | 结果预览限制 | 添加默认 LIMIT 1000，防止大数据量卡死 |
| P1 | 异步渲染 | 使用 React.lazy 进一步优化首屏加载 |
| P2 | 虚拟滚动 | 大量数据时使用虚拟滚动 |
| P3 | 查询中断 | 添加取消查询功能 |

### 8.2 潜在改进

1. **分页支持**：添加服务器端分页
2. **查询计划**：显示执行计划
3. **语法检查**：实时 SQL 语法验证
4. **性能监控**：显示查询执行时间

---

**文档版本**: v1.0  
**创建日期**: 2026-06-22  
**适用版本**: QuickerSQL v2.0.0+
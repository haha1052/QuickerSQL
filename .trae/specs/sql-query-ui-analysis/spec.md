# SQL查询界面问题分析与重构方案 - Product Requirement Document

## Overview
- **Summary**: 深入分析当前SQL查询界面存在的问题，包括布局缺陷、状态管理不一致、渲染逻辑问题等，并提出完整的重构方案
- **Purpose**: 解决用户反馈的"查询结果窗口消失"、"表格不显示数据"等问题，提升用户体验
- **Target Users**: QuickerSQL 应用的所有SQL查询用户

## Goals
- 修复结果窗口布局问题，确保始终可见
- 统一状态管理，消除数据流向不一致
- 优化表格渲染，支持滚动和分页
- 提供完善的错误处理和用户反馈

## Non-Goals (Out of Scope)
- 后端SQL执行引擎的优化
- 新增图表可视化功能
- 数据库连接管理功能

## Background & Context
根据用户反馈和代码分析，当前SQL查询界面存在以下核心问题：

1. **布局问题**: 结果窗口高度依赖父容器的`height: 100%`，但父容器没有明确高度，导致结果窗口被压缩或消失
2. **状态管理**: 同时存在`batchResults`和`queryResult`两个状态来源，存在时序竞态问题
3. **渲染逻辑**: 条件判断过于严格，空数组被错误地判断为"无数据"
4. **缺少滚动支持**: 大量数据无法完整展示，用户体验差

## Functional Requirements
- **FR-1**: SQL查询结果窗口必须始终可见，默认占屏幕高度的50%
- **FR-2**: 编辑器和结果窗口之间的分隔条可拖动调整比例
- **FR-3**: 表格支持垂直滚动，表头固定
- **FR-4**: 表格支持分页浏览
- **FR-5**: 多语句批量执行时，每个结果独立显示，支持独立滚动
- **FR-6**: 空结果集显示友好提示，而非空白

## Non-Functional Requirements
- **NFR-1**: 结果窗口最小高度不低于200px
- **NFR-2**: 表格渲染性能：1000行数据加载时间<1秒
- **NFR-3**: 响应式设计，支持不同屏幕尺寸

## Constraints
- **Technical**: React + TypeScript + AgGrid
- **Dependencies**: Zustand状态管理、Tauri IPC通信

## Assumptions
- 用户使用现代浏览器（Chrome/Firefox/Edge）
- 单次查询结果不超过10000行

## Acceptance Criteria

### AC-1: 结果窗口布局正常
- **Given**: 用户打开SQL查询页面
- **When**: 页面加载完成
- **Then**: 编辑器和结果窗口各占约50%高度，分隔条可见可拖动
- **Verification**: `human-judgment`

### AC-2: 查询执行成功显示结果
- **Given**: 用户执行一条有效的SELECT语句
- **When**: 后端返回数据
- **Then**: 表格正确渲染数据，支持滚动和分页
- **Verification**: `human-judgment`

### AC-3: 空结果集显示提示
- **Given**: 用户执行返回空结果的查询
- **When**: 后端返回空数组
- **Then**: 显示"查询结果为空"提示，而非空白
- **Verification**: `human-judgment`

### AC-4: 多语句批量执行
- **Given**: 用户执行多条SQL语句
- **When**: 所有语句执行完成
- **Then**: 每个语句的结果独立显示，各自有滚动区域
- **Verification**: `human-judgment`

## Open Questions
- [ ] 是否需要支持虚拟滚动以处理超大数据集？
- [ ] 是否需要添加行号显示功能？

---

# SQL查询界面数据链路分析

## 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        前端层 (React)                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │  SQLEditor  │────▶│ QueryStore   │────▶│ QueryResult │      │
│  │  (编辑器)   │    │  (状态管理)  │    │  (结果展示)  │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                    │                                  │
└─────────│────────────────────│──────────────────────────────────┘
          │                    │
          ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Tauri IPC 通信层                             │
│         invoke("execute_sql", { sql })                         │
└───────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                        后端层 (Rust)                           │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │ sql.rs      │────▶│SqlExecution │────▶│   Database  │      │
│  │ (Command)   │    │ Service      │    │  (DuckDB/   │      │
│  │             │    │              │    │   SQLite)   │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

## 数据流向详细说明

### 1. 用户触发查询

```typescript
// SQLEditor.tsx - 用户点击执行按钮
const handleExecute = () => {
  if (!isLoading) {
    onExecute();
  }
};
```

### 2. 状态管理与执行

```typescript
// useQueryExecution.ts - 执行查询逻辑
const executeQuery = useCallback(async () => {
  setQueryLoading(activeQueryId);
  try {
    const response = await tauriService.executeSql(activeQuery.sql);
    if (response.success && response.data) {
      const batchResults = response.data.results as SqlStatementResult[];
      setBatchResults(activeQueryId, batchResults);
    }
  } finally {
    setQueryLoading(null);
  }
}, [...]);
```

### 3. 后端处理

```rust
// src-tauri/src/commands/sql.rs
#[tauri::command]
pub fn execute_sql(
    state: State<'_, TauriAppState>,
    sql: String,
) -> Result<BatchExecuteResult, String> {
    // 1. 检查数据库连接
    // 2. 解析SQL语句
    // 3. 路由到DuckDB或SQLite
    // 4. 执行并返回结果
}
```

### 4. 结果渲染

```typescript
// SqlQueryPage.tsx - 渲染结果
{query?.batchResults !== null && query?.batchResults !== undefined ? (
  <div style={styles.resultsStackedContainer}>
    {query.batchResults.map((result, index) =>
      renderSingleResult(result, index)
    )}
  </div>
) : (
  <div style={styles.placeholder}>
    {t('common.noResult')}
  </div>
)}
```

---

# 当前问题详细分析

## 问题1: 布局高度问题

**位置**: `SqlQueryPage.tsx` 第222-228行

```typescript
container: {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',  // ⚠️ 问题：父容器没有明确高度
  background: 'var(--bg-primary)',
},
```

**影响**: 结果窗口高度为0或被压缩

**修复方案**:
```typescript
container: {
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',       // 使用视口高度
  minHeight: '600px',    // 确保最小高度
  background: 'var(--bg-primary)',
},
```

## 问题2: 状态竞态问题

**位置**: `useQueryExecution.ts`

**问题描述**: 同时维护`batchResults`和`queryResult`两个状态，存在异步时序延迟

**影响**: 数据更新不及时，界面显示滞后

**修复方案**: 统一使用`batchResults`作为唯一数据源

## 问题3: 渲染条件过于严格

**位置**: `QueryResultItem.tsx`

```typescript
// 原代码 - 过于严格
{result.columns && result.rows ? (
  // 渲染表格
) : (
  // 显示影响行数
)}
```

**问题**: 当`columns`为空数组`[]`时，条件为`false`，导致表格不渲染

**修复方案**:
```typescript
{result.columns !== null && result.columns !== undefined && result.columns.length > 0 ? (
  // 渲染表格
) : result.success && result.affected_rows !== null ? (
  // 显示影响行数
) : result.success ? (
  // 显示"无数据"提示
) : null}
```

## 问题4: 缺少滚动和分页支持

**位置**: `QueryResultItem.tsx`

**问题**: 表格容器没有设置最大高度和overflow属性，大量数据无法浏览

**修复方案**:
```typescript
tableContainer: {
  flex: 1,
  minHeight: 200,
  maxHeight: 420,   // 设置最大高度
  overflow: 'auto',  // 启用滚动
},
```

---

# 代码优化建议

## 优化后的SqlQueryPage.tsx关键代码

```typescript
const SqlQueryPage: React.FC<SqlQueryPageProps> = ({
  query,
  onChange,
  onExecute,
  isLoading,
}) => {
  const [editorSize, setEditorSize] = useState(50);  // 默认50%
  
  // ... 拖动逻辑 ...

  const renderSingleResult = (result: SqlStatementResult, index: number) => (
    <div key={index} style={styles.singleResultContainer}>
      <div style={styles.singleResultHeader}>
        <span>#{index + 1}</span>
        <span>{result.statement}</span>
        <span style={result.success ? styles.success : styles.error}>
          {result.success ? '成功' : '失败'}
        </span>
      </div>
      
      {!result.success ? (
        <div>{result.error}</div>
      ) : result.columns?.length > 0 ? (
        <div style={styles.tableWrapper}>
          <AgGridLazy
            rowData={result.rows?.map((row, i) => ({ ...row, id: i }))}
            columnDefs={result.columns.map((col, i) => ({
              field: `col${i}`,
              headerName: col,
            }))}
            pagination={true}
            paginationPageSize={50}
          />
        </div>
      ) : result.affected_rows !== null ? (
        <div>影响行数: {result.affected_rows}</div>
      ) : (
        <div>查询结果为空</div>
      )}
    </div>
  );

  return (
    <div style={styles.container}>
      <div style={styles.toolbar}>...</div>
      
      <div style={{ height: `${editorSize}%` }}>
        <SQLEditor {...} />
      </div>
      
      <div style={styles.resizer} onMouseDown={handleMouseDown} />
      
      <div style={{ height: `${100 - editorSize}%` }}>
        {query?.batchResults ? (
          <div style={styles.resultsContainer}>
            {query.batchResults.map(renderSingleResult)}
          </div>
        ) : (
          <div style={styles.placeholder}>点击执行查询</div>
        )}
      </div>
    </div>
  );
};
```

---

# 验证清单

- [ ] 结果窗口默认占50%高度
- [ ] 分隔条可拖动调整比例
- [ ] 结果窗口最小高度200px
- [ ] 查询成功显示表格
- [ ] 空结果集显示提示
- [ ] 表格支持垂直滚动
- [ ] 表格支持分页（50行/页）
- [ ] 多语句结果独立显示
- [ ] 写操作显示影响行数
- [ ] 错误信息正确显示
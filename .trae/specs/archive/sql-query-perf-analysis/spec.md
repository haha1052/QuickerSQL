# SQL查询页面性能瓶颈分析与优化方案

## Why
当切换到SQL查询页面时，多个SQL的缓存和结果渲染导致系统严重卡顿；此时点击设置按钮也会很卡。需要从整体上重新梳理前端显示架构，给出性能优化设计方案，暂不实施。

## What Changes
- 本文档为**分析报告**，不包含代码变更
- 提出性能优化的设计方向和方案建议
- 为后续实施提供明确的改进路线图

## Impact
- Affected code: SQL查询页面相关的前端组件、状态管理、ag-grid配置、设置系统联动
  - `src/components/sql/QueryResultItem.tsx`
  - `src/components/sql/QueryResult.tsx`
  - `src/components/sql/SQLEditor.tsx`
  - `src/components/workspace/PanelManager.tsx`
  - `src/components/workspace/Workspace.tsx`
  - `src/store/queryStore.ts`
  - `src/components/common/SettingsModal.tsx`
  - `src/contexts/SettingsContext.tsx`
  - `src/components/common/AgGridLazy.tsx`

---

## 一、问题现象

| 现象 | 严重程度 | 触发条件 |
|------|---------|---------|
| SQL查询页面输入卡顿 | P0 | 在编辑器中输入SQL时 |
| 多结果集渲染卡顿 | P0 | 执行多条SQL后查看结果 |
| 设置按钮点击无反应/卡顿 | P0 | 在SQL查询页面点击设置按钮 |
| 切换到SQL页面初始化慢 | P1 | 从其他页面切到SQL查询页 |
| 调整结果框高度卡顿 | P1 | 拖动面板分隔条 |

---

## 二、根因分析（6大瓶颈）

### 瓶颈1：queryStore 每次按键触发全量数组重建 + persist序列化

**位置**: `src/store/queryStore.ts` 第65-69行 + 第130-138行

```typescript
// queryStore.ts 第65-69行
updateSqlQuery: (id, updates) => set((state) => ({
  sqlQueries: state.sqlQueries.map((query) =>
    query.id === id ? { ...query, ...updates } : query
  ),
})),

// queryStore.ts 第130-138行 partialize
partialize: (state) => ({
  sqlQueries: state.sqlQueries,        // ⚠️ 含 batchResults（可能上万行）
  activeQueryId: state.activeQueryId,
  queryHistory: state.queryHistory,
}),
```

**问题链路**:
```
用户输入一个字符
  → SQLEditor.handleChange → onChange(sql)
  → PanelManager: updateSqlQuery(id, { sql })
  → queryStore.set({ sqlQueries: sqlQueries.map(...) })  // 全量数组重建
  → persist中间件序列化整个sqlQueries到localStorage（含batchResults）
  → 所有订阅sqlQueries的组件重渲染
  → 按键卡顿
```

**影响**: 每次按键都会将包含 `batchResults`（可能上万行数据）的整个 `sqlQueries` 数组序列化到 localStorage。

---

### 瓶颈2：QueryResultItem 的 rowData/columnDefs 无 useMemo

**位置**: `src/components/sql/QueryResultItem.tsx` 第222-232行

```tsx
<AgGridLazy
  rowData={displayRows.map((row, rowIndex) => {       // ❌ 每次render都重建
    const rowObj: Record<string, string | number | boolean | null> = { id: rowIndex };
    row.forEach((cell, colIndex) => {
      rowObj[`col${colIndex}`] = cell;
    });
    return rowObj;
  })}
  columnDefs={result.columns.map((col, colIndex) => ({  // ❌ 每次render都重建
    field: `col${colIndex}`,
    headerName: col,
  }))}
/>
```

**问题**: 每次组件重渲染（即使数据没变），都会创建全新的 rowData 和 columnDefs 数组，ag-grid 收到新引用后会触发完整的 diff + 重绘。

**触发场景**: 任何 `useSetting` 返回的设置变化、`useLocale` 的 t 函数变化、父组件任意 state 变化，都会导致 ag-grid 全量重绘。

---

### 瓶颈3：AgGridLazy 的 key 包含 displayRowCount 导致行数变化时整表重建

**位置**: `src/components/sql/QueryResultItem.tsx` 第219行

```tsx
key={`query-item-${index}-${result.columns.length}-${displayRowCount}`}
```

**问题**: 当结果集行数变化（重新执行SQL返回不同行数）时，key 改变 → React 卸载旧的 AgGridLazy 并挂载新的。ag-grid 实例销毁+重建开销巨大（数百毫秒）。

---

### 瓶颈4：SettingsModal 始终挂载且全量订阅，打开时触发全页面重渲染

**位置**: `src/components/common/SettingsModal.tsx` 第14-56行 + `src/AppWrapper.tsx` 第468行

**问题链路**:
```
点击设置按钮
  → showSettingsModal = true
  → SettingsModal useEffect 触发 loadSettings()
  → settingsStore.set({ categories, loading }) → categories引用变化
  → SettingsContext useEffect 重建 settings Map
  → 所有 useSetting 订阅者重渲染
    - SQLEditor (30+ 个 useSetting)
    - QueryResultItem (8 个 useSetting)
    - ParameterPanel
  → QueryResultItem 重渲染 → rowData.map() 重建 → ag-grid 全量diff
  → 卡顿
```

**关键**: SettingsModal 即使关闭也会执行所有 hooks（第14-56行），因为 React hooks 规则要求 hooks 不能在 early return（第541行）之前。

---

### 瓶颈5：SQLEditor 30+ 个 useSetting 订阅 + 串行N+1 IPC

**位置**: `src/components/sql/SQLEditor.tsx` 第45-85行 + 第562-597行

**问题1**: 30+ 个 `useSetting` 调用，每个都订阅 `SettingsContext`。任何一个设置变化都会触发 SQLEditor 重渲染。

**问题2**: `loadTablesAndColumns` 中串行 await N 个表的列信息：
```typescript
for (const table of tables) {
  const colsResp = await tauriService.getTableColumns(table.name); // 串行
}
```
50个表 = 50次串行IPC = ~250ms阻塞。

---

### 瓶颈6：ag-grid 配置问题

**位置**: `src/components/sql/QueryResultItem.tsx` 第218-246行

| 配置项 | 当前值 | 问题 |
|--------|--------|------|
| `domLayout` | `"autoHeight"` | 大数据集时渲染所有行，禁用虚拟滚动 |
| `defaultColDef.filter` | `true` | 全列启用filter，50+列时拖慢初始渲染 |
| `defaultColDef.sortable` | `true` | 全列启用sortable |
| `animateRows` | 默认`true` | 大数据集排序/过滤时大量动画计算 |
| `paginationPageSize` | `20` | 偏小，频繁翻页 |

---

## 三、状态更新触发不必要重渲染的完整链路图

```
用户输入一个字符
    ↓
SQLEditor.handleChange → onChange(sql)
    ↓
PanelManager: updateSqlQuery(displayedQueryId, { sql })
    ↓
queryStore.updateSqlQuery → set({ sqlQueries: sqlQueries.map(...) })
    ↓
┌─────────────────────────────────────────────────────────────┐
│ 所有订阅 sqlQueries 的组件重渲染：                              │
│  - QueryResult (sqlQueries)                                  │
│  - QueryResultItem (sqlQueries 第33行全量订阅)                │
│  - PanelManager (sqlQueries)                                │
│  - ExecutionBar (sqlQueries)                                │
│  - Workspace (sqlQueries)                                   │
│  - useQueryExecution hook (sqlQueries)                      │
└─────────────────────────────────────────────────────────────┘
    ↓
persist中间件序列化整个sqlQueries到localStorage（含batchResults）
    ↓
QueryResultItem 重渲染 → rowData.map() 重建 → ag-grid 全量diff
    ↓
按键卡顿
```

---

## 四、优化方案设计（暂不实施）

### 方案A：状态层优化（queryStore）

**目标**: 减少不必要的状态更新和持久化开销

1. **persist 排除 batchResults**: `partialize` 仅持久化 SQL 文本，不持久化结果数据
2. **selector 订阅**: 所有消费者改用 `useQueryStore(s => s.sqlQueries)` selector 形式
3. **debounce updateSqlQuery**: 对编辑器输入做 debounce（100-200ms），减少高频更新

**预期收益**: 消除按键卡顿（瓶颈1）

### 方案B：渲染层优化（ag-grid）

**目标**: 避免 ag-grid 不必要的全量重绘

1. **rowData/columnDefs 加 useMemo**: 
   ```typescript
   const rowData = useMemo(() => displayRows.map(...), [displayRows]);
   const columnDefs = useMemo(() => result.columns.map(...), [result.columns]);
   ```
2. **移除 key 中的 displayRowCount**: 改用稳定的 `key={index}` 或 `key={result.statement}`
3. **domLayout 改为 normal**: 配合固定高度容器，启用虚拟滚动
4. **按需启用 filter/sortable**: 仅在用户点击列头时启用
5. **关闭 animateRows**: `animateRows={false}`

**预期收益**: 消除结果渲染卡顿（瓶颈2、3、6）

### 方案C：设置系统解耦

**目标**: 隔离 SettingsModal 对 SQL 页面的影响

1. **SettingsModal 拆分**: 拆为 `SettingsModalContainer`（控制挂载）+ `SettingsModalContent`（实际内容），关闭时不执行任何 hooks
2. **loadSettings 优化**: 打开模态框时不重置 loading 状态，避免不必要的 categories 引用变化
3. **SettingsContext 选择性更新**: 仅当实际值变化时重建 Map

**预期收益**: 消除设置按钮卡顿（瓶颈4）

### 方案D：SQLEditor 初始化优化

**目标**: 减少切到SQL页面时的首屏开销

1. **合并 useSetting 订阅**: 用单一 `useSettings(['appearance','editor','sql'])` 批量订阅
2. **loadTablesAndColumns 改并发**: `Promise.all(tables.map(t => tauriService.getTableColumns(t.name)))`
3. **快捷键注册拆分**: 将巨型 useEffect 拆分为多个独立的 useEffect，减少依赖变化时的重注册范围
4. **Monaco Editor 懒加载**: 首次访问SQL页面时才加载 Monaco

**预期收益**: 消除初始化卡顿（瓶颈5）

### 方案E：多结果集渲染优化

**目标**: 支持大量结果集的高效渲染

1. **QueryResultItem memo化**: `React.memo` + 自定义比较函数
2. **虚拟列表**: 多结果集本身用虚拟列表（如 `react-window`），只渲染可见的结果集
3. **key 优化**: 使用 `key={result.statement-hash}` 等稳定key

**预期收益**: 消除多结果集卡顿

---

## 五、优化优先级与ROI评估

| 优先级 | 方案 | 改动量 | 风险 | 预期收益 |
|--------|------|--------|------|---------|
| P0 | 方案B-1: rowData/columnDefs useMemo | 极小 | 低 | 解决80%渲染卡顿 |
| P0 | 方案B-2: 移除key中displayRowCount | 极小 | 低 | 消除整表重建 |
| P0 | 方案A-1: persist排除batchResults | 小 | 低 | 消除按键卡顿 |
| P0 | 方案C-1: SettingsModal拆分 | 中 | 中 | 消除设置按钮卡顿 |
| P1 | 方案A-2: selector订阅 | 中 | 低 | 减少不必要重渲染 |
| P1 | 方案D-2: loadTables并并发 | 极小 | 低 | 减少初始化时间 |
| P1 | 方案B-3: domLayout改normal | 小 | 中 | 大数据集性能提升 |
| P2 | 方案D-1: 合并useSetting | 大 | 中 | 减少订阅开销 |
| P2 | 方案E: 虚拟列表 | 大 | 中 | 超大量结果集支持 |

---

## 六、关键代码位置索引

| 问题类型 | 文件 | 行号 |
|---------|------|------|
| queryStore 全量订阅 | `QueryResult.tsx` | 7 |
| queryStore 全量订阅 | `QueryResultItem.tsx` | 33 |
| queryStore 全量订阅 | `PanelManager.tsx` | 19 |
| queryStore 全量订阅 | `ExecutionBar.tsx` | 18 |
| queryStore 全量订阅 | `useQueryExecution.ts` | 20 |
| updateSqlQuery 触发全数组重建 | `queryStore.ts` | 65-69 |
| persist 持久化 sqlQueries (含 batchResults) | `queryStore.ts` | 130-138 |
| rowData 无 memo | `QueryResultItem.tsx` | 222-228 |
| columnDefs 无 memo | `QueryResultItem.tsx` | 229-232 |
| AgGridLazy key 含 displayRowCount | `QueryResultItem.tsx` | 219 |
| domLayout="autoHeight" | `QueryResultItem.tsx` | 220 |
| defaultColDef 全列 filter+sortable | `QueryResultItem.tsx` | 234-239 |
| animateRows 默认 true | `AgGridLazy.tsx` | 150 |
| 8 次 parseInt 无 memo | `QueryResultItem.tsx` | 110-127 |
| 30+ useSetting 订阅 | `SQLEditor.tsx` | 45-85 |
| loadTablesAndColumns 串行 N+1 | `SQLEditor.tsx` | 562-597 |
| 巨型 useEffect 注册快捷键 | `SQLEditor.tsx` | 316-515 |
| SettingsModal 总是渲染 | `AppWrapper.tsx` | 468 |
| SettingsModal 全量订阅 store | `SettingsModal.tsx` | 16-31 |
| SettingsModal hooks 在 early return 之前 | `SettingsModal.tsx` | 14-56, 541 |
| 打开模态框触发 loadSettings | `SettingsModal.tsx` | 116-123 |
| SettingsContext 重建 Map | `SettingsContext.tsx` | 27-35 |
| renderSettingItem 巨型函数 | `SettingsModal.tsx` | 167-532 |
| Workspace useEffect 依赖 sqlQueries+tabs | `Workspace.tsx` | 59-92 |
| PanelManager 传 SQLEditor 的 callback 无 useCallback | `PanelManager.tsx` | 194-197 |

---

## Open Questions
- [ ] 是否需要引入虚拟列表（react-window）来处理超大量结果集（100+个结果集）？
- [ ] persist 排除 batchResults 后，刷新页面是否需要重新执行SQL恢复结果？还是仅恢复SQL文本？
- [ ] SettingsModal 拆分后，是否需要保留 settings 的内存缓存避免每次打开都 loadSettings？
- [ ] domLayout 改为 normal 后，单个结果集的高度约束策略如何调整（minHeight/maxHeight）？

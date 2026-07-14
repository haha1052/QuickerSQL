# Tasks - SQL查询页面性能优化（暂不实施）

> 本任务列表为 spec.md 中优化方案的实施路线图，当前阶段仅做分析，不执行任何任务。

## 阶段一：P0 高ROI修复（预期解决80%卡顿）

- [ ] Task 1: QueryResultItem 的 rowData/columnDefs 加 useMemo
  - [ ] 1.1: 将 `displayRows.map(...)` 提取为 `useMemo(() => displayRows.map(...), [displayRows])`
  - [ ] 1.2: 将 `result.columns.map(...)` 提取为 `useMemo(() => result.columns.map(...), [result.columns])`
  - [ ] 1.3: 将8次 parseInt + slice 计算提取为 `useMemo`，依赖项为各 useSetting 返回值
  - 验证: 执行SQL后修改设置项，ag-grid 不再全量重绘
  - 依赖: 无

- [ ] Task 2: 移除 AgGridLazy key 中的 displayRowCount
  - [ ] 2.1: 将 `key={query-item-${index}-${result.columns.length}-${displayRowCount}}` 改为 `key={index}` 或基于 statement hash 的稳定key
  - 验证: 重新执行SQL返回不同行数时，ag-grid 不再销毁重建
  - 依赖: 无

- [ ] Task 3: queryStore persist 排除 batchResults
  - [ ] 3.1: 修改 `partialize` 函数，将 `sqlQueries` 映射为仅含 `id` 和 `sql` 文本的结构
  - [ ] 3.2: 添加 `merge` 函数，恢复时仅恢复 SQL 文本，不恢复结果数据
  - [ ] 3.3: 确保刷新页面后 SQL 文本能恢复，结果数据清空（显示"点击执行查询"提示）
  - 验证: 在编辑器中输入SQL时，localStorage 不再序列化 batchResults
  - 依赖: 无

- [ ] Task 4: SettingsModal 拆分为 Container + Content
  - [ ] 4.1: 创建 `SettingsModalContainer` 组件，仅根据 `showSettingsModal` 决定是否渲染 `SettingsModalContent`
  - [ ] 4.2: 将 SettingsModal 的所有 hooks 和逻辑移到 `SettingsModalContent`
  - [ ] 4.3: 确保关闭时 Content 组件完全卸载，不执行任何 hooks
  - [ ] 4.4: 修改 `AppWrapper.tsx` 使用 `SettingsModalContainer`
  - 验证: 关闭设置模态框后，settingsStore 变化不再触发 SettingsModal 重渲染
  - 依赖: 无

## 阶段二：P1 中等优先级优化

- [ ] Task 5: queryStore 消费者改用 selector 订阅
  - [ ] 5.1: `QueryResult.tsx` 改为 `useQueryStore(s => s.sqlQueries)` + `useQueryStore(s => s.activeQueryId)`
  - [ ] 5.2: `QueryResultItem.tsx` 改为 selector 订阅，仅订阅需要的字段
  - [ ] 5.3: `PanelManager.tsx` 改为 selector 订阅
  - [ ] 5.4: `ExecutionBar.tsx` 改为 selector 订阅
  - [ ] 5.5: `useQueryExecution.ts` 改为 selector 订阅
  - 验证: 修改 jumpToLine 等无关字段时，结果组件不再重渲染
  - 依赖: Task 1

- [ ] Task 6: SQLEditor loadTablesAndColumns 改并发
  - [ ] 6.1: 将 `for (const table of tables) { await ... }` 改为 `Promise.all(tables.map(t => ...))`
  - [ ] 6.2: 添加错误处理，单个表列加载失败不影响其他表
  - 验证: 切到SQL页面时表名和列名加载时间从 N*5ms 降为 ~5ms
  - 依赖: 无

- [ ] Task 7: ag-grid domLayout 改为 normal
  - [ ] 7.1: 将 `domLayout="autoHeight"` 改为 `domLayout="normal"`
  - [ ] 7.2: 为 tableContainer 设置明确的高度（来自设置的 result_min_height / result_max_height）
  - [ ] 7.3: 验证虚拟滚动是否正常工作
  - [ ] 7.4: 关闭 `animateRows`，设置 `animateRows={false}`
  - 验证: 1000行数据集渲染时间 < 1秒
  - 依赖: Task 1

## 阶段三：P2 深度优化

- [ ] Task 8: SQLEditor 合并 useSetting 订阅
  - [ ] 8.1: 创建 `useSettingsBatch(categories: string[])` hook，一次性订阅多个分类
  - [ ] 8.2: 将 SQLEditor 的 30+ 个 useSetting 替换为批量订阅
  - 验证: 设置变化时 SQLEditor 重渲染次数减少
  - 依赖: Task 5

- [ ] Task 9: QueryResultItem memo 化
  - [ ] 9.1: 用 `React.memo` 包裹 QueryResultItem
  - [ ] 9.2: 实现自定义比较函数，仅在 result 引用变化时重渲染
  - 验证: 兄弟结果集更新时，其他结果集不重渲染
  - 依赖: Task 1, Task 5

- [ ] Task 10: PanelManager callback useCallback 化
  - [ ] 10.1: 将 `onChange`、`onExecute` 等 callback 用 `useCallback` 包裹
  - [ ] 10.2: 验证 SQLEditor 的快捷键 useEffect 不再因 callback 引用变化而重注册
  - 依赖: 无

# Task Dependencies
- Task 5 依赖 Task 1
- Task 7 依赖 Task 1
- Task 8 依赖 Task 5
- Task 9 依赖 Task 1, Task 5
- Task 1, 2, 3, 4, 6, 10 可并行

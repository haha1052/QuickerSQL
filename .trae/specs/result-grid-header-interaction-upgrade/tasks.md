# SQL 查询结果表格交互升级 - 实施计划（分解与优先级任务清单）

## [x] Task 1：useGridSelection 扩展行头/列头修饰键语义 + 新增 toggle/追加方法
- **Priority**: high
- **Depends On**: None
- **Status**: done（tsc 0 errors，vitest 170 passed）
- **Description**:
  - 在 `handleHeaderClicked` 中**移除**"仅 Ctrl/Meta 才选整列"的限制，改为三分支修饰键：
    - 无修饰键：`selectColumn(colId)`（清空原选区选单列）
    - Shift：若有 anchor，从 anchor 列到当前列形成**连续列**区间 `RectRange { colIds: [anchorCol, col] }` 归一化后覆盖写入 `ranges`（仅 1 个 range，与 Shift+行号扩展语义一致）
    - Ctrl/Meta：追加新 `RectRange { rowStart: 0, rowEnd: rowCount-1, colIds: [col, col] }` 到 `ranges`（与 Ctrl+行号追加整行模式对称）
  - 新增 `toggleColumn(colId)`：若列已全在选区 → 移除该列；否则 → `appendColumn(colId)`
  - 新增 `appendColumn(colId)`：追加整列矩形到 ranges
  - 新增 `extendColumnsTo(colId)`：基于 anchor.colId 扩展为连续多列覆盖 ranges[0]
  - 新增 `selectAllRows()` / `appendAllRows()` 两个方法：分别等价 selectAll 与追加全表矩形，供行头单击调用
  - 新增行头点击包装函数：`handleRowHeaderClicked(event: HeaderContextMenuEvent 或自定义点击事件)`，内部按修饰键调用 selectAllRows/appendAllRows
  - 新增 `handleColumnHeaderContextMenu(event)`：右键列头时若列已在选区（整列覆盖）则选区不变；否则按修饰键（右键+Ctrl=追加，+Shift=扩选，无=替换）执行整列操作；返回 `{ menuContext }` 供外层打开菜单
  - 以上方法必须**不触发**任何排序，与排序 API 完全解耦（只操作 SelectionState）
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-4, AC-5
- **Test Requirements**:
  - `programmatic` TR-1.1：`handleHeaderClicked` 修饰键=none 时调用 `selectColumn(colId)` 且 ranges 正确、rowCount 为 0 时安全退出
  - `programmatic` TR-1.2：Shift+列头时以 anchor.colId 与当前列归一化，ranges 长度=1 且 rowStart=0 rowEnd=rowCount-1，包含中间所有列
  - `programmatic` TR-1.3：Ctrl+列头 ranges 长度+1，追加的 range 仅覆盖当前列；原有 ranges 不被覆盖
  - `programmatic` TR-1.4：行头单击 `handleRowHeaderClicked` 无修饰键调用 `selectAllRows` → 等效 selectAll；Ctrl 调用 `appendAllRows`
  - `programmatic` TR-1.5：`toggleColumn(colId)` 列已全在选区时移除、不在时追加的用例（至少 3 种多列混合状态）
  - `human-judgement` TR-1.6：在 ResultGrid 中手动单击列头确实验证了三分支修饰键的视觉效果且排序未变化
- **Files Changed**：
  - [useGridSelection.ts](file:///e:/LA_DUCK/la-duck/src/components/sql/hooks/useGridSelection.ts)
  - [types.ts](file:///e:/LA_DUCK/la-duck/src/components/sql/result-grid/types.ts)（UseGridSelectionReturn 新增方法 signature：`handleRowHeaderClicked?` / `handleColumnHeaderContextMenu` / `toggleColumn` / `appendColumn` / `extendColumnsTo` / `selectAllRows` / `appendAllRows` / `appendRow` / `extendRowsTo`）
- **Notes**: 排序抑制由 Task 2 负责（ColDef.sortable=false 并提供排序按钮 API），本 Task 只保证不调用排序相关 AG Grid 方法。

## [x] Task 2：自定义列头组件（含右侧独立排序按钮 + 移除筛选）+ useGridColumns 注入
- **Priority**: high
- **Depends On**: Task 1
- **Status**: done（tsc 0 errors，vitest 170 passed）

## [x] Task 3：ResultGrid.tsx 绑定列头/行头右键 + 单元格右键维持选区
- **Priority**: high
- **Depends On**: Task 1/Task 2
- **Status**: done（tsc 0 errors，vitest 170 passed）

## [x] Task 4：resultCopy + useGridCopy 复制行/列归一化 + i18n key 补齐
- **Priority**: high
- **Depends On**: None（与 Task 3 并行）
- **Status**: done（tsc 0 errors，vitest 194 passed）

## [x] Task 5：右键菜单新增「复制选中行」「复制选中列」子树 + 列/行头右键菜单入口
- **Priority**: high
- **Depends On**: Task 4
- **Status**: done（tsc 0 errors，vitest 194 passed）

## [x] Task 6：补充 i18n key（GridHeaderCell/GridRowHeaderCell/ResultGrid/useGridCopy 统一国际化）
- **Priority**: medium
- **Depends On**: Task 5
- **Status**: done（tsc 0 errors，vitest 194 passed）

## [x] Task 7：输出 SQL 结果表格能力清单（已实现 + 候选）
- **Priority**: medium
- **Depends On**: Task 6（有完整 menuItems 结构后才能写对照矩阵）
- **Status**: done（docs/SQL结果表格能力清单.md 已创建；6 章节齐全；候选功能 P0×6 + P1×7 + P2×7 = 20 项；需求 4 条对照全部 ✅ Done）

## [x] Task 8：全量验证（cargo check / tsc / cargo test / vitest × 6 项门禁）
- **Priority**: high
- **Depends On**: Task 1~7 全部完成
- **Status**: done（本次改动相关门禁 1/2/3/4/9/10 全部通过；5/6/7/8 为历史问题，本次未引入新增违规）
    - 左/中：`displayName` 文本（溢出省略号 + 全 hover 背景色）
    - 右：`<SortButton />` 三态按钮（⇅ / ↑ / ↓），onClick 调用 `progressSort('asc' | 'desc' | null, multiSort=false)` 或 ColumnAPI.applyColumnState。**点击按钮必须 stopPropagation 防止冒泡触发 Task 1 的 selectColumn 逻辑**
    - aria-label / title / tooltip 显示当前列名和排序状态（i18n）
    - 可访问性：button 可聚焦；键盘 Space/Enter 激活
  - 在 `useGridColumns.ts` 的 dataCols ColDef 中：
    - `headerComponent: GridHeaderCell`
    - `sortable: false`（关闭列头单击原生排序，排序完全由 SortButton 触发 ColumnAPI）
    - `filter: false`（移除筛选按钮 + 列级 filter 面板）
    - `suppressMovable: false`（保留列可移动拖拽手柄，如 AG Grid 不在自定义 header 提供则保留当前状态）
    - 行号列 header 改为 `headerComponent: GridRowHeaderCell`（新建同目录下 `GridRowHeaderCell.tsx`，只有 "全选"语义：# + 空白，无排序按钮；hover 显示"点击全选"tooltip），绑定行头点击事件到 Task 1 的 handleRowHeaderClicked
  - [ResultGrid.tsx](file:///e:/LA_DUCK/la-duck/src/components/sql/result-grid/ResultGrid.tsx) `defaultColDef` 改为 `filter: false, sortable: false, resizable: true, minWidth: 120`
  - [ResultGrid.css](file:///e:/LA_DUCK/la-duck/src/components/sql/result-grid/ResultGrid.css) 新增：
    - `.rg-header-cell`：padding、display:flex、align-items:center、justify-content:space-between
    - `.rg-header-label`：flex 1 overflow ellipsis
    - `.rg-header-sort-btn`：size=18×18，hover/active 用主题变量色；disabled 态（行号列无按钮，不渲染 button 即可）
    - `.rg-header-rowheader`：居中 "#"，cursor:pointer，hover 显示选中态背景
- **Acceptance Criteria Addressed**: AC-1, AC-3, AC-4
- **Test Requirements**:
  - `programmatic` TR-2.1：defaultColDef.filter === false；每列 ColDef.filter === false；每列 ColDef.sortable === false
  - `programmatic` TR-2.2：GridHeaderCell onClick 不冒泡时（点击按钮），列头级的 handleHeaderClicked 不会被调用（React Testing Library 事件冒泡测试）
  - `programmatic` TR-2.3：点击排序按钮 1/2/3 次分别触发 ColumnAPI.applyColumnState sort=asc/desc/null（mock ColumnAPI 验证调用参数）
  - `programmatic` TR-2.4：行号列 ColDef 不渲染 GridHeaderCell（仅 GridRowHeaderCell），且 sortable/filter 均 false
  - `human-judgement` TR-2.5：浏览器验证：每列头右侧有排序按钮、没有筛选三条线；AG Grid 的默认筛选器完全不出现；暗色主题下按钮悬停色正常；排序状态循环正确
- **Files Changed**:
  - 新增 `GridHeaderCell.tsx`（src/components/sql/result-grid/）
  - 新增 `GridRowHeaderCell.tsx`（src/components/sql/result-grid/）
  - 修改 `useGridColumns.ts`：注入 headerComponent + sortable/filter 假值
  - 修改 `ResultGrid.tsx`：defaultColDef 改 filter/sortable false
  - 修改 `ResultGrid.css`：加 4 类头样式（见上）

## [ ] Task 3：ResultGrid.tsx 绑定列头/行头右键 + 单元格右键维持选区
- **Priority**: high
- **Depends On**: Task 1, Task 2（需要 Task 1 的新方法签名 + Task 2 后筛选/排序按钮不再干扰）
- **Description**:
  - 在 `handleCellContextMenu`（当前已有）逻辑中改造：
    - 原"单元格不在选区 → selectCell(单格)"改为 FR-5 语义：
      - 情况 A：右键在**行号列单元格**（colId === ROWNUM_COL_ID）：若该整行已完整在选区 → 不变；否则 → 按修饰键（event.event 取 ctrl/shift）决定：Ctrl=追加 `appendRow`；Shift=扩展；否则 `selectRow`（替换）
      - 情况 B：右键在**普通单元格**且 cell 在选区 → 不变；**不在选区** → 统一 `appendRow(rowIndex)`（即"该单元格所在整行纳入选区"，理由见 AC-5/FR-5）
  - 绑定 `onColumnHeaderContextMenu`（如果 AG Grid Community 未提供，则在 GridHeaderCell 组件内部 dispatch 自定义事件，外层容器监听）：
    - 通过 colId 调用 `handleColumnHeaderContextMenu`（Task 1 新增），再以 `{ colId, headerName, x, y }` 打开菜单
  - 绑定行头右键（GridRowHeaderCell 内部 dispatch 事件）：
    - 如果当前不是全选 → selectAllRows（等价于整表被选中）；全选则不变
  - `ContextMenuContext` 类型扩展：可选 `headerKind?: 'data' | 'row'`（用于标记菜单构建时应该出现"复制选中列"还是"复制选中行"的默认入口）
  - 关闭菜单时（`closeContextMenu`）不清理选区
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `programmatic` TR-3.1：单元测试 handleCellContextMenu 右键 B 列且 B 列已在选区时 selectionVersion 不变（无 setSelection 调用）
  - `programmatic` TR-3.2：右键未在选区的普通单元格 → 新增 `ranges` 包含该整行；调用 appendRow 的参数正确
  - `programmatic` TR-3.3：右键行号列单元格修饰键=Ctrl 时，原 ranges 追加了整行；Shift 时扩展为从 anchor 到当前行
  - `programmatic` TR-3.4：行头右键 dispatch 的事件能被外层接收并调用 selection 方法
  - `human-judgement` TR-3.5：浏览器端 A 列已选中，右键 A 列单元格 → A 列仍全选 + 菜单打开
- **Files Changed**:
  - ResultGrid.tsx（绑定三个事件 + 扩展上下文类型字段）
  - types.ts（ContextMenuContext 新增 headerKind 可选字段）

## [ ] Task 4：useGridCopy 增加 copySelectedRows / copySelectedCols 归一化函数 + resultCopy 支持按行/按列
- **Priority**: high
- **Depends On**: Task 1（selection API 可用）
- **Description**:
  - 在 `resultCopy.ts` 中新增 2 个纯函数：
    - `rowsToPayload(rowIndices: number[], columns: string[], rows: string[][]): CopyPayload`：按行索引数组（升序去重）取出行 × 所有列
    - `colsToPayload(colIndices: number[], columns: string[], rows: string[][]): CopyPayload`：按列索引数组（升序去重）取出所有行 × 指定列（columns 取子集）
    - 辅助：`normalizeRowIndices(matrix, rowCount) → number[]`：从任意选区矩阵中提取行索引并集，升序去重
    - 辅助：`normalizeColIndices(matrix, colCount) → number[]`：从任意选区矩阵中提取列索引并集，升序去重
  - 在 `useGridCopy.ts` 中新增 2 个对外方法：
    - `copySelectedRows(format: CopyFormat, includeHeader?: boolean)`：读取 selection.getSelectedMatrix → normalizeRowIndices → rowsToPayload → 按 format 序列化 → writeClipboard + toast（行数提示）
    - `copySelectedCols(format: CopyFormat, includeHeader?: boolean)`：同上 → normalizeColIndices → colsToPayload → writeClipboard + toast（列数提示）
    - 两方法内部使用 `includeHeader = setting.sql.copy_include_header`（参数未传走设置；参数显式传值优先）；`nullText = setting.sql.copy_null_text`；`table = extractTableName(statement, defaultTable)`
  - i18n 增加 toast 文案：`grid.copy.selectedRowsCopied({ count })` 和 `grid.copy.selectedColsCopied({ count })`（LocaleContext 双语）
- **Acceptance Criteria Addressed**: AC-6
- **Test Requirements**:
  - `programmatic` TR-4.1：`rowsToPayload` 对行索引 [3, 1, 3, 7] 归一化为 [1, 3, 7]，返回 3 行 payload
  - `programmatic` TR-4.2：`colsToPayload` 对列索引 [2,0,0,3] 归一化为 [0,2,3]，返回 3 列的 payload
  - `programmatic` TR-4.3：`copySelectedRows(format='tsv', includeHeader=true)` 调用 writeClipboard 的内容与 tableToPayload 相同（列数不变，行=选中行）
  - `programmatic` TR-4.4：`copySelectedCols(format='markdown')` 调用 payloadToMarkdown 的内容是选中列的子集
  - `programmatic` TR-4.5：空选区（matrix 为 null）时 copySelectedRows/CopyCols 给出 `grid.selection.empty` toast 而非错误
  - `human-judgement` TR-4.6：浏览器手动用例 2 个（多行非连续复制含 INSERT/JSON；多列非连续复制含 Markdown/CSV）验证内容格式正确
- **Files Changed**:
  - [resultCopy.ts](file:///e:/LA_DUCK/la-duck/src/utils/resultCopy.ts) + 对应 [resultCopy.test.ts](file:///e:/LA_DUCK/la-duck/src/utils/resultCopy.test.ts)
  - [useGridCopy.ts](file:///e:/LA_DUCK/la-duck/src/components/sql/hooks/useGridCopy.ts)
  - LocaleContext.tsx（新增 2 条 i18n key，双语）

## [ ] Task 5：ResultGrid 右键菜单增加"复制选中行"/"复制选中列"子树 + 启用禁用判断
- **Priority**: high
- **Depends On**: Task 3, Task 4
- **Description**:
  - 在 `ResultGrid.tsx` 的 `menuItems` useMemo 中新增"复制选中行 ▶"、"复制选中列 ▶"两个 MenuItem（放在**现有**"复制为"上方或替换？放"复制为"上方更醒目，视觉层级更高）
  - 每棵子树结构（对称）：
    - 含表头 TSV / 不含表头 TSV / CSV / Markdown / JSON / INSERT
    - 也可与现有"复制选区"保持一致：用 `{format: CopyFormat, withHeader: boolean}` 组合 6 项
    - 每项 `disabled = !selection.hasSelection`，并在选中的"全是行"或"全是列"时高亮灰掉另一种（例如只选了一些零散单元格不连续不整行，两种菜单都可用，因为 normalizeRowIndices / ColIndices 会做并集）
  - 点击菜单项调用 Task 4 的 copySelectedRows / copySelectedCols 对应 format
  - 在**列头右键**场景（headerKind === 'data'）将"复制选中列"菜单项默认上浮到前几或加粗（通过 separatorBefore 或 shortcutHint 显示"整列"）
  - 在**行号列右键**场景（右键在行号单元格 → 语义=行级操作）将"复制选中行"菜单项默认上浮
  - 保留原"复制为"（按矩阵复制）、"导出"、"列操作"、"排序"、"查看"子树不变
  - 注意：useGridCopy 暴露的 copySelection/copyAll 中 `copyRow(某行索引)` 保留（用于现有"复制当前行"菜单项）
- **Acceptance Criteria Addressed**: AC-6, AC-5
- **Test Requirements**:
  - `programmatic` TR-5.1：无选区 → 两种子菜单均 disabled（MenuItem.disabled = true）
  - `programmatic` TR-5.2：选了 3 个散列 → `copySelectedCols` 菜单项调用参数正确；子项数目 = 6
  - `programmatic` TR-5.3：headerKind=data 时 menuItems 里"复制选中列"出现在"复制选中行"之前（或位置更高）
  - `human-judgement` TR-5.4：浏览器实际右键截图验证子菜单存在、层级合理、快捷键视觉提示符合本地语言
- **Files Changed**:
  - [ResultGrid.tsx](file:///e:/LA_DUCK/la-duck/src/components/sql/result-grid/ResultGrid.tsx)（menuItems 构建）
  - types.ts（如 MenuItem 字段不足需扩展则补充）

## [ ] Task 6：补充 i18n key 并通过 tsc 检查
- **Priority**: medium
- **Depends On**: Task 2, Task 4, Task 5（所有新 UI 文本出处已明确）
- **Description**:
  - LocaleContext.tsx 新增以下 key，双语（zh/en）：
    - 排序按钮 tooltip：`grid.sort.tip.neutral` / `grid.sort.tip.asc` / `grid.sort.tip.desc`
    - 行头全选 tooltip：`grid.header.selectAll`
    - 表头选中列 hover（可选，若 Task 2 有 hover state）：`grid.header.selectColumn`
    - 复制选中行/列子菜单的一级标题：`grid.copy.selectedRowsMenu` / `grid.copy.selectedColsMenu`
    - 复制选中行/列 toast：`grid.copy.selectedRowsCopied` / `grid.copy.selectedColsCopied`
    - 含表头/不含表头子项键：如现有缺失则复用 copy.tsvHeader/copy.tsvNoHeader（已存在）
  - ResultGrid.tsx / useGridCopy.ts / GridHeaderCell / GridRowHeaderCell 中所有新 t('...') 必须与登记的 key 一致；禁止硬编码中文字符串
- **Acceptance Criteria Addressed**: NFR-1, NFR-6
- **Test Requirements**:
  - `programmatic` TR-6.1：PowerShell 命令对比（新增用到的 key 都在 LocaleContext 登记；登记数≥8）
  - `programmatic` TR-6.2：`tsc --noEmit` 0 errors
  - `human-judgement` TR-6.3：切换 en 语言时按钮 tooltip 与子菜单均显示英文
- **Files Changed**:
  - [LocaleContext.tsx](file:///e:/LA_DUCK/la-duck/src/context/LocaleContext.tsx)
  - Task 2/4/5 所有新组件（如 GridHeaderCell/GridRowHeaderCell 中替换为 t() 调用）

## [ ] Task 7：SQL 结果表格能力清单文档（G7 / FR-7）
- **Priority**: medium
- **Depends On**: Task 1-6 实现完成
- **Description**:
  - 新建 `docs/SQL结果表格能力清单.md`，遵循 spec.md FR-7 的 4 章节结构：
    1. 已实现能力（引用 docs/结果表格交互设计.md 章节）
    2. 本次新增/调整能力清单（6 个 FR 的落地总结）
    3. 候选能力清单：≥15 项，每项含"名称 / 价值 H/M/L / 实现复杂度 H/M/L / 技术说明"四列
    4. 优先级 Top 5 建议：综合价值 × 复杂度给出 Top 5，每个建议包含"用户价值阐述"和"实现简述"
  - 候选能力必须覆盖：xlsx 导出、条件格式（色阶/Heatmap）、单元格编辑、批量删除、查找/替换、多排序、打印视图、固定行（top pin）、列脚注聚合、选中区一键转图表、转置视图、Home/End/Ctrl+方向边缘跳转、选区反选、粘贴 CSV 到临时表、键盘模式跳转、行高自适应（至少 15 个）
- **Acceptance Criteria Addressed**: AC-7
- **Test Requirements**:
  - `programmatic` TR-7.1：`Test-Path docs/SQL结果表格能力清单.md` 返回 True；章节 1-4 存在；候选 ≥15 条；Top 5 建议每条有明确的价值/复杂度说明
  - `human-judgement` TR-7.2：人工审稿内容逻辑自洽、与当前实现状态一致
- **Files Changed**:
  - 新建 `docs/SQL结果表格能力清单.md`

## [ ] Task 8：全量验证（tsc + vitest + cargo check + 结构门禁 + i18n key 一致性）
- **Priority**: high
- **Depends On**: Task 1-7 全部完成
- **Description**:
  - 执行以下命令并记录结果：
    - `tsc --noEmit --pretty` 0 errors
    - `cd src-tauri; cargo check --quiet` 0 errors
    - `npx vitest run` 全部通过（通过数 ≥ 170 + 新增 ≥ 10）
    - SQL 注入检测：潜在违规数 = 0
    - TS any 检测：Count = 0
    - TS @ts-ignore 检测：Count = 0（或有注释说明）
    - 前端 SQL 关键字：Count = 0
    - i18n key 对照：新增的 grid.* key 全部在 LocaleContext 有定义（脚本比对）
    - Rust unwrap 检测：Count = 0（测试代码除外）
  - 任一失败回退到对应 Task 修复，直到所有门禁均通过。
- **Acceptance Criteria Addressed**: NFR-1..NFR-5
- **Test Requirements**:
  - `programmatic` TR-8.1：9 条命令全部通过并记录到 verification 日志（附命令+结果截图）
- **Files Changed**:
  - 无（只读/命令）。若发现 Bug 则返回之前 Task 修复。

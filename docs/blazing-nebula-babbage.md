# SQL 查询结果表格（ResultGrid）交互增强 — 设计与实施计划

> 项目：LA-DUCK (QuickerSQL)，Tauri 2 + React 19 + TS + Zustand + AG Grid Community v32+ (ag-theme-alpine)
> 目标：解决"结果表格无法手动选择行列、右键功能贫乏"的核心痛点，分三期落地。
>
> **已确认决策（用户拍板）**：
> 1. 选区模式采用**自研矩形选区引擎**（方案 A），关闭原生文本选择；
> 2. 实施范围：**全部三期**（Phase 1 选区+菜单+复制引擎 → Phase 2 列操作+类型感知 → Phase 3 设置项+单元格详情+文档），按序连续实施，每期完成后 `tsc --noEmit` + `vitest run` 验证通过再进入下一期。

---

## 0. 现状核验结论（已读源码确认）

| 事实 | 位置 | 结论 |
|---|---|---|
| 结果渲染主组件 614 行、内联样式 | `src/components/sql/QueryResultItem.tsx` | 需拆分 + 迁移 CSS |
| 复制 hook 的过滤 bug | `src/components/sql/hooks/useQueryCopy.ts:38` | `typeof v !== 'number' || !String(v).startsWith('col')` 恒真，数值型 `id` 泄漏进复制内容 |
| 复制全部只复制 displayRows | `useQueryCopy.ts:79-100`（`api.forEachNode`） | 与 `useQueryExport.ts` 导出全量 `result.rows` 不一致 |
| grid key 含 totalPages 导致重建 | `QueryResultItem.tsx:293` | 翻页/设置变化整表重建，丢失列宽/滚动位置 |
| 无 getRowId | `QueryResultItem.tsx` | 同上 |
| 后端全字符串返回 | `src/types/index.ts:9-18` `rows: string[][] | null` | 前端做类型启发式（本期不动后端） |
| i18n 单文件双语 key-value | `src/context/LocaleContext.tsx`（zh ~L250 / en ~L1075 起） | 新 key 按现有扁平 `'a.b.c'` 命名 |
| 组件级 CSS 已有先例 | `src/components/query-history/QueryHistory.css` 等 3 个 | 新组件照此模式建 `.css` |
| 测试与源码同目录 | `src/utils/*.test.ts` | 新工具函数测试照此模式 |
| AgGridLazy 动态注册 AllCommunityModule | `src/components/common/AgGridLazy.tsx:56` | Community-only 约束确认，禁用 Enterprise API |

---

## 1. 选区模型设计（核心决策）

### 1.1 方案对比

| 方案 | 说明 | 评估 |
|---|---|---|
| A. 自研矩形选区引擎（事件驱动） | 监听 `onCellMouseDown/onCellMouseOver/onCellClicked + 修饰键`，自维护选区状态，`cellClassRules` 高亮 | 无授权成本；事件均为 Community API；工作量可控。**推荐** |
| B. 键盘焦点 + 活动单元格 | 仅用 `onCellFocused` 跟踪活动格，Shift+方向键扩选 | 无法支持鼠标拖选，体验差，仅作 A 的键盘补充 |
| C. 更换表格库（react-data-grid / glideapps 免费区间选） | qgrid 自带免费 range selection | 放弃 AgGrid 生态（现有懒加载、locale、图表联动全重写），迁移成本远超收益 |
| D. 升级 AG Grid Enterprise | 原生 range selection + context menu | 授权费 + 供应链约束，放弃 |

**决策：方案 A 为主体，吸收 B 的键盘能力**（方向键移动活动格、Shift+方向键扩选、Ctrl+C 复制），全部基于 AG Grid Community 公开事件 API。

### 1.2 数据结构（`src/components/sql/hooks/useGridSelection.ts`）

```ts
export interface CellPos { rowIndex: number; colId: string; }
export interface RectRange {
  rowStart: number; rowEnd: number;   // 已归一化 rowStart <= rowEnd（displayRows 索引）
  colIds: [string, string];           // 起止列 id（按当前列顺序），归一化 start 在前
}
export interface SelectionState {
  ranges: RectRange[];                // Ctrl 追加多个矩形
  anchor: CellPos | null;             // Shift 扩选锚点
  active: CellPos | null;             // 活动单元格（键盘导航焦点）
}
```

选区求值：`getSelectedMatrix()` 惰性把 `ranges[]` 展开为 `Map<rowIndex, Set<colId>>`（memoize，选区变化时失效），供复制引擎与高亮共用，避免渲染期重复计算。

### 1.3 hook 签名

```ts
export function useGridSelection(apiRef: MutableRefObject<GridApi | null>) {
  return {
    selection: SelectionState,             // state
    cellClassRules: CellClassRules,        // 直接挂到 defaultColDef
    handleCellMouseDown,                   // CellMouseDownEvent → 记录 anchor / 开启 drag
    handleCellMouseOver,                   // CellMouseOverEvent → drag 中更新最后一个 range
    handleCellClicked,                     // 修饰键语义分发（见 1.4）
    handleHeaderClicked,                   // Ctrl+表头 = 整列选区
    handleCellFocused,                     // 键盘活动格
    handleKeyDown,                         // 挂在包裹 div：方向键/Shift扩选/Ctrl+C/Escape
    selectAll, selectRow, selectColumn,    // 供右键菜单调用
    clearSelection,
    getSelectedMatrix,                     // () => Map<number, Set<string>> | null
    hasSelection,                          // boolean
  };
}
```

### 1.4 交互语义（与现有 rowSelection 的整合）

**决策：移除 ag-grid 的 `rowSelection="multiple"`，选区模型成为唯一真源**，行选中 = 全列矩形选区，消除双状态同步难题：

| 操作 | 行为 |
|---|---|
| 单击单元格 | 清空选区，设该格为 anchor+active |
| 鼠标拖选（mousedown 后 mouseover） | anchor 到当前格的矩形（drag 标志在 window mouseup 清除） |
| Shift+单击 | 从 anchor 到当前格扩为一个矩形 |
| Ctrl+单击 | 追加单格矩形（保留既有选区） |
| Ctrl+拖选 | 追加新矩形 |
| 单击行号列（#，pinned left） | 该行为全列矩形（= 行选中） |
| Shift+单击行号 | 连续多行矩形 |
| Ctrl+单击列头 | 整列矩形（所有可见行） |
| 方向键 | 移动 active（`api.ensureIndexVisible/ensureColumnVisible`） |
| Shift+方向键 | active 扩选 |
| Ctrl+A | 全选（表格容器获焦点时） |
| Ctrl+C | 复制选区（默认 TSV 含表头，由设置控制） |
| Escape | 清空选区 |
| 翻页 / 数据替换 | 清空选区（选区基于 displayRows 索引，跨页保留易错，明确放弃并写入文档） |

**关键开关**：自研选区启用后 `enableCellTextSelection` 改为 `false`（否则原生文本选择与拖选冲突）；提供右键菜单"原生文本选择模式"不做（YAGNI）。

### 1.5 高亮实现

- `defaultColDef.cellClassRules`：`'rg-cell-selected': (p) => matrix?.get(p.node.rowIndex)?.has(p.colDef.field)`。
- 选区变化只对受影响行 `api.refreshCells({ rowNodes, columns, force: true })`（新旧 range 行集合并集），1000 行上限场景性能无压力。
- active 单元格额外 class `rg-cell-active`（实线边框），`CopyPayload` 不含视觉状态。
- CSS（ResultGrid.css）：`--rg-selected-bg: color-mix(in srgb, var(--primary) 18%, transparent)` 之类主题变量派生，暗色主题自动适配。

### 1.6 性能护栏

- drag 中 mouseover 高频触发：对同一 range 边界去抖（requestAnimationFrame 合并 refreshCells）。
- `getRowId = (p) => String(p.data.id)` + 移除 key 中 `totalPages`（见 §6 bug 修复），避免整表重挂载导致选区 class 全量重算。

---

## 2. 右键菜单设计

### 2.1 组件：`src/components/sql/result-grid/ResultGridContextMenu.tsx`

- 保持自绘 fixed 定位菜单（现有模式抽取），新增**CSS hover 子菜单**（纯 CSS，无 JS hover 抖动问题）。
- 定位：`left/top = clientX/clientY`，用菜单实际尺寸（渲染后 ref 测量）clamp 到 `window.innerWidth/Height - 8px`。
- 关闭：document click / Escape / 滚动（grid wrapper onScroll）三通道，收敛到组件内部 useEffect。
- 菜单项数据驱动：

```ts
interface MenuItem {
  key: string;                       // i18n key
  icon?: string;
  shortcutHint?: string;             // 纯展示，如 'Ctrl+C'
  disabled?: boolean;
  danger?: boolean;
  separatorBefore?: boolean;
  children?: MenuItem[];             // 一级子菜单（不嵌套更深）
  onClick?: () => void;
}
```

### 2.2 菜单树（含启用条件）

```
复制为 ▶
  ├ 单元格值                     # activeCell 存在且值非 undefined
  ├ 选区 → TSV (含表头)          # hasSelection
  ├ 选区 → TSV (不含表头)        # hasSelection
  ├ 选区 → CSV                   # hasSelection
  ├ 选区 → Markdown              # hasSelection
  ├ 选区 → JSON                  # hasSelection
  ├ 选区 → INSERT 语句           # hasSelection
  ├ ───────
  ├ 当前行 (TSV)                 # contextRow 存在
  └ 全部数据 ▶
     ├ 当前显示（N 行，可能截断）  # displayRows.length > 0
     └ 完整结果（M 行）           # totalRows > displayRowCount 时才显示区分
导出 ▶
  ├ 全部 → CSV / JSON / Markdown  # 复用 useQueryExport 扩展
  └ 仅选区 → CSV / JSON          # hasSelection
列操作 ▶
  ├ 固定此列到左侧 / 取消固定     # 右键列上下文
  ├ 隐藏此列                     # 可见列数 > 1 才启用
  ├ 自动调整此列宽
  ├ 全部列自动列宽
  ├ 显示所有列                   # 存在隐藏列才启用
  └ 重置列布局                   # 有任一列被固定/隐藏/手调宽才启用
排序 ▶
  ├ 升序 / 降序 / 取消排序        # api.applyColumnState，Community API
查看
  └ 查看单元格内容…              # activeCell 存在；长文本弹窗（Phase 3）
```

### 2.3 i18n key 命名（扁平风格，zh/en 双份）

```
grid.copy.menu / grid.copy.cell / grid.copy.selection / grid.copy.tsvHeader
grid.copy.tsvNoHeader / grid.copy.csv / grid.copy.markdown / grid.copy.json
grid.copy.insert / grid.copy.currentRow / grid.copy.all / grid.copy.allDisplayed
grid.copy.allFull / grid.export.menu / grid.export.selection / grid.export.markdown
grid.column.menu / grid.column.pinLeft / grid.column.unpin / grid.column.hide
grid.column.autoSizeThis / grid.column.autoSizeAll / grid.column.showAll
grid.column.resetLayout / grid.sort.menu / grid.sort.asc / grid.sort.desc
grid.sort.clear / grid.view.cellDetail
grid.selection.empty / grid.selection.copied / grid.selection.copiedRows
```

---

## 3. 复制引擎设计（纯工具，`src/utils/resultCopy.ts`）

### 3.1 接口草图

```ts
export type CopyFormat = 'tsv' | 'csv' | 'markdown' | 'json' | 'insert';

/** 归一化数据包：任何来源（选区/行/全表）都先转成这个 */
export interface CopyPayload {
  columns: string[];              // 列名（按选区列顺序）
  rows: (string | null)[][];      // 行（按选区行顺序）；null 表示 NULL
}

export interface CopyOptions {
  includeHeader: boolean;         // 默认 true（读取设置 sql.copy_include_header）
  nullText: string;               // 复制时 null 的表示，默认 ''（可设 'NULL'）
}

// —— 选区/行 → CopyPayload（依赖 useGridSelection 的 matrix + 原始 rows）——
export function matrixToPayload(m: Map<number, Set<string>>,
                                columns: string[], rows: string[][]): CopyPayload;
export function rowToPayload(rowIndex: number, columns: string[], rows: string[][]): CopyPayload;
export function tableToPayload(rows: string[][], columns: string[]): CopyPayload;

// —— CopyPayload → 文本 ——
export function payloadToTSV(p: CopyPayload, o?: Partial<CopyOptions>): string;
export function payloadToCSV(p: CopyPayload, o?: Partial<CopyOptions>): string;   // RFC4180 转义
export function payloadToMarkdown(p: CopyPayload, o?: Partial<CopyOptions>): string;
export function payloadToJSON(p: CopyPayload, o?: Partial<CopyOptions>): string;  // [{col: val}] 数组对象
export function payloadToInsert(p: CopyPayload, opts: { table: string }): string; // INSERT INTO t (c1,c2) VALUES (...),(...);

// —— 剪贴板（带降级）——
export async function writeClipboard(text: string): Promise<boolean>;
// navigator.clipboard.writeText 优先；catch 时降级 textarea + document.execCommand('copy')
// （WebView2 非聚焦窗口时 Async API 偶发失败，execCommand 同步路径兜底）
```

### 3.2 规则要点

- TSV：单元格内 `\t`/`\n` 替换为空格（Excel 粘贴安全）。
- CSV：现有 `useQueryExport.ts:49-52` 的引号转义逻辑迁入此处，导出复用同一函数（消除双实现）。
- Markdown：`\|` 转义；空值 ` `；对齐行 `| --- |`。
- INSERT：字符串值 `'` 转义为 `''`，null → `NULL` 不加引号；数字列（见 §5 类型探测）不加引号；表名默认从 `result.statement` 用 `/from\s+([a-zA-Z_][\w.]*)/i` 提取，失败则 `my_table`。
- JSON：值为 null 保留 null，其余保持字符串（本期不做类型猜测，见 §5 说明）。

---

## 4. 列操作与行号列

- **行号列**：`{ colId: '__rownum__', headerName: '#', pinned: 'left', maxWidth: 56, sortable: false, filter: false, resizable: false, valueGetter: 'node.rowIndex + 1', cellClass: 'rg-rownum-cell' }`；复制引擎统一忽略该 colId（替代现在到处 filter `colId !== 'id'`）。
- **固定/隐藏/列宽**：不直接改 columnDefs state，改用 `api.setColumnsPinned / setColumnsVisible / autoSizeColumns`（均为 Community API）+ `onColumnResized/onColumnPinned/onColumnVisible` 事件把状态镜像到组件 state（供"重置布局"与菜单启用判断）。重置 = `api.resetColumnState()`。
- **列状态生命周期**：每个 QueryResultItem 实例内部 state，不持久化（结果集是易变的）；执行新 SQL 时随组件重建自然重置。

---

## 5. 类型感知渲染（前端启发式，后端不动）

### 5.1 探测：`src/utils/cellTypeDetection.ts`

```ts
export type CellType = 'integer' | 'float' | 'date' | 'datetime' | 'boolean' | 'string';
export interface ColumnTypeInfo { type: CellType; nullRatio: number; }
export function detectColumnTypes(rows: string[][], sampleSize = 100): ColumnTypeInfo[];
export function coerceCell(value: string, type: CellType): string | number | boolean | null;
```

- 抽样前 N 行（默认 100）：整列 100% 匹配 integer/float/ISO 日期(`YYYY-MM-DD`)/datetime/`true|false` 才判定为该类型，否则 string；空串按 NULL 处理。
- **NULL 语义（需在实现前实测确认，见 §10 开放问题）**：需查 Rust 端 `execute_sql` 对 SQL NULL 的序列化（空串还是 "NULL" 还是别的）；探测器和渲染统一按实测结果处理。

### 5.2 应用

- `rowData` 构建时 `coerceCell` → 数值列得到 number、布尔列得到 boolean，ag-grid 排序自动数值序（修掉字符串排序问题）。
- NULL 显示：值 `null` + `valueFormatter` 显示 `t('grid.nullText')`（默认 `NULL`），`cellClassRules` 加 `rg-cell-null`（灰色斜体），复制时仍按 CopyOptions.nullText。
- **JSON 复制例外**：§3.2 中 JSON 输出可用探测类型输出原生 number/boolean（实现时若复杂，回退为全字符串并在文档标注，两期均可）。

---

## 6. 一并修复的 Bug

1. **useQueryCopy:38 过滤恒真**：新 `useGridCopy` 以 CopyPayload 为中心，colId 白名单机制天然排除 `id`/`__rownum__`，旧文件 Phase 1 删除。
2. **grid key 重建**：`QueryResultItem.tsx:293` key 改为 `result-${index}`（结果数组顺序稳定）；加 `getRowId={p => String(p.data.id)}`；`paginationPageSize` 变化用 `api.paginationSetPageSize`（useEffect）而非 key 重建。
3. **复制范围不一致**：右键"全部数据"提供 当前显示/完整结果 两个入口（§2.2），导出继续走全量并在 UI 文案标注"完整结果 (M 行)"。

---

## 7. 组件重构

### 7.1 新结构

```
src/components/sql/
  QueryResultItem.tsx          # 瘦身 ~280 行：头部徽章/错误/EXPLAIN/图表切换/受影响行，样式全部迁出
  result-grid/
    ResultGrid.tsx             # ~380 行：AgGridLazy 封装 + 装配 selection/columns/copy/contextMenu
    ResultGrid.css             # ~220 行：容器/选区高亮/active 边框/NULL 样式/右键菜单/子菜单
    ResultGridContextMenu.tsx  # ~200 行：数据驱动菜单 + 定位 clamp + 关闭逻辑
    types.ts                   # ~40 行：SelectionState/RectRange/MenuItem 等导出
  hooks/
    useGridSelection.ts        # ~220 行（§1.2-1.5）
    useGridCopy.ts             # ~150 行：取代 useQueryCopy；组装 CopyPayload + writeClipboard + toast
    useGridColumns.ts          # ~130 行：行号列/固定/隐藏/自动宽/重置（Phase 2）
useQueryCopy.ts / useQueryExport.ts → Phase 1 / Phase 2 末删除（导出逻辑并入 useGridCopy + resultCopy）
src/utils/
  resultCopy.ts (+.test.ts)    # ~260 / ~300 行
  cellTypeDetection.ts (+.test.ts) # ~120 / ~150 行（Phase 2）
```

### 7.2 ResultGrid props

```ts
interface ResultGridProps {
  columns: string[];
  rows: string[][];               // displayRows（截断后）
  totalRows: number;              // 用于"完整结果"复制判断
  fullRows: string[][];           // 完整 rows 引用（复制全量用，不渲染）
  statement: string;              // INSERT 表名提取
  pageSize: number;
  paginated: boolean;
  rowHeightMode: { fontSizeNum: number };  // 高度计算留在父组件或迁入，二选一：迁入 ResultGrid
  onSelectionChange?: (has: boolean) => void;
}
```

---

## 8. 分期实施计划

### Phase 1 — 核心选区 + 右键菜单 + 复制引擎 + 重构基座（~1300 行新增/修改）

**创建**：`src/utils/resultCopy.ts`、`src/utils/resultCopy.test.ts`、`src/components/sql/result-grid/{ResultGrid.tsx, ResultGrid.css, ResultGridContextMenu.tsx, types.ts}`、`src/components/sql/hooks/useGridSelection.ts`、`useGridCopy.ts`
**修改**：`QueryResultItem.tsx`（表格分支替换为 `<ResultGrid>`，样式迁出）、`LocaleContext.tsx`（新增 grid.* 双语 key）、`src/components/sql/hooks/index.ts`
**删除**：`useQueryCopy.ts`
**范围**：矩形/多矩形选区、拖选、修饰键、键盘导航（方向键/Shift/Ctrl+A/Ctrl+C/Escape）、菜单"复制为"整棵子树（含 INSERT）、单元格值/当前行/全部（显示 vs 完整）、`enableCellTextSelection=false`、§6 bug 1/2、execCommand 降级。
**验收**：
- `npx tsc --noEmit` 0 错误；`npx vitest run` 全绿（新增 resultCopy 测试 ≥ 25 case：5 格式 × 边界：空表头/含引号逗号换行/NULL/多 range 非连续/空选区）。
- 手动清单：拖选高亮连续、Ctrl 追加两块、Shift 扩选、行号列点选整行、Ctrl+表头选列、Ctrl+C 得 TSV、Excel/VSCode 粘贴验证、翻页后选区清空、窗口边缘右键菜单不溢出。

### Phase 2 — 列操作 + 行号列 + 类型感知 + NULL 显示（~600 行）

**创建**：`useGridColumns.ts`、`src/utils/cellTypeDetection.ts`(+test)
**修改**：`ResultGrid.tsx`（接入列 hook + valueFormatter/cellClassRules + coerceCell rowData）、`ResultGridContextMenu.tsx`（列操作/排序子树）、`useQueryExport` 删除并入统一导出（新增 Markdown 导出、仅选区导出）。
**验收**：tsc/vitest（cellTypeDetection ≥ 15 case）；手动：数字列排序为数值序、NULL 灰斜体、固定列横向滚动不消失、隐藏→显示所有→重置闭环、INSERT 中数字不加引号。

### Phase 3 — 打磨：设置项、单元格详情、文档（~350 行）

**修改**：
- 设置（SettingsContext 默认值 + 设置页 + i18n）：`sql.copy_include_header`(true)、`sql.copy_null_text`('')、`sql.null_display`('NULL')、`sql.grid_row_numbers`(true)、`sql.insert_default_table`('my_table')。
- `ResultGrid`：单元格详情弹窗（复用 common Modal，只读 pre + 复制按钮，长文本/JSON 美化）。
- `docs/`：新增《结果表格交互设计》文档（本计划落地版）。
**验收**：tsc/vitest；手动走查设置变更即时生效、双语完整无 key 裸奔（临时脚本或肉眼 grep）。

---

## 9. 风险与开放问题

1. **NULL 序列化格式未实测**（最高优先级开放问题）：Rust `execute_sql` 把 SQL NULL 变成什么？实现 Phase 2 前先用 DuckDB `SELECT NULL` 实测，结果写入 cellTypeDetection 的判定常量。
2. **拖选与分页**：选区基于行索引，翻页清空是产品决策（已定），需在 UX 上无提示地接受；若用户反馈强烈，Phase 3 再评估"按 (pageIndex,rowIndex) 记录"的增强。
3. **clipboard 权限**：WebView2 中 `navigator.clipboard` 在窗口失焦时可能 reject —— execCommand 降级已覆盖；仍需在 Windows 实测打包版。
4. **刷新性能**：1000 行 × cellClassRules 每格回调；rFrame 合批 + 只刷受影响行已设计，若仍卡（列极多场景 >50 列），备选：只对 range 边界行刷 + CSS `data-*` 整行标类。
5. **enableCellTextSelection=false 的回归**：部分用户依赖原生三击选段落文本——右键菜单"复制单元格值"已覆盖 90% 场景，剩余在 Phase 3 收集反馈。
6. **ChartPanel/QueryPlanTree 共用 displayRows**：重构仅动表格分支，图表与 EXPLAIN 分支 props 不变，无回归面。
7. **useQueryCopy 删除的引用面**：已确认仅 `QueryResultItem.tsx` 引用（grep 验证过），删除安全；`useQueryExport` 的 `openExportMenu/closeExportMenu` 疑似死代码，Phase 2 删除时一并 grep 确认。

---

## 10. 关键文件清单（绝对路径）

修改：
- `e:\LA_DUCK\la-duck\src\components\sql\QueryResultItem.tsx`
- `e:\LA_DUCK\la-duck\src\context\LocaleContext.tsx`
- `e:\LA_DUCK\la-duck\src\components\sql\hooks\index.ts`
- `e:\LA_DUCK\la-duck\src\context\SettingsContext.tsx`（Phase 3）

创建：
- `e:\LA_DUCK\la-duck\src\utils\resultCopy.ts` / `resultCopy.test.ts`
- `e:\LA_DUCK\la-duck\src\utils\cellTypeDetection.ts` / `.test.ts`（Phase 2）
- `e:\LA_DUCK\la-duck\src\components\sql\result-grid\ResultGrid.tsx` / `ResultGrid.css` / `ResultGridContextMenu.tsx` / `types.ts`
- `e:\LA_DUCK\la-duck\src\components\sql\hooks\useGridSelection.ts` / `useGridCopy.ts` / `useGridColumns.ts`（Phase 2）

删除（分期）：
- `e:\LA_DUCK\la-duck\src\components\sql\hooks\useQueryCopy.ts`（Phase 1）
- `e:\LA_DUCK\la-duck\src\components\sql\hooks\useQueryExport.ts`（Phase 2，逻辑并入）

验证命令：`npx tsc --noEmit`、`npx vitest run`（项目根目录）。

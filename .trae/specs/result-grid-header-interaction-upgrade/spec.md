# SQL 查询结果表格交互升级 - Product Requirement Document

## Overview
- **Summary**：升级 SQL 查询结果表格的表头、列/行选择与右键交互能力，包括：① 单击列头不再触发排序（排序改为列头右侧独立按钮）② 移除筛选按钮 ③ 支持通过列头/行头（表头+行号列头部）直接选择多列多行（普通单击 + Shift 扩选 + Ctrl 追加）④ 选中整行/整列后右键保持选区不丢失，新增"复制选中行（可选含表头）"和"复制选中列"菜单 ⑤ 最终形成一份"SQL 执行结果表格还缺什么"的能力清单，用于后续迭代。
- **Purpose**：当前交互存在三大痛点——（a）用户想单击列头选中列却被排序打断（不直观且与用户截图中 Excel-like 期望不符）（b）排序与筛选图标堆在列头视觉干扰（c）多选行/多选列的操作不直观（需要 Ctrl+列头、且列头选中与排序冲突）（d）选整行后右键菜单缺失以"行/列"为单位的复制快捷入口。
- **Target Users**：日常使用 SQL 查询分析数据的用户（数据分析师、产品经理、研发人员），尤其习惯于 Excel / DBeaver / 飞书多维表格等"表头选列、行号选行"交互模式的用户。

## Goals
- G1：普通单击列头 → 选中整列（不再触发排序）；Shift+单击列头 → 从已选锚点连续扩选多列；Ctrl+单击列头 → 追加选中列。
- G2：普通单击行号列表头（"#" 区域）→ 选中所有行；Shift+单击行头 → 扩展多行；Ctrl+单击行头 → 追加整行/多行。
- G3：排序按钮以独立小按钮形式出现在每个列头**右侧**（替代原筛选按钮位置），循环：无 → 升序 → 降序 → 无；点击排序按钮**不改变**当前列选区。
- G4：完全移除列头的筛选功能（AG Grid 的 Filter 按钮及其面板）。
- G5：右键（无论右键在单元格、行号单元格、列头、行头）时，如果右键位置已存在于选区/行头/列头范围内，**不改变原有选区**；否则将新位置纳入选区（如"整行/整列级"的按需选整行或整列）。
- G6：右键菜单新增"复制选中行（含表头）/（不含表头）"与"复制选中列（含表头）/（不含表头）"两个一级子菜单入口，支持当前所有复制格式（TSV/CSV/Markdown/JSON/INSERT），并使用已设置的 null 文本与 insert_default_table。
- G7：形成一份"SQL 执行结果表格能力清单"文档，标注已实现 / 本次新增 / 未来候选，并给出每个候选的复杂度 + 价值等级，用于产品决策。

## Non-Goals (Out of Scope)
- ❌ **不**做新的筛选功能（如替换筛选按钮为自定义筛选面板）；本 spec 仅要求移除 AG Grid 原生筛选按钮。
- ❌ **不**修改分页、行数据截断、图表切换、EXPLAIN 等 QueryResultItem 其他功能。
- ❌ **不**扩展到 SqlResultGrid（SqlQueryPage.tsx 中的简化版表格），仅改造 [ResultGrid.tsx](file:///e:/LA_DUCK/la-duck/src/components/sql/result-grid/ResultGrid.tsx) 主组件。
- ❌ **不**引入 AG Grid Enterprise 功能（Column Menu、SetFilter 等）。
- ❌ **不**引入持久化列宽、列顺序、排序状态（与现有策略一致）。
- ❌ **不**新增后端设置项（本 spec 所有开关均使用 Phase 3 已有的 sql.copy_include_header / sql.copy_null_text）。

## Background & Context

### 现状（基于真实代码）
- 选区引擎：自研 [useGridSelection.ts](file:///e:/LA_DUCK/la-duck/src/components/sql/hooks/useGridSelection.ts)，提供 selectRow / selectColumn / selectAll 等方法（已实现），但暴露给 UI 的入口有限：
  - 选整列入口：仅 `Ctrl + 单击列头`（[第 416-430 行](file:///e:/LA_DUCK/la-duck/src/components/sql/hooks/useGridSelection.ts#L416-430)），会同时触发 AG Grid 默认排序（**已知冲突**）。
  - 选整行入口：仅行号列**单元格**单击（[第 249-295 行](file:///e:/LA_DUCK/la-duck/src/components/sql/hooks/useGridSelection.ts#L249-295)），行号列表头 "#" 显式跳过。
  - 行号列的头、数据列头均未支持"普通单击选整列/Shift扩选/Ctrl追加"。
- 排序/筛选按钮：[useGridColumns.ts](file:///e:/LA_DUCK/la-duck/src/components/sql/hooks/useGridColumns.ts) 定义的 ColDef 未设 `filter: false`、[ResultGrid.tsx](file:///e:/LA_DUCK/la-duck/src/components/sql/result-grid/ResultGrid.tsx) `defaultColDef.sortable=true, filter=true`（[第 133-141 行](file:///e:/LA_DUCK/la-duck/src/components/sql/result-grid/ResultGrid.tsx#L133-141)），导致每个列头右侧出现 AG Grid 默认排序箭头（排序后才显示）和筛选按钮（三条线 icon，用户截图中可见）。
- 右键菜单：[ResultGrid.tsx](file:///e:/LA_DUCK/la-duck/src/components/sql/result-grid/ResultGrid.tsx) 的 `handleCellContextMenu`（[第 163-188 行](file:///e:/LA_DUCK/la-duck/src/components/sql/result-grid/ResultGrid.tsx#L163-188)）仅绑定到单元格级别的 `onCellContextMenu`，且逻辑是"右键格不在选区 → selectCell(单格)"导致整行/整列选中被抹掉；**没有绑定** `onColumnHeaderContextMenu`（列头右键）和行头右键。
- 复制引擎：[useGridCopy.ts](file:///e:/LA_DUCK/la-duck/src/components/sql/hooks/useGridCopy.ts) 已提供 `copyRow` / `copySelection` / `copyAll`；缺少"以行为单位的多整行复制"和"以列为单位的多整列复制"方法；[resultCopy.ts](file:///e:/LA_DUCK/la-duck/src/utils/resultCopy.ts) 的 `tableToPayload`/`rowToPayload` 已有基础，新增 row 索引数组 / col 索引数组的归一化方法即可。
- 用户截图（SQL 执行结果界面）：截图中的列头右侧均带有"三条横线 + 箭头"组合（即筛选+排序），与本 spec 要求的"独立排序按钮 + 移除筛选"直接矛盾。

### 架构约束
- 遵循 [architecture.md](file:///e:/LA_DUCK/la-duck/.trae/rules/architecture.md) 前端三层约束：组件层禁直接 invoke，状态改动放 Store/Hook。
- 遵循 [CLAUDE.local.md](file:///e:/LA_DUCK/la-duck/.trae/rules/CLAUDE.local.md) §4.2 TS any / @ts-ignore 零容忍。
- 本 spec 涉及模块目录仅限 `src/components/sql/`、`src/utils/`、`src/types/`、`src/context/`（i18n 新 key），不影响 `src-tauri/`（除 G7 文档外）。

## Functional Requirements

### FR-1：表头单击行为重写
- 普通单击数据列头 → `selectColumn(colId)`（清空原选区，选中整列，设为 anchor + active）。
- Shift+单击数据列头 → 从 anchor 列到当前列的**连续多列**矩形选区（与 Shift+行号选多行语义对称）。
- Ctrl+单击数据列头 → 追加整列矩形到 `ranges` 数组（多块非连续列）。
- 上述所有操作**阻止** AG Grid 默认排序触发（通过在列定义关闭列头单击排序通道，仅保留排序按钮触发）。

### FR-2：行头单击行为扩展
- 行号列头部（`#` header）普通单击 → `selectAll()` 选中全部行和列。
- Shift+单击行头 → 如果存在 anchor，选择从 anchor 行到行头所暗示的"全部列"的扩展（即相当于 Shift+行号单元格到达的最大边界，实际语义：扩展到整表）。
- Ctrl+单击行头 → 追加"整表"（所有行 × 所有列）；如果已存在选区则追加矩形覆盖全表（等价于 Ctrl+A 追加）。
- 行号列单元格行为保持现状：单击选整行 / Shift 连续多行 / Ctrl 追加整行。

### FR-3：独立排序按钮（替代筛选按钮位置）
- 每个数据列头**右侧**有一个独立的排序图标按钮（视觉上与列头主区域可区分），三态循环：无排序 → 升序 ↑ → 降序 ↓ → 无排序。
- 点击按钮时：
  - 仅修改当前列的排序状态，不触发列头点击的选区逻辑。
  - 不改变当前选区（anchor/ranges 保持原样）。
- 未排序列的按钮显示"中性"图标（如 ⇅ 或三条横线排序图标）；升序显示 ↑；降序显示 ↓；非当前排序列的按钮点击将该列设为**唯一**排序列（单列排序，不启用 multiSort）。
- 行号列**不**显示排序按钮（与现 `sortable: false` 一致）。

### FR-4：移除筛选
- AG Grid 的筛选按钮（列头 filter icon + 列级 filter 面板）全部移除：
  - `defaultColDef.filter = false` 作为全局默认。
  - 所有数据列 ColDef 内不设单独 `filter`，或显式 `filter: false`。
  - 右键菜单也不再展示"筛选"相关入口（目前原本就没有，保持）。

### FR-5：右键保持选区
- 右键（单元格级 / 行号单元格级 / 列头级 / 行头级）分类处理：
  - **单元格右键**（非行号列）：如果该单元格已在选区 → 选区不变；否则将该单元格的"整行"纳入选区（用户大概率此时想以行级操作复制）。
  - **行号单元格右键**：如果该整行已被覆盖 → 选区不变；否则选中该行（清空原选区或 Ctrl+追加按修饰键决定：无修饰=清空并选该行；Ctrl=追加；Shift=扩展）。
  - **列头右键**：如果该整列已被覆盖 → 选区不变；否则选中该整列（修饰键同上：无修饰=清空并选整列；Ctrl=追加；Shift=扩选）。
  - **行号列表头右键**：全选（如果已全选则不变）。
- 绑定 `onColumnHeaderContextMenu`、`onHeaderContextMenu` 两个 AG Grid 事件，将它们与选区维持逻辑关联。
- 右键菜单的显示位置仍沿用现有 ResultGridContextMenu clamp 逻辑（视口内定位）。

### FR-6：复制选中行/复制选中列菜单
- 新增两个一级子菜单：
  - **复制选中行 ▶**：子项 = 单元格值 / TSV含表头 / TSV不含表头 / CSV / Markdown / JSON / INSERT。作用：仅取**选区覆盖到的行集合**（行索引并集，去重排序）、**所有列**（或仅选区覆盖的列？定义："复制选中行"= 选中的那些行 × 所有可见列；"复制选中列"= 选中的那些列 × 所有可见行；若用户既有选中行又有选中列的交叉，则两种入口各自的含义不冲突）。
  - **复制选中列 ▶**：子项 = 同上 6 种格式。作用：取**选区覆盖到的列集合**（列索引并集，去重排序）× **所有行**。
- 两种子菜单的"含/不含表头"默认由 sql.copy_include_header 设置决定；展示在菜单上为两个独立子项（和现"复制选区→TSV含表头 / TSV不含表头"模式一致）。
- **复制选中行**在以下情况禁用（灰）：选区不含任何行（ranges.length=0）；等价于 `hasSelection=false`。
- **复制选中列**在以下情况禁用：选区不含任何整列（即没有 `range.rowStart=0 && range.rowEnd=rowCount-1` 的全覆盖行区间，不过本 spec 放宽：只要 `hasSelection` 有就启用，由归一化函数内部按"列并集"裁剪）。

### FR-7：SQL 执行结果能力清单文档
- 新建 `docs/` 下文档（如 `SQL结果表格能力清单.md`），章节：
  1. 已实现能力（对照 [结果表格交互设计.md](file:///e:/LA_DUCK/la-duck/docs/结果表格交互设计.md) + 本次新增）
  2. 本次新增/调整能力清单
  3. 候选能力清单（每项含：名称 / 价值 H/M/L / 实现复杂度 H/M/L / 技术说明），至少包含以下候选：
     - 冻结顶部表头（sticky header：当前已支持，验证）
     - 列宽拖拽（当前已支持，验证）
     - 行高自适应（当前未实现）
     - 合并单元格 / 分组视图
     - 列拖拽重排（当前未显式配置）
     - 导出为 Excel .xlsx（当前仅 CSV/JSON/MD）
     - 条件格式 / 色阶（Heatmap）
     - 单元格内编辑
     - 批量选择删除行
     - 查找/替换（Ctrl+F/Ctrl+H）
     - 转置视图（行/列翻转）
     - 多排序（多列组合排序）
     - 打印视图 / 打印样式
     - 固定行（top pin rows）
     - 列内聚合显示（SUM/AVG/COUNT 在脚注行）
     - 图表侧栏：选中区一键转图表
     - 键盘模式下跳转到选区边缘（Home/End/Ctrl+方向）
     - 选区反选
     - 复制/粘贴到其他应用的格式兼容（Word / 飞书表格）
     - 导入粘贴的 CSV 到临时表
     - 其他候选……
  4. 优先级建议：综合价值/复杂度给出 Top 5 建议，供产品决策。

## Non-Functional Requirements
- **NFR-1**：`tsc --noEmit` 0 errors。
- **NFR-2**：`cargo check --quiet` 0 errors（本 spec 不涉及 Rust 编译，仅保持基线）。
- **NFR-3**：`npx vitest run` 测试通过数 ≥ 当前（170），且新增功能对应的用例数量 ≥ 10（新增的行列选择归一化、整行整列复制、修饰键判定等纯函数）。
- **NFR-4**：零新增 `any` 类型、零新增 `@ts-ignore`、零新增未注释的 `console.log`（CLAUDE.local.md §4.2）。
- **NFR-5**：零新增前端 SQL 关键字拼接（SELECT/INSERT/UPDATE/DELETE，security.md §2）。
- **NFR-6**：排序按钮交互对视觉焦点可访问（aria-label + i18n 文本，至少含"升序"/"降序"/"无排序"）。
- **NFR-7**：列头+排序按钮的 hover/按下/禁用状态必须有视觉反馈（CSS 主题变量适配亮/暗）。

## Constraints
- **Technical**：
  - 前端：React 18 + TypeScript 5 + ag-grid-community v32（AllCommunityModule，无 Enterprise）。
  - 自定义 HeaderComponent 的约束：AG Grid Community 支持 `headerComponent` + `headerComponentParams` 通过 ColDef 传入自定义 React 组件，可在 React 组件渲染 `<SortButton />` 并监听 `onSortRequested` 通过 `columnApi.applyColumnState` 实现排序循环。自定义 header 组件必须兼容 `@ag-grid-community/react` 的 `IHeaderParams`（含 `displayName`、`column`、`api`、`columnApi`、`progressSort` 等）。
  - 禁止使用 AG Grid 的 `columnMenu`、`setFilter`、`multiColumnSort` 等 Enterprise 功能。
  - 禁止修改 `src-tauri/` 以外的规则文件。
- **Business**：本次迭代不涉及付费模块。
- **Dependencies**：不新增 npm 依赖（排序按钮用现有 @radix-ui 图标；若项目未内置 icons 则用 inline SVG 或 Unicode 字符）。

## Assumptions
- A1：AG Grid Community v32 的 `headerComponent` 可替换列头渲染且不会破坏 pinned 列、列宽拖拽、列 resize 行为。若测试发现不可行，则降级为"CSS-only 方案"：用 `headerClass` + `::after` 渲染排序按钮绝对定位到右侧，并用 `onColumnHeaderClicked` 的 target 判断区分"点击列头主体" vs "点击排序按钮区域"。
- A2：`onColumnHeaderContextMenu` 和 `onHeaderContextMenu` 在 v32 Community 版可正常触发列头/全头级右键。若不可用，降级为在自定义 headerComponent 内部 `onContextMenu` 主动 dispatch 自定义事件到外层容器。
- A3：本 spec FR-1 的"阻止排序触发"只需在列头级别将 `sortable` 关掉（通过 ColumnAPI 的 applyColumnState 或列定义不设 sortable，仅由排序按钮调用 ColumnAPI 修改排序）。若 AG Grid 仍在表头点击排序，则改用 `suppressHeaderKeyboardEvent` + `onColumnHeaderClicked` 阻止冒泡。
- A4：用户对"复制选中行 × 所有列 / 复制选中列 × 所有行"的定义理解与 spec 一致。若与用户预期不符，将在 Open Questions 中单独勾选。

## Acceptance Criteria

### AC-1：列头单击选列、不触发排序
- **Given**：SQL 已执行、表格有 ≥2 列 ≥3 行、当前无选区、当前无任何列处于排序状态。
- **When**：用户用鼠标左键单击任意非行号列列头的**主体区域**（非排序按钮位置）。
- **Then**：(a) 该整列所有数据单元格都高亮显示（rg-cell-selected）；(b) AG Grid 排序箭头/排序状态**不发生变化**（保持无排序）；(c) `hasSelection=true`。
- **Verification**：`human-judgment`（手动在应用中观察）+ `programmatic`（单元测试：handleHeaderClicked 修饰键=none 时调用 selectColumn；排序 API 调用次数=0）。

### AC-2：列头 Shift/Ctrl 修饰键行为
- **Given**：已单击列 A（anchor=A），当前只有列 A 被选中。
- **When**：用户 Shift+单击 D 列头。
- **Then**：(a) 选中 A、B、C、D 四列（连续矩形）；(b) 排序状态不变。
- **Given**：已选中列 A。
- **When**：用户 Ctrl+单击列 C 列头。
- **Then**：列 A 和列 C 同时被选中（非连续两块）；排序不变。
- **Verification**：`programmatic`（useGridSelection 中 handleHeaderClicked 修饰键分支的单元测试）+ `human-judgment`。

### AC-3：独立排序按钮替代筛选按钮
- **Given**：表格展示，每列头都有可见的"排序按钮"元素在右侧。
- **When**：用户在未排序的 X 列头点击排序按钮 1 次。
- **Then**：X 列变为升序（asc），按钮显示 ↑；其他列排序不变；列选区保持原样。
- **When**：同一按钮点击第 2 次。
- **Then**：X 列变为降序（desc），按钮显示 ↓。
- **When**：第 3 次点击。
- **Then**：X 列排序状态变为 null（不排序），按钮回到中性态 ⇅。
- **When**：检查 DOM/截图。
- **Then**：AG Grid 默认的筛选"三条线"按钮不存在。
- **Verification**：`human-judgment` + `programmatic`（defaultColDef.filter === false、ColDef.sortable === false 且排序按钮 onClick 会调用 applyColumnState）。

### AC-4：行号列表头（行头）选择
- **Given**：表格有 ≥3 行、当前无选区。
- **When**：用户单击行号列头部 `#`。
- **Then**：全选所有行 × 所有可见列（等价 Ctrl+A）。
- **When**：用户 Ctrl+单击 `#` 头（已有其他选区）。
- **Then**：追加全选矩形（最终效果 = 全选）。
- **Verification**：`human-judgment` + `programmatic`（新增 handleRowHeaderClicked 的分支测试）。

### AC-5：右键保留选区
- **Given**：已选整列 B。
- **When**：用户在 B 列的任意数据单元格上右键。
- **Then**：(a) 整列 B 的选区**保持不变**；(b) 右键菜单正常弹出并包含复制/导出等入口。
- **Given**：已选整行（行号列单击过第 2 行）。
- **When**：在第 2 行的任意单元格右键。
- **Then**：整行选区保持不变。
- **Given**：当前选区仅列 A，用户在列 C（非选区列）的列头空白处右键。
- **Then**：选区改为选中整列 C；右键菜单展示复制选中列菜单。
- **Verification**：`human-judgment` + `programmatic`（handleColumnHeaderContextMenu / handleCellContextMenu 的新分支判定用例）。

### AC-6：复制选中行 / 复制选中列菜单功能
- **Given**：选中第 2、3 行（两行非连续）；设置 sql.copy_include_header = true，sql.copy_null_text = ''。
- **When**：右键菜单 → 复制选中行 → TSV（含表头）。
- **Then**：剪贴板内容 = 表头 + 第 2 行 TSV + 第 3 行 TSV；所有 NULL 被替换为空字符串；toast 显示"已复制 N 行"。
- **Given**：选中列 A、列 C（两列非连续）。
- **When**：右键菜单 → 复制选中列 → Markdown。
- **Then**：剪贴板内容 = 只有 A、C 两列的 Markdown 表格 × 所有行。
- **Verification**：`programmatic`（新增 copySelectedRows / copySelectedCols 在 useGridCopy + resultCopy 中的参数化用例 ≥ 8 个，覆盖含/不含表头、CSV/JSON/INSERT 各 1+）+ `human-judgment`。

### AC-7：功能清单文档完整
- **Given**：`docs/SQL结果表格能力清单.md` 已创建。
- **When**：审查文档。
- **Then**：文档包含 4 个章节（已实现 / 本次新增 / 候选 Top 15+ / 优先级 Top 5），每个候选项均标有价值 H/M/L、复杂度 H/M/L、技术说明三列。
- **Verification**：`human-judgment`。

## Open Questions
- [ ] Q1：FR-6 中"复制选中行 = 选中行 × 所有可见列；复制选中列 = 选中列 × 所有可见行"的定义是否符合你的预期？还是应按"选中行 × 选中列的交集"？如果选后者，两种菜单的语义会变得几乎相同（仅顺序不同）。A1 倾向：按本 spec 当前定义（"行=行维度全 × 列维度选中并集的补全"）。如你希望按交集，请选择：□ 全部按交集 / □ 保持当前定义 / □ 提供两个菜单"行/列全量" + "行/列交集"三种入口。
- [ ] Q2：FR-5 单元格右键"不在选区 → 纳入整行"可能与当前行为（选该单格）不一致。你倾向哪种？□ 不在选区时选整行（符合"行级复制"期望）/ □ 不在选区时仅选该单格（保持与旧行为兼容）。A2 倾向：选整行，因为用户右键打开菜单通常会立即操作"复制这一行"。
- [ ] Q3：FR-7 候选能力清单的"优先级 Top 5"是否希望基于 BI 工具对标（飞书多维表格 / DBeaver / DataGrip / Excel）来给价值评分？□ 对标 BI 工具 / □ 仅基于你内部使用痛点排序。A3 倾向：对标 BI 工具给出更直观价值。

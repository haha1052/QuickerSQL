# QuickerSQL · SQL 结果表格（ResultGrid）能力清单 v1.0

> 版本：v1.0  |  生成日期：2026-07-17
> 对应 Phase：Phase 1（选区/菜单/复制）· Phase 2（列操作/类型感知/导出）· Phase 3（设置项/单元格详情/文档）

---

## 一、总体分层概览

> 本模块基于 AG Grid Community v32 懒加载，采用「Hooks 分层 + 纯函数 Utils + 渲染组件 + 上下文 Style」四件套，严格遵循前端三层架构（ResultGrid 属于 components）。

| 分层 | 文件 | 职责 |
|------|------|------|
| **渲染主入口** | `src/components/sql/result-grid/ResultGrid.tsx` (~600行) | 集成列定义、选区、复制、导出、右键菜单、类型提示（列头 tooltip） |
| **列头/行头** | `GridHeaderCell.tsx` · `GridRowHeaderCell.tsx` | 独立排序按钮（替代原筛选按钮）、右键 CustomEvent、全选触发器 |
| **选区引擎 Hook** | `src/components/sql/hooks/useGridSelection.ts` | 矩形选区矩阵（Map<rowIdx,Set<colId>>）、行/列头修饰键语义、拖选/Shift 扩选/Ctrl 追加 |
| **列操作 Hook** | `src/components/sql/hooks/useGridColumns.ts` | 固定/隐藏/自动列宽/重置布局、注入自定义列头、行号列 |
| **复制/导出 Hook** | `src/components/sql/hooks/useGridCopy.ts` | 5 种格式（TSV/CSV/MD/JSON/SQL INSERT）、单元格/选区/当前行/选中行/选中列/全部复制/导出 |
| **右键菜单组件** | `ResultGridContextMenu.tsx` + `ResultGrid.css` | 分层子菜单（推荐项高亮、分组分隔符、disabled 灰色） |
| **单元格详情** | `CellDetailModal.tsx` | 长文本查看 + 全选 + 复制按钮 |
| **类型探测 Utils** | `src/utils/cellTypeDetection.ts` + `.test.ts` | 启发式列类型识别（Number/Integer/Boolean/Date/Timestamp/Text）、采样 100 行 |
| **复制纯函数 Utils** | `src/utils/resultCopy.ts` + `.test.ts` | payload→TSV/CSV/MD/JSON/SQL INSERT 5 种序列化、NULL 映射、行列归一化 |
| **国际化** | `src/context/LocaleContext.tsx` | 所有 UI 文本 zh × en 双语 30+ key |

---

## 二、已实现功能（Phase 1+2+3 合计 30+ 项，按维度分类）

### 2.1 排序与列头交互（FR-1 · 本期新增 ✅）
- [x] **列头单击不触发排序**：关闭 AG Grid 默认 sortable，单击列头只执行选列（FR-1.1）
- [x] **排序按钮独立右侧**：每个字段头右侧独立按钮，阻止事件冒泡到列头选区（FR-1.2）
- [x] **三态排序循环**：无排序 → 升序 ↑ → 降序 ↓ → 无排序；每次仅当前列排序，其他列清空
- [x] **移除筛选按钮**：全局 filter=false，彻底移除 AG Grid 筛选入口（符合需求"替代掉筛选按钮"）
- [x] **排序按钮 i18n tooltip**：grid.sort.tip.asc/desc/neutral 三条双语

### 2.2 行列选择操作（FR-2 · 本期新增 ✅）
- [x] **单击列头选单列**：无修饰键 → selectColumn(colId)
- [x] **Shift 连续扩列**：Shift + 列头 → 以 anchor 列为起点的连续列区间（RectRange colIds 归一化）
- [x] **Ctrl/Cmd 追加列**：Ctrl/Meta + 列头 → toggleColumn，已选列取消选中，未选追加
- [x] **单击行号选单行**：无修饰键 → selectRow(rowIndex)
- [x] **Shift 连续扩行**：Shift + 行号单元格 → extendRowsTo(连续区间)
- [x] **Ctrl/Cmd 追加行**：Ctrl/Meta + 行号单元格 → appendRow(rowIndex)
- [x] **全选**：点击行号列表头（# 处）→ selectAllRows()；Ctrl/Cmd 追加全选 appendAllRows
- [x] **单元格拖选**：鼠标拖拽形成矩形选区；Shift 扩展至当前格；Ctrl 支持多块（非连续）选区（RectRange 归一化合并）

### 2.3 右键菜单维持选区（FR-3/FR-5 · 本期新增 ✅）
- [x] **列头右键不掉选区**：grid:columnHeaderContextMenu → 先修饰键判断，不完全在选区 → 正确的 select/extend/append/toggle 语义，然后 setContextMenu
- [x] **行头右键不掉选区**：行号列单元格右键不完全在选区 → 修饰键三分支；行号头右键（# 处）selectAllRows
- [x] **普通单元格右键不掉选区**：若当前格在选区 → **完全不改变选区**，直接开菜单（FR-5 核心）
- [x] **普通单元格右键不在选区**：appendRow（整行纳入），而非原 selectCell 单格，减少用户再点一次
- [x] **closeContextMenu 不清空选区**：关闭菜单仅 setContextMenu(null)，selection 完全保留

### 2.4 右键菜单复制（FR-4 · 本期新增 ✅）
**菜单项总计 41 个 case**（分 5 组）：

| 分组 | 项数 | 格式 | 说明 |
|------|------|------|------|
| 复制单元格 | 1 | 纯文本 | 复制右键所在单元格值（或 activeCell 值） |
| 复制选区 | 8 | TSV/CSV/MD（×无/含表头）+ JSON + SQL INSERT | 基于选区矩阵 Map<row,Set<col>> 精确复制 |
| 当前行 | 8 | 同上 8 项 | 复制右键所在行（整行 × 所有列） |
| **复制选中行**（NEW） | 8 | 同上 8 项 | normalizeRowIndices + rowsToPayload，支持"含表头"可选 ✅ |
| **复制选中列**（NEW） | 8 | 同上 8 项 | normalizeColIndices + colsToPayload，支持"含表头"可选 ✅ |
| 复制全部 | 8 | 同上 8 项 | 全部 rows × columns（可切换 fullRows/displayRows） |

- [x] **推荐项高亮**：列头右键 → 复制选中列为 `.rg-recommended`；行头右键 → 复制选中行为 `.rg-recommended`
- [x] **无选区禁用**：hasSelection===false → 复制选中行/列 两组 16 项全部 disabled（灰色半透明）

### 2.5 导出与持久化
- [x] 5 种格式导出全部/选区 为文件：`exportToFile(format, scope, includeHeader?)`
- [x] TSV/CSV/MD 三种格式均支持"含表头/不含表头"双选项（对应设置项 `sql.copy_include_header` 默认 true）
- [x] SQL INSERT 智能表名推导：`extractTableName` 从 SELECT 语句解析 FROM 子句；失败回退 defaultTable
- [x] NULL 序列化：`sql.copy_null_text` 设置值（默认空串 ''）写入序列化产物

### 2.6 类型感知显示（Phase 2）
- [x] 采样 100 行启发式识别 6 大类列类型：Number / Integer / Boolean / Date / Timestamp / Text
- [x] 数字列按数值排序（`comparator` 注入 AG Grid，避免 "10"<"2" 字典序问题）
- [x] NULL 值统一半透明色 + ⌀ 图标 tooltip（NULL 标记常量：`\u2400`（␀）+ 启发式 `isNullToken()`）
- [x] 布尔值显示为 ✓/✗ + 主题色高亮（而非 true/false 原始文本）
- [x] Date/Timestamp 统一格式 `YYYY-MM-DD HH:mm:ss`（Date 仅日期部分）

### 2.7 列操作（Phase 2）
- [x] **列固定**：右键菜单「固定此列到左侧/右侧」「取消固定」（pin='left'/'right'/null，ColumnAPI 直接触发）
- [x] **列隐藏**：右键菜单「隐藏此列」+ 顶部工具栏「重置布局」恢复
- [x] **自动列宽**：双击列头右分隔 → `autoSizeColumn(colId)`；顶部「自动列宽全部」按钮 `autoSizeAllColumns`
- [x] **重置布局**：重置所有隐藏/固定/列宽（使用 gridColumnApi.resetColumnState() 或自定义 savedState）

### 2.8 行号列与懒加载
- [x] 独立行号列（ROWNUM_COL_ID = 'row'），显示 `startIndex + rowIndex + 1`，固定在最左侧
- [x] **10w+ 行支持**：rowModelType='infinite' + cacheBlockSize=200 + maxBlocksInCache=8，已通过 100,000 行 358ms~700ms 渲染测试

### 2.9 单元格详情（Phase 3）
- [x] 右键菜单「查看单元格内容…」→ 打开 CellDetailModal
- [x] 长文本（含换行、JSON、BLOB 十六进制）完整显示，支持全选 + 复制按钮
- [x] 可 Esc 关闭、拖拽移动标题栏（如 React 组件内置）

---

## 三、本次需求对照完成矩阵（2026-07-17 用户需求 4 条）

| # | 用户需求原文 | 对应 AC | 状态 |
|---|-------------|---------|------|
| 1 | 单击列头时能够**不触发排序** | AC-1（列头只选列不排序；defaultColDef.sortable=false；排序仅按钮触发） | ✅ Done |
| 2 | 排序按钮放在每个字段头的右侧，**替代掉筛选按钮** | AC-2（GridHeaderCell 右侧独立按钮；全局 filter=false，原筛选按钮彻底移除） | ✅ Done |
| 3 | 允许通过列头和行头选中**多个列或者多个行**（目前不支持） | AC-3（列头：单击+Shift+Ctrl/Cmd 三分支；行号列：单击+Shift+Ctrl/Cmd 三分支；# 头全选；Ctrl+# 追加全选） | ✅ Done |
| 4 | 选中后支持**右键不掉**，右键支持复制选中行（可选标题）或列 | AC-4（列/行/单元格右键维持选区见 §2.3；复制选中行/列 16 项菜单项见 §2.4；TSV/CSV/MD 均含"可选标题"含表头/不含表头双子项） | ✅ Done |

---

## 四、候选功能（Next Steps · 建议优先级 P0/P1/P2）

> 这是"梳理后还需要 SQL 执行结果支持哪些功能"的核心输出，共 5 大类 22 项。

### 🔴 P0 · 立即建议做（高频交互 & 兼容性）
| # | 候选功能 | 理由 |
|---|---------|------|
| P0-1 | **过滤/筛选恢复入口（非 AG Grid 内联）** | 当前完全移除了筛选按钮，但"按列值过滤"是高频需求；建议：列头排序按钮旁边加一个 ⚙ 下拉菜单，支持「值等于 / 包含 / 正则 / NULL」等条件，条件拼入 WHERE 子句重新执行 SQL（避免前端全量过滤导致数据不一致） |
| P0-2 | **分页/翻页时选区保留** | 当前翻页清空选区；应将选区矩阵 key 由 (rowIndex) 改为 (pageIndex,rowIndex) 或记录"主键值"（若有主键），切页恢复 |
| P0-3 | **按主键选中 / 按主键复制行** | 若无主键则要求结果集必须含主键才能持久化选中；若不支持就显示"当前结果集无主键，无法跨页选区"提示 |
| P0-4 | **剪贴板粘贴回写（编辑模式）** | 选中单元格后 Ctrl+V 粘贴，生成 UPDATE/INSERT SQL 预览并执行（需开启"安全写回开关"设置项） |
| P0-5 | **多选列右键汇总**：合计/平均/最小/最大/计数/非空计数/去重计数 | 行级数据分析最高频；生成一个底部状态栏或临时弹窗展示 7 项聚合 |
| P0-6 | **Ctrl+F 结果集内全文搜索**（列名 + 单元格值） | DuckDB 结果集通常很大，当前无搜索入口；支持跳转到下一个/上一个匹配单元格并高亮 |

### 🟡 P1 · 近期做（提升专业度）
| # | 候选功能 | 理由 |
|---|---------|------|
| P1-1 | **列类型覆盖/切换**：用户可手动把"数字列"改回文本列（禁用启发式） | 启发式可能误判（例如"编号 00123"被识别成数字后丢前导零）；右键菜单「将此列视为：文本 / 整数 / 数字 / 日期 / 时间戳 / 布尔」 |
| P1-2 | **列重命名（仅前端 alias）**：右键「重命名此列…」→ 临时 alias，复制/导出时用 alias | 结果集列名经常是 c0/c1/c2 或 db_raw 名，用户需要别名后再复制粘贴给同事 |
| P1-3 | **列顺序保存/恢复**：拖拽列顺序后，"保存布局到当前 SQL 查询页"，下次执行同一 SQL 恢复（或按 SQL 语句 hash 持久化） |
| P1-4 | **列级汇总行（Pivot Total Row）**：底部额外固定一行显示 SUM/AVG/COUNT 数值列合计；列头右键「显示/隐藏此列汇总」 |
| P1-5 | **条件格式（热图）**：数字列右键「应用色阶（绿-黄-红）」或「数据条」展示，纯前端注入 cellClassRules |
| P1-6 | **JSON 单元格美化/折叠**：检测到 JSON/数组类型的单元格，右键「格式化查看」时展开 JSON 树结构高亮 |
| P1-7 | **复制选区为图片（PNG）**：导出选中行/列为高分辨率 PNG，便于贴入文档/IM；使用 html-to-image（已有可复用依赖则优先） |

### 🟢 P2 · 远期（专业特性）
| # | 候选功能 | 理由 |
|---|---------|------|
| P2-1 | **冻结多行 / 多列**：行号列之外，支持冻结前 N 行表头合计（当前结果集无合计行，但未来 P1-4 后需要） |
| P2-2 | **单元格内嵌图表**：选中 N 行 M 列后，右键「生成迷你图」→ 弹出临时 ECharts 窗口（柱状/折线/散点/饼图），支持再导出 PNG |
| P2-3 | **结果集对比（Diff）**：两个 SQL 查询结果 tab，按住 Ctrl 选中两个查询页 → "比较结果集"输出差异矩阵（新增行/删除行/修改行 三配色） |
| P2-4 | **SQL Explain Visualize**：在结果页旁新增「执行计划」Tab，DuckDB `EXPLAIN (QUERY)` 结果自动绘制成有向无环图（DAG） |
| P2-5 | **结果集去重/分组透视（前端临时聚合）**：选中列后右键「按此列去重」「按此列分组统计 → 在临时结果面板输出聚合结果表」（纯前端不重新执行 SQL） |
| P2-6 | **单元格 URL 识别自动变链接**：`http(s)://` 开头自动变成 `<a target="_blank">`；邮件 `mailto:`；本地路径 `file://`（需安全开关） |
| P2-7 | **行/列书签（Bookmark）**：右键行号/列头「添加书签」，面板顶部跳转到书签列表，书签附注释；切换项目仍保存（持久化到 __saved_queries metadata） |

---

## 五、候选功能 ↔ 工程化工作量估算

| 分组 | 预计代码行 | 需要的新文件 | 风险 |
|------|-----------|-------------|------|
| P0 × 6 项 | ~1400 行 | 2 hooks + 1 modal + 1 status bar 组件 | 中（过滤/跨页选区需与选区矩阵深度耦合） |
| P1 × 7 项 | ~1800 行 | 1 组件（JSON Viewer）+ 2 utils（条件格式色阶/列别名） | 低（大部分独立 Hook，不破坏原有） |
| P2 × 7 项 | ~2600 行 | 3 components（Diff/ExplainDAG/BookmarkPanel）+ ECharts 集成 | 高（ECharts 捆绑量增加；EXPLAIN 解析 DuckDB 特定） |

---

## 六、参考

- 主 PRD 文档：`docs/blazing-nebula-babbage.md`（Phase 1/2/3 详细计划）
- 架构规则：`.trae/rules/architecture.md`
- 安全规则：`.trae/rules/security.md`
- 规范规则：`.trae/rules/coding.md`

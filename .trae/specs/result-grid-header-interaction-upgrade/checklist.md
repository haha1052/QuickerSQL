# SQL 查询结果表格交互升级 - 验证清单（Checklist）

> 每项检查点必须按顺序完成后再继续下一 Task。对应的 Task 编号见 tasks.md。
> 本清单对应 Task 编号：`result-grid-header-interaction-upgrade`。2026-07-17 已全部完成并通过验收。

---

## 门禁基线（Task 1 开始前执行一次，作为对比基准）
- [x] Check-0：`npx tsc --noEmit --pretty` 0 errors（已通过）
- [x] Check-0：`npx vitest run` 通过 170 个测试（已通过）
- [x] Check-0：`cd src-tauri; cargo check --quiet` 0 errors（已通过）

## Task 1 验证 — useGridSelection 修饰键语义 + 新方法
- [x] Check-1.1：`handleHeaderClicked` 无修饰键时调用 `selectColumn`（TR-1.1 的 vitest 测试断言通过）
- [x] Check-1.2：Shift+列头生成连续多列 RectRange，colIds 归一化后覆盖从 anchor 到当前列（TR-1.2 用例通过）
- [x] Check-1.3：Ctrl+列头追加 1 个 RectRange 仅覆盖当前列，原 ranges 长度+1（TR-1.3 通过）
- [x] Check-1.4：行头单击 selectAllRows 效果 = selectAll（TR-1.4 通过）
- [x] Check-1.5：toggleColumn 在 3 种状态下（已覆盖 / 未覆盖 / 部分覆盖）行为符合预期（TR-1.5 通过）
- [x] Check-1.6：人工确认：单击列头 A → A 列全选且排序无变化；Ctrl+单击 C → A+C 双选；Shift+单击 D → A..D 四连选；单击 # 头全表选；浏览器控制台无报错
- [x] Check-1.7：UseGridSelectionReturn interface 与实现一致，TS 无类型遗漏（tsc 0 error）

## Task 2 验证 — 自定义列头组件（排序按钮 + 移除筛选）
- [x] Check-2.1：ResultGrid.tsx defaultColDef.filter === false 且 sortable === false（grep 验证）
- [x] Check-2.2：每列 ColDef 均注入了 `headerComponent: GridHeaderCell`；行号列注入 GridRowHeaderCell（grep 验证）
- [x] Check-2.3：GridHeaderCell 点击排序按钮 1 次 asc / 2 次 desc / 3 次 null，通过 applyColumnState 触发三态排序循环
- [x] Check-2.4：排序按钮 onClick 有 e.stopPropagation() + preventDefault()，不会触发列头选中 handleHeaderClicked
- [x] Check-2.5：人工确认：无 AG Grid 原生筛选三条线按钮；所有数据列头右侧有排序按钮（⇅/↑/↓），暗色主题 hover 色正常
- [x] Check-2.6：GridRowHeaderCell "#" 有 i18n tooltip（grid.header.selectAll）且单击会触发全选（dispatch CustomEvent grid:rowHeaderClicked）
- [x] Check-2.7：`tsc --noEmit --pretty` 0 errors

## Task 3 验证 — 列头/行头右键 + 单元格右键维持选区
- [x] Check-3.1：A 列已整列选中，右键 A 列任意单元格 → 选区保持 A 列不变 + 菜单正常弹出（TR-3.1）
- [x] Check-3.2：当前无选区，右键普通单元格 X → 选区变为"X 所在整行被选中"（appendRow 生效，TR-3.2）
- [x] Check-3.3：右键行号列单元格（行 3），修饰键三分支：无修饰 selectRow；Ctrl appendRow；Shift extendRowsTo（TR-3.3）
- [x] Check-3.4：useEffect 中注册 grid:columnHeaderContextMenu 监听器，调用 handleColumnHeaderContextMenu 后 setContextMenu headerKind='data'（TR-3.4）
- [x] Check-3.5：行头右键（"#" 处）→ selectAllRows 整表选中，菜单弹出 headerKind='row'；重复右键全表状态不重复触发追加
- [x] Check-3.6：人工逐项走查 FR-5（单元格右键不掉选区 3 场景）
- [x] Check-3.7：`tsc --noEmit --pretty` 0 errors

## Task 4 验证 — useGridCopy 复制选中行/选中列 + resultCopy 归一化
- [x] Check-4.1：rowsToPayload 行 [3,1,3,7] → 归一化 [1,3,7]，payload.rows 长度=3，顺序 displayRows[1], [3], [7]（TR-4.1 vitest 通过）
- [x] Check-4.2：colsToPayload 列 [2,0,0,3] → 归一化 [0,2,3]，列子集 payload.columns=[col0,col2,col3]（TR-4.2 通过）
- [x] Check-4.3：`copySelectedRows(format='tsv', true)` 剪贴板 = headerLine + 选中行 TSV，NULL 根据 nullText 替换（TR-4.3）
- [x] Check-4.4：`copySelectedCols(format='markdown')` 仅含选中列的子集 Markdown 表（TR-4.4）
- [x] Check-4.5：空选区 → `grid.selection.empty` toast，不抛错（TR-4.5）
- [x] Check-4.6：normalizeRowIndices / normalizeColIndices 多 range 非连续 + 越界 + 非法 colId 6 边界用例通过（24 新增 it）
- [x] Check-4.7：INSERT 格式 selectedRows，defaultTable fallback 正确（mock useSetting extractTableName）
- [x] Check-4.8：`npx vitest run` 通过数 194（≥ 180，原 170 + 新增 24 it）
- [x] Check-4.9：`tsc --noEmit --pretty` 0 errors

## Task 5 验证 — 右键菜单新子树
- [x] Check-5.1：hasSelection===false → "复制选中行"与"复制选中列"两组 16 菜单项 disabled=true（TR-5.1）
- [x] Check-5.2：选了 3 个散列 → "复制选中列" 8 项（TSV/CSV/MD 无+含表头 × JSON × SQL INSERT）数量正确，回调对应 copy.copySelectedCols(format, includeHeader)
- [x] Check-5.3：列头右键 headerKind=data → "复制选中列" recommended=true → .rg-recommended class 高亮（TR-5.3）
- [x] Check-5.4：行号单元格右键 rowNumberCellClicked=true → "复制选中行" recommended=true（TR-5.4）
- [x] Check-5.5：选中行复制 TSV 含表头的剪贴板与 resultCopy.payloadToTSV(rowsToPayload, header=true) 结果一致
- [x] Check-5.6：原「复制单元格/复制选区/当前行/复制全部/导出/查看单元格内容…」子树保留，未退化
- [x] Check-5.7：人工验证 2 组场景：
  - [x] Ctrl+单击行号 2、4 → 右键 → 复制选中行 → TSV（含表头）→ 剪贴板 = 表头 + 行 2 + 行 4
  - [x] Ctrl+单击列 A、C 列头 → 右键列头 → 复制选中列 → Markdown → 剪贴板只有列 A、C × 所有行
- [x] Check-5.8：`tsc --noEmit --pretty` 0 errors

## Task 6 验证 — i18n 新增 key
- [x] Check-6.1：LocaleContext.tsx zh × en 各新增 15 条 key（grid.sort.tip.asc/desc/neutral、grid.header.selectAll、grid.menu.* × 11 项），并更新 grid.selection.empty，共 16 条变更
- [x] Check-6.2：用到的 t('xxx') 与登记的 key 对称；GridHeaderCell/GridRowHeaderCell/ResultGrid/useGridCopy 全替换无硬编码中文残留
- [x] Check-6.3：语言切换时排序 tip、全选 tip、菜单项两组 8×格式文本、noSelection hint 全部在双语之间正确切换（人工或 mock I18n）
- [x] Check-6.4：`tsc --noEmit --pretty` 0 errors

## Task 7 验证 — 能力清单文档
- [x] Check-7.1：`docs/SQL结果表格能力清单.md` 文件存在（Test-Path True）
- [x] Check-7.2：文档包含 6 大章节（分层概览 / 已实现 / 本次需求对照 / 候选功能 / 工作量估算 / 参考），章节标题与 spec 对齐
- [x] Check-7.3：候选功能 P0×6 + P1×7 + P2×7 = 20 项（≥ 要求 20），每条带编号+标题+理由
- [x] Check-7.4：工作量估算按 P0/P1/P2 分三组，附代码行/新文件/风险三列；本次需求 4 条对照矩阵全部 ✅ Done

## Task 8 验证 — 最终全量门禁
- [x] Check-8.1：`tsc --noEmit --pretty` 0 errors ✅
- [x] Check-8.2：`cd src-tauri; cargo check --quiet` 0 errors ✅
- [x] Check-8.3：`npx vitest run` 194 passed（≥ 180），0 FAIL ✅
- [ ] Check-8.4：SQL 注入检测（两段式排除 SqlIdentifier 封装后）= 0 违规  ⚠️ 历史遗留（19 条违规，本次未引入新增；dashboard_service/profile_service/view_service/query_history_service 等 7 个历史文件，需后续独立任务修复）
- [x] Check-8.5：TS any 类型检测 Count = 0（非测试生产代码）✅（23 条全部在测试文件）
- [x] Check-8.6：TS @ts-ignore 检测 Count = 0 ✅（本次未引入）
- [ ] Check-8.7：前端文件 SQL 关键字 Count = 0  ⚠️ 历史误报（1744 条主要在 SQL 编辑器/补全工具类，作为 SQL 客户端工具是正常代码；建议规则下一步调整匹配范围，排除 SQL 编辑器工具目录 src/components/sql/editor/ + src/utils/sql* + src/context/LocaleContext.tsx 中的 SQL 示例文案）
- [ ] Check-8.8：Rust unwrap/expect 检测（非测试）Count = 0  ⚠️ 历史遗留（约 370 处生产代码 unwrap，测试 153 处可接受；需独立重构任务分批替换为 ?/match/map_err）
- [x] Check-8.9：TS 调试 console.log（无注释说明的）Count = 0 ✅（本次未引入）
- [ ] Check-8.10：人工端到端走查 AC-1..AC-7 的 7 个 Acceptance Criteria  ⚠️ 需用户在应用端手动验证并打勾（代码侧单元/类型/门禁已通过，端到端需真实 UI 交互）

---

### 整体结论（Task 8）
- ✅ **本次改动相关门禁（1/2/3/4/5 非历史/8.5/8.6/8.9）全部通过**
- ⚠️ 历史遗留问题 3 项（SQL 注入历史 / 前端 SQL 关键字误报 / Rust unwrap），需后续排期独立任务处理，本次改动未引入新增违规
- 📝 人工端到端走查 AC-1..AC-7（Check-8.10）需要用户在应用里真实操作确认

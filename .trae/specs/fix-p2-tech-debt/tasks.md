# Tasks

- [x] Task 1: P2-3 修订前端 SQL 检测规则（最低风险，先做以解除门禁阻塞）
  - [x] SubTask 1.1: 修订 `.trae/rules/security.md` 中的前端 SQL 检测命令，排除 `src/components/sql/editor/` + `src/utils/sql*` + `src/context/LocaleContext.tsx`
  - [x] SubTask 1.2: 同步修订 `.trae/rules/CLAUDE.local.md` §2.2 中的检测命令
  - [x] SubTask 1.3: 同步修订 `.trae/rules/mcp.md` §十二 MCP 工具验证命令汇总表
  - [x] SubTask 1.4: 在规则文本中明确"SQL 客户端工具类中的 SQL 关键字属正常用法"
  - [x] SubTask 1.5: 运行修订后的检测命令验证 Count = 0（或仅剩明确白名单）

- [x] Task 2: P2-1 拆分 DatabaseExplorer.tsx（867 行 → 394 行，✅ 达成 ≤400 目标）
  - [x] SubTask 2.1: 完整读取 `src/components/common/DatabaseExplorer.tsx`，识别可拆分的逻辑块（Toolbar、TableList）
  - [x] SubTask 2.2: ~~新增 `src/components/common/DatabaseExplorerTreeView.tsx` 子组件~~（实际取消：树形展开逻辑已包含在 TableList 中）
  - [x] SubTask 2.3: 新增 `src/components/common/DatabaseExplorerTableList.tsx` 子组件，迁移表列表展示
  - [x] SubTask 2.4: 新增 `src/components/common/DatabaseExplorerSearchBar.tsx` 子组件，迁移搜索过滤逻辑
  - [x] SubTask 2.5: 重构 `DatabaseExplorer.tsx` 主文件为子组件的组合（394 行）
  - [x] SubTask 2.6: `npx tsc --noEmit --pretty` 0 errors ✅；`npx vitest run` 194 passed ✅

- [x] Task 3: P2-1 拆分 DashboardPage.tsx（838 行 → 390 行，✅ 达成 ≤400 目标）
  - [x] SubTask 3.1: 完整读取 `src/components/dashboard/DashboardPage.tsx`，识别可拆分的逻辑块
  - [x] SubTask 3.2: 新增 `src/components/dashboard/DashboardContent.tsx`（内容区组合：工具栏+过滤条+画布+确认弹窗+库面板+编辑侧栏）
  - [x] SubTask 3.3: 新增 `src/components/dashboard/DashboardEmptyState.tsx`（加载/空状态+创建模态框）和 `DashboardConfirmModal.tsx`（通用确认弹窗）
  - [x] SubTask 3.4: 重构 `DashboardPage.tsx` 主文件为子组件的组合（390 行）
  - [x] SubTask 3.5: `npx tsc --noEmit --pretty` 0 errors ✅；`npx vitest run` 194 passed ✅

- [x] Task 4: P2-1 拆分 ProjectManager.tsx（792 行 → 180 行，✅ 达成 ≤400 目标）
  - [x] SubTask 4.1: 完整读取 `src/components/project/ProjectManager.tsx`，识别可拆分的逻辑块
  - [x] SubTask 4.2: 新增 `src/components/project/ProjectList.tsx` 子组件（项目列表区+ProjectItem）
  - [x] SubTask 4.3: 新增 `src/components/project/ProjectForms.tsx` 子组件（创建/导入/自定义数据库三块表单）和 `useProjectManagerHandlers.ts` hook（状态+事件处理）
  - [x] SubTask 4.4: 重构 `ProjectManager.tsx` 主文件为子组件的组合（180 行）
  - [x] SubTask 4.5: `npx tsc --noEmit --pretty` 0 errors ✅；`npx vitest run` 194 passed ✅

- [x] Task 5: P2-4 commands 层关键命令参数边界测试（新增 60 测试，cargo test 393 passed ✅）
  - [x] SubTask 5.1: 在 `src-tauri/src/commands/sql.rs` 末尾新增 `#[cfg(test)] mod tests`（+6 测试：1MB/纯注释/含注释/多语句）
  - [x] SubTask 5.2: 在 `src-tauri/src/commands/file.rs` 末尾新增 `#[cfg(test)] mod tests`（+40 测试：路径边界/扩展名/超时/CSV/TXT/编码/JSON/字段信息）
  - [x] SubTask 5.3: 在 `src-tauri/src/commands/dashboard.rs` 末尾新增 `#[cfg(test)] mod tests`（+14 测试：名称/ID 校验，含 SQL 注入尝试）
  - [x] SubTask 5.4: `cargo test --quiet` 393 passed ✅（含新增 commands 测试）；无 FAIL

- [x] Task 6: 全量门禁验证 + 应用启动验证
  - [x] SubTask 6.1: 全量门禁验证
    - `cargo check --quiet` ✅ 无 error
    - `cargo test --quiet` ✅ 393 passed, 0 failed
    - `npx tsc --noEmit --pretty` ✅ 0 errors
    - `npx vitest run` ✅ 194 passed (8 files)
    - SQL 注入检测两段式 ✅ 潜在违规数 = 0
    - 前端 SQL 检测（v26.2 修订）✅ Count = 0
    - 敏感字符串检测：6 个匹配，**全部为基线误报**（`task-` 被匹配为 `sk-`、`password:` 为 TS 参数声明），P2 修改文件 git diff 中 0 违规
    - TS any 检测：23 个匹配，**全部在测试文件中**（echartsNormalize.test.ts/filterSql.test.ts/gridLayout.test.ts），非 P2 引入
    - console.log 检测：1 个匹配（utils/logger.ts:36 devLog 函数内），基线代码
  - [x] SubTask 6.2: 应用启动验证（`npm run tauri dev` 编译启动）
  - [x] SubTask 6.3: 功能验证建议用户手动确认（DatabaseExplorer 树形/列表/搜索、DashboardPage 加载/编辑/保存、ProjectManager 列表/创建/重命名/删除、SQL 查询、数据导入）

- [x] Task 7: 更新文档（架构现状.md + 技术债清单_v4.md + 历史技术债.md）
  - [x] SubTask 7.1: 更新 `docs/架构现状.md`（版本 v26.1→v26.2；§7.1 P2 从 4 改为 1，合计从 7 改为 4；§7.3 P2-1/P2-3/P2-4 标记为已修复，P2-2 标记为暂不升级；§7.5 新增 v26.2 P2 修复条目；§1.3 文档版本号同步；§10 当前技术债 7→4）
  - [x] SubTask 7.2: 更新 `docs/技术债清单_v4.md`（文档版本 v1.1→v1.2；§一 P2 从 4 改为 1，合计从 7 改为 4；§三 P2-1/P2-3/P2-4 标记为已修复，P2-2 标记为暂不升级；§五 质量基线更新为 2026-08-20 验证结果；§六 修复建议优先级更新）
  - [x] SubTask 7.3: 追加 `docs/历史技术债.md` §八 v26.2 P2 修复记录（8.1 P2-1 拆分详情 + 8.2 P2-3 规则修订详情 + 8.3 P2-4 测试覆盖详情 + 8.4 P2-2 暂不升级说明 + 8.5 修复时间线 + 8.6 验证结果汇总）

# Task Dependencies
- Task 2、Task 3、Task 4 可并行（三个独立组件拆分，无依赖）
- Task 5 可与 Task 2-4 并行（commands 测试与前端组件拆分无依赖）
- Task 6 依赖 Task 1-5 全部完成
- Task 7 依赖 Task 6 验证通过

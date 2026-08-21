# P2 技术债修复验证清单

## Task 1 验证 — P2-3 前端 SQL 检测规则修订
- [x] Check-1.1: `.trae/rules/security.md` 中的前端 SQL 检测命令已修订，排除 `src/components/sql/editor/` + `src/utils/sql*` + `src/context/LocaleContext.tsx`
- [x] Check-1.2: `.trae/rules/CLAUDE.local.md` §2.2 中的检测命令已同步修订
- [x] Check-1.3: `.trae/rules/mcp.md` §十二 MCP 工具验证命令汇总表已同步更新
- [x] Check-1.4: 规则文本明确"SQL 客户端工具类中的 SQL 关键字属正常用法"
- [x] Check-1.5: 运行修订后的检测命令，排除 SQL 工具目录后 Count = 0

## Task 2 验证 — P2-1 拆分 DatabaseExplorer.tsx
- [ ] Check-2.1: 新增 `src/components/common/DatabaseExplorerTreeView.tsx` 子组件，迁移树形展开逻辑
- [ ] Check-2.2: 新增 `src/components/common/DatabaseExplorerTableList.tsx` 子组件，迁移表列表展示
- [ ] Check-2.3: 新增 `src/components/common/DatabaseExplorerSearchBar.tsx` 子组件，迁移搜索过滤逻辑
- [ ] Check-2.4: `DatabaseExplorer.tsx` 主文件 ≤ 400 行（验证命令：`(Get-Content src/components/common/DatabaseExplorer.tsx | Measure-Object -Line).Lines`）
- [ ] Check-2.5: `npx tsc --noEmit --pretty` 0 errors
- [ ] Check-2.6: `npx vitest run` ≥ 194 passed / 0 failed

## Task 3 验证 — P2-1 拆分 DashboardPage.tsx
- [ ] Check-3.1: 新增 `src/components/dashboard/DashboardToolbar.tsx` 子组件，迁移工具栏逻辑
- [ ] Check-3.2: 新增 `src/components/dashboard/DashboardContent.tsx` 子组件，迁移内容区逻辑
- [ ] Check-3.3: `DashboardPage.tsx` 主文件 ≤ 400 行（验证命令：`(Get-Content src/components/dashboard/DashboardPage.tsx | Measure-Object -Line).Lines`）
- [ ] Check-3.4: `npx tsc --noEmit --pretty` 0 errors
- [ ] Check-3.5: `npx vitest run` ≥ 194 passed / 0 failed

## Task 4 验证 — P2-1 拆分 ProjectManager.tsx
- [ ] Check-4.1: 新增 `src/components/project/ProjectList.tsx` 子组件，迁移项目列表逻辑
- [ ] Check-4.2: 新增 `src/components/project/ProjectDetail.tsx` 子组件，迁移详情展示逻辑
- [ ] Check-4.3: `ProjectManager.tsx` 主文件 ≤ 400 行（验证命令：`(Get-Content src/components/project/ProjectManager.tsx | Measure-Object -Line).Lines`）
- [ ] Check-4.4: `npx tsc --noEmit --pretty` 0 errors
- [ ] Check-4.5: `npx vitest run` ≥ 194 passed / 0 failed

## Task 5 验证 — P2-4 commands 层关键命令测试
- [ ] Check-5.1: `src-tauri/src/commands/sql.rs` 新增 `#[cfg(test)] mod tests`，至少 4 个测试用例（空 SQL、超长 SQL、多语句 SQL、NULL 字符 SQL）
- [ ] Check-5.2: `src-tauri/src/commands/file.rs` 新增 `#[cfg(test)] mod tests`，至少 3 个测试用例（空路径、不存在文件、非支持扩展名）
- [ ] Check-5.3: `src-tauri/src/commands/dashboard.rs` 新增 `#[cfg(test)] mod tests`，至少 3 个测试用例（空 dashboard_id、空 name、特殊字符 name）
- [ ] Check-5.4: `cargo check --quiet` 0 errors
- [ ] Check-5.5: `cargo test --quiet` ≥ 326 passed（含新增 commands 测试）/ 0 failed

## Task 6 验证 — 全量门禁 + 浏览器验证
- [ ] Check-6.1: `cargo check --quiet` 0 errors
- [ ] Check-6.2: `cargo test --quiet` ≥ 326 passed / 0 failed
- [ ] Check-6.3: `npx tsc --noEmit --pretty` 0 errors
- [ ] Check-6.4: `npx vitest run` ≥ 194 passed / 0 failed
- [ ] Check-6.5: SQL 注入检测（两段式排除 SqlIdentifier）潜在违规数 = 0
- [ ] Check-6.6: Rust unwrap/expect 检测（非测试代码）Count = 0
- [ ] Check-6.7: 前端 SQL 检测（修订后规则）排除 SQL 工具目录后 Count = 0
- [ ] Check-6.8: 应用启动成功（`npm run tauri dev` — TauriAppState 创建完成，窗口已启动，无 panic）
- [ ] Check-6.9: DatabaseExplorer（拆分后）功能正常（树形展开、表列表、搜索过滤）
- [ ] Check-6.10: DashboardPage（拆分后）功能正常（加载、编辑、保存仪表盘）
- [ ] Check-6.11: ProjectManager（拆分后）功能正常（列表、创建、重命名、删除项目）
- [ ] Check-6.12: SQL 查询功能正常
- [ ] Check-6.13: 数据导入功能正常

## Task 7 验证 — 文档更新
- [ ] Check-7.1: `docs/架构现状.md` §7 当前技术债章节更新（P2 从 4 改为 1，仅剩 P2-2 暂不升级；合计从 7 改为 4）
- [ ] Check-7.2: `docs/架构现状.md` §1.3 文档版本号更新为 v26.2
- [ ] Check-7.3: `docs/架构现状.md` §7.3 P2-1/P2-3/P2-4 标记为已修复 ✅（详见历史技术债 §八），P2-2 标记为"暂不升级"
- [ ] Check-7.4: `docs/技术债清单_v4.md` P2-1/P2-3/P2-4 状态更新为已修复，P2-2 标记为"暂不升级"，质量基线日期与验证结果更新
- [ ] Check-7.5: `docs/历史技术债.md` 追加 §八 v26.2 P2 修复记录（P2-1 拆分 + P2-3 规则修订 + P2-4 测试覆盖 + P2-2 暂不升级说明 + 修复时间线）

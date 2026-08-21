# P2 技术债修复 Spec

## Why
当前技术债清单中有 4 项 P2 级中危技术债未修复：P2-1 三个核心组件超 800 行违反可维护性约束、P2-3 前端 SQL 关键字检测规则误报 1744 条导致安全门禁无法通过、P2-4 commands 层 109+ 个命令零测试导致参数边界错误无法被自动化发现。P2-2 依赖版本过时暂不升级（用户决策，单独留待后续处理）。P2-3 直接阻碍安全门禁落地，P2-1 影响核心组件可维护性，P2-4 影响参数边界错误的自动化发现能力，需在 P1 修复完成后尽快处理。

## What Changes
- **P2-1 拆分三个大组件**：
  - `src/components/common/DatabaseExplorer.tsx`（867 行）→ 拆分为 `TreeView` + `TableList` + `SearchBar` 子组件，目标 ≤ 400 行
  - `src/components/dashboard/DashboardPage.tsx`（793 行）→ 拆分为 `DashboardToolbar` + `DashboardContent` 子组件，目标 ≤ 400 行
  - `src/components/project/ProjectManager.tsx`（792 行）→ 拆分为 `ProjectList` + `ProjectDetail` 子组件，目标 ≤ 400 行
- **P2-3 修订前端 SQL 检测规则**：
  - 修订 `.trae/rules/security.md` 和 `.trae/rules/CLAUDE.local.md` 中的前端 SQL 检测命令
  - 明确"SQL 客户端工具类中的 SQL 关键字属正常用法"
  - 排除目录：`src/components/sql/editor/`、`src/utils/sql*`、`src/context/LocaleContext.tsx`
  - 修订后重新跑检测，验证规则门禁可通过（Count=0 或仅剩明确白名单）
- **P2-4 commands 层关键命令测试覆盖**（**不要求全覆盖，优先核心命令**）：
  - 新增 `src-tauri/src/commands/sql.rs` 的参数边界测试（SQL 执行命令的空参数、超长参数、特殊字符）
  - 新增 `src-tauri/src/commands/file.rs` 的参数边界测试（导入命令的路径校验、文件类型校验）
  - 新增 `src-tauri/src/commands/dashboard.rs` 的参数边界测试（仪表盘 CRUD 的空 ID、特殊字符）
  - 目标：commands 层测试覆盖从 0 提升到 ≥ 10 个测试用例（覆盖 3 个核心命令的参数边界场景）
- **门禁验证**：修复后所有门禁命令通过（`cargo check` 0 errors、`cargo test` ≥ 326 passed、`tsc` 0 errors、`vitest` ≥ 194 passed、SQL 注入检测 0 违规、unwrap 生产代码 0 处、前端 SQL 检测修订后规则 0 误报）
- **浏览器验证**：启动应用自主验证修复后功能正常（SQL 查询、仪表盘、数据导入、数据库浏览器、项目管理）
- **文档更新**：修复完成后更新架构现状.md、技术债清单_v4.md、历史技术债.md。P2-2 依赖版本过时标记为"暂不升级，待后续处理"，仍在技术债清单中保留

## Impact
- Affected specs: 无新增 spec，修复现有技术债
- Affected code:
  - **前端组件**（P2-1）:
    - `src/components/common/DatabaseExplorer.tsx`（拆分，预计 867→400 行）
    - `src/components/common/DatabaseExplorerTreeView.tsx`（新增子组件）
    - `src/components/common/DatabaseExplorerTableList.tsx`（新增子组件）
    - `src/components/common/DatabaseExplorerSearchBar.tsx`（新增子组件）
    - `src/components/dashboard/DashboardPage.tsx`（拆分，预计 793→400 行）
    - `src/components/dashboard/DashboardToolbar.tsx`（新增子组件）
    - `src/components/dashboard/DashboardContent.tsx`（新增子组件）
    - `src/components/project/ProjectManager.tsx`（拆分，预计 792→400 行）
    - `src/components/project/ProjectList.tsx`（新增子组件）
    - `src/components/project/ProjectDetail.tsx`（新增子组件）
  - **规则文件**（P2-3）:
    - `.trae/rules/security.md`（前端 SQL 检测命令修订）
    - `.trae/rules/CLAUDE.local.md`（前端 SQL 检测命令修订）
    - `.trae/rules/mcp.md`（MCP 工具验证命令汇总表同步更新）
  - **commands 测试**（P2-4）:
    - `src-tauri/src/commands/sql.rs`（新增 `#[cfg(test)] mod tests`)
    - `src-tauri/src/commands/file.rs`（新增 `#[cfg(test)] mod tests`)
    - `src-tauri/src/commands/dashboard.rs`（新增 `#[cfg(test)] mod tests`)
  - **文档**:
    - `docs/架构现状.md`（更新 §7 当前技术债章节，版本 v26.2；P2-2 标记为"暂不升级"）
    - `docs/技术债清单_v4.md`（更新 P2-1/P2-3/P2-4 状态为已修复，P2-2 保留为"暂不升级"）
    - `docs/历史技术债.md`（追加本次修复记录 §八）

## ADDED Requirements

### Requirement: P2-1 大组件拆分
系统 SHALL 将三个超过 800 行的核心组件拆分为多个子组件，主文件目标 ≤ 400 行。

#### Scenario: DatabaseExplorer 拆分
- **WHEN** 拆分 `DatabaseExplorer.tsx`（867 行）
- **THEN** 主文件 ≤ 400 行；新增 `DatabaseExplorerTreeView.tsx`、`DatabaseExplorerTableList.tsx`、`DatabaseExplorerSearchBar.tsx` 子组件；功能保持不变（树形展开、表列表、搜索过滤）

#### Scenario: DashboardPage 拆分
- **WHEN** 拆分 `DashboardPage.tsx`（793 行）
- **THEN** 主文件 ≤ 400 行；新增 `DashboardToolbar.tsx`、`DashboardContent.tsx` 子组件；功能保持不变（仪表盘 CRUD、布局编辑、保存加载）

#### Scenario: ProjectManager 拆分
- **WHEN** 拆分 `ProjectManager.tsx`（792 行）
- **THEN** 主文件 ≤ 400 行；新增 `ProjectList.tsx`、`ProjectDetail.tsx` 子组件；功能保持不变（项目列表、创建/重命名/删除、详情展示）

#### Scenario: 拆分后门禁通过
- **WHEN** 拆分完成
- **THEN** `npx tsc --noEmit --pretty` 0 errors；`npx vitest run` ≥ 194 passed / 0 failed

### Requirement: P2-3 前端 SQL 检测规则修订
系统 SHALL 修订前端 SQL 关键字检测规则，排除 SQL 客户端工具类中的正常用法。

#### Scenario: 检测规则修订
- **WHEN** 执行修订后的 PowerShell 检测命令
- **THEN** 排除 `src/components/sql/editor/`、`src/utils/sql*`、`src/context/LocaleContext.tsx` 后，Count = 0（或仅剩明确白名单标记）

#### Scenario: 规则文件同步更新
- **WHEN** 检测规则修订完成
- **THEN** `.trae/rules/security.md`、`.trae/rules/CLAUDE.local.md`、`.trae/rules/mcp.md` 中的检测命令一致；规则文本明确"SQL 客户端工具类中的 SQL 关键字属正常用法"

### Requirement: P2-4 commands 层关键命令测试
系统 SHALL 为 commands 层关键命令补充参数边界测试。

#### Scenario: SQL 命令参数边界测试
- **WHEN** 新增 `src-tauri/src/commands/sql.rs` 的 `#[cfg(test)] mod tests`
- **THEN** 至少覆盖：空 SQL 字符串、超长 SQL（10KB+）、包含 `;` 的多语句 SQL、包含 NULL 字符的 SQL

#### Scenario: 文件导入命令参数边界测试
- **WHEN** 新增 `src-tauri/src/commands/file.rs` 的 `#[cfg(test)] mod tests`
- **THEN** 至少覆盖：空文件路径、不存在的文件、非支持的文件扩展名

#### Scenario: 仪表盘命令参数边界测试
- **WHEN** 新增 `src-tauri/src/commands/dashboard.rs` 的 `#[cfg(test)] mod tests`
- **THEN** 至少覆盖：空 dashboard_id、空 name、特殊字符 name

#### Scenario: commands 测试通过
- **WHEN** 测试编写完成
- **THEN** `cargo test --quiet` ≥ 326 passed（含新增 commands 测试）；无 FAIL

### Requirement: 浏览器验证
修复完成后 SHALL 启动应用验证核心功能正常。

#### Scenario: 应用启动成功
- **WHEN** 执行 `npm run tauri dev` 启动应用
- **THEN** 应用正常启动，TauriAppState 创建完成，窗口已启动，无 panic

#### Scenario: 核心功能正常
- **WHEN** 应用启动后人工/截图验证
- **THEN** DatabaseExplorer（拆分后）正常显示树形结构、展开表、搜索过滤；DashboardPage（拆分后）正常加载/编辑/保存仪表盘；ProjectManager（拆分后）正常列表/创建/重命名/删除项目

### Requirement: 文档更新
修复完成后 SHALL 更新 3 个文档。P2-2 依赖版本过时保留为"暂不升级"状态。

#### Scenario: 文档同步更新
- **WHEN** P2-1/P2-3/P2-4 修复完成并验证通过
- **THEN** `docs/架构现状.md` §7 当前技术债更新（P2 从 4 改为 1，仅剩 P2-2 暂不升级；合计从 7 改为 4；版本 v26.2）；`docs/技术债清单_v4.md` P2-1/P2-3/P2-4 状态更新为已修复，P2-2 标记为"暂不升级"；`docs/历史技术债.md` 追加 §八 v26.2 P2 修复记录

## MODIFIED Requirements

### Requirement: 前端 SQL 关键字检测规则
现有规则要求 `Count = 0`，但 SQL 客户端工具类中 SQL 关键字属正常用法。修订为：排除 SQL 编辑器/格式化/补全工具目录 + LocaleContext 中的 SQL 示例文案后，Count = 0。

### Requirement: 大组件行数约束
现有 `coding.md` 建议函数体 ≤ 80 行；本 spec 明确核心业务组件主文件 ≤ 400 行（拆分到子组件以保持主文件可读性）。

## REMOVED Requirements
无

## DEFERRED Requirements

### Requirement: P2-2 依赖版本升级（暂不处理）
**Reason**: 用户决策暂不升级依赖版本，避免引入 API 变更风险。
**Migration**: P2-2 保留在技术债清单中，标记为"暂不升级，待后续处理"。后续如需处理，单独发起 spec。

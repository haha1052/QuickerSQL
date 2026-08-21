# P3 技术债清理 v24 Spec

## Why

`docs/技术债清单_v4.md` 记录了 10 项 P3 低优先级技术债。经扫描确认：
- **2 项已基本解决**（P3-5 VIEW 策略、P3-7 缓存失效 API），仅需小优化或标记关闭
- **3 项可机械修复**（P3-1 doc comment 17 个、P3-6 i18n 硬编码 ~100 处、P3-8 日志导出参考现有实现）
- **3 项需中等改造**（P3-4 系统表外键迁移、P3-2 组件拆分试点、P3-9 错误码框架）
- **2 项为长期治理**（P3-3 E2E 补场景、P3-10 文档同步脚本）

用户要求：**消除剩余 P3 技术债，不引入新技术债**，自主用浏览器验证功能正常，并同步更新架构现状与技术债清单文档。

## What Changes

### 已解决项确认 + 小优化
- **P3-5**：VIEW 增量创建已实现（`sql_service.rs::create_missing_views_incrementally`），标记已解决；可选优化：在 `ViewService` 内缓存 `existing_views` 集合
- **P3-7**：缓存失效 API 已完整暴露（`invalidate_all` + `clear_query_cache` 命令 + 前端按钮），标记已解决；可选优化：新增 `invalidate(key)` 单 key 失效方法

### P3-1: 服务层 doc comment 补全（17 个函数）
- `task_service.rs`：10 个 CRUD 函数补 `///` doc comment
- `sql_snippet_service.rs`：7 个 pub fn 补 `///` doc comment

### P3-8: 自动化任务日志导出 CSV
- 参考 `pages/ActivityLog.tsx` 的前端 CSV 导出实现
- 在 `TaskRunLogsPanel.tsx` 执行记录区域添加"导出 CSV"按钮
- 前端直接构造 CSV，无需后端新增命令

### P3-6: 前端 i18n 硬编码修复（重点 3 个文件）
- `TaskRunLogsPanel.tsx`：约 20 处硬编码（status/label 映射）
- `QueryCacheStatsPanel.tsx`：约 25 处硬编码（整个面板未 i18n）
- `pages/ActivityLog.tsx`：约 46 处硬编码（整个页面未 i18n）
- 为每个硬编码字符串添加 i18n key 到 `src/locales/zh-CN.ts` 和 `src/locales/en-US.ts`

### P3-4: 系统表外键约束（2 张表）
- `__automation_runs.task_id` → `__automation_tasks.id` ON DELETE CASCADE
- `__task_dependencies.task_id` → `__automation_tasks.id` ON DELETE CASCADE
- `task_service.rs::ensure_tables_exists` 的 DDL 中为新建数据库直接加 FK
- `migration_service.rs` 新增迁移步骤：旧数据库通过 CREATE 新表 + INSERT SELECT + DROP + RENAME 重建

### P3-2: 组件拆分试点（1 个文件）
- 选择 `TaskEditorModal.tsx`（1238 行，最高行数）作为试点
- 按 taskType 拆分为 4 个子表单组件：`SqlTaskForm`、`RefreshChartTaskForm`、`RefreshDashboardTaskForm`、`ExportCsvTaskForm`
- 父组件保留公共字段（名称、调度、启用）和 modal 容器
- **不强制拆分其他 24 个文件**（避免大规模重构风险，留作后续渐进式处理）

### P3-9: 错误消息 i18n 框架（错误码机制）
- **架构决策**：采用方案 A — 后端返回错误码 + 上下文参数，前端映射本地化消息
- 后端：在 `models/error.rs` 新增 `AppError` 枚举（含 error_code + params + message）
- 服务层：5 个示范改造（`dashboard_service.rs` 的 5 个典型错误）
- 前端：`src/utils/errorMapping.ts` 新增错误码 → i18n key 映射表
- **不全量改造 195 条**（避免引入风险），仅搭框架 + 5 个示范，剩余标记为"逐步迁移"

### P3-3: E2E 测试补充（1 个场景）
- 新增 `e2e/specs/02-dashboard-empty.spec.ts`：验证空仪表盘状态 + 创建按钮可见
- **不补全所有场景**（维护成本高），仅补 1 个关键场景作为模板

### P3-10: 文档同步检查脚本
- 新增 `scripts/check-doc-sync.ps1`：检查架构现状.md 中的系统表数量、测试数量、版本号是否与代码一致
- 在 `package.json` 添加 `check:doc-sync` script

### 浏览器自主验证
- 启动 Tauri dev server，用内置 browser_use 验证 4 条核心流程：
  1. SQL 查询执行
  2. 仪表盘加载
  3. 自动化任务列表（验证新增导出按钮）
  4. 设置页切换

### 文档同步更新
- `docs/架构现状.md` v23.0 → **v24.0**：P3 项全部标记已修复/已关闭
- `docs/技术债清单_v4.md` → **v5.0**：更新状态总览（P0=0, P1=0, P2=0, P3=0）

## Impact

- **Affected specs**: 无（本 spec 是独立技术债清理任务）
- **Affected code**:
  - 后端：`src-tauri/src/services/{task,sql_snippet,migration,dashboard}_service.rs`、`src-tauri/src/models/error.rs`（新增）、`src-tauri/src/commands/sql.rs`（可选 P3-7 单 key 失效）
  - 前端：`src/components/automation/{TaskRunLogsPanel,TaskEditorModal}.tsx`、`src/components/automation/forms/`（新增子目录）、`src/components/common/QueryCacheStatsPanel.tsx`、`src/pages/ActivityLog.tsx`、`src/locales/{zh-CN,en-US}.ts`、`src/utils/errorMapping.ts`（新增）
  - 测试：`e2e/specs/02-dashboard-empty.spec.ts`（新增）
  - 脚本：`scripts/check-doc-sync.ps1`（新增）
  - 文档：`docs/架构现状.md`、`docs/技术债清单_v4.md`

## ADDED Requirements

### Requirement: P3 技术债全部清零
The system SHALL reduce all P3 technical debt items to 0 (fixed or closed).

#### Scenario: P3 清零验证
- **WHEN** 执行 P3 项扫描
- **THEN** 10 项 P3 全部标记为已修复或已关闭

### Requirement: 浏览器核心流程验证
The system SHALL pass 4 core browser verification flows after P3 cleanup.

#### Scenario: SQL 执行
- **WHEN** 用 browser_use 打开 http://localhost:1420，切到 SQL tab
- **THEN** 页面正常加载，编辑器可见

#### Scenario: 仪表盘加载
- **WHEN** 切到 dashboard tab
- **THEN** 页面正常加载，看到空状态或图表

#### Scenario: 自动化任务列表（含导出按钮）
- **WHEN** 切到 automation tab，打开任务运行日志
- **THEN** 看到"导出 CSV"按钮

#### Scenario: 设置页切换
- **WHEN** 切到 settings
- **THEN** 页面正常加载，看到设置项

## MODIFIED Requirements

### Requirement: 架构文档同步
`docs/架构现状.md` SHALL 升级到 v24.0，P3 项全部标记已修复/已关闭。

### Requirement: 技术债清单文档
`docs/技术债清单_v4.md` SHALL 升级到 v5.0，状态总览更新为 P0=0, P1=0, P2=0, P3=0。

## REMOVED Requirements

无（本 spec 不删除任何既有功能）

---

## 验收标准（Acceptance Criteria）

| AC | 标准 | 验证方式 |
|----|------|---------|
| AC-1 | `cd src-tauri; cargo check --quiet` 0 errors | programmatic |
| AC-2 | `cd src-tauri; cargo test --quiet` 313 passed / 0 failed（不回归） | programmatic |
| AC-3 | `npx tsc --noEmit --pretty` 0 errors | programmatic |
| AC-4 | `npx vitest run` 98 passed / 0 failed（不回归） | programmatic |
| AC-5 | 17 个服务层函数均有 `///` doc comment | programmatic |
| AC-6 | TaskRunLogsPanel / QueryCacheStatsPanel / ActivityLog 无硬编码中文（均用 t() 包裹） | programmatic |
| AC-7 | __automation_runs 和 __task_dependencies 有 FOREIGN KEY 约束 | programmatic |
| AC-8 | TaskEditorModal.tsx 拆分为父组件 + 4 个子表单，行数 < 600 | programmatic |
| AC-9 | 4 条浏览器核心流程全部通过 | human-judgment + screenshot |
| AC-10 | `docs/架构现状.md` v24.0，10 P3 全部标记已修复/已关闭 | human-judgment |
| AC-11 | `docs/技术债清单_v4.md` v5.0，P0=0, P1=0, P2=0, P3=0 | human-judgment |
| AC-12 | 不引入新的 P0/P1/P2 漏洞（通过对比基线扫描验证） | programmatic |

## Files Changed（预计修改范围）

### 后端 Rust
- `src-tauri/src/services/task_service.rs`（P3-1 doc + P3-4 FK DDL）
- `src-tauri/src/services/sql_snippet_service.rs`（P3-1 doc）
- `src-tauri/src/services/migration_service.rs`（P3-4 迁移脚本）
- `src-tauri/src/services/dashboard_service.rs`（P3-9 错误码示范 5 个）
- `src-tauri/src/models/error.rs`（新增 P3-9 AppError 枚举）
- `src-tauri/src/commands/sql.rs`（可选 P3-7 单 key 失效）

### 前端 TS/TSX
- `src/components/automation/TaskRunLogsPanel.tsx`（P3-8 导出 + P3-6 i18n）
- `src/components/automation/TaskEditorModal.tsx`（P3-2 拆分试点）
- `src/components/automation/forms/SqlTaskForm.tsx`（新增）
- `src/components/automation/forms/RefreshChartTaskForm.tsx`（新增）
- `src/components/automation/forms/RefreshDashboardTaskForm.tsx`（新增）
- `src/components/automation/forms/ExportCsvTaskForm.tsx`（新增）
- `src/components/common/QueryCacheStatsPanel.tsx`（P3-6 i18n）
- `src/pages/ActivityLog.tsx`（P3-6 i18n）
- `src/locales/zh-CN.ts`（新增 i18n key）
- `src/locales/en-US.ts`（新增 i18n key）
- `src/utils/errorMapping.ts`（新增 P3-9 错误码映射）

### 测试
- `e2e/specs/02-dashboard-empty.spec.ts`（新增 P3-3）

### 脚本
- `scripts/check-doc-sync.ps1`（新增 P3-10）

### 文档
- `docs/架构现状.md`（v23.0 → v24.0）
- `docs/技术债清单_v4.md`（v4.0 → v5.0）

## Open Questions

- [ ] Q1: P3-9 错误消息 i18n — 仅搭框架 + 5 个示范，剩余 190 条标记"逐步迁移"是否可接受？建议是（避免大规模改造引入风险）。
- [ ] Q2: P3-2 组件拆分 — 仅拆 TaskEditorModal 1 个试点，其余 24 个文件留作后续渐进式处理是否可接受？建议是（避免大规模重构）。
- [ ] Q3: P3-3 E2E 测试 — 仅补 1 个场景作为模板，不全量补全是否可接受？建议是（维护成本高）。

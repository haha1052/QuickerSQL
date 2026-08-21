# QuickerSQL 技术债清理 - 多角色分工实施计划（PRD）

## Overview

本 PRD 定义当前待完成的 **7 条技术债**（来源：`docs/架构现状.md` §5.2）的实施范围、验收标准、多角色分工。

**文档定位**：
- M7.1 / M7.2 / M7.3 的 **收尾工作**（基础设施已搭建，但部分 UI 暴露、旧库兼容、长列表性能等细节未落地）
- 不引入新的业务功能，只补齐"有工具但没接入"、"有接口但没暴露"的缺口

**目标受众**：
- `@后端`（Rust 层，数据库/服务层调整）
- `@前端`（TS/React 层，Store 接入与组件改造）
- `@测试`（E2E 框架搭建、用例设计）
- `@架构`（全局协调、文档更新、门禁验证）

---

## Goals

| # | 目标 | 量化描述 |
|---|------|---------|
| G1 | 查询缓存的命中率可在前端可视化 | 用户可在 Settings / 独立卡片查看 capacity/size/hits/misses/hitRate |
| G2 | 长列表（QueryHistory/TaskLogs）滚动不卡顿 | 1000+ 条历史记录的场景下，滚动帧率 ≥ 55fps，DOM 节点 ≤ 视口需求 × 1.3 |
| G3 | 旧数据库升级到 v14.0 时自动补建索引 | `migrations_service` 对缺失索引的旧库做一次性补建，不依赖用户手动重建 |
| G4 | E2E 关键路径可自动化回归 | 至少 3 条核心用户旅程（启动 → 查询 → 仪表盘 → 自动化任务）有 Playwright/tauri-driver 用例 |
| G5 | 生产代码零 `console.log` 残留 | `Get-ChildItem -Path src -Include *.ts,*.tsx -Recurse | Select-String "console\.log" | Measure-Object` → Count = 0 |

---

## Non-Goals (Out of Scope)

- ❌ 不引入新的业务功能（如 Excel 导出增强、新图表类型）
- ❌ 不重构数据库层抽象（`database/traits.rs` 保持不动）
- ❌ 不引入完整的 APM / metrics 系统（当前仅做卡片级命中监控）
- ❌ 不做国际化（留到 M8 独立里程碑）
- ❌ 不做 system-table ensure_* 的单循环合并（P3 低价值，延后处理）

---

## Background & Context

### 当前架构状态

**后端（Rust）**：
- `commands/sql.rs`：已支持 **单语句 + 多语句** 缓存命中，新增 `get_query_cache_stats`、`configure_query_cache` 命令（已验证通过 `cargo check`）
- `services/query_cache_service.rs`：LRU + TTL，容量 100，TTL 300s，默认开启；`CacheStats` 已 `#[serde(rename_all = "camelCase")]` 序列化
- `services/migration_service.rs`：在新版启动时会跑 `ensure_*` 建表，但**旧库升级流程不包含索引补建**

**前端（TS/React）**：
- `src/utils/virtual.ts`：`computeVisibleRange(index, viewportHeight, itemHeight, totalItems, overscan)` 已提供，带单元测试（`src/__tests__/virtual.test.ts` 15 用例全过）
- `src/services/tauri.ts`：**尚未暴露** `get_query_cache_stats` / `configure_query_cache`
- 长列表组件（QueryHistory 面板 / TaskLogs 面板）：**未接入**虚拟滚动，在大量历史数据下性能退化
- `console.log` 残留：需排查并移除

**测试体系**：
- `cargo test`：~154 用例通过（含 query_cache_service 内联 9 用例、sql_service 内联测试等）
- `npx vitest run`：3 files / 43 tests / 100% passed（virtual + gridLayout + filterSql）
- **E2E 测试**：尚无自动化框架，核心旅程依赖人工验证

### 为什么现在做

- **M7.2 查询缓存**：如果没有命中率监控，"缓存是否有用"不可观测
- **M7.3 测试体系**：E2E 自动化缺失导致回归风险高（尤其跨版本升级场景）
- **虚拟滚动**：工具函数已就绪但未接入，属于"半拉子工程"，影响真实用户体验
- **旧库索引**：v14.0 新增了大量索引，但老用户的 db 文件不会自动补建

---

## Functional Requirements

### FR-1：查询缓存命中率前端暴露（对应 T-002）

**Rust 层**：
- `commands/sql.rs::get_query_cache_stats`（已存在，无需修改）
- `commands/sql.rs::configure_query_cache(capacity, ttl_seconds, enabled)`（已存在，无需修改）

**TS 类型层**（`src/types/` 新增或扩展）：
```ts
export interface QueryCacheStats {
  capacity: number;
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
  enabled: boolean;
}
```

**TS 服务层**（`src/services/tauri.ts`）：
- 新增 `getQueryCacheStats(): Promise<ApiResponse<QueryCacheStats>>`
- 新增 `configureQueryCache(capacity: number, ttlSeconds: number, enabled: boolean): Promise<ApiResponse<boolean>>`
- 命令名分别为 `get_query_cache_stats`、`configure_query_cache`

**TS Store 层**（`src/store/settingsStore.ts` 或新建轻量 store action）：
- `loadCacheStats(): Promise<QueryCacheStats | null>` — 调用 tauriService 并在组件内消费
- 建议放在 `settingsStore` 下，保持与"缓存配置"语义一致

**UI 层**（QueryCacheStatsPanel 组件，挂在 Settings 面板下或 Debug 面板）：
- 卡片式展示 5 项指标（capacity/size/hits/misses/hitRate）
- hitRate 用百分比 + 进度条
- 提供"刷新"按钮手动拉取
- 提供"重置"按钮调用 `configure_query_cache`（同参数重新初始化，触发失效）
- 在 `npm run tauri dev` 启动后可见

### FR-2：虚拟滚动接入 QueryHistory / TaskLogs 面板（对应 T-003）

**受影响组件**（位于 `src/components/`，路径遵循架构约束 §1.2）：
- `src/components/queryHistory/QueryHistoryList.tsx`（或对应名称组件）
- `src/components/automation/TaskRunsPanel.tsx`（或对应名称组件）

**改造方案**：
1. 组件 render 时先计算 visible range
2. 使用 `absolute positioning + top offset` 渲染 visible items
3. 容器设置 `totalHeight` 用于滚动条比例正确
4. `overscan = 5`（`virtual.ts` 推荐值）

**验收约束**：
- 改造后的列表滚动到 1000 条记录时，DOM 节点数量 ≤ `viewportHeight / itemHeight + 2 * overscan`
- 无可见的视觉抖动（空白闪烁）；scrollTop 切换不应丢失焦点
- 不影响现有 `onClick`、`onSelect` 交互

### FR-3：索引迁移稳健化（对应 T-004）

**Rust 层**（`src/services/migration_service.rs` 或 `settings_service.rs`）：
- 在 `run_legacy_table_migrations()` 或等效初始化函数结束后，调用 `ensure_all_system_indexes()`
- `ensure_all_system_indexes()` 内容：对每个系统表对应的 `CREATE INDEX IF NOT EXISTS` 执行一次
- 幂等：重复调用不会报错，索引不存在时才创建
- 日志：`log::info!("[迁移] 系统索引已完成检查与补建，耗时 {}ms", elapsed)`

**SQL 层**：
- 使用 `CREATE INDEX IF NOT EXISTS idx_xxx ON table_name(col_name)` 形式
- 不使用 DROP + CREATE（避免破坏已有索引）

### FR-4：E2E 测试框架搭建（对应 T-005）

**技术选型**：Playwright + `@tauri-apps/plugin-*` 测试支持（或社区 tauri-driver 方案）

**文件结构**：
```
e2e/
  ├── fixtures/
  │   └── sample-project.db         (预置最小测试数据)
  ├── specs/
  │   ├── startup.spec.ts           (启动 → 状态检查)
  │   ├── sql-query.spec.ts         (执行 SQL → 看结果)
  │   ├── dashboard.spec.ts         (创建图表 → 添加到仪表盘)
  │   └── automation-task.spec.ts   (创建任务 → 立即执行 → 查看日志)
  ├── playwright.config.ts
  └── README.md                      (说明如何启动、如何在 CI 跑)
```

**用例范围**（MVP，不求全）：
- 启动场景：应用打开 → splash → 主界面可见 → 数据库已连接
- SQL 查询：打开 SQL Tab → 输入 `SELECT 1` → 执行 → 结果有一行
- 仪表盘：已有 savedChart 的情况下，创建 dashboard → 添加图表 → 渲染可见
- 自动化任务：创建一个 `manual` 类型任务 → `run_now` → 看到 run 记录

**运行命令**：
- 开发期：`npm run e2e`（或 `npx playwright test --headed`）
- CI：`npx playwright test`（headless）
- 测试门禁：**不强制阻塞** release（因 E2E 不稳定），但每次发版前应至少跑一次

### FR-5：前端 console.log 清理（对应 T-006）

**扫描命令**：
```powershell
Get-ChildItem -Path src -Include *.ts,*.tsx -Recurse |
  Select-String -Pattern 'console\.log' |
  Select-Object -First 50
```

**处理规则**：
- 调试残留 → 直接删除
- 与错误相关的 log → 改为 `console.error` / `console.warn`
- 确有必要的调试输出 → 加注释说明为何保留，并以 `// @debug` 标注（本项目目标是 Count=0）

---

## Non-Functional Requirements

| # | 需求 | 量化标准 |
|---|------|---------|
| NFR-1 | 编译门禁 | `cargo check --quiet` 通过；`npx tsc --noEmit --pretty` 通过 |
| NFR-2 | 单元测试门禁 | `cargo test --quiet` 154 passed / 0 failed；`npx vitest run` 43 tests / 100% |
| NFR-3 | SQL 注入门禁 | `Get-ChildItem -Path src-tauri/src -Include *.rs -Recurse | Select-String 'format!.*"SELECT\|format!.*"INSERT'` → Count = 0 |
| NFR-4 | 敏感字符串门禁 | `Get-ChildItem -Path src-tauri/src,src -Include *.rs,*.ts,*.tsx -Recurse | Select-String 'sk-\|Bearer \|password:'` → Count = 0 |
| NFR-5 | 新增代码必须有测试 | 所有新增 `*.rs` 函数应有内联 `mod tests`；所有新增 TS 工具函数应有 `__tests__` 覆盖 |
| NFR-6 | 性能不退化 | 启动时间、SQL 执行时间对比 v14.0 baseline 无显著退化（≤ ±5%） |
| NFR-7 | 向后兼容 | 旧版本 db 文件打开后，自动完成索引补建，不丢失数据 |

---

## Constraints

- **技术**：不得引入新的重型依赖（如完整 ORM、大型状态库）；虚拟滚动仅复用 `src/utils/virtual.ts`，无需引入 `@tanstack/react-virtual`
- **业务**：不得破坏现有用户数据；新增的缓存配置命令应带默认值，即便前端不传参也能工作
- **文档**：所有改动完成后，更新 `docs/架构现状.md` 的 "待完成技术债" 列表，把完成的条目移动到 "已完成的技术债"
- **分层**：严格遵循 architecture.md —— 组件层不直接 `invoke()`；commands 层不直连 DB 拼接 SQL

---

## Assumptions

- 本地开发环境已安装：Rust toolchain（rustc ≥ 1.75）、Node.js（≥ 18）、npm
- Playwright 依赖需要单独 `npx playwright install`（在 README 中注明）
- Tauri v2 的 `tauri-driver` / Playwright 支持在本机器上可用；如遇兼容性问题，降级为"记录手动测试步骤清单"方案

---

## Acceptance Criteria

### AC-1：查询缓存 stats 前端暴露（G1）

- **Given** 用户已打开 QuickerSQL 应用
- **When** 进入 Settings 面板 → 找到"查询缓存"卡片
- **Then** 可以看到 capacity/size/hits/misses/hitRate 5 个字段，且 hitRate 以百分比显示
- **Verification**: programmatic（`tauriService.getQueryCacheStats()` 返回字段非空；UI 组件能渲染）
- **Notes**: 命中数为 0 时 hitRate 显示 0%，不抛 NaN

### AC-2：虚拟滚动接入（G2）

- **Given** QueryHistory / TaskLogs 面板有 ≥ 1000 条测试数据
- **When** 用户滚动浏览全表
- **Then** 滚动帧率 ≥ 55fps，DOM 节点数量稳定在视口需求范围内
- **Verification**: programmatic（通过 Chrome DevTools 的 Performance 面板可验证；或写一个简单的 DOM 计数器脚本）
- **Notes**: 滚动到首尾边界不应抛错

### AC-3：索引迁移稳健化（G3）

- **Given** 用户有一个 v13.0 的旧 db 文件（没有 v14.0 新增索引）
- **When** 在应用中打开该文件 → 触发初始化流程
- **Then** 所有 `CREATE INDEX IF NOT EXISTS` 被执行一次，日志有明确输出；查询历史、仪表盘等常用路径性能 ≥ baseline
- **Verification**: programmatic（在 SQLite CLI 中跑 `SELECT name FROM sqlite_master WHERE type='index'` 对比）

### AC-4：E2E 测试可跑（G4）

- **Given** 已安装 Playwright 依赖（`npm i -D @playwright/test && npx playwright install`）
- **When** 执行 `npm run e2e`
- **Then** 至少 3/4 用例通过（startup + sql-query + 一个 dashboard 或 automation-task）
- **Verification**: programmatic
- **Notes**: 若 tauri-driver 不可用，接受降级为"手动测试脚本"文档

### AC-5：console.log 清零（G5）

- **Given** 前端源码目录 `src/`
- **When** 执行 PowerShell 检测命令
- **Then** `console.log` 的匹配项 Count = 0
- **Verification**: programmatic

### AC-6：全量门禁通过

- **Given** 完成所有上述改动
- **When** 在项目根目录执行：
  1. `cd src-tauri; cargo check --quiet`
  2. `cargo test --quiet`
  3. `cd ..; npx tsc --noEmit --pretty`
  4. `npx vitest run`
  5. PowerShell 安全扫描命令（§ security.md）
- **Then** 全部 5 项通过，无 error / failing test / security issue
- **Verification**: programmatic

---

## Open Questions

- [ ] Q1：查询缓存卡片放在哪个面板？建议 Settings > 高级，还是单独的 Debug 面板？
- [ ] Q2：虚拟滚动是否同时覆盖"表格数据浏览器"（长数据表预览）场景？本 PRD 默认仅覆盖 QueryHistory / TaskLogs，避免范围失控
- [ ] Q3：E2E 测试是否需要纳入 CI 流程？建议初期人工跑，稳定后接入
- [ ] Q4：旧库索引补建是一次性还是每次启动都检查？建议"启动时检查（CREATE INDEX IF NOT EXISTS）+ 一次性完成后不再打印冗长日志"

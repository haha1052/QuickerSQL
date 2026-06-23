# M8 里程碑 - 产品需求文档

## Overview

- **Summary**：在 M7 架构基础上，补齐四项产品能力——国际化（中英文双语 UI）、端到端自动化测试、查询缓存面板增强（实时刷新 + 命中率曲线 + 清除缓存）、以及长列表虚拟滚动深度接入。目标是：让用户在多语言、大规模数据、长会话场景下获得一致、流畅的使用体验。

- **Purpose**：解决当前以下四大痛点：
  1. 大量 UI 文本仍使用硬编码中文，无法为英文用户服务
  2. 核心用户旅程没有自动化测试覆盖，回归风险高
  3. 查询缓存面板只展示快照，缺乏动态反馈
  4. 回收站、图表库、审计日志等长列表没有虚拟化渲染，大数据量下滚动卡顿

- **Target Users**：
  - 使用 QuickerSQL 进行日常数据查询与报表制作的工程师与分析师
  - 大规模数据（万行级表）、长会话（查询历史上千条）的重度用户
  - 使用英文操作系统的团队成员

---

## Goals

- **G1（国际化）**：应用所有可见中文文案都通过 i18n key 渲染；用户可在设置面板切换 zh-CN / en-US，切换后 UI 文本、Toast 消息、图表标题、按钮文本全部同步更新，无需重启。
- **G2（E2E 自动化）**：为 4 个核心用户旅程（查询、仪表盘、回收站、自动化任务）提供可重复运行的 Playwright + Tauri-driver 测试，任意修改后一键回归。
- **G3（缓存面板增强）**：QueryCacheStatsPanel 新增"自动刷新"开关（5 秒轮询）、"命中率趋势"折线图（最近 20 次采样）、"清除缓存"按钮；后端新增 `clear_query_cache` 命令。
- **G4（虚拟滚动深化）**：`TrashPanel`、`ChartLibraryPanel`、`ActivityLog` 三处长列表接入 `computeVisibleRange` 实现虚拟化渲染；在 1000+ 条数据下滚动帧速率 ≥ 50 FPS。

## Non-Goals（Out of Scope）

- ❌ 不做 i18n 的多语言以外的国际化（时区、货币本地化等，保留为未来任务）
- ❌ 不做移动端 / 多端支持
- ❌ 不做数据库表级别的缓存策略（当前仅保留语句级）
- ❌ 不做组件库级别的虚拟滚动抽象（继续使用现有 `utils/virtual.ts` 纯函数）
- ❌ 不引入 Playwright 以外的测试框架（例如 Cypress）
- ❌ 不引入 `react-i18next` 等外部库（项目已有 LocaleContext，应保持零新增依赖）

---

## Background & Context

### 现状评估

| 模块 | 现状 | 问题 |
|------|------|------|
| i18n | `src/context/LocaleContext.tsx` 已提供 `t()` 函数与 zh-CN / en-US 翻译表；约 70+ 个文件中存在硬编码中文文本或 key 未补全的英文 | 大量组件仍使用 `"新建项目"`、"导入成功" 等硬编码，切换语言无效 |
| E2E 测试 | 项目根目录无 `e2e/` 目录，无 Tauri-driver 相关配置；已有 `npm test` 跑单元测试 | 核心用户旅程零自动化覆盖，每次大改全靠人工回归 |
| 查询缓存面板 | `QueryCacheStatsPanel.tsx` 展示 capacity / size / hits / misses / hitRate / enabled，仅支持手动点击刷新 | 没有趋势，无法判断缓存命中是偶发还是持续；无清理入口 |
| 虚拟滚动 | `utils/virtual.ts` 提供 `computeVisibleRange`；QueryHistory 与 TaskRunLogsPanel 已接入 | 回收站、图表库、审计日志等列表未接入，数据量大时掉帧 |

### 技术约束

- 零新增 npm 依赖（i18n 继续使用现有 LocaleContext；测试继续使用 Playwright）
- 不修改 `src-tauri/src/models/*.rs` 数据结构（除非新命令确实需要新增返回类型）
- 前端保留 React 19 + TypeScript 严格模式；不引入 `any`
- 所有新增 `#[tauri::command]` 必须同时在 `src/services/tauri.ts` 中新增对应封装
- 所有新增功能需满足 cargo check / npx tsc 双门禁通过

### 设计原则

1. **渐进迁移**：i18n 翻译表按组件/领域分批扩展，避免一次性大改
2. **防御式 i18n**：`t(key)` 在 key 不存在时回退到 key 本身（或 zh-CN 值），避免空白 UI
3. **测试独立**：E2E 测试使用 `tauri-driver` 协议连接应用窗口，不依赖后端内部状态
4. **性能优先**：虚拟滚动使用绝对定位 + `totalHeight` 占位，不触发全量 re-render
5. **无侵入增强**：缓存面板作为独立组件，不修改其它业务代码

---

## Functional Requirements

### FR-1：语言切换与设置持久化

- 设置面板新增"语言"下拉选择器，选项为 `简体中文（zh-CN）` / `English（en-US）`
- 切换语言后，应用中所有可见文本立即更新，不丢失当前工作状态
- 语言设置通过 `__settings` 表持久化（category=`locale`, key=`language`），下次启动自动恢复
- 默认语言：首次启动使用 `zh-CN`

### FR-2：全量 i18n key 覆盖

- 以下目录下的所有可见文本必须通过 `t(key)` 渲染：
  - `src/components/**`
  - `src/pages/**`
  - `src/store/**` 中的 Toast / 状态文字
- 翻译 key 遵循 `领域.操作/名词` 命名，例如：`common.confirm`、`queryHistory.empty`、`trash.restoreSuccess`
- ag-grid 的 `localeText` 通过 LocaleContext 提供（已有雏形，需对齐语言切换）
- `t(key)` 支持插值变量：`t("import.addedFiles", { count: 10 })` → `已添加 10 个文件`

### FR-3：E2E 测试框架搭建

- 新建 `e2e/` 目录，内置：
  - `playwright.config.ts`（配置 use: { channel: "chrome" } 或 tauri-driver 连接）
  - `specs/` 目录下 4 个 spec 文件，分别对应 4 个用户旅程
  - `e2e/README.md`，说明如何本地运行（`npm run e2e:headed` / `npm run e2e`）
- `package.json` 新增 `"e2e"` 与 `"e2e:headed"` 两个脚本
- 不需要 CI 集成（留作后续里程碑）

### FR-4：核心用户旅程覆盖

**Journey 1：创建项目 → 导入数据 → 查询**
- 通过 E2E 模拟创建项目（使用临时数据库路径），导入 CSV，执行 `SELECT *`，断言结果非空

**Journey 2：回收站恢复与永久删除**
- 创建一张表 → 删除（进入回收站）→ 恢复 → 查询（可查到）→ 再次删除 → 永久删除 → 查询失败

**Journey 3：仪表盘 → 新增图表 → 编辑 → 删除**
- 创建仪表盘 → 添加一个图表 → 修改图表配置 → 删除图表 → 删除仪表盘

**Journey 4：自动化任务 → 创建 → 执行 → 查看日志**
- 创建一次性 SQL 任务 → 立即执行 → 查看日志列表 → 删除任务

### FR-5：查询缓存面板增强

- 新增"自动刷新"开关：开启后每 5 秒调用 `get_query_cache_stats` 刷新数据
- 新增命中率趋势折线图：在内存中保留最近 20 次采样，绘制一条 ECharts 折线图（不需要持久化）
- 新增"清除缓存"按钮：调用 `clear_query_cache` 命令，清空缓存后立即刷新一次面板
- 新增"应用配置"按钮：调整 `capacity` / `ttl_seconds` / `enabled` 后生效（已存在，仅在增强中确保视觉一致）

### FR-6：后端 `clear_query_cache` 命令

- 新增 `#[tauri::command] fn clear_query_cache() -> Result<bool, String>`，调用 `query_cache_service::invalidate_all()`
- 对应前端 `tauriService.clearQueryCache()` 方法封装
- 不修改 `query_cache_service.rs` 内部结构，仅暴露已有方法

### FR-7：虚拟滚动在三大面板接入

- **TrashPanel（回收站）**：使用 `computeVisibleRange`，每条条目固定高度 `72px`
- **ChartLibraryPanel（图表库）**：使用 `computeVisibleRange`，每条条目固定高度 `96px`
- **ActivityLog / QueryHistory（如果尚未接入）**：统一接入，固定高度 `64~96px`
- 每个虚拟滚动组件需维护自身 `scrollTop` 状态，不可通过全局 store 共享
- 不做动态 item 高度（当前实现不支持，未来独立任务）

---

## Non-Functional Requirements

### NFR-1：零新增依赖

- i18n 不引入 `react-i18next` / `i18next`
- E2E 仅引入 `@playwright/test`（如尚未安装则必要安装，否则不新增）
- 虚拟滚动与缓存增强完全复用现有代码结构

### NFR-2：类型安全

- 不使用 `any` 类型
- 新命令的返回值在 TypeScript 端有显式 interface 定义
- i18n key 通过 TypeScript `keyof typeof zhCNTranslations` 约束，避免拼写错误

### NFR-3：门禁通过

- `cargo check --quiet` 无错误
- `npx tsc --noEmit --pretty` 无错误
- `npx vitest run` 全部通过
- `cargo test --quiet` 全部通过

### NFR-4：性能指标

- 1000 条数据下，TrashPanel / ChartLibraryPanel 滚动帧速率 ≥ 50 FPS（由人工验证或 Profiler 记录）
- 查询缓存面板开启自动刷新后，CPU 占用无明显上升（≤ 2% 单核心增量）

### NFR-5：i18n 覆盖度量

- 对 `src/components/**` 和 `src/pages/**` 做正则扫描，要求 `"中文字符"` 字面量数量 ≤ 0（允许注释内的中文说明，不允许 JSX 文本/字符串中的中文）

### NFR-6：视觉一致性

- 语言切换后，UI 不会出现溢出（按钮宽度足够容纳英文）
- 长英文不会导致横向滚动条
- Toast 消息的最大宽度保持一致

### NFR-7：代码风格

- 所有新增代码遵循 `coding.md` 约定
- Rust 函数使用 snake_case，TypeScript 组件使用 PascalCase，变量使用 camelCase
- 新增方法必须有 JSDoc 或 Rust doc comment

---

## Constraints

- **Technical**：React 19、TypeScript 严格模式、Tauri v2、SQLite + DuckDB；不得引入新 npm 包（除 `@playwright/test` 外）
- **Business**：本次里程碑不涉及付费功能、无登录鉴权
- **Dependencies**：Playwright 依赖系统浏览器（Chromium）；Tauri-driver 需要本地 `cargo install tauri-driver` 或等价步骤；如环境不具备，测试脚本需输出清晰错误提示

## Assumptions

- 假设用户浏览器/系统支持 UTF-8 文本渲染
- 假设 1000 条数据是典型使用场景的上界；不做 10 万级虚拟滚动优化
- 假设 Playwright 能通过 Tauri-driver 协议连接到应用窗口；如环境受限，E2E 脚本会标记 `skip` 并输出说明

## Open Questions

- [ ] Q1：是否需要提供语言切换的快捷键（如 Ctrl+L）？→ **默认不做，如需要后续单独任务**
- [ ] Q2：E2E 测试数据是否需要固定的"种子数据库"文件？→ **使用内存数据库或临时路径，不持久化**
- [ ] Q3：命中率趋势是否保留到磁盘？→ **不保留，仅内存环形缓冲，重启清空**
- [ ] Q4：虚拟滚动是否需要支持动态 item 高度？→ **本里程碑不支持，使用固定高度**

---

## Acceptance Criteria

### AC-1：语言设置 UI 可用
- **Given** 用户打开设置面板 → **When** 点击 "English" → **Then** 应用所有文本在 300ms 内切换为英文；关闭并重新打开应用，语言仍为英文
- **Verification**：programmatic（组件测试验证 `t("locale.language.en-US")` 渲染值）+ human-judgment（视觉检查）

### AC-2：i18n key 全覆盖（零硬编码中文）
- **Given** 代码库内所有业务组件 → **When** 执行中文文本扫描（排除注释与 CSS）→ **Then** 扫描命中数 = 0
- **Verification**：programmatic（`Get-ChildItem -Path src -Include *.ts,*.tsx -Recurse | Select-String -Pattern '[\u4e00-\u9fa5]'`，排除注释行）

### AC-3：翻译一致性
- **Given** zh-CN 与 en-US 两份翻译表 → **When** 对比 key 集合 → **Then** 两者 key 完全相同（无缺失，无冗余）
- **Verification**：programmatic（Node 脚本对比 JSON key 集合）

### AC-4：t() 函数插值支持
- **Given** `t("import.addedFiles", { count: 10 })` → **Then** 返回字符串包含数字 10 且格式正确
- **Verification**：programmatic（vitest 单元测试）

### AC-5：E2E 测试框架就绪
- **Given** 项目根目录执行 `npm run e2e -- --list` → **Then** 至少识别到 4 个 spec 文件
- **Verification**：programmatic

### AC-6：核心旅程测试通过
- **Given** 本地已启动或可启动应用窗口 → **When** 执行 `npm run e2e` → **Then** 至少 3/4 旅程 100% 通过（受浏览器环境限制的 journey 允许被 skip 并输出原因）
- **Verification**：programmatic（Playwright 退出码 0 且报告显示通过）

### AC-7：clear_query_cache 命令可用
- **Given** 缓存中已有数据（hits > 0） → **When** 调用 `clear_query_cache` → **Then** 下次 `get_query_cache_stats` 返回 size=0、hits=0、misses=0
- **Verification**：programmatic（Rust 单元测试 + 前端集成测试）

### AC-8：缓存面板实时刷新
- **Given** 用户打开缓存面板 → **When** 开启"自动刷新" → **Then** 每 5 秒看到 hits 数据有更新（如果用户在另一个窗口执行查询）
- **Verification**：human-judgment（开发者手动双窗口验证）+ programmatic（测试 setInterval 调用至少触发一次更新）

### AC-9：缓存面板命中率折线图
- **Given** 用户连续执行 10 次相同查询 → **When** 观察折线图 → **Then** 折线图有可见的 up/down 变化，hitRate 最终接近 90%
- **Verification**：human-judgment

### AC-10：虚拟滚动在 TrashPanel 生效
- **Given** 回收站有 1000 条假数据 → **When** 滚动列表 → **Then** 滚动平滑（无明显空白闪白区域，除 overscan 外）；DevTools Elements 中可见条目数量固定（≈ 视口容量 + overscan）
- **Verification**：programmatic（检查 DOM 中实际渲染的条目数量 ≪ 总数据量）+ human-judgment

### AC-11：虚拟滚动在 ChartLibraryPanel 生效
- **Given** 图表库有 500 张图表 → **When** 滚动 → **Then** 行为同 AC-10
- **Verification**：programmatic + human-judgment

### AC-12：类型与编译门禁
- **Given** 任何提交 → **When** 执行 `cargo check --quiet` 和 `npx tsc --noEmit --pretty` → **Then** 两者输出 0 errors
- **Verification**：programmatic

### AC-13：测试门禁
- **Given** 任何提交 → **When** 执行 `cargo test --quiet` 和 `npx vitest run` → **Then** 两者全部通过
- **Verification**：programmatic

### AC-14：中文硬编码门禁
- **Given** 代码库 → **When** 扫描 `src/components/**/*.tsx` 与 `src/pages/**/*.tsx` 中的中文字符串（非注释、非 `t()`）→ **Then** 结果为 0 条
- **Verification**：programmatic（PowerShell grep + 行内过滤）

---

## Files Changed

### 新建文件（New）
- `e2e/playwright.config.ts` — E2E 测试配置
- `e2e/specs/journey-project-import-query.spec.ts` — 创建/导入/查询
- `e2e/specs/journey-trash-restore-delete.spec.ts` — 回收站操作
- `e2e/specs/journey-dashboard-chart.spec.ts` — 仪表盘与图表
- `e2e/specs/journey-automation-task.spec.ts` — 自动化任务
- `e2e/README.md` — 运行说明
- `src/__tests__/i18n.test.tsx` — i18n key 一致性与插值测试
- `src/__tests__/query-cache-panel.test.tsx` — 缓存面板行为测试

### 修改文件（Modify）
- `src/context/LocaleContext.tsx` — 新增 `setLocale`，补全 missing keys，强化插值支持
- `src/components/**/*.tsx`（约 30~40 个组件）— 用 `t(key)` 替换硬编码中文
- `src/pages/Settings.tsx` — 新增语言切换 UI
- `src/store/settingsStore.ts` — 新增 `updateLocale` 方法
- `src/components/settings/QueryCacheStatsPanel.tsx` — 自动刷新、折线图、清除缓存按钮
- `src/services/tauri.ts` — 新增 `clearQueryCache()` 方法
- `src/components/trash/index.tsx` — 接入虚拟滚动
- `src/components/dashboard/ChartLibraryPanel.tsx` — 接入虚拟滚动
- `src/pages/ActivityLog.tsx` — 接入虚拟滚动（如存在）
- `src-tauri/src/commands/settings.rs`（或对应命令模块）— 新增 `clear_query_cache` 命令
- `src-tauri/src/lib.rs` — 注册新命令
- `package.json` — 新增 `e2e`、`e2e:headed` 脚本
- `docs/架构现状.md` — 更新 M8 版本记录（非代码，由文档角色更新）

---

## Summary of Scope Boundaries

| 维度 | 范围 |
|------|------|
| **修改行数预估** | ≈ 1500~2500 行（以硬编码迁移为主） |
| **新增文件** | ≈ 10 个（E2E 配置与 spec、测试文件） |
| **新增依赖** | 仅 `@playwright/test`（如尚未安装） |
| **新增 Rust 命令** | 1 个（`clear_query_cache`） |
| **是否需要迁移脚本** | 不需要 |
| **是否破坏现有功能** | 否（i18n 切换是无损的；缓存与虚拟滚动增强是加性的） |

---

**文档维护说明**：本 spec.md 为 M8 实施的唯一需求来源。任何范围变更须先在此文档中更新，再同步更新 `tasks.md` 与 `checklist.md`。

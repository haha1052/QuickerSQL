# QuickerSQL M7 里程碑多角色详细实施方案

> **版本：** v1.0
> **日期：** 2026-06-21
> **维护者：** QuickerSQL 架构组
> **前置条件：** M1-M6 功能已完成（v12.5 基线），架构分层已满足
> **对应 M3-M8 文档：** §7 M7——性能优化与测试（第15-16周）

---

## 一、M7 里程碑重新定义（统一双文档口径）

### 1.1 M7 是什么

> **M7 定义（与 M3-M8详细实施计划.md §7 对齐，兼顾架构现状文档已完成的工作）：**
>
> M7 = **M7.1 架构质量基线**（v12.5 已完成） + **M7.2 性能优化**（待启动） + **M7.3 测试体系完善**（待启动）

| 子阶段 | 名称 | 对应文档 | 状态 | 验收标准 |
|--------|------|---------|------|---------|
| **M7.1** | 架构质量基线（7/7 条件） | 架构现状 §"M7 架构分层里程碑" | ✅ **已完成** | commands 层 0 处直连 DB + 6 项其他质量门禁 |
| **M7.2** | 性能优化 | M3-M8详细实施计划 §7.1 | 🔴 **待启动** | 查询性能提升 50% / 内存占用降低 30% / 启动 <5s |
| **M7.3** | 测试体系完善 | M3-M8详细实施计划 §7.2 | 🔴 **待启动** | 后端核心逻辑测试覆盖率 >80% / 前端核心组件测试覆盖率 >70% / 4 个 E2E 场景 |

### 1.2 M7 总时间规划

| 阶段 | 周次 | 工作量（人周） | 主要产出 |
|------|------|---------------|---------|
| **第 1 周（M7.2 性能优化）** | 第15周 | 2人 × 0.5周 = 1人周 | 索引优化方案、缓存策略实现、性能基准报告 |
| **第 2 周（M7.3 测试体系）** | 第16周 | 2人 × 1周 = 2人周 | 测试目录规范、核心测试用例、覆盖率报告 |
| **合计** | **2周** | **3人周** | M7 完整交付物 |

---

## 二、角色分工总览

> M7 涉及两个核心角色：**@后端**（负责性能优化 + 测试体系）、**@前端**（负责测试体系 + 前端性能优化）。**@架构**负责全局协调和合规检查。

| 角色 | 职责 | M7.2 参与度 | M7.3 参与度 | 主要交付物 |
|------|------|-------------|-------------|-----------|
| **@架构** | 全局协调 + 架构合规检查 + 文档更新 | 🔵 40% | 🔵 40% | M7 实施计划、更新架构现状文档 |
| **@后端** | Rust 性能优化 + 测试用例编写 | 🔴 100% | 🟠 60% | 索引优化、缓存实现、Rust 单元测试、数据库层测试 |
| **@前端** | React/Vite/TypeScript 性能优化 + 前端测试 | 🟡 30% | 🔴 100% | 代码分割、懒加载、虚拟列表、Vitest 测试框架、组件测试 |

### 角色详细职责矩阵

```
@架构 ─┬── 定义 M7 的目标、里程碑和验收标准
       ├── 制定实施计划和优先级矩阵
       ├── 协调 @后端 和 @前端 的工作边界和依赖关系
       ├── 审核所有修改是否符合 architecture.md/coding.md/security.md
       ├── 更新架构现状文档的 M7 章节
       └── 主持 M7 完成评估会议

@后端 ─┬── M7.2.1 数据库索引优化分析与实施
       ├── M7.2.2 查询优化分析与实施
       ├── M7.2.3 缓存机制设计与实现
       ├── M7.2.4 连接池管理优化
       ├── M7.3.1 数据库层测试（database/tests.rs）
       ├── M7.3.2 服务层单元测试（各 *_service.rs 内联 mod tests）
       └── M7.3.3 命令层测试（commands/*_test.rs，可选）

@前端 ─┬── M7.2.5 前端代码分割
       ├── M7.2.6 组件懒加载
       ├── M7.2.7 虚拟列表实现
       ├── M7.2.8 图片懒加载优化
       ├── M7.3.4 前端测试框架搭建（Vitest）
       ├── M7.3.5 组件测试（src/__tests__/components/）
       ├── M7.3.6 服务层测试（src/__tests__/services/）
       └── M7.3.7 Hook 测试（src/__tests__/hooks/）
```

---

## 三、M7.2：性能优化详细实施计划

### 3.1 M7.2.1 数据库索引优化（@后端，估计工作量：8小时）

**现状分析**：
- 所有用户表完全依赖 `ROWID` 索引，无任何业务索引
- `__automation_tasks` 有 `next_run_at` 但无索引 → 定时任务全表扫描
- `__automation_task_runs` 有 `task_id` 但无索引 → 关联查询全表扫描
- `__audit_logs` 按时间查询但无 `created_at` 索引

**优化方案**：

| # | 表 | 建议索引 | 理由 | 预计收益 |
|---|----|---------|------|---------|
| 1 | `__automation_tasks` | `CREATE INDEX idx_automation_tasks_next_run ON __automation_tasks(next_run_at, is_enabled)` | 任务调度查询条件（下次运行时间+启用状态） | O(n) → O(log n) |
| 2 | `__automation_task_runs` | `CREATE INDEX idx_task_runs_task_id ON __automation_task_runs(task_id)` | 按任务查运行日志 | O(n) → O(log n) |
| 3 | `__automation_task_runs` | `CREATE INDEX idx_task_runs_created ON __automation_task_runs(created_at)` | 时间范围查询 | O(n) → O(log n) |
| 4 | `__audit_logs` | `CREATE INDEX idx_audit_logs_created ON __audit_logs(created_at)` | 审计日志时间查询 | O(n) → O(log n) |
| 5 | `__query_history` | `CREATE INDEX idx_query_history_executed ON __query_history(executed_at DESC)` | 查询历史按时间排序 | O(n log n) → O(log n) |
| 6 | `__saved_charts` / `__saved_dashboards` | `CREATE INDEX idx_saved_xxx_updated ON __saved_xxx(updated_at DESC)` | 按更新时间排序 | O(n log n) → O(log n) |

**实施步骤**：
1. 在 `migration_service.rs` 中新增 `v13_apply_optimization_indexes` 迁移方法
2. 在 `get_startup_status()` 调用链中确保启动时自动执行
3. 索引创建使用 `CREATE INDEX IF NOT EXISTS`，保证幂等性
4. 新增 `apply_index_creation()` 辅助方法，集中管理索引创建
5. 迁移完成后，在 `__app_state` 记录表 `{ "index_version": "v13" }`

**验证方法**：
- `sqlite3 db.sqlite3 ".indices"` → 列出所有索引
- `EXPLAIN QUERY PLAN SELECT * FROM __automation_tasks WHERE next_run_at < datetime('now')` → 检查是否使用索引

### 3.2 M7.2.2 查询优化（@后端，估计工作量：4小时）

**现状分析**：
- `PRAGMA table_info(table_name)` 在 `get_columns` 中可能频繁调用
- 多个 service 方法在列表展示时对**每张表**执行 COUNT(*)，造成 O(n) 次查询
- `refresh_dashboard` 对每个组件执行独立查询，无查询合并

**优化方案**：

| # | 优化点 | 文件位置 | 方案 | 收益 |
|---|--------|---------|------|------|
| 1 | 批量查询表元信息 | `database_service.rs` | 改 `SELECT name FROM sqlite_master WHERE type='table'` + 一次性生成表名列表，避免对每张表单独查询 | 表数量从 O(n) → O(1) |
| 2 | `__query_history` 分页 | `query_history_service.rs` | 添加 `LIMIT/OFFSET` 支持，避免一次返回全部历史 | UI 响应速度提升 |
| 3 | `get_table_info` 缓存表信息 | `database_service.rs` | 在 app_state 中缓存表信息（5分钟 TTL） | 元信息查询减少 80% |
| 4 | 避免重复查询 | `settings_service.rs` | 启动时批量读取，缓存至内存 | 设置项查询从 O(n) → O(1) |

### 3.3 M7.2.3 缓存机制设计与实现（@后端，估计工作量：8小时）

**现状分析**：当前完全无任何缓存，每次查询都直接访问数据库。

**缓存架构设计**：

```
┌────────────────────────────────────────────────────────────┐
│                      QueryCacheService                       │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  LRU Cache（容量：100 条目，TTL：5 分钟）                │ │
│  │  Key: <sql_hash, params_hash>  Value: QueryResult       │ │
│  └───────────────────────────────────────────────────────┘ │
│                         ▲                                    │
│                        查询命中                              │
│                         │                                    │
│  ┌──────────────────────┴───────────────────────────────┐   │
│  │  缓存策略：                                          │   │
│  │  • 写操作自动清除缓存（INSERT/UPDATE/DELETE）        │   │
│  │  • SELECT 查询走缓存（可通过 "/* NO_CACHE */" 绕过） │   │
│  │  • DROP TABLE 清除该表相关缓存                       │   │
│  │  • 手动刷新：__app_state.cache_version 递增触发全清  │   │
│  └───────────────────────────────────────────────────────┘   │
│                         ▲                                    │
│                        写入缓存                               │
│                         │                                    │
│  ┌──────────────────────┴───────────────────────────────┐   │
│  │  SQLite / DuckDB 底层驱动                            │   │
│  │  所有查询先检查 QueryCacheService                    │   │
│  └───────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
```

**新增文件**：`src-tauri/src/services/query_cache_service.rs`

```rust
//! 查询缓存服务（M7.2.3 新增）
//!
//! 基于 LRU 策略的 SQL 查询结果缓存。
//! 仅缓存 SELECT 查询；任何写操作都会触发缓存清除。
//!
//! 设计原则：
//! - 简单可靠（简单的 HashMap + TTL，不引入外部依赖）
//! - 可观测（提供缓存命中率/命中率统计）
//! - 可禁用（通过 settings 开关）
//! - 安全（缓存内容在内存中，进程退出自动丢失）
```

**核心实现点**：
1. `struct QueryCacheEntry { result: QueryResult, timestamp: Instant }`
2. `struct QueryCacheService { inner: Mutex<LRUCache<String, QueryCacheEntry>> }`
3. `QueryCacheService::get(sql_hash: &str) -> Option<QueryResult>`
4. `QueryCacheService::set(sql_hash: &str, result: QueryResult)`
5. `QueryCacheService::invalidate_all()` — 写操作后调用
6. `QueryCacheService::stats() -> (hits, misses, hit_rate)` — 监控指标

**配置项**（通过 `__settings` 管理）：
- `cache.enabled: bool = true`
- `cache.capacity: i64 = 100`
- `cache.ttl_seconds: i64 = 300`（5分钟）

### 3.4 M7.2.4 连接池管理优化（@后端，估计工作量：4小时）

**现状分析**：当前每个查询/操作会通过 `state.db_manager.get_connection()` 获取连接，连接管理在 `Mutex` 内部，但没有真正的连接池机制。

**优化方案**：
- 评估当前连接管理是否已经满足性能需求（当前单用户桌面应用，连接池可能是**过度优化**）
- 优先考虑在 `db_manager` 中增加连接复用统计（日志）
- 如果性能测试显示连接管理成为瓶颈，则考虑引入连接池（如 `r2d2` 或自建池）

**建议**：**在 M7 第一阶段，这一步可跳过**。优先把精力放在索引优化 + 查询缓存上，如果这两者带来的性能提升仍不够，再考虑连接池。把连接池作为 M7.2 的**可选增强项**。

### 3.5 M7.2.5 前端代码分割与懒加载（@前端，估计工作量：6小时）

**现状分析**：
- Vite 默认打包为单一大文件（main chunk + vendor chunk）
- DashboardPage、TaskCenterPage、SettingsPage 等组件在首次加载时全部加载
- 没有路由级代码分割

**优化方案**：

```
修改前：
  src/App.tsx
    ├── import DashboardPage from './components/dashboard/DashboardPage'
    ├── import TaskCenterPage from './components/automation/TaskCenterPage'
    └── import SettingsPanel from './components/settings/SettingsPanel'

修改后：
  src/App.tsx
    ├── const DashboardPage = lazy(() => import('./components/dashboard/DashboardPage'))
    ├── const TaskCenterPage = lazy(() => import('./components/automation/TaskCenterPage'))
    └── const SettingsPanel = lazy(() => import('./components/settings/SettingsPanel'))
    
    配合 Suspense 加载状态：
    <Suspense fallback={<LoadingSpinner />}>
      <DashboardPage />
    </Suspense>
```

**具体实施步骤**：
1. 识别 4-6 个最大的独立页面组件（Dashboard、TaskCenter、Settings、QueryHistory、Import）
2. 对每个页面引入 `React.lazy` + `Suspense`
3. 为 `Suspense` 设计统一的 `LoadingSpinner` 组件（简洁、与主题一致）
4. 测试每个懒加载组件的加载状态和错误处理
5. 构建后验证生成了独立的 chunk 文件（`npm run build` → 检查 dist/assets/ 目录）

### 3.6 M7.2.6 虚拟列表优化（@前端，估计工作量：6小时）

**现状分析**：
- 审计日志列表、查询历史列表、任务运行日志列表等可能有 1000+ 条目
- 当前全部渲染，无虚拟滚动

**优化方案**：
- 使用 `@tanstack/react-virtual`（轻量级虚拟滚动库）或自实现简单的 `IntersectionObserver` 方案
- 至少应用于以下组件：
  - `components/query-history/index.tsx` → 历史列表
  - `components/automation/TaskRunLogsPanel.tsx` → 任务运行日志
  - `components/common/TableView` → 通用大数据列表（如有）

**实施步骤**：
1. 在 `package.json` 中新增 `@tanstack/react-virtual` 依赖
2. 在 `utils/virtual.ts` 中创建一个轻量的虚拟列表 hook 封装
3. 逐一改造上述组件，每个组件预留 1 小时的调试和样式适配时间
4. 添加滚动条高度、容器高度等 CSS 细节

### 3.7 M7.2.7 图片优化（@前端，估计工作量：2小时）

**现状分析**：当前桌面应用，图片主要是 Chart 渲染后的导出图片。

**优化方案**：
- 主要针对图表导出的 PNG 生成进行优化
- 评估是否需要图片压缩或懒加载
- 如果没有大量图片使用，此项可大幅简化或跳过

**建议**：标记为**低优先级**（M7.2 的可选增强项），专注于前面的核心优化。

---

## 四、M7.3：测试体系完善详细实施计划

### 4.1 测试现状盘点（基准线）

| 层级 | 测试文件 | 当前测试数量 | 目标测试数量 | 目标覆盖率 |
|------|---------|-------------|-------------|-----------|
| **数据库层** | `database/tests.rs` | 约 3-5 个 | 15+ 个 | 核心安全逻辑 100% |
| **服务层** | 各 `*_service.rs` 内联 `mod tests` | sql_service(19) + database_service(3) = 22 | 80+ 个 | 核心方法 >80% |
| **前端组件** | `src/__tests__/components/` | **0** | 15+ 个 | 核心组件 >70% |
| **前端服务** | `src/__tests__/services/` | **0** | 5+ 个 | 关键路径覆盖 |
| **前端 Hooks** | `src/__tests__/hooks/` | **0** | 5+ 个 | 核心 Store hook |
| **E2E 测试** | （暂不强制） | **0** | 4 个核心场景 | 手动验证通过 |

### 4.2 M7.3.1 数据库层测试增强（@后端，估计工作量：6小时）

**文件**：`src-tauri/src/database/tests.rs`（已有文件，扩展测试用例）

**测试用例清单**：

| # | 测试项 | 目的 | 关键点 |
|---|--------|------|--------|
| 1 | `SqlIdentifier::new()` 基础用例 | 验证表名校验 | valid_table, _prefix, contains spaces, invalid chars |
| 2 | `SqlIdentifier::quote_identifier()` 引号处理 | SQL 注入防护 | 验证返回的标识符带双引号 |
| 3 | `SqlIdentifier::is_system_table()` 系统表识别 | 架构规则验证 | `__xxx` 是系统表，普通表不是 |
| 4 | `SqlIdentifier::is_safe_identifier()` 静态校验 | 快速路径正确性 | 与 `new()` 行为对齐（正向用例） |
| 5 | 索引创建迁移幂等性测试 | CREATE INDEX IF NOT EXISTS | 多次调用不报错，索引存在 |
| 6 | 空连接/异常连接测试 | 错误路径 | query 失败时的降级逻辑 |
| 7 | SQLite vs DuckDB 路由正确性 | router.rs 正确性 | 根据 driver name 正确路由 |

**实施方式**：
- 在 `database/tests.rs` 中扩展现有测试模块
- 使用 `rusqlite::Connection::open_in_memory()` 创建测试数据库
- 每个测试独立创建，不互相影响
- 添加 `#[test]` 函数，使用 `assert_eq!` / `assert!` / `matches!`

### 4.3 M7.3.2 服务层单元测试（@后端，估计工作量：12小时）

**目标**：每个 `*_service.rs` 至少有 1 个 `mod tests`，覆盖核心业务路径。

**测试优先级矩阵**（按重要性/可测性/影响范围排序）：

| 优先级 | 服务文件 | 当前测试数 | 目标测试数 | 建议测试内容 |
|--------|---------|-----------|-----------|-------------|
| 🟥 最高 | `sql_service.rs` | 19 | **保持** | 已覆盖良好，检查是否有遗漏的 panic 路径 |
| 🟥 最高 | `database_service.rs` | 3 | **10+** | index_creation、table_meta、drop_table_safe、rename_table_safe |
| 🟠 高 | `task_service.rs` | 0 | **10+** | create_task、get_task、list_tasks、run_task（纯逻辑部分） |
| 🟠 高 | `settings_service.rs` | 0 | **8+** | get_setting、list_all_lite、update_setting 纯逻辑 |
| 🟡 中 | `audit_log_service.rs` | 0 | **5+** | record_audit_log 错误处理、格式化 |
| 🟡 中 | `trash_service.rs` | 0 | **5+** | move_to_trash、permanent_delete、restore_from_trash |
| 🟢 低 | `dashboard_service.rs` | 0 | **5+** | save_chart、get_saved_charts、delete_chart |
| 🟢 低 | `chart_service.rs` | 0 | **3+** | chart_config_conversion 纯函数 |
| 🟢 低 | `migration_service.rs` | 0 | **3+** | apply_migrations、version_tracking |
| 🟢 低 | `view_service.rs` | 0 | **2+** | drop_single_view、create_view 逻辑 |

**测试编写规范**（所有服务层测试统一遵循）：
1. 每个测试文件末尾添加 `#[cfg(test)] mod tests { ... }`
2. 优先测试**纯函数**和**错误路径**
3. 需要真实 DB 连接的用例：使用 `open_in_memory()`，在测试内部 CREATE TABLE
4. 不需要 DB 的用例（纯逻辑）：直接断言输入输出
5. 每个测试函数命名：`test_<场景>_<期望结果>`（如 `test_parse_drop_table_table_name_success`）
6. 每个测试前必须有注释说明意图
7. 禁止在测试中使用 `.unwrap()` 处理业务逻辑——但 `setup_conn().unwrap()` 这种初始化失败可以接受

### 4.4 M7.3.3 前端测试框架搭建（@前端，估计工作量：6小时）

**目标**：建立 Vitest 为核心的前端测试体系。

**新文件清单**：

| 文件 | 作用 | 估计行数 |
|------|------|---------|
| `vite.config.ts`（修改测试配置） | 添加 Vitest 配置 | 修改 10-15 行 |
| `src/__tests__/setup.ts` | 测试全局 setup（DOM 环境模拟、全局 mock） | 30-50 行 |
| `src/__tests__/components/Smoke.test.tsx` | 烟雾测试：核心组件能 render | 20-30 行 |
| `src/__tests__/utils/gridLayout.test.ts` | 纯函数工具测试（已有 `utils/gridLayout.ts`） | 30-40 行 |
| `src/__tests__/utils/echartsNormalize.test.ts` | 图表配置转换测试 | 20-30 行 |
| `src/__tests__/store/appStore.test.ts` | Store 状态初始化测试 | 20-30 行 |

**实施步骤**：
1. 安装 Vitest + 测试工具链依赖：
   ```
   npm install --save-dev vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
   ```
2. 在 `package.json` 添加测试脚本：
   ```json
   "scripts": {
     "test": "vitest run",
     "test:watch": "vitest",
     "test:coverage": "vitest run --coverage"
   }
   ```
3. 配置 `vite.config.ts` 的 test 节：
   ```typescript
   test: {
     globals: true,
     environment: 'jsdom',
     setupFiles: ['./src/__tests__/setup.ts'],
   }
   ```
4. 创建第一个烟雾测试（Smoke Test），确保核心组件能正常渲染
5. 实现 2-3 个纯函数工具测试（gridLayout、echartsNormalize 等）
6. 实现 1-2 个简单的 Store 状态测试（初始化状态、状态更新）

### 4.5 M7.3.4 前端组件测试（@前端，估计工作量：6小时）

**测试优先级矩阵**：

| 优先级 | 组件 | 测试内容 | 目标测试数 |
|--------|------|---------|-----------|
| 🟥 最高 | `src/__tests__/utils/gridLayout.test.ts` | 布局计算、resize 逻辑 | 5 |
| 🟥 最高 | `src/__tests__/utils/echartsNormalize.test.ts` | 数据转换正确性 | 5 |
| 🟠 高 | `src/__tests__/store/settingsStore.test.ts` | 设置项加载/更新 | 5 |
| 🟠 高 | `src/__tests__/store/dashboardStore.test.ts` | 刷新、图表管理 | 5 |
| 🟡 中 | `src/__tests__/components/TableView.test.tsx` | 表格渲染 | 3 |
| 🟢 低 | `src/__tests__/components/ChartRenderer.test.tsx` | 图表渲染基本路径 | 2 |

### 4.6 M7.3.5 E2E 测试场景（手动验证，@架构 + @前端 + @后端，估计工作量：4小时）

**M7 暂不引入自动化 E2E 工具链**（避免引入过重依赖），采用**手动验证 + 详细步骤文档**的方式。

**4 个核心 E2E 场景**：

| # | 场景 | 步骤 | 期望结果 |
|---|------|------|---------|
| 1 | 创建项目 → 导入数据 → 查询 → 删除 | 1) 新建项目；2) 导入 CSV；3) 执行 SELECT；4) 删除表 | 全流程无错误，查询返回正确结果 |
| 2 | 回收站 → 删除 → 恢复 → 永久删除 | 1) 移到回收站；2) 查看回收站；3) 恢复；4) 永久删除 | 回收站状态与操作一致 |
| 3 | 仪表盘 → 添加组件 → 编辑 → 删除 | 1) 新建仪表盘；2) 添加图表；3) 编辑配置；4) 删除 | 仪表盘 CRUD 完整可用 |
| 4 | 自动化任务 → 创建 → 执行 → 查看结果 | 1) 创建定时任务；2) 立即执行；3) 查看运行日志 | 任务正常执行，结果可追溯 |

**实施方式**：
- 在开发环境中由一人手动执行上述场景
- 记录每个步骤的截图/日志/返回值
- 形成 `docs/M7-e2e-test-report.md` 文档（简洁的测试报告）

---

## 五、M7 任务总览与时间规划

### 5.1 任务总表（按角色与优先级排序）

| ID | 角色 | 任务 | 依赖 | 估计工时 | 优先级 | 验收标准 |
|----|------|------|------|---------|--------|---------|
| M7.2.1 | @后端 | 数据库索引优化（6张表的建议索引） | 无 | 8h | 🔴 高 | 索引创建脚本可执行；EXPLAIN 验证索引被使用 |
| M7.2.2 | @后端 | 查询优化（批量表信息、分页、缓存表信息） | 无 | 4h | 🔴 高 | 列表页面加载时间 < 500ms |
| M7.2.3 | @后端 | 查询缓存服务（QueryCacheService） | M7.2.1 | 8h | 🔴 高 | 可开关；命中率可统计；写操作自动失效 |
| M7.2.4 | @后端 | 连接池评估（可选增强） | M7.2.3 | 4h | 🟡 中 | 性能测试证明连接管理需要优化时才实施 |
| M7.2.5 | @前端 | 代码分割 + 懒加载（4-6 个页面） | 无 | 6h | 🔴 高 | build 后生成独立 chunk；首屏加载 < 2s |
| M7.2.6 | @前端 | 虚拟列表优化（3 个列表组件） | 无 | 6h | 🟠 中 | 1000+ 条目列表流畅滚动 |
| M7.2.7 | @前端 | 图片优化（可选） | 无 | 2h | 🟢 低 | 图表导出更流畅 |
| M7.3.1 | @后端 | 数据库层测试扩展（database/tests.rs） | 无 | 6h | 🔴 高 | 测试总数 ≥ 15，覆盖 SqlIdentifier 核心路径 |
| M7.3.2 | @后端 | 服务层单元测试（9 个 *_service.rs） | 无 | 12h | 🔴 高 | 每个 service 至少有 5 个测试用例；cargo test 全通过 |
| M7.3.3 | @前端 | Vitest 测试框架搭建 + 首个测试 | 无 | 6h | 🔴 高 | `npm test` 可执行并通过；至少 10 个测试用例 |
| M7.3.4 | @前端 | 前端组件测试扩展 | M7.3.3 | 6h | 🟠 中 | 至少 20 个组件/工具/Store 测试用例 |
| M7.3.5 | @架构+@后端+@前端 | 4 个 E2E 手动验证场景 | 全部完成 | 4h | 🟠 中 | 生成 `docs/M7-e2e-test-report.md` |
| **合计** | | | | **~72 小时** | | M7 完整交付 |

### 5.2 时间规划甘特图（两周实施周期）

```
Week 1 (Mon-Fri): 性能优化周期
────────────────────────────────────────────────────
Mon:  @后端  ── M7.2.1 索引优化 ──────────────┐
      @前端  ── M7.2.5 代码分割 ───────────────┤
                                                │
Tue:  @后端  ── M7.2.2 查询优化 + M7.2.3 缓存设计│
      @前端  ── M7.2.5 代码分割（继续） ───────┤
                                                │
Wed:  @后端  ── M7.2.3 QueryCacheService 实现  │
      @前端  ── M7.2.6 虚拟列表 ───────────────┤
                                                │
Thu:  @后端  ── M7.2.3 缓存集成 + 测试 ────────┤
      @前端  ── M7.2.6 虚拟列表（继续） ───────┤
                                                │
Fri:  @架构  ── ✅ M7.2 验收检查 + 记录结果    │
                                                │
Week 2 (Mon-Fri): 测试体系完善周
────────────────────────────────────────────────────
Mon:  @后端  ── M7.3.1 数据库层测试扩展 ─────┐
      @前端  ── M7.3.3 Vitest 框架搭建 ───────┤
                                                │
Tue:  @后端  ── M7.3.2 核心 service 测试（前5个）│
      @前端  ── M7.3.3 烟雾测试 + 纯函数测试 ──┤
                                                │
Wed:  @后端  ── M7.3.2 其他 service 测试（后4个）│
      @前端  ── M7.3.4 组件测试扩展 ───────────┤
                                                │
Thu:  @后端  ── ✅ 后端测试收尾 + cargo test 验证│
      @前端  ── ✅ 前端测试收尾 + npm test 验证 │
                                                │
Fri:  全角色 ── M7.3.5 E2E 手动验证 + 文档更新 │
       @架构 ── 更新架构现状文档 + M7 完成报告 ─┘
```

---

## 六、M7 验收标准与交付物

### 6.1 功能验收（全部必须满足）

| # | 标准 | 验证方式 |
|---|------|---------|
| 1 | 所有索引优化脚本可成功执行 | `cargo run` 后检查 `sqlite_master` |
| 2 | 查询缓存可通过 `settings` 开关 | 手动开启/关闭并对比查询速度 |
| 3 | 前端代码分割后，路由切换 < 200ms | Chrome DevTools Performance 面板 |
| 4 | 虚拟列表能处理 1000+ 条目不卡顿 | 手动滚动测试 |
| 5 | `cargo test --quiet` → **0 failing** | CI 级别验证 |
| 6 | `npm test` → **所有测试通过** | CI 级别验证 |
| 7 | 4 个 E2E 场景手动验证全部通过 | `docs/M7-e2e-test-report.md` 文档 |

### 6.2 性能验收（全部达到或优于即视为通过）

| 指标 | 目标 | 测量方法 |
|------|------|---------|
| **首屏加载时间** | < 2s | Chrome DevTools Performance |
| **列表页面加载** | < 500ms | Chrome DevTools Performance |
| **仪表盘加载** | < 2s | Chrome DevTools Performance |
| **查询执行（100行以内）** | < 100ms | 应用内计时 + 审计日志 |
| **查询执行（10000行以内）** | < 1s | 应用内计时 + 审计日志 |
| **内存占用** | < 500MB（空闲状态） | Windows 任务管理器 |
| **缓存命中率**（如启用） | > 60% | `QueryCacheService::stats()` 输出 |

### 6.3 测试覆盖率验收（按阶段目标，非硬性门槛）

| 层级 | 目标 | 当前估计 | 差距 |
|------|------|---------|------|
| 后端数据库层 | 核心安全路径 100% | ~40% | 需要新增 10+ 测试 |
| 后端服务层 | 核心方法 >80% | ~30% | 需要新增 60+ 测试 |
| 前端工具函数 | >80% | 0% | 需要从零搭建 |
| 前端核心组件 | >70% | 0% | 需要从零搭建 |

**注意**：M7 不强求硬百分比，目标是**建立测试体系 + 覆盖核心路径**，覆盖率数字作为参考指标。

### 6.4 交付物清单

| # | 交付物 | 文件/目录 | 负责角色 |
|---|--------|---------|---------|
| 1 | 索引优化脚本 | `src-tauri/src/services/migration_service.rs` 修改 | @后端 |
| 2 | 查询缓存服务 | `src-tauri/src/services/query_cache_service.rs` 新建 | @后端 |
| 3 | 缓存配置项 | `src-tauri/src/services/settings_service.rs` 修改 | @后端 |
| 4 | 前端代码分割实现 | `src/App.tsx`、相关组件文件修改 | @前端 |
| 5 | 虚拟列表优化 | `src/utils/virtual.ts` 新建 + 组件修改 | @前端 |
| 6 | 数据库层测试扩展 | `src-tauri/src/database/tests.rs` 修改 | @后端 |
| 7 | 服务层单元测试 | 各 `*_service.rs` 末的 `mod tests` 修改 | @后端 |
| 8 | 前端测试框架 | `vite.config.ts`、`src/__tests__/` 目录新建 | @前端 |
| 9 | 前端组件/工具测试 | `src/__tests__/**/*.test.ts(x)` 新建 | @前端 |
| 10 | E2E 测试报告 | `docs/M7-e2e-test-report.md` 新建 | @架构 |
| 11 | M7 完成报告 | `docs/架构现状.md` 末尾新增 M7 章节 | @架构 |

---

## 七、M7 风险与缓解策略

### 7.1 风险矩阵

| 风险 | 概率 | 影响 | 缓解策略 |
|------|------|------|---------|
| 测试编写工作量超出预期 | 🟡 中 | 🔴 高 | 先建立测试框架和示例，其余以"每个 service 至少 3 个测试"为最低门槛，超过的后续补 |
| Vitest 与现有依赖冲突 | 🟢 低 | 🟡 中 | 选择稳定版本（`vitest@latest` 前一版本），提前在分支验证 |
| QueryCacheService 与现有代码集成出现问题 | 🟡 中 | 🟡 中 | 在 settings 中默认关闭缓存，作为可选功能上线，逐步验证 |
| 虚拟列表引入后破坏现有样式 | 🟡 中 | 🟡 中 | 先在单个组件试点，验证无误再扩展到其他组件 |
| 索引优化后反而减慢写入性能 | 🟢 低 | 🟢 低 | 所有索引均为 `CREATE INDEX IF NOT EXISTS`，可随时 DROP 回退 |

### 7.2 决策点清单（需要 @架构 仲裁的关键点）

| # | 决策点 | 建议方案 | 影响范围 |
|---|--------|---------|---------|
| 1 | 是否在 M7 中实施连接池？ | 建议跳过（单用户桌面应用） | @后端 |
| 2 | 查询缓存默认开启还是关闭？ | 建议默认关闭，让用户可选择 | @后端 + @前端 |
| 3 | 是否引入 `@tanstack/react-virtual` 依赖？ | 建议引入（轻量级，功能可靠） | @前端 |
| 4 | E2E 是否引入自动化工具（如 Playwright）？ | 建议 M7 阶段保持手动验证，M8 评估是否自动化 | 全角色 |

---

## 八、M7 里程碑完成标准

M7 完成当且仅当以下所有条件满足：

### ✅ M7.1 架构质量基线（已在 v12.5 完成）
- commands 层 0 处直连 DB
- 生产代码 0 处 `.unwrap()`
- 前端 0 处 `any` 类型
- 其他 4 项门禁通过

### ✅ M7.2 性能优化（需要完成的新工作）
- 至少 6 个关键查询索引已创建
- 查询缓存服务存在且可通过设置开关
- 前端代码分割生效（build 后有多个 chunk）
- 至少 2 个长列表组件使用虚拟滚动
- 性能基准测试记录在文档中

### ✅ M7.3 测试体系（需要完成的新工作）
- `cargo test` → **0 failing**
- `npm test` → **0 failing**
- 后端测试总数 ≥ **80**
- 前端测试总数 ≥ **20**
- 4 个 E2E 手动场景全部通过
- `docs/M7-e2e-test-report.md` 文档存在且完整

---

## 九、下一步：M8 方向（提前规划）

M7 完成后，自然过渡到 M8（文档完善与发布准备）。M8 的主要工作：

- **用户文档**：快速入门指南、功能说明文档
- **开发文档**：API 文档、架构说明、贡献指南
- **运维文档**：故障排查、备份恢复说明
- **发布准备**：版本号规划、发布清单、安装包制作

**M7 与 M8 的分界点**：当 M7 的测试/性能满足预期时，即标志着 M7 完成，可开始 M8。

---

## 十、关联文档与规则约束

### 10.1 关联文档

| 文档 | 引用章节 | 关联内容 |
|------|---------|---------|
| `docs/架构现状.md` | §"M7 架构分层里程碑达成报告" | M7 完成后更新此章节 |
| `docs/M3-M8详细实施计划.md` | §7 | M7 的原始定义来源 |
| `.trae/rules/architecture.md` | 全文 | M7 中所有代码修改必须遵循分层架构 |
| `.trae/rules/test.md` | §2.1/§2.2 | M7.3 中的测试编写规范 |
| `.trae/rules/security.md` | §1 | M7 中新增的 SQL 操作必须满足参数化查询要求 |
| `.trae/rules/coding.md` | §1/§2 | M7 中所有代码必须遵循命名和异常处理规范 |
| `AGENTS.md` | 全文 | M7 中的角色分工须与 AGENTS.md 中定义的角色职责保持一致 |

### 10.2 修改 Tier-1 文件前的注意事项

> 参考 `file-lock.md`，以下文件属于 Tier-1 高冲突文件，每次修改前须确认没有其他并行任务修改同一文件：
>
> | 文件 | M7 中是否可能修改 | 原因 |
> |------|------------------|------|
> | `src-tauri/Cargo.toml` | 可能 ✅ | 如引入缓存依赖（如 lru 库） |
> | `package.json` | 可能 ✅ | 引入 Vitest、@tanstack/react-virtual 等 |
> | `vite.config.ts` | 必须 ✅ | 需要配置 vitest test 节 |
> | `src/App.tsx` | 可能 ✅ | 代码分割和懒加载 |
> | `src-tauri/src/lib.rs` | 不期望 ❌ | 不新增命令注册 |
> | `src-tauri/tauri.conf.json` | 不期望 ❌ | 不变 |
> | `src-tauri/capabilities/default.json` | 不期望 ❌ | 不变 |

### 10.3 禁止事项

1. ❌ **禁止**直接在 `commands/` 层新增 `conn.query`/`conn.execute` 调用
2. ❌ **禁止**在 `src/` 目录内拼接 SQL 字符串
3. ❌ **禁止**在生产代码中引入新的 `.unwrap()`/`.expect()`
4. ❌ **禁止**在 `models/` 层引入业务逻辑（只能是数据结构定义）
5. ❌ **禁止**绕过 `SqlIdentifier::new()` 校验直接拼接表名
6. ❌ **禁止**在 M7 中引入重型 E2E 自动化工具（如 Playwright）— 这是 M8 的评估项

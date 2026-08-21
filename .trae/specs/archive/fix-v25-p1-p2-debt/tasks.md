# Tasks — v25.2 P1/P2 技术债修复

> **关联 spec**: [spec.md](./spec.md)

---

## Phase 1: P1 后端修复（可并行）

- [ ] **Task 1**: P1-1 DuckDB execute() 参数类型保留
  - [ ] SubTask 1.1: 在 `duckdb.rs` 中实现 trait ToSql → duckdb::ToSql 的类型保留转换：新增 `ToSqlValue` 枚举（Int/Float/Bool/Str/Null），修改 trait ToSql 返回 `ToSqlValue` 而非 String（或新增方法 `to_sql_value()`）
  - [ ] SubTask 1.2: 修改 `execute()` 和 `query()` 中的参数转换：`Vec<ToSqlValue>` → `Vec<Box<dyn duckdb::ToSql>>`，i64 → Int64、f64 → Float64、bool → Bool、String → Text
  - [ ] SubTask 1.3: 为 i32/i64/f64/bool/String/str 实现 ToSqlValue 转换（修改 traits.rs 的 ToSql trait 或新增 to_sql_typed 方法）
  - [ ] SubTask 1.4: 运行 `cargo check --quiet` 验证 0 errors

- [ ] **Task 2**: P1-2 查询缓存单条 + 总大小限制
  - [ ] SubTask 2.1: 在 `CacheEntry` 增加 `estimated_size_bytes: usize` 字段（基于 columns.len() * 32 + rows.len() * columns.len() * 64 估算）
  - [ ] SubTask 2.2: 在 `InnerCache` 增加 `total_size_bytes: usize` 和 `max_total_size_bytes: usize`（默认 256 * 1024 * 1024）
  - [ ] SubTask 2.3: 修改 `set()` 方法：插入/更新时更新 total_size_bytes，超过上限时按 LRU 顺序驱逐
  - [ ] SubTask 2.4: 修改 `invalidate()` / `invalidate_all()` / `configure()`：同步更新 total_size_bytes
  - [ ] SubTask 2.5: 在 `CacheStats` 增加 `totalSizeBytes` 和 `maxTotalSizeBytes` 字段（camelCase serde）
  - [ ] SubTask 2.6: 新增单元测试：大结果集驱逐、总大小上限触发、stats 正确反映
  - [ ] SubTask 2.7: 运行 `cargo test --quiet` 验证 0 failed

## Phase 2: P1 前端修复

- [ ] **Task 3**: P1-3 IPC 不可用全局检测
  - [ ] SubTask 3.1: 在 `services/tauri.ts` 顶部新增 `isTauriEnv()` 工具函数：返回 `'__TAURI_INTERNALS__' in window`
  - [ ] SubTask 3.2: 修改 `invokeCommand`：非 Tauri 环境直接返回 `{ success: false, error: '当前为浏览器预览模式，IPC 不可用' }`，不调用 `invoke()`（避免抛错）
  - [ ] SubTask 3.3: 在 `AppWrapper.tsx`（或 App.tsx）启动时调用 `isTauriEnv()`，false 时显示一次性 banner（含关闭按钮）
  - [ ] SubTask 3.4: 运行 `npx tsc --noEmit` 验证 0 errors

- [ ] **Task 4**: P1-4 i18n 40+ 硬编码中文抽取
  - [ ] SubTask 4.1: 扫描 5 个文件（DashboardPage / TaskEditorModal / SaveChartModal / DependencyEditorModal / App）的硬编码中文字符串，整理为 i18n key 清单
  - [ ] SubTask 4.2: 在 `context/LocaleContext.tsx` 的 zhCNTranslations 中登记新 key（如 `app.password.error`、`dashboard.empty.title` 等）
  - [ ] SubTask 4.3: 修改 5 个文件：硬编码中文 → `t('key')`，必要时 `useLocale()` 引入
  - [ ] SubTask 4.4: 运行 `npx tsc --noEmit` 验证 0 errors

## Phase 3: P2 前端修复

- [ ] **Task 5**: P2-1 事件监听合并 throttle
  - [ ] SubTask 5.1: 在 App.tsx 新增 `useThrottledActivity` 自定义 hook：注册 4 个监听器（mousemove/keydown/mousedown/touchstart），统一调用 throttle(500ms) 的 resetIdleTimer
  - [ ] SubTask 5.2: 替换密码保护 autoLock 与 sessionTimeout 两个 useEffect 的独立监听器为 `useThrottledActivity(callback, enabled)`
  - [ ] SubTask 5.3: 运行 `npx tsc --noEmit` 验证 0 errors

- [ ] **Task 6**: P2-2 React.memo 包装
  - [ ] SubTask 6.1: 对 `SettingsModal.tsx` 默认导出包装 `React.memo`（或导出 memo 化版本）
  - [ ] SubTask 6.2: 对 `DatabaseExplorer.tsx` 默认导出包装 `React.memo`
  - [ ] SubTask 6.3: 对 `ProjectManager.tsx` 默认导出包装 `React.memo`
  - [ ] SubTask 6.4: 运行 `npx tsc --noEmit` 验证 0 errors

- [ ] **Task 7**: P2-3 ECharts SVG 渲染模式
  - [ ] SubTask 7.1: 在 `ChartRenderer.tsx` 计算 dataPoints = rows.length * series.length
  - [ ] SubTask 7.2: 当 dataPoints ≤ 5000 时 `renderer: 'svg'`，否则 `renderer: 'canvas'`
  - [ ] SubTask 7.3: 运行 `npx tsc --noEmit` 验证 0 errors

## Phase 4: P2 渐进治理（本次小范围）

- [ ] **Task 8**: P2-4 内联样式迁移（仅 App.tsx LoadingSkeleton）
  - [ ] SubTask 8.1: 在 `App.css` 新增 `.loading-skeleton` / `.loading-skeleton-spinner` 样式类
  - [ ] SubTask 8.2: App.tsx LoadingSkeleton 内联样式 → className

- [ ] **Task 9**: P2-5 DashboardToolbar 拆分
  - [ ] SubTask 9.1: 读取 `DashboardToolbar.tsx`，识别可拆分子组件（如 actions / filters / layout controls）
  - [ ] SubTask 9.2: 新建 `dashboard/DashboardToolbarActions.tsx` + `DashboardToolbarFilters.tsx`
  - [ ] SubTask 9.3: 父组件 DashboardToolbar 行数 < 200，子组件各自 < 200

## Phase 5: 验证 + 文档

- [ ] **Task 10**: 全量回归验证
  - [ ] SubTask 10.1: `cd src-tauri; cargo check --quiet` → 0 errors
  - [ ] SubTask 10.2: `cd src-tauri; cargo test --quiet` → 323+ passed / 0 failed
  - [ ] SubTask 10.3: `npx tsc --noEmit --pretty` → 0 errors
  - [ ] SubTask 10.4: `npx vitest run` → 98+ passed / 0 failed
  - [ ] SubTask 10.5: SQL 注入两段式扫描 + 敏感字符串 + unwrap + TS any 全部通过
- [ ] **Task 11**: 浏览器验证
  - [ ] SubTask 11.1: 启动 Tauri dev server，http://localhost:1420 返回 200
  - [ ] SubTask 11.2: 浏览器预览模式 banner 提示（非 Tauri 环境）
  - [ ] SubTask 11.3: 核心页面渲染正常（SQL / Dashboard / Automation / Settings）
- [ ] **Task 12**: 文档更新
  - [ ] SubTask 12.1: `docs/技术债清单_v4.md` → v6.2，P1=0/P2=0，9 项全部 ✅ 已修复 v25.2
  - [ ] SubTask 12.2: `docs/架构现状.md` → v25.2，综合评分 8.6 → 9.0+，P1/P2 状态更新

---

## Task Dependencies

- **Task 1 + Task 2** 可并行（后端，不同文件）
- **Task 3 + Task 4** 可并行（前端，不同文件）
- **Task 5 + Task 6 + Task 7** 可并行（前端，不同文件）
- **Task 8 + Task 9** 可并行（前端，不同文件）
- **Task 10** depends on Task 1-9 全部完成
- **Task 11** depends on Task 10
- **Task 12** depends on Task 11

# QuickerSQL 技术债清理 - 多角色分工实施计划（Task Decomposition）

> 主文档：`spec.md`
> 版本：**v14.1**（2026-06-22，M7 里程碑收尾版）
> 状态：**执行中**

本文件定义 7 条技术债的拆解任务、角色分配、依赖关系、测试要求。

---

## 任务总览（TL;DR）

| ID | 技术债条目 | 优先级 | 负责人 | 预估工时 | 前置任务 |
|----|-----------|--------|--------|---------|---------|
| T-001 | execute_sql 多语句缓存 | **P1** | @后端 | ~ 0.5h（已完成） | — |
| T-002 | query_cache stats 前端暴露 | **P2** | @前端 + @后端 | ~ 4h | T-001 |
| T-003 | 虚拟滚动接入 QueryHistory / TaskLogs | **P2** | @前端 | ~ 6h | — |
| T-004 | 索引迁移稳健化（旧库升级） | **P2** | @后端 | ~ 3h | — |
| T-005 | E2E 测试框架搭建 | **P1** | @测试 + @架构 | ~ 8h | — |
| T-006 | 前端 console.log 清理 | **P3** | @前端 | ~ 1h | — |
| T-007 | system-table ensure_* 合并单循环 | P3 | @后端 | 延后（不纳入本版） | — |
| T-008 | 文档同步更新（架构现状.md 收尾） | P3 | @架构 | ~ 1h | 全部 T-xxx 完成后 |

---

## 详细任务拆解

### [ ] T-001：execute_sql 多语句缓存（P1）

- **负责角色**：`@后端`
- **依赖**：无（M7.2 期间已实施）
- **当前状态**：✅ 已完成，见 `commands/sql.rs` 第 44-108 行
- **验收标准**：
  - 用户输入多语句 SQL（如 `SELECT 1; SELECT 2;`），第一次执行后全部写入缓存
  - 第二次执行相同 SQL 时全部命中缓存，`hits` 数量正确递增
  - 单语句路径仍按原逻辑工作
- **测试要求**：
  - `programmatic` TR-001.1：`cargo test --quiet` 中 `query_cache_service::tests` 9 个用例全部通过
  - `programmatic` TR-001.2：`sql_service::tests::split_sql_statements_*` 相关用例通过
- **已完成验证**（2026-06-22 实际状态）：
  - `commands/sql.rs` 第 44-108 行：已实现 `stmts.len() > 1` 路径和单语句快路径
  - 多语句命中时返回 `BatchExecuteResult { success_count: stmts.len(), fail_count: 0, results: cached }`
  - 写回路径（第 120-155 行）：逐条写入缓存，`is_write_operation` 为 true 时触发 `invalidate_all()`

---

### [ ] T-002：query_cache stats 前端暴露（P2）

> **多语句缓存的 Rust 部分已完成，本任务 = TS 类型 + tauriService 封装 + Store action + UI 组件**

- **负责角色**：`@前端`（TS 类型 / tauriService / Store / UI）+ `@后端`（审核 Rust 命令签名一致性）
- **依赖**：T-001（Rust 命令已就绪）
- **文件变更**：

| 文件 | 变更内容 |
|------|---------|
| `src/types/settings.ts` 或 `src/types/index.ts` | 新增 `QueryCacheStats` interface（capacity/size/hits/misses/hitRate/enabled，camelCase） |
| `src/services/tauri.ts` | 新增 `getQueryCacheStats()`、`configureQueryCache(capacity, ttlSeconds, enabled)` 两个方法；命令名匹配 Rust 侧 `get_query_cache_stats` / `configure_query_cache` |
| `src/store/settingsStore.ts`（或等价 store） | 新增 `cacheStats` state + `loadCacheStats()` / `updateCacheConfig()` action |
| `src/components/settings/QueryCacheStatsPanel.tsx` | 新建组件：卡片 + 进度条 + 刷新/重置按钮 |
| `src/App.tsx` 或 settings 路由入口 | 挂载 QueryCacheStatsPanel 到 Settings 面板下 |

- **Rust 层无需修改**：`commands/sql.rs` 的 `get_query_cache_stats`（第 163-166 行）和 `configure_query_cache`（第 175-184 行）已存在
- **验收标准**（对应 `spec.md` AC-1）：
  - UI 中能看到 5 个字段，格式正确（百分比 / 整数）
  - 点击"刷新"后 `hits/misses` 有更新
  - 点击"重置"（调用 configure_query_cache）触发全量失效
  - 类型检查：`npx tsc --noEmit --pretty` 无新增错误
- **测试要求**：
  - `programmatic` TR-002.1：为 `QueryCacheStatsPanel` 写至少 2 个 vitest 用例（空 stats / 有数据渲染）
  - `programmatic` TR-002.2：`tauriService.getQueryCacheStats()` 返回类型与 `QueryCacheStats` 一致
  - `human-judgment` TR-002.3：视觉样式与现有 Settings 面板一致
- **门禁**：`npx vitest run` 新增用例全部通过；`npm run check:all` 通过

---

### [ ] T-003：虚拟滚动接入 QueryHistory / TaskLogs 面板（P2）

- **负责角色**：`@前端`
- **依赖**：`src/utils/virtual.ts`（已存在）+ `src/__tests__/virtual.test.ts`（已存在，15 用例）
- **文件变更**（根据实际项目路径调整，目标组件名以现状为准）：

| 文件 | 变更内容 |
|------|---------|
| `src/components/queryHistory/QueryHistoryList.tsx` | 接入 `computeVisibleRange`，固定高度容器 + 绝对定位渲染；`overscan = 5` |
| `src/components/automation/TaskRunsPanel.tsx` | 同上 |
| `src/utils/virtual.ts` | 若发现边界 bug（如首屏 height=0），在实现中加保护；保持纯函数风格 |

- **改造伪代码模板**（组件内使用）：
  ```tsx
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const viewportHeight = 400; // 或动态测量
  const itemHeight = 48;
  const overscan = 5;
  const range = computeVisibleRange(scrollTop, viewportHeight, itemHeight, items.length, overscan);

  return (
    <div ref={scrollRef} style={{ height: viewportHeight, overflow: 'auto', position: 'relative' }}
         onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}>
      <div style={{ height: range.totalHeight, position: 'relative' }}>
        {items.slice(range.start, range.end).map((item, i) => (
          <div key={item.id} style={{
            position: 'absolute',
            top: (range.start + i) * itemHeight,
            left: 0, right: 0, height: itemHeight,
          }}>
            <Row item={item} />
          </div>
        ))}
      </div>
    </div>
  );
  ```

- **验收标准**（对应 `spec.md` AC-2）：
  - 1000 条数据滚动不卡顿；首屏加载 ≤ 150ms（本地机器）
  - 点击历史记录仍然能触发原有的 onSelect/onClick 行为
  - 列表顶部/底部边界不应抛错或白屏
- **测试要求**：
  - `programmatic` TR-003.1：在 `src/__tests__/virtual.test.ts` 增加 `computeVisibleRange` 的边界用例（scrollTop=0、scrollTop 很大、itemHeight=0 等）
  - `human-judgment` TR-003.2：人工滚动测试，确认无闪烁、无焦点丢失
  - `programmatic` TR-003.3：改造后的组件通过 `npx tsc --noEmit --pretty`

---

### [ ] T-004：索引迁移稳健化（旧库升级）（P2）

- **负责角色**：`@后端`
- **依赖**：无
- **文件变更**：

| 文件 | 变更内容 |
|------|---------|
| `src/services/migration_service.rs` | 新增 `ensure_all_system_indexes()` 函数，集中执行 `CREATE INDEX IF NOT EXISTS`；在主迁移流程的末尾调用；日志打印耗时 |

- **需覆盖的索引列表**（按 `docs/架构现状.md` §2.2 列出的系统索引）：
  - `__automation_tasks`: `idx_automation_tasks_next_state(next_run_at, state)`、`idx_automation_tasks_type(task_type)`、`idx_automation_tasks_project(project_id)`
  - `__automation_runs`: `idx_automation_runs_task_created(task_id, created_at DESC)`、`idx_automation_runs_status(status)`
  - `__query_history`: `idx_history_executed_at(executed_at DESC)`、`idx_history_favorite(is_favorite)`
  - `__audit_logs`: `idx_audit_timestamp(timestamp DESC)`、`idx_audit_module(module)`、`idx_audit_status(status)`
  - `__settings`: `idx_settings_category(category)`
  - `__saved_charts`: `idx_saved_charts_query_id(query_id)`、`idx_saved_charts_visibility(visibility)`
  - `__dashboards`: `idx_dashboards_name(name)`、`idx_dashboards_is_default(is_default)`
  - `__workspace_tabs`: `idx_workspace_tabs_position(position)`
  - `__workspace_panels`: `idx_workspace_panels_tab_id(tab_id)`、`idx_workspace_panels_position(position)`
  - `__trash_metadata`: `idx_trash_deleted_at(deleted_at)`、`idx_trash_original_name(original_table_name)`
  - `__saved_queries`: `idx_saved_queries_name(name)`

- **验收标准**（对应 `spec.md` AC-3）：
  - 打开旧 db 文件后，日志打印 `[迁移] 系统索引已完成检查与补建，耗时 Xms`
  - SQLite CLI 执行 `SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%';` 返回上述索引名
- **测试要求**：
  - `programmatic` TR-004.1：在 `migration_service::tests` 增加 `ensure_all_system_indexes` 的幂等测试（连跑 2 次不应报错）
  - `programmatic` TR-004.2：`cargo check --quiet` 无警告 / 无 error
  - `programmatic` TR-004.3：`cargo test --quiet` 保持 154 passed 或新增用例通过

---

### [ ] T-005：E2E 测试框架搭建（P1）

- **负责角色**：`@测试` + `@架构`（方案选型 / 门禁验证）
- **依赖**：无
- **文件结构**：

```
e2e/
  ├── fixtures/
  │   └── sample-project.db          (预置最小测试数据：1 张数据表 + 少量行)
  ├── specs/
  │   ├── 01-startup.spec.ts         (启动 → splash → 主界面 → DB 状态)
  │   ├── 02-sql-query.spec.ts       (打开 SQL Tab → 输入 → 执行 → 结果表有行)
  │   ├── 03-dashboard.spec.ts       (创建 dashboard → 添加图表 → 渲染)
  │   └── 04-automation-task.spec.ts (创建 manual 任务 → run_now → 日志)
  ├── playwright.config.ts           (配置：timeout / reporter / use)
  └── README.md                      (如何安装 playwright、如何运行、已知问题)
```

- **技术选型要点**：
  - 优先走官方 `@tauri-apps/plugin-*` 测试支持 + Playwright
  - 若 tauri-driver 不可用（Windows 环境常见问题），**降级方案**：把 `specs/*.ts` 改为详细的手动测试脚本（Markdown 文档），由 QA 在每次发版前按步骤执行
- **验收标准**（对应 `spec.md` AC-4）：
  - 至少 3/4 用例稳定通过（startup / sql-query 必须通过；dashboard/automation 至少一个）
  - `npm run e2e` 命令能在本地跑通
  - `README.md` 写明环境要求、依赖安装步骤、常见问题
- **测试要求**：
  - `programmatic` TR-005.1：`npm run e2e` exit code = 0
  - `human-judgment` TR-005.2：@架构 review 用例合理性
- **门禁**：E2E 不强制阻塞 release（标注为 "pre-release smoke test"）

---

### [ ] T-006：前端 console.log 清理（P3）

- **负责角色**：`@前端`
- **依赖**：无
- **扫描命令**：
  ```powershell
  Get-ChildItem -Path e:\LA_DUCK\la-duck\src -Include *.ts,*.tsx -Recurse |
    Select-String -Pattern 'console\.log' |
    Select-Object Path, LineNumber, Line
  ```
- **处理规则**：
  - 纯调试残留 → 删除
  - 错误相关（有错误信息） → 改为 `console.error` / `console.warn`
  - 非必要但信息性的（如 `"启动成功"` 之类） → 移除，不保留
- **验收标准**（对应 `spec.md` AC-5）：
  - 上述扫描命令返回 Count = 0
- **测试要求**：
  - `programmatic` TR-006.1：扫描命令 Count = 0

---

### T-007：system-table ensure_* 合并单循环（P3，延后）

- **说明**：边际收益低，不纳入本版。如果后续发现启动时间在大型 db 文件上显著变慢，再评估。

---

### [ ] T-008：文档同步更新（P3）

- **负责角色**：`@架构`
- **依赖**：全部 T-001 ~ T-006 完成后
- **文件变更**：

| 文件 | 变更内容 |
|------|---------|
| `docs/架构现状.md` | 把 T-001~T-006 中"已完成"的条目从 §5.2 "待完成" 移动到 §5.1 "已完成"；更新 §5.2 仅保留 T-007（延后） |
| `docs/架构现状.md` | 更新版本号 v14.0 → v14.1，在 §7 "历史版本更新记录" 追加一条 v14.1 changelog |
| `docs/M7-multirole-implementation-plan.md` | 如有必要，追加"收尾阶段"章节，注明已完成的技术债与验证结果 |
| `README.md`（可选） | 追加 `npm run e2e` 说明 |

- **验收标准**（对应 `spec.md` AC-6 的文档部分）：
  - 文档版本号与代码一致
  - 架构现状.md 的"待完成技术债"仅含 T-007（或空）
  - `docs/` 下 Markdown 文件可正常渲染，无语法错误

---

## 执行顺序建议（含并行）

```
Phase 0（架构门禁验证，先跑 baseline）
  ├── cargo check --quiet
  ├── cargo test --quiet
  ├── npx tsc --noEmit --pretty
  └── npx vitest run

Phase 1（并行：@后端 做 T-004；@前端 做 T-006 + T-002 的类型层）
  ├── T-004 索引迁移稳健化
  ├── T-006 console.log 清理
  └── T-002 TS 类型 + tauriService 封装

Phase 2（并行：@前端 做 T-003 + T-002 的 UI 层；@测试 做 T-005 框架）
  ├── T-003 虚拟滚动接入
  ├── T-002 Store action + QueryCacheStatsPanel 组件
  └── T-005 E2E 框架搭建

Phase 3（门禁验证 + 文档收尾）
  ├── 全量门禁命令（cargo check / cargo test / tsc / vitest / 安全扫描）
  └── T-008 文档同步更新
```

- **总预估工时**：~ 23 人小时（约 3 人工作日）
  - @后端：~ 3.5h（T-004 + 门禁）
  - @前端：~ 11h（T-002 ~4h + T-003 ~6h + T-006 ~1h）
  - @测试：~ 8h（T-005）
  - @架构：~ 1h（T-008 文档）

---

## 门禁清单（每次 commit / PR 必须通过）

| 步骤 | 命令 | 预期结果 |
|------|------|---------|
| 1 | `cd src-tauri; cargo check --quiet` | 0 errors |
| 2 | `cargo test --quiet` | 154+ passed, 0 failed |
| 3 | `cd ..; npx tsc --noEmit --pretty` | 0 errors |
| 4 | `npx vitest run` | 43+ tests / 100% passed |
| 5 | PowerShell SQL 注入扫描（security.md §1） | Count = 0 |
| 6 | PowerShell 敏感字符串扫描（security.md §3） | Count = 0 |
| 7 | PowerShell console.log 扫描（coding.md §3） | Count = 0 |

---

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| T-005 tauri-driver 在 Windows 不可用 | E2E 无法自动化 | 准备降级方案（手动测试 Markdown 脚本） |
| T-003 虚拟滚动改造可能破坏键盘导航 | 功能回归 | 改造后手动测试 Tab / Enter / Arrow 焦点；必要时把虚拟滚动放在 `VirtualList` 子组件内，保留原列表作为 fallback |
| T-004 索引补建在极旧版本 db 上失败 | 启动报错 | 所有 SQL 使用 `CREATE INDEX IF NOT EXISTS`；单条语句失败不阻断启动，仅记录 warn 日志 |
| T-002 与后端命令签名不一致 | 前端无法获取数据 | @后端 / @前端各自验证命令名与参数；Tauri v2 的 snake_case → camelCase 转换在 tauriService 层已约定 |

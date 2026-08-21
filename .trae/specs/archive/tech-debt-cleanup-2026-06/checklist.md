# QuickerSQL 技术债清理 - 验证清单（Verification Checklist）

> 主文档：`spec.md` / `tasks.md`
> 适用：每次任务完成后的验证环节

---

## Phase 0：Baseline 验证（开始前执行一次）

- [ ] `cd e:\LA_DUCK\la-duck\src-tauri; cargo check --quiet 2>&1 | Select-Object -Last 5` → 无 error
- [ ] `cargo test --quiet 2>&1 | Select-Object -Last 10` → 154 passed, 0 failed
- [ ] `cd e:\LA_DUCK\la-duck; npx tsc --noEmit --pretty 2>&1 | Select-Object -Last 10` → 0 errors
- [ ] `npx vitest run 2>&1 | Select-Object -Last 10` → 43+ tests, 100% passed
- [ ] PowerShell 安全扫描（security.md §1 & §3）→ Count = 0
- [ ] PowerShell console.log 扫描（coding.md §3）→ 记录当前 Count（作为基线）

---

## T-001：多语句缓存（已完成，留档）

- [x] `commands/sql.rs` 第 44-108 行存在 `stmts.len() > 1` 多语句路径
- [x] 单语句快路径（第 83-108 行）与原逻辑一致
- [x] 缓存写回路径（第 120-155 行）：逐条写入 + 写操作触发 `invalidate_all()`
- [x] `cargo test --quiet` 中 `query_cache_service::tests` 9 个用例全部通过
- [x] `sql_service::tests::split_sql_statements_*` 相关用例通过

---

## T-002：query_cache stats 前端暴露

- [ ] `src/types/` 下存在 `QueryCacheStats` interface，字段名与 Rust `CacheStats`（camelCase 转换后）一致
- [ ] `src/services/tauri.ts` 存在 `getQueryCacheStats()` 与 `configureQueryCache(capacity, ttlSeconds, enabled)` 两个方法
- [ ] 上述两个方法的命令名分别为 `get_query_cache_stats` 与 `configure_query_cache`（与 Rust `commands/sql.rs` 第 163、175 行一致）
- [ ] Store action（`loadCacheStats` / `updateCacheConfig`）存在且被调用
- [ ] `QueryCacheStatsPanel` 组件能渲染 5 个字段（capacity/size/hits/misses/hitRate），hitRate 以百分比 + 进度条呈现
- [ ] `enabled` 状态字段在 UI 中可见
- [ ] 刷新按钮点击后 `hits/misses` 有更新（非 NaN）
- [ ] 重置按钮调用 `configure_query_cache` 后缓存被清除
- [ ] `npx tsc --noEmit --pretty` 0 errors
- [ ] 为 `QueryCacheStatsPanel` 新增至少 2 个 vitest 用例（空 stats / 有数据渲染），全部通过
- [ ] 视觉样式与现有 Settings 面板一致（@前端 review）

---

## T-003：虚拟滚动接入

- [ ] `src/components/queryHistory/QueryHistoryList.tsx`（或对应组件）已接入 `computeVisibleRange`
- [ ] `src/components/automation/TaskRunsPanel.tsx`（或对应组件）已接入 `computeVisibleRange`
- [ ] `overscan = 5`
- [ ] 固定高度容器 + 绝对定位渲染，滚动不卡顿
- [ ] 1000 条测试数据下，DOM 节点数量稳定在视口需求范围内（≤ viewportHeight/itemHeight + 2*overscan）
- [ ] 点击历史记录/任务日志条目仍能触发原有的 onSelect/onClick 行为
- [ ] 滚动到列表顶部 / 底部边界时无白屏、无报错
- [ ] `src/__tests__/virtual.test.ts` 中新增了 boundary 用例（scrollTop=0、max、itemHeight=0 等），全部通过
- [ ] `npx tsc --noEmit --pretty` 0 errors

---

## T-004：索引迁移稳健化

- [ ] `src/services/migration_service.rs` 存在 `ensure_all_system_indexes()` 函数
- [ ] 该函数内部对每个系统表的索引执行 `CREATE INDEX IF NOT EXISTS`（按 tasks.md §T-004 列出的索引清单逐一核对，至少 20+ 条）
- [ ] 在主迁移流程的末尾调用该函数
- [ ] 日志：`log::info!("[迁移] 系统索引已完成检查与补建，耗时 {}ms", elapsed)` 存在
- [ ] 所有 SQL 语句使用参数绑定或 `CREATE INDEX IF NOT EXISTS` 字面量，**不使用 `format!` 拼接用户输入**（security.md 约束）
- [ ] `migration_service::tests` 中存在幂等测试（连跑 2 次 `ensure_all_system_indexes` 不报错）
- [ ] `cargo check --quiet` 0 errors / 无警告
- [ ] `cargo test --quiet` 154+ passed
- [ ] 打开旧 db 文件后，SQLite CLI 执行 `SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%';` 返回预期索引名

---

## T-005：E2E 测试框架搭建

- [ ] 目录结构存在：`e2e/fixtures/`、`e2e/specs/`、`e2e/playwright.config.ts`、`e2e/README.md`
- [ ] `e2e/specs/01-startup.spec.ts` 存在且能运行
- [ ] `e2e/specs/02-sql-query.spec.ts` 存在且能运行
- [ ] `e2e/specs/03-dashboard.spec.ts` 存在且能运行（或有降级手动脚本）
- [ ] `e2e/specs/04-automation-task.spec.ts` 存在且能运行（或有降级手动脚本）
- [ ] `playwright.config.ts` 包含合理的 timeout / reporter / use 配置
- [ ] `e2e/README.md` 写明：如何安装 playwright / 如何运行 / 常见问题 / 降级方案
- [ ] `npm run e2e` 或 `npx playwright test e2e/specs/` exit code = 0
- [ ] 至少 3/4 用例稳定通过
- [ ] 若 tauri-driver 不可用：降级为详细的手动测试 Markdown 脚本存在，且 @架构 review 通过

---

## T-006：前端 console.log 清理

- [ ] 执行扫描命令后 `Count = 0`：
  ```powershell
  Get-ChildItem -Path e:\LA_DUCK\la-duck\src -Include *.ts,*.tsx -Recurse |
    Select-String -Pattern 'console\.log' | Measure-Object | Select-Object Count
  ```
- [ ] 对删除的每一行：原代码不是业务逻辑的一部分（只是调试残留）
- [ ] 对有错误相关内容的行：已替换为 `console.error` 或 `console.warn`
- [ ] `npx tsc --noEmit --pretty` 0 errors

---

## T-008：文档同步更新（全部任务完成后执行）

- [ ] `docs/架构现状.md` 版本号更新为 **v14.1**
- [ ] `docs/架构现状.md` §5.2 "待完成技术债" 中，T-001~T-006 完成的条目已移动到 §5.1 "已完成技术债"
- [ ] `docs/架构现状.md` §5.2 仅剩 T-007（标注"延后"）或空
- [ ] `docs/架构现状.md` §7 追加一条 v14.1 changelog
- [ ] `docs/M7-multirole-implementation-plan.md` 如有必要，追加"收尾阶段"章节
- [ ] （可选）`README.md` 追加 `npm run e2e` 说明
- [ ] 所有 Markdown 文件语法正确、可正常渲染

---

## 最终门禁（所有 T-xxx 完成后执行，必须全部通过）

- [ ] `cd src-tauri; cargo check --quiet` → 0 errors
- [ ] `cargo test --quiet` → ≥ 154 passed, 0 failed
- [ ] `cd ..; npx tsc --noEmit --pretty` → 0 errors
- [ ] `npx vitest run` → ≥ 43 tests, 100% passed
- [ ] PowerShell SQL 注入扫描 → Count = 0
- [ ] PowerShell 敏感字符串扫描 → Count = 0
- [ ] PowerShell console.log 扫描 → Count = 0
- [ ] 前端 `npm run e2e`（或手动脚本）→ 至少 3/4 用例通过
- [ ] 文档版本号 v14.1 与代码一致

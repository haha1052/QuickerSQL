# M8 里程碑 - 实施计划（任务清单）

本清单中的每个 Task 都是一个可独立完成、可独立验证的原子工作单元。
**并行策略**：
- **Track A（i18n）**：Task 1 → Task 2 → Task 3（可与 Track B/C/D 并行推进 Task 2 的组件级迁移）
- **Track B（E2E）**：Task 4 → Task 5（独立轨道，不依赖其他 track）
- **Track C（缓存面板增强）**：Task 6 → Task 7（需要 Task 6.1 的后端命令，可与其他 track 并行）
- **Track D（虚拟滚动深化）**：Task 8（独立轨道，需要 virtual.ts 基础）

---

## [ ] Task 1：LocaleContext 增强（i18n 基础设施）

- **Priority**：P0
- **Depends On**：None
- **Track**：A（i18n）
- **Description**：
  - 在 `src/context/LocaleContext.tsx` 中：
    - 将 `locale` 状态改为可通过 `setLocale()` 切换（当前是只读或简单 hook）
    - `setLocale(code)` 需触发 `__settings` 表的持久化写入（category=`locale`, key=`language`）
    - 首次启动时从 `__settings` 读取，若无则回退到 `zh-CN`
    - 确保 zh-CN / en-US 翻译表 key 完全一致（已有的 keys 已对齐，但需要校验）
    - 确保 `t()` 函数支持 `{{ varName }}` 插值变量
  - 新增 `src/hooks/useLocale.ts`（或直接在 LocaleContext 内导出 hook），提供 `{ locale, setLocale, t, localeText }`
  - 确保组件在 locale 变化时 re-render（Context 机制天然支持）
- **Acceptance Criteria Addressed**：AC-1, AC-4
- **Test Requirements**：
  - `programmatic` TR-1.1：`useLocale()` 切换到 `en-US` 后，`t("common.success")` 返回 `"Success"`
  - `programmatic` TR-1.2：`t("import.addedFiles", { count: 10 })` 正确返回包含 10 的字符串
  - `programmatic` TR-1.3：首次启动不读取 settings 时，默认语言为 `zh-CN`
  - `human-judgement` TR-1.4：手动切换语言后，标题栏/按钮/Toast 文本全部更新
- **Notes**：此任务是后续所有 i18n 组件迁移的前置条件，**必须在 Task 2 之前完成**

---

## [ ] Task 2：核心组件 i18n 迁移（第一批 - 公共组件与头部）

- **Priority**：P0
- **Depends On**：Task 1
- **Track**：A（i18n）
- **Description**：
  - 将以下文件中的硬编码中文全部替换为 `t(key)`：
    - `src/components/common/Header.tsx`
    - `src/components/common/Sidebar.tsx`
    - `src/components/common/Toolbar.tsx`
    - `src/components/common/Toast.tsx`
    - `src/components/common/StatusBar.tsx`
    - `src/components/common/Button.tsx`（如含中文）
    - `src/pages/Welcome.tsx`
    - `src/pages/Guide.tsx`
    - `src/components/workspace/Workspace.tsx`
    - `src/components/workspace/WorkspaceTabs.tsx`
  - 每迁移一个文件后立即检查 `tsc --noEmit` 通过
  - 对缺失的 key 在 zhCNTranslations 和 enUSTranslations 中同步补齐
- **Acceptance Criteria Addressed**：AC-1, AC-2
- **Test Requirements**：
  - `programmatic` TR-2.1：本 task 涉及的文件中，硬编码中文字符串数量 = 0
  - `programmatic` TR-2.2：`npx tsc --noEmit --pretty` 无错误
  - `human-judgement` TR-2.3：切换 en-US 后，上述组件所有文本显示为英文且不溢出
- **Notes**：批量迁移时，建议一次性迁移完再统一提交；key 命名遵循 `组件域.操作/名词`

---

## [ ] Task 3：业务组件 i18n 迁移（第二批 - 查询/图表/导入/任务/回收站）

- **Priority**：P1
- **Depends On**：Task 1（与 Task 2 可并行推进不同组件）
- **Track**：A（i18n）
- **Description**：
  - 将以下组件中的硬编码中文替换为 `t(key)`：
    - `src/components/sql/**`（SQLEditor、SqlQueryPage、QueryResult、hooks 等）
    - `src/components/query-history/index.tsx`
    - `src/components/dashboard/**`（DashboardPage、DashboardItem、AddChartModal 等）
    - `src/components/chart/**`（ChartPanel、ChartConfigPanel、ChartPreview 等）
    - `src/components/import/**`（DataImport、DataPreview、FileQueue、ImportItem 等）
    - `src/components/automation/**`（TaskCenterPage、TaskEditorModal、TaskRunLogsPanel 等）
    - `src/components/project/ProjectManager.tsx`
    - `src/components/common/DatabaseExplorer.tsx`
    - `src/pages/Settings.tsx`（如未在 Task 2 完成）
    - `src/components/settings/QueryCacheStatsPanel.tsx`
    - `src/store/*.ts`（toastStore 中文、taskStore 中文、settingsStore 中文状态等）
    - `src/pages/ActivityLog.tsx`
  - 对缺失的 key 同步补全 zh-CN / en-US
- **Acceptance Criteria Addressed**：AC-2, AC-3
- **Test Requirements**：
  - `programmatic` TR-3.1：`src/components/**/*.tsx` 和 `src/pages/**/*.tsx` 中文硬编码数 = 0（排除注释）
  - `programmatic` TR-3.2：`npx tsc --noEmit --pretty` 无错误
  - `programmatic` TR-3.3：`npx vitest run` 全部通过（不破坏现有测试）
  - `programmatic` TR-3.4：翻译一致性脚本（zh-CN vs en-US）输出 0 missing
  - `human-judgement` TR-3.5：应用全流程点击一遍，不出现空白文本或中文
- **Notes**：这是最大的任务，预计覆盖 30~40 个文件。如果时间紧张，可进一步按子目录拆分。

---

## [ ] Task 4：E2E 测试框架搭建

- **Priority**：P1
- **Depends On**：None（**可与所有 Track 并行**）
- **Track**：B（E2E）
- **Description**：
  - 安装 `@playwright/test` 与 Playwright 浏览器二进制（`npx playwright install chromium`）
  - 新建 `e2e/playwright.config.ts`：
    - `testDir: './e2e/specs'`
    - `webServer` 启动 Tauri 应用或通过 tauri-driver 连接
    - 支持 `--headed` 模式（在本地开发时可视化）
    - 配置合理的 timeout（60s）
  - 新建 `e2e/specs/` 目录与 4 个占位 spec 文件
  - 在 `package.json` 的 `scripts` 中新增：
    - `"e2e": "playwright test"`
    - `"e2e:headed": "playwright test --headed"`
  - 新建 `e2e/README.md`，说明环境要求与运行步骤
  - 在 `playwright.config.ts` 中如环境受限提供 fallback（例如检测不到 tauri-driver 时以普通 Chromium 跑 web smoke）
- **Acceptance Criteria Addressed**：AC-5, AC-6
- **Test Requirements**：
  - `programmatic` TR-4.1：`npm run e2e -- --list` 输出 ≥ 4 个 spec 文件
  - `programmatic` TR-4.2：`npx tsc --noEmit --pretty` 无错误（配置文件）
  - `human-judgement` TR-4.3：开发者能够在本机 `npm run e2e:headed` 成功启动一次测试
- **Notes**：优先使用 tauri-driver 协议；如果安装受阻，可先以"Chromium + localhost 测试 web 部分"作为 fallback

---

## [ ] Task 5：4 个核心旅程 E2E spec

- **Priority**：P1
- **Depends On**：Task 4（先搭好框架再写用例）
- **Track**：B（E2E）
- **Description**：
  - **Spec 1**（journey-project-import-query）：启动应用 → 创建新项目 → 导入 CSV（可使用临时文件） → 执行查询 → 断言查询结果行数 > 0
  - **Spec 2**（journey-trash-restore-delete）：创建一张测试表 → 点删除进入回收站 → 恢复 → 查询成功 → 再次删除 → 永久删除 → 查询应失败
  - **Spec 3**（journey-dashboard-chart）：打开仪表盘 → 新建仪表盘 → 新增图表 → 编辑图表配置 → 删除图表 → 删除仪表盘
  - **Spec 4**（journey-automation-task）：打开任务中心 → 创建一次性 SQL 任务 → 立即执行 → 查看日志 → 删除任务
  - 每个 spec 用 `test.describe` 组织独立 case；用 `test.beforeAll` / `test.afterAll` 管理 fixtures
  - 受浏览器/应用窗口限制的 case 使用 `test.skip()` 标注并说明原因
- **Acceptance Criteria Addressed**：AC-6
- **Test Requirements**：
  - `programmatic` TR-5.1：`npm run e2e` 后，至少 3/4 个 journey 通过，0 failure
  - `human-judgement` TR-5.2：人工观察 headed 模式，每个步骤能正确定位 UI 元素
- **Notes**：如果应用窗口无法在 CI 环境启动，至少保证框架正确识别 spec，后续补充自动化路径

---

## [ ] Task 6：查询缓存面板增强（前端）

- **Priority**：P1
- **Depends On**：Task 6.1（`clear_query_cache` 后端命令），可与 Track A 并行推进
- **Track**：C（缓存面板增强）
- **Description**：
  - 在 `QueryCacheStatsPanel.tsx` 中：
    - 新增 `autoRefresh` 状态（`useState(false)`）；开启后 `useEffect` 中的 `setInterval(5000)` 周期性调用 `loadCacheStats()`
    - 新增"清除缓存"按钮，点击调用 `clearQueryCache()` → 立即刷新一次数据
    - 新增命中率趋势折线图：在组件内维护 `const [trend, setTrend] = useState<{ t: number; hitRate: number }[]>([])`，每次刷新将当前 hitRate push 到末尾（最多保留 20 个样本）；使用懒加载 ECharts（如组件已有此 pattern）
    - 确保面板所有文本也走 i18n（与 Task 2/3 协同，或本任务先行用英文占位）
  - 在 `src/store/settingsStore.ts` 中新增 `clearCacheStats` action，触发后更新状态
- **Acceptance Criteria Addressed**：AC-7, AC-8, AC-9
- **Test Requirements**：
  - `programmatic` TR-6.1：点击"清除缓存"后，stats 显示 size=0，hits=0，misses=0
  - `programmatic` TR-6.2：开启自动刷新后，经过 5 秒 mock 时间（用 vitest fake timers），`loadCacheStats` 至少被调用一次
  - `human-judgement` TR-6.3：连续执行 10 次同一查询，命中率折线图有明显上升趋势
  - `human-judgement` TR-6.4：面板视觉风格与现有组件一致（按钮风格、间距、配色）
- **Notes**：折线图可不做持久化；环形缓冲足够展示实时变化趋势

---

## [ ] Task 6.1：后端 `clear_query_cache` 命令

- **Priority**：P1
- **Depends On**：None
- **Track**：C（缓存面板增强 - 后端子任务）
- **Description**：
  - 在 `src-tauri/src/commands/settings.rs`（或对应 settings 相关 commands 文件）中新增：
    ```rust
    #[tauri::command]
    pub fn clear_query_cache() -> Result<bool, String> { ... }
    ```
  - 函数内部调用 `query_cache_service::invalidate_all()`（如方法名不同，按实际实现调用）
  - 在 `src-tauri/src/lib.rs` 的 `invoke_handler` 中注册新命令
  - 在 `src/services/tauri.ts` 中新增 `clearQueryCache()` 方法：
    ```typescript
    async clearQueryCache(): Promise<ApiResponse<boolean>> {
      return this.invokeCommand<boolean>('clear_query_cache');
    }
    ```
- **Acceptance Criteria Addressed**：AC-7
- **Test Requirements**：
  - `programmatic` TR-6.1.1：`cargo check --quiet` 通过
  - `programmatic` TR-6.1.2：`cargo test --quiet` 通过（如新增了 `mod tests`）
  - `programmatic` TR-6.1.3：前端 `clearQueryCache()` 的 TypeScript 类型检查通过
- **Notes**：此任务与 Task 6（前端面板）并行推进。前端面板可先 mock `clearQueryCache()`，等本任务完成后接入真实命令。

---

## [ ] Task 7：虚拟滚动深化（TrashPanel / ChartLibraryPanel / ActivityLog）

- **Priority**：P1
- **Depends On**：None（`src/utils/virtual.ts` 已存在）
- **Track**：D（虚拟滚动深化）
- **Description**：
  - **TrashPanel（`src/components/trash/index.tsx`）**：
    - 将当前的 `items.map(...)` 改为基于 `computeVisibleRange(scrollTop, viewportHeight, 72, items.length, 5)` 的虚拟化渲染
    - 外层容器设为 `position: relative; height: viewportHeight`，内层用 `totalHeight` 占位
    - 每个可见条目使用 `position: absolute; top: index * 72px; height: 72px`
    - 条目高度固定 `72px`
  - **ChartLibraryPanel（`src/components/dashboard/ChartLibraryPanel.tsx`）**：
    - 同 TrashPanel 模式；条目高度固定 `96px`
  - **ActivityLog（`src/pages/ActivityLog.tsx` 或共用组件）**：
    - 如有长列表，同样接入 `computeVisibleRange`，条目高度 `64~80px`
  - 为每个虚拟化容器新增 `data-testid="virtual-list"` / `data-testid="virtual-item"` 便于 E2E 验证
- **Acceptance Criteria Addressed**：AC-10, AC-11
- **Test Requirements**：
  - `programmatic` TR-7.1：1000 条数据时，实际 DOM 中条目数 ≤ 视口容量 + 2 × overscan（约 30~50 条）
  - `programmatic` TR-7.2：`npx tsc --noEmit --pretty` 通过
  - `programmatic` TR-7.3：`npx vitest run` 全部通过
  - `human-judgement` TR-7.4：在 1000 条假数据下滚动平滑，无明显掉帧或空白闪白（overscan 允许少量空项）
  - `human-judgement` TR-7.5：长滚动条比例与总条目数相符，滚动到末尾时最后一项正常可见
- **Notes**：虚拟化改造可能需调整父容器的 `overflow: auto`，确保滚动事件触发 `scrollTop` 更新；如遇 layout shift，通过 `useLayoutEffect` 替代 `useEffect` 同步测量视口尺寸

---

## [ ] Task 8：门禁与回归测试（综合）

- **Priority**：P0
- **Depends On**：Task 1~Task 7 全部完成
- **Track**：综合（All）
- **Description**：
  - 一次性执行全部质量门禁命令，记录输出：
    - `cargo check --quiet`
    - `cargo test --quiet`
    - `npx tsc --noEmit --pretty`
    - `npx vitest run`
    - `npm run e2e`
    - 中文硬编码扫描
    - 翻译一致性脚本
  - 修复发现的问题（不得新增功能，仅修复）
  - 更新 `docs/架构现状.md` 的版本记录（文档任务，单独列示但不产生代码改动）
- **Acceptance Criteria Addressed**：AC-12, AC-13, AC-14
- **Test Requirements**：
  - `programmatic` TR-8.1：以上所有命令零错误、零 failure
  - `human-judgement` TR-8.2：架构状态文档已同步更新
- **Notes**：此任务是里程碑验收前的最后一步。各 track 可独立自检，但最终必须汇总到此任务。

---

## 任务依赖图（DAG）

```
Task 1 (i18n 基础设施)
  ├──▶ Task 2 (公共组件迁移) ──┐
  │                              ├──▶ Task 8 (门禁回归)
  └──▶ Task 3 (业务组件迁移) ──┘

Task 4 (E2E 框架)
  └──▶ Task 5 (4 个 journey spec) ──┐
                                     ├──▶ Task 8

Task 6.1 (后端 clear_query_cache 命令) ─┐
                                           ├──▶ Task 6 (缓存面板增强) ──▶ Task 8
Task 6 前端面板（mock 先行，后接入真实接口）─┘

Task 7 (虚拟滚动深化) ─────────────────────▶ Task 8
```

**并行窗口**：
- Track A（Task 1→2→3）、Track B（Task 4→5）、Track C（Task 6.1→6）、Track D（Task 7）四者之间互相独立，可由不同开发者同时推进
- Task 1 完成后，Task 2 与 Task 3 可以进一步并行（一个人做公共组件，一个人做业务组件）
- Task 6.1（后端命令）与 Task 6（前端面板）可并行推进（面板先 mock 接口）

---

## 角色分工映射

| 角色 | 负责任务 | 说明 |
|------|---------|------|
| **前端** | Task 1、Task 2、Task 3、Task 6、Task 7 | 主产出 |
| **后端** | Task 6.1、Task 7 可选分页接口 | 配合前端面板与分页 |
| **QA** | Task 4、Task 5、Task 8 的 E2E 部分 | 测试搭建与回归 |
| **架构** | Task 8、协调各 track | 质量门禁把关与里程碑验收 |

---

**文档维护说明**：每个 task 完成后，立即将 `[ ]` 改为 `[x]`，并把验证结果（cargo check / tsc / vitest / e2e 等）记录在本任务末尾作为补充信息。

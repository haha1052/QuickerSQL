# M8 里程碑 - 验收清单（Verification Checklist）

本清单对应 `spec.md` 中的 Acceptance Criteria（AC-1 ~ AC-14）。每项检查通过后标记 `[x]`。

---

## 一、国际化（i18n）

- [ ] **AC-1 语言设置 UI 可用**
  - [ ] 设置面板存在"语言"下拉选择器，包含 zh-CN 和 en-US 两项
  - [ ] 点击 en-US 后 300ms 内 UI 文本整体更新为英文
  - [ ] 关闭并重新打开应用，语言仍为 en-US（持久化验证）
  - [ ] 切回 zh-CN，所有文本恢复中文

- [ ] **AC-2 零硬编码中文（业务组件与页面）**
  - [ ] 执行 `Get-ChildItem -Path src/components -Include *.ts,*.tsx -Recurse | Select-String -Pattern '[\u4e00-\u9fa5]' | Where-Object { $_.Line -notmatch '^\s*//' -and $_.Line -notmatch 't\(' -and $_.Line -notmatch '/\*' -and $_.Line -notmatch '\*/' }` → 结果 = 0 条
  - [ ] 对 `src/pages/` 同样执行 → 结果 = 0 条
  - [ ] 对 `src/store/` 同样执行 → 结果 = 0 条

- [ ] **AC-3 翻译一致性**
  - [ ] 运行 Node 脚本 `node -e "const a=JSON.parse(require('fs').readFileSync('src/context/LocaleContext.tsx','utf8'));..."`（或等价方案）对比 zh-CN 与 en-US 的 key 集合；输出 0 missing / 0 extra
  - [ ] 如有缺失 / 冗余，补齐后重新通过

- [ ] **AC-4 t() 插值支持**
  - [ ] `src/__tests__/i18n.test.tsx` 存在并通过
  - [ ] 至少覆盖：含一个变量插值、含两个变量、无变量（纯文本）三种场景
  - [ ] 测试文件中 `npx vitest run` 全部通过

---

## 二、E2E 自动化测试

- [ ] **AC-5 E2E 测试框架就绪**
  - [ ] `e2e/playwright.config.ts` 存在且合法（`npx tsc --noEmit` 无错误）
  - [ ] `e2e/specs/` 目录下存在 4 个 `.spec.ts` 文件
  - [ ] `package.json` 存在 `e2e` 与 `e2e:headed` 两个脚本
  - [ ] `e2e/README.md` 存在且含清晰运行说明

- [ ] **AC-6 核心旅程测试通过**
  - [ ] `npm run e2e` 正常执行；退出码 = 0
  - [ ] Journey 1（项目 / 导入 / 查询）至少 1 个 case 通过
  - [ ] Journey 2（回收站）至少 1 个 case 通过
  - [ ] Journey 3（仪表盘 / 图表）至少 1 个 case 通过
  - [ ] Journey 4（自动化任务）至少 1 个 case 通过
  - [ ] 报告显示 0 failure（允许因环境缺失而被 `test.skip()` 标记的 case，但需在报告中显式说明原因）

---

## 三、查询缓存面板增强

- [ ] **AC-7 clear_query_cache 命令可用**
  - [ ] `cargo check --quiet` 通过
  - [ ] `src-tauri/src/lib.rs` 中已注册 `clear_query_cache` 命令
  - [ ] `src/services/tauri.ts` 中存在 `clearQueryCache()` 方法
  - [ ] 在前端调用 `clearQueryCache()` → 面板立即显示 size=0、hits=0、misses=0

- [ ] **AC-8 缓存面板自动刷新**
  - [ ] 面板存在"自动刷新"开关（checkbox / toggle）
  - [ ] 开启后，每 5 秒至少触发一次 `get_query_cache_stats` 调用（可通过 DevTools Network 或简单 console 观测）
  - [ ] 关闭后，setInterval 被清理（`useEffect` cleanup 验证）
  - [ ] 面板数据随刷新更新

- [ ] **AC-9 命中率折线图**
  - [ ] 面板中新增 ECharts 折线图 DOM（可通过 DOM 定位）
  - [ ] 连续执行 10 次相同查询后，折线图 hitRate 值上升
  - [ ] 最多保留最近 20 个样本（可用 mock 验证环形缓冲逻辑）

---

## 四、虚拟滚动深化

- [ ] **AC-10 TrashPanel 虚拟化**
  - [ ] 构造 1000 条测试数据，打开回收站
  - [ ] 检查 DOM 中实际渲染的 `.trash-item` 或 `data-testid=virtual-item` 元素数量 ≪ 1000
  - [ ] 滚动到底部，最后一项可见且数据正确
  - [ ] 滚动过程中目测平滑，无大面积空白（overscan 外不应出现长期空白）
  - [ ] 滚动条尺寸正确反映 totalHeight

- [ ] **AC-11 ChartLibraryPanel 虚拟化**
  - [ ] 同 AC-10，针对图表库列表做相同验证
  - [ ] 确保每张图表卡片的交互（点击、编辑、删除）仍然可用

---

## 五、综合门禁（每次代码变更后）

- [ ] **AC-12 类型与编译门禁**
  - [ ] `cargo check --quiet` 输出 0 errors
  - [ ] `npx tsc --noEmit --pretty` 输出 0 errors

- [ ] **AC-13 测试门禁**
  - [ ] `cargo test --quiet` 全部通过（无 failure、无 panic）
  - [ ] `npx vitest run` 全部通过（无 failure，无 timeout）

- [ ] **AC-14 中文硬编码门禁**
  - [ ] 对 `src/components/**/*.tsx`、`src/pages/**/*.tsx`、`src/store/**/*.ts` 做中文正则扫描，排除以下情况：
    - 注释行（`//` 开头或在 `/*...*/` 内）
    - `t("xxx")` / `t('xxx')` 形式（i18n key 本身含中文是正常的，例如 key 尚未迁移的过渡）
  - [ ] 扫描结果 = 0 条（即所有中文都在翻译表内或注释中）

---

## 六、NFR 检查（非功能性需求）

- [ ] **NFR-1 零新增依赖（除 @playwright/test 外）**
  - [ ] 检查 `package.json` 的 `dependencies` 与 `devDependencies`，确认除 `@playwright/test` 外无新增依赖
  - [ ] 检查 `Cargo.toml`，确认无新增 crate

- [ ] **NFR-2 类型安全**
  - [ ] 所有新增/修改的 TypeScript 文件中无 `any` 类型
  - [ ] 所有新 Rust 命令返回值有显式类型签名

- [ ] **NFR-4 性能指标**
  - [ ] 1000 条数据的 TrashPanel 滚动 ≈ 60 FPS（Chrome DevTools Performance 录制验证）
  - [ ] 缓存面板开启自动刷新 + 折线图后，CPU 增量 ≤ 2%（Task Manager 观测）

- [ ] **NFR-6 视觉一致性**
  - [ ] en-US 模式下所有按钮 / Toast 文本不溢出
  - [ ] 无横向滚动条
  - [ ] Toast 在两种语言下宽度一致

- [ ] **NFR-7 代码风格**
  - [ ] 新代码 JSDoc / Rust doc comment 覆盖率 ≥ 80%
  - [ ] 遵循项目现有命名规范（snake_case / camelCase / PascalCase）
  - [ ] 无大段被注释掉的代码

---

## 七、里程碑验收通过条件

```
总勾选数 / 总检查项数 = 100%
同时满足：
  cargo check --quiet = 0 errors
  cargo test --quiet = 0 failures
  npx tsc --noEmit --pretty = 0 errors
  npx vitest run = 0 failures
  npm run e2e = 0 failures（或明确 skip 原因）
  中文硬编码扫描 = 0 hits
```

**文档维护说明**：每完成一项检查，由执行者将 `[ ]` 改为 `[x]` 并签上姓名/日期（在行内以 `-- user YYYY-MM-DD` 形式标注）。里程碑验收会议上，本清单作为主证据材料。

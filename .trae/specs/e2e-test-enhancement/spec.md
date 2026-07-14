# E2E 自动化测试改进方案

## 一、现状分析

### 1.1 当前问题

| 问题 | 说明 | 影响 |
|------|------|------|
| **缺少 tauri-driver** | 没有 Tauri 专用的 Playwright driver | 无法驱动 Tauri 窗口 |
| **测试用例为空** | `01-workflow.spec.ts` 所有用例都是 skip | 测试覆盖率 0% |
| **缺少核心场景** | 没有 SQL 查询、仪表盘、任务中心等真实场景 | 无法验证核心功能 |
| **启动验证缺失** | 没有验证应用启动成功的测试 | 无法确保应用可运行 |

### 1.2 当前测试文件状态

| 文件 | 状态 | 问题 |
|------|------|------|
| `e2e/playwright.config.ts` | ✅ 已配置 | 配置正确 |
| `e2e/specs/00-basic-startup.spec.ts` | ⚠️ 占位测试 | 只有框架验证 |
| `e2e/specs/01-workflow.spec.ts` | ❌ 全部 skip | 等待 tauri-driver |

---

## 二、改进目标

- **G1**：增强 00-basic-startup.spec.ts，添加实际启动验证
- **G2**：编写核心用户旅程测试，覆盖 SQL 查询、仪表盘、任务中心、设置
- **G3**：建立 E2E 测试门禁，确保每次运行都能验证核心功能

---

## 三、测试用例规划

| 文件 | 场景 | 测试用例数 |
|------|------|-----------|
| 00-basic-startup.spec.ts | 应用启动、UI元素验证 | 3 |
| 01-sql-query.spec.ts | SQL执行、结果展示、历史记录 | 4 |
| 02-dashboard.spec.ts | 仪表盘导航、图表操作 | 3 |
| 03-automation.spec.ts | 任务中心、任务创建 | 3 |
| 04-settings.spec.ts | 设置页面、主题切换 | 3 |

---

## 四、验收标准

| AC | 描述 | 验证方式 |
|----|------|---------|
| AC-1 | `npm run e2e` 能正常运行 | 手动运行验证 |
| AC-2 | 至少 15 个测试用例通过 | 运行测试 |
| AC-3 | 所有测试用例可重复执行 | 代码审查 |
| AC-4 | README 更新运行说明 | 文档审查 |

---

## 五、影响范围

| 影响的文件/目录 | 变化 |
|----------------|------|
| `e2e/specs/00-basic-startup.spec.ts` | 增强测试用例 |
| `e2e/specs/01-sql-query.spec.ts` | 新建 |
| `e2e/specs/02-dashboard.spec.ts` | 新建 |
| `e2e/specs/03-automation.spec.ts` | 新建 |
| `e2e/specs/04-settings.spec.ts` | 新建 |
| `e2e/README.md` | 更新运行说明 |
| `docs/架构现状.md` | 更新测试章节 |

---

## 六、Open Questions

- [x] Q1：是否需要 CI 集成？→ 暂不需要，先建立本地可运行的测试
- [ ] Q2：测试数据库如何管理？→ 使用应用默认数据库
- [ ] Q3：哪些是 smoke test？→ SQL查询、仪表盘导航、设置页面

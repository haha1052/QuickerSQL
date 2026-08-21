# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 02-dashboard-empty.spec.ts >> 仪表盘空状态测试 >> 新建仪表盘按钮可见 — 验证按钮存在
- Location: e2e\specs\02-dashboard-empty.spec.ts:58:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.dashboard-toolbar, [data-dashboard-canvas], .emptyCanvas, [class*="empty"]').first()
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('.dashboard-toolbar, [data-dashboard-canvas], .emptyCanvas, [class*="empty"]').first()

```

```yaml
- text: 🦆
- button "项目 未选择":
  - img
  - text: 项目 未选择
- button "数据导入"
- button "SQL查询"
- button "仪表盘"
- button "自动化任务"
- button "设置":
  - img
- button "─"
- button "□"
- button "×"
- text: 📊 还没有仪表盘 创建您的第一个仪表盘，开始可视化数据分析
- button "创建仪表盘"
```

# Test source

```ts
  1  | import { test, expect, Page } from '@playwright/test';
  2  | 
  3  | /**
  4  |  * 仪表盘空状态 E2E 测试
  5  |  * 专注验证仪表盘在无数据状态下的 UI 表现：
  6  |  * - 切换到 dashboard tab 后页面正常加载
  7  |  * - 空状态提示或新建入口可见
  8  |  * 兼容 i18n：tab 文本同时匹配英文 dashboard 与中文 仪表盘
  9  |  */
  10 | test.describe('仪表盘空状态测试', () => {
  11 |   test.beforeEach(async ({ page }) => {
  12 |     // 参考现有 01-sql-query.spec.ts 的导航与等待策略
  13 |     await page.goto('/');
  14 |     await page.waitForLoadState('domcontentloaded');
  15 |   });
  16 | 
  17 |   /**
  18 |    * 测试用例 1: 切换到 dashboard tab，验证空状态显示
  19 |    * 不依赖具体数据：空提示、新建按钮、已有仪表盘下拉框三者至少其一可见即通过
  20 |    */
  21 |   test('空仪表盘状态 — 切换到 dashboard tab，验证空状态显示', async ({ page }: { page: Page }) => {
  22 |     // 点击 dashboard 标签（i18n 兼容：英文 dashboard / 中文 仪表盘）
  23 |     const dashboardTab = page
  24 |       .locator('button.header-tab', { hasText: /dashboard|仪表盘/i })
  25 |       .first();
  26 |     await expect(dashboardTab).toBeVisible();
  27 |     await dashboardTab.click();
  28 |     await page.waitForLoadState('domcontentloaded');
  29 | 
  30 |     // 验证仪表盘区域加载：工具栏、画布或空状态至少有一个可见
  31 |     const dashboardArea = page
  32 |       .locator('.dashboard-toolbar, [data-dashboard-canvas], .emptyCanvas, [class*="empty"]')
  33 |       .first();
  34 |     await expect(dashboardArea).toBeVisible({ timeout: 10000 });
  35 | 
  36 |     // 验证空状态提示或新建入口可见（不依赖具体数据）
  37 |     // 空状态可能是：空画布提示、新建仪表盘按钮、或已有仪表盘的下拉框
  38 |     const emptyHint = page.locator('text=/暂无|空|empty|没有仪表盘/i').first();
  39 |     const createButton = page
  40 |       .locator(
  41 |         'button:has-text("新建"), button:has-text("创建"), button:has-text("New"), button:has-text("+")'
  42 |       )
  43 |       .first();
  44 |     const dashboardSelect = page.locator('.dashboard-toolbar select').first();
  45 | 
  46 |     const hasEmptyHint = await emptyHint.isVisible({ timeout: 3000 }).catch(() => false);
  47 |     const hasCreateButton = await createButton.isVisible({ timeout: 3000 }).catch(() => false);
  48 |     const hasSelect = await dashboardSelect.isVisible({ timeout: 3000 }).catch(() => false);
  49 | 
  50 |     // 三者至少有一个为真（空提示 / 新建按钮 / 已有仪表盘下拉框）
  51 |     expect(hasEmptyHint || hasCreateButton || hasSelect).toBeTruthy();
  52 |   });
  53 | 
  54 |   /**
  55 |    * 测试用例 2: 新建仪表盘按钮可见
  56 |    * 验证 dashboard 页面存在新建入口（独立按钮或工具栏内入口）
  57 |    */
  58 |   test('新建仪表盘按钮可见 — 验证按钮存在', async ({ page }: { page: Page }) => {
  59 |     // 点击 dashboard 标签
  60 |     const dashboardTab = page
  61 |       .locator('button.header-tab', { hasText: /dashboard|仪表盘/i })
  62 |       .first();
  63 |     await dashboardTab.click();
  64 |     await page.waitForLoadState('domcontentloaded');
  65 | 
  66 |     // 验证仪表盘区域已加载
  67 |     const dashboardArea = page
  68 |       .locator('.dashboard-toolbar, [data-dashboard-canvas], .emptyCanvas, [class*="empty"]')
  69 |       .first();
> 70 |     await expect(dashboardArea).toBeVisible({ timeout: 10000 });
     |                                 ^ Error: expect(locator).toBeVisible() failed
  71 | 
  72 |     // 验证新建入口存在：新建/创建按钮，或已有仪表盘时的工具栏（含新建入口）
  73 |     const createButton = page
  74 |       .locator(
  75 |         'button:has-text("新建"), button:has-text("创建"), button:has-text("New"), button:has-text("+")'
  76 |       )
  77 |       .first();
  78 |     const hasCreateButton = await createButton.isVisible({ timeout: 3000 }).catch(() => false);
  79 | 
  80 |     if (hasCreateButton) {
  81 |       // 新建按钮可见，验证可点击
  82 |       await expect(createButton).toBeEnabled();
  83 |     } else {
  84 |       // 若无独立新建按钮，验证仪表盘工具栏存在（工具栏内通常含新建入口）
  85 |       const toolbar = page.locator('.dashboard-toolbar');
  86 |       const hasToolbar = await toolbar.isVisible({ timeout: 3000 }).catch(() => false);
  87 |       expect(hasToolbar).toBeTruthy();
  88 |     }
  89 |   });
  90 | });
  91 | 
```
# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 00-basic-startup.spec.ts >> 基本启动测试 >> 主界面元素 >> sql 标签页应处于激活状态
- Location: e2e\specs\00-basic-startup.spec.ts:41:5

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('.header-tab-active')
Expected substring: "sql"
Received string:    "数据导入"
Timeout: 5000ms

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for locator('.header-tab-active')
    13 × locator resolved to <button class="header-tab header-tab-active">数据导入</button>
       - unexpected value "数据导入"

```

```yaml
- button "数据导入"
```

# Test source

```ts
  1  | import { test, expect, Page } from '@playwright/test';
  2  | 
  3  | test.describe('基本启动测试', () => {
  4  |   test.describe('应用加载', () => {
  5  |     test('应用应能启动并响应 HTTP 200（当 E2E_WITH_WEBSERVER=1 时）', async ({ request }) => {
  6  |       test.skip(process.env.E2E_WITH_WEBSERVER !== '1', '未启用 webServer 模式');
  7  |       const res = await request.get('http://localhost:1420/');
  8  |       expect(res.ok()).toBeTruthy();
  9  |     });
  10 |   });
  11 | 
  12 |   test.describe('主界面元素', () => {
  13 |     test.beforeEach(async ({ page }) => {
  14 |       await page.goto('http://localhost:1420/');
  15 |     });
  16 | 
  17 |     test('应存在 header 容器', async ({ page }: { page: Page }) => {
  18 |       const header = page.locator('.header-container');
  19 |       await expect(header).toBeVisible();
  20 |     });
  21 | 
  22 |     test('应存在 logo', async ({ page }: { page: Page }) => {
  23 |       const logo = page.locator('.header-logo');
  24 |       await expect(logo).toBeVisible();
  25 |     });
  26 | 
  27 |     test('应存在标签页：sql、dashboard、automation', async ({ page }: { page: Page }) => {
  28 |       const tabs = page.locator('.header-tab');
  29 |       await expect(tabs).toHaveCount(3);
  30 | 
  31 |       const sqlTab = page.locator('.header-tab', { hasText: 'sql' });
  32 |       await expect(sqlTab).toBeVisible();
  33 | 
  34 |       const dashboardTab = page.locator('.header-tab', { hasText: 'dashboard' });
  35 |       await expect(dashboardTab).toBeVisible();
  36 | 
  37 |       const automationTab = page.locator('.header-tab', { hasText: 'automation' });
  38 |       await expect(automationTab).toBeVisible();
  39 |     });
  40 | 
  41 |     test('sql 标签页应处于激活状态', async ({ page }: { page: Page }) => {
  42 |       const activeTab = page.locator('.header-tab-active');
  43 |       await expect(activeTab).toBeVisible();
> 44 |       await expect(activeTab).toContainText('sql');
     |                               ^ Error: expect(locator).toContainText(expected) failed
  45 |     });
  46 |   });
  47 | 
  48 |   test.describe('侧边栏', () => {
  49 |     test.beforeEach(async ({ page }) => {
  50 |       await page.goto('http://localhost:1420/');
  51 |     });
  52 | 
  53 |     test('应存在侧边栏容器', async ({ page }: { page: Page }) => {
  54 |       const sidebar = page.locator('.sidebar-container');
  55 |       await expect(sidebar).toBeVisible();
  56 |     });
  57 |   });
  58 | });
  59 | 
```
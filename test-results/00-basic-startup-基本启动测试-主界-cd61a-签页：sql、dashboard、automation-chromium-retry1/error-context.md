# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 00-basic-startup.spec.ts >> 基本启动测试 >> 主界面元素 >> 应存在标签页：sql、dashboard、automation
- Location: e2e\specs\00-basic-startup.spec.ts:27:5

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('.header-tab')
Expected: 3
Received: 4
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" with timeout 5000ms
  - waiting for locator('.header-tab')
    13 × locator resolved to 4 elements
       - unexpected value "4"

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - generic [ref=e5]:
    - generic [ref=e6]:
      - generic [ref=e7]: 🦆
      - button "项目 未选择" [ref=e8] [cursor=pointer]:
        - img [ref=e9]
        - generic [ref=e12]: 项目
        - generic [ref=e13]: 未选择
      - button "数据导入" [ref=e15] [cursor=pointer]
      - button "SQL查询" [ref=e16] [cursor=pointer]
      - button "仪表盘" [ref=e17] [cursor=pointer]
      - button "自动化任务" [ref=e18] [cursor=pointer]
    - generic [ref=e20]:
      - button "设置" [ref=e21] [cursor=pointer]:
        - img [ref=e22]
      - generic [ref=e25]:
        - button "─" [ref=e26] [cursor=pointer]:
          - generic [ref=e27]: ─
        - button "□" [ref=e28] [cursor=pointer]:
          - generic [ref=e29]: □
        - button "×" [ref=e30] [cursor=pointer]:
          - generic [ref=e31]: ×
  - generic [ref=e32]:
    - button "+ 文件" [ref=e35] [cursor=pointer]:
      - img [ref=e36]
      - generic [ref=e39]: + 文件
    - generic [ref=e42] [cursor=pointer]:
      - generic [ref=e43]: 📥
      - generic [ref=e44]: 暂无导入任务
      - generic [ref=e45]: 选择 CSV/Excel/JSON/Parquet/TXT 文件，或拖拽到此处
      - generic [ref=e46]:
        - img [ref=e47]
        - generic [ref=e50]: 选择文件
      - paragraph [ref=e51]: 支持 CSV、Excel、JSON、Parquet、TXT 文件
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
> 29 |       await expect(tabs).toHaveCount(3);
     |                          ^ Error: expect(locator).toHaveCount(expected) failed
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
  44 |       await expect(activeTab).toContainText('sql');
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
# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 03-automation.spec.ts >> 任务中心自动化测试 >> 任务中心页面导航：点击 automation tab，验证页面加载
- Location: e2e\specs\03-automation.spec.ts:8:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.header-tab').filter({ hasText: /automation/i }).first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('.header-tab').filter({ hasText: /automation/i }).first()

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
- button "+ 文件":
  - img
  - text: + 文件
- text: 📥 暂无导入任务 选择 CSV/Excel/JSON/Parquet/TXT 文件，或拖拽到此处
- img
- text: 选择文件
- paragraph: 支持 CSV、Excel、JSON、Parquet、TXT 文件
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('任务中心自动化测试', () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     await page.goto('/');
  6  |   });
  7  | 
  8  |   test('任务中心页面导航：点击 automation tab，验证页面加载', async ({ page }) => {
  9  |     const automationTab = page.locator('.header-tab').filter({ hasText: /automation/i }).first();
> 10 |     await expect(automationTab).toBeVisible();
     |                                 ^ Error: expect(locator).toBeVisible() failed
  11 |     await automationTab.click();
  12 |     await expect(page).not.toHaveURL(/^$/);
  13 |   });
  14 | 
  15 |   test('任务中心 UI 元素存在：验证任务列表容器存在', async ({ page }) => {
  16 |     const automationTab = page.locator('.header-tab').filter({ hasText: /automation/i }).first();
  17 |     await automationTab.click();
  18 |     const taskContainer = page.locator('.task-center, .task-list').first();
  19 |     await expect(taskContainer).toBeVisible({ timeout: 5000 });
  20 |   });
  21 | 
  22 |   test('新建任务按钮存在：验证可以点击新建任务按钮', async ({ page }) => {
  23 |     const automationTab = page.locator('.header-tab').filter({ hasText: /automation/i }).first();
  24 |     await automationTab.click();
  25 |     const newTaskButton = page.locator('.new-task-button, button:has-text("新建任务"), button:has-text("New Task")').first();
  26 |     await expect(newTaskButton).toBeVisible({ timeout: 5000 });
  27 |     await newTaskButton.click();
  28 |   });
  29 | });
  30 | 
```
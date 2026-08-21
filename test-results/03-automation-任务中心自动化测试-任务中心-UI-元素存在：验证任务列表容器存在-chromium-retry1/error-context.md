# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 03-automation.spec.ts >> 任务中心自动化测试 >> 任务中心 UI 元素存在：验证任务列表容器存在
- Location: e2e\specs\03-automation.spec.ts:15:3

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('.header-tab').filter({ hasText: /automation/i }).first()

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
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('任务中心自动化测试', () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     await page.goto('/');
  6  |   });
  7  | 
  8  |   test('任务中心页面导航：点击 automation tab，验证页面加载', async ({ page }) => {
  9  |     const automationTab = page.locator('.header-tab').filter({ hasText: /automation/i }).first();
  10 |     await expect(automationTab).toBeVisible();
  11 |     await automationTab.click();
  12 |     await expect(page).not.toHaveURL(/^$/);
  13 |   });
  14 | 
  15 |   test('任务中心 UI 元素存在：验证任务列表容器存在', async ({ page }) => {
  16 |     const automationTab = page.locator('.header-tab').filter({ hasText: /automation/i }).first();
> 17 |     await automationTab.click();
     |                         ^ Error: locator.click: Test timeout of 60000ms exceeded.
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
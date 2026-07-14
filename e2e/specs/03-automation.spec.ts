import { test, expect } from '@playwright/test';

test.describe('任务中心自动化测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('任务中心页面导航：点击 automation tab，验证页面加载', async ({ page }) => {
    const automationTab = page.locator('.header-tab').filter({ hasText: /automation/i }).first();
    await expect(automationTab).toBeVisible();
    await automationTab.click();
    await expect(page).not.toHaveURL(/^$/);
  });

  test('任务中心 UI 元素存在：验证任务列表容器存在', async ({ page }) => {
    const automationTab = page.locator('.header-tab').filter({ hasText: /automation/i }).first();
    await automationTab.click();
    const taskContainer = page.locator('.task-center, .task-list').first();
    await expect(taskContainer).toBeVisible({ timeout: 5000 });
  });

  test('新建任务按钮存在：验证可以点击新建任务按钮', async ({ page }) => {
    const automationTab = page.locator('.header-tab').filter({ hasText: /automation/i }).first();
    await automationTab.click();
    const newTaskButton = page.locator('.new-task-button, button:has-text("新建任务"), button:has-text("New Task")').first();
    await expect(newTaskButton).toBeVisible({ timeout: 5000 });
    await newTaskButton.click();
  });
});

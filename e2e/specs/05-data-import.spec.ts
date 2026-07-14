import { test, expect } from '@playwright/test';

test.describe('数据导入页面测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test.describe('导航到数据导入页面', () => {
    test('点击 CSV 导入标签，验证页面导航成功', async ({ page }) => {
      const csvTab = page.locator('button.header-tab').filter({ hasText: /csv|导入|import/i }).first();
      await expect(csvTab).toBeVisible();
      await csvTab.click();

      await expect(page.locator('.header-tab-active')).toContainText(/csv|导入|import/i);
    });

    test('数据导入页面工具栏存在', async ({ page }) => {
      const csvTab = page.locator('button.header-tab').filter({ hasText: /csv|导入|import/i }).first();
      await csvTab.click();

      const toolbar = page.locator('.toolbar, [style*="display: flex"][style*="align-items: center"][style*="border-bottom"]');
      await expect(toolbar.first()).toBeVisible();
    });
  });

  test.describe('关键 UI 元素验证', () => {
    test('添加文件按钮存在', async ({ page }) => {
      const csvTab = page.locator('button.header-tab').filter({ hasText: /csv|导入|import/i }).first();
      await csvTab.click();

      const addButton = page.locator('button').filter({ hasText: /添加文件|选择文件|add file|select file/i }).first();
      await expect(addButton).toBeVisible({ timeout: 5000 });
    });

    test('数据导入主容器存在', async ({ page }) => {
      const csvTab = page.locator('button.header-tab').filter({ hasText: /csv|导入|import/i }).first();
      await csvTab.click();

      const mainContainer = page.locator('[style*="flex: 1"][style*="display: flex"][style*="overflow: hidden"]').first();
      await expect(mainContainer).toBeVisible();
    });

    test('空状态提示存在', async ({ page }) => {
      const csvTab = page.locator('button.header-tab').filter({ hasText: /csv|导入|import/i }).first();
      await csvTab.click();

      const emptyState = page.locator('div').filter({ hasText: /暂无导入任务|no tasks|选择文件/i }).first();
      await expect(emptyState).toBeVisible({ timeout: 5000 });
    });

    test('支持格式说明存在', async ({ page }) => {
      const csvTab = page.locator('button.header-tab').filter({ hasText: /csv|导入|import/i }).first();
      await csvTab.click();

      const formatHint = page.locator('text=/csv|xlsx|xls/i').first();
      await expect(formatHint).toBeVisible({ timeout: 5000 });
    });
  });
});

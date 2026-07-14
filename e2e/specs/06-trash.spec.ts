import { test, expect } from '@playwright/test';

test.describe('回收站页面测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test.describe('打开回收站面板', () => {
    test('侧边栏存在回收站按钮', async ({ page }) => {
      const sidebar = page.locator('.sidebar-container, #sidebar-container').first();
      const hasSidebar = await sidebar.isVisible().catch(() => false);

      if (!hasSidebar) {
        const trashButton = page.locator('button').filter({ hasText: /🗑|回收站|trash/i }).first();
        await expect(trashButton).toBeVisible();
      } else {
        const trashNavItem = page.locator('button').filter({ hasText: /回收站|trash/i }).first();
        await expect(trashNavItem).toBeVisible();
      }
    });

    test('点击回收站按钮，验证面板打开', async ({ page }) => {
      const trashButton = page.locator('button').filter({ hasText: /回收站|trash/i }).first();
      await expect(trashButton).toBeVisible();
      await trashButton.click();

      const trashPanel = page.locator('.trash-panel').first();
      await expect(trashPanel).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('回收站 UI 元素验证', () => {
    test('回收站标题存在', async ({ page }) => {
      const trashButton = page.locator('button').filter({ hasText: /回收站|trash/i }).first();
      await trashButton.click();

      const trashPanel = page.locator('.trash-panel').first();
      await expect(trashPanel).toBeVisible({ timeout: 5000 });

      const title = trashPanel.locator('.trash-title, h2').filter({ hasText: /回收站|trash/i }).first();
      await expect(title).toBeVisible();
    });

    test('回收站刷新按钮存在', async ({ page }) => {
      const trashButton = page.locator('button').filter({ hasText: /回收站|trash/i }).first();
      await trashButton.click();

      const trashPanel = page.locator('.trash-panel').first();
      await expect(trashPanel).toBeVisible({ timeout: 5000 });

      const refreshButton = trashPanel.locator('button').filter({ hasText: /🔄|刷新|refresh/i }).first();
      await expect(refreshButton).toBeVisible();
    });

    test('回收站内容区域存在', async ({ page }) => {
      const trashButton = page.locator('button').filter({ hasText: /回收站|trash/i }).first();
      await trashButton.click();

      const trashPanel = page.locator('.trash-panel').first();
      await expect(trashPanel).toBeVisible({ timeout: 5000 });

      const content = trashPanel.locator('.trash-content').first();
      await expect(content).toBeVisible();
    });

    test('回收站列表容器存在', async ({ page }) => {
      const trashButton = page.locator('button').filter({ hasText: /回收站|trash/i }).first();
      await trashButton.click();

      const trashPanel = page.locator('.trash-panel').first();
      await expect(trashPanel).toBeVisible({ timeout: 5000 });

      const listContainer = trashPanel.locator('.trash-list, [style*="overflowY: auto"]').first();
      await expect(listContainer).toBeVisible();
    });

    test('空状态或加载状态存在', async ({ page }) => {
      const trashButton = page.locator('button').filter({ hasText: /回收站|trash/i }).first();
      await trashButton.click();

      const trashPanel = page.locator('.trash-panel').first();
      await expect(trashPanel).toBeVisible({ timeout: 5000 });

      const emptyState = trashPanel.locator('.trash-empty, .trash-loading').first();
      await expect(emptyState).toBeVisible({ timeout: 5000 });
    });
  });
});

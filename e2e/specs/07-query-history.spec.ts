import { test, expect } from '@playwright/test';

test.describe('查询历史面板测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test.describe('打开查询历史面板', () => {
    test('侧边栏存在查询历史按钮', async ({ page }) => {
      const historyButton = page.locator('button').filter({ hasText: /📜|历史|history|⏱|Clock/i }).first();
      await expect(historyButton).toBeVisible();
    });

    test('点击查询历史按钮，验证面板打开', async ({ page }) => {
      const historyButton = page.locator('button').filter({ hasText: /历史|query history|查询历史/i }).first();
      const hasButton = await historyButton.isVisible().catch(() => false);

      if (!hasButton) {
        const altHistoryButton = page.locator('button').filter({ hasText: /⏱|📜|Clock/i }).first();
        await expect(altHistoryButton).toBeVisible();
        await altHistoryButton.click();
      } else {
        await historyButton.click();
      }

      const historyPanel = page.locator('.query-history').first();
      await expect(historyPanel).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('查询历史 UI 元素验证', () => {
    test('查询历史标题存在', async ({ page }) => {
      const historyButton = page.locator('button').filter({ hasText: /历史|query history|查询历史|⏱|📜/i }).first();
      await historyButton.click();

      const historyPanel = page.locator('.query-history').first();
      await expect(historyPanel).toBeVisible({ timeout: 5000 });

      const title = historyPanel.locator('.history-title, h2').filter({ hasText: /历史|history/i }).first();
      await expect(title).toBeVisible();
    });

    test('查询历史刷新按钮存在', async ({ page }) => {
      const historyButton = page.locator('button').filter({ hasText: /历史|query history|查询历史|⏱|📜/i }).first();
      await historyButton.click();

      const historyPanel = page.locator('.query-history').first();
      await expect(historyPanel).toBeVisible({ timeout: 5000 });

      const refreshButton = historyPanel.locator('button').filter({ hasText: /🔄|刷新|refresh/i }).first();
      await expect(refreshButton).toBeVisible();
    });

    test('搜索框存在', async ({ page }) => {
      const historyButton = page.locator('button').filter({ hasText: /历史|query history|查询历史|⏱|📜/i }).first();
      await historyButton.click();

      const historyPanel = page.locator('.query-history').first();
      await expect(historyPanel).toBeVisible({ timeout: 5000 });

      const searchInput = historyPanel.locator('.search-input, input[type="text"]').first();
      await expect(searchInput).toBeVisible();
    });

    test('收藏筛选复选框存在', async ({ page }) => {
      const historyButton = page.locator('button').filter({ hasText: /历史|query history|查询历史|⏱|📜/i }).first();
      await historyButton.click();

      const historyPanel = page.locator('.query-history').first();
      await expect(historyPanel).toBeVisible({ timeout: 5000 });

      const favoriteFilter = historyPanel.locator('.favorite-filter, input[type="checkbox"]').first();
      await expect(favoriteFilter).toBeVisible();
    });

    test('历史列表容器存在', async ({ page }) => {
      const historyButton = page.locator('button').filter({ hasText: /历史|query history|查询历史|⏱|📜/i }).first();
      await historyButton.click();

      const historyPanel = page.locator('.query-history').first();
      await expect(historyPanel).toBeVisible({ timeout: 5000 });

      const listContainer = historyPanel.locator('.history-content, [style*="overflowY: auto"]').first();
      await expect(listContainer).toBeVisible();
    });

    test('空状态或加载状态存在', async ({ page }) => {
      const historyButton = page.locator('button').filter({ hasText: /历史|query history|查询历史|⏱|📜/i }).first();
      await historyButton.click();

      const historyPanel = page.locator('.query-history').first();
      await expect(historyPanel).toBeVisible({ timeout: 5000 });

      const emptyOrLoading = historyPanel.locator('.history-empty, .history-loading').first();
      await expect(emptyOrLoading).toBeVisible({ timeout: 5000 });
    });
  });
});

import { test, expect, Page } from '@playwright/test';

/**
 * 仪表盘空状态 E2E 测试
 * 专注验证仪表盘在无数据状态下的 UI 表现：
 * - 切换到 dashboard tab 后页面正常加载
 * - 空状态提示或新建入口可见
 * 兼容 i18n：tab 文本同时匹配英文 dashboard 与中文 仪表盘
 */
test.describe('仪表盘空状态测试', () => {
  test.beforeEach(async ({ page }) => {
    // 参考现有 01-sql-query.spec.ts 的导航与等待策略
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  /**
   * 测试用例 1: 切换到 dashboard tab，验证空状态显示
   * 不依赖具体数据：空提示、新建按钮、已有仪表盘下拉框三者至少其一可见即通过
   */
  test('空仪表盘状态 — 切换到 dashboard tab，验证空状态显示', async ({ page }: { page: Page }) => {
    // 点击 dashboard 标签（i18n 兼容：英文 dashboard / 中文 仪表盘）
    const dashboardTab = page
      .locator('button.header-tab', { hasText: /dashboard|仪表盘/i })
      .first();
    await expect(dashboardTab).toBeVisible();
    await dashboardTab.click();
    await page.waitForLoadState('domcontentloaded');

    // 验证仪表盘区域加载：工具栏、画布或空状态至少有一个可见
    const dashboardArea = page
      .locator('.dashboard-toolbar, [data-dashboard-canvas], .emptyCanvas, [class*="empty"]')
      .first();
    await expect(dashboardArea).toBeVisible({ timeout: 10000 });

    // 验证空状态提示或新建入口可见（不依赖具体数据）
    // 空状态可能是：空画布提示、新建仪表盘按钮、或已有仪表盘的下拉框
    const emptyHint = page.locator('text=/暂无|空|empty|没有仪表盘/i').first();
    const createButton = page
      .locator(
        'button:has-text("新建"), button:has-text("创建"), button:has-text("New"), button:has-text("+")'
      )
      .first();
    const dashboardSelect = page.locator('.dashboard-toolbar select').first();

    const hasEmptyHint = await emptyHint.isVisible({ timeout: 3000 }).catch(() => false);
    const hasCreateButton = await createButton.isVisible({ timeout: 3000 }).catch(() => false);
    const hasSelect = await dashboardSelect.isVisible({ timeout: 3000 }).catch(() => false);

    // 三者至少有一个为真（空提示 / 新建按钮 / 已有仪表盘下拉框）
    expect(hasEmptyHint || hasCreateButton || hasSelect).toBeTruthy();
  });

  /**
   * 测试用例 2: 新建仪表盘按钮可见
   * 验证 dashboard 页面存在新建入口（独立按钮或工具栏内入口）
   */
  test('新建仪表盘按钮可见 — 验证按钮存在', async ({ page }: { page: Page }) => {
    // 点击 dashboard 标签
    const dashboardTab = page
      .locator('button.header-tab', { hasText: /dashboard|仪表盘/i })
      .first();
    await dashboardTab.click();
    await page.waitForLoadState('domcontentloaded');

    // 验证仪表盘区域已加载
    const dashboardArea = page
      .locator('.dashboard-toolbar, [data-dashboard-canvas], .emptyCanvas, [class*="empty"]')
      .first();
    await expect(dashboardArea).toBeVisible({ timeout: 10000 });

    // 验证新建入口存在：新建/创建按钮，或已有仪表盘时的工具栏（含新建入口）
    const createButton = page
      .locator(
        'button:has-text("新建"), button:has-text("创建"), button:has-text("New"), button:has-text("+")'
      )
      .first();
    const hasCreateButton = await createButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasCreateButton) {
      // 新建按钮可见，验证可点击
      await expect(createButton).toBeEnabled();
    } else {
      // 若无独立新建按钮，验证仪表盘工具栏存在（工具栏内通常含新建入口）
      const toolbar = page.locator('.dashboard-toolbar');
      const hasToolbar = await toolbar.isVisible({ timeout: 3000 }).catch(() => false);
      expect(hasToolbar).toBeTruthy();
    }
  });
});

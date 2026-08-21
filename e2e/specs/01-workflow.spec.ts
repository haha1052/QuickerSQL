import { test, expect, Page } from '@playwright/test';

/**
 * 核心用户旅程 E2E 测试
 *
 * v25.4 重构：原 4 个测试通过 beforeAll 无条件 skip（标注"需要 Tauri Driver"）。
 * 现改为浏览器端可运行测试：验证页面加载、标签页导航、UI 元素可见性。
 * 实际 SQL 查询/数据操作仍需 Tauri 环境，故相关断言改为验证编辑器/面板可见而非数据正确性。
 */
test.describe('核心用户旅程', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:1420/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('主界面可见 — 应用加载后 header 与侧边栏可见', async ({ page }: { page: Page }) => {
    const header = page.locator('.header-container');
    await expect(header).toBeVisible({ timeout: 10000 });

    const sidebar = page.locator('.sidebar-container');
    await expect(sidebar).toBeVisible({ timeout: 10000 });
  });

  test('SQL 查询面板可见 — 切换到 SQL tab 后编辑器加载', async ({ page }: { page: Page }) => {
    // SQL tab 默认激活，验证查询面板区域可见
    const sqlPanel = page.locator('.sql-query-page, [class*="query"], .monaco-editor, textarea').first();
    await expect(sqlPanel).toBeVisible({ timeout: 10000 });
  });

  test('仪表盘面板可导航 — 点击 dashboard tab 后页面切换', async ({ page }: { page: Page }) => {
    const dashboardTab = page
      .locator('button.header-tab', { hasText: /dashboard|仪表盘/i })
      .first();
    await expect(dashboardTab).toBeVisible();
    await dashboardTab.click();
    await page.waitForLoadState('domcontentloaded');

    // 验证仪表盘区域加载
    const dashboardArea = page.locator('.dashboard-toolbar, [data-dashboard-canvas], [class*="empty"]').first();
    await expect(dashboardArea).toBeVisible({ timeout: 10000 });
  });

  test('任务中心面板可导航 — 点击 automation tab 后页面切换', async ({ page }: { page: Page }) => {
    const automationTab = page
      .locator('button.header-tab', { hasText: /automation|任务/i })
      .first();
    await expect(automationTab).toBeVisible();
    await automationTab.click();
    await page.waitForLoadState('domcontentloaded');

    // 验证任务区域加载
    const taskArea = page.locator('[class*="task"], [class*="automation"], [class*="empty"]').first();
    await expect(taskArea).toBeVisible({ timeout: 10000 });
  });
});

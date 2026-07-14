import { test, expect, Page } from '@playwright/test';

test.describe('基本启动测试', () => {
  test.describe('应用加载', () => {
    test('应用应能启动并响应 HTTP 200（当 E2E_WITH_WEBSERVER=1 时）', async ({ request }) => {
      test.skip(process.env.E2E_WITH_WEBSERVER !== '1', '未启用 webServer 模式');
      const res = await request.get('http://localhost:1420/');
      expect(res.ok()).toBeTruthy();
    });
  });

  test.describe('主界面元素', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('http://localhost:1420/');
    });

    test('应存在 header 容器', async ({ page }: { page: Page }) => {
      const header = page.locator('.header-container');
      await expect(header).toBeVisible();
    });

    test('应存在 logo', async ({ page }: { page: Page }) => {
      const logo = page.locator('.header-logo');
      await expect(logo).toBeVisible();
    });

    test('应存在标签页：sql、dashboard、automation', async ({ page }: { page: Page }) => {
      const tabs = page.locator('.header-tab');
      await expect(tabs).toHaveCount(3);

      const sqlTab = page.locator('.header-tab', { hasText: 'sql' });
      await expect(sqlTab).toBeVisible();

      const dashboardTab = page.locator('.header-tab', { hasText: 'dashboard' });
      await expect(dashboardTab).toBeVisible();

      const automationTab = page.locator('.header-tab', { hasText: 'automation' });
      await expect(automationTab).toBeVisible();
    });

    test('sql 标签页应处于激活状态', async ({ page }: { page: Page }) => {
      const activeTab = page.locator('.header-tab-active');
      await expect(activeTab).toBeVisible();
      await expect(activeTab).toContainText('sql');
    });
  });

  test.describe('侧边栏', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('http://localhost:1420/');
    });

    test('应存在侧边栏容器', async ({ page }: { page: Page }) => {
      const sidebar = page.locator('.sidebar-container');
      await expect(sidebar).toBeVisible();
    });
  });
});

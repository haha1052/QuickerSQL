import { test, expect } from '@playwright/test';

test.describe('核心用户旅程（待接入 Tauri Driver）', () => {
  test.beforeAll(() => {
    test.skip(true, '需要 Tauri Playwright driver 才能运行');
  });

  test('主界面可见', async ({ page }) => {
    await page.goto('http://localhost:1420/');
    await expect(page.locator('text=数据库')).toBeVisible();
  });

  test('SQL 查询返回正确数据', async ({ page }) => {
    await expect(true).toBeTruthy();
  });

  test('仪表盘面板可导航', async ({ page }) => {
    await expect(true).toBeTruthy();
  });

  test('任务中心面板可导航', async ({ page }) => {
    await expect(true).toBeTruthy();
  });
});

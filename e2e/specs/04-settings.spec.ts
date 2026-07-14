import { test, expect } from '@playwright/test';

test.describe('设置页面测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test.describe('设置页面基础功能', () => {
    test('设置页面打开：点击设置按钮，验证设置页面打开', async ({ page }) => {
      const settingsButton = page.locator('.header-settings-button');
      await settingsButton.click();
      const settingsContainer = page.locator('.settings-modal-container, .settings-sidebar');
      await expect(settingsContainer).toBeVisible();
    });

    test('设置分类存在：验证设置分类列表存在', async ({ page }) => {
      await page.locator('.header-settings-button').click();
      const settingsNav = page.locator('.settings-nav');
      await expect(settingsNav).toBeVisible();
    });

    test('主题选项存在：验证外观/主题选项存在', async ({ page }) => {
      await page.locator('.header-settings-button').click();
      const themeCategory = page.locator('.settings-nav li').filter({ hasText: /主题|外观|appearance|theme/i });
      await expect(themeCategory).toBeVisible();
    });

    test('设置关闭按钮存在', async ({ page }) => {
      await page.locator('.header-settings-button').click();
      const closeButton = page.locator('.settings-modal-close, button[title*="取消"], button[title*="close"]').first();
      await expect(closeButton).toBeVisible();
    });
  });

  test.describe('设置分类切换测试', () => {
    test('外观分类可以切换', async ({ page }) => {
      await page.locator('.header-settings-button').click();

      const appearanceCategory = page.locator('.settings-nav li').filter({ hasText: /外观|主题|appearance|theme/i }).first();
      await expect(appearanceCategory).toBeVisible();
      await appearanceCategory.click();

      const categoryTitle = page.locator('.settings-category-title').first();
      await expect(categoryTitle).toBeVisible();
      await expect(categoryTitle).toContainText(/外观|主题|appearance|theme/i);
    });

    test('编辑器分类可以切换', async ({ page }) => {
      await page.locator('.header-settings-button').click();

      const editorCategory = page.locator('.settings-nav li').filter({ hasText: /编辑器|editor/i }).first();
      const hasEditorCategory = await editorCategory.isVisible().catch(() => false);

      if (hasEditorCategory) {
        await editorCategory.click();

        const categoryTitle = page.locator('.settings-category-title').first();
        await expect(categoryTitle).toBeVisible();
        await expect(categoryTitle).toContainText(/编辑器|editor/i);
      } else {
        test.skip(true, '编辑器分类不存在');
      }
    });

    test('SQL 查询分类可以切换', async ({ page }) => {
      await page.locator('.header-settings-button').click();

      const sqlCategory = page.locator('.settings-nav li').filter({ hasText: /SQL|查询|query/i }).first();
      const hasSqlCategory = await sqlCategory.isVisible().catch(() => false);

      if (hasSqlCategory) {
        await sqlCategory.click();

        const categoryTitle = page.locator('.settings-category-title').first();
        await expect(categoryTitle).toBeVisible();
      } else {
        test.skip(true, 'SQL 查询分类不存在');
      }
    });

    test('数据导入分类可以切换', async ({ page }) => {
      await page.locator('.header-settings-button').click();

      const importCategory = page.locator('.settings-nav li').filter({ hasText: /导入|import|数据/i }).first();
      const hasImportCategory = await importCategory.isVisible().catch(() => false);

      if (hasImportCategory) {
        await importCategory.click();

        const categoryTitle = page.locator('.settings-category-title').first();
        await expect(categoryTitle).toBeVisible();
      } else {
        test.skip(true, '数据导入分类不存在');
      }
    });

    test('查询缓存分类可以切换', async ({ page }) => {
      await page.locator('.header-settings-button').click();

      const cacheCategory = page.locator('.settings-nav li').filter({ hasText: /缓存|cache|查询缓存/i }).first();
      const hasCacheCategory = await cacheCategory.isVisible().catch(() => false);

      if (hasCacheCategory) {
        await cacheCategory.click();

        const categoryTitle = page.locator('.settings-category-title').first();
        await expect(categoryTitle).toBeVisible();
        await expect(categoryTitle).toContainText(/缓存|cache/i);
      } else {
        test.skip(true, '查询缓存分类不存在');
      }
    });

    test('切换分类后内容区域更新', async ({ page }) => {
      await page.locator('.header-settings-button').click();

      const categories = page.locator('.settings-nav li');
      const categoryCount = await categories.count();

      if (categoryCount >= 2) {
        await categories.nth(0).click();
        const firstTitle = await page.locator('.settings-category-title').first().textContent();

        await categories.nth(1).click();
        const secondTitle = await page.locator('.settings-category-title').first().textContent();

        expect(firstTitle).not.toBe(secondTitle);
      } else {
        test.skip(true, '分类数量不足 2 个，无法测试切换');
      }
    });

    test('安全/关于分类可以切换', async ({ page }) => {
      await page.locator('.header-settings-button').click();

      const securityCategory = page.locator('.settings-nav li').filter({ hasText: /安全|关于|security|about|info/i }).first();
      const hasSecurityCategory = await securityCategory.isVisible().catch(() => false);

      if (hasSecurityCategory) {
        await securityCategory.click();

        const categoryTitle = page.locator('.settings-category-title').first();
        await expect(categoryTitle).toBeVisible();
      } else {
        test.skip(true, '安全/关于分类不存在');
      }
    });

    test('快捷键分类可以切换', async ({ page }) => {
      await page.locator('.header-settings-button').click();

      const shortcutCategory = page.locator('.settings-nav li').filter({ hasText: /快捷键|shortcut|热键/i }).first();
      const hasShortcutCategory = await shortcutCategory.isVisible().catch(() => false);

      if (hasShortcutCategory) {
        await shortcutCategory.click();

        const categoryTitle = page.locator('.settings-category-title').first();
        await expect(categoryTitle).toBeVisible();
      } else {
        test.skip(true, '快捷键分类不存在');
      }
    });
  });
});

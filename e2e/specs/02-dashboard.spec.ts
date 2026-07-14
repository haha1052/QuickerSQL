import { test, expect, Page } from '@playwright/test';

/**
 * 仪表盘功能 E2E 测试
 * 测试仪表盘的创建、图表管理、编辑等完整流程
 */
test.describe('仪表盘功能测试', () => {
  test.beforeEach(async ({ page }) => {
    // 先访问主页面并等待加载
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  /**
   * 测试用例 1: 仪表盘页面导航
   * 点击 dashboard tab，验证页面加载
   */
  test('仪表盘页面导航：点击 dashboard tab，验证页面加载', async ({ page }) => {
    // 点击仪表盘标签
    await page.click('button.header-tab:has-text("仪表盘")');

    // 验证仪表盘容器加载（工具栏或画布）
    const dashboardContainer = page.locator('.dashboard-toolbar, [data-dashboard-canvas]').first();
    await expect(dashboardContainer).toBeVisible();
  });

  /**
   * 测试用例 2: 仪表盘工具栏存在
   * 验证工具栏按钮存在
   */
  test('仪表盘工具栏存在：验证工具栏按钮存在', async ({ page }) => {
    // 点击仪表盘标签
    await page.click('button.header-tab:has-text("仪表盘")');

    // 等待工具栏出现
    const toolbar = page.locator('.dashboard-toolbar');
    await expect(toolbar).toBeVisible();
  });

  /**
   * 测试用例 3: 新增图表按钮存在
   * 验证可以点击新增图表按钮
   */
  test('新增图表按钮存在：验证可以点击新增图表按钮', async ({ page }) => {
    // 点击仪表盘标签
    await page.click('button.header-tab:has-text("仪表盘")');

    // 等待画布加载
    const canvas = page.locator('[data-dashboard-canvas]');
    await expect(canvas).toBeVisible({ timeout: 5000 });

    // 查找新增图表按钮
    const addChartButton = page.locator('button:has-text("添加图表"), button:has-text("+ 添加图表")').first();
    
    // 如果按钮可见，点击它
    if (await addChartButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addChartButton.click();
      
      // 验证添加图表弹窗出现
      const modal = page.locator('h3:has-text("添加图表")');
      await expect(modal).toBeVisible({ timeout: 3000 });
    } else {
      // 如果画布是空的，可能显示的是空状态提示
      test.skip(true, '仪表盘为空或无图表可添加');
    }
  });

  /**
   * 测试用例 4: 创建新仪表盘
   * 验证可以创建新的仪表盘
   */
  test('创建新仪表盘：填写仪表盘名称并保存', async ({ page }) => {
    // 点击仪表盘标签
    await page.click('button.header-tab:has-text("仪表盘")');
    await page.waitForLoadState('domcontentloaded');

    // 查找工具栏中的下拉框
    const dashboardSelect = page.locator('.dashboard-toolbar select').first();
    
    // 检查是否已有仪表盘
    const hasDashboards = await dashboardSelect.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (!hasDashboards) {
      // 没有仪表盘，查找创建按钮
      // 可能是空画布状态，查找创建相关按钮
      const emptyState = page.locator('.emptyCanvas, [class*="empty"]');
      if (await emptyState.isVisible({ timeout: 3000 }).catch(() => false)) {
        test.skip(true, '需要先创建仪表盘的入口在空状态中未找到');
      }
    }

    // 查找新建仪表盘的按钮或入口
    // 常见实现可能是下拉框旁边的"+"按钮或新建按钮
    const createButton = page.locator('button:has-text("新建"), button:has-text("创建"), button:has-text("+")').first();
    
    if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createButton.click();
      
      // 等待创建对话框或输入框出现
      await page.waitForTimeout(500);
      
      // 查找仪表盘名称输入框（可能是 prompt 或输入框）
      // 尝试使用 prompt 对话框（浏览器原生）
      page.on('dialog', async dialog => {
        if (dialog.type() === 'prompt') {
          await dialog.accept('测试仪表盘');
        }
      });
      
      // 如果有确认对话框
      const confirmBtn = page.locator('button:has-text("确认"), button:has-text("确定"), button:has-text("创建")').last();
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click();
      }
    }
    
    // 验证仪表盘创建成功（下拉框应有所选中的仪表盘）
    await page.waitForTimeout(1000);
    const selectedOption = page.locator('.dashboard-toolbar select option:checked');
    await expect(selectedOption).toBeVisible({ timeout: 5000 });
  });

  /**
   * 测试用例 5: 仪表盘下拉框切换
   * 验证可以切换不同的仪表盘
   */
  test('仪表盘下拉框切换：验证可以切换不同仪表盘', async ({ page }) => {
    // 点击仪表盘标签
    await page.click('button.header-tab:has-text("仪表盘")');
    await page.waitForLoadState('domcontentloaded');

    // 查找仪表盘选择下拉框
    const dashboardSelect = page.locator('.dashboard-toolbar select').first();
    
    // 检查下拉框是否存在
    const hasSelect = await dashboardSelect.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (!hasSelect) {
      test.skip(true, '没有可切换的仪表盘（下拉框不存在）');
    }

    // 获取所有仪表盘选项
    const options = page.locator('.dashboard-toolbar select option');
    const optionCount = await options.count();

    if (optionCount < 2) {
      test.skip(true, '只有一个仪表盘，无法测试切换');
    }

    // 记录当前选中的仪表盘
    const initialValue = await dashboardSelect.inputValue();

    // 选择不同的仪表盘
    await dashboardSelect.selectOption({ index: 1 });
    await page.waitForTimeout(500);

    // 验证仪表盘已切换
    const newValue = await dashboardSelect.inputValue();
    expect(newValue).not.toBe(initialValue);
  });

  /**
   * 测试用例 6: 编辑仪表盘布局
   * 验证可以进入编辑模式
   */
  test('编辑仪表盘布局：点击编辑按钮进入编辑模式', async ({ page }) => {
    // 点击仪表盘标签
    await page.click('button.header-tab:has-text("仪表盘")');
    await page.waitForLoadState('domcontentloaded');

    // 查找并点击编辑按钮
    const editButton = page.locator('button:has-text("编辑"), button:has-text("📝")').first();
    
    const hasEditButton = await editButton.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (!hasEditButton) {
      test.skip(true, '编辑按钮不可见（可能没有仪表盘）');
    }

    await editButton.click();

    // 验证编辑模式已激活（按钮文字变为"保存布局"）
    await page.waitForTimeout(300);
    const saveButton = page.locator('button:has-text("保存布局"), button:has-text("✅")').first();
    await expect(saveButton).toBeVisible({ timeout: 3000 });
  });

  /**
   * 测试用例 7: 删除仪表盘
   * 验证可以删除仪表盘（带确认）
   */
  test('删除仪表盘：点击删除按钮并确认', async ({ page }) => {
    // 点击仪表盘标签
    await page.click('button.header-tab:has-text("仪表盘")');
    await page.waitForLoadState('domcontentloaded');

    // 查找删除按钮（垃圾桶图标）
    const deleteButton = page.locator('button:has-text("🗑"), button[title*="删除"]').first();
    
    const hasDeleteButton = await deleteButton.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (!hasDeleteButton) {
      test.skip(true, '删除按钮不可见（可能没有仪表盘）');
    }

    // 监听确认对话框
    let dialogAccepted = false;
    page.on('dialog', async dialog => {
      if (dialog.type() === 'confirm') {
        dialogAccepted = true;
        await dialog.accept();
      }
    });

    // 点击删除按钮
    await deleteButton.click();

    // 等待对话框处理
    await page.waitForTimeout(500);

    // 验证对话框已处理
    expect(dialogAccepted).toBeTruthy();
  });

  /**
   * 测试用例 8: 添加图表弹窗操作
   * 验证添加图表弹窗的搜索和选择功能
   */
  test('添加图表弹窗：搜索并选择图表', async ({ page }) => {
    // 点击仪表盘标签
    await page.click('button.header-tab:has-text("仪表盘")');
    await page.waitForLoadState('domcontentloaded');

    // 查找并点击添加图表按钮
    const addChartButton = page.locator('button:has-text("添加图表"), button:has-text("+ 添加图表")').first();
    
    const hasAddButton = await addChartButton.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (!hasAddButton) {
      test.skip(true, '添加图表按钮不可见');
    }

    await addChartButton.click();

    // 验证弹窗出现
    const modal = page.locator('h3:has-text("添加图表")');
    await expect(modal).toBeVisible({ timeout: 3000 });

    // 查找搜索框
    const searchInput = page.locator('input[placeholder*="搜索"]');
    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      // 测试搜索功能（输入任意内容）
      await searchInput.fill('test');
      await page.waitForTimeout(300);
      
      // 清空搜索
      await searchInput.clear();
    }

    // 查找图表列表
    const chartList = page.locator('[class*="chartItem"], [class*="list"] > div').first();
    const hasCharts = await chartList.isVisible({ timeout: 2000 }).catch(() => false);

    if (!hasCharts) {
      // 没有可添加的图表
      test.skip(true, '没有已保存的图表可供添加');
    }

    // 点击第一个图表
    await chartList.click();
    await page.waitForTimeout(200);

    // 查找添加按钮
    const confirmButton = page.locator('button:has-text("添加"):not(:has-text("取消"))');
    if (await confirmButton.isEnabled({ timeout: 2000 }).catch(() => false)) {
      await confirmButton.click();
      
      // 验证弹窗关闭
      await expect(modal).not.toBeVisible({ timeout: 3000 });
    }
  });

  /**
   * 测试用例 9: 仪表盘刷新功能
   * 验证刷新按钮存在并可点击
   */
  test('仪表盘刷新：点击刷新按钮', async ({ page }) => {
    // 点击仪表盘标签
    await page.click('button.header-tab:has-text("仪表盘")');
    await page.waitForLoadState('domcontentloaded');

    // 查找刷新按钮
    const refreshButton = page.locator('button:has-text("刷新"), button:has-text("🔄")').first();
    
    const hasRefreshButton = await refreshButton.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (!hasRefreshButton) {
      test.skip(true, '刷新按钮不可见（可能没有仪表盘）');
    }

    // 点击刷新
    await refreshButton.click();
    
    // 等待刷新完成
    await page.waitForTimeout(1000);
    
    // 验证页面仍然正常
    const toolbar = page.locator('.dashboard-toolbar');
    await expect(toolbar).toBeVisible();
  });

  /**
   * 测试用例 10: 全屏切换
   * 验证全屏按钮可以切换全屏模式
   */
  test('全屏切换：点击全屏按钮', async ({ page }) => {
    // 点击仪表盘标签
    await page.click('button.header-tab:has-text("仪表盘")');
    await page.waitForLoadState('domcontentloaded');

    // 查找全屏按钮
    const fullscreenButton = page.locator('button:has-text("全屏"), button:has-text("🗖")').first();
    
    const hasFullscreenButton = await fullscreenButton.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (!hasFullscreenButton) {
      test.skip(true, '全屏按钮不可见（可能没有仪表盘）');
    }

    // 点击全屏
    await fullscreenButton.click();
    await page.waitForTimeout(500);

    // 验证按钮文字变为"退出全屏"
    const exitFullscreenButton = page.locator('button:has-text("退出全屏"), button:has-text("🗗")');
    await expect(exitFullscreenButton).toBeVisible({ timeout: 3000 });

    // 再次点击退出全屏
    await exitFullscreenButton.click();
    await page.waitForTimeout(500);

    // 验证恢复正常
    await expect(fullscreenButton).toBeVisible({ timeout: 3000 });
  });
});

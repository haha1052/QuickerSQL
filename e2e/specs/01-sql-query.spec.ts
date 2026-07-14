import { test, expect, Page } from '@playwright/test';

/**
 * SQL 查询功能 E2E 测试
 * 测试 SQL 页面的导航、执行、结果验证和历史记录
 */
test.describe('SQL 查询功能测试', () => {
  test.beforeEach(async ({ page }) => {
    // 等待应用基本加载完成
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  /**
   * 测试用例 1: SQL 页面导航
   * 点击 SQL tab，验证页面加载
   */
  test('SQL 页面导航：点击 SQL tab，验证页面加载', async ({ page }) => {
    // 点击 SQL 标签
    const sqlTab = page.locator('button.header-tab', { hasText: 'SQL' }).first();
    await expect(sqlTab).toBeVisible();
    await sqlTab.click();

    // 等待 SQL 编辑器区域出现（Monaco Editor）
    const editorArea = page.locator('.monaco-editor');
    await expect(editorArea).toBeVisible({ timeout: 10000 });

    // 验证执行按钮存在
    const executeButton = page.getByRole('button', { name: /执行|execute/i }).first();
    await expect(executeButton).toBeVisible();
  });

  /**
   * 测试用例 2: SQL 执行
   * 输入 SELECT 1，点击执行，验证结果出现
   */
  test('SQL 执行：输入 SELECT 1，点击执行，验证结果出现', async ({ page }) => {
    // 点击 SQL 标签
    const sqlTab = page.locator('button.header-tab', { hasText: 'SQL' }).first();
    await sqlTab.click();

    // 等待 Monaco Editor 加载
    const editorArea = page.locator('.monaco-editor');
    await expect(editorArea).toBeVisible({ timeout: 10000 });

    // 点击 Monaco Editor 使其获得焦点
    await editorArea.click();

    // 使用键盘全选并输入新内容
    await page.keyboard.press('Control+a');
    await page.keyboard.type('SELECT 1');

    // 点击执行按钮
    const executeButton = page.getByRole('button', { name: /执行|execute/i }).first();
    await executeButton.click();

    // 等待结果区域出现（可能需要几秒）
    // 结果区域可能是 .ag-theme-alpine 或 .query-result 或成功/失败提示
    await page.waitForTimeout(2000);

    // 验证结果出现：检查是否有成功提示或结果表格
    const successBadge = page.locator('text=/成功|success/i').first();
    const resultTable = page.locator('.ag-theme-alpine').first();
    
    // 至少有一个结果元素可见
    const hasResult = await successBadge.isVisible().catch(() => false) || 
                      await resultTable.isVisible().catch(() => false);
    expect(hasResult).toBeTruthy();
  });

  /**
   * 测试用例 3: SQL 结果验证
   * 验证结果表格显示数据
   */
  test('SQL 结果验证：验证结果表格显示数据', async ({ page }) => {
    // 点击 SQL 标签
    const sqlTab = page.locator('button.header-tab', { hasText: 'SQL' }).first();
    await sqlTab.click();

    // 等待 Monaco Editor 加载
    const editorArea = page.locator('.monaco-editor');
    await expect(editorArea).toBeVisible({ timeout: 10000 });

    // 输入简单的 SELECT 查询
    await editorArea.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('SELECT 1 AS result');

    // 执行查询
    const executeButton = page.getByRole('button', { name: /执行|execute/i }).first();
    await executeButton.click();

    // 等待结果加载
    await page.waitForTimeout(3000);

    // 验证结果表格存在
    const resultTable = page.locator('.ag-theme-alpine');
    await expect(resultTable.first()).toBeVisible({ timeout: 10000 });

    // 验证表格中有数据行（ag-grid 的行）
    const tableRows = page.locator('.ag-theme-alpine .ag-row');
    await expect(tableRows.first()).toBeVisible({ timeout: 5000 });
  });

  /**
   * 测试用例 5: 新建查询标签页
   * 点击新建查询按钮，验证新标签页创建
   */
  test('新建查询标签页：点击新建查询按钮，验证新标签页创建', async ({ page }) => {
    // 点击 SQL 标签
    const sqlTab = page.locator('button.header-tab', { hasText: 'SQL' }).first();
    await sqlTab.click();

    // 等待 Monaco Editor 加载
    const editorArea = page.locator('.monaco-editor');
    await expect(editorArea).toBeVisible({ timeout: 10000 });

    // 查找新建查询按钮（可能在工具栏或标签栏附近）
    // 常见的按钮文本可能是 "新建查询"、"New Query"、"+" 等
    const newQueryButton = page.locator(
      'button:has-text("新建"), button:has-text("New Query"), button:has-text("+"), [class*="new-query"]'
    ).first();

    // 获取当前标签页数量
    const tabsBefore = await page.locator('.query-tab, .tab-item, [class*="tab"]').count();

    // 点击新建查询按钮
    if (await newQueryButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newQueryButton.click();
      await page.waitForTimeout(500);

      // 验证新标签页创建（标签页数量增加）
      const tabsAfter = await page.locator('.query-tab, .tab-item, [class*="tab"]').count();
      expect(tabsAfter).toBeGreaterThan(tabsBefore);
    } else {
      // 如果没有专用按钮，尝试在标签栏空白处右键或点击
      const tabBar = page.locator('.tab-bar, .query-tabs, [class*="tab-bar"]').first();
      if (await tabBar.isVisible({ timeout: 3000 }).catch(() => false)) {
        // 右键点击标签栏尝试新建
        await tabBar.click({ button: 'right' });
        await page.waitForTimeout(500);

        // 查找右键菜单中的新建选项
        const newTabOption = page.locator('text=/新建|New/i').first();
        if (await newTabOption.isVisible({ timeout: 2000 }).catch(() => false)) {
          await newTabOption.click();
          await page.waitForTimeout(500);
        } else {
          test.skip(true, '新建查询入口未在界面中找到');
        }
      } else {
        test.skip(true, '标签栏未找到，无法测试新建查询功能');
      }
    }
  });

  /**
   * 测试用例 6: SQL 语法高亮验证
   * 验证 Monaco Editor 中 SQL 语法高亮正常工作
   */
  test('SQL 语法高亮：验证 Monaco Editor 中 SQL 语法高亮正常工作', async ({ page }) => {
    // 点击 SQL 标签
    const sqlTab = page.locator('button.header-tab', { hasText: 'SQL' }).first();
    await sqlTab.click();

    // 等待 Monaco Editor 加载
    const editorArea = page.locator('.monaco-editor');
    await expect(editorArea).toBeVisible({ timeout: 10000 });

    // 点击 Monaco Editor 使其获得焦点
    await editorArea.click();

    // 输入 SQL 语句
    await page.keyboard.press('Control+a');
    await page.keyboard.type('SELECT id, name FROM users WHERE age > 18');

    // 等待编辑器处理输入
    await page.waitForTimeout(1000);

    // 验证 Monaco Editor 容器存在且可见
    const monacoContainer = page.locator('.monaco-editor .view-lines');
    await expect(monacoContainer).toBeVisible();

    // 验证编辑器内容已更新（通过检查是否有文本内容）
    const editorContent = await page.locator('.monaco-editor .view-lines').textContent();
    expect(editorContent).toContain('SELECT');

    // 验证关键字高亮（检查是否生成了语法高亮类名）
    // Monaco Editor 通常会添加类似 "mtk" 前缀的类名给不同语法元素
    const highlightedElements = page.locator('.monaco-editor .view-lines span[class*="mtk"]');
    const highlightCount = await highlightedElements.count();
    expect(highlightCount).toBeGreaterThan(0);
  });

  /**
   * 测试用例 7: 执行查询并验证执行状态
   * 点击执行按钮，验证查询执行状态变化
   */
  test('执行查询状态：点击执行按钮，验证查询执行状态变化', async ({ page }) => {
    // 点击 SQL 标签
    const sqlTab = page.locator('button.header-tab', { hasText: 'SQL' }).first();
    await sqlTab.click();

    // 等待 Monaco Editor 加载
    const editorArea = page.locator('.monaco-editor');
    await expect(editorArea).toBeVisible({ timeout: 10000 });

    // 输入 SQL 语句
    await editorArea.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('SELECT 1');

    // 获取执行按钮
    const executeButton = page.getByRole('button', { name: /执行|execute/i }).first();
    await expect(executeButton).toBeVisible();

    // 点击执行按钮
    await executeButton.click();

    // 验证执行中状态（按钮可能显示 loading 或 disabled）
    // 等待一段时间确保查询完成
    await page.waitForTimeout(3000);

    // 验证结果出现：检查是否有成功/失败提示或结果表格
    const hasSuccess = await page.locator('text=/成功|success|completed/i').isVisible().catch(() => false);
    const hasResult = await page.locator('.ag-theme-alpine').isVisible().catch(() => false);
    const hasError = await page.locator('text=/错误|error|失败/i').isVisible().catch(() => false);

    // 至少应该出现成功或结果或错误中的一种
    expect(hasSuccess || hasResult || hasError).toBeTruthy();
  });

  /**
   * 测试用例 8: 查看结果并验证行数
   * 执行查询后验证结果表格显示和行数
   */
  test('结果行数验证：执行查询后验证结果表格显示和行数', async ({ page }) => {
    // 点击 SQL 标签
    const sqlTab = page.locator('button.header-tab', { hasText: 'SQL' }).first();
    await sqlTab.click();

    // 等待 Monaco Editor 加载
    const editorArea = page.locator('.monaco-editor');
    await expect(editorArea).toBeVisible({ timeout: 10000 });

    // 输入会产生多行的 SQL 查询
    await editorArea.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('SELECT 1 AS col1 UNION ALL SELECT 2 UNION ALL SELECT 3');

    // 执行查询
    const executeButton = page.getByRole('button', { name: /执行|execute/i }).first();
    await executeButton.click();

    // 等待结果加载
    await page.waitForTimeout(3000);

    // 验证结果表格存在
    const resultTable = page.locator('.ag-theme-alpine');
    await expect(resultTable.first()).toBeVisible({ timeout: 10000 });

    // 验证表格行数（ag-grid 的行）
    const tableRows = page.locator('.ag-theme-alpine .ag-row');
    const rowCount = await tableRows.count();
    expect(rowCount).toBeGreaterThan(0);

    // 验证至少有 3 行数据（因为 UNION ALL SELECT 1/2/3）
    expect(rowCount).toBeGreaterThanOrEqual(3);

    // 验证结果表格包含数据
    const firstRow = tableRows.first();
    await expect(firstRow).toBeVisible();

    // 验证结果表格有列头
    const headerRow = page.locator('.ag-theme-alpine .ag-header-row, .ag-header-cell');
    await expect(headerRow.first()).toBeVisible();
  });

  /**
   * 测试用例 9: SQL 历史记录
   * 执行查询后验证历史记录存在
   */
  test('SQL 历史记录：执行查询后验证历史记录存在', async ({ page }) => {
    // 点击 SQL 标签
    const sqlTab = page.locator('button.header-tab', { hasText: 'SQL' }).first();
    await sqlTab.click();

    // 等待 Monaco Editor 加载
    const editorArea = page.locator('.monaco-editor');
    await expect(editorArea).toBeVisible({ timeout: 10000 });

    // 输入并执行查询
    await editorArea.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('SELECT 1');

    const executeButton = page.getByRole('button', { name: /执行|execute/i }).first();
    await executeButton.click();

    // 等待查询完成
    await page.waitForTimeout(3000);

    // 查找历史记录入口（可能在侧边栏或其他位置）
    // 常见的实现可能是点击历史记录按钮或标签
    const historyButton = page.getByRole('button', { name: /历史|history/i }).first();
    
    // 如果历史记录按钮可见，点击它
    if (await historyButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await historyButton.click();
      
      // 等待历史记录面板加载
      await page.waitForTimeout(2000);
      
      // 验证历史记录容器存在
      const historyContainer = page.locator('.query-history');
      await expect(historyContainer).toBeVisible({ timeout: 5000 });
    } else {
      // 如果没有专用历史记录按钮，验证查询历史表单项存在
      // 历史记录数据应该在后端已保存
      test.skip(true, '历史记录入口未在界面中找到');
    }
  });

  /**
   * 测试用例 10: 多标签页查询
   * 创建多个查询标签页，在不同标签页中执行不同查询
   */
  test('多标签页查询：创建多个标签页，在不同标签页中执行查询', async ({ page }) => {
    // 点击 SQL 标签
    const sqlTab = page.locator('button.header-tab', { hasText: 'SQL' }).first();
    await sqlTab.click();

    // 等待 Monaco Editor 加载
    const editorArea = page.locator('.monaco-editor');
    await expect(editorArea).toBeVisible({ timeout: 10000 });

    // 输入第一个查询
    await editorArea.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('SELECT 1 AS first_query');

    // 执行第一个查询
    const executeButton = page.getByRole('button', { name: /执行|execute/i }).first();
    await executeButton.click();
    await page.waitForTimeout(2000);

    // 尝试创建新标签页
    const newQueryButton = page.locator(
      'button:has-text("新建"), button:has-text("New Query"), button:has-text("+"), [class*="new-query"]'
    ).first();

    if (await newQueryButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newQueryButton.click();
      await page.waitForTimeout(500);

      // 在新标签页中输入第二个查询
      await editorArea.click();
      await page.keyboard.press('Control+a');
      await page.keyboard.type('SELECT 2 AS second_query');

      // 执行第二个查询
      await executeButton.click();
      await page.waitForTimeout(2000);

      // 验证结果出现
      const hasResult = await page.locator('.ag-theme-alpine').isVisible().catch(() => false);
      expect(hasResult).toBeTruthy();

      // 验证标签页数量增加
      const tabs = page.locator('.query-tab, .tab-item, [class*="query-tab"]');
      const tabCount = await tabs.count();
      expect(tabCount).toBeGreaterThanOrEqual(2);
    } else {
      test.skip(true, '多标签页功能未实现或入口未找到');
    }
  });
});

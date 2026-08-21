# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 02-dashboard.spec.ts >> 仪表盘功能测试 >> 仪表盘工具栏存在：验证工具栏按钮存在
- Location: e2e\specs\02-dashboard.spec.ts:31:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.dashboard-toolbar')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('.dashboard-toolbar')

```

```yaml
- text: 🦆
- button "项目 未选择":
  - img
  - text: 项目 未选择
- button "数据导入"
- button "SQL查询"
- button "仪表盘"
- button "自动化任务"
- button "设置":
  - img
- button "─"
- button "□"
- button "×"
- text: 📊 还没有仪表盘 创建您的第一个仪表盘，开始可视化数据分析
- button "创建仪表盘"
```

# Test source

```ts
  1   | import { test, expect, Page } from '@playwright/test';
  2   | 
  3   | /**
  4   |  * 仪表盘功能 E2E 测试
  5   |  * 测试仪表盘的创建、图表管理、编辑等完整流程
  6   |  */
  7   | test.describe('仪表盘功能测试', () => {
  8   |   test.beforeEach(async ({ page }) => {
  9   |     // 先访问主页面并等待加载
  10  |     await page.goto('/');
  11  |     await page.waitForLoadState('domcontentloaded');
  12  |   });
  13  | 
  14  |   /**
  15  |    * 测试用例 1: 仪表盘页面导航
  16  |    * 点击 dashboard tab，验证页面加载
  17  |    */
  18  |   test('仪表盘页面导航：点击 dashboard tab，验证页面加载', async ({ page }) => {
  19  |     // 点击仪表盘标签
  20  |     await page.click('button.header-tab:has-text("仪表盘")');
  21  | 
  22  |     // 验证仪表盘容器加载（工具栏或画布）
  23  |     const dashboardContainer = page.locator('.dashboard-toolbar, [data-dashboard-canvas]').first();
  24  |     await expect(dashboardContainer).toBeVisible();
  25  |   });
  26  | 
  27  |   /**
  28  |    * 测试用例 2: 仪表盘工具栏存在
  29  |    * 验证工具栏按钮存在
  30  |    */
  31  |   test('仪表盘工具栏存在：验证工具栏按钮存在', async ({ page }) => {
  32  |     // 点击仪表盘标签
  33  |     await page.click('button.header-tab:has-text("仪表盘")');
  34  | 
  35  |     // 等待工具栏出现
  36  |     const toolbar = page.locator('.dashboard-toolbar');
> 37  |     await expect(toolbar).toBeVisible();
      |                           ^ Error: expect(locator).toBeVisible() failed
  38  |   });
  39  | 
  40  |   /**
  41  |    * 测试用例 3: 新增图表按钮存在
  42  |    * 验证可以点击新增图表按钮
  43  |    */
  44  |   test('新增图表按钮存在：验证可以点击新增图表按钮', async ({ page }) => {
  45  |     // 点击仪表盘标签
  46  |     await page.click('button.header-tab:has-text("仪表盘")');
  47  | 
  48  |     // 等待画布加载
  49  |     const canvas = page.locator('[data-dashboard-canvas]');
  50  |     await expect(canvas).toBeVisible({ timeout: 5000 });
  51  | 
  52  |     // 查找新增图表按钮
  53  |     const addChartButton = page.locator('button:has-text("添加图表"), button:has-text("+ 添加图表")').first();
  54  |     
  55  |     // 如果按钮可见，点击它
  56  |     if (await addChartButton.isVisible({ timeout: 3000 }).catch(() => false)) {
  57  |       await addChartButton.click();
  58  |       
  59  |       // 验证添加图表弹窗出现
  60  |       const modal = page.locator('h3:has-text("添加图表")');
  61  |       await expect(modal).toBeVisible({ timeout: 3000 });
  62  |     } else {
  63  |       // 如果画布是空的，可能显示的是空状态提示
  64  |       test.skip(true, '仪表盘为空或无图表可添加');
  65  |     }
  66  |   });
  67  | 
  68  |   /**
  69  |    * 测试用例 4: 创建新仪表盘
  70  |    * 验证可以创建新的仪表盘
  71  |    */
  72  |   test('创建新仪表盘：填写仪表盘名称并保存', async ({ page }) => {
  73  |     // 点击仪表盘标签
  74  |     await page.click('button.header-tab:has-text("仪表盘")');
  75  |     await page.waitForLoadState('domcontentloaded');
  76  | 
  77  |     // 查找工具栏中的下拉框
  78  |     const dashboardSelect = page.locator('.dashboard-toolbar select').first();
  79  |     
  80  |     // 检查是否已有仪表盘
  81  |     const hasDashboards = await dashboardSelect.isVisible({ timeout: 3000 }).catch(() => false);
  82  |     
  83  |     if (!hasDashboards) {
  84  |       // 没有仪表盘，查找创建按钮
  85  |       // 可能是空画布状态，查找创建相关按钮
  86  |       const emptyState = page.locator('.emptyCanvas, [class*="empty"]');
  87  |       if (await emptyState.isVisible({ timeout: 3000 }).catch(() => false)) {
  88  |         test.skip(true, '需要先创建仪表盘的入口在空状态中未找到');
  89  |       }
  90  |     }
  91  | 
  92  |     // 查找新建仪表盘的按钮或入口
  93  |     // 常见实现可能是下拉框旁边的"+"按钮或新建按钮
  94  |     const createButton = page.locator('button:has-text("新建"), button:has-text("创建"), button:has-text("+")').first();
  95  |     
  96  |     if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
  97  |       await createButton.click();
  98  |       
  99  |       // 等待创建对话框或输入框出现
  100 |       await page.waitForTimeout(500);
  101 |       
  102 |       // 查找仪表盘名称输入框（可能是 prompt 或输入框）
  103 |       // 尝试使用 prompt 对话框（浏览器原生）
  104 |       page.on('dialog', async dialog => {
  105 |         if (dialog.type() === 'prompt') {
  106 |           await dialog.accept('测试仪表盘');
  107 |         }
  108 |       });
  109 |       
  110 |       // 如果有确认对话框
  111 |       const confirmBtn = page.locator('button:has-text("确认"), button:has-text("确定"), button:has-text("创建")').last();
  112 |       if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
  113 |         await confirmBtn.click();
  114 |       }
  115 |     }
  116 |     
  117 |     // 验证仪表盘创建成功（下拉框应有所选中的仪表盘）
  118 |     await page.waitForTimeout(1000);
  119 |     const selectedOption = page.locator('.dashboard-toolbar select option:checked');
  120 |     await expect(selectedOption).toBeVisible({ timeout: 5000 });
  121 |   });
  122 | 
  123 |   /**
  124 |    * 测试用例 5: 仪表盘下拉框切换
  125 |    * 验证可以切换不同的仪表盘
  126 |    */
  127 |   test('仪表盘下拉框切换：验证可以切换不同仪表盘', async ({ page }) => {
  128 |     // 点击仪表盘标签
  129 |     await page.click('button.header-tab:has-text("仪表盘")');
  130 |     await page.waitForLoadState('domcontentloaded');
  131 | 
  132 |     // 查找仪表盘选择下拉框
  133 |     const dashboardSelect = page.locator('.dashboard-toolbar select').first();
  134 |     
  135 |     // 检查下拉框是否存在
  136 |     const hasSelect = await dashboardSelect.isVisible({ timeout: 3000 }).catch(() => false);
  137 |     
```
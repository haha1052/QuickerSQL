# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 01-sql-query.spec.ts >> SQL 查询功能测试 >> SQL 结果验证：验证结果表格显示数据
- Location: e2e\specs\01-sql-query.spec.ts:75:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.ag-theme-alpine').first()
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('.ag-theme-alpine').first()

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
- text: 导航
- button:
  - img
- button "数据浏览器":
  - img
  - text: 数据浏览器
- button "查询历史":
  - img
  - text: 查询历史
- button "代码片段":
  - img
  - text: 代码片段
- button "回收站":
  - img
  - text: 回收站
- img
- textbox "搜索表..."
- combobox "排序方式":
  - option "名称 A-Z" [selected]
  - option "名称 Z-A"
  - option "行数最多"
  - option "列数最多"
- combobox "分组模式":
  - option "按系统/用户" [selected]
  - option "按首字母"
  - option "平铺"
- button "刷新列表":
  - img
- img
- text: 用户表 0 暂无用户表，可通过 SQL 执行
- code: CREATE TABLE "表名" (...)
- text: 或 导入 CSV/Excel 创建
- button "新建":
  - img
  - text: 新建
- button "打开":
  - img
  - text: 打开
- button "保存":
  - img
  - text: 保存
- button "刷新":
  - img
  - text: 刷新
- button "导出":
  - img
  - text: 导出
- button "布局":
  - img
  - text: 布局
  - img
- button "数据库信息":
  - img
- text: SQL Query 1
- button "新建标签页":
  - img
- button "▶ 执行 SQL"
- code:
  - textbox "Editor content"
- alert:
  - text: ❌ SQL 执行失败，请检查 SQL 语法是否正确，或查看控制台了解详情
  - button "×"
- alert
- alert
```

# Test source

```ts
  1   | import { test, expect, Page } from '@playwright/test';
  2   | 
  3   | /**
  4   |  * SQL 查询功能 E2E 测试
  5   |  * 测试 SQL 页面的导航、执行、结果验证和历史记录
  6   |  */
  7   | test.describe('SQL 查询功能测试', () => {
  8   |   test.beforeEach(async ({ page }) => {
  9   |     // 等待应用基本加载完成
  10  |     await page.goto('/');
  11  |     await page.waitForLoadState('domcontentloaded');
  12  |   });
  13  | 
  14  |   /**
  15  |    * 测试用例 1: SQL 页面导航
  16  |    * 点击 SQL tab，验证页面加载
  17  |    */
  18  |   test('SQL 页面导航：点击 SQL tab，验证页面加载', async ({ page }) => {
  19  |     // 点击 SQL 标签
  20  |     const sqlTab = page.locator('button.header-tab', { hasText: 'SQL' }).first();
  21  |     await expect(sqlTab).toBeVisible();
  22  |     await sqlTab.click();
  23  | 
  24  |     // 等待 SQL 编辑器区域出现（Monaco Editor）
  25  |     const editorArea = page.locator('.monaco-editor');
  26  |     await expect(editorArea).toBeVisible({ timeout: 10000 });
  27  | 
  28  |     // 验证执行按钮存在
  29  |     const executeButton = page.getByRole('button', { name: /执行|execute/i }).first();
  30  |     await expect(executeButton).toBeVisible();
  31  |   });
  32  | 
  33  |   /**
  34  |    * 测试用例 2: SQL 执行
  35  |    * 输入 SELECT 1，点击执行，验证结果出现
  36  |    */
  37  |   test('SQL 执行：输入 SELECT 1，点击执行，验证结果出现', async ({ page }) => {
  38  |     // 点击 SQL 标签
  39  |     const sqlTab = page.locator('button.header-tab', { hasText: 'SQL' }).first();
  40  |     await sqlTab.click();
  41  | 
  42  |     // 等待 Monaco Editor 加载
  43  |     const editorArea = page.locator('.monaco-editor');
  44  |     await expect(editorArea).toBeVisible({ timeout: 10000 });
  45  | 
  46  |     // 点击 Monaco Editor 使其获得焦点
  47  |     await editorArea.click();
  48  | 
  49  |     // 使用键盘全选并输入新内容
  50  |     await page.keyboard.press('Control+a');
  51  |     await page.keyboard.type('SELECT 1');
  52  | 
  53  |     // 点击执行按钮
  54  |     const executeButton = page.getByRole('button', { name: /执行|execute/i }).first();
  55  |     await executeButton.click();
  56  | 
  57  |     // 等待结果区域出现（可能需要几秒）
  58  |     // 结果区域可能是 .ag-theme-alpine 或 .query-result 或成功/失败提示
  59  |     await page.waitForTimeout(2000);
  60  | 
  61  |     // 验证结果出现：检查是否有成功提示或结果表格
  62  |     const successBadge = page.locator('text=/成功|success/i').first();
  63  |     const resultTable = page.locator('.ag-theme-alpine').first();
  64  |     
  65  |     // 至少有一个结果元素可见
  66  |     const hasResult = await successBadge.isVisible().catch(() => false) || 
  67  |                       await resultTable.isVisible().catch(() => false);
  68  |     expect(hasResult).toBeTruthy();
  69  |   });
  70  | 
  71  |   /**
  72  |    * 测试用例 3: SQL 结果验证
  73  |    * 验证结果表格显示数据
  74  |    */
  75  |   test('SQL 结果验证：验证结果表格显示数据', async ({ page }) => {
  76  |     // 点击 SQL 标签
  77  |     const sqlTab = page.locator('button.header-tab', { hasText: 'SQL' }).first();
  78  |     await sqlTab.click();
  79  | 
  80  |     // 等待 Monaco Editor 加载
  81  |     const editorArea = page.locator('.monaco-editor');
  82  |     await expect(editorArea).toBeVisible({ timeout: 10000 });
  83  | 
  84  |     // 输入简单的 SELECT 查询
  85  |     await editorArea.click();
  86  |     await page.keyboard.press('Control+a');
  87  |     await page.keyboard.type('SELECT 1 AS result');
  88  | 
  89  |     // 执行查询
  90  |     const executeButton = page.getByRole('button', { name: /执行|execute/i }).first();
  91  |     await executeButton.click();
  92  | 
  93  |     // 等待结果加载
  94  |     await page.waitForTimeout(3000);
  95  | 
  96  |     // 验证结果表格存在
  97  |     const resultTable = page.locator('.ag-theme-alpine');
> 98  |     await expect(resultTable.first()).toBeVisible({ timeout: 10000 });
      |                                       ^ Error: expect(locator).toBeVisible() failed
  99  | 
  100 |     // 验证表格中有数据行（ag-grid 的行）
  101 |     const tableRows = page.locator('.ag-theme-alpine .ag-row');
  102 |     await expect(tableRows.first()).toBeVisible({ timeout: 5000 });
  103 |   });
  104 | 
  105 |   /**
  106 |    * 测试用例 5: 新建查询标签页
  107 |    * 点击新建查询按钮，验证新标签页创建
  108 |    */
  109 |   test('新建查询标签页：点击新建查询按钮，验证新标签页创建', async ({ page }) => {
  110 |     // 点击 SQL 标签
  111 |     const sqlTab = page.locator('button.header-tab', { hasText: 'SQL' }).first();
  112 |     await sqlTab.click();
  113 | 
  114 |     // 等待 Monaco Editor 加载
  115 |     const editorArea = page.locator('.monaco-editor');
  116 |     await expect(editorArea).toBeVisible({ timeout: 10000 });
  117 | 
  118 |     // 查找新建查询按钮（可能在工具栏或标签栏附近）
  119 |     // 常见的按钮文本可能是 "新建查询"、"New Query"、"+" 等
  120 |     const newQueryButton = page.locator(
  121 |       'button:has-text("新建"), button:has-text("New Query"), button:has-text("+"), [class*="new-query"]'
  122 |     ).first();
  123 | 
  124 |     // 获取当前标签页数量
  125 |     const tabsBefore = await page.locator('.query-tab, .tab-item, [class*="tab"]').count();
  126 | 
  127 |     // 点击新建查询按钮
  128 |     if (await newQueryButton.isVisible({ timeout: 3000 }).catch(() => false)) {
  129 |       await newQueryButton.click();
  130 |       await page.waitForTimeout(500);
  131 | 
  132 |       // 验证新标签页创建（标签页数量增加）
  133 |       const tabsAfter = await page.locator('.query-tab, .tab-item, [class*="tab"]').count();
  134 |       expect(tabsAfter).toBeGreaterThan(tabsBefore);
  135 |     } else {
  136 |       // 如果没有专用按钮，尝试在标签栏空白处右键或点击
  137 |       const tabBar = page.locator('.tab-bar, .query-tabs, [class*="tab-bar"]').first();
  138 |       if (await tabBar.isVisible({ timeout: 3000 }).catch(() => false)) {
  139 |         // 右键点击标签栏尝试新建
  140 |         await tabBar.click({ button: 'right' });
  141 |         await page.waitForTimeout(500);
  142 | 
  143 |         // 查找右键菜单中的新建选项
  144 |         const newTabOption = page.locator('text=/新建|New/i').first();
  145 |         if (await newTabOption.isVisible({ timeout: 2000 }).catch(() => false)) {
  146 |           await newTabOption.click();
  147 |           await page.waitForTimeout(500);
  148 |         } else {
  149 |           test.skip(true, '新建查询入口未在界面中找到');
  150 |         }
  151 |       } else {
  152 |         test.skip(true, '标签栏未找到，无法测试新建查询功能');
  153 |       }
  154 |     }
  155 |   });
  156 | 
  157 |   /**
  158 |    * 测试用例 6: SQL 语法高亮验证
  159 |    * 验证 Monaco Editor 中 SQL 语法高亮正常工作
  160 |    */
  161 |   test('SQL 语法高亮：验证 Monaco Editor 中 SQL 语法高亮正常工作', async ({ page }) => {
  162 |     // 点击 SQL 标签
  163 |     const sqlTab = page.locator('button.header-tab', { hasText: 'SQL' }).first();
  164 |     await sqlTab.click();
  165 | 
  166 |     // 等待 Monaco Editor 加载
  167 |     const editorArea = page.locator('.monaco-editor');
  168 |     await expect(editorArea).toBeVisible({ timeout: 10000 });
  169 | 
  170 |     // 点击 Monaco Editor 使其获得焦点
  171 |     await editorArea.click();
  172 | 
  173 |     // 输入 SQL 语句
  174 |     await page.keyboard.press('Control+a');
  175 |     await page.keyboard.type('SELECT id, name FROM users WHERE age > 18');
  176 | 
  177 |     // 等待编辑器处理输入
  178 |     await page.waitForTimeout(1000);
  179 | 
  180 |     // 验证 Monaco Editor 容器存在且可见
  181 |     const monacoContainer = page.locator('.monaco-editor .view-lines');
  182 |     await expect(monacoContainer).toBeVisible();
  183 | 
  184 |     // 验证编辑器内容已更新（通过检查是否有文本内容）
  185 |     const editorContent = await page.locator('.monaco-editor .view-lines').textContent();
  186 |     expect(editorContent).toContain('SELECT');
  187 | 
  188 |     // 验证关键字高亮（检查是否生成了语法高亮类名）
  189 |     // Monaco Editor 通常会添加类似 "mtk" 前缀的类名给不同语法元素
  190 |     const highlightedElements = page.locator('.monaco-editor .view-lines span[class*="mtk"]');
  191 |     const highlightCount = await highlightedElements.count();
  192 |     expect(highlightCount).toBeGreaterThan(0);
  193 |   });
  194 | 
  195 |   /**
  196 |    * 测试用例 7: 执行查询并验证执行状态
  197 |    * 点击执行按钮，验证查询执行状态变化
  198 |    */
```
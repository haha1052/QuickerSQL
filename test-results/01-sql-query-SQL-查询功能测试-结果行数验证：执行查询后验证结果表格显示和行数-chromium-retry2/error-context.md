# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 01-sql-query.spec.ts >> SQL 查询功能测试 >> 结果行数验证：执行查询后验证结果表格显示和行数
- Location: e2e\specs\01-sql-query.spec.ts:237:3

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
  199 |   test('执行查询状态：点击执行按钮，验证查询执行状态变化', async ({ page }) => {
  200 |     // 点击 SQL 标签
  201 |     const sqlTab = page.locator('button.header-tab', { hasText: 'SQL' }).first();
  202 |     await sqlTab.click();
  203 | 
  204 |     // 等待 Monaco Editor 加载
  205 |     const editorArea = page.locator('.monaco-editor');
  206 |     await expect(editorArea).toBeVisible({ timeout: 10000 });
  207 | 
  208 |     // 输入 SQL 语句
  209 |     await editorArea.click();
  210 |     await page.keyboard.press('Control+a');
  211 |     await page.keyboard.type('SELECT 1');
  212 | 
  213 |     // 获取执行按钮
  214 |     const executeButton = page.getByRole('button', { name: /执行|execute/i }).first();
  215 |     await expect(executeButton).toBeVisible();
  216 | 
  217 |     // 点击执行按钮
  218 |     await executeButton.click();
  219 | 
  220 |     // 验证执行中状态（按钮可能显示 loading 或 disabled）
  221 |     // 等待一段时间确保查询完成
  222 |     await page.waitForTimeout(3000);
  223 | 
  224 |     // 验证结果出现：检查是否有成功/失败提示或结果表格
  225 |     const hasSuccess = await page.locator('text=/成功|success|completed/i').isVisible().catch(() => false);
  226 |     const hasResult = await page.locator('.ag-theme-alpine').isVisible().catch(() => false);
  227 |     const hasError = await page.locator('text=/错误|error|失败/i').isVisible().catch(() => false);
  228 | 
  229 |     // 至少应该出现成功或结果或错误中的一种
  230 |     expect(hasSuccess || hasResult || hasError).toBeTruthy();
  231 |   });
  232 | 
  233 |   /**
  234 |    * 测试用例 8: 查看结果并验证行数
  235 |    * 执行查询后验证结果表格显示和行数
  236 |    */
  237 |   test('结果行数验证：执行查询后验证结果表格显示和行数', async ({ page }) => {
  238 |     // 点击 SQL 标签
  239 |     const sqlTab = page.locator('button.header-tab', { hasText: 'SQL' }).first();
  240 |     await sqlTab.click();
  241 | 
  242 |     // 等待 Monaco Editor 加载
  243 |     const editorArea = page.locator('.monaco-editor');
  244 |     await expect(editorArea).toBeVisible({ timeout: 10000 });
  245 | 
  246 |     // 输入会产生多行的 SQL 查询
  247 |     await editorArea.click();
  248 |     await page.keyboard.press('Control+a');
  249 |     await page.keyboard.type('SELECT 1 AS col1 UNION ALL SELECT 2 UNION ALL SELECT 3');
  250 | 
  251 |     // 执行查询
  252 |     const executeButton = page.getByRole('button', { name: /执行|execute/i }).first();
  253 |     await executeButton.click();
  254 | 
  255 |     // 等待结果加载
  256 |     await page.waitForTimeout(3000);
  257 | 
  258 |     // 验证结果表格存在
  259 |     const resultTable = page.locator('.ag-theme-alpine');
> 260 |     await expect(resultTable.first()).toBeVisible({ timeout: 10000 });
      |                                       ^ Error: expect(locator).toBeVisible() failed
  261 | 
  262 |     // 验证表格行数（ag-grid 的行）
  263 |     const tableRows = page.locator('.ag-theme-alpine .ag-row');
  264 |     const rowCount = await tableRows.count();
  265 |     expect(rowCount).toBeGreaterThan(0);
  266 | 
  267 |     // 验证至少有 3 行数据（因为 UNION ALL SELECT 1/2/3）
  268 |     expect(rowCount).toBeGreaterThanOrEqual(3);
  269 | 
  270 |     // 验证结果表格包含数据
  271 |     const firstRow = tableRows.first();
  272 |     await expect(firstRow).toBeVisible();
  273 | 
  274 |     // 验证结果表格有列头
  275 |     const headerRow = page.locator('.ag-theme-alpine .ag-header-row, .ag-header-cell');
  276 |     await expect(headerRow.first()).toBeVisible();
  277 |   });
  278 | 
  279 |   /**
  280 |    * 测试用例 9: SQL 历史记录
  281 |    * 执行查询后验证历史记录存在
  282 |    */
  283 |   test('SQL 历史记录：执行查询后验证历史记录存在', async ({ page }) => {
  284 |     // 点击 SQL 标签
  285 |     const sqlTab = page.locator('button.header-tab', { hasText: 'SQL' }).first();
  286 |     await sqlTab.click();
  287 | 
  288 |     // 等待 Monaco Editor 加载
  289 |     const editorArea = page.locator('.monaco-editor');
  290 |     await expect(editorArea).toBeVisible({ timeout: 10000 });
  291 | 
  292 |     // 输入并执行查询
  293 |     await editorArea.click();
  294 |     await page.keyboard.press('Control+a');
  295 |     await page.keyboard.type('SELECT 1');
  296 | 
  297 |     const executeButton = page.getByRole('button', { name: /执行|execute/i }).first();
  298 |     await executeButton.click();
  299 | 
  300 |     // 等待查询完成
  301 |     await page.waitForTimeout(3000);
  302 | 
  303 |     // 查找历史记录入口（可能在侧边栏或其他位置）
  304 |     // 常见的实现可能是点击历史记录按钮或标签
  305 |     const historyButton = page.getByRole('button', { name: /历史|history/i }).first();
  306 |     
  307 |     // 如果历史记录按钮可见，点击它
  308 |     if (await historyButton.isVisible({ timeout: 3000 }).catch(() => false)) {
  309 |       await historyButton.click();
  310 |       
  311 |       // 等待历史记录面板加载
  312 |       await page.waitForTimeout(2000);
  313 |       
  314 |       // 验证历史记录容器存在
  315 |       const historyContainer = page.locator('.query-history');
  316 |       await expect(historyContainer).toBeVisible({ timeout: 5000 });
  317 |     } else {
  318 |       // 如果没有专用历史记录按钮，验证查询历史表单项存在
  319 |       // 历史记录数据应该在后端已保存
  320 |       test.skip(true, '历史记录入口未在界面中找到');
  321 |     }
  322 |   });
  323 | 
  324 |   /**
  325 |    * 测试用例 10: 多标签页查询
  326 |    * 创建多个查询标签页，在不同标签页中执行不同查询
  327 |    */
  328 |   test('多标签页查询：创建多个标签页，在不同标签页中执行查询', async ({ page }) => {
  329 |     // 点击 SQL 标签
  330 |     const sqlTab = page.locator('button.header-tab', { hasText: 'SQL' }).first();
  331 |     await sqlTab.click();
  332 | 
  333 |     // 等待 Monaco Editor 加载
  334 |     const editorArea = page.locator('.monaco-editor');
  335 |     await expect(editorArea).toBeVisible({ timeout: 10000 });
  336 | 
  337 |     // 输入第一个查询
  338 |     await editorArea.click();
  339 |     await page.keyboard.press('Control+a');
  340 |     await page.keyboard.type('SELECT 1 AS first_query');
  341 | 
  342 |     // 执行第一个查询
  343 |     const executeButton = page.getByRole('button', { name: /执行|execute/i }).first();
  344 |     await executeButton.click();
  345 |     await page.waitForTimeout(2000);
  346 | 
  347 |     // 尝试创建新标签页
  348 |     const newQueryButton = page.locator(
  349 |       'button:has-text("新建"), button:has-text("New Query"), button:has-text("+"), [class*="new-query"]'
  350 |     ).first();
  351 | 
  352 |     if (await newQueryButton.isVisible({ timeout: 3000 }).catch(() => false)) {
  353 |       await newQueryButton.click();
  354 |       await page.waitForTimeout(500);
  355 | 
  356 |       // 在新标签页中输入第二个查询
  357 |       await editorArea.click();
  358 |       await page.keyboard.press('Control+a');
  359 |       await page.keyboard.type('SELECT 2 AS second_query');
  360 | 
```
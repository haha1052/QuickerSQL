# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 01-sql-query.spec.ts >> SQL 查询功能测试 >> 多标签页查询：创建多个标签页，在不同标签页中执行查询
- Location: e2e\specs\01-sql-query.spec.ts:328:3

# Error details

```
Error: expect(received).toBeTruthy()

Received: false
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e4]:
    - generic [ref=e5]:
      - generic [ref=e6]:
        - generic [ref=e7]: 🦆
        - button "项目 未选择" [ref=e8] [cursor=pointer]:
          - img [ref=e9]
          - generic [ref=e12]: 项目
          - generic [ref=e13]: 未选择
        - button "数据导入" [ref=e15] [cursor=pointer]
        - button "SQL查询" [ref=e16] [cursor=pointer]
        - button "仪表盘" [ref=e17] [cursor=pointer]
        - button "自动化任务" [ref=e18] [cursor=pointer]
      - generic [ref=e20]:
        - button "设置" [ref=e21] [cursor=pointer]:
          - img [ref=e22]
        - generic [ref=e25]:
          - button "─" [ref=e26] [cursor=pointer]:
            - generic [ref=e27]: ─
          - button "□" [ref=e28] [cursor=pointer]:
            - generic [ref=e29]: □
          - button "×" [ref=e30] [cursor=pointer]:
            - generic [ref=e31]: ×
    - generic [ref=e33]:
      - generic [ref=e34]:
        - generic [ref=e35]:
          - generic [ref=e36]:
            - generic [ref=e37]: 导航
            - button [ref=e38] [cursor=pointer]:
              - img [ref=e39]
          - generic [ref=e41]:
            - button "数据浏览器" [ref=e42] [cursor=pointer]:
              - img [ref=e43]
              - generic [ref=e47]: 数据浏览器
            - button "查询历史" [ref=e48] [cursor=pointer]:
              - img [ref=e49]
              - generic [ref=e52]: 查询历史
            - button "代码片段" [ref=e53] [cursor=pointer]:
              - img [ref=e54]
              - generic [ref=e57]: 代码片段
            - button "回收站" [ref=e58] [cursor=pointer]:
              - img [ref=e59]
              - generic [ref=e61]: 回收站
          - generic [ref=e63]:
            - generic [ref=e64]:
              - generic [ref=e65]:
                - img [ref=e67]
                - textbox "搜索表..." [ref=e70]
              - combobox "排序方式" [ref=e71] [cursor=pointer]:
                - option "名称 A-Z" [selected]
                - option "名称 Z-A"
                - option "行数最多"
                - option "列数最多"
              - combobox "分组模式" [ref=e72] [cursor=pointer]:
                - option "按系统/用户" [selected]
                - option "按首字母"
                - option "平铺"
              - button "刷新列表" [ref=e73] [cursor=pointer]:
                - img [ref=e75]
            - generic [ref=e80]:
              - generic [ref=e81] [cursor=pointer]:
                - img [ref=e83]
                - generic [ref=e85]: 用户表
                - generic [ref=e86]: "0"
              - generic [ref=e87]:
                - text: 暂无用户表，可通过 SQL 执行
                - code [ref=e88]: CREATE TABLE "表名" (...)
                - text: 或 导入 CSV/Excel 创建
        - generic "拖拽调整宽度，双击恢复默认 (250px)" [ref=e89]
      - generic [ref=e91]:
        - generic [ref=e92]:
          - generic [ref=e93]:
            - button "新建" [ref=e94] [cursor=pointer]:
              - img [ref=e95]
              - generic [ref=e96]: 新建
            - button "打开" [ref=e97] [cursor=pointer]:
              - img [ref=e98]
              - generic [ref=e100]: 打开
            - button "保存" [ref=e101] [cursor=pointer]:
              - img [ref=e102]
              - generic [ref=e106]: 保存
            - button "刷新" [ref=e108] [cursor=pointer]:
              - img [ref=e109]
              - generic [ref=e113]: 刷新
            - button "导出" [ref=e114] [cursor=pointer]:
              - img [ref=e115]
              - generic [ref=e118]: 导出
            - button "布局" [ref=e121] [cursor=pointer]:
              - img [ref=e122]
              - generic [ref=e127]: 布局
              - img [ref=e128]
          - button "数据库信息" [ref=e131] [cursor=pointer]:
            - img [ref=e132]
        - generic [ref=e136]:
          - generic [ref=e138]:
            - generic [ref=e139] [cursor=pointer]:
              - generic [ref=e140]: SQL Query 1
              - button [ref=e141]:
                - img [ref=e142]
            - generic [ref=e145] [cursor=pointer]:
              - generic [ref=e146]: QUERY 2
              - button [ref=e147]:
                - img [ref=e148]
            - button "新建标签页" [ref=e151] [cursor=pointer]:
              - img
          - button "▶ 执行 SQL" [ref=e153] [cursor=pointer]:
            - generic [ref=e154]: ▶
            - text: 执行 SQL
        - code [ref=e163]:
          - generic [ref=e164]:
            - textbox "Editor content"
            - textbox [ref=e165]
            - generic [ref=e174]: SELECT 2 AS second_query
    - alert [ref=e177]:
      - generic [ref=e178]: ❌
      - generic [ref=e179]: SQL 执行失败，请检查 SQL 语法是否正确，或查看控制台了解详情
      - button "×" [ref=e180] [cursor=pointer]
  - generic [ref=e181]:
    - alert
    - alert
```

# Test source

```ts
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
  361 |       // 执行第二个查询
  362 |       await executeButton.click();
  363 |       await page.waitForTimeout(2000);
  364 | 
  365 |       // 验证结果出现
  366 |       const hasResult = await page.locator('.ag-theme-alpine').isVisible().catch(() => false);
> 367 |       expect(hasResult).toBeTruthy();
      |                         ^ Error: expect(received).toBeTruthy()
  368 | 
  369 |       // 验证标签页数量增加
  370 |       const tabs = page.locator('.query-tab, .tab-item, [class*="query-tab"]');
  371 |       const tabCount = await tabs.count();
  372 |       expect(tabCount).toBeGreaterThanOrEqual(2);
  373 |     } else {
  374 |       test.skip(true, '多标签页功能未实现或入口未找到');
  375 |     }
  376 |   });
  377 | });
  378 | 
```
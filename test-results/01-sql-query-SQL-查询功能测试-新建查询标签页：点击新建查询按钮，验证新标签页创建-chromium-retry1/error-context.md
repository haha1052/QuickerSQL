# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 01-sql-query.spec.ts >> SQL 查询功能测试 >> 新建查询标签页：点击新建查询按钮，验证新标签页创建
- Location: e2e\specs\01-sql-query.spec.ts:109:3

# Error details

```
Error: expect(received).toBeGreaterThan(expected)

Expected: > 5
Received:   5
```

# Page snapshot

```yaml
- generic [ref=e1]:
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
            - button "新建" [active] [ref=e94] [cursor=pointer]:
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
    - alert [ref=e176]:
      - generic [ref=e177]: ❌
      - generic [ref=e178]: 加载表列表失败
      - button "×" [ref=e179] [cursor=pointer]
  - generic [ref=e180]:
    - alert
    - alert
```

# Test source

```ts
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
  98  |     await expect(resultTable.first()).toBeVisible({ timeout: 10000 });
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
> 134 |       expect(tabsAfter).toBeGreaterThan(tabsBefore);
      |                         ^ Error: expect(received).toBeGreaterThan(expected)
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
```
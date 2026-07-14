# E2E 测试

当前框架：`@playwright/test`

## 运行方式

### 方式 A：手动启动应用（推荐本地开发）

```bash
# 终端 1：启动 Tauri 开发服务器
npm run tauri dev

# 终端 2：等应用启动后，执行 E2E 测试
npx playwright test e2e/specs/ --headed
```

### 方式 B：通过 webServer 自动启动（需要环境变量）

```bash
E2E_WITH_WEBSERVER=1 npx playwright test
```

## 测试用例清单

| 文件 | 场景 | 用例数 | 状态 |
|------|------|--------|------|
| `00-basic-startup.spec.ts` | 应用启动、UI 元素验证 | 6 | ✅ 可运行 |
| `01-sql-query.spec.ts` | SQL 执行、结果展示、历史记录、新建标签页、语法高亮、多标签页 | 10 | ✅ 可运行 |
| `02-dashboard.spec.ts` | 仪表盘导航、图表操作 | 3 | ✅ 可运行 |
| `03-automation.spec.ts` | 任务中心、任务创建 | 3 | ✅ 可运行 |
| `04-settings.spec.ts` | 设置页面、主题切换 | 3 | ✅ 可运行 |
| `01-workflow.spec.ts` | 核心用户旅程 | 4 | ⏸ skip（历史兼容） |

**总计：29 个测试用例**

## 测试用例说明

### 00-basic-startup.spec.ts（基础启动测试）

- 应用 HTTP 响应验证
- Header 容器、Logo 存在性
- 标签页（SQL/Dashboard/Automation）存在性
- 侧边栏容器存在性

### 01-sql-query.spec.ts（SQL 查询测试）

- SQL 页面导航
- SQL 执行（SELECT 1）
- 结果表格验证
- 新建查询标签页
- SQL 语法高亮验证
- 执行查询状态验证
- 结果行数验证
- SQL 历史记录
- 多标签页查询

### 02-dashboard.spec.ts（仪表盘测试）

- 仪表盘页面导航
- 工具栏按钮存在性
- 新增图表按钮可点击

### 03-automation.spec.ts（自动化任务测试）

- 任务中心页面导航
- 任务列表容器存在性
- 新建任务按钮可点击

### 04-settings.spec.ts（设置页面测试）

- 设置页面打开
- 设置分类列表存在性
- 主题选项存在性

## 验证命令

```bash
# 列出所有测试用例
npx playwright test --list

# 运行所有测试（有 headed 模式可以看到浏览器）
npx playwright test e2e/specs/ --headed

# 运行特定文件
npx playwright test e2e/specs/00-basic-startup.spec.ts

# 运行带报告
npx playwright test e2e/specs/ --headed && npx playwright show-report
```

## 故障排查

| 问题 | 解决方案 |
|------|---------|
| 应用无法启动 | 确保 `npm run tauri dev` 正常运行 |
| 测试超时 | 检查端口 1420 是否被占用 |
| 选择器找不到元素 | 检查应用 UI 是否已加载完成 |

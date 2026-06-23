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

## 用例状态

- `00-basic-startup.spec.ts` ✅ 可运行（当前 skip 大部分，仅验证测试框架本身）
- `01-workflow.spec.ts` ⏸  **需接入 tauri-driver 后启用**（所有用例当前为 skip 状态）

## 下一步改进路线

1. **接入 tauri-driver**：安装 `@tauri-apps/cli` 的 `test` 子命令或社区 `tauri-driver`
   - 参考：https://tauri.app/v1/guides/test/webdriver/
2. **把 01-workflow.spec.ts 中的 skip 去掉**，让真实用户旅程跑起来
3. **添加更多 smoke tests**：导入 CSV、查看数据库状态、切换项目等

## 手动测试清单（没有 tauri-driver 时的替代方案）

| # | 场景 | 操作 | 预期结果 |
|---|------|------|---------|
| 1 | 启动应用 | `npm run tauri dev` | 应用窗口在 10 秒内打开，显示主界面 |
| 2 | 执行 SQL | 打开 SQL Tab → 输入 `SELECT 1` → 点"执行" | 结果表格显示 1 行 |
| 3 | 查询历史 | 多次执行 SQL → 打开 Query History | 历史列表至少有 1 条 |
| 4 | 仪表盘 | 打开仪表盘 Tab → 点击"新增图表" | 能进入 AddChartModal，可选择查询、配置图表类型 |
| 5 | 自动化任务 | 打开任务中心 → 新建任务 → 手动执行 → 查看日志 | 任务创建成功，手动执行后有日志记录 |
| 6 | 回收站 | 执行 `DROP TABLE xxx`（通过回收站配置）→ 打开回收站面板 | 被删除的表出现在回收站列表中 |
| 7 | 切换项目 | 打开 ProjectManager → 创建新项目 → 切换过去 | 切换后数据库状态正确更新 |
| 8 | 设置页面 | 打开设置 → 切换主题 / 调整查询缓存 | 设置立即生效 |

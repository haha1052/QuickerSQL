# CheckList

## 验证项

- [x] **根因验证 1**：DashboardPage 设置启动缓存后确实调用了 `loadSavedCharts()`
  - 验证方式：代码检查 `DashboardPage.tsx` 第 212 行
- [x] **根因验证 2**：DashboardItem 检测精简数据（sql 为空）并触发加载
  - 验证方式：代码检查 `DashboardItem.tsx` 第 394 行 `hasLiteData` 计算
- [x] **根因验证 3**：手动刷新时跳过缓存策略，强制走 SQL
  - 验证方式：代码检查 `DashboardItem.tsx` 第 420 行和第 449 行的 `!isManualRefresh` 条件
- [x] **自动刷新验证**：切换到仪表盘页面后，图表能自动加载并渲染
  - 验证方式：DashboardPage 加载 savedCharts 后，DashboardItem 检测到 savedChart 变化会重新渲染
- [x] **手动刷新验证**：点击刷新按钮后，图表重新执行 SQL 并更新
  - 验证方式：`refreshChartsVersion` 递增 → useEffect 触发 → isManualRefresh=true → 跳过策略 0/1 → 走策略 2（SQL）
- [x] **防竞态验证**：cancelled 模式正确，组件卸载/重新触发时不会有过期 setState
  - 验证方式：代码检查所有 setState 前都有 cancelled 检查，cleanup 中设置 cancelled=true
- [x] **Rust 编译**：`cargo check --quiet` 通过
  - 验证方式：命令行执行，exit code = 0
- [x] **TS 编译**：DashboardPage/DashboardItem 无新增类型错误
  - 验证方式：`tsc` 输出中无 DashboardItem/DashboardPage 相关错误
  - 注：项目中其他文件（taskStore、projectStore 等）有 35 个历史遗留错误，与本次修改无关

## 代码质量检查

- [x] 未引入新的 `any` 类型
- [x] 未引入新的 `console.log` 调试残留
- [x] 遵循项目现有命名规范（camelCase）
- [x] 未破坏架构分层（组件层不直接 invoke）

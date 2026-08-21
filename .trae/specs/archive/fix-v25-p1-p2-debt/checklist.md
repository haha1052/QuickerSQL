# Checklist — v25.2 P1/P2 技术债修复

> **关联**: [spec.md](./spec.md) | [tasks.md](./tasks.md)

---

## P1 代码质量门禁

- [ ] `duckdb.rs::execute()` 和 `query()` 中的参数转换保留原始类型（i64/f64/bool 不再全转 String）
- [ ] `query_cache_service.rs::CacheEntry` 含 `estimated_size_bytes` 字段
- [ ] `InnerCache` 含 `total_size_bytes` 和 `max_total_size_bytes`（默认 256MB）
- [ ] `set()` 在总大小超限时按 LRU 驱逐
- [ ] `CacheStats` 含 `totalSizeBytes` 和 `maxTotalSizeBytes`（camelCase）
- [ ] `services/tauri.ts` 导出 `isTauriEnv()` 函数
- [ ] `invokeCommand` 在非 Tauri 环境直接返回错误，不调用 `invoke()`
- [ ] AppWrapper 或 App.tsx 在非 Tauri 环境显示一次性 banner
- [ ] 5 个文件（DashboardPage/TaskEditorModal/SaveChartModal/DependencyEditorModal/App）无独立硬编码中文（除注释外）

## P2 代码质量门禁

- [ ] App.tsx 中密码保护 + sessionTimeout 两个 useEffect 使用统一 throttle 监听器
- [ ] App.tsx 不再有 8 个独立的 addEventListener 调用（合并为 ≤ 4 个）
- [ ] SettingsModal / DatabaseExplorer / ProjectManager 默认导出经 `React.memo` 包装
- [ ] ChartRenderer.tsx 根据数据点数动态选择 SVG/canvas 渲染器
- [ ] App.css 含 `.loading-skeleton` 样式类，App.tsx LoadingSkeleton 使用 className
- [ ] DashboardToolbar.tsx < 200 行，拆分为父 + 2-3 子组件

## 编译 + 测试门禁

- [ ] `cd src-tauri; cargo check --quiet` → 0 errors
- [ ] `cd src-tauri; cargo test --quiet` → 323+ passed / 0 failed（不回归）
- [ ] `npx tsc --noEmit --pretty` → 0 errors
- [ ] `npx vitest run` → 98+ passed / 0 failed（不回归）

## 安全门禁

- [ ] SQL 注入两段式扫描 → 0 真实违规
- [ ] 敏感字符串扫描 → 0 真实违规
- [ ] 前端 SQL 关键字 → 0
- [ ] Rust unwrap/expect（非测试）→ ≤1
- [ ] TS any 类型 → 0

## 浏览器验证

- [ ] Tauri dev server 启动成功：http://localhost:1420 返回 HTTP 200
- [ ] 核心页面渲染正常（SQL 查询 / Dashboard / Automation / Settings）
- [ ] 非浏览器环境下 banner 提示（如适用）

## 文档同步

- [ ] `docs/技术债清单_v4.md` 版本号 v6.2
- [ ] §一 P1=0 / P2=0
- [ ] §7.2 / §7.3 所有项标记 ✅ 已修复 v25.2
- [ ] `docs/架构现状.md` 版本号 v25.2
- [ ] 综合评分提升（如 8.6 → 9.0）

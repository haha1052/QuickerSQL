# v25.2 P1/P2 技术债修复 Spec

> **Change ID**: fix-v25-p1-p2-debt
> **Spec 版本**: v1.0
> **创建日期**: 2026-08-08
> **关联文档**: [技术债清单_v4.md v6.1](file:///e:/LA_DUCK/la-duck/docs/技术债清单_v4.md) §7.2/§7.3

---

## Why

v25.1 完成 P0 紧急修复后，仍剩余 4 项 P1（高危）和 5 项 P2（中危）技术债。P1 影响数据正确性、稳定性与用户体验，应立即排期；P2 影响性能与可维护性，中期治理。本 spec 一次性消除全部 9 项技术债，避免债务累积。

## What Changes

### P1 修复（4 项）
- **P1-1** DuckDB `execute()` 参数类型丢失：实现 trait ToSql → duckdb ToSql 直接类型映射，保留 i64/f64/bool 原始类型
- **P1-2** 查询缓存无大小限制：CacheEntry 增加 `estimated_size_bytes`；InnerCache 增加 `total_size_bytes` 与 `max_total_size_bytes`（默认 256MB）；set 时按 LRU 驱逐超额条目
- **P1-3** 前端 IPC 不可用检测：`services/tauri.ts` 启动时检测 `'__TAURI_INTERNALS__' in window`，提供 `isTauriEnv()` 公开方法；AppWrapper 中检测失败时显示一次性 banner
- **P1-4** i18n 残留 40+：5 个文件（DashboardPage / TaskEditorModal / SaveChartModal / DependencyEditorModal / App）抽取硬编码中文为 i18n key

### P2 修复（5 项）
- **P2-1** 事件监听合并：App.tsx 8 个监听器合并为单一 throttle 函数（500ms），改用 requestIdleCallback 兜底
- **P2-2** React.memo：对 3 个懒加载大组件（SettingsModal / DatabaseExplorer / ProjectManager）包装 React.memo
- **P2-3** ECharts SVG 模式：ChartRenderer.tsx 评估后启用 `renderer: 'svg'`（小数据量更流畅，大数据量回退 canvas）
- **P2-4** 内联样式：本次仅迁移 App.tsx LoadingSkeleton 的内联样式到 App.css（高频渲染组件优先）
- **P2-5** 大组件拆分：本次仅拆分 DashboardToolbar（425 行，最易拆分且修改频率高），其他保留渐进治理

## Impact

| 维度 | 影响 |
|------|------|
| 后端编译 | `cargo check` 须 0 errors |
| 前端编译 | `npx tsc --noEmit` 须 0 errors |
| 单测回归 | cargo test 323+ passed / vitest 98+ passed |
| 浏览器验证 | HTTP 200 + 核心页面渲染正常 |
| Breaking | ❌ 无 |

---

## ADDED Requirements

### Requirement: DuckDB execute() 保留参数原始类型
- **WHEN** 调用 `conn.execute("INSERT INTO t VALUES (?, ?)", &[&42i64, &3.14f64])`
- **THEN** DuckDB 绑定 INT64 与 DOUBLE 类型，而非全 STRING

### Requirement: 查询缓存总大小上限
- **WHEN** 缓存总大小超过 256MB（默认）
- **THEN** 按 LRU 顺序驱逐最旧条目直到总大小 ≤ 上限
- **AND** CacheStats 暴露 `totalSizeBytes` / `maxTotalSizeBytes`

### Requirement: IPC 不可用降级提示
- **WHEN** 应用运行在非 Tauri 环境（纯浏览器）
- **THEN** 启动时显示一次性 banner 提示"当前为浏览器预览模式，部分功能不可用"
- **AND** `tauriService.isTauriEnv()` 返回 false，调用方据此降级

### Requirement: 全局事件监听合并
- **WHEN** 用户在应用内移动鼠标或按键
- **THEN** 仅触发一个 throttle 函数（500ms 间隔），重置空闲计时器
- **AND** 不再为每个 useEffect 单独注册 4 个监听器

### Requirement: 懒加载大组件 React.memo
- **WHEN** 父组件 state 变化但 props 引用稳定
- **THEN** SettingsModal / DatabaseExplorer / ProjectManager 不重渲染

### Requirement: ECharts SVG 渲染模式
- **WHEN** 图表数据点 ≤ 5000
- **THEN** 使用 SVG 渲染器（更流畅、可访问性更好）
- **WHEN** 数据点 > 5000
- **THEN** 回退 canvas 渲染器（性能优先）

---

## MODIFIED Requirements

### Requirement: i18n 文本抽取
所有 P1-4 列出的 5 个文件中的硬编码中文字符串改为通过 `t('key')` 调用，对应 key 在 LocaleContext 的 zhCNTranslations 中登记。

### Requirement: DashboardToolbar 拆分
原 425 行拆分为父组件 + 2-3 个子组件（如 DashboardToolbarActions / DashboardToolbarFilters），父组件 < 200 行。

---

## REMOVED Requirements

### Requirement: 内联样式全面迁移
**Reason**: 全项目内联样式泛滥（仅 7 个 CSS 文件），一次性迁移工作量过大且风险高。
**Migration**: 本版本仅迁移 App.tsx LoadingSkeleton（高频渲染），其余保留 v27.0 渐进治理。

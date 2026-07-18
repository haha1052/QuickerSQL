# 仪表盘图表刷新修复 Spec v4

## Why
spec v3 基于错误假设（认为 `setSavedChartsFromStartup` 未被调用），没有解决根本问题。从截图和代码分析，真正的根因是：

### 根因 1：DashboardPage 设置了精简 savedCharts 但没有加载完整数据
- [DashboardPage.tsx:194-202](file:///e:/LA_DUCK/la-duck/src/components/dashboard/DashboardPage.tsx#L194-L202) 中，启动缓存就绪时调用了 `setSavedChartsFromStartup()`，设置了精简版 savedCharts（`sql: ''`, `config: null`, `lastResult: null`）
- 但**只调用了 `loadDashboards()`，没有调用 `loadSavedCharts()`**
- 导致 savedCharts 永远是精简数据，所有图表渲染策略（策略0-3）全部失败

### 根因 2：DashboardItem 的 savedCharts 加载条件不足
- [DashboardItem.tsx:387](file:///e:/LA_DUCK/la-duck/src/components/dashboard/DashboardItem.tsx#L387) 中，只在 `savedCharts.length === 0` 时才触发 `loadSavedCharts()`
- 但精简数据的 `length > 0`（只是字段不全），所以不会触发加载
- 四层降级策略全部失败 → 显示"图表加载失败，缺少 SQL / 图表配置"

### 根因 3：手动刷新无法修复问题
- `refreshCharts` 只递增 `refreshChartsVersion`
- 但 savedCharts 仍然是精简数据（sql 为空），策略 2 执行 SQL 也会失败
- 所以手动刷新也无效

## What Changes
- `DashboardPage.tsx`: 在设置启动缓存后，检测 savedCharts 是否为精简数据，如果是则调用 `loadSavedCharts()`
- `DashboardItem.tsx`: 将 savedCharts 加载条件从 `savedCharts.length === 0` 改为同时检测精简数据（`hasLiteData`）
- `DashboardItem.tsx`: 添加 `isManualRefresh` 检测（从 ref 计算），手动刷新时跳过策略 0/1 缓存
- `DashboardItem.tsx`: 添加 `cancelled` 防竞态模式

## Impact
- Affected code: `src/components/dashboard/DashboardPage.tsx`, `src/components/dashboard/DashboardItem.tsx`
- 不修改 `dashboardStore.ts`（保持 v3 的修改，`refreshCharts` 只递增版本号）
- 不修改启动缓存机制（`setSavedChartsFromStartup` 保留）

## ADDED Requirements

### Requirement: DashboardPage 启动缓存后加载完整 savedCharts
The system SHALL 在 DashboardPage 设置启动缓存的精简 savedCharts 后，检测数据是否为精简版（sql 为空），如果是则触发 `loadSavedCharts()` 加载完整数据。

#### Scenario: 应用启动后切换到仪表盘
- **WHEN** 用户从其他页面切换到仪表盘页面
- **THEN** DashboardPage 挂载，先消费启动缓存（精简数据）
- **AND** 检测到 savedCharts 是精简数据（sql 为空）
- **AND** 自动调用 `loadSavedCharts()` 加载完整数据
- **AND** 完整数据到达后，图表正常渲染

### Requirement: DashboardItem 检测精简数据并触发加载
The system SHALL 在 DashboardItem 的 useEffect 中，不仅检查 `savedCharts.length === 0`，还要检查是否为精简数据（所有图表的 sql 都为空）。如果是精简数据，触发 `loadSavedCharts()`。

#### Scenario: savedCharts 是精简数据
- **WHEN** DashboardItem 挂载时，savedCharts 有数据但 sql 全为空
- **THEN** 自动调用 `loadSavedCharts()` 加载完整数据
- **AND** 等待 200ms 后重新尝试渲染

### Requirement: 手动刷新跳过缓存策略
The system SHALL 在 `refreshChartsVersion` 变化时（手动刷新），DashboardItem 的渲染跳过策略 0（lastResult 缓存）和策略 1（config 缓存），直接走策略 2 执行 SQL。

#### Scenario: 用户点击刷新按钮
- **WHEN** 用户点击工具栏的"刷新"按钮
- **THEN** `refreshChartsVersion` 递增
- **AND** DashboardItem 检测到版本变化，设置 `isManualRefresh = true`
- **AND** 跳过策略 0/1，直接执行 SQL 获取最新数据

### Requirement: 异步操作防竞态
The system SHALL 在 DashboardItem 的 useEffect 中使用 cancelled 模式，确保被清理的 effect 的异步操作不会覆盖后续 effect 的结果。

#### Scenario: useEffect 被清理
- **WHEN** useEffect 因依赖变化被清理
- **THEN** cleanup 函数设置 `cancelled = true`
- **AND** 异步操作完成后检查 `cancelled`，如果 true 则不更新状态

## Non-Goals
- ❌ 不修改 `dashboardStore.ts` 的 `refreshCharts`（保持 v3 修改：只递增版本号）
- ❌ 不删除 `setSavedChartsFromStartup` / `setDashboardsFromStartup`（保留启动缓存机制）
- ❌ 不修改策略 0/1/2/3 的核心逻辑（只在 isManualRefresh 检测和精简数据检测上做修复）
- ❌ 不引入新的状态或 ref（复用现有 ref 模式）

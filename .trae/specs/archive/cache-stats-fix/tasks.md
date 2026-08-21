# 查询缓存统计问题修复 - The Implementation Plan

## [ ] Task 1: 修复命中率计算 - 缓存过期不计入 misses
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 修改 `InnerCache::get()` 方法，缓存过期时不增加 `misses` 计数器
  - 新增 `expired_count: u64` 字段统计过期次数
  - `CacheStats` 新增 `expiredCount` 字段
  - 命中率 = hits / (hits + misses)，过期不算在分母里
- **Acceptance Criteria Addressed**: AC-1, AC-5
- **Test Requirements**:
  - `programmatic` TR-1.1: 过期条目的 get() 调用不会增加 misses
  - `programmatic` TR-1.2: 过期条目的 get() 调用会增加 expired_count
  - `programmatic` TR-1.3: 命中率计算 = hits / (hits + misses)，不含过期
  - `programmatic` TR-1.4: 所有现有测试通过
  - `programmatic` TR-1.5: cargo check 通过
- **Notes**: 修改 `query_cache_service.rs` 的 InnerCache 和 CacheStats

## [ ] Task 2: 修复容量单位混乱 - 统一为条目数
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - 修改 `CacheSettingsSync.tsx`，直接用 cacheSize 的值作为 capacity，不再乘以 MB_TO_ENTRIES_FACTOR
  - 更新 `default_settings.rs` 中 `cache.cacheSize` 的默认值从 `"100"` 改为 `"100"`（值不变，但含义变了：从 100MB 变成 100 条）
  - 更新设置项的标签和描述，从"缓存大小（MB）"改为"缓存容量（条）"
  - 确保 cacheExpiry 的单位描述清晰为"分钟"
- **Acceptance Criteria Addressed**: AC-2, AC-5
- **Test Requirements**:
  - `programmatic` TR-2.1: tsc 类型检查通过
  - `human-judgement` TR-2.2: 设置项标签显示为"缓存容量（条）"
- **Notes**: 修改 `CacheSettingsSync.tsx`、`default_settings.rs`、设置 UI 的标签

## [ ] Task 3: 修复配置面板与设置系统同步
- **Priority**: medium
- **Depends On**: Task 2
- **Description**:
  - QueryCacheStatsPanel 的 capacity/ttl 输入框初始值从设置系统读取
  - 点击"应用配置"时，同时更新设置系统的 cache.cacheSize 和 cache.cacheExpiry
  - 保持单一数据源：设置系统是 source of truth
- **Acceptance Criteria Addressed**: AC-3, AC-5
- **Test Requirements**:
  - `programmatic` TR-3.1: tsc 类型检查通过
  - `human-judgement` TR-3.2: 面板初始值与设置系统一致
- **Notes**: 修改 `QueryCacheStatsPanel.tsx`

## [ ] Task 4: 修复命中率趋势图 Y 轴
- **Priority**: medium
- **Depends On**: None
- **Description**:
  - 命中率趋势图 Y 轴最大值固定为 100%（1.0）
  - 移除动态 maxVal 计算
- **Acceptance Criteria Addressed**: AC-4, AC-5
- **Test Requirements**:
  - `programmatic` TR-4.1: tsc 类型检查通过
  - `human-judgement` TR-4.2: Y 轴顶部显示 100%
- **Notes**: 修改 `QueryCacheStatsPanel.tsx`

## [ ] Task 5: 验证与回归测试
- **Priority**: high
- **Depends On**: Task 1, 2, 3, 4
- **Description**:
  - 运行 cargo check --quiet
  - 运行 cargo test
  - 运行 npx tsc --noEmit --pretty
  - 运行 SQL 注入检测
  - 运行 unwrap 检测
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `programmatic` TR-5.1: cargo check 通过
  - `programmatic` TR-5.2: cargo test 全部通过
  - `programmatic` TR-5.3: tsc 通过
  - `programmatic` TR-5.4: SQL 注入检测 0 匹配
  - `programmatic` TR-5.5: unwrap 检测 0 匹配（测试代码除外）

# 查询缓存统计问题修复 - Product Requirement Document

## Overview
- **Summary**: 查询缓存状态面板存在 4 个统计和显示问题：缓存过期计入 misses 导致命中率偏低、容量单位混乱（MB vs 条）、配置面板与设置系统不同步、命中率趋势 Y 轴有误导性。需要逐一修复。
- **Purpose**: 确保缓存统计数据准确、单位清晰、配置一致，让用户能正确理解和使用查询缓存功能。
- **Target Users**: 使用查询缓存功能的所有用户

## Goals
- G1: 修复命中率计算，缓存过期不计入 misses
- G2: 统一容量单位为"条目数"，修正设置项描述，消除用户困惑
- G3: 确保缓存配置面板与设置系统的配置保持同步
- G4: 修复命中率趋势图 Y 轴最大值为 100%，避免视觉误导
- G5: 所有测试通过，不引入新的技术债

## Non-Goals (Out of Scope)
- ❌ 不重写缓存核心算法
- ❌ 不添加新的缓存策略（LFU 等）
- ❌ 不修改缓存键生成逻辑

## Background & Context

**发现的 4 个问题：**

### 问题 1：缓存过期计入 misses（命中率偏低）
- 位置：`query_cache_service.rs` 第 120 行
- 现象：缓存条目过期后，`get()` 返回 None 时会 `self.misses += 1`
- 问题：缓存过期本质上是"曾经命中过，后来失效了"，不应算作未命中
- 影响：命中率被低估，用户看到的命中率比实际低

### 问题 2：容量单位混乱
- 设置里写的是"缓存大小（MB）"，默认 100 MB
- 但 `CacheSettingsSync.tsx` 把 MB 按 1MB=100条 转换成了条目数
- `QueryCacheStatsPanel` 直接显示"容量：XX 条"
- 用户困惑：为什么设置了 100MB，面板显示 100 条？
- 而且默认值对不上：设置默认 100MB 应该是 10000 条，但面板显示 100 条（因为 CacheSettingsSync 可能加载时机问题没生效）

### 问题 3：配置面板与设置系统不同步
- `QueryCacheStatsPanel` 有自己的 capacity/ttl 输入框，直接调用 `configureCache`
- 设置系统里也有 `cache.cacheSize` 和 `cache.cacheExpiry`
- 两边独立维护，改了一边另一边不会更新
- 影响：用户在设置里改了缓存大小，但面板里还是旧值

### 问题 4：命中率趋势 Y 轴有误导性
- Y 轴最大值 = `max(maxVal, 0.01)`，即所有采样点中的最大命中率
- 如果命中率都是 40%，图看起来就像 100%，有视觉误导
- 应该固定最大值为 100%（1.0），这样才能直观看到实际命中率水平

## Functional Requirements
- **FR-1**: 缓存过期不计入 misses，单独统计过期次数
- **FR-2**: 设置项 `cache.cacheSize` 改为"缓存容量（条）"，单位统一为条目数
- **FR-3**: 设置项 `cache.cacheExpiry` 描述明确为"缓存过期时间（分钟）"
- **FR-4**: QueryCacheStatsPanel 的配置值从设置系统读取，与设置保持同步
- **FR-5**: 命中率趋势图 Y 轴固定最大值为 100%
- **FR-6**: CacheStats 新增 `expiredCount` 字段，显示累计过期次数

## Non-Functional Requirements
- **NFR-1**: `cargo check --quiet` 通过
- **NFR-2**: `npx tsc --noEmit --pretty` 通过
- **NFR-3**: 所有现有测试通过
- **NFR-4**: 新增测试覆盖命中率计算修正
- **NFR-5**: 不引入 SQL 注入风险

## Constraints
- **Technical**: 遵循三层架构（commands → services → database）
- **Business**: 保持向后兼容，旧的缓存数据不受影响
- **Dependencies**: Tauri v2, React 18, Zustand

## Assumptions
- [x] 用户更关心"能缓存多少条查询"而不是"占用多少 MB"
- [x] 缓存过期不计入 misses 是更合理的统计方式
- [x] 配置面板应该从设置系统读取，保持单一数据源

## Acceptance Criteria

### AC-1: 缓存过期不计入 misses
- **Given**: 缓存中有一个已过期的条目
- **When**: 调用 `get()` 获取该条目
- **Then**: 返回 None，但 `misses` 不增加，`expired_count` 增加 1
- **Verification**: `programmatic`

### AC-2: 设置项单位统一为条目数
- **Given**: 用户打开设置 → 缓存分类
- **When**: 查看 cacheSize 设置项
- **Then**: 标签显示为"缓存容量（条）"，默认值为 100
- **Verification**: `human-judgment`

### AC-3: 配置面板与设置系统同步
- **Given**: 用户在设置里修改了缓存容量
- **When**: 打开查询缓存状态面板
- **Then**: 面板中显示的容量值与设置中的值一致
- **Verification**: `human-judgment`

### AC-4: 命中率趋势 Y 轴固定为 100%
- **Given**: 命中率都是 40% 左右
- **When**: 查看命中率趋势图
- **Then**: Y 轴最大值为 100%，曲线大约在 40% 的位置
- **Verification**: `human-judgment`

### AC-5: 编译和测试通过
- **Given**: 修复完成
- **When**: 运行 cargo check / tsc / cargo test
- **Then**: 全部通过
- **Verification**: `programmatic`

## Open Questions
- [ ] 是否需要在面板中显示"累计过期次数"？（建议加上，更透明）

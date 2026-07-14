# 设置系统 P5 阶段 - 剩余设置项实现与报告更新 - Product Requirement Document

## Overview
- **Summary**: 完成设置系统最后 1 项"部分实现"设置项的补全（cache.cacheStrategy），修正报告中 3 项数据错误（editor.autoSave、editor.saveInterval、database.connectionTimeout 实际已实现），将设置系统生效率从 96.4% 提升到 100%，实现设置系统全面收官。
- **Purpose**: 解决设置系统最后遗留的"部分实现"问题，消除报告与代码实际状态的不一致，为用户提供 100% 可信的设置体验。
- **Target Users**: QuickerSQL 所有用户

## Goals
- G1：修正设置系统现状分析报告中的 3 项数据错误（editor.autoSave、editor.saveInterval、database.connectionTimeout 从"部分实现"升级为"已实现"）
- G2：完成 cache.cacheStrategy 设置项的完整实现，支持至少 2 种有效策略
- G3：设置系统生效率达到 100%（111 项全部实现），14 个分类全部 100%
- G4：更新设置系统现状分析报告到 v29.0，准确反映当前状态

## Non-Goals (Out of Scope)
- ❌ 不实现 cache.cacheStrategy 的 disk/hybrid 持久化策略（涉及磁盘 I/O，架构复杂度高，短期不做）
- ❌ 不新增任何新的设置项
- ❌ 不修改设置系统架构
- ❌ 不重写缓存服务（仅在现有 LRU 基础上扩展策略支持）

## Background & Context

### 当前状态（v28.0）
- 设置项总数：111 项
- 已实现：107 项（96.4%）
- 部分实现：4 项（3.6%）
- 未实现：0 项（0%）
- 100% 分类数：11 个

### 剩余 4 项"部分实现"核查结果
经代码实际核查，4 项中 3 项实际上已经实现，只是报告中标记错误：

| 设置项 | 报告标记 | 实际状态 | 说明 |
|--------|---------|---------|------|
| `editor.autoSave` | 部分实现 | ✅ 已实现 | SQLEditor.tsx 第 73 行读取，第 271 行控制内容变化时自动保存 |
| `editor.saveInterval` | 部分实现 | ✅ 已实现 | SQLEditor.tsx 第 74 行读取，第 228 行控制保存间隔 |
| `database.connectionTimeout` | 部分实现 | ✅ 已实现 | SQLite busy_timeout，语义等价于连接/锁等待超时 |
| `cache.cacheStrategy` | 部分实现 | ⚠️ 部分实现 | 只有 memory 策略有效，disk/hybrid 无效 |

### cache.cacheStrategy 现状
- 当前可选值：memory / disk / hybrid
- 实际有效：只有 memory（LRU 内存缓存）
- disk / hybrid：未实现，选择后无效果
- 缓存服务实现：query_cache_service.rs，基于 LRU 策略

## Functional Requirements

- **FR-1**: 修正报告数据错误 — 3 项设置从"部分实现"升级为"已实现"
- **FR-2**: cache.cacheStrategy 支持多种内存缓存策略 — 至少支持 lru / none 两种有效策略
- **FR-3**: 根据策略动态切换缓存行为 — 修改 cacheStrategy 后立即生效
- **FR-4**: 更新报告到 v29.0 — 准确反映当前 100% 生效率状态

## Non-Functional Requirements

- **NFR-1**: 性能 — 缓存策略切换不影响查询性能（延迟增加 < 1ms）
- **NFR-2**: 安全 — 所有数据库操作使用参数化查询，无 SQL 注入风险
- **NFR-3**: 兼容性 — 保持向后兼容，默认值不变（memory/lru 策略）

## Constraints

- **技术**: Rust (后端) + React/TypeScript (前端) + SQLite/DuckDB
- **架构**: 遵循三层架构（commands → services → database）
- **安全**: 禁止 format! 拼接 SQL，必须参数化查询
- **依赖**: 现有缓存服务 query_cache_service.rs

## Assumptions
- cache.cacheStrategy 的 disk/hybrid 策略用户需求不高，可以延后实现
- 将策略选项调整为内存内策略（lru / none）是可接受的
- 用户更看重"设置项 100% 生效"而非"丰富但无效的选项"

## Acceptance Criteria

### AC-1: 报告数据修正准确
- **Given**: 当前 v28.0 报告中 editor.autoSave、editor.saveInterval、database.connectionTimeout 标记为"部分实现"
- **When**: 核查代码实际实现并更新报告
- **Then**: 报告中这 3 项均标记为"已实现"，editor 分类实现率从 87.5%→100%，database 分类从 83.3%→100%
- **Verification**: `human-judgment`
- **Notes**: 需逐行核对代码引用

### AC-2: cache.cacheStrategy 支持至少两种有效策略
- **Given**: 用户在设置中选择不同的 cacheStrategy 值
- **When**: 执行 SQL 查询
- **Then**: 缓存行为符合所选策略（lru: 正常缓存；none: 不缓存）
- **Verification**: `programmatic`
- **Notes**: 策略切换后新查询立即生效，旧缓存可保留或清除

### AC-3: 设置项 implemented_settings 标记准确
- **Given**: 所有设置项实现完成
- **When**: 检查 settings_service.rs 中的 implemented_settings() 函数
- **Then**: 111 项设置全部标记为已实现
- **Verification**: `programmatic`
- **Notes**: 用 grep 统计 set.insert 数量

### AC-4: 生效率 100%
- **Given**: 所有设置项实现完成
- **When**: 统计设置系统生效率
- **Then**: 已实现 111/111 = 100%，14 个分类全部 100%
- **Verification**: `human-judgment`
- **Notes**: 报告中明确显示 100% 完成度

### AC-5: 编译通过
- **Given**: 所有代码修改完成
- **When**: 执行 cargo check 和 tsc
- **Then**: 均无错误
- **Verification**: `programmatic`
- **Notes**: 0 errors

### AC-6: 报告更新到 v29.0
- **Given**: 所有实现完成
- **When**: 查看设置系统现状分析报告
- **Then**: 版本号为 v29.0，统计数据准确，下一步计划清晰
- **Verification**: `human-judgment`
- **Notes**: 包含版本变更记录

## Open Questions

- [ ] Q1：cache.cacheStrategy 的策略选项是否需要调整？（当前是 memory/disk/hybrid，建议改为 lru/none 或保留 memory 并标记 disk/hybrid 为开发中）
- [ ] Q2：是否需要为 cache.cacheStrategy 添加策略切换时的缓存清除逻辑？

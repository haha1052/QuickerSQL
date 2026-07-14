# 设置系统 Phase 9: 数据库/性能/安全/可视化设置接入 - Product Requirement Document

## Overview
- **Summary**: 继续扩展高优先级设置项接入，将设置生效率从 45.5% 提升到 55%+，重点覆盖数据库连接、性能优化、安全审计、可视化增强四大领域。新增 12 项生效设置。
- **Purpose**: 提升设置系统的实用性和完整性，让核心功能的配置更加精细化。
- **Target Users**: QuickerSQL 所有用户，尤其是需要深度定制数据库连接、性能优化、安全策略的用户。

## Goals
- G1：总生效设置项从 50 项增加到 60+ 项，生效率从 45.5% 提升到 55%+
- G2：数据库设置生效率从 16.7% 提升到 66.7%+（4 项生效）
- G3：性能设置生效率从 33.3% 提升到 100%（2 项生效）
- G4：安全设置生效率从 12.5% 提升到 40%+（3 项生效）
- G5：可视化设置生效率从 50.0% 提升到 75%+（3 项生效）

## Non-Goals (Out of Scope)
- 不新增设置分类或设置项定义（仅接入后端已定义的设置项）
- 不重构设置系统架构（沿用 Phase 6 建立的元数据驱动架构）
- 不实现会话超时和自动锁定（高难度，需要会话管理重构）
- 不实现快捷键设置（20 项，工作量大，延后）
- 不实现高级设置（需要更多安全评估）

## Background & Context

### 当前状态（Phase 8 完成后）
- 总设置项：110 项
- 已生效：50 项（45.5%）
- 架构：后端元数据驱动 + 前端动态渲染
- 已实现的分类：appearance(6/8)、editor(9/12)、sql(6/10)、import(4/6)、cache(3/4)、automation(5/7)、trash(4/4)、visualization(4/8)、database(1/6)、performance(1/3)、security(1/8)、locale(5/6)

### 技术栈
- 前端：React 18 + TypeScript + Zustand + ECharts
- 后端：Rust + Tauri + SQLite/DuckDB
- 设置系统：元数据驱动（settings_service.rs 定义 + SettingsModal 动态渲染）

## Functional Requirements

### FR-1: 数据库设置接入（4 项）
- 接入 `database.connectionTimeout` - 连接超时时间（秒）
- 接入 `database.enableQueryCache` - 启用查询缓存（布尔）
- 接入 `database.maxConnections` - 最大连接数
- 接入 `database.autoConnect` - 自动连接上次数据库
- 在数据库连接服务中应用这些设置
- 应用启动时尝试自动连接（如启用）

### FR-2: 性能设置接入（2 项）
- 接入 `performance.queryTimeout` - 查询超时时间（秒）
- 接入 `performance.enableParallel` - 启用并行查询
- 在查询执行引擎中应用这些设置
- 查询超时后自动取消并提示用户

### FR-3: 安全设置接入（3 项）
- 接入 `security.auditLogRetention` - 审计日志保留天数
- 接入 `security.sessionTimeout` - 会话超时（标记为高难度，可跳过）
- 接入 `security.autoLock` - 自动锁定（标记为高难度，可跳过）
- 优先实现 `auditLogRetention`：应用启动时清理过期审计日志
- 会话超时和自动锁定需要会话管理重构，延后实现

### FR-4: 继续完善可视化设置（3 项）
- 接入 `visualization.defaultChartType` - 默认图表类型
- 接入 `visualization.enableTooltip` - 启用提示框
- 接入 `visualization.maxDataPoints` - 最大数据点
- 在图表创建和渲染时应用这些设置

## Non-Functional Requirements
- **NFR-1**: 所有新增设置项变更后 100ms 内生效（programmatic）
- **NFR-2**: 不影响现有设置功能的正常使用（programmatic）
- **NFR-3**: 代码符合架构分层规范，无 SQL 注入风险（programmatic）
- **NFR-4**: TypeScript 无 any 类型，Rust 无 unwrap/expect（programmatic）

## Constraints
- **Technical**: 必须遵守现有三层架构（commands/services/database）
- **Technical**: 前端组件层禁止直接 invoke，必须通过 services 层
- **Technical**: SQL 必须使用参数化查询，禁止 format! 拼接
- **Business**: 不新增后端设置项定义，仅接入后端已定义的设置
- **Dependencies**: 依赖 Phase 6 建立的元数据驱动架构

## Assumptions
- 数据库连接超时可以通过 DuckDB/SQLite 的连接配置实现
- 查询超时需要修改查询执行逻辑
- 审计日志保留天数可以通过定时清理实现
- 可视化设置可以直接在图表组件中读取和应用

## Acceptance Criteria

### AC-1: 数据库设置生效
- **Given**: 用户配置数据库连接相关设置
- **When**: 应用启动或连接数据库时
- **Then**: 按照设置的超时、缓存、连接数配置执行
- **Verification**: `human-judgment`

### AC-2: 性能设置生效
- **Given**: 用户配置查询超时和并行查询
- **When**: 执行 SQL 查询时
- **Then**: 按照设置的 timeout 和并行配置执行，超时后取消
- **Verification**: `human-judgment`

### AC-3: 安全设置生效
- **Given**: 用户配置审计日志保留天数
- **When**: 应用启动时
- **Then**: 清理超过保留天数的审计日志
- **Verification**: `human-judgment`

### AC-4: 可视化设置生效
- **Given**: 用户配置图表相关设置
- **When**: 创建或渲染图表时
- **Then**: 按照设置的默认类型、提示框、数据点限制执行
- **Verification**: `human-judgment`

### AC-5: 设置生效率达标
- **Given**: Phase 9 所有任务完成
- **When**: 统计已实现设置项数量
- **Then**: 总生效数 ≥ 60，生效率 ≥ 55%
- **Verification**: `programmatic`

### AC-6: 代码质量达标
- **Given**: Phase 9 所有代码修改完成
- **When**: 运行编译检查和安全检测
- **Then**: cargo check 通过、tsc 通过、无 SQL 注入、无敏感字符串
- **Verification**: `programmatic`

## Open Questions
- [ ] Q1: 数据库连接超时是在连接层面还是查询层面实现？
- [ ] Q2: 查询超时是中断当前查询还是等待查询完成后检查？
- [ ] Q3: 审计日志保留天数的默认值是多少？（建议 90 天）

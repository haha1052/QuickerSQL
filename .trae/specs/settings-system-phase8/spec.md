# 设置系统 Phase 8: 功能扩展与响应式完善 - Product Requirement Document

## Overview
- **Summary**: 继续扩展高优先级设置项接入，将设置生效率从 34.5% 提升到 45%+，同时完善设置变更的响应式机制。新增可视化、语言与区域、回收站三大分类的设置接入，总计新增 12+ 项生效设置。
- **Purpose**: 提升设置系统的实用性和完整性，让更多配置项对用户真正可用，同时确保设置变更实时生效。
- **Target Users**: QuickerSQL 所有用户，尤其是需要深度定制图表样式、日期数字格式、回收站行为的用户。

## Goals
- G1：总生效设置项从 38 项增加到 50+ 项，生效率从 34.5% 提升到 45%+
- G2：可视化设置生效率从 0% 提升到 50%+（4 项以上生效）
- G3：语言与区域设置生效率从 16.7% 提升到 83%+（5 项生效）
- G4：回收站设置生效率从 25% 提升到 75%+（3 项生效）
- G5：所有新增设置变更后实时生效，无需重启应用

## Non-Goals (Out of Scope)
- 不新增设置分类或设置项定义（仅接入后端已定义的设置项）
- 不重构设置系统架构（沿用 Phase 6 建立的元数据驱动架构）
- 不实现快捷键设置（20 项，工作量大，延后）
- 不实现高级设置和安全设置（需要更多安全评估）
- 不实现性能设置（query_timeout 等需要异步执行重构）

## Background & Context

### 当前状态（Phase 7 完成后）
- 总设置项：110 项
- 已生效：38 项（34.5%）
- 架构：后端元数据驱动 + 前端动态渲染
- 已实现的分类：appearance(6/8)、editor(9/12)、sql(6/10)、import(4/6)、cache(3/4)、automation(5/7)、trash(1/4)、database(1/6)、performance(1/3)、security(1/8)、locale(1/6)

### 技术栈
- 前端：React 18 + TypeScript + Zustand + ECharts
- 后端：Rust + Tauri + SQLite/DuckDB
- 设置系统：元数据驱动（settings_service.rs 定义 + SettingsModal 动态渲染）

## Functional Requirements

### FR-1: 可视化设置接入（4 项）
- 接入 `visualization.showGrid` - 控制图表网格线显示
- 接入 `visualization.showLegend` - 控制图表图例显示
- 接入 `visualization.animation` - 控制图表动画效果
- 接入 `visualization.defaultColorScheme` - 默认配色方案
- 所有设置变更后已渲染的图表实时更新

### FR-2: 语言与区域设置接入（5 项）
- 接入 `locale.dateFormat` - 日期格式（YYYY-MM-DD / DD/MM/YYYY / MM/DD/YYYY）
- 接入 `locale.timeFormat` - 时间格式（12h / 24h）
- 接入 `locale.numberFormat` - 数字格式（千分位和小数点样式）
- 接入 `locale.firstDayOfWeek` - 每周第一天（周日/周一）
- 接入 `locale.timezone` - 时区设置
- 在 LocaleContext 中提供格式化工具函数供全局使用

### FR-3: 回收站设置接入（3 项）
- 接入 `trash.autoCleanup` - 自动清理开关
- 接入 `trash.cleanupDays` - 自动清理天数阈值
- 接入 `trash.maxTrashSize` - 回收站最大占用空间
- 应用启动时自动执行清理（如启用）
- 删除表时检查回收站大小，超过阈值提示用户

### FR-4: 设置变更响应式完善
- 审计所有使用设置的组件，确保统一使用 `useSetting` hook
- 确保新增设置变更后实时生效，无需刷新页面
- 消除组件内硬编码默认值，统一从 SettingsContext 读取

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
- ECharts 的 setOption 可以动态更新 grid/legend/animation/color 配置
- 日期/数字格式化可以通过工具函数在前端实现，不需要后端参与
- 回收站自动清理可以在应用启动时执行，不需要后台定时任务
- 所有设置项的 value_type 在后端已正确定义

## Acceptance Criteria

### AC-1: 可视化设置生效
- **Given**: 用户在设置中修改可视化相关选项
- **When**: 打开或刷新图表
- **Then**: 图表按照新设置渲染（网格/图例/动画/配色）
- **Verification**: `human-judgment`

### AC-2: 语言与区域设置生效
- **Given**: 用户修改日期/时间/数字格式设置
- **When**: 查看包含日期或数字的界面
- **Then**: 显示格式与设置一致
- **Verification**: `human-judgment`

### AC-3: 回收站自动清理生效
- **Given**: 用户启用自动清理并设置了清理天数
- **When**: 应用启动且回收站中有超过天数的项目
- **Then**: 超过天数的项目被自动清理
- **Verification**: `human-judgment`

### AC-4: 设置生效率达标
- **Given**: Phase 8 所有任务完成
- **When**: 统计已实现设置项数量
- **Then**: 总生效数 ≥ 50，生效率 ≥ 45%
- **Verification**: `programmatic`
- **Notes**: 通过 `grep -c "set.insert" settings_service.rs` 统计

### AC-5: 设置实时生效
- **Given**: 用户修改任何已实现的设置
- **When**: 设置保存后
- **Then**: 相关界面立即更新，无需刷新或重启
- **Verification**: `human-judgment`

### AC-6: 代码质量达标
- **Given**: Phase 8 所有代码修改完成
- **When**: 运行编译检查和安全检测
- **Then**: cargo check 通过、tsc 通过、无 SQL 注入、无敏感字符串
- **Verification**: `programmatic`

## Open Questions
- [ ] Q1: 回收站自动清理是应用启动时执行还是定时执行？（默认启动时执行）
- [ ] Q2: 日期/数字格式需要在哪些具体界面生效？（优先查询结果、审计日志等数据展示区）
- [ ] Q3: 配色方案需要自定义色板还是使用 ECharts 内置主题？（默认内置主题 + 自定义色板映射）

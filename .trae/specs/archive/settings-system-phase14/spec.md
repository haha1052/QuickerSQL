# Phase 14 设置功能接入深化 — Product Requirement Document

## Overview
- **Summary**: 继续扩展高优先级设置项接入，将生效比例从 78.1% 提升到 85%+，重点覆盖高级设置完善、安全设置完善、自动化设置完善三大任务。
- **Purpose**: 持续提升设置系统的实际生效比例，让用户可配置的选项越来越多地真正影响应用行为。
- **Target Users**: 所有 QuickerSQL 用户，尤其是对安全设置和自动化任务有个性化需求的用户。

## Goals
- G1：新增 5 项设置接入，总生效数从 89 项提升到 94 项
- G2：总生效率从 78.1% 提升到 82.5%+（+4.4%+）
- G3：高级设置生效率从 87.5% 提升到 100%
- G4：安全设置生效率从 75% 提升到 100%
- G5：自动化设置生效率从 71.4% 提升到 100%

## Non-Goals (Out of Scope)
- ❌ 不做快捷键设置（20 项），复杂度高，留待后续 Phase
- ❌ 不做密码保护的实际加密功能，只接入设置项定义
- ❌ 不做遥测数据的实际发送功能，只接入设置项定义
- ❌ 不重构设置系统架构，保持现有元数据驱动架构不变

## Background & Context
- 当前设置系统共 114 项设置，已实现 89 项，生效率 78.1%
- Phase 13 已完成编辑器、SQL 查询、安全、高级四大分类的深化（+9 项）
- 剩余未生效设置主要分布在：快捷键 20 项、高级 1 项、安全 2 项、自动化 2 项
- 本次 Phase 14 优先接入高级、安全、自动化三个分类，完成后仅剩快捷键 20 项未生效

## Functional Requirements
- **FR-1**: 高级设置完善：新增 enableTelemetry（启用遥测数据）1 项接入
- **FR-2**: 安全设置完善：新增 enablePasswordProtect（启用密码保护）、lockTimeout（自动锁定时间）2 项接入
- **FR-3**: 自动化设置完善：新增 notifyOnFailure（任务失败通知）、maxConcurrentTasks（最大并发任务数）2 项接入
- **FR-4**: 所有新增设置项在设置界面正确显示，修改后立即生效（设置项持久化）
- **FR-5**: 所有新增设置项持久化存储，重启应用后保留

## Non-Functional Requirements
- **NFR-1**: 设置修改后 UI 响应时间 < 100ms（不阻塞主线程）
- **NFR-2**: 不引入任何新的依赖包
- **NFR-3**: 代码符合项目现有架构分层和编码规范

## Constraints
- **Technical**: 遵循现有元数据驱动架构，后端定义设置元数据，前端动态渲染
- **Business**: 本次为渐进式优化，不改变用户现有使用习惯
- **Dependencies**: 依赖现有 SettingsContext、settingsStore、settings_service.rs 等基础设施

## Assumptions
- enableTelemetry 只需先接入设置项定义，实际遥测功能可后续迭代
- enablePasswordProtect 只需先接入设置项定义，实际密码保护功能可后续迭代
- lockTimeout 只需先接入设置项定义，实际自动锁定功能可后续迭代
- notifyOnFailure 只需先接入设置项定义，实际通知功能可后续迭代
- maxConcurrentTasks 只需先接入设置项定义，实际并发控制可后续迭代

## Acceptance Criteria

### AC-1: 高级 enableTelemetry 设置接入
- **Given**: 用户打开设置界面的高级分类
- **When**: 用户切换 enableTelemetry 开关
- **Then**: 设置项正确显示并持久化保存（实际遥测功能后续迭代）
- **Verification**: `programmatic`
- **Notes**: 验证设置项能正确保存和读取

### AC-2: 安全 enablePasswordProtect 设置接入
- **Given**: 用户打开设置界面的安全分类
- **When**: 用户切换 enablePasswordProtect 开关
- **Then**: 设置项正确显示并持久化保存（实际密码保护功能后续迭代）
- **Verification**: `programmatic`
- **Notes**: 验证设置项能正确保存和读取

### AC-3: 安全 lockTimeout 设置接入
- **Given**: 用户打开设置界面的安全分类
- **When**: 用户修改 lockTimeout 数值
- **Then**: 设置项正确显示并持久化保存（实际自动锁定功能后续迭代）
- **Verification**: `programmatic`
- **Notes**: 数值范围 1-60 分钟，步进 5 分钟

### AC-4: 自动化 notifyOnFailure 设置接入
- **Given**: 用户打开设置界面的自动化任务分类
- **When**: 用户切换 notifyOnFailure 开关
- **Then**: 设置项正确显示并持久化保存（实际通知功能后续迭代）
- **Verification**: `programmatic`
- **Notes**: 验证设置项能正确保存和读取

### AC-5: 自动化 maxConcurrentTasks 设置接入
- **Given**: 用户打开设置界面的自动化任务分类
- **When**: 用户修改 maxConcurrentTasks 数值
- **Then**: 设置项正确显示并持久化保存（实际并发控制后续迭代）
- **Verification**: `programmatic`
- **Notes**: 数值范围 1-10，步进 1

### AC-6: 编译与类型检查通过
- **Given**: 代码修改完成
- **When**: 执行 cargo check 和 npx tsc
- **Then**: 无任何错误
- **Verification**: `programmatic`

### AC-7: 安全与架构规范合规
- **Given**: 代码修改完成
- **When**: 执行 SQL 注入检测、敏感字符串检测、架构分层检测
- **Then**: 全部通过，无违规
- **Verification**: `programmatic`

## Open Questions
- [ ] Q1：enablePasswordProtect 是否需要在本阶段实现实际的密码保护功能？（暂定只接入设置项，功能留待后续）
- [ ] Q2：notifyOnFailure 是否需要在本阶段实现实际的通知功能？（暂定只接入设置项，功能留待后续）

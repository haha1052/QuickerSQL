# 自动化任务依赖系统 - Product Requirement Document

## Overview
- **Summary**: 为自动化任务增加完整的依赖系统，包括任务依赖和时间依赖，统一管理触发条件；同时在搜索框旁增加新建按钮，提升可用性。
- **Purpose**: 解决当前任务只能单一时间触发的限制，支持更复杂的工作流场景（如任务A成功后执行任务B）；同时解决有任务时看不到新建按钮的问题。
- **Target Users**: 需要编排复杂自动化工作流的用户

## Goals
- G1: 在任务列表搜索框右侧新增"+ 新建任务"按钮，始终可见
- G2: 新增 `__task_dependencies` 表，支持多种依赖类型
- G3: 支持 4 种依赖类型：时间间隔、Cron 表达式、前置任务成功、前置任务完成
- G4: 任务依赖支持延迟触发配置
- G5: 一个任务可以有多个依赖，满足任一条件即触发（OR 逻辑）
- G6: 旧数据自动迁移：schedule_mode/schedule_value 转为一条对应类型的依赖
- G7: 前端任务编辑器整合依赖管理 UI
- G8: 调度器支持多依赖触发，任务依赖触发时正确处理

## Non-Goals (Out of Scope)
- ❌ 不做 DAG（有向无环图）复杂工作流编排
- ❌ 不做依赖的 AND 逻辑（多个依赖同时满足才触发）
- ❌ 不做循环依赖检测（MVP 版本靠用户自觉）
- ❌ 不重写整个调度器，在现有调度器基础上扩展
- ❌ 不做依赖的暂停/单独启用，统一跟随任务状态

## Background & Context

**当前状态：**
- 自动化任务只有 3 种调度模式：interval（按间隔）、cron（Cron 表达式）、manual（仅手动）
- 每个任务只能有一种调度模式，存在 `schedule_mode` 和 `schedule_value` 字段
- 调度器每 10s 扫描一次 `next_run_at <= now` 的任务并执行
- 新建任务按钮只在空状态下显示，有任务后找不到新建入口

**用户痛点：**
1. 有任务时看不到新建按钮，用户不知道怎么创建新任务
2. 无法表达"任务A成功后执行任务B"的工作流
3. 时间触发方式不统一，没有"依赖"的概念

## Functional Requirements
- **FR-1**: 任务列表搜索框右侧新增"+ 新建任务"按钮，始终可见
- **FR-2**: 新增 `__task_dependencies` 系统表，存储任务依赖关系
- **FR-3**: 依赖类型枚举：`time_interval` | `cron` | `task_success` | `task_completed`
- **FR-4**: 每个任务可以有多个依赖，依赖之间是 OR 关系（满足任一即触发）
- **FR-5**: 时间间隔依赖：配置间隔秒数，周期性触发
- **FR-6**: Cron 依赖：配置 5 字段 cron 表达式 + 时区
- **FR-7**: 任务成功依赖：配置前置任务 ID + 可选延迟秒数，前置任务成功后触发
- **FR-8**: 任务完成依赖：配置前置任务 ID + 可选延迟秒数，前置任务完成（成功/失败都算）后触发
- **FR-9**: 任务创建/编辑时，可以增删改依赖
- **FR-10**: 旧数据自动迁移：首次启动时检测到旧任务没有依赖，自动根据 schedule_mode 创建一条对应依赖
- **FR-11**: 调度器改造：同时扫描时间依赖和任务依赖，满足条件即触发
- **FR-12**: 任务详情面板显示依赖信息列表

## Non-Functional Requirements
- **NFR-1**: `cargo check --quiet` 通过
- **NFR-2**: `npx tsc --noEmit --pretty` 通过
- **NFR-3**: 现有测试全部通过
- **NFR-4**: 新增依赖相关的单元测试
- **NFR-5**: 不引入 SQL 注入风险
- **NFR-6**: 向后兼容：旧任务数据自动迁移，不丢失
- **NFR-7**: 架构分层：commands → services → database，不越层

## Constraints
- **Technical**: Rust + Tauri v2 + React + Zustand + SQLite
- **Business**: 保持向后兼容，旧数据自动迁移
- **Dependencies**: 不引入新的第三方库，使用现有依赖

## Assumptions
- [x] 用户需要的是"任一依赖满足即触发"（OR 逻辑），而不是"所有依赖都满足才触发"（AND 逻辑）
- [x] 任务依赖是后置触发：前置任务执行完成后，触发后置任务
- [x] MVP 阶段不做循环依赖检测，靠用户自觉避免
- [x] 旧的 `schedule_mode` / `schedule_value` 字段保留，作为 fallback 和迁移源
- [x] 任务延迟触发通过"任务运行完成后计算后置任务的 next_run_at"实现

## Acceptance Criteria

### AC-1: 搜索框旁的新建按钮始终可见
- **Given**: 用户在自动化任务页面
- **When**: 无论任务列表是否为空
- **Then**: 搜索框右侧始终有一个"+ 新建任务"按钮，点击打开任务编辑器
- **Verification**: `human-judgment`

### AC-2: 依赖表创建成功
- **Given**: 应用启动
- **When**: 自动化任务模块初始化
- **Then**: `__task_dependencies` 表存在，字段完整
- **Verification**: `programmatic`

### AC-3: 支持 4 种依赖类型的 CRUD
- **Given**: 一个已启用的任务
- **When**: 添加/编辑/删除依赖
- **Then**: 操作成功，数据正确持久化
- **Verification**: `programmatic`

### AC-4: 旧数据自动迁移
- **Given**: 数据库中有旧格式任务（有 schedule_mode 但无依赖）
- **When**: 应用首次启动（带新代码）
- **Then**: 自动为旧任务创建一条对应类型的依赖记录
- **Verification**: `programmatic`

### AC-5: 时间依赖正常触发
- **Given**: 一个任务有时间间隔依赖（1 分钟）
- **When**: 等待 1 分钟以上
- **Then**: 任务被正常触发执行
- **Verification**: `programmatic`

### AC-6: 任务成功依赖正常触发
- **Given**: 任务 B 有"任务A成功"依赖
- **When**: 任务A执行成功
- **Then**: 任务B被触发（或按延迟时间后触发）
- **Verification**: `programmatic`

### AC-7: 任务完成依赖正常触发
- **Given**: 任务 B 有"任务A完成"依赖
- **When**: 任务A执行失败
- **Then**: 任务B仍然被触发
- **Verification**: `programmatic`

### AC-8: 前端依赖管理 UI
- **Given**: 打开任务编辑器
- **When**: 切换到"触发条件"标签
- **Then**: 可以看到依赖列表，可以添加/编辑/删除各种类型的依赖
- **Verification**: `human-judgment`

### AC-9: 编译和测试通过
- **Given**: 代码修改完成
- **When**: 运行 cargo check / tsc / cargo test
- **Then**: 全部通过
- **Verification**: `programmatic`

### AC-10: 无新增安全风险
- **Given**: 代码修改完成
- **When**: 运行 SQL 注入检测 / unwrap 检测
- **Then**: 无新增风险
- **Verification**: `programmatic`

## Open Questions
- [ ] 多个依赖之间是 OR 关系（满足任一即触发），这个设计是否符合预期？
- [ ] 任务依赖触发时，是否需要把"触发来源"记录到运行日志里？（建议：是，在 trigger_type 里增加 "dependency"）

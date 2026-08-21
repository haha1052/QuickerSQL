# Phase 15 设置功能深化落地 — Product Requirement Document

## Overview
- **Summary**: 将设置系统从"可配置"升级为"真生效"，重点实现 maxConcurrentQueries（最大并发查询数）控制、maxConcurrentTasks（最大并发任务数）控制、auditLogAutoClean（审计日志自动清理）三项功能，让已接入的设置项真正影响应用行为。
- **Purpose**: 完成设置系统主体功能的质量闭环，让用户看到的效果与配置的选项一致。
- **Target Users**: 所有 QuickerSQL 用户，尤其是有性能优化需求或有审计合规要求的用户。

## Goals
- G1：实现 maxConcurrentQueries 设置的实际控制功能
- G2：实现 maxConcurrentTasks 设置的实际控制功能
- G3：实现 auditLogAutoClean 设置的实际清理功能
- G4：提升设置系统的"所见即所得"体验

## Non-Goals (Out of Scope)
- ❌ 不实现 enableAutoRecover（SQL 查询自动恢复），复杂度高，留待后续
- ❌ 不实现 notifyOnFailure（任务失败通知），需要通知系统支持
- ❌ 不做快捷键设置框架，复杂度高，留待单独 Phase
- ❌ 不改变现有架构，保持现有三层架构不变

## Background & Context
- 当前设置系统共 114 项设置，已接入 94 项，生效率 82.5%
- Phase 14 完成后，8/9 分类已 100% 接入，仅剩快捷键 20 项
- 但很多已"接入"的设置项只是定义了值，并没有实际使用这个值来控制行为
- 例如：maxConcurrentQueries 定义了值，但 SQL 查询时并没有限制并发数
- 本次 Phase 15 聚焦"功能落地"，让已接入的设置真正生效

## Functional Requirements

### FR-1: maxConcurrentQueries 设置生效
- **描述**: SQL 查询服务读取 `maxConcurrentQueries` 设置，限制同时执行的查询数量
- **实现位置**: `query_service.rs` 或 `sql_service.rs`
- **工作流程**:
  1. 查询服务初始化时读取 `maxConcurrentQueries` 设置（默认值 10）
  2. 使用信号量或计数器限制并发查询数
  3. 超出限制时等待或返回错误提示

### FR-2: maxConcurrentTasks 设置生效
- **描述**: 自动化任务服务读取 `maxConcurrentTasks` 设置，限制同时运行的任务数
- **实现位置**: `task_service.rs`
- **工作流程**:
  1. 任务调度器初始化时读取 `maxConcurrentTasks` 设置（默认值 3）
  2. 使用信号量或计数器限制并发任务数
  3. 超出限制时任务进入等待队列

### FR-3: auditLogAutoClean 设置生效
- **描述**: 审计日志服务读取 `auditLogAutoClean` 和 `auditLogMaxSizeMB` 设置，自动清理过期或过大的日志
- **实现位置**: `audit_log_service.rs`
- **工作流程**:
  1. 服务启动时检查审计日志状态
  2. 如果 `auditLogAutoClean` 开启，执行清理
  3. 清理超过 `auditLogMaxSizeMB` 的旧日志条目
  4. 可选：定时检查并清理（基于 schedule 解析）

## Non-Functional Requirements
- **NFR-1**: 性能影响：并发控制不应显著增加查询/任务的执行延迟
- **NFR-2**: 兼容性：默认值保持不变，确保向后兼容
- **NFR-3**: 错误处理：超出并发限制时应给出清晰的用户提示

## Constraints
- **Technical**: 遵循现有三层架构（commands/services/database）
- **Dependencies**: 依赖 `schedule` crate 解析定时任务

## Assumptions
- 现有 SQL 查询服务已有某种并发控制机制，可以扩展
- 现有任务调度服务已有任务队列，可以扩展
- 审计日志服务已有日志存储和查询能力

## Acceptance Criteria

### AC-1: maxConcurrentQueries 功能验证
- **Given**: 用户在设置界面将 `maxConcurrentQueries` 设置为 2
- **When**: 同时发起 5 个 SQL 查询
- **Then**: 只有 2 个查询同时执行，其他 3 个排队等待
- **Verification**: `programmatic`
- **Notes**: 需要验证并发控制逻辑正确实现

### AC-2: maxConcurrentTasks 功能验证
- **Given**: 用户在设置界面将 `maxConcurrentTasks` 设置为 1
- **When**: 同时触发 3 个自动化任务
- **Then**: 任务按顺序执行，一次只运行 1 个
- **Verification**: `programmatic`
- **Notes**: 需要验证任务调度逻辑正确实现

### AC-3: auditLogAutoClean 功能验证
- **Given**: `auditLogAutoClean` 开启，`auditLogMaxSizeMB` 设置为 100
- **When**: 审计日志超过 100MB
- **Then**: 旧的日志条目被自动清理，保留最近的日志
- **Verification**: `programmatic`
- **Notes**: 需要验证清理逻辑正确实现

### AC-4: 默认值兼容性
- **Given**: 用户从未修改过这些设置
- **When**: 使用默认值
- **Then**: 应用行为与之前完全一致
- **Verification**: `programmatic`

### AC-5: 编译与安全检测通过
- **Given**: 代码修改完成
- **When**: 执行编译和检测
- **Then**: 全部通过
- **Verification**: `programmatic`

## Open Questions
- [ ] Q1：并发控制使用信号量（Semaphore）还是简单计数器？建议使用 tokio::sync::Semaphore
- [ ] Q2：任务排队时是否有超时机制？建议设置合理的等待超时
- [ ] Q3：审计日志清理是按数量还是按大小？建议按大小优先

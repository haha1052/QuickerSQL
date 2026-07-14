# Phase 16 设置功能深化落地 — 并发控制 — Product Requirement Document

## Overview
- **Summary**: 完成设置系统功能深化的最后两块拼图，实现 maxConcurrentQueries（SQL 查询并发控制）和 maxConcurrentTasks（任务并发控制），让设置系统从"可配置"升级为"真生效"。
- **Purpose**: 完成设置系统主体功能的质量闭环，让用户配置的并发限制真正生效。
- **Target Users**: 所有 QuickerSQL 用户，尤其是有性能优化需求或需要限制系统资源占用的用户。

## Goals
- G1：实现 maxConcurrentQueries 设置的实际控制功能（SQL 查询并发控制）
- G2：实现 maxConcurrentTasks 设置的实际控制功能（任务并发控制）
- G3：提升设置系统的"所见即所得"体验

## Non-Goals (Out of Scope)
- ❌ 不实现 enableAutoRecover（SQL 查询自动恢复），复杂度高，留待后续
- ❌ 不实现 notifyOnFailure（任务失败通知），需要通知系统支持
- ❌ 不做快捷键设置框架，复杂度高，留待单独 Phase
- ❌ 不改变现有命令接口，保持向后兼容

## Background & Context
- Phase 15 已完成 auditLogAutoClean 自动清理功能
- maxConcurrentQueries 和 maxConcurrentTasks 设置已定义但未实际生效
- 需要在 TauriAppState 中添加信号量来限制并发

## Functional Requirements

### FR-1: maxConcurrentQueries 并发控制
- **描述**: SQL 查询服务读取 `maxConcurrentQueries` 设置，限制同时执行的查询数量
- **实现位置**: `lib.rs`（状态初始化）、`sql_service.rs`（信号量使用）
- **工作流程**:
  1. `lib.rs` 初始化时读取 `maxConcurrentQueries` 设置，创建信号量
  2. 每次 SQL 查询执行前获取信号量许可
  3. 查询完成后释放信号量许可
  4. 超出限制时等待（异步等待）

### FR-2: maxConcurrentTasks 并发控制
- **描述**: 自动化任务服务读取 `maxConcurrentTasks` 设置，限制同时运行的任务数
- **实现位置**: `lib.rs`（状态初始化）、`task_service.rs`（信号量使用）
- **工作流程**:
  1. `lib.rs` 初始化时读取 `maxConcurrentTasks` 设置，创建信号量
  2. 任务执行前获取信号量许可
  3. 任务完成后释放信号量许可
  4. 超出限制时任务进入等待队列

## Technical Implementation

### 架构变更
1. **TauriAppState 新增字段**:
   ```rust
   pub struct TauriAppState {
       pub query_semaphore: Arc<Semaphore>,  // 新增
       pub task_semaphore: Arc<Semaphore>,   // 新增
       // ... 现有字段
   }
   ```

2. **初始化逻辑**（lib.rs）:
   - 从设置读取 `maxConcurrentQueries` 和 `maxConcurrentTasks`
   - 创建信号量并存储到 TauriAppState

3. **使用信号量**:
   - SQL 查询：使用 `query_semaphore` 限制并发
   - 任务执行：使用 `task_semaphore` 限制并发

## Non-Functional Requirements
- **NFR-1**: 性能影响：并发控制不应显著增加查询/任务的执行延迟
- **NFR-2**: 兼容性：默认值保持不变，确保向后兼容
- **NFR-3**: 错误处理：超出并发限制时应给出清晰的用户提示

## Acceptance Criteria

### AC-1: maxConcurrentQueries 功能验证
- **Given**: 用户在设置界面将 `maxConcurrentQueries` 设置为 2
- **When**: 同时发起 5 个 SQL 查询
- **Then**: 只有 2 个查询同时执行，其他 3 个排队等待
- **Verification**: `programmatic`

### AC-2: maxConcurrentTasks 功能验证
- **Given**: 用户在设置界面将 `maxConcurrentTasks` 设置为 1
- **When**: 同时触发 3 个自动化任务
- **Then**: 任务按顺序执行，一次只运行 1 个
- **Verification**: `programmatic`

### AC-3: 默认值兼容性
- **Given**: 用户从未修改过这些设置
- **When**: 使用默认值
- **Then**: 应用行为与之前完全一致
- **Verification**: `programmatic`

### AC-4: 编译与安全检测通过
- **Given**: 代码修改完成
- **When**: 执行编译和检测
- **Then**: 全部通过
- **Verification**: `programmatic`

## Open Questions
- [x] Q1：使用 tokio::sync::Semaphore 限制并发 ✅ 已决定
- [x] Q2：任务排队时是否有超时机制？❌ 暂不实现，无限等待

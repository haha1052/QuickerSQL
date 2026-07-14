# Phase 15 设置功能深化落地 — 任务分解

## 任务列表

- [ ] Task 1: maxConcurrentQueries 并发控制实现
  - [ ] SubTask 1.1: 分析现有 SQL 查询服务的并发控制需求
  - [ ] SubTask 1.2: 在 TauriAppState 中添加信号量
  - [ ] SubTask 1.3: 在 query_service.rs 中添加信号量控制
  - [ ] SubTask 1.4: 使用 useSetting 读取设置值
  - [ ] SubTask 1.5: 测试并发控制功能
  - **Test Requirements**:
    - `programmatic`: 验证并发控制逻辑正确
    - `human-judgment`: 验证设置项可见且可修改
  - **Note**: 需要架构变更，标记为 Phase 16 候选

- [ ] Task 2: maxConcurrentTasks 并发控制实现
  - [ ] SubTask 2.1: 分析现有任务服务的并发控制需求
  - [ ] SubTask 2.2: 在 TauriAppState 中添加信号量
  - [ ] SubTask 2.3: 在 task_service.rs 中添加信号量控制
  - [ ] SubTask 2.4: 使用 useSetting 读取设置值
  - [ ] SubTask 2.5: 测试并发控制功能
  - **Test Requirements**:
    - `programmatic`: 验证并发控制逻辑正确
    - `human-judgment`: 验证设置项可见且可修改
  - **Note**: 需要架构变更，标记为 Phase 16 候选

- [x] Task 3: auditLogAutoClean 自动清理实现 ✅
  - [x] SubTask 3.1: 分析现有审计日志服务的清理需求
  - [x] SubTask 3.2: 在 audit_log_service.rs 中添加 cleanup_by_size 函数
  - [x] SubTask 3.3: 在 task_service.rs 中调用清理逻辑
  - [x] SubTask 3.4: 测试清理功能
  - **Test Requirements**:
    - `programmatic`: 验证清理逻辑正确
    - `human-judgment`: 验证设置项可见且可修改

- [ ] Task 4: 编译验证与安全检测
  - [ ] SubTask 4.1: 执行 cargo check 验证 Rust 编译通过
  - [ ] SubTask 4.2: 执行 npx tsc 验证 TypeScript 类型通过
  - [ ] SubTask 4.3: 执行 SQL 注入检测
  - [ ] SubTask 4.4: 执行敏感字符串检测
  - **Test Requirements**:
    - `programmatic`: cargo check 无错误
    - `programmatic`: npx tsc 无类型错误

- [ ] Task 5: 更新设置系统现状分析报告
  - [ ] SubTask 5.1: 更新 Phase 15 完成统计
  - [ ] SubTask 5.2: 更新功能落地情况
  - **Test Requirements**:
    - `programmatic`: 验证文档格式正确，内容完整

## 任务依赖关系

```
Task 1 (maxConcurrentQueries) ──┐
                                │
Task 2 (maxConcurrentTasks) ────┼──▶ Task 4 (验证) ──▶ Task 5 (报告)
                                │
Task 3 (auditLogAutoClean) ────┘ (已完成)
```

## 预估工作量

- Task 1: maxConcurrentQueries — 高复杂度，需要架构变更，约 4-6 小时
- Task 2: maxConcurrentTasks — 中等复杂度，需要架构变更，约 3-4 小时
- Task 3: auditLogAutoClean — 低复杂度，已完成，约 30 分钟
- Task 4: 编译验证 — 快速，约 10 分钟
- Task 5: 更新报告 — 快速，约 15 分钟

**本次完成**: Task 3 (auditLogAutoClean)
**待 Phase 16 实现**: Task 1 (maxConcurrentQueries), Task 2 (maxConcurrentTasks)

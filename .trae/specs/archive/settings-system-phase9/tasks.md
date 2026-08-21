# 设置系统 Phase 9: 数据库/性能/安全/可视化设置接入 - 实施计划

## [x] Task 1: 数据库设置接入（4 项）
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 接入 `database.connectionTimeout` - 连接超时时间（秒）
  - 接入 `database.enableQueryCache` - 启用查询缓存
  - 接入 `database.maxConnections` - 最大连接数
  - 接入 `database.autoConnect` - 自动连接
  - 在数据库服务中应用这些设置
  - 应用启动时尝试自动连接（如启用）
  - 后端标记为已实现
- **Acceptance Criteria Addressed**: AC-1, AC-5
- **Test Requirements**:
  - `programmatic` TR-1.1: implemented_settings() 包含 4 项 database 设置
  - `programmatic` TR-1.2: 数据库服务读取并应用这些设置
  - `programmatic` TR-1.3: cargo check 通过
  - `human-judgement` TR-1.4: 连接超时和自动连接功能正常
- **Notes**: 中难度，先读取数据库服务代码了解当前实现

## [x] Task 2: 性能设置接入（2 项）
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 接入 `performance.queryTimeout` - 查询超时时间（秒）
  - 接入 `performance.enableParallel` - 启用并行查询
  - 在查询执行服务中应用这些设置
  - 查询超时后自动取消并提示用户
  - 后端标记为已实现
- **Acceptance Criteria Addressed**: AC-2, AC-5
- **Test Requirements**:
  - `programmatic` TR-2.1: implemented_settings() 包含 2 项 performance 设置
  - `programmatic` TR-2.2: 查询执行服务读取并应用这些设置
  - `programmatic` TR-2.3: cargo check 通过
  - `human-judgement` TR-2.4: 查询超时后自动取消
- **Notes**: 中难度，需要修改查询执行逻辑

## [x] Task 3: 安全设置接入（2-3 项）
- **Priority**: medium
- **Depends On**: None
- **Description**:
  - 接入 `security.auditLogRetention` - 审计日志保留天数
  - 评估 `security.sessionTimeout` 和 `security.autoLock` 的可行性
  - 如果可行则接入，否则标记为高难度延后
  - 审计日志保留：应用启动时清理过期日志
  - 后端标记为已实现
- **Acceptance Criteria Addressed**: AC-3, AC-5
- **Test Requirements**:
  - `programmatic` TR-3.1: implemented_settings() 包含 1-3 项 security 设置
  - `programmatic` TR-3.2: 审计日志清理功能实现
  - `programmatic` TR-3.3: cargo check 通过
  - `human-judgement` TR-3.4: 过期审计日志被清理
- **Notes**: 中难度，主要在后端实现

## [x] Task 4: 继续完善可视化设置（3 项）
- **Priority**: medium
- **Depends On**: None
- **Description**:
  - 接入 `visualization.defaultChartType` - 默认图表类型
  - 接入 `visualization.enableTooltip` - 启用提示框
  - 接入 `visualization.maxDataPoints` - 最大数据点
  - 在图表创建和渲染时应用这些设置
  - 后端标记为已实现
- **Acceptance Criteria Addressed**: AC-4, AC-5
- **Test Requirements**:
  - `programmatic` TR-4.1: implemented_settings() 包含 3 项 visualization 设置
  - `programmatic` TR-4.2: 图表组件读取并应用这些设置
  - `programmatic` TR-4.3: npx tsc 和 cargo check 均通过
  - `human-judgement` TR-4.4: 默认图表类型、提示框、数据点限制生效
- **Notes**: 中低难度，可与 Task 1-3 并行执行

## [x] Task 5: 测试验证 + 文档更新
- **Priority**: high
- **Depends On**: Task 1, 2, 3, 4
- **Description**:
  - 运行所有安全和规范检测命令
  - 更新设置系统现状分析报告到 v7.0
  - 统计已实现设置项数量，确保 ≥ 60 项
  - 启动应用验证所有新增设置项正常显示和工作
  - 验证原有 50 项设置不受影响
- **Acceptance Criteria Addressed**: AC-5, AC-6
- **Test Requirements**:
  - `programmatic` TR-5.1: cargo check --quiet 通过
  - `programmatic` TR-5.2: npx tsc --noEmit 通过
  - `programmatic` TR-5.3: SQL 注入检测 0 新增
  - `programmatic` TR-5.4: TS any 检测 0 新增
  - `programmatic` TR-5.5: 总已实现设置项 ≥ 60
  - `human-judgement` TR-5.6: 所有新增设置项功能正常
  - `human-judgement` TR-5.7: 原有设置功能不受影响
- **Notes**: 最终验证和文档更新

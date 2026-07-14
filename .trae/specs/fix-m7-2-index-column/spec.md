# 修复 M7.2 索引优化字段名错误 Spec

## Why
启动日志显示 M7.2 索引优化执行失败：`no such column: is_enabled`。

**根因分析**：
- `__automation_tasks` 表实际使用的字段是 `state`（值为 'enabled'/'disabled'）
- 但迁移服务的 `apply_optimization_indexes` 方法错误地使用了 `is_enabled` 字段
- 这导致创建索引失败，影响任务调度器的查询性能

## What Changes
- 将 `idx_auto_tasks_next_run_enabled` 索引中的 `is_enabled` 改为 `state`
- 更新注释说明，使其与实际字段名一致
- 确保索引名和字段名与现有代码保持一致

## Impact
- Affected code:
  - `src-tauri/src/services/migration_service.rs`

## ADDED Requirements

### Requirement: M7.2 索引优化必须使用正确的字段名
索引创建必须使用表中实际存在的字段名。

#### Scenario: 创建任务调度索引
- **GIVEN** `__automation_tasks` 表有 `state` 字段（无 `is_enabled` 字段）
- **WHEN** 启动应用执行 M7.2 索引优化
- **THEN** 成功创建 `idx_auto_tasks_next_run_enabled` 索引

## NON-GOALS
- ❌ 不修改其他索引定义
- ❌ 不修改 `__automation_tasks` 表结构
- ❌ 不修改任务调度器的查询逻辑

## Constraints
- 修改必须保持幂等性（使用 `CREATE INDEX IF NOT EXISTS`）
- 索引功能不变：支持 `WHERE next_run_at < ? AND state = 'enabled'` 查询

## Acceptance Criteria

### AC-1: M7.2 索引优化不再报错
- **Given**: 应用启动执行迁移
- **When**: 执行 `apply_optimization_indexes`
- **Then**: 不再出现 `no such column: is_enabled` 错误
- **Verification**: `programmatic`

### AC-2: 启动日志显示索引优化成功
- **Given**: 应用启动
- **When**: 迁移完成
- **Then**: 日志显示 `M7.2 数据库索引优化完成，共 23 条业务索引已应用`
- **Verification**: `human-judgment`

### AC-3: 编译通过
- **Given**: 修改后代码
- **When**: 运行 `cargo check --quiet`
- **Then**: 编译通过，无错误
- **Verification**: `programmatic`

## Open Questions
- [ ] 无


# 自动化任务依赖系统 - The Implementation Plan

## [x] Task 1: 搜索框新增新建任务按钮
- **Priority**: medium
- **Depends On**: None
- **Description**:
  - 在 TaskCenterPage.tsx 的搜索框右侧新增"+ 新建任务"按钮
  - 点击打开 TaskEditorModal
  - 按钮始终可见，无论任务列表是否为空
- **Acceptance Criteria Addressed**: AC-1, AC-9
- **Test Requirements**:
  - `programmatic` TR-1.1: tsc 类型检查通过 ✅
  - `human-judgement` TR-1.2: 搜索框右侧有明显的新建按钮
- **Notes**: 最小改动，先把按钮加上

## [x] Task 2: 后端数据模型 - 新增依赖表和结构体
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 新增 `__task_dependencies` 系统表（在 task_service.rs 的 ensure_tables_exists 中创建）
  - 字段：id, task_id, dependency_type, dependency_config(JSON), created_at, updated_at
  - 新增 `TaskDependency` Rust struct（models/automation.rs）
  - 新增依赖类型枚举：time_interval | cron | task_success | task_completed
  - 更新 Task 结构体，增加 dependencies 字段（可选，查询时 join 出来）
- **Acceptance Criteria Addressed**: AC-2, AC-9, AC-10
- **Test Requirements**:
  - `programmatic` TR-2.1: cargo check 通过 ✅
  - `programmatic` TR-2.2: 表创建 SQL 正确，无 SQL 注入 ✅
- **Notes**: 遵循参数化查询，SQL 表名用 SqlIdentifier

## [x] Task 3: 后端服务 - 依赖 CRUD
- **Priority**: high
- **Depends On**: Task 2
- **Description**:
  - 在 task_service.rs 中新增依赖 CRUD 方法：
    - list_dependencies(task_id) -> Vec<TaskDependency>
    - add_dependency(task_id, dep) -> TaskDependency
    - update_dependency(dep_id, config) -> TaskDependency
    - delete_dependency(dep_id) -> bool
    - replace_dependencies(task_id, deps) -> Vec<TaskDependency> （全量替换，前端编辑用）
  - 新增对应的 Tauri 命令（commands/automation.rs）
  - 在 lib.rs 中注册新命令
- **Acceptance Criteria Addressed**: AC-3, AC-9, AC-10
- **Test Requirements**:
  - `programmatic` TR-3.1: cargo check 通过 ✅
  - `programmatic` TR-3.2: 所有 SQL 使用参数化查询 ✅
  - `programmatic` TR-3.3: 新增单元测试覆盖 CRUD
- **Notes**:

## [x] Task 4: 后端迁移 - 旧数据自动迁移
- **Priority**: high
- **Depends On**: Task 3
- **Description**:
  - 在 ensure_tables_exists 之后执行迁移逻辑
  - 扫描所有有 schedule_mode 但没有依赖的任务
  - 根据 schedule_mode 创建一条对应类型的依赖：
    - interval -> time_interval 依赖，config.intervalSeconds = schedule_value
    - cron -> cron 依赖，config.expression = schedule_value
    - manual -> 不创建依赖（手动触发本来就没有）
  - 迁移幂等：已迁移的不重复迁移
- **Acceptance Criteria Addressed**: AC-4, AC-9
- **Test Requirements**:
  - `programmatic` TR-4.1: cargo check 通过 ✅
  - `programmatic` TR-4.2: 迁移逻辑幂等，重复执行不重复创建 ✅
- **Notes**: 迁移时保留旧字段不变，作为 fallback

## [x] Task 5: 后端调度器 - 支持任务依赖触发
- **Priority**: high
- **Depends On**: Task 4
- **Description**:
  - 任务执行完成后（成功/失败），检查所有依赖于该任务的后置任务
  - 如果是 task_success 依赖且当前任务成功 → 计算后置任务的触发时间（now + delay）
  - 如果是 task_completed 依赖（无论成功失败） → 计算后置任务的触发时间
  - 更新后置任务的 next_run_at 为触发时间
  - 调度器扫描逻辑不变（还是按 next_run_at 扫描）
  - 时间依赖的 next_run_at 计算改为从依赖表读取，而不是从 schedule_mode
  - 向后兼容：如果没有依赖，则 fallback 到旧的 schedule_mode 逻辑
- **Acceptance Criteria Addressed**: AC-5, AC-6, AC-7, AC-9
- **Test Requirements**:
  - `programmatic` TR-5.1: cargo check 通过 ✅
  - `programmatic` TR-5.2: 新增测试：任务成功后触发后置任务 ✅
  - `programmatic` TR-5.3: 新增测试：任务失败后 task_completed 依赖仍触发 ✅
  - `programmatic` TR-5.4: 所有现有测试通过 ✅
- **Notes**: 简化方案：只触发一层下游任务，不递归，由调度器自然处理

## [x] Task 6: 前端类型定义和 Store
- **Priority**: high
- **Depends On**: Task 3
- **Description**:
  - types/automation.ts 新增 TaskDependency 类型和 DependencyType 枚举
  - Task 接口增加 dependencies?: TaskDependency[]
  - tauri.ts 新增依赖相关的 invoke 方法
  - taskStore.ts 增加依赖相关状态和操作
- **Acceptance Criteria Addressed**: AC-9
- **Test Requirements**:
  - `programmatic` TR-6.1: tsc 类型检查通过 ✅

## [x] Task 7: 前端 - 任务编辑器整合依赖管理 UI
- **Priority**: high
- **Depends On**: Task 6
- **Description**:
  - TaskEditorModal 中新增"触发条件"区域（替换原有的调度模式选择）
  - 显示依赖列表，每个依赖显示类型和摘要
  - 支持添加新依赖（弹出选择器选类型，然后配置参数）
  - 支持编辑和删除依赖
  - 4 种依赖类型的配置表单：
    - time_interval: 输入间隔秒数（或分/时/天选择器）
    - cron: cron 表达式输入 + 预设选择
    - task_success: 选择前置任务 + 可选延迟秒数
    - task_completed: 选择前置任务 + 可选延迟秒数
  - 保存时调用 replace_dependencies 全量替换
- **Acceptance Criteria Addressed**: AC-8, AC-9
- **Test Requirements**:
  - `programmatic` TR-7.1: tsc 类型检查通过 ✅
  - `human-judgement` TR-7.2: 依赖管理 UI 清晰易用 ✅
- **Notes**: 保持现有 UI 风格，用已有设计系统

## [ ] Task 8: 前端 - 任务详情显示依赖信息
- **Priority**: medium
- **Depends On**: Task 7
- **Description**:
  - TaskRunLogsPanel 或任务详情区域显示依赖列表
  - 显示该任务的所有触发条件
  - 显示哪些任务依赖于它（后置任务，可选）
- **Acceptance Criteria Addressed**: AC-8
- **Test Requirements**:
  - `programmatic` TR-8.1: tsc 通过
  - `human-judgement` TR-8.2: 依赖信息展示清晰

## [x] Task 9: 联调测试与验证
- **Priority**: high
- **Depends On**: Task 1, 5, 7, 8
- **Description**:
  - 运行 cargo test 确保所有测试通过
  - 运行 cargo check --quiet
  - 运行 npx tsc --noEmit --pretty
  - SQL 注入检测
  - unwrap 检测
  - 端到端功能验证（手动）
- **Acceptance Criteria Addressed**: AC-9, AC-10
- **Test Requirements**:
  - `programmatic` TR-9.1: cargo check 通过 ✅
  - `programmatic` TR-9.2: cargo test 全部通过 ✅ (262 passed)
  - `programmatic` TR-9.3: tsc 通过 ✅
  - `programmatic` TR-9.4: SQL 注入检测 0 新增 ✅
  - `programmatic` TR-9.5: unwrap 检测 0 新增 ✅

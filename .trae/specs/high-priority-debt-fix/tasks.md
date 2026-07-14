# 高优先级剩余技术债务修复 - The Implementation Plan

## [ ] Task 1: 统一 Service 层错误类型（D-07 完成）
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 检查所有 Service 文件的错误返回类型
  - 统一使用 `Result<T, String>` 作为错误类型
  - 确保错误信息清晰，包含上下文
  - 添加必要的 `log::error!` / `log::warn!` 日志
  - 重点关注：dashboard_service, settings_service, query_history_service, task_service, audit_log_service
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-1.1: `cd src-tauri; cargo check --quiet` 无错误
  - `programmatic` TR-1.2: `cd src-tauri; cargo test` 全部通过
  - `programmatic` TR-1.3: 核心 Service public 函数返回类型统一为 Result<T, String>
- **Notes**: 内部私有函数可以使用更灵活的错误处理

## [x] Task 2: 梳理 Context 与 Store 职责（D-08 部分完成）
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 分析 AppContext 当前的职责和状态
  - 分析各 Store 当前的职责和状态
  - 明确职责边界：
    - AppContext: 全局 UI 导航（页面切换、模态框控制、欢迎页/引导页跳转）
    - Store: 业务数据状态（仪表盘、设置、查询历史等）
  - 将适合迁移的简单状态迁移到相应的 Store（如 settings 相关）
  - 在 AppWrapper.tsx 中添加职责说明注释
  - 确保不破坏现有功能
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `programmatic` TR-2.1: `npx tsc --noEmit --pretty` 0 errors
  - `programmatic` TR-2.2: `npx vitest run` 全部通过
  - `human-judgement` TR-2.3: 职责边界清晰，有文档说明
- **Notes**: 不做大规模迁移，只做边界明确和小范围优化

## [x] Task 3: 全量回归测试
- **Priority**: high
- **Depends On**: Task 1, 2
- **Description**: 
  - 运行完整的前端编译检查：`npx tsc --noEmit --pretty`
  - 运行完整的后端编译检查：`cd src-tauri; cargo check --quiet`
  - 运行前端单元测试：`npx vitest run`
  - 运行后端单元测试：`cd src-tauri; cargo test`
  - 验证核心功能流程正常
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `programmatic` TR-3.1: TypeScript 0 errors
  - `programmatic` TR-3.2: Rust 0 errors
  - `programmatic` TR-3.3: 前端 43+ tests passed
  - `programmatic` TR-3.4: 后端 249+ tests passed
- **Notes**: 这是最后检查，确保所有修改正确

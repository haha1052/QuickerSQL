# 高优先级剩余技术债务修复 - Verification Checklist

## Service 层错误类型统一验证

- [x] 核心 Service public 函数返回类型统一为 Result<T, String>
- [x] 错误信息包含上下文信息
- [x] 关键错误有适当的日志记录（log::error! / log::warn!）
- [x] 不引入新的 unwrap()/expect()
- [x] dashboard_service 错误类型统一
- [x] settings_service 错误类型统一
- [x] query_history_service 错误类型统一
- [x] task_service 错误类型统一
- [x] audit_log_service 错误类型统一
- [x] project_service 错误类型统一（移除 ProjectError）

## Context 与 Store 职责梳理验证

- [x] AppContext 职责清晰（全局 UI 导航：页面切换）
- [x] Store 职责清晰（业务数据状态 + 业务模态框控制）
- [x] 职责边界有文档说明（AppWrapper.tsx 中有注释）
- [x] 适合迁移的状态已迁移到相应 Store（settings modal 迁移到 settingsStore）
- [x] 不破坏现有功能
- [x] 与 projectStore.showProjectModal 模式一致

## 全量回归测试验证

- [x] TypeScript 编译通过（`npx tsc --noEmit --pretty` 0 errors）
- [x] Rust 编译通过（`cd src-tauri; cargo check --quiet` 无错误）
- [x] 前端单元测试全部通过（98 tests passed）
- [x] 后端单元测试全部通过（249 tests passed）
- [x] 核心功能流程正常工作

## 代码质量验证

- [x] 不引入新的 any 类型
- [x] 不引入新的 console.log
- [x] 代码风格与现有代码一致
- [x] 遵循架构分层规则

## 顺便修复的问题

- [x] echartsNormalize.test.ts 类型错误（41个）已修复

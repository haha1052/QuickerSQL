# Day 3 - 类型安全与稳定性 - The Implementation Plan

## [x] Task 1: 消除 Sidebar.tsx 中的 any 类型
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 修复 `src/components/common/Sidebar.tsx` 第 57、59、60 行的 any 类型
  - 第 57 行：`response.data.results as any[]` → 定义批量导入结果类型
  - 第 59 行：`r: any` → 使用定义的类型
  - 第 60 行：`item: any` → 使用定义的类型
  - 定义接口：`BatchImportResult`, `SuccessImportResult`
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-1.1: `npx tsc --noEmit --pretty` 无 Sidebar.tsx 相关错误
  - `programmatic` TR-1.2: 批量导入功能正常工作
- **Notes**: 使用具体类型或 unknown[] 替代 any[]

## [ ] Task 2: 消除 AppWrapper.tsx 中的 any 类型
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 修复 `src/AppWrapper.tsx` 第 262、263、265 行的 any 类型
  - `(data as any).transparencyEffective` → 定义 ThemeData 接口
  - `(data as any).needsFallback` → 使用 ThemeData.needsFallback
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-2.1: `npx tsc --noEmit --pretty` 无 AppWrapper.tsx 相关错误
  - `human-judgement` TR-2.2: 主题切换正常工作
- **Notes**: 定义 ThemeData 接口，明确字段类型

## [x] Task 3: 消除 DashboardItem.tsx 中的 any 类型
- **Priority**: medium
- **Depends On**: None
- **Description**: 
  - 修复 `src/components/dashboard/DashboardItem.tsx` 中的 any 类型
  - `optimizeConfigForSize(config: any, ...)` → 使用 ECharts 配置类型
  - axis 遍历中的 `axis: any` → 使用正确的轴类型
  - 可以用 `Record<string, unknown>` 或 ECharts 的轴类型替代
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-3.1: `npx tsc --noEmit --pretty` 无 DashboardItem.tsx 相关错误
  - `human-judgment` TR-3.2: 仪表盘图表正常显示
- **Notes**: ECharts 配置较复杂，可用 unknown[] 或具体类型

## [ ] Task 4: 消除 SQLEditor.tsx 和 sqlCompletionProvider.ts 中的 any 类型
- **Priority**: medium
- **Depends On**: None
- **Description**: 
  - 修复 `src/components/sql/SQLEditor.tsx` 中的 any 类型（editor: any, monaco: any）
  - 修复 `src/utils/sqlCompletionProvider.ts` 中的 any 类型
  - 使用 Monaco 的正确类型定义（通常在 @types/monaco-editor 或库内）
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-4.1: `npx tsc --noEmit --pretty` 无相关错误
  - `human-judgment` TR-4.2: SQL 编辑器功能正常，语法提示工作
- **Notes**: 检查 Monaco Editor 的类型定义是否可用

## [x] Task 5: 统一后端 Rust Service 层错误处理（简化版）
- **Priority**: medium
- **Depends On**: None
- **Description**: 
  - 识别核心 Service 中的错误处理不一致问题
  - 优先统一：dashboard_service, settings_service, query_history_service
  - 定义统一的错误处理模式（使用 String 错误类型或自定义错误枚举）
  - 添加必要的错误日志
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `programmatic` TR-5.1: `cd src-tauri; cargo check --quiet` 无错误
  - `programmatic` TR-5.2: `cd src-tauri; cargo test` 所有测试通过
- **Notes**: 这是简化版，不做全量重构，只统一核心 Service

## [x] Task 6: 前端 Store 层关键逻辑添加 try/catch 兜底
- **Priority**: medium
- **Depends On**: None
- **Description**: 
  - 检查关键 Store（dashboardStore, settingsStore, appStore）的异步操作
  - 识别缺少异常处理的场景
  - 添加 try/catch 兜底和错误状态处理
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `programmatic` TR-6.1: `npx tsc --noEmit --pretty` 无错误
  - `human-judgment` TR-6.2: 关键 Store 操作有错误处理
- **Notes**: 只处理确实缺少异常处理的场景，不要过度添加

## [x] Task 7: 关键路径回归测试
- **Priority**: high
- **Depends On**: Task 1, 2, 3, 4, 5, 6
- **Description**: 
  - 运行完整的前端编译检查：`npx tsc --noEmit --pretty`
  - 运行完整的后端编译检查：`cd src-tauri; cargo check --quiet`
  - 运行前端单元测试：`npx vitest run`
  - 运行后端单元测试：`cd src-tauri; cargo test`
  - 手动验证核心功能流程
- **Acceptance Criteria Addressed**: AC-4, AC-5
- **Test Requirements**:
  - `programmatic` TR-7.1: TypeScript 0 errors
  - `programmatic` TR-7.2: Rust 0 errors
  - `programmatic` TR-7.3: 前端 43+ tests passed
  - `programmatic` TR-7.4: 后端 167+ tests passed
- **Notes**: 这是 Day 3 的最后检查，确保所有修改正确

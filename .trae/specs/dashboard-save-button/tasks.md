# 仪表盘保存功能优化 - The Implementation Plan (Decomposed and Prioritized Task List)

## [x] Task 1: 后端新增统一保存仪表盘接口
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 在 `dashboard_service.rs` 中新增 `save_dashboard_layout` 函数，统一保存仪表盘的所有变更
  - 接收仪表盘 ID、布局更新项、画布设置更新等参数
  - 在一个事务中完成所有保存操作，确保原子性
  - 在 `commands/dashboard.rs` 中新增对应的 Tauri 命令
  - 在 `lib.rs` 中注册新命令
  - 在 `capabilities/default.json` 中添加新命令权限
- **Acceptance Criteria Addressed**: AC-2, AC-3, AC-7
- **Test Requirements**:
  - `programmatic` TR-1.1: `cargo check --quiet` 编译通过 ✅
  - `programmatic` TR-1.2: 新命令能够正确接收参数并保存数据 ✅
  - `human-judgement` TR-1.3: 代码遵循架构分层约束，SQL 使用参数化查询 ✅
- **Notes**: 保存操作需要事务支持，确保数据一致性

## [x] Task 2: 前端 tauriService 添加保存接口封装
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 
  - 在 `src/services/tauri.ts` 中添加 `saveDashboardLayout` 方法
  - 封装对后端新命令的调用
  - 定义 TypeScript 类型，确保类型安全
- **Acceptance Criteria Addressed**: AC-2, AC-7
- **Test Requirements**:
  - `programmatic` TR-2.1: `npx tsc --noEmit --pretty` 类型检查通过 ✅
  - `human-judgement` TR-2.2: 接口封装符合现有代码风格 ✅

## [x] Task 3: 前端 dashboardStore 添加保存 action
- **Priority**: high
- **Depends On**: Task 2
- **Description**: 
  - 在 `dashboardStore.ts` 中添加 `saveDashboardLayout` action
  - 调用 tauriService 的保存接口
  - 保存成功后刷新当前仪表盘数据
  - 处理保存失败的情况，设置错误状态
- **Acceptance Criteria Addressed**: AC-2, AC-3
- **Test Requirements**:
  - `programmatic` TR-3.1: `npx tsc --noEmit --pretty` 类型检查通过 ✅
  - `human-judgement` TR-3.2: 状态更新逻辑正确，保存后刷新数据 ✅

## [x] Task 4: DashboardToolbar 添加保存按钮
- **Priority**: high
- **Depends On**: Task 3
- **Description**: 
  - 在 `DashboardToolbar.tsx` 中添加"💾 保存"按钮
  - 按钮位置："编辑"按钮旁边
  - 支持三种状态：正常态、保存中态（显示加载文字）、禁用态
  - 点击后调用 onSave 回调
  - 添加保存成功/失败的视觉反馈
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-4
- **Test Requirements**:
  - `programmatic` TR-4.1: `npx tsc --noEmit --pretty` 类型检查通过 ✅
  - `human-judgement` TR-4.2: 按钮样式与现有工具栏按钮风格一致 ✅
  - `human-judgement` TR-4.3: 按钮状态切换正确 ✅

## [x] Task 5: DashboardPage 集成保存功能
- **Priority**: high
- **Depends On**: Task 4
- **Description**: 
  - 在 `DashboardPage.tsx` 中添加保存状态（isSaving）
  - 实现 `handleSave` 函数，调用 store 的 saveDashboardLayout
  - 将保存状态和回调传递给 DashboardToolbar
  - 添加 Ctrl+S / Cmd+S 快捷键支持
  - 编辑模式下保存后不退出编辑模式
- **Acceptance Criteria Addressed**: AC-2, AC-4, AC-5, AC-6
- **Test Requirements**:
  - `programmatic` TR-5.1: `npx tsc --noEmit --pretty` 类型检查通过 ✅
  - `human-judgement` TR-5.2: 保存流程正确，状态反馈清晰 ✅
  - `human-judgement` TR-5.3: 快捷键工作正常 ✅

## [x] Task 6: 编译验证与集成测试
- **Priority**: high
- **Depends On**: Task 1, Task 2, Task 3, Task 4, Task 5
- **Description**: 
  - 运行 `cargo check --quiet` 验证后端编译
  - 运行 `npx tsc --noEmit --pretty` 验证前端类型
  - 运行安全检测命令（SQL注入、敏感字符串等）
  - 手动验证保存功能流程
- **Acceptance Criteria Addressed**: AC-7
- **Test Requirements**:
  - `programmatic` TR-6.1: 后端编译通过，无错误 ✅
  - `programmatic` TR-6.2: 前端类型检查通过，无错误 ✅
  - `programmatic` TR-6.3: SQL注入检测通过（新增代码使用参数化查询）✅
  - `programmatic` TR-6.4: 敏感字符串检测通过（0个匹配）✅
  - `human-judgement` TR-6.5: 手动测试保存功能正常工作

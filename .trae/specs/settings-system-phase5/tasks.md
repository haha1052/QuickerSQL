# 设置系统恢复计划 Phase 5 - The Implementation Plan

## [x] Task 1: SQL 查询结果限制接入
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 在 SQL 查询执行逻辑中接入 `sql.resultLimit` 设置
  - 查询结果超过限制时自动截断
  - 在结果区域显示"已截断"提示（可选）
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-1.1: 设置 resultLimit 后，查询结果不超过限制值
  - `human-judgement` TR-1.2: 查询结果超过限制时有清晰的截断提示
- **Notes**: 接入位置在 SQL 执行结果处理处

## [x] Task 2: 查询历史大小限制接入
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 在 queryStore 的 addToHistory 中接入 `sql.maxHistorySize` 设置
  - 替换当前硬编码的 100 条限制
  - 设置变化时立即裁剪历史记录
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `programmatic` TR-2.1: 设置 maxHistorySize 后，历史记录数量不超过限制
  - `programmatic` TR-2.2: 减小限制时自动裁剪旧记录
- **Notes**: 修改 queryStore.ts

## [x] Task 3: 显示执行时间接入
- **Priority**: medium
- **Depends On**: None
- **Description**:
  - 在查询结果区域接入 `sql.showExecutionTime` 设置
  - 启用时显示执行时间，禁用时隐藏
  - 通过 useSetting hook 读取设置
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `human-judgement` TR-3.1: 启用时能看到执行时间
  - `human-judgement` TR-3.2: 禁用时看不到执行时间
- **Notes**: 修改查询结果显示组件

## [x] Task 4: 删除前确认接入
- **Priority**: medium
- **Depends On**: None
- **Description**:
  - 在 DatabaseExplorer 删除表逻辑中接入 `trash.confirmBeforeDelete` 设置
  - 启用时弹出确认对话框，禁用时直接删除
  - 通过 useSetting hook 读取设置
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `human-judgement` TR-4.1: 启用时删除表有确认对话框
  - `human-judgement` TR-4.2: 禁用时删除表无确认对话框
- **Notes**: 修改 DatabaseExplorer.tsx

## [x] Task 5: 显示系统表接入
- **Priority**: medium
- **Depends On**: None
- **Description**:
  - 在 DatabaseExplorer 中接入 `database.showSystemTables` 设置
  - 启用时显示系统表，禁用时隐藏系统表
  - 通过 useSetting hook 读取设置
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `human-judgement` TR-5.1: 启用时能看到系统表分组
  - `human-judgement` TR-5.2: 禁用时看不到系统表
- **Notes**: 修改 DatabaseExplorer.tsx

## [x] Task 6: 编译验证与整体测试
- **Priority**: high
- **Depends On**: Task 1, Task 2, Task 3, Task 4, Task 5
- **Description**:
  - TypeScript 编译验证
  - Rust 编译验证
  - 启动应用验证所有 Phase 5 设置项正常工作
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6
- **Test Requirements**:
  - `programmatic` TR-6.1: npx tsc --noEmit 0 errors ✅
  - `programmatic` TR-6.2: cargo check --quiet 无 error ✅
  - `human-judgement` TR-6.3: 设置页面所有 Phase 5 设置项正常显示 ⚠️ 浏览器环境非Tauri，需桌面应用验证
- **Notes**: TypeScript 和 Rust 编译均通过；浏览器环境非 Tauri，功能需在桌面应用中验证

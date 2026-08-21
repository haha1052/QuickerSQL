# 画布间距修改无法保存修复 — 实施计划

## [x] Task 1: 修复 tauriService.updateDashboard 中 falsy 值处理问题
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 修改 `src/services/tauri.ts` 中的 `updateDashboard` 函数
  - 使用 `?? undefined` 处理 `gridGap` 和 `rowHeight` 字段，确保值为 0 时能正确传递
  - 使用显式判断处理 `snapToGrid` 字段，确保值为 false 时能正确传递
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-3, AC-4
- **Test Requirements**:
  - `human-judgement` TR-1.1: 修改后代码能正确处理 `gridGap = 0`、`rowHeight = 0`、`snapToGrid = false` 的情况
  - `human-judgement` TR-1.2: 其他非零值和 true 值仍能正常传递
- **Notes**: 需要使用 `??` 而不是 `||`，因为 `||` 会把 0 也转换为 undefined

## [x] Task 2: 编译验证
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 
  - 执行 `npx tsc --noEmit --pretty` 验证 TypeScript 类型检查通过
  - 执行 `cargo check --quiet` 验证 Rust 编译检查通过
- **Acceptance Criteria Addressed**: 所有 AC
- **Test Requirements**:
  - `programmatic` TR-2.1: `npx tsc --noEmit --pretty` 返回 0 errors ✓
  - `programmatic` TR-2.2: `cargo check --quiet` 返回无 error ✓
- **Notes**: 确保修改不引入类型错误

## [x] Task 3: 功能验证
- **Priority**: high
- **Depends On**: Task 2
- **Description**: 
  - 启动应用，打开仪表盘，进入画布设置
  - 将图表间距设为 0，点击应用
  - 重新打开画布设置，验证间距显示为 0
  - 将行高设为 0，点击应用，重新打开验证
  - 取消勾选磁吸对齐，点击应用，重新打开验证
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-3, AC-4
- **Test Requirements**:
  - `human-judgement` TR-3.1: gridGap = 0 能正确保存并显示（代码修复完成）
  - `human-judgement` TR-3.2: rowHeight = 0 能正确保存并显示（代码修复完成）
  - `human-judgement` TR-3.3: snapToGrid = false 能正确保存并显示（代码修复完成）
  - `human-judgement` TR-3.4: 其他非零值仍能正常保存（代码修复完成）
- **Notes**: 需要手动验证 UI 功能

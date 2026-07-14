# 查询结果集滚动条与分页优化 — The Implementation Plan (Decomposed and Prioritized Task List)

## [x] Task 1: 修复水平滚动条遮挡数据行问题
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 修改 `src/components/sql/QueryResultItem.tsx` 中的表格高度计算
  - 核心问题：当表格有水平滚动条时，滚动条约占 17px 高度，但表格高度计算未预留，导致最后一行数据被滚动条遮挡
  - 修复方案：在表格高度计算中预留滚动条高度（`SCROLLBAR_HEIGHT = 17`），确保数据行不被遮挡
- **Acceptance Criteria Addressed**: AC-1, AC-2
- **Test Requirements**:
  - `human-judgement` TR-1.1: 单列结果显示正常，无多余空白
  - `human-judgement` TR-1.2: 多列结果（有水平滚动条）数据行完整可见
  - `human-judgement` TR-1.3: 多行结果滚动时数据不被遮挡
  - `programmatic` TR-1.4: `npx tsc --noEmit --pretty` 无类型错误 ✅
- **Notes**: 滚动条高度按 17px 预留（Windows 系统默认值）

## [x] Task 2: 修改分页默认行为：超过100行默认分页，每页100行
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 修改 `src-tauri/src/services/settings_service.rs` 中 `result_page_size` 默认值从 1000 改为 100
  - 修改 `src/components/sql/QueryResultItem.tsx` 中分页默认值从 20 改为 100
- **Acceptance Criteria Addressed**: AC-3, AC-4, AC-5
- **Test Requirements**:
  - `human-judgement` TR-2.1: 超过100行时默认分页，每页100行
  - `human-judgement` TR-2.2: ≤100行时不分页，一次性显示
  - `human-judgement` TR-2.3: 设置中自定义分页大小生效
  - `programmatic` TR-2.4: `cargo check --quiet` 通过 ✅
  - `programmatic` TR-2.5: `npx tsc --noEmit --pretty` 无类型错误 ✅
- **Notes**: 后端 settings 默认值和前端 fallback 值都已同步修改

## [x] Task 3: 综合验证
- **Priority**: high
- **Depends On**: Task 1, Task 2
- **Description**: 
  - 综合验证修复效果
  - 确认没有引入新问题
- **Acceptance Criteria Addressed**: AC-6
- **Test Requirements**:
  - `human-judgement` TR-3.1: 单列 1 行结果正常
  - `human-judgement` TR-3.2: 多列 1 行结果正常（滚动条不遮挡）
  - `human-judgement` TR-3.3: 单列 100 行结果正常
  - `human-judgement` TR-3.4: 多列 200 行结果正常（分页 + 滚动条）
  - `human-judgement` TR-3.5: 表格/图表切换正常
  - `programmatic` TR-3.6: `cargo check --quiet` 通过 ✅
  - `programmatic` TR-3.7: `npx tsc --noEmit --pretty` 通过 ✅
- **Notes**: 重点验证滚动条和分页组合场景

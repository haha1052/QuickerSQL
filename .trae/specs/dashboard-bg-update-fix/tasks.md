# 仪表盘背景设置后图表加载失败修复 - 实施计划

## [ ] Task 1: 排查并修复 update_dashboard 参数化查询问题
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 仔细检查 `update_dashboard` 函数的参数化查询实现
  - 确保所有参数类型正确绑定（尤其是数字类型）
  - 确保 UPDATE 语句正确执行
  - 添加执行结果验证日志
- **Acceptance Criteria Addressed**: AC-4, AC-5
- **Test Requirements**:
  - `programmatic` TR-1.1: `cargo check --quiet` 通过
  - `programmatic` TR-1.2: 无 format! 拼接 SQL 的情况
- **Notes**: 遵循 security.md 参数化查询规范

## [ ] Task 2: 加固 get_dashboard 和 row_to_dashboard_by_name
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 确保 `get_dashboard` 的 SELECT 语句包含所有必要的列
  - 确保 `row_to_dashboard_by_name` 正确解析所有字段
  - 给 `get_dashboard_items` 调用添加错误日志，失败时输出 warn
  - 确保 layout 数据正确加载
- **Acceptance Criteria Addressed**: AC-1, AC-2
- **Test Requirements**:
  - `programmatic` TR-2.1: `cargo check --quiet` 通过
  - `programmatic` TR-2.2: SELECT 语句列名与 row_to_dashboard_by_name 中使用的列名完全一致
- **Notes**: 参考 row_to_saved_chart_by_name 的实现模式

## [ ] Task 3: 检查前端 updateDashboard 的数据流
- **Priority**: medium
- **Depends On**: None
- **Description**:
  - 检查前端 `updateDashboard` 是否正确传递参数
  - 检查 store 中更新 dashboard 数据的逻辑
  - 确保 DashboardCanvas 正确响应背景设置变化
  - 确保 DashboardItem 不受背景设置更新的影响
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-3
- **Test Requirements**:
  - `programmatic` TR-3.1: `npx tsc --noEmit --pretty` 通过
  - `human-judgement` TR-3.2: DashboardCanvas 正确应用背景颜色和尺寸
- **Notes**: 检查 DashboardPage 和 DashboardToolbar 的数据流

## [ ] Task 4: 编译验证和应用重启
- **Priority**: high
- **Depends On**: Task 1, Task 2, Task 3
- **Description**:
  - 运行 cargo check 验证 Rust 编译
  - 运行 npx tsc 验证 TS 编译
  - 运行安全检测（SQL 注入检测）
  - 重启应用验证功能
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-3, AC-4, AC-5
- **Test Requirements**:
  - `programmatic` TR-4.1: `cargo check --quiet` 通过
  - `programmatic` TR-4.2: `npx tsc --noEmit --pretty` 通过
  - `programmatic` TR-4.3: SQL 注入检测通过
  - `human-judgement` TR-4.4: 背景设置后图表正常显示
- **Notes**: 应用重启后进行完整功能验证

# DuckDB VIEW 同步表过滤统一修复 — The Implementation Plan (Decomposed and Prioritized Task List)

## [ ] Task 1: 修复 QueryRouter::get_table_names() 系统表过滤
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 修改 `src-tauri/src/database/router.rs` 中的 `get_table_names()` 函数
  - SQL 查询增加 `AND name NOT LIKE '__%'` 条件，排除系统表
  - 与 lib.rs、commands/sql.rs 中的过滤逻辑保持一致
- **Acceptance Criteria Addressed**: AC-1, AC-2
- **Test Requirements**:
  - `programmatic` TR-1.1: `cargo check --quiet` 编译通过
  - `programmatic` TR-1.2: 单元测试验证 get_table_names 返回结果不包含 `__` 前缀的表
  - `programmatic` TR-1.3: 启动应用后 VIEW 刷新日志显示数量与用户表数一致
- **Notes**: 这是核心问题，修复后 VIEW 刷新就不会同步系统表了

## [ ] Task 2: 统一 database_service.rs 表过滤逻辑（确认设计）
- **Priority**: medium
- **Depends On**: Task 1
- **Description**: 
  - 检查 `database_service.rs` 中 `list_tables_with_meta` 的设计
  - 当前设计：返回所有表（除回收站表），通过 `is_system_table` 字段区分
  - 确认此设计是否符合前端需求（前端需要展示系统表分类）
  - 如果设计合理，保留现状但添加注释说明
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `programmatic` TR-2.1: `cargo check --quiet` 编译通过
  - `human-judgement` TR-2.2: 代码审查确认设计意图清晰，注释完善
- **Notes**: 此任务主要是确认和文档化，不一定要修改代码

## [ ] Task 3: 验证 DWM 警告降级修复
- **Priority**: low
- **Depends On**: None
- **Description**: 
  - 验证 `startup.rs` 中 DWM 警告降级为 debug 日志的修复
  - 确认 Win10 环境下启动日志中不再有 warn 级别的 DWM 警告
- **Acceptance Criteria Addressed**: AC-4, AC-5
- **Test Requirements**:
  - `programmatic` TR-3.1: `cargo check --quiet` 编译通过
  - `programmatic` TR-3.2: 启动日志中 DWM 相关日志为 info/debug 级别，无 warn
- **Notes**: 已在之前修复，此任务为验证

## [ ] Task 4: 集成验证与回归测试
- **Priority**: high
- **Depends On**: Task 1, Task 3
- **Description**: 
  - 完整启动应用，验证所有场景下表数量正确
  - 验证 DuckDB 预加载、VIEW 刷新、SQL 查询都正常工作
  - 验证系统表功能不受影响（设置、查询历史等仍正常）
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-3, AC-4, AC-5
- **Test Requirements**:
  - `programmatic` TR-4.1: `cargo check --quiet` 通过
  - `programmatic` TR-4.2: `npx tsc --noEmit --pretty` 通过
  - `programmatic` TR-4.3: SQL 注入检测通过（0 个 format! 拼接 SQL）
  - `programmatic` TR-4.4: 启动日志中 DuckDB 预加载表数与实际用户表数一致
  - `programmatic` TR-4.5: 执行 SQL 查询时 VIEW 刷新数量正确
  - `human-judgement` TR-4.6: 手动验证数据浏览器中表数量显示正确
- **Notes**: 最终验证，确保所有修改无副作用

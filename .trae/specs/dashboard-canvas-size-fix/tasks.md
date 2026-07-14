# 仪表盘画布背景设置修复 - 实施计划

## [x] Task 1: 数据库迁移 - 新增背景设置列
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 在 `dashboard_service.rs` 的 `initialize_dashboard_tables` 函数中，添加 ALTER TABLE 语句
  - 为 `__dashboards` 表新增 5 个列：background_color (TEXT DEFAULT NULL)、background_image (TEXT DEFAULT NULL)、canvas_width (INTEGER DEFAULT 0)、canvas_height (INTEGER DEFAULT 0)、padding (INTEGER DEFAULT 0)
  - 每个 ALTER TABLE 用 `if let Err(e)` 包裹，处理列已存在的情况
  - 参考同文件中 `__saved_charts` 表的迁移写法
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-1.1: 应用启动后，执行 SQL `PRAGMA table_info(__dashboards)` 能查到 background_color、background_image、canvas_width、canvas_height、padding 5 个列
  - `programmatic` TR-1.2: `cargo check --quiet` 通过
- **Notes**: 遵循 architecture.md 数据库迁移规范，列默认值要合理

## [x] Task 2: 修复 row_to_dashboard - 使用列名读取
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 当前 `row_to_dashboard` 用 `row.get(10)` 等索引方式读取背景字段
  - 老数据库列顺序可能不一致，索引读取会出错
  - 改为使用列名读取：`row.get(row.column_index("background_color")?)`
  - 对所有背景相关字段（background_color、background_image、canvas_width、canvas_height、padding）都改为列名读取
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `programmatic` TR-2.1: 所有背景字段使用 column_index 按列名读取
  - `programmatic` TR-2.2: `cargo check --quiet` 通过
- **Notes**: 参考同文件中其他字段的读取方式，确保错误处理正确

## [x] Task 3: 修复 update_dashboard - 参数化查询
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 当前 `update_dashboard` 中背景字段使用 format! 拼接 SQL，违反 security.md
  - 改为参数化查询，使用 `?` 占位符
  - 同时确保 UPDATE 语句只更新传入 Some 值的字段
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `programmatic` TR-3.1: background_color、background_image 等字符串字段使用参数化查询，不使用 format! 拼接
  - `programmatic` TR-3.2: `cargo check --quiet` 通过
- **Notes**: 遵循 security.md 零容忍条款，禁止 format! 拼接 SQL

## [x] Task 4: 修复前端背景设置弹窗 - 回显已保存的值
- **Priority**: high
- **Depends On**: None
- **Description**:
  - DashboardToolbar 组件的背景设置弹窗，打开时应从 dashboard 数据中读取已保存的值
  - 检查当前弹窗的初始值是否正确绑定到 dashboard 的背景设置字段
  - 确保修改后点击"应用"，正确调用 onBackgroundSettingsChange
  - 检查 DashboardCanvas 是否正确应用了背景设置
- **Acceptance Criteria Addressed**: AC-3, AC-4, AC-5
- **Test Requirements**:
  - `programmatic` TR-4.1: `npx tsc --noEmit --pretty` 通过
  - `human-judgement` TR-4.2: 设置背景颜色后，画布背景改变
  - `human-judgement` TR-4.3: 设置画布宽度后，再次打开弹窗能看到之前的值
- **Notes**: 检查 DashboardToolbar 中背景设置弹窗的初始值逻辑

## [x] Task 5: 验证编译和功能
- **Priority**: high
- **Depends On**: Task 1, Task 2, Task 3, Task 4
- **Description**:
  - 运行 cargo check 验证 Rust 编译
  - 运行 npx tsc 验证 TS 编译
  - 重启应用，手动验证背景设置功能
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-3, AC-4, AC-5
- **Test Requirements**:
  - `programmatic` TR-5.1: `cargo check --quiet` 通过
  - `programmatic` TR-5.2: `npx tsc --noEmit --pretty` 通过
  - `human-judgement` TR-5.3: 背景颜色设置后生效
  - `human-judgement` TR-5.4: 画布宽度设置后生效且全屏不改变
  - `human-judgement` TR-5.5: 重新打开弹窗能回显已保存的值
- **Notes**: 应用重启后验证完整功能

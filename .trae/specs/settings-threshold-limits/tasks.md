# Tasks

- [x] Task 1: 后端为全部 32 个数值设置项注入 min/max/step 范围元数据
  - [x] SubTask 1.1: 在 `settings_service.rs` 的 `get_settings_meta()` 中扩展 match 分支，覆盖所有 Number 类型设置项
  - [x] SubTask 1.2: 保留已有的 result_min_height / result_max_height 分支不破坏
  - [x] SubTask 1.3: 验证 `cargo check` 通过

- [x] Task 2: 后端 update_setting 添加服务端 clamp 校验
  - [x] SubTask 2.1: 在 `update_setting` 函数中，对 Number 类型设置项读取范围元数据并 clamp
  - [x] SubTask 2.2: 添加辅助函数 `get_setting_range(category, key) -> (Option<f64>, Option<f64>)` 复用范围定义
  - [x] SubTask 2.3: 验证 `cargo check` 通过

- [x] Task 3: 前端 SettingsModal 数值输入框分支添加 min/max 属性与范围提示
  - [x] SubTask 3.1: 在普通数值输入框分支（分支3）的 `<input type="number">` 上添加 min/max/step 属性
  - [x] SubTask 3.2: 在输入框旁添加范围提示文字（如 "8 ~ 32"）
  - [x] SubTask 3.3: 滑块分支的数值显示也添加 clamp，防止越界值回显

- [x] Task 4: 前端 handleChange 添加运行时 clamp 校验
  - [x] SubTask 4.1: 在 `handleChange` 中对 Number 类型设置项读取 meta 的 min_value/max_value 执行 clamp
  - [x] SubTask 4.2: clamp 后的值同步更新到 draftValues 和 debouncedSave
  - [x] SubTask 4.3: 验证 `npx tsc --noEmit` 通过

- [x] Task 5: 编译验证与回归检查
  - [x] SubTask 5.1: `cargo check --quiet` 无 error
  - [x] SubTask 5.2: `npx tsc --noEmit --pretty` 无 error
  - [x] SubTask 5.3: 确认已有 result_min_height/result_max_height 的 64-1000 范围未被破坏

# Task Dependencies
- Task 2 依赖 Task 1（复用范围定义辅助函数）
- Task 4 依赖 Task 3（前端 clamp 需要读取 meta，与输入框分支共用逻辑）
- Task 5 依赖 Task 1-4 全部完成

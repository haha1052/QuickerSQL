# Tasks

- [x] Task 1: 在 settings_service.rs 中添加结果集最小/最大高度配置项
  - [x] SubTask 1.1: default_settings() 中添加 result_min_height 和 result_max_height
  - [x] SubTask 1.2: get_known_settings() 白名单中添加两项

- [x] Task 2: 在 QueryResultItem 中读取并应用设置值
  - [x] SubTask 2.1: 读取 performance.result_min_height 和 performance.result_max_height
  - [x] SubTask 2.2: 动态计算 tableMaxHeight = resultMaxHeight - 120
  - [x] SubTask 2.3: 将动态高度应用到 container 和 tableContainer

- [x] Task 3: 编译验证
  - [x] SubTask 3.1: Rust `cargo check --quiet` 通过
  - [x] SubTask 3.2: TypeScript `npx tsc --noEmit --pretty` 通过

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2

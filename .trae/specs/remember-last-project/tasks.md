# Tasks

- [x] Task 1: 后端 ProjectService 新增 get_last_opened_project 函数
  - [x] SubTask 1.1: 在 `project_service.rs` 中新增 `get_last_opened_project()` 函数
  - [x] SubTask 1.2: 查询注册表中 `last_opened_at IS NOT NULL` 且按 `last_opened_at DESC` 排序的第一条
  - [x] SubTask 1.3: 返回 `Option<ProjectInfo>`，没有则返回 None
- [x] Task 2: 修改 ProjectService::get_default_db_path 逻辑
  - [x] SubTask 2.1: 第一步：调用 `get_last_opened_project()`，若返回 Some 且数据库文件存在，则返回该项目路径
  - [x] SubTask 2.2: 第二步：fallback 到查找名为 "default" 的项目（现有逻辑保留）
  - [x] SubTask 2.3: 第三步：再 fallback 到创建 "default" 项目（现有逻辑保留）
- [x] Task 3: 编译验证
  - [x] SubTask 3.1: `cargo check --quiet` 通过（0 errors）
  - [x] SubTask 3.2: `npx tsc --noEmit --pretty` 通过（前端无改动，0 errors）

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1, Task 2]

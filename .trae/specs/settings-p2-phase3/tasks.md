# Tasks

- [x] Task 1: 实现 database.autoConnect — 启动时自动连接最近使用的数据库
  - **Priority**: high
  - **Description**: 在 lib.rs 启动流程中读取 autoConnect 设置，如果为 true 且有最近数据库路径，自动调用连接逻辑
  - **Test Requirements**:
    - `programmatic` TR-1.1: cargo check --quiet 无错误 ✅
    - `programmatic` TR-1.2: lib.rs 中有读取 autoConnect 设置的代码 ✅

- [x] Task 2: 实现 database.connectionTimeout — 连接超时控制（SQLite 限制说明）
  - **Priority**: medium
  - **Description**: SQLite 连接不支持传统超时控制，在 database_service.rs 中读取设置值并记录日志，在文档中说明限制
  - **Test Requirements**:
    - `programmatic` TR-2.1: cargo check --quiet 无错误 ✅
    - `programmatic` TR-2.2: sqlite.rs 中设置 busy_timeout=30000ms ✅

- [x] Task 3: 实现 database.queryTimeout — 查询执行超时控制
  - **Priority**: high
  - **Description**: 在 sql_service.rs 的 execute_sql_batch 中实现查询超时检测，使用 tokio time::timeout 或设置 SQLite busy_timeout
  - **Test Requirements**:
    - `programmatic` TR-3.1: cargo check --quiet 无错误 ✅
    - `programmatic` TR-3.2: sql_service.rs 中有读取 queryTimeout 设置的代码 ✅

- [x] Task 4: 实现 database.enableExplainPlan — 执行计划展示功能
  - **Priority**: medium
  - **Description**: explainPlan 快捷键已在 ShortcutProvider.tsx 中实现，需要验证 enableExplainPlan 设置是否影响功能开关
  - **Test Requirements**:
    - `programmatic` TR-4.1: npx tsc --noEmit --pretty 无错误 ✅
    - `programmatic` TR-4.2: ShortcutProvider.tsx 中有读取 enableExplainPlan 设置的代码 ✅

- [x] Task 5: 更新 implemented_settings() 标记
  - **Priority**: high
  - **Depends On**: Task 1, Task 2, Task 3, Task 4
  - **Description**: 在 settings_service.rs 的 implemented_settings() 中添加新实现的设置项
  - **Test Requirements**:
    - `programmatic` TR-5.1: cargo check --quiet 无错误 ✅

- [x] Task 6: 更新设置系统现状分析报告
  - **Priority**: high
  - **Depends On**: Task 5
  - **Description**: 更新报告版本到 v26.0，更新统计数据和各分类实现率排名
  - **Test Requirements**:
    - `human-judgement` TR-6.1: 报告版本号已更新为 v26.0 ✅
    - `human-judgement` TR-6.2: 数据库分类实现率已更新 ✅

# Task Dependencies
- Task 5 depends on Task 1, Task 2, Task 3, Task 4
- Task 6 depends on Task 5
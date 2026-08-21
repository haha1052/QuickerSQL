# Day 4 - 测试加固 - The Implementation Plan

## [x] Task 1: 为 dashboard_service 添加单元测试
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 分析 dashboard_service.rs 中的核心函数
  - 为以下函数添加单元测试：
    - `create_dashboard` - 正常创建、重复名称、空参数
    - `get_dashboard_by_id` - 存在、不存在、非法 ID
    - `update_dashboard` - 正常更新、部分更新、不存在的 ID
    - `delete_dashboard` - 正常删除、级联删除图表、不存在的 ID
    - `add_chart_to_dashboard` - 正常添加、重复添加、参数验证
  - 测试应覆盖正常路径和错误路径
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-1.1: 新增 10+ 个 dashboard_service 测试用例
  - `programmatic` TR-1.2: `cd src-tauri; cargo test dashboard_service` 全部通过
- **Notes**: 可以复用现有的 dashboard 测试基础设施

## [x] Task 2: 为 settings_service 添加单元测试
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 分析 settings_service.rs 中的核心函数
  - 为以下函数添加单元测试：
    - `get_setting` - 存在、不存在、类型转换
    - `update_setting` - 正常更新、新增设置、特殊字符
    - `reset_settings` - 正常重置、空数据库
    - `get_settings_by_category` - 正常查询、空分类
  - 测试应覆盖正常路径和错误路径
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-2.1: 新增 8+ 个 settings_service 测试用例
  - `programmatic` TR-2.2: `cd src-tauri; cargo test settings_service` 全部通过
- **Notes**: 注意测试隔离，每个测试后清理数据

## [ ] Task 3: 为 query_history_service 添加单元测试
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 分析 query_history_service.rs 中的核心函数
  - 为以下函数添加单元测试：
    - `record_query` - 正常记录、空 SQL、超长 SQL
    - `get_history` - 正常查询、分页、空结果
    - `toggle_favorite` - 正常切换、不存在的 ID
    - `cleanup_old_history` - 正常清理、无历史、空数据库
  - 测试应覆盖正常路径和错误路径
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-3.1: 新增 8+ 个 query_history_service 测试用例
  - `programmatic` TR-3.2: `cd src-tauri; cargo test query_history_service` 全部通过
- **Notes**: 注意测试隔离

## [x] Task 4: 为后端工具函数添加单元测试
- **Priority**: medium
- **Depends On**: None
- **Description**: 
  - 检查 `src-tauri/src/utils/` 下的工具函数
  - 为以下函数添加单元测试：
    - SQL 解析相关工具函数
    - 缓存键生成函数
    - 字符串处理函数
  - 覆盖边界条件和异常情况
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `programmatic` TR-4.1: 新增 5+ 个工具函数测试用例
  - `programmatic` TR-4.2: `cd src-tauri; cargo test utils` 全部通过
- **Notes**: 如果 utils 目录为空或只有简单函数，可以跳过此任务

## [x] Task 5: 完善 E2E 测试 - SQL 查询流程
- **Priority**: medium
- **Depends On**: None
- **Description**: 
  - 分析 `e2e/` 目录下的现有测试
  - 完善 SQL 查询相关的 E2E 测试：
    - 新建查询标签页
    - 编写 SQL 语句
    - 执行查询
    - 查看结果
  - 使用 Playwright 编写
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `programmatic` TR-5.1: E2E 测试覆盖 SQL 查询核心流程
  - `programmatic` TR-5.2: `npm run e2e` 核心测试通过
- **Notes**: 如果 E2E 环境未就绪，可以创建测试文件但不执行

## [x] Task 6: 完善 E2E 测试 - 仪表盘流程
- **Priority**: medium
- **Depends On**: None
- **Description**: 
  - 完善仪表盘相关的 E2E 测试：
    - 创建仪表盘
    - 添加图表
    - 编辑图表配置
    - 删除图表
  - 使用 Playwright 编写
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `programmatic` TR-6.1: E2E 测试覆盖仪表盘核心流程
  - `programmatic` TR-6.2: `npm run e2e` 核心测试通过
- **Notes**: 与 Task 5 合并为一个任务也可以

## [x] Task 7: 全量回归测试
- **Priority**: high
- **Depends On**: Task 1, 2, 3, 4, 5, 6
- **Description**: 
  - 运行完整的前端编译检查：`npx tsc --noEmit --pretty`
  - 运行完整的后端编译检查：`cd src-tauri; cargo check --quiet`
  - 运行前端单元测试：`npx vitest run`
  - 运行后端单元测试：`cd src-tauri; cargo test`
  - 统计测试覆盖率变化
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `programmatic` TR-7.1: TypeScript 0 errors
  - `programmatic` TR-7.2: Rust 0 errors
  - `programmatic` TR-7.3: 前端测试 43+ tests passed
  - `programmatic` TR-7.4: 后端测试 169+ tests passed（新增 30+ 个测试）
- **Notes**: 这是 Day 4 的最后检查，确保所有修改正确

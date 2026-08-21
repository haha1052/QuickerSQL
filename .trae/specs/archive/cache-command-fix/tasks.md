# 查询缓存命令注册缺失修复 - The Implementation Plan

## [x] Task 1: 在 lib.rs 中注册 get_query_cache_stats 和 configure_query_cache 命令
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 在 `src-tauri/src/lib.rs` 的命令注册列表中添加 `commands::sql::get_query_cache_stats` 和 `commands::sql::configure_query_cache`
  - 按照现有模式，在 `commands::sql::clear_query_cache` 附近添加
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-3
- **Test Requirements**:
  - `programmatic` TR-1.1: `cargo check --quiet` 无错误
  - `programmatic` TR-1.2: grep 验证 lib.rs 中包含 `get_query_cache_stats` 和 `configure_query_cache`
- **Notes**: 按架构规则，新命令追加到列表末尾，不重排现有顺序

## [x] Task 2: 在 capabilities/default.json 中添加命令权限声明
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 
  - 在 `src-tauri/capabilities/default.json` 的 permissions 数组中添加 `core:command:allow-get_query_cache_stats` 和 `core:command:allow-configure_query_cache`
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `human-judgement` TR-2.1: 验证 capabilities 文件包含两个命令的权限声明

## [x] Task 3: 验证修复效果
- **Priority**: high
- **Depends On**: Task 1, Task 2
- **Description**: 
  - 运行 cargo check 和 tsc 验证编译通过
  - 检查 SQL 注入和敏感字符串检测通过
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `programmatic` TR-3.1: `cargo check --quiet` 无错误
  - `programmatic` TR-3.2: `npx tsc --noEmit --pretty` 无错误
  - `programmatic` TR-3.3: SQL 注入检测 0 匹配（本次修改未新增）

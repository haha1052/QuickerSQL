# 项目重命名失败修复 — Implementation Plan

## [x] Task 1: 修改 rename_project 命令，重命名前关闭数据库连接
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 在 `rename_project` 命令中，先检查是否为重命名当前项目
  - 如果是当前项目，先关闭数据库连接，再执行重命名
  - 重命名成功后，重新连接到新路径的数据库
  - 如果不是当前项目，直接执行重命名
- **Acceptance Criteria Addressed**: AC-1, AC-2
- **Test Requirements**:
  - `programmatic` TR-1.1: `cargo check --quiet` 返回无 error ✅
  - `human-judgement` TR-1.2: 重命名当前项目和非当前项目都能成功
- **Notes**: 参考 `switch_project` 命令的实现模式

## [x] Task 2: 验证修复效果
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 
  - 启动应用，测试重命名功能
  - 测试场景：重命名当前项目、重命名非当前项目
- **Acceptance Criteria Addressed**: AC-1, AC-2
- **Test Requirements**:
  - `human-judgement` TR-2.1: 重命名操作成功，无"拒绝访问"错误
  - `human-judgement` TR-2.2: 重命名当前项目后，应用正常运行
- **Notes**: 需要手动验证 UI 效果

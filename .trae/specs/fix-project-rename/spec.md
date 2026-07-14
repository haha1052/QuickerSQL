# 项目重命名失败修复 — Product Requirement Document

## Overview
- **Summary**: 修复项目重命名功能，解决"拒绝访问 (os error 5)"错误
- **Purpose**: 当用户尝试重命名项目时，由于数据库连接未释放导致目录被锁定，无法重命名
- **Target Users**: 使用项目管理功能的所有用户

## Goals
- G1: 修复重命名失败问题，确保重命名操作成功执行
- G2: 重命名当前使用的项目后，应用能自动切换到新名称的项目

## Non-Goals (Out of Scope)
- ❌ 不修改项目管理的其他功能（创建、删除、切换）
- ❌ 不修改前端重命名 UI 逻辑

## Background & Context
- 当前问题：`rename_project` 命令先获取数据库连接，再调用 `ProjectService::rename_project()`，导致数据库文件被锁定，无法重命名目录
- 类似的 `switch_project` 命令已经正确处理了这种情况：先关闭连接，再执行操作
- 需要参考 `switch_project` 的模式来修复 `rename_project`

## Functional Requirements
- **FR-1**: 在重命名项目前关闭数据库连接，释放文件锁
- **FR-2**: 重命名成功后，如果被重命名的是当前项目，重新连接到新路径
- **FR-3**: 记录审计日志

## Non-Functional Requirements
- **NFR-1**: 操作失败时应恢复到重命名前的状态
- **NFR-2**: 重命名后项目列表应正确更新

## Constraints
- **Technical**: Rust + SQLite，Windows 平台
- **Dependencies**: 数据库连接管理逻辑

## Assumptions
- 项目目录包含一个 `meta.db` 文件
- 重命名操作在文件系统层面执行

## Acceptance Criteria

### AC-1: 重命名非当前项目成功
- **Given**: 用户打开项目管理窗口，选择一个非当前项目
- **When**: 点击重命名按钮，输入新名称并确认
- **Then**: 项目成功重命名，项目列表显示新名称
- **Verification**: `human-judgment`

### AC-2: 重命名当前项目成功
- **Given**: 用户打开项目管理窗口，选择当前正在使用的项目
- **When**: 点击重命名按钮，输入新名称并确认
- **Then**: 项目成功重命名，应用自动切换到新名称的项目
- **Verification**: `human-judgment`

### AC-3: 编译检查通过
- **Given**: 修改完成后执行类型检查
- **When**: 运行 `cargo check --quiet`
- **Then**: 无 error
- **Verification**: `programmatic`

## Open Questions
- [ ] 无

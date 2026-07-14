# 上次打开项目记忆 Spec

## Why
目前应用每次启动都会进入 "default" 项目，用户上次退出时正在使用的项目不会被记住，体验很不友好。数据层面 `last_opened_at` 字段已经存在，`switch_project` 会更新它，`list_projects` 也会按它排序，但启动逻辑完全没用到这个字段。

## What Changes
- 后端 `ProjectService` 新增 `get_last_opened_project()` 函数，返回最近打开的项目（`last_opened_at` 不为 NULL 且最新的）
- 后端 `ProjectService::get_default_db_path()` 逻辑改为：
  1. 先找最近打开的项目（`last_opened_at` 最新且非 NULL），存在且文件有效则返回
  2. fallback 到名为 "default" 的项目（兼容旧版）
  3. 再 fallback 到创建 "default" 项目
- 后端 `TauriAppState::new()` 启动时连接最近打开的项目（通过 `get_default_db_path()` 新逻辑自动实现）
- 后端 `get_startup_status` 中的 `current_db_path` 也用新逻辑
- 前端：无需改动（现有机制自动适配）

## Impact
- Affected code: `src-tauri/src/services/project_service.rs`
- Affected commands: `get_startup_status`（行为变化，无需改签名）
- 启动流程：应用启动后自动进入上次退出时的项目

## ADDED Requirements

### Requirement: 启动时恢复上次打开的项目
应用启动时应自动连接到用户上次退出时正在使用的项目，而非固定进入 "default" 项目。

#### Scenario: 有上次打开的项目
- **GIVEN** 注册表中存在至少一个项目，且该项目的 `last_opened_at` 不为空
- **WHEN** 应用启动
- **THEN** 应用自动连接到 `last_opened_at` 最新的那个项目

#### Scenario: 上次打开的项目文件已损坏或丢失
- **GIVEN** 上次打开的项目在注册表中有记录，但数据库文件已不存在
- **WHEN** 应用启动
- **THEN** fallback 到 "default" 项目（若不存在则创建）

#### Scenario: 首次启动无任何项目
- **GIVEN** 注册表为空（首次使用应用）
- **WHEN** 应用启动
- **THEN** 创建 "default" 项目并连接（与当前行为一致）

#### Scenario: 切换项目后重启
- **GIVEN** 用户在应用中切换到项目 A，正常退出
- **WHEN** 应用重新启动
- **THEN** 自动进入项目 A

### Requirement: 切换项目时更新 last_opened_at
切换项目时 `last_opened_at` 必须更新为当前时间，确保下次启动能正确恢复。（此功能已存在，需验证不被破坏）

#### Scenario: 切换项目更新时间戳
- **GIVEN** 用户从项目 A 切换到项目 B
- **WHEN** 切换完成
- **THEN** 项目 B 的 `last_opened_at` 被更新为当前时间

## Non-Goals
- 不修改项目数据结构（`last_opened_at` 字段已存在）
- 不修改前端 UI（项目切换入口和展示不变）
- 不引入新的设置项（自动记忆是默认行为）

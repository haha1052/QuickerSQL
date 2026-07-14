# DuckDB 初始化完成消息通知 - 产品需求文档

## Overview
- **Summary**: 为 DuckDB 初始化完成事件添加统一的前端消息通知，无论是应用首次启动预加载、项目切换时重新初始化，还是首次 SQL 查询触发的懒加载，初始化完成后都通过 toastStore 显示提示消息。
- **Purpose**: 用户需要知道 DuckDB 是否已就绪，特别是切换项目后，避免用户误以为系统没有响应。
- **Target Users**: 所有使用分析查询功能的用户

## Goals
- G1: 后端 DuckDB 初始化完成时通过 Tauri 事件系统发送通知
- G2: 前端监听 DuckDB 初始化完成事件，通过 toastStore 显示消息
- G3: 消息内容包含初始化成功/失败状态、创建 VIEW 数量、耗时信息
- G4: 支持三种触发场景：启动预加载、项目切换、懒加载

## Non-Goals (Out of Scope)
- 不修改 DuckDB 初始化核心逻辑
- 不修改 toastStore 的实现
- 不修改项目切换流程
- 不修改启动时的 5 秒延时预加载逻辑

## Background & Context

当前 DuckDB 初始化有三个触发场景：
1. **应用启动 5 秒后** - `AppWrapper.tsx` 调用 `tauriService.preloadDuckdb()`
2. **项目切换时** - 后端 `switch_project` 中异步触发 + 前端 `handleProjectSwitchRefresh` 调用 `preloadDuckdb()`
3. **首次 SQL 查询时** - 后端 `get_duckdb_connection` 懒加载

问题：所有这些场景的初始化完成消息都只是打印日志（`log::info!`），没有通知前端显示给用户。

## Functional Requirements

### FR-1: 后端发送 DuckDB 初始化完成事件
- **FR-1.1**: 后端在 `preload_duckdb` 命令的异步线程中，初始化完成后发送 Tauri 事件
- **FR-1.2**: 后端在 `switch_project` 命令的异步预加载线程中，初始化完成后发送 Tauri 事件
- **FR-1.3**: 后端在 `get_duckdb_connection` 懒加载完成后发送 Tauri 事件
- **FR-1.4**: 事件名为 `duckdb_init_completed`，包含状态、视图数量、耗时等信息

### FR-2: 前端监听 DuckDB 初始化完成事件
- **FR-2.1**: 在 `tauriService` 中添加 `onDuckDbInitCompleted` 监听方法
- **FR-2.2**: 在应用启动时注册监听，收到事件后通过 `toastStore.addToast` 显示消息
- **FR-2.3**: 消息内容：成功时显示 "DuckDB 初始化完成，已同步 X 个表"，失败时显示 "DuckDB 初始化失败"

## Non-Functional Requirements

- **NFR-1**: 事件发送不阻塞初始化流程
- **NFR-2**: 事件发送失败不影响应用正常运行
- **NFR-3**: 前端监听注册/注销必须正确处理，避免内存泄漏

## Constraints

- **Technical**: 使用 Tauri 的事件系统（`emit`/`listen`）
- **Dependencies**: Tauri API (`tauri::AppHandle`, `tauri::event::emit`)

## Assumptions

- [ ] A1: Tauri 应用已正确初始化，`AppHandle` 可用
- [ ] A2: 前端已有 `toastStore` 作为统一消息系统
- [ ] A3: DuckDB 初始化逻辑保持不变

## Acceptance Criteria

### AC-1: 后端发送初始化完成事件
- **Given**: DuckDB 初始化完成（成功或失败）
- **When**: 后端完成初始化流程
- **Then**: 通过 Tauri 事件系统发送 `duckdb_init_completed` 事件
- **Verification**: `programmatic`

### AC-2: 前端显示初始化完成消息
- **Given**: 前端收到 `duckdb_init_completed` 事件
- **When**: 事件处理函数执行
- **Then**: 通过 `toastStore.addToast` 显示消息
- **Verification**: `human-judgment`

### AC-3: 启动预加载完成后显示消息
- **Given**: 应用启动后 5 秒触发 DuckDB 预加载
- **When**: 预加载完成
- **Then**: 前端显示 "DuckDB 初始化完成" 消息
- **Verification**: `human-judgment`

### AC-4: 项目切换后初始化完成显示消息
- **Given**: 用户切换到新项目
- **When**: DuckDB 重新初始化完成
- **Then**: 前端显示 "DuckDB 初始化完成" 消息
- **Verification**: `human-judgment`

### AC-5: 懒加载完成后显示消息
- **Given**: 用户执行首次 SQL 查询触发懒加载
- **When**: 懒加载完成
- **Then**: 前端显示 "DuckDB 初始化完成" 消息
- **Verification**: `human-judgment`

## Open Questions

- [ ] Q1: 是否需要区分不同触发场景的消息文案？
- [ ] Q2: 是否需要在初始化失败时显示错误消息？

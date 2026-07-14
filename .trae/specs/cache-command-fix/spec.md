# 查询缓存命令注册缺失修复 - Product Requirement Document

## Overview
- **Summary**: 查询缓存状态页面报错 "Command get_query_cache_stats not found"，原因是后端命令未在 lib.rs 中注册。需要注册缺失的两个命令并配置权限。
- **Purpose**: 修复查询缓存状态面板加载失败问题，确保缓存统计和配置功能正常工作。
- **Target Users**: 使用查询缓存功能的所有用户

## Goals
- G1: 修复查询缓存状态面板加载失败问题
- G2: 确保 `get_query_cache_stats` 和 `configure_query_cache` 命令能正常调用
- G3: 确保后端命令注册与前端调用保持一致

## Non-Goals (Out of Scope)
- ❌ 不修改缓存核心逻辑（已有逻辑正确）
- ❌ 不添加新的缓存功能
- ❌ 不修改前端 UI 组件

## Background & Context

**问题现象**：用户在设置页面打开"查询缓存"分类时，出现错误提示：`加载失败: Error: Command get_query_cache_stats not found`

**问题分析**：
1. `src-tauri/src/commands/sql.rs` 中定义了三个缓存相关命令：
   - `get_query_cache_stats`（第 148 行）
   - `configure_query_cache`（第 161 行）
   - `clear_query_cache`（第 177 行）

2. `src-tauri/src/lib.rs` 中只注册了 `clear_query_cache`，缺少前两个命令的注册

3. 前端 `src/services/tauri.ts` 中有对应的封装方法：
   - `getQueryCacheStats()` 调用 `get_query_cache_stats`
   - `configureQueryCache()` 调用 `configure_query_cache`

4. 前端 `src/store/settingsStore.ts` 在加载缓存统计时调用了 `getQueryCacheStats()`

**影响范围**：查询缓存状态面板完全无法使用，缓存配置也无法通过设置页面应用。

## Functional Requirements
- **FR-1**: 在 lib.rs 中注册 `get_query_cache_stats` 命令
- **FR-2**: 在 lib.rs 中注册 `configure_query_cache` 命令
- **FR-3**: 在 capabilities/default.json 中添加对应的权限声明

## Non-Functional Requirements
- **NFR-1**: 修复后 `cargo check --quiet` 通过
- **NFR-2**: 修复后 `npx tsc --noEmit --pretty` 通过
- **NFR-3**: 不引入任何新的技术债

## Constraints
- **Technical**: 遵循分层架构，commands 层只做参数校验和调用 service
- **Dependencies**: Tauri v2 命令注册机制

## Assumptions
- [x] 后端命令实现逻辑正确（已有代码经过验证）
- [x] 前端调用逻辑正确（已有代码）
- [x] 只需注册命令，无需修改命令实现

## Acceptance Criteria

### AC-1: get_query_cache_stats 命令注册成功
- **Given**: 后端服务已启动
- **When**: 前端调用 `tauriService.getQueryCacheStats()`
- **Then**: 返回缓存统计数据，无错误
- **Verification**: `human-judgment`

### AC-2: configure_query_cache 命令注册成功
- **Given**: 后端服务已启动
- **When**: 前端调用 `tauriService.configureQueryCache()`
- **Then**: 缓存配置更新成功，返回 true
- **Verification**: `human-judgment`

### AC-3: 编译检查通过
- **Given**: 修复完成
- **When**: 执行 `cargo check --quiet` 和 `npx tsc --noEmit --pretty`
- **Then**: 两者都通过，无错误
- **Verification**: `programmatic`

### AC-4: capabilities 权限配置完整
- **Given**: 修复完成
- **When**: 检查 `src-tauri/capabilities/default.json`
- **Then**: 包含 `get_query_cache_stats` 和 `configure_query_cache` 的权限声明
- **Verification**: `programmatic`

## Open Questions
- [ ] Q1: 是否需要在 capabilities 中添加命令权限？（需要确认当前 capabilities 配置方式）

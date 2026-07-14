# 设置系统 P2 中优先级实现 - Product Requirement Document

## Overview
- **Summary**: 实现设置系统中 9 项 P2 中优先级未实现设置项，从 78.4% 提升到 96.4% 实现率
- **Purpose**: 完善安全功能和高级设置，提升应用的专业性和用户体验
- **Target Users**: 所有使用设置功能的用户

## Goals
- G1: 实现 `security.enablePasswordProtect` — 密码保护功能
- G2: 实现 `security.autoLock` + `security.lockTimeout` — 自动锁定功能
- G3: 实现 `security.sessionTimeout` — 会话超时控制
- G4: 实现 `advanced.maxConcurrentQueries` — 并发查询控制
- G5: 实现 `advanced.enableTelemetry` — 遥测数据收集
- G6: 实现 `advanced.checkForUpdates` — 自动检查更新
- G7: 实现 `advanced.dataDir` + `advanced.tempDir` — 自定义目录配置

## Non-Goals (Out of Scope)
- ❌ 不修改数据库连接架构（SQLite 不支持超时）
- ❌ 不实现复杂的加密算法（使用系统级加密）
- ❌ 不做远程遥测服务器（遥测仅本地记录）
- ❌ 不实现完整的用户认证系统（密码保护仅锁屏）

## P2 未实现项详细清单

| 序号 | 设置项 | 分类 | 估计工作量 | 说明 |
|------|--------|------|-----------|------|
| 1 | `security.enablePasswordProtect` | 安全 | 4小时 | 密码保护锁屏功能 |
| 2 | `security.autoLock` | 安全 | 3小时 | 空闲检测 + 自动锁定 |
| 3 | `security.lockTimeout` | 安全 | 1小时 | 锁定超时配置 |
| 4 | `security.sessionTimeout` | 安全 | 2小时 | 会话超时配置 |
| 5 | `advanced.maxConcurrentQueries` | 高级 | 3小时 | 并发查询限制 |
| 6 | `advanced.enableTelemetry` | 高级 | 4小时 | 遥测数据收集 |
| 7 | `advanced.checkForUpdates` | 高级 | 3小时 | 版本检查逻辑 |
| 8 | `advanced.dataDir` | 高级 | 2小时 | 自定义数据目录 |
| 9 | `advanced.tempDir` | 高级 | 2小时 | 自定义临时目录 |

**P2 总计: 约 24 小时**

## Functional Requirements

### FR-1: security.enablePasswordProtect
- **功能**: 启用密码保护后，应用启动或解锁时需要输入密码
- **默认值**: `false`
- **实现方式**:
  - 设置密码时加密存储（使用 AES-256 或系统级加密）
  - 锁屏界面输入密码解锁
  - 密码存储在 `__settings` 表中
- **影响组件**: App.tsx, LockScreen.tsx（新建）

### FR-2: security.autoLock
- **功能**: 用户空闲一定时间后自动锁定应用
- **默认值**: `false`
- **实现方式**:
  - 监听用户活动（鼠标移动、键盘输入）
  - 空闲超过 `lockTimeout` 秒后触发锁定
- **影响组件**: App.tsx, ActivityMonitor.tsx（新建）

### FR-3: security.lockTimeout
- **功能**: 自动锁定超时秒数
- **默认值**: `300`（5分钟）
- **实现方式**: 配合 autoLock 使用
- **影响组件**: ActivityMonitor.tsx

### FR-4: security.sessionTimeout
- **功能**: 会话超时后清除敏感数据
- **默认值**: `3600`（1小时）
- **实现方式**:
  - 超时后清除 localStorage 中的自动保存内容
  - 不锁定应用，仅清除敏感数据
- **影响组件**: App.tsx

### FR-5: advanced.maxConcurrentQueries
- **功能**: 最大并发查询数量
- **默认值**: `5`
- **实现方式**:
  - 在 execute_sql_batch 中检查当前运行数
  - 超过限制时排队等待
- **影响组件**: sql_service.rs

### FR-6: advanced.enableTelemetry
- **功能**: 收集使用遥测数据（仅本地）
- **默认值**: `false`
- **实现方式**:
  - 记录功能使用频率、错误率等
  - 存储在 `__telemetry` 表中
  - 可导出为 JSON 供分析
- **影响组件**: TelemetryService.tsx（新建）

### FR-7: advanced.checkForUpdates
- **功能**: 自动检查应用更新
- **默认值**: `true`
- **实现方式**:
  - 启动时检查 GitHub Releases API
  - 发现新版本时显示通知
- **影响组件**: App.tsx, UpdateChecker.tsx（新建）

### FR-8: advanced.dataDir
- **功能**: 自定义数据目录（数据库存储位置）
- **默认值**: 应用默认目录
- **实现方式**:
  - 配置后新数据库创建在指定目录
  - 不迁移现有数据库
- **影响组件**: lib.rs

### FR-9: advanced.tempDir
- **功能**: 自定义临时文件目录
- **默认值**: 系统临时目录
- **实现方式**:
  - 导入/导出临时文件使用指定目录
- **影响组件**: file.rs

## Non-Functional Requirements
- **NFR-1**: 编译无错误：cargo check 和 tsc 均通过
- **NFR-2**: 密码加密存储，不明文保存
- **NFR-3**: 遥测数据不发送到远程服务器
- **NFR-4**: 更新检查不影响应用启动速度

## Acceptance Criteria

### AC-1: 密码保护生效
- **Given**: 用户启用 enablePasswordProtect 并设置密码
- **When**: 应用启动或解锁
- **Then**: 需要输入密码才能继续
- **Verification**: `programmatic`

### AC-2: 自动锁定生效
- **Given**: 用户启用 autoLock，设置 lockTimeout 为 60
- **When**: 用户空闲 60 秒
- **Then**: 应用自动锁定
- **Verification**: `programmatic`

### AC-3: 并发控制生效
- **Given**: 用户设置 maxConcurrentQueries 为 3
- **When**: 同时执行 5 个查询
- **Then**: 只有 3 个并发执行，其余排队
- **Verification**: `programmatic`

### AC-4: 更新检查生效
- **Given**: 用户启用 checkForUpdates
- **When**: 有新版本发布
- **Then**: 显示更新通知
- **Verification**: `programmatic`

### AC-5: 编译通过
- **Given**: 所有代码修改完成
- **When**: 运行 cargo check 和 tsc
- **Then**: 无错误
- **Verification**: `programmatic`

## Open Questions
- [ ] Q1: 密码加密使用什么算法？（当前假设：AES-256-GCM）
- [ ] Q2: 遥测数据存储多久？（当前假设：30天）
- [ ] Q3: 更新检查频率？（当前假设：启动时检查一次）
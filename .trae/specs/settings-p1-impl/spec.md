# 设置系统 P1 高优先级实现 - Product Requirement Document

## Overview
- **Summary**: 实现设置系统中 12 项 P1 高优先级未实现设置项，从 78.4% 提升到 89.2% 实现率
- **Purpose**: 让设置项真正生效，提升用户体验，减少"改了没效果"的困惑
- **Target Users**: 所有使用设置功能的用户

## Goals
- G1: 实现 `appearance.lineHeight` — 行高设置传入 Monaco editorOptions
- G2: 实现 `editor.autoSave` + `editor.saveInterval` — 编辑器自动保存
- G3: 实现 `editor.trimTrailingWhitespace` — 保存时去除尾部空格
- G4: 实现 `database.autoConnect` + `database.connectionTimeout` + `database.queryTimeout` — 数据库连接管理
- G5: 实现 `database.enableExplainPlan` — 执行计划展示
- G6: 实现 `automation.defaultRetryOnFail` + `automation.defaultTimeoutSecs` — 任务调度参数
- G7: 实现 `automation.notifyOnFailure` + `automation.maxConcurrentTasks` — 任务失败通知与并发控制

## Non-Goals (Out of Scope)
- ❌ 不实现 P2/P3 优先级的设置项
- ❌ 不修改 UI 布局或样式
- ❌ 不做数据库迁移
- ❌ 不实现密码保护、自动锁定等安全功能

## P1 未实现项详细清单

| 序号 | 设置项 | 分类 | 估计工作量 | 依赖关系 |
|------|--------|------|-----------|----------|
| 1 | `appearance.lineHeight` | 外观 | 10分钟 | 无 |
| 2 | `editor.autoSave` | 编辑器 | 2小时 | 无 |
| 3 | `editor.saveInterval` | 编辑器 | 15分钟 | 依赖 #2 |
| 4 | `editor.trimTrailingWhitespace` | 编辑器 | 30分钟 | 无 |
| 5 | `database.autoConnect` | 数据库 | 2小时 | 无 |
| 6 | `database.connectionTimeout` | 数据库 | 1小时 | 无 |
| 7 | `database.queryTimeout` | 数据库 | 2小时 | 无 |
| 8 | `database.enableExplainPlan` | 数据库 | 3小时 | 无 |
| 9 | `automation.defaultRetryOnFail` | 自动化 | 1小时 | 无 |
| 10 | `automation.defaultTimeoutSecs` | 自动化 | 1小时 | 无 |
| 11 | `automation.notifyOnFailure` | 自动化 | 2小时 | 无 |
| 12 | `automation.maxConcurrentTasks` | 自动化 | 2小时 | 无 |

**P1 总计: 约 18 小时**

## Functional Requirements

### FR-1: appearance.lineHeight
- **功能**: 将 `appearance.lineHeight` 设置值传入 Monaco Editor 的 `editorOptions.lineHeight`
- **默认值**: `1.6`
- **有效范围**: `1.0` ~ `3.0`
- **影响组件**: SQLEditor.tsx

### FR-2: editor.autoSave + editor.saveInterval
- **功能**: 启用后，每隔 `saveInterval` 秒自动保存当前 SQL 到 localStorage
- **默认值**: `autoSave=true`, `saveInterval=30`
- **实现方式**: 
  - 定时器每 N 秒检查是否有变更
  - 有变更则保存到 localStorage（key: `__autosave_{queryId}`）
  - 应用启动时检查并恢复
- **影响组件**: SQLEditor.tsx, useQueryStore

### FR-3: editor.trimTrailingWhitespace
- **功能**: 保存文件时自动去除尾部空格
- **默认值**: `false`
- **实现方式**: 保存回调中用正则去除 `\s+$`
- **影响组件**: ShortcutProvider.tsx (handleSaveFile)

### FR-4: database.autoConnect
- **功能**: 启动时自动重连上次使用的数据库
- **默认值**: `true`
- **实现方式**: appStore 中记录上次连接的 dbPath，启动时调用 connect
- **影响组件**: App.tsx, database_service.rs

### FR-5: database.connectionTimeout
- **功能**: 数据库连接超时控制
- **默认值**: `30` 秒
- **实现方式**: 连接时使用此超时值
- **影响组件**: database_service.rs

### FR-6: database.queryTimeout
- **功能**: 查询执行超时控制
- **默认值**: `60` 秒
- **实现方式**: 查询执行时使用此超时值（已有 fallback）
- **影响组件**: database_service.rs

### FR-7: database.enableExplainPlan
- **功能**: 显示 EXPLAIN 输出
- **默认值**: `false`
- **实现方式**: 
  - 快捷键 Ctrl+Shift+E 执行 EXPLAIN
  - 结果显示在 QueryResult 中
- **影响组件**: ShortcutProvider.tsx, QueryResultItem.tsx

### FR-8: automation.defaultRetryOnFail
- **功能**: 任务失败时自动重试次数
- **默认值**: `0`
- **实现方式**: task_service.rs 中读取并使用此值
- **影响组件**: task_service.rs

### FR-9: automation.defaultTimeoutSecs
- **功能**: 任务执行默认超时秒数
- **默认值**: `300`
- **实现方式**: task_service.rs 中读取并使用此值
- **影响组件**: task_service.rs

### FR-10: automation.notifyOnFailure
- **功能**: 任务失败时显示通知
- **默认值**: `true`
- **实现方式**: task_service.rs 中任务失败时调用 toastStore
- **影响组件**: task_service.rs, toastStore

### FR-11: automation.maxConcurrentTasks
- **功能**: 最大并发任务数
- **默认值**: `3`
- **实现方式**: task_service.rs 中调度时检查当前运行数
- **影响组件**: task_service.rs

## Non-Functional Requirements
- **NFR-1**: 编译无错误：cargo check 和 tsc 均通过
- **NFR-2**: 不破坏现有功能：已实现的设置项继续正常工作
- **NFR-3**: 自动保存不覆盖用户手动保存的内容

## Acceptance Criteria

### AC-1: appearance.lineHeight 生效
- **Given**: 用户修改 appearance.lineHeight 为 2.0
- **When**: 打开 SQL 编辑器
- **Then**: 编辑器行高变为 2.0
- **Verification**: `programmatic` — 检查 SQLEditor.tsx 中 lineHeight 选项

### AC-2: autoSave 生效
- **Given**: 用户启用 editor.autoSave，设置 editor.saveInterval 为 10
- **When**: 编辑 SQL 10 秒后不做操作
- **Then**: SQL 自动保存到 localStorage
- **Verification**: `programmatic` — 检查 localStorage 中有 __autosave_ key

### AC-3: trimTrailingWhitespace 生效
- **Given**: 用户启用 editor.trimTrailingWhitespace，SQL 内容为 `SELECT * FROM t  `
- **When**: 保存文件
- **Then**: 保存的内容为 `SELECT * FROM t`
- **Verification**: `programmatic` — 检查保存回调中去除了尾部空格

### AC-4: database 相关设置生效
- **Given**: 用户设置 database.queryTimeout 为 30
- **When**: 执行长时间查询
- **Then**: 30 秒后查询超时
- **Verification**: `programmatic` — 检查代码中有超时逻辑

### AC-5: automation 相关设置生效
- **Given**: 用户设置 automation.maxConcurrentTasks 为 2
- **When**: 同时触发 3 个任务
- **Then**: 只有 2 个并发执行，第 3 个排队
- **Verification**: `programmatic` — 检查 task_service.rs 中有并发控制

### AC-6: 编译通过
- **Given**: 所有代码修改完成
- **When**: 运行 cargo check 和 tsc
- **Then**: 无错误
- **Verification**: `programmatic`

## Implementation Order

### 第一批（容易实现，无依赖）
1. `appearance.lineHeight` — 10分钟
2. `editor.saveInterval` — 15分钟（独立，但依赖 autoSave 基础）
3. `editor.trimTrailingWhitespace` — 30分钟

### 第二批（编辑器核心功能）
4. `editor.autoSave` — 2小时

### 第三批（数据库相关）
5. `database.connectionTimeout` — 1小时
6. `database.autoConnect` — 2小时
7. `database.queryTimeout` — 2小时
8. `database.enableExplainPlan` — 3小时

### 第四批（自动化任务）
9. `automation.defaultRetryOnFail` — 1小时
10. `automation.defaultTimeoutSecs` — 1小时
11. `automation.notifyOnFailure` — 2小时
12. `automation.maxConcurrentTasks` — 2小时

## Open Questions
- [ ] Q1: autoSave 保存到 localStorage 是否需要加密？（当前假设：不需要，只是 SQL 文本）
- [ ] Q2: explainPlan 结果展示在哪个面板？（当前假设：QueryResult 面板）
- [ ] Q3: 任务失败通知使用什么方式？（当前假设：toastStore.error）

# 设置系统 P4 阶段 — 最终完善与报告修正 Spec

## Why
设置系统当前生效率约 90%，报告中存在多处数据不准确（分类统计数字矛盾、部分已实现项被误标为未实现）。P4 阶段目标：1) 修正报告数据，确保准确反映真实状态；2) 完成剩余"部分实现"项的完整接入；3) 推进到 95%+ 生效率。

## What Changes
- 修正设置系统现状分析报告中的数据错误和矛盾
- 实现 `security.enableAuditLog` — 审计日志开关
- 实现 `advanced.logLevel` — 日志级别控制
- 实现 `cache.cacheStrategy` — 缓存策略切换（memory/disk/hybrid）
- 实现 `editor.insertSpaces` — 真正使用空格替代 Tab（修正键名不一致）
- 实现 `sql.defaultSelectLimit` — 默认 SELECT 限制行数（在 SELECT 语句自动追加 LIMIT）
- 实现 `appearance.lineHeight` — 已实现，修正报告标记
- 实现 `editor.trimTrailingWhitespace` — 已实现，修正报告标记
- 实现 `editor.autoSave` + `editor.saveInterval` — 编辑器自动保存
- 更新 `implemented_settings()` 标记
- 更新设置系统现状分析报告到 v28.0

## Impact
- Affected specs: settings system, audit log, cache, editor
- Affected code:
  - `src-tauri/src/services/audit_log_service.rs` — enableAuditLog 开关
  - `src-tauri/src/services/cache_service.rs` — cacheStrategy 策略切换
  - `src/components/sql/SQLEditor.tsx` — insertSpaces、defaultSelectLimit、autoSave
  - `src/utils/logger.ts` — logLevel 控制
  - `src-tauri/src/services/settings_service.rs` — implemented_settings 更新

## ADDED Requirements

### Requirement: Audit Log Toggle
系统 SHALL 在 `enableAuditLog=false` 时停止记录审计日志。

#### Scenario: Audit log disabled
- **WHEN** 用户设置 `enableAuditLog=false`
- **THEN** 审计日志服务不再写入新的日志记录

### Requirement: Log Level Control
系统 SHALL 根据 `advanced.logLevel` 设置控制日志输出级别。

#### Scenario: Log level set to error
- **WHEN** 用户设置 `logLevel=error`
- **THEN** 只有 error 级别的日志输出到控制台/文件

### Requirement: Cache Strategy
系统 SHALL 根据 `cache.cacheStrategy` 设置使用不同的缓存策略。

#### Scenario: Memory strategy
- **WHEN** 用户设置 `cacheStrategy=memory`
- **THEN** 查询结果缓存在内存中

### Requirement: Editor Insert Spaces
系统 SHALL 在 `editor.insertSpaces=true` 时使用空格替代 Tab。

#### Scenario: Insert spaces enabled
- **WHEN** 用户设置 `insertSpaces=true` 并按下 Tab 键
- **THEN** 编辑器插入空格而非 Tab 字符

### Requirement: Default SELECT Limit
系统 SHALL 在 `sql.defaultSelectLimit` 启用时，对用户的 SELECT 语句自动追加 LIMIT 子句。

#### Scenario: SELECT without LIMIT
- **WHEN** 用户执行不带 LIMIT 的 SELECT 语句且 `defaultSelectLimit > 0`
- **THEN** 自动追加 `LIMIT <defaultSelectLimit>`

### Requirement: Editor Auto Save
系统 SHALL 根据 `editor.autoSave` 和 `editor.saveInterval` 设置自动保存编辑器内容。

#### Scenario: Auto save enabled
- **WHEN** 用户启用 `autoSave=true` 且内容变更超过 `saveInterval` 秒
- **THEN** 自动保存当前 SQL 到 localStorage

## MODIFIED Requirements

### Requirement: implemented_settings
`implemented_settings()` 函数 SHALL 更新以下设置项状态：
- `security.enableAuditLog` — 从部分实现升级为已实现
- `advanced.logLevel` — 从部分实现升级为已实现
- `cache.cacheStrategy` — 从部分实现升级为已实现
- `editor.insertSpaces` — 从部分实现升级为已实现
- `sql.defaultSelectLimit` — 从未实现升级为已实现
- `editor.autoSave` — 从未实现升级为已实现
- `editor.saveInterval` — 从未实现升级为已实现

## REMOVED Requirements

无

# 设置系统 P3 阶段 — 安全/高级/locale 分类完善 Spec

## Why
设置系统当前生效率 82.7%，剩余 3 个分类（security 3 项、advanced 4 项、locale 2 项）共 9 项设置项需要完善。这些功能对安全性、调试和国际化至关重要。

## What Changes
- 实现 `security.enablePasswordProtect` — 简单密码保护（前端验证）
- 实现 `security.autoLock` — 空闲时自动锁定（前端计时器）
- 实现 `security.lockTimeout` — 锁定超时时间（配合 autoLock）
- 实现 `advanced.enableTelemetry` — 遥测开关（读取设置并记录日志）
- 实现 `advanced.checkForUpdates` — 更新检查（读取设置并提示）
- 实现 `advanced.dataDir` — 数据目录（读取设置并记录日志）
- 实现 `advanced.tempDir` — 临时目录（读取设置并记录日志）
- 实现 `locale.firstDayOfWeek` — 日历首日（前端日期格式化使用）
- 实现 `locale.timezone` — 时区（前端时间显示使用）

## Impact
- Affected specs: settings system, security, locale
- Affected code:
  - `src/App.tsx` — autoLock/lockTimeout 锁定逻辑
  - `src/services/tauri.ts` — 密码验证
  - `src/context/ShortcutProvider.tsx` — 数据目录读取
  - `src/utils/dateUtils.ts` 或类似文件 — 时区/首日处理

## ADDED Requirements

### Requirement: Password Protection
系统 SHALL 在启用 `enablePasswordProtect=true` 时，在应用启动时显示密码输入对话框。

#### Scenario: Password enabled
- **WHEN** 用户启用 `enablePasswordProtect=true` 并启动应用
- **THEN** 显示密码对话框，用户输入正确密码后才能使用应用

#### Scenario: Password disabled
- **WHEN** 用户设置 `enablePasswordProtect=false`
- **THEN** 不显示密码对话框，直接进入应用

### Requirement: Auto Lock
系统 SHALL 在用户空闲超过 `lockTimeout` 指定时间后自动锁定应用。

#### Scenario: Auto lock enabled
- **WHEN** 用户启用 `autoLock=true` 且空闲时间超过 `lockTimeout`
- **THEN** 锁定应用，显示锁定界面，要求重新输入密码或操作

### Requirement: Telemetry
系统 SHALL 在启用 `enableTelemetry=true` 时记录使用遥测数据。

#### Scenario: Telemetry enabled
- **WHEN** 用户启用 `enableTelemetry=true`
- **THEN** 系统记录遥测数据到日志（当前阶段：仅记录日志）

### Requirement: Date/Time Localization
系统 SHALL 在日期时间显示时使用 `locale.timezone` 和 `locale.firstDayOfWeek` 设置。

#### Scenario: Timezone set
- **WHEN** 用户设置 `locale.timezone`
- **THEN** 日期时间显示转换为用户指定时区

## MODIFIED Requirements

### Requirement: implemented_settings
`implemented_settings()` 函数 SHALL 包含以下新增设置项：
- `security.enablePasswordProtect`
- `security.autoLock`
- `security.lockTimeout`
- `advanced.enableTelemetry`
- `advanced.checkForUpdates`
- `advanced.dataDir`
- `advanced.tempDir`
- `locale.firstDayOfWeek`
- `locale.timezone`

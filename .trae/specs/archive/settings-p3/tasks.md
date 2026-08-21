# Tasks

- [x] Task 1: 实现 security.enablePasswordProtect — 简单密码保护
  - **Priority**: high
  - **Description**: 在 App.tsx 中读取设置，如果启用则显示密码对话框（简单实现：存储密码哈希到 localStorage）
  - **Test Requirements**:
    - `programmatic` TR-1.1: cargo check --quiet 无错误
    - `programmatic` TR-1.2: npx tsc --noEmit --pretty 无错误

- [x] Task 2: 实现 security.autoLock + lockTimeout — 自动锁定
  - **Priority**: high
  - **Description**: 在 App.tsx 中添加空闲计时器，空闲超过 lockTimeout 后锁定应用
  - **Test Requirements**:
    - `programmatic` TR-2.1: cargo check --quiet 无错误
    - `programmatic` TR-2.2: npx tsc --noEmit --pretty 无错误

- [x] Task 3: 实现 advanced.enableTelemetry — 遥测开关
  - **Priority**: medium
  - **Description**: 读取设置，如果启用则在关键操作时记录遥测日志到文件
  - **Test Requirements**:
    - `programmatic` TR-3.1: cargo check --quiet 无错误

- [x] Task 4: 实现 advanced.checkForUpdates — 更新检查
  - **Priority**: low
  - **Description**: 读取设置，如果启用则在启动时检查更新（当前：记录日志提示）
  - **Test Requirements**:
    - `programmatic` TR-4.1: cargo check --quiet 无错误

- [x] Task 5: 实现 advanced.dataDir/tempDir — 目录配置
  - **Priority**: low
  - **Description**: 读取设置值并记录日志（完整实现需要架构调整）
  - **Test Requirements**:
    - `programmatic` TR-5.1: cargo check --quiet 无错误

- [x] Task 6: 实现 locale.firstDayOfWeek — 日历首日
  - **Priority**: medium
  - **Description**: 创建 dateUtils.ts 工具函数，根据设置格式化日期
  - **Test Requirements**:
    - `programmatic` TR-6.1: npx tsc --noEmit --pretty 无错误

- [x] Task 7: 实现 locale.timezone — 时区设置
  - **Priority**: medium
  - **Description**: 使用 date-fns-tz 或 Intl API 根据设置转换时区
  - **Test Requirements**:
    - `programmatic` TR-7.1: npx tsc --noEmit --pretty 无错误

- [x] Task 8: 更新 implemented_settings() 标记
  - **Priority**: high
  - **Depends On**: Task 1, Task 2, Task 3, Task 4, Task 5, Task 6, Task 7
  - **Description**: 在 settings_service.rs 的 implemented_settings() 中添加新实现的设置项
  - **Test Requirements**:
    - `programmatic` TR-8.1: cargo check --quiet 无错误

- [x] Task 9: 更新设置系统现状分析报告到 v27.0
  - **Priority**: high
  - **Depends On**: Task 8
  - **Description**: 更新报告版本到 v27.0，更新统计数据和各分类实现率排名
  - **Test Requirements**:
    - `human-judgement` TR-9.1: 报告版本号已更新为 v27.0
    - `human-judgement` TR-9.2: security/advanced/locale 分类实现率已更新

# Task Dependencies
- Task 8 depends on Task 1, Task 2, Task 3, Task 4, Task 5, Task 6, Task 7
- Task 9 depends on Task 8

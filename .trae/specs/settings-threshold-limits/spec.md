# 设置系统数值参数阈值限制 Spec

## Why
当前设置系统中 32 个数值类型参数，仅有 2 个（`result_min_height`、`result_max_height`）配置了 min/max/step 范围限制。其余 30 个数值参数用户可输入任意值（包括负数、0、超大值），既无前端 UI 提示，也无后端校验，导致不合理配置可能引发功能异常或性能问题。

## What Changes
- 后端 `settings_service.rs` 的 `get_settings_meta()` 中为全部 32 个数值设置项注入合理的 min_value / max_value / step
- 前端 `SettingsModal.tsx` 的普通数值输入框分支（分支3）添加 min/max 属性显示与运行时 clamp 校验
- 前端 `handleChange` 中对有范围的数值设置项执行 clamp，防止越界值写入
- 后端 `update_setting` 中对有范围的数值设置项执行服务端 clamp，作为最后防线

## Impact
- Affected specs: settings-ui-control-upgrade, settings-system-phase16, result-height-settings
- Affected code:
  - `src-tauri/src/services/settings_service.rs`（范围元数据注入 + update_setting 校验）
  - `src/components/common/SettingsModal.tsx`（数值输入框 min/max 显示 + clamp）
  - `src/types/settings.ts`（无变更，接口已支持）

## ADDED Requirements

### Requirement: 全数值设置项范围限制元数据
后端 `get_settings_meta()` SHALL 为所有 `SettingValueType::Number` 类型的设置项返回 min_value、max_value、step 三个字段，取值依据下表：

| category | key | 默认值 | min | max | step | 单位说明 |
|----------|-----|--------|-----|-----|------|---------|
| appearance | fontSize | 14 | 8 | 32 | 1 | px |
| appearance | lineHeight | 1.6 | 1.0 | 3.0 | 0.1 | 倍数 |
| editor | saveInterval | 30 | 5 | 600 | 5 | 秒 |
| editor | tabSize | 2 | 1 | 8 | 1 | 空格数 |
| sql | resultLimit | 1000 | 1 | 100000 | 1 | 行 |
| sql | maxHistorySize | 500 | 10 | 10000 | 10 | 条 |
| sql | defaultSelectLimit | 100 | 0 | 100000 | 10 | 行（0=不限制） |
| import | importBatchSize | 1000 | 1 | 100000 | 100 | 行 |
| import | maxImportFileSize | 100 | 1 | 4096 | 1 | MB |
| import | importTimeout | 60 | 5 | 3600 | 5 | 秒 |
| visualization | animationDuration | 1000 | 0 | 5000 | 100 | 毫秒（0=禁用） |
| trash | cleanupDays | 30 | 1 | 365 | 1 | 天 |
| trash | maxTrashSize | 1024 | 10 | 10240 | 10 | MB |
| performance | large_table_threshold | 100000 | 1000 | 10000000 | 1000 | 行 |
| performance | result_page_size | 1000 | 10 | 100000 | 10 | 行 |
| performance | result_min_height | 200 | 64 | 1000 | 1 | px（已有） |
| performance | result_max_height | 800 | 64 | 1000 | 1 | px（已有） |
| database | connectionTimeout | 30 | 1 | 300 | 1 | 秒 |
| database | queryTimeout | 60 | 1 | 3600 | 1 | 秒 |
| database | maxResultRows | 10000 | 100 | 1000000 | 100 | 行 |
| cache | cacheSize | 100 | 0 | 10000 | 10 | 条（0=禁用缓存） |
| cache | cacheExpiry | 30 | 1 | 1440 | 1 | 分钟 |
| security | lockTimeout | 5 | 1 | 480 | 1 | 分钟 |
| security | sessionTimeout | 120 | 5 | 1440 | 5 | 分钟 |
| security | auditLogRetentionDays | 30 | 1 | 3650 | 1 | 天 |
| security | auditLogMaxSizeMB | 500 | 10 | 10240 | 10 | MB |
| advanced | maxConcurrentQueries | 5 | 1 | 100 | 1 | 个 |
| automation | defaultRetryOnFail | 0 | 0 | 10 | 1 | 次 |
| automation | defaultTimeoutSecs | 300 | 1 | 86400 | 1 | 秒 |
| automation | scheduleIntervalSecs | 30 | 5 | 3600 | 5 | 秒 |
| automation | logRetentionDays | 30 | 1 | 365 | 1 | 天 |
| automation | maxConcurrentTasks | 3 | 1 | 20 | 1 | 个 |

#### Scenario: 前端获取元数据
- **WHEN** 前端调用 `get_settings_meta_cmd`
- **THEN** 所有 Number 类型设置项的 `min_value`、`max_value`、`step` 字段均非 null

### Requirement: 前端数值输入框显示范围约束
前端数值输入框（无 options 且无完整 range 的分支）SHALL 在 `<input type="number">` 上设置 `min`、`max`、`step` 属性，并在输入框旁显示当前可设置范围提示（如 "8 ~ 32"）。

#### Scenario: 有 min/max 但渲染为普通输入框
- **WHEN** 设置项有 min_value 和 max_value，但因业务逻辑走了普通输入框分支
- **THEN** input 元素应包含 min、max、step 属性
- **AND** 输入框旁应显示范围提示文字

### Requirement: 前端运行时 clamp 校验
前端 `handleChange` 在保存数值类型设置前，SHALL 读取该设置项的 min_value / max_value，将输入值 clamp 到合法范围后再写入。

#### Scenario: 用户输入超出范围的值
- **WHEN** 用户在数值输入框输入 99999，但该设置项 max=1000
- **THEN** 实际保存的值应为 1000
- **AND** 输入框显示值应更新为 1000

#### Scenario: 滑块分支越界值回显
- **WHEN** 后端持久化的值超出滑块 [min, max] 范围
- **THEN** 滑块右侧显示的数值应被 clamp 到范围内

### Requirement: 后端 update_setting 服务端校验
后端 `update_setting` 在写入前，SHALL 查询该设置项的 min_value / max_value 元数据，对数值类型执行 clamp 后再写入数据库。

#### Scenario: IPC 直接调用绕过前端
- **WHEN** 通过 IPC 直接调用 `update_setting` 传入越界值
- **THEN** 数据库中实际写入的值应被 clamp 到合法范围

## MODIFIED Requirements

### Requirement: 数值设置项渲染
原实现：数值输入框分支不使用 min/max/step 属性，不显示范围提示。
修改后：数值输入框分支 SHALL 使用 min/max/step 属性，并显示范围提示文字。所有数值类型设置项（包括滑块和输入框）在保存前执行 clamp。

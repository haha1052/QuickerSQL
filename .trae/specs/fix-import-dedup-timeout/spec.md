# 修复导入拖放重复与增加导入超时设置 Spec

## Why
用户反馈当前数据导入存在两个问题：
1. 拖放一个文件到导入区域，会连续出现 2-3 个相同的导入项
2. 大文件导入时因为超时而失败，但设置系统中没有导入超时相关的设置项
需要修复拖放去重问题，并在设置中开放导入超时配置。

## What Changes
- 修复前端拖放事件重复触发导致的同一文件被添加多次
- 在设置系统的"数据导入"分类中新增 `importTimeout` 设置项（单位：秒）
- 后端 `import_data_v2` 读取 `importTimeout` 设置替代固定写死的超时计算
- 更新国际化文案（中/英文）
- 顺带修复 TXT 文件在 SQLite 下 COPY 命令失败回退后字段数不匹配的问题

## Impact
- Affected specs: 无
- Affected code:
  - `src/components/import/DataImport.tsx`
  - `src-tauri/src/services/settings_service.rs`
  - `src-tauri/src/commands/file.rs`
  - `src/context/LocaleContext.tsx`
  - `src-tauri/src/services/database_service.rs`

## ADDED Requirements

### Requirement: 拖放一个文件只产生一个导入项
用户将单个文件拖放到导入区域时，只应出现一个导入项。

#### Scenario: 拖放单个 TXT 文件
- **WHEN** 用户将 1 个 TXT 文件拖入导入区域
- **THEN** 文件队列中只新增 1 个对应项
- **AND** 不会出现 2 个或 3 个重复项

#### Scenario: 拖放单个 CSV 文件
- **WHEN** 用户将 1 个 CSV 文件拖入导入区域
- **THEN** 文件队列中只新增 1 个对应项

### Requirement: 设置中可配置导入超时时间
系统应该在设置的数据导入分类中提供导入超时时间配置。

#### Scenario: 修改导入超时设置
- **GIVEN** 用户打开设置 → 数据导入
- **WHEN** 用户修改"导入超时时间（秒）"
- **THEN** 设置被保存
- **AND** 下次导入时使用新的超时时间

#### Scenario: 大文件导入使用自定义超时
- **GIVEN** 用户已将导入超时设置为 300 秒
- **WHEN** 导入大文件
- **THEN** 后端使用 300 秒作为超时时间
- **AND** 不会因为默认 10 秒超时而失败

## MODIFIED Requirements

### Requirement: 导入超时计算
原实现使用固定公式计算导入超时：
- COPY 方式默认 10 秒
- 传统方式默认 30 秒

现改为：
1. 从设置中读取 `importTimeout`
2. 若设置存在且有效，使用设置值
3. 若不存在或无效，保持原公式作为默认值

### Requirement: TXT 文件导入
原实现在 SQLite 下使用 DuckDB 语法的 COPY 命令导致失败，回退到传统方式后 TXT 被当作 CSV 处理，字段数不匹配。

现改为：
1. 在 SQLite 下不使用 COPY 命令导入 TXT 文件
2. TXT 文件统一使用传统方式并正确传递分隔符
3. 回退路径中正确识别 TXT 文件扩展名

## NON-GOALS
- ❌ 不修改 CSV/Excel/JSON/Parquet 的导入逻辑
- ❌ 不修改除导入超时外的其他设置项
- ❌ 不新增除 `importTimeout` 外的其他设置项

## Constraints
- 拖放去重必须兼容 Tauri 原生拖放事件和 DOM `drop` 事件
- `importTimeout` 设置单位为秒，值范围 5-3600
- 后端读取设置时进行边界校验

# 修复数据导入拖放与 TXT 分隔符 Spec

## Why
上次数据导入增强后，用户反馈仍存在两个问题：
1. 外部文件拖放到导入区域仍无法正常加载
2. 导入 TXT 文件时，系统默认使用制表符分隔，导致逗号分隔的 TXT 文件被错误解析为单列
需要修复拖放功能并增强 TXT 文件的分隔符识别能力。

## What Changes
- 修复前端拖放区域的事件绑定与文件路径获取逻辑
- 为 TXT 文件引入分隔符自动检测（常见分隔符：逗号、制表符、分号、竖线）
- 在导入配置面板中增加自定义分隔符输入框
- 当用户修改分隔符时，重新加载预览与字段配置
- 将分隔符信息保存到 `ImportItem`，确保导入时后端使用正确分隔符

## Impact
- Affected specs: 无
- Affected code:
  - `src/components/import/DataImport.tsx`
  - `src/components/import/ImportConfigPanel.tsx`（或对应配置面板文件）
  - `src/services/tauri.ts`
  - `src/types/index.ts`
  - `src-tauri/src/commands/file.rs`
  - `src/context/LocaleContext.tsx`

## ADDED Requirements

### Requirement: 拖放外部文件到导入区域必须正常工作
用户应该能够将文件从外部文件管理器拖放到导入区域，并正确加载预览。

#### Scenario: 拖放逗号分隔的 TXT 文件
- **WHEN** 用户将 `.txt` 文件拖放到导入区域
- **THEN** 系统正确识别文件路径
- **AND** 自动检测分隔符并显示正确列数
- **AND** 文件出现在导入队列中

#### Scenario: 拖放 CSV 文件
- **WHEN** 用户将 `.csv` 文件拖放到导入区域
- **THEN** 文件被正确加载并显示预览

### Requirement: TXT 文件支持分隔符自动检测
系统应该根据文件内容自动推断 TXT 文件使用的分隔符。

#### Scenario: 逗号分隔 TXT
- **GIVEN** TXT 文件内容使用逗号分隔
- **WHEN** 加载文件预览
- **THEN** 系统检测到逗号分隔符
- **AND** 数据被解析为多列

#### Scenario: 制表符分隔 TXT
- **GIVEN** TXT 文件内容使用制表符分隔
- **WHEN** 加载文件预览
- **THEN** 系统检测到制表符分隔符
- **AND** 数据被解析为多列

### Requirement: 用户可手动设置 TXT 文件分隔符
系统应该在导入配置面板中提供自定义分隔符输入。

#### Scenario: 修改分隔符后重新预览
- **GIVEN** TXT 文件已加载但分隔符不正确
- **WHEN** 用户在配置面板输入正确分隔符
- **THEN** 预览数据实时更新
- **AND** 字段配置同步更新

#### Scenario: 导入时使用自定义分隔符
- **GIVEN** 用户已设置自定义分隔符
- **WHEN** 执行导入
- **THEN** 后端使用用户指定的分隔符解析文件
- **AND** 数据正确写入数据库

## MODIFIED Requirements

### Requirement: TXT 文件加载
原实现默认使用制表符分隔，现改为：
1. 优先使用用户指定的分隔符
2. 未指定时尝试自动检测
3. 检测失败时回退到制表符

## NON-GOALS
- ❌ 不支持多字符分隔符
- ❌ 不支持引号转义（按简单分隔处理）
- ❌ 不修改 CSV/Excel/JSON/Parquet 的导入逻辑

## Constraints
- 分隔符自动检测基于文件前 N 行统计，选择产生最多一致列数的分隔符
- 自定义分隔符通过 `ImportItem.delimiter` 字段传递
- 前端配置面板需要支持国际化（中/英文）

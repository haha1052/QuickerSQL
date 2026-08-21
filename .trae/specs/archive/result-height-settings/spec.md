# 结果集高度可配置化 Spec

## Why
用户需要根据不同的数据量和屏幕大小，自定义单个查询结果集的显示高度。目前高度是硬编码的（最小 200px / 最大 800px），不灵活。

## What Changes
- 在 `performance` 设置分类下新增两个配置项：`result_min_height`、`result_max_height`
- `QueryResultItem` 组件从设置系统读取高度值并动态应用
- 默认值保持 200px / 800px，与当前行为一致

## Impact
- 影响文件：
  - `src-tauri/src/services/settings_service.rs`
  - `src/components/sql/QueryResultItem.tsx`

## ADDED Requirements
### Requirement: 结果集高度可配置
- **WHEN** 用户在设置中修改 `result_min_height` 或 `result_max_height`
- **THEN** 查询结果项的高度限制立即生效

### Requirement: 默认值与当前一致
- **GIVEN** 用户未修改设置
- **WHEN** 查看查询结果
- **THEN** 最小高度 200px，最大高度 800px

## MODIFIED Requirements
无

## REMOVED Requirements
无

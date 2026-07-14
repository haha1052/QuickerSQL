# 修复导入前端超时与拖放重复 Spec

## Why
目前数据导入存在两个问题：
1. **后台导入成功但前端显示失败**：`tauriService.importDataV2` 硬编码了 30 秒前端超时，大文件导入超过 30 秒后前端认为失败，后端实际仍在执行并成功
2. **拖放文件重复添加为 2 个**：Tauri 原生拖放事件可能多次触发，或与 DOM 事件存在竞态，导致同一文件被添加两次

## What Changes
- 移除前端 `importDataV2` 的 30 秒硬编码超时，改为依赖后端 `importTimeout` 设置
- 强化拖放去重：添加基于时间窗口的防抖、路径去重、异步互斥锁三重防护
- 确保 `isProcessingDrop` 在整个异步过程中保持锁定
- 修复 `handleDragEnter` 的 dragCounter 计数逻辑可能异常

## Impact
- Affected code:
  - `src/services/tauri.ts`
  - `src/components/import/DataImport.tsx`
  - `src/components/import/DataPreview.tsx`

## ADDED Requirements

### Requirement: 大文件导入前端必须正确显示成功
后端导入成功后，前端必须正确显示成功状态，不能因为前端超时报错。

#### Scenario: 导入超过 30 秒的大文件
- **GIVEN** 用户设置导入超时为 300 秒
- **WHEN** 导入一个需要 60 秒才能完成的大文件
- **THEN** 前端等待导入完成
- **AND** 最终显示"导入成功"

#### Scenario: 后端超时时前端显示失败
- **GIVEN** 用户设置导入超时为 30 秒
- **WHEN** 导入一个超过 30 秒的文件
- **THEN** 前端显示"导入超时"错误

### Requirement: 拖放单个文件只添加一项
用户拖放一个文件到导入区域，文件队列中只应出现一项。

#### Scenario: 快速连续拖放同一文件
- **WHEN** 用户在短时间内多次拖放同一个文件
- **THEN** 只有第一次会添加
- **AND** 后续相同路径的文件会被过滤掉

#### Scenario: 单次拖放多文件
- **WHEN** 用户一次拖放 3 个不同文件
- **THEN** 文件队列中正好新增 3 项

## MODIFIED Requirements

### Requirement: 导入超时管理
原实现：前端 30 秒硬编码超时 + 后端独立超时
现改为：前端不设超时，完全依赖后端 `importTimeout` 设置控制导入超时

### Requirement: 拖放去重
原实现：基于 `importItems` 路径去重 + `isProcessingDrop` 互斥
现改为：时间窗口防抖 + 路径去重 + 异步互斥锁 三重防护

## NON-GOALS
- ❌ 不修改后端导入逻辑
- ❌ 不修改其他设置项
- ❌ 不修改 CSV/Excel/JSON/Parquet 解析逻辑

## Constraints
- 前端等待导入完成期间应保持 loading 状态
- 拖放去重不应影响正常的多文件拖放

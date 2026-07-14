# 设置系统恢复计划 Phase 4 Spec

## Why
设置系统 Phase 1-3 已完成（安全修复、UI 优化、功能接入），但存在遗漏：`appearance-fontFamily` 和 `appearance-lineHeight` 在 SQLEditor 中已使用，但 SettingsModal 中尚未标记为 `isImplemented: true`，导致这两个已生效的设置项不会显示在设置页面中。

## What Changes
- [x] Phase 1: SQL 注入安全修复 ✅
- [x] Phase 2: UI 优化（isImplemented 标记 + 渲染过滤）✅
- [x] Phase 3: 功能接入（外观设置接入编辑器）✅
- [ ] Phase 4: 补充缺失的 isImplemented 标记（fontFamily、lineHeight）

## Impact
- Affected specs: settings-system-improvement
- Affected code: [SettingsModal.tsx](file:///e:/LA_DUCK/la-duck/src/components/common/SettingsModal.tsx)

## ADDED Requirements

### Requirement: 补充缺失的 isImplemented 标记
SettingsModal 中的 SETTING_CONFIGS 必须包含所有在代码中实际使用的设置项的 `isImplemented: true` 标记。

#### Scenario: 外观字体设置显示
- **WHEN** 用户打开设置页面，切换到"外观"分类
- **THEN** 应显示以下 6 项设置：主题、字体大小、字体族、行高、Tab 宽度、自动换行

#### Scenario: 字体族设置
- **WHEN** 用户在设置页面看到"字体族"设置项
- **THEN** 该设置项应可修改并保存
- **AND** SQLEditor 应使用用户选择的字体

#### Scenario: 行高设置
- **WHEN** 用户在设置页面看到"行高"设置项
- **THEN** 该设置项应可修改并保存
- **AND** SQLEditor 应使用用户选择的行高

## MODIFIED Requirements

### Requirement: SettingsModal SETTING_CONFIGS
- 在 SETTING_CONFIGS 中为 `appearance-fontFamily` 添加 `isImplemented: true`
- 在 SETTING_CONFIGS 中为 `appearance-lineHeight` 添加 `isImplemented: true`

## REMOVED Requirements
无

---

## 下一步恢复计划（供 Phase 5 参考）

| 优先级 | 设置分类 | 设置项 | 实现难度 |
|--------|---------|--------|---------|
| 🔴 高 | SQL查询 | `sql.resultLimit` | 低 |
| 🔴 高 | SQL查询 | `sql.maxHistorySize` | 低 |
| 🟡 中 | SQL查询 | `sql.showExecutionTime` | 低 |
| 🟡 中 | 回收站 | `trash.confirmBeforeDelete` | 低 |
| 🟡 中 | 数据库 | `database.showSystemTables` | 低 |

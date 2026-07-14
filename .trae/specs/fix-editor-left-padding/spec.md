# Fix Editor Left Padding — Spec

## Why
Monaco Editor 默认配置（glyph margin + 行号 gutter + 默认 padding）导致 SQL 代码左侧留有较大空白区域，浪费编辑空间。用户反馈"开始输入位置离左侧边界有点距离"。

## What Changes
- 关闭 `glyphMargin`（释放行号左侧图标区域）
- 减少行号最小字符宽度 `lineNumbersMinChars: 2`
- 减少内容区域内边距 `padding: { top: 0, bottom: 0 }`
- 错误标记从 `glyphMarginClassName` 迁移到行内/行装饰样式（glyph margin 关闭后不再可用）
- 新增 CSS 样式文件用于错误行内下划线标记

## Impact
- 受影响文件：`src/components/sql/SQLEditor.tsx`
- 不影响其他组件功能
- 视觉变化：编辑器左侧留白减少，代码更贴近左边界

## ADDED Requirements
### Requirement: Editor Compact Layout
The system SHALL minimize the left padding of the SQL editor to maximize usable editing space.

#### Scenario: Normal editing
- **WHEN** user opens the SQL editor
- **THEN** the first character of code appears close to the left edge, with only the line number gutter between the window edge and the code

#### Scenario: Error display still works
- **WHEN** an SQL error occurs
- **THEN** the error line is visually marked (red underline / background) even without glyph margin

## MODIFIED Requirements
### Requirement: Error Line Decoration
- `glyphMarginClassName` is no longer used (glyph margin is disabled)
- Error lines use `className` (whole line background) + inline text underline via CSS class instead

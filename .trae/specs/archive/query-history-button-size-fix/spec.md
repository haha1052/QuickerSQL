# 查询历史按钮尺寸和交互优化 - Product Requirement Document

## Overview
- **Summary**: 优化查询历史模块的按钮尺寸、双击选中功能和右键菜单翻译。
- **Purpose**: 解决按钮过大、双击选中不生效、右键菜单英文的问题。
- **Target Users**: QuickerSQL 用户

## Goals
- 按钮尺寸与成功标记 badge 一致
- 双击选中 SQL 文本功能正常工作
- 右键菜单使用中文（或当前语言）显示

## Non-Goals (Out of Scope)
- 不修改查询历史的数据结构
- 不改变查询历史的核心功能逻辑

## Background & Context
- 当前按钮（收藏、执行、删除）尺寸过大，与成功标记 badge 不协调
- 双击选中功能可能因 CSS 的 user-select 或其他原因不生效
- 右键菜单中复制按钮的翻译键 `queryHistory.copy` 和 `queryHistory.copied` 在 LocaleContext 中不存在

## Functional Requirements
- **FR-1**: 收藏按钮、执行按钮、删除按钮尺寸与成功标记 badge 一致
- **FR-2**: 双击 SQL 文本可以全选文本内容
- **FR-3**: 右键菜单的复制按钮文本使用当前语言

## Acceptance Criteria

### AC-1: 按钮尺寸与 badge 一致
- **Given**: 用户查看查询历史
- **When**: 查看按钮和成功标记
- **Then**: 收藏按钮、执行按钮、删除按钮的尺寸与成功标记 badge 一致
- **Verification**: `human-judgment`

### AC-2: 双击选中功能正常
- **Given**: 用户在查询历史中
- **When**: 双击 SQL 文本
- **Then**: SQL 文本被全选（高亮显示）
- **Verification**: `human-judgment`

### AC-3: 右键菜单翻译正确
- **Given**: 用户在查询历史中
- **When**: 右键点击 SQL 文本
- **Then**: 右键菜单中的复制按钮使用当前语言显示
- **Verification**: `human-judgment`

## Files Changed
- `src/components/query-history/index.tsx`
- `src/components/query-history/QueryHistory.css`
- `src/context/LocaleContext.tsx`

# 查询历史模块布局优化 - Product Requirement Document

## Overview
- **Summary**: 优化查询历史模块的布局，将每条记录改为单行显示，提高空间利用率和可读性。
- **Purpose**: 当前查询历史每条记录占用多行空间，显示效率低，需要改为紧凑的单行布局。
- **Target Users**: QuickerSQL 用户

## Goals
- 将查询历史记录改为单行布局显示
- 收藏按钮与执行/删除按钮尺寸一致
- SQL 文本支持双击选中和右键复制

## Non-Goals (Out of Scope)
- 不修改查询历史的数据结构
- 不改变查询历史的核心功能逻辑

## Background & Context
- 当前查询历史记录显示为多行卡片式布局，占用空间较大
- 用户希望更紧凑的显示方式，能够在有限空间内查看更多历史记录

## Functional Requirements
- **FR-1**: 查询历史每条记录显示为一行，包含：状态标记、SQL文本、收藏按钮、执行按钮、删除按钮
- **FR-2**: SQL 文本过长时自动截断显示，鼠标悬停显示完整内容
- **FR-3**: 收藏按钮尺寸与执行/删除按钮一致
- **FR-4**: SQL 文本支持双击选中全部内容
- **FR-5**: SQL 文本支持右键菜单复制功能

## Acceptance Criteria

### AC-1: 单行布局显示
- **Given**: 用户查看查询历史
- **When**: 显示历史记录列表
- **Then**: 每条记录显示为一行，包含状态标记、SQL文本、收藏按钮、执行按钮、删除按钮
- **Verification**: `human-judgment`

### AC-2: SQL 文本截断显示
- **Given**: SQL 文本较长
- **When**: 查看历史记录
- **Then**: SQL 文本自动截断，鼠标悬停显示完整内容（tooltip）
- **Verification**: `human-judgment`

### AC-3: 按钮尺寸一致
- **Given**: 用户查看查询历史
- **When**: 查看按钮
- **Then**: 收藏按钮、执行按钮、删除按钮尺寸一致
- **Verification**: `human-judgment`

### AC-4: 双击选中 SQL
- **Given**: 用户在查询历史中
- **When**: 双击 SQL 文本
- **Then**: SQL 文本被全选（高亮显示）
- **Verification**: `human-judgment`

### AC-5: 右键复制 SQL
- **Given**: 用户在查询历史中
- **When**: 右键点击 SQL 文本
- **Then**: 弹出上下文菜单，包含"复制"选项
- **Verification**: `human-judgment`

## Open Questions
- [ ] 是否需要保留执行时间、行数等元信息的显示？

## Files Changed
- `src/components/query-history/index.tsx`
- `src/components/query-history/QueryHistory.css`

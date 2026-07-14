# 回收站布局分层优化 - Product Requirement Document

## Overview
- **Summary**: 优化回收站模块的布局结构，将文本信息和操作按钮分层，避免拖动分隔框时文本反复重排。
- **Purpose**: 解决左右拖动分隔框时表名、行数、删除时间反复重新渲染的问题，提升交互体验。
- **Target Users**: QuickerSQL 用户

## Goals
- 回收站每条记录的文本信息（表名、行数、删除时间）与操作按钮分层
- 拖动分隔框时，只有按钮左右移动，文本不重新布局
- 文本可以被按钮遮挡

## Non-Goals (Out of Scope)
- 不修改回收站的核心功能
- 不改变按钮的样式和功能

## Background & Context
- 当前回收站使用 flex 布局，文本和按钮在同一层
- 左右拖动分隔框时，flex 布局会导致文本反复重排，产生视觉抖动
- 查询历史模块使用了类似的分层思想，体验更好

## Functional Requirements
- **FR-1**: 回收站记录的文本信息区域（表名、行数、删除时间）使用绝对定位，固定在左侧
- **FR-2**: 操作按钮区域使用绝对定位，固定在右侧
- **FR-3**: 文本区域设置 overflow: hidden，不随容器宽度变化而重排
- **FR-4**: 当容器变窄时，按钮可以遮挡文本

## Acceptance Criteria

### AC-1: 文本与按钮分层
- **Given**: 用户查看回收站
- **When**: 查看回收站记录
- **Then**: 文本信息在下层，按钮在上层，分层显示
- **Verification**: `human-judgment`

### AC-2: 拖动时仅按钮移动
- **Given**: 用户左右拖动分隔框
- **When**: 回收站宽度变化
- **Then**: 只有按钮左右移动，文本不重新布局/换行
- **Verification**: `human-judgment`

### AC-3: 文本可被遮挡
- **Given**: 回收站宽度较窄
- **When**: 查看回收站记录
- **Then**: 按钮可以遮挡部分文本，文本不换行
- **Verification**: `human-judgment`

## Files Changed
- `src/components/trash/index.tsx`
- `src/components/trash/TrashPanel.css`

# 查询历史收藏按钮和回收站布局优化 - Product Requirement Document

## Overview
- **Summary**: 优化查询历史收藏按钮尺寸和回收站记录布局。
- **Purpose**: 解决收藏按钮过大，回收站记录占用空间过多的问题。
- **Target Users**: QuickerSQL 用户

## Goals
- 查询历史收藏按钮尺寸缩小为原来的 1/2，内部图标大小不变
- 回收站每条记录改为单行显示

## Non-Goals (Out of Scope)
- 不修改查询历史的核心功能
- 不改变回收站的核心功能

## Background & Context
- 当前查询历史收藏按钮尺寸过大，与其他按钮不协调
- 当前回收站每条记录占用多行空间，显示效率低

## Functional Requirements
- **FR-1**: 查询历史收藏按钮尺寸缩小为原来的 1/2，图标大小保持不变
- **FR-2**: 回收站每条记录改为单行显示，布局顺序：表名 | 行数 | 删除时间 | 恢复按钮 | 删除按钮

## Acceptance Criteria

### AC-1: 收藏按钮尺寸缩小
- **Given**: 用户查看查询历史
- **When**: 查看收藏按钮
- **Then**: 收藏按钮尺寸为原来的 1/2，内部图标大小不变
- **Verification**: `human-judgment`

### AC-2: 回收站单行布局
- **Given**: 用户查看回收站
- **When**: 查看回收站记录列表
- **Then**: 每条记录显示为一行，布局顺序：表名 | 行数 | 删除时间 | 恢复按钮 | 删除按钮
- **Verification**: `human-judgment`

## Files Changed
- `src/components/query-history/QueryHistory.css`
- `src/components/trash/index.tsx`
- `src/components/trash/TrashPanel.css`

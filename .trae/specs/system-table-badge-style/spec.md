# 系统表标识样式优化 - Product Requirement Document

## Overview
- **Summary**: 修改数据浏览器中系统表标识的样式，使其与行数列数的灰色风格一致。
- **Purpose**: 提升用户体验，避免白色文字在浅色背景下可读性差的问题。
- **Target Users**: QuickerSQL 用户

## Goals
- 系统表标识改为灰色风格，与行数列数标签样式一致

## Non-Goals (Out of Scope)
- 不修改系统表的功能逻辑
- 不改变其他标签的样式

## Background & Context
- 当前系统表标识使用 accent-color 背景和白色文字
- 行数、列数标签使用灰色背景和灰色文字
- 白色文字在浅色背景下用户体验差

## Functional Requirements
- **FR-1**: 系统表标识（"系统表"标签）的样式改为与行数列数标签一致的灰色风格

## Acceptance Criteria

### AC-1: 系统表标识样式与行数列数一致
- **Given**: 用户查看数据浏览器的系统表
- **When**: 查看系统表标识
- **Then**: 系统表标识的背景色和文字颜色与行数列数标签的灰色风格一致
- **Verification**: `human-judgment`

## Files Changed
- `src/components/common/DatabaseExplorer.tsx`

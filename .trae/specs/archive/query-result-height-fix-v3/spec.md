# 查询结果集高度计算修复 v3 — Product Requirement Document

## Overview
- **Summary**: 修复 flex 布局中 ag-grid 高度计算不准确导致的第二个结果集数据行被遮挡的问题
- **Purpose**: 确保所有结果集的表格内容完整可见，无论列数多少、是否有水平滚动条
- **Target Users**: QuickerSQL 用户

## Goals
- G1: 所有结果集（单列/多列、有/无水平滚动条）的表格数据行完整可见
- G2: 分页信息、警告信息始终可见，不被遮挡
- G3: 不引入新的技术债

## Non-Goals (Out of Scope)
- ❌ 不修改表格功能逻辑
- ❌ 不修改右键菜单功能
- ❌ 不涉及其他组件

## Background & Context
- 之前已尝试多次修复结果集高度问题（contentHeight 计算、flex 布局、minHeight: 0）
- 目前第一个结果集（单列，无水平滚动条）正常，第二个结果集（多列，有水平滚动条）数据行被遮挡
- 根因分析：flex 布局中，`minHeight: 0` 只能让元素收缩，但子元素的 `height: 100%` 需要父元素有**明确的高度值**才能正确计算
- 在 flex 列布局中，正确的做法是用 `height: 0` + `flex: 1`，这样子元素的百分比高度才能正确计算

## Functional Requirements
- **FR-1**: 单列结果集表格显示正常
- **FR-2**: 多列结果集（有水平滚动条）表格显示正常
- **FR-3**: 分页信息、警告信息始终可见
- **FR-4**: 数据多时表格内部可垂直滚动

## Non-Functional Requirements
- **NFR-1**: 不引入新的技术债
- **NFR-2**: 保持代码风格一致
- **NFR-3**: 不影响表格其他功能

## Constraints
- **Technical**: React + TypeScript + ag-grid-community + flex 布局

## Assumptions
- 问题根因是 flex 布局中 `height: 100%` 的计算需要父元素有明确高度
- 使用 `height: 0` + `flex: 1` 可以解决这个问题

## Acceptance Criteria

### AC-1: 单列结果集显示正常
- **Given**: 查询结果只有 1 列
- **When**: 查看结果集
- **Then**: 数据行完整可见，分页信息完整可见
- **Verification**: `human-judgment`

### AC-2: 多列结果集显示正常
- **Given**: 查询结果有多列（需要水平滚动）
- **When**: 查看结果集
- **Then**: 数据行完整可见，水平滚动条完整可见，分页信息完整可见
- **Verification**: `human-judgment`

### AC-3: 多行结果集显示正常
- **Given**: 查询结果有多行（超过一页）
- **When**: 查看结果集
- **Then**: 表格区域可垂直滚动，分页信息完整可见
- **Verification**: `human-judgment`

### AC-4: 代码质量
- **Given**: 修改完成
- **When**: 运行 TypeScript 类型检查
- **Then**: 无类型错误
- **Verification**: `programmatic`

## Open Questions
- 无

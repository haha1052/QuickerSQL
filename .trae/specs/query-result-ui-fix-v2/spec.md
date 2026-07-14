# 查询结果集 UI 问题修复 v2 — Product Requirement Document

## Overview
- **Summary**: 修复查询结果集表格底部内容遮挡问题，以及右键菜单重复出现（浏览器默认菜单 + 自定义菜单）的问题
- **Purpose**: 提升用户体验，确保表格内容完整可见，右键菜单行为符合预期
- **Target Users**: QuickerSQL 用户

## Goals
- G1: 表格底部内容（滚动条、最后一行数据）完整可见，无遮挡
- G2: 表格右键时只显示自定义菜单，不显示浏览器默认右键菜单

## Non-Goals (Out of Scope)
- ❌ 不修改表格功能逻辑
- ❌ 不修改右键菜单项内容
- ❌ 不涉及其他组件的右键菜单

## Background & Context
- 之前已尝试用 flex 布局修复高度问题，但表格底部仍然有遮挡
- ag-grid 在 flex 容器中的高度计算需要特殊处理（`minHeight: 0`）
- 当前 `handleGridContextMenu` 中已调用 `preventDefault()`，但浏览器默认菜单仍然出现，可能是事件传播或 ag-grid 事件机制的问题

## Functional Requirements
- **FR-1**: 表格区域正确计算高度，底部滚动条和数据行完整可见
- **FR-2**: 表格区域右键时，浏览器默认右键菜单被完全阻止
- **FR-3**: 自定义右键菜单正常显示和工作

## Non-Functional Requirements
- **NFR-1**: 不引入新的技术债
- **NFR-2**: 保持代码风格与现有代码一致
- **NFR-3**: 不影响表格的其他功能（排序、过滤、分页等）

## Constraints
- **Technical**: React + TypeScript + ag-grid-community
- **Business**: 必须保持与现有 UI 风格一致

## Assumptions
- 表格遮挡问题是 flex 容器与 ag-grid 高度计算交互导致的
- 右键菜单重复是因为浏览器默认菜单未被完全阻止

## Acceptance Criteria

### AC-1: 表格底部内容完整可见
- **Given**: 查询结果有数据行
- **When**: 查看结果集表格
- **Then**: 表格底部的水平滚动条和最后一行数据完整可见，无遮挡
- **Verification**: `human-judgment`

### AC-2: 单条结果（1行）时布局正常
- **Given**: 查询结果只有 1 行数据
- **When**: 查看结果集
- **Then**: 表格高度自适应，无多余空白，底部内容完整可见
- **Verification**: `human-judgment`

### AC-3: 多行结果时分页信息完整可见
- **Given**: 查询结果超过一页
- **When**: 查看结果集
- **Then**: 分页信息、警告信息完整可见，无遮挡
- **Verification**: `human-judgment`

### AC-4: 右键只显示自定义菜单
- **Given**: 查询结果有数据
- **When**: 在表格单元格上点击右键
- **Then**: 只显示自定义的复制菜单，不显示浏览器默认右键菜单
- **Verification**: `human-judgment`

### AC-5: 右键菜单功能正常
- **Given**: 右键菜单已显示
- **When**: 点击菜单项
- **Then**: 对应功能正常工作（复制单元格、复制行等）
- **Verification**: `human-judgment`

### AC-6: 代码质量
- **Given**: 修改完成
- **When**: 运行 TypeScript 类型检查
- **Then**: 无类型错误
- **Verification**: `programmatic`

## Open Questions
- 无

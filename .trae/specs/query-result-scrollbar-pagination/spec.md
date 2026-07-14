# 查询结果集滚动条与分页优化 — Product Requirement Document

## Overview
- **Summary**: 修复水平滚动条遮挡数据行问题，并调整分页默认行为
- **Purpose**: 确保表格数据完整可见，提升大数据量下的浏览体验
- **Target Users**: QuickerSQL 用户

## Goals
- G1: 有水平滚动条时，数据行不被滚动条遮挡，完整可见
- G2: 结果集超过 100 行时，默认启用分页，每页 100 行
- G3: 保持现有设置项的灵活性（用户可自定义分页大小）

## Non-Goals (Out of Scope)
- ❌ 不修改表格功能逻辑
- ❌ 不修改右键菜单功能
- ❌ 不删除现有设置项

## Background & Context
- 当前问题1：当表格列数较多出现水平滚动条时，滚动条约占约 14-17px 高度，但表格高度计算未预留滚动条空间，导致最后一行数据被滚动条遮挡
- 当前问题2：`result_page_size` 设置默认值为 1000，但 `QueryResultItem.tsx` 中默认是 20，且分页逻辑只在 `totalPages > 1` 时启用
- 用户需求：超过 100 行时默认分页显示，每页 100 行

## Functional Requirements
- **FR-1**: 有水平滚动条时，表格底部预留滚动条高度，数据行完整可见
- **FR-2**: 结果集行数 > 100 时默认启用分页
- **FR-3**: 分页默认每页 100 行（`result_page_size` 默认值改为 100）
- **FR-4**: 用户可在设置中自定义分页大小

## Non-Functional Requirements
- **NFR-1**: 不引入新的技术债
- **NFR-2**: 保持代码风格一致
- **NFR-3**: 不影响表格其他功能

## Constraints
- **Technical**: React + TypeScript + ag-grid-community
- **Business**: 保持设置系统已有的 `result_page_size` 设置项

## Assumptions
- 水平滚动条高度约为 17px（Windows 系统默认滚动条宽度）
- 100 行是合理的默认分页大小

## Acceptance Criteria

### AC-1: 单列结果显示正常
- **Given**: 查询结果只有 1 列（无水平滚动条）
- **When**: 查看结果集
- **Then**: 数据行完整可见，无多余空白
- **Verification**: `human-judgment`

### AC-2: 多列结果（有水平滚动条）显示正常
- **Given**: 查询结果有多列（出现水平滚动条）
- **When**: 查看结果集
- **Then**: 所有数据行完整可见，水平滚动条不遮挡数据
- **Verification**: `human-judgment`

### AC-3: 超过100行默认分页
- **Given**: 查询结果超过 100 行
- **When**: 查看结果集
- **Then**: 默认显示分页，每页 100 行
- **Verification**: `human-judgment`

### AC-4: 少于等于100行不分页
- **Given**: 查询结果 ≤ 100 行
- **When**: 查看结果集
- **Then**: 不显示分页，一次性显示所有行
- **Verification**: `human-judgment`

### AC-5: 设置自定义分页大小生效
- **Given**: 用户在设置中修改了分页大小
- **When**: 查看结果集
- **Then**: 分页大小按设置值显示
- **Verification**: `human-judgment`

### AC-6: 代码质量
- **Given**: 修改完成
- **When**: 运行 TypeScript 类型检查和 Rust 编译检查
- **Then**: 无错误
- **Verification**: `programmatic`

## Open Questions
- 无

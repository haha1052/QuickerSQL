# SQL查询标签页改进 - 产品需求文档

## Overview
- **Summary**: 解决SQL查询标签页的三个问题：标签页名称过长、水平滚动不生效、SQL内容不持久化保存。
- **Purpose**: 提升用户在SQL编辑器中的使用体验，确保标签页命名清晰、标签过多时可滚动、编辑的SQL内容能够持久化保存。
- **Target Users**: 所有使用SQL查询功能的用户

## Goals
- 标签页名称简化为 QUERY + 序号（如 QUERY 1, QUERY 2）
- 序号根据当前SQL查询标签页数量动态计算（从1开始）
- 标签过多时支持水平滚动
- SQL编辑器内容自动保存并在重新打开后恢复

## Non-Goals (Out of Scope)
- 不修改后端数据存储结构
- 不改变现有的SQL执行逻辑
- 不修改其他功能模块

## Background & Context
- 当前标签页名称使用 `SQL Query ${Date.now()}` 或 `${t('workspace.sqlQuery')} ${tabs.length + 1}`，名称过长且不直观
- 标签栏已有 `overflowX: auto` 设置，但可能因布局问题不生效
- queryStore 的 persist 配置中 partialize 只保存了 queryHistory，没有保存 sqlQueries，导致SQL内容不持久化

## Functional Requirements
- **FR-1**: 新建标签页名称简化为 QUERY + 简单序号（如 QUERY 1, QUERY 2）
- **FR-2**: 序号根据当前SQL查询标签页数量动态计算，删除标签后序号自动调整
- **FR-3**: 标签栏支持水平滚动，当标签数量超过显示宽度时可左右滚动查看
- **FR-4**: SQL编辑器内容自动保存到 localStorage
- **FR-5**: 重新打开应用后，之前编辑的SQL内容能够恢复

## Non-Functional Requirements
- **NFR-1**: 标签栏水平滚动流畅
- **NFR-2**: SQL内容保存及时，无明显延迟
- **NFR-3**: 布局变化不应影响其他功能

## Constraints
- **Technical**: React + Zustand状态管理，Tauri框架
- **Dependencies**: 现有 queryStore、workspaceStore、WorkspaceTabs、Toolbar 组件

## Assumptions
- 序号只在标签页显示时使用，不影响内部ID
- 序号从1开始，按创建顺序递增
- localStorage 存储容量足够保存多个查询

## Acceptance Criteria

### AC-1: 标签页名称简化
- **Given**: 用户打开SQL查询页面并新建标签页
- **When**: 查看标签页名称
- **Then**: 标签页名称显示为 QUERY 1, QUERY 2, QUERY 3 等简单格式
- **Verification**: `human-judgment`

### AC-2: 序号动态计算
- **Given**: 用户创建多个标签页后删除其中一个
- **When**: 查看剩余标签页的序号
- **Then**: 序号根据当前标签页数量动态调整（保持连续）
- **Verification**: `human-judgment`

### AC-3: 标签栏支持水平滚动
- **Given**: 用户创建多个标签页（超过显示宽度）
- **When**: 查看标签栏
- **Then**: 标签栏显示水平滚动条，可左右滚动查看所有标签
- **Verification**: `human-judgment`

### AC-4: SQL内容自动保存
- **Given**: 用户在SQL编辑器中输入内容
- **When**: 切换标签页或关闭应用
- **Then**: SQL内容自动保存到 localStorage
- **Verification**: `human-judgment`

### AC-5: SQL内容重新打开后恢复
- **Given**: 用户在SQL编辑器中输入内容并关闭应用
- **When**: 重新打开应用
- **Then**: 之前编辑的SQL内容能够恢复显示
- **Verification**: `human-judgment`

## Open Questions
- [ ] 是否需要手动保存按钮？（当前设计：自动保存）
- [ ] 是否需要显示保存状态提示？（当前设计：不需要，静默保存）

# SQL编辑器布局与自动保存改进 - 产品需求文档

## Overview
- **Summary**: 改进SQL编辑器的布局管理和自动保存功能，包括增加多种布局方式、修改默认布局为100%编辑器、修复SQL内容持久化问题。
- **Purpose**: 提升用户在SQL编辑器中的使用体验，支持灵活的布局切换，并确保编辑的SQL内容能够正确持久化保存。
- **Target Users**: 所有使用SQL查询功能的用户

## Goals
- 增加4种布局方式：100%编辑器、80%编辑器/20%结果、50%编辑器/50%结果、20%编辑器/80%结果
- 修改布局按钮仅影响当前标签页，不影响其他标签页
- 修改默认初始化布局为100% SQL编辑器
- 修复SQL编辑器内容不保存的bug，实现自动保存和手动保存功能

## Non-Goals (Out of Scope)
- 不修改后端数据存储结构
- 不添加新的数据表
- 不改变现有的SQL执行逻辑

## Background & Context
- 当前布局按钮只有两种布局方式，用户反馈不够灵活
- 当前初始化显示单一布局，点击标签页后显示1:1布局，逻辑不一致
- SQL编辑器内容没有正确持久化，每次打开都丢失之前的编辑内容
- 系统已有自动保存设置（每30秒），但未正确实现

## Functional Requirements
- **FR-1**: 布局按钮提供4种布局选项，点击后仅修改当前标签页的布局
- **FR-2**: 新建标签页时默认使用100%编辑器布局
- **FR-3**: SQL编辑器内容自动保存到本地存储，每30秒触发一次
- **FR-4**: 提供手动保存按钮，允许用户随时保存当前SQL

## Non-Functional Requirements
- **NFR-1**: 自动保存不应影响用户编辑体验（无感知）
- **NFR-2**: 布局切换应立即生效，无明显延迟

## Constraints
- **Technical**: React + Zustand状态管理，Tauri框架
- **Dependencies**: 依赖现有的zustand persist中间件和tauri存储API

## Assumptions
- 用户期望布局设置仅影响当前工作标签页
- 用户期望SQL内容在应用重启后仍然保留

## Acceptance Criteria

### AC-1: 布局选项增加到4种
- **Given**: 用户打开SQL查询页面
- **When**: 用户点击布局按钮
- **Then**: 下拉菜单显示4种布局选项：100%编辑器、80%编辑器/20%结果、50%编辑器/50%结果、20%编辑器/80%结果
- **Verification**: `human-judgment`

### AC-2: 布局切换仅影响当前标签页
- **Given**: 用户有多个SQL查询标签页
- **When**: 用户在某一个标签页切换布局
- **Then**: 只有当前标签页的布局发生变化，其他标签页保持不变
- **Verification**: `human-judgment`

### AC-3: 默认布局为100%编辑器
- **Given**: 用户打开新的SQL查询标签页
- **When**: 页面初始化完成
- **Then**: 默认显示100%编辑器布局，结果面板隐藏
- **Verification**: `human-judgment`

### AC-4: SQL内容自动保存
- **Given**: 用户在SQL编辑器中输入内容
- **When**: 用户停止输入超过30秒
- **Then**: SQL内容自动保存到本地存储
- **Verification**: `programmatic` - 检查localStorage或indexedDB中是否有SQL内容

### AC-5: 手动保存功能
- **Given**: 用户在SQL编辑器中输入内容
- **When**: 用户点击保存按钮
- **Then**: SQL内容立即保存到本地存储
- **Verification**: `human-judgment`

### AC-6: SQL内容持久化
- **Given**: 用户编辑SQL并关闭应用
- **When**: 用户重新打开应用
- **Then**: 之前编辑的SQL内容仍然存在
- **Verification**: `human-judgment`

## Open Questions
- [ ] 是否需要添加保存状态指示器？
- [ ] 是否需要支持快捷键保存（如Ctrl+S）？
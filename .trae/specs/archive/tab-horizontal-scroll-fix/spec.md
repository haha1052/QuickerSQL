# 标签栏水平滚动修复 - 产品需求文档

## Overview
- **Summary**: 深入分析并修复SQL查询标签栏水平滚动不生效的问题，确保标签数量超过显示宽度时自动出现水平滚动条。
- **Purpose**: 解决用户反馈的"不断增加SQL查询标签页，标签不断往后追加，没有出现水平滚动条"的问题。
- **Target Users**: 所有使用SQL查询功能的用户

## Goals
- 标签数量超过显示宽度时，标签栏自动出现水平滚动
- 滚动流畅，用户体验良好
- 滚动条样式美观或隐藏（保持功能）

## Non-Goals (Out of Scope)
- 不修改后端数据存储结构
- 不改变现有的SQL执行逻辑
- 不修改其他功能模块

## Background & Context

### 当前布局结构
```
tabsAndExecutionRow (flex, height: 32px)
├── tabsSection (flex: 1, overflow: hidden)
│   └── WorkspaceTabs
│       └── tabsContainer (flex: 1, overflowX: auto) ← 滚动在这里
│           └── tabsList (flex: 1)
│               ├── tab 1
│               ├── tab 2
│               └── ...
└── executeButtonSection (flexShrink: 0)
```

### 问题根本原因分析

1. **min-width: auto 问题**
   - Flex 子元素默认 `min-width: auto`，这意味着元素的最小宽度由内容决定
   - 当标签数量很多时，`tabsList` 的内容宽度会撑大父容器
   - 即使设置了 `overflow: auto`，如果父容器被内容撑大了，也不会出现滚动条

2. **滚动层级问题**
   - 当前滚动设置在 `tabsContainer` 上
   - 但 `tabsContainer` 本身是 flex 子元素，`flex: 1` 配合 `min-width: auto` 会让它扩展到内容宽度
   - 导致没有溢出，也就不会出现滚动条

3. **tabsList 的 flex: 1 问题**
   - `tabsList` 设置了 `flex: 1`，它会试图填充 `tabsContainer` 的空间
   - 但如果 `tabsContainer` 本身没有宽度约束，`tabsList` 就会无限扩展

### 解决方案

正确的做法是：
1. 给所有 flex 容器层级添加 `min-width: 0`，允许 flex 子元素被压缩到小于内容宽度
2. 将滚动放在正确的层级（`tabsList` 或 `tabsContainer`）
3. 确保内容容器（标签列表）有 `flex-shrink: 0` 的标签项

具体修改：
- `tabsSection`: 保持 `overflow: hidden`，添加 `min-width: 0`
- `tabsContainer`: 移除 `flex: 1`，改为 `width: 100%`，添加 `min-width: 0`
- `tabsList`: 移除 `flex: 1`，改为 `min-width: max-content` 或直接让内容撑开，添加 `overflow-x: auto`

## Functional Requirements
- **FR-1**: 标签数量超过显示宽度时，标签栏自动出现水平滚动
- **FR-2**: 可以通过鼠标滚轮或拖拽滚动条来滚动查看所有标签
- **FR-3**: 新建标签按钮始终跟随在标签列表后面，随列表一起滚动

## Non-Functional Requirements
- **NFR-1**: 滚动流畅，无卡顿
- **NFR-2**: 滚动条样式与整体UI风格一致（或隐藏滚动条但保留功能）
- **NFR-3**: 布局变化不应影响其他功能

## Constraints
- **Technical**: React + CSS 内联样式
- **Dependencies**: 现有 WorkspaceTabs、Workspace 组件

## Assumptions
- 新建标签按钮应该在标签列表末尾，随列表一起滚动
- 隐藏滚动条但保留滚动功能是可以接受的

## Acceptance Criteria

### AC-1: 标签过多时出现水平滚动
- **Given**: 用户创建了多个标签页
- **When**: 标签数量超过标签栏的显示宽度
- **Then**: 标签栏支持水平滚动，可以查看所有标签
- **Verification**: `human-judgment`

### AC-2: 滚动功能正常
- **Given**: 标签栏出现水平滚动
- **When**: 用户使用鼠标滚轮水平滚动
- **Then**: 标签列表可以左右滚动，显示所有标签
- **Verification**: `human-judgment`

### AC-3: 新建按钮跟随滚动
- **Given**: 标签栏出现水平滚动
- **When**: 用户滚动标签列表
- **Then**: 新建标签按钮（+）跟随标签列表一起滚动，始终在最后一个标签后面
- **Verification**: `human-judgment`

### AC-4: 其他功能不受影响
- **Given**: 水平滚动功能正常
- **When**: 用户使用其他功能（切换标签、关闭标签、执行SQL等）
- **Then**: 所有功能正常工作，不受滚动影响
- **Verification**: `human-judgment`

## Open Questions
- [ ] 是否需要显示滚动条？（当前设计：隐藏滚动条但保留滚动功能）

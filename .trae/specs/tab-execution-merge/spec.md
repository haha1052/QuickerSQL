# 标签栏与执行栏合并 - 产品需求文档

## Overview
- **Summary**: 将SQL查询页面的标签栏和执行栏合并为同一行，左侧显示标签页+新建按钮，右侧显示执行按钮，优化垂直空间利用率。
- **Purpose**: 减少SQL编辑器头部占用的垂直空间，将标签操作和执行操作整合在同一行，提升用户操作效率。
- **Target Users**: 所有使用SQL查询功能的用户

## Goals
- 标签栏和执行栏合并为一行
- 左侧：SQL查询标签页（水平滚动）+ 新建标签按钮（+）
- 右侧：执行按钮
- 减少头部垂直空间占用

## Non-Goals (Out of Scope)
- 不修改后端数据存储结构
- 不改变现有的SQL执行逻辑
- 不修改工具栏（第一行）的功能
- 不修改SQL编辑器主体内容

## Background & Context
- 当前布局：第一行工具栏，第二行标签栏，第三行开始是编辑器（编辑器内部还有ExecutionBar）
- 用户反馈：标签栏和执行栏可以合并，减少头部高度
- 当前ExecutionBar包含：新建标签按钮、查询名称、执行按钮
- 当前WorkspaceTabs只显示标签页，没有新建按钮

## Layout Structure (目标布局)

```
┌─────────────────────────────────────────────────────────────────┐
│ 第一行：工具栏（功能栏，保持干净的符号+中文）                      │
├─────────────────────────────────────────────────────────────────┤
│ 第二行（合并行）：                                                │
│  [标签1][标签2][标签3][+]                         ▶ 执行 SQL    │
│  （左侧，水平滚动）                     （右侧）                 │
├─────────────────────────────────────────────────────────────────┤
│ 第三行：SQL编辑器 + 结果面板                                     │
└─────────────────────────────────────────────────────────────────┘
```

## Functional Requirements
- **FR-1**: 第二行合并标签栏和执行栏为同一行
- **FR-2**: 左侧显示SQL查询标签页列表，支持水平滚动
- **FR-3**: 标签页列表后面跟新建标签按钮（+）
- **FR-4**: 右侧显示执行按钮（执行当前标签页的SQL）
- **FR-5**: 原ExecutionBar中的查询名称不再显示在头部（节省空间）
- **FR-6**: 原ExecutionBar中的新建标签按钮移到标签页列表后面

## Non-Functional Requirements
- **NFR-1**: 布局调整应立即生效，无明显延迟
- **NFR-2**: 布局变化不应影响其他功能
- **NFR-3**: 标签过多时水平滚动流畅

## Constraints
- **Technical**: React + Zustand状态管理，Tauri框架
- **Dependencies**: 现有WorkspaceTabs、ExecutionBar、PanelManager组件

## Assumptions
- 查询名称可以省略，因为标签页标题已经能标识查询
- 执行按钮只需要一个，执行当前活动标签页的SQL
- 新建标签按钮放在标签页列表后面更符合用户操作习惯

## Acceptance Criteria

### AC-1: 标签栏和执行栏合并为一行
- **Given**: 用户打开SQL查询页面
- **When**: 查看页面布局
- **Then**: 标签页和执行按钮在同一行显示
- **Verification**: `human-judgment`

### AC-2: 左侧标签页支持水平滚动
- **Given**: 用户创建了多个查询标签页
- **When**: 标签页数量超过显示宽度
- **Then**: 标签栏支持水平滚动查看所有标签
- **Verification**: `human-judgment`

### AC-3: 标签页后跟新建按钮
- **Given**: 用户查看标签栏
- **When**: 标签页列表显示
- **Then**: 标签页列表最后有一个加号（+）按钮，点击可新建标签页
- **Verification**: `human-judgment`

### AC-4: 右侧显示执行按钮
- **Given**: 用户打开SQL查询页面
- **When**: 查看合并行的右侧
- **Then**: 显示执行按钮，点击可执行当前标签页的SQL
- **Verification**: `human-judgment`

### AC-5: 执行按钮正常工作
- **Given**: 用户在SQL编辑器中输入了SQL语句
- **When**: 点击执行按钮
- **Then**: 执行当前标签页的SQL查询并显示结果
- **Verification**: `human-judgment`

### AC-6: 新建标签按钮正常工作
- **Given**: 用户查看标签栏
- **When**: 点击加号（+）按钮
- **Then**: 创建一个新的SQL查询标签页
- **Verification**: `human-judgment`

### AC-7: 编辑器内部不再显示ExecutionBar
- **Given**: 用户打开SQL查询页面
- **When**: 查看SQL编辑器区域
- **Then**: 编辑器顶部不再有ExecutionBar（执行栏已移到合并行）
- **Verification**: `human-judgment`

## Open Questions
- [ ] 是否需要在执行按钮旁显示查询名称？（当前设计：不显示，节省空间）

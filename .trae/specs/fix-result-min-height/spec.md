# 结果集最小高度设置失效修复 - Product Requirement Document

## Overview
- **Summary**: 修复设置系统中"结果集最小高度"配置修改后无视觉效果的问题，确保高度设置正确作用于表格区域
- **Purpose**: 用户在设置中调整 result_min_height 后，结果集表格区域的高度没有对应变化，导致设置项形同虚设。需要梳理完整的高度控制链路，修复 flex 布局和 ag-grid 模式的配合问题
- **Target Users**: 使用 SQL 查询功能的所有用户

## Goals
- 修改 result_min_height 设置后，结果集表格区域的最小高度能正确变化
- 修改 result_max_height 设置后，结果集表格区域的最大高度能正确变化
- 保持分页功能正常工作
- 保持设置系统的一致性体验

## Non-Goals (Out of Scope)
- 不修改设置系统的存储逻辑
- 不修改设置项的定义和默认值
- 不增加新的设置项
- 不重构 QueryResultItem 的整体结构

## Background & Context

### 当前高度控制链路（有问题）
```
设置系统: result_min_height=200, result_max_height=800
    │
    ▼
QueryResultItem:
  container (flex column)
    style={{ minHeight: resultMinHeight, maxHeight: resultMaxHeight }}
    ├─ header (flexShrink: 0)          ← 标题栏，固定 ~48px
    └─ 内容 (没有 flex:1!)
        ├─ tableWrapper (minHeight: 80, hardcoded)
        │   └─ tableContainer
        │       style={{ minHeight: 设置值, maxHeight: tableMaxHeight }}
        │       └─ AgGridLazy (domLayout="autoHeight")  ← 高度由内容决定，不填充父容器
        └─ paginationInfo (flexShrink: 0)
```

### 问题根因
1. **flex 布局不完整**: container 设置了 minHeight，但中间内容区域没有 `flex: 1`，不会撑开填充剩余空间
2. **ag-grid autoHeight 模式**: `domLayout="autoHeight"` 下，ag-grid 高度完全由行数决定，即使父容器有 minHeight，表格也不会变高，只是底部留白
3. **用户感知**: 从视觉上看表格高度没变，所以用户感觉"设置没反应"

### 之前的修复尝试
- 已将 tableContainer 的硬编码 minHeight 改为使用设置值 → 但因为 autoHeight 模式，表格本身没变化
- 外层 container 已经设置了 minHeight → 但内容区域没 flex:1，视觉上表格高度没变

## Functional Requirements

- **FR-1**: result_min_height 设置正确控制结果集表格区域的最小高度
- **FR-2**: result_max_height 设置正确控制结果集表格区域的最大高度
- **FR-3**: 内容行数少时，表格区域保持最小高度（底部允许留白或由 ag-grid 自动填充）
- **FR-4**: 内容行数多时，表格区域不超过最大高度，内部滚动
- **FR-5**: 分页功能正常，分页栏始终可见

## Non-Functional Requirements

- **NFR-1**: 不引入新的性能问题（ag-grid 虚拟滚动保持正常）
- **NFR-2**: 不破坏现有的表格交互功能（筛选、排序、右键菜单等）

## Constraints

- **Technical**: 必须使用 ag-grid community 版，保持现有的 React + Zustand 技术栈
- **Dependencies**: 依赖现有的设置系统（SettingsContext）
- **兼容性**: 必须兼容现有的分页模式

## Assumptions

- 用户期望的"最小高度"是指整个结果卡片（包含标题栏）的最小高度
- 表格区域高度 = 卡片高度 - 标题栏高度 - 分页栏高度
- 内容少时底部有留白是可接受的（只要最小高度设置有视觉效果）

## Acceptance Criteria

### AC-1: 最小高度设置生效
- **Given**: 用户在设置中修改 result_min_height 为不同值（如 100, 200, 400）
- **When**: 用户返回 SQL 查询页面查看只有少量行数据的结果集
- **Then**: 结果集卡片的高度会随着设置值变化，设置值越大卡片越高
- **Verification**: `human-judgment`
- **Notes**: 需要用肉眼对比不同设置值下结果集高度的变化

### AC-2: 最大高度设置生效
- **Given**: result_max_height 设置为较小值（如 300）
- **When**: 查看有大量行数据的结果集
- **Then**: 表格区域不超过最大高度，内部出现滚动条
- **Verification**: `human-judgment`

### AC-3: 分页功能正常
- **Given**: 结果集有多页数据
- **When**: 用户点击分页控件切换页码
- **Then**: 分页正常工作，分页栏始终可见
- **Verification**: `human-judgment`

### AC-4: TypeScript 编译通过
- **Given**: 代码修改完成
- **When**: 运行 npx tsc --noEmit --pretty
- **Then**: 0 errors
- **Verification**: `programmatic`

### AC-5: 不影响表格交互
- **Given**: 修改后的表格
- **When**: 用户进行筛选、排序、复制等操作
- **Then**: 所有交互功能正常工作
- **Verification**: `human-judgment`

## Open Questions

- [ ] 用户期望的最小高度是"整个卡片高度"还是"仅表格区域高度"？（假设是整个卡片高度，与设置项描述一致）

# 仪表盘功能修复 - Product Requirement Document

## Overview
- **Summary**: 修复仪表盘界面的多个功能问题，包括刷新功能、图表点击交互、编辑窗口布局、布局编辑功能
- **Purpose**: 提升仪表盘的可用性和用户体验，确保核心功能正常工作
- **Target Users**: 所有使用仪表盘功能的用户

## Goals
- G1: 修复刷新功能，点击刷新能正确重新加载仪表盘布局和图表数据
- G2: 将图表单击选中改为双击打开编辑面板
- G3: 修复编辑图表窗口遮挡顶部导航栏的问题
- G4: 修复图表布局编辑功能（大小调整、间距修改）

## Non-Goals (Out of Scope)
- ❌ 不修改后端数据库结构
- ❌ 不重写整个仪表盘组件
- ❌ 不添加新功能（如拖拽排序）
- ❌ 不修改图表渲染逻辑

## Background & Context
- 用户反馈仪表盘存在多个可用性问题：
  1. 选中仪表盘后，点击刷新无法刷新出之前保存的布局，反而需要添加图表后才能进入仪表盘
  2. 单击图表就弹出编辑面板，体验不佳，应该改为双击
  3. 编辑图表窗口遮挡顶部导航栏，图表配置看不全
  4. 进入编辑模式后，无法修改图表的大小和长短，图表间的间距修改后没有实际效果

## Functional Requirements
- **FR-1**: 修复刷新功能
  - 点击刷新按钮时，重新加载 savedCharts 和 dashboards 数据
  - 触发 DashboardItem 重新渲染
- **FR-2**: 修改图表点击交互
  - 单击图表：选中图表（显示边框）
  - 双击图表：打开编辑面板
- **FR-3**: 修复编辑图表窗口布局
  - 编辑图表窗口不应遮挡顶部导航栏
  - 确保所有配置项可见
- **FR-4**: 修复布局编辑功能
  - 修复缩放手柄的大小调整逻辑
  - 修复图表间距修改后不生效的问题

## Non-Functional Requirements
- **NFR-1**: 不影响其他功能（SQL 查询、数据导入等）
- **NFR-2**: TypeScript 编译 0 errors
- **NFR-3**: Rust 编译 0 errors
- **NFR-4**: 所有单元测试通过
- **NFR-5**: 不引入新的技术债

## Constraints
- **Technical**: React / TypeScript / Zustand / ECharts
- **Business**: 快速修复，不做大规模重构
- **Dependencies**: 不引入新的依赖

## Assumptions
- 现有代码结构基本合理，只需修复特定问题
- 用户反馈的问题可以通过局部修改解决

## Acceptance Criteria

### AC-1: 刷新功能修复
- **Given**: 用户打开仪表盘页面，选中一个已保存的仪表盘
- **When**: 点击刷新按钮
- **Then**: 图表重新加载，显示最新数据
- **Verification**: `programmatic`
- **Notes**: 需要确保 refreshCharts 重新加载 savedCharts

### AC-2: 双击打开编辑面板
- **Given**: 用户在仪表盘页面
- **When**: 单击图表
- **Then**: 图表被选中（显示边框），不打开编辑面板
- **Verification**: `human-judgment`

- **Given**: 用户在仪表盘页面
- **When**: 双击图表
- **Then**: 编辑面板从右侧滑出
- **Verification**: `human-judgment`

### AC-3: 编辑窗口不遮挡导航栏
- **Given**: 用户打开编辑图表面板
- **When**: 查看窗口位置
- **Then**: 窗口从顶部导航栏下方开始，不遮挡顶部标签栏
- **Verification**: `human-judgment`

### AC-4: 布局编辑功能修复
- **Given**: 用户进入编辑模式
- **When**: 拖动缩放手柄调整图表大小
- **Then**: 图表大小正确变化
- **Verification**: `human-judgment`

- **Given**: 用户修改图表间距设置
- **When**: 应用设置
- **Then**: 图表间距正确变化
- **Verification**: `human-judgment`

## Open Questions
- [ ] Q1: 刷新时是否需要重新加载数据库中的仪表盘数据？
- [ ] Q2: 双击的时间间隔应该是多少？使用标准的 300ms 还是自定义？

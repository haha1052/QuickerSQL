# 仪表盘图表间距修复 - Product Requirement Document

## Overview
- **Summary**: 修复仪表盘图表间距设置为0后实际显示仍有间距的问题
- **Purpose**: 确保图表间距设置能够正确生效，提升仪表盘布局精确可控
- **Target Users**: 所有使用仪表盘功能的用户

## Goals
- G1: 修复 gridGap 设置为 0 时，图表之间没有间距
- G2: 确保 gridGap 设置值与实际显示一致
- G3: 不影响其他仪表盘功能

## Non-Goals (Out of Scope)
- ❌ 不修改后端数据库结构
- ❌ 不重写整个仪表盘布局系统
- ❌ 不添加新的布局功能

## Background & Context
- 用户反馈：将图表间距设置为0后，图表之间仍然有明显间距
- 从截图可以看到图表之间有绿色和蓝色的间隔区域
- 问题可能的原因：
  1. DashboardItem 内部有 12px 的 padding（itemContainer）
  2. 缩放手柄区域可能占用了额外空间
  3. grid gap 计算可能有问题

## Functional Requirements
- **FR-1**: 修复 gridGap 设置为 0 时图表仍有间距的问题
  - 检查 DashboardItem 内部 padding 是否造成视觉间距
  - 确保 grid gap 正确应用到 CSS grid 上
- **FR-2**: 确保间距设置实时预览正确
  - 修改间距设置后，画布上立即反映出来

## Non-Functional Requirements
- **NFR-1**: 不影响其他功能
- **NFR-2**: TypeScript 编译 0 errors
- **NFR-3**: Rust 编译 0 errors
- **NFR-4**: 所有单元测试通过

## Constraints
- **Technical**: React / TypeScript / CSS Grid
- **Business**: 快速修复
- **Dependencies**: 不引入新依赖

## Assumptions
- 问题出在前端样式，后端数据是正确的
- 可以通过局部修改解决

## Acceptance Criteria

### AC-1: 间距设为0时图表紧贴
- **Given**: 用户将图表间距设置为 0
- **When**: 查看仪表盘
- **Then**: 图表之间没有可见间距，图表边框紧贴在一起
- **Verification**: `human-judgment`

### AC-2: 间距设置与实际显示一致
- **Given**: 用户设置图表间距为 N 像素
- **When**: 查看仪表盘
- **Then**: 图表之间的间距正好是 N 像素
- **Verification**: `human-judgment`

### AC-3: 不影响其他功能
- **Given**: 修改间距设置
- **When**: 使用其他仪表盘功能
- **Then**: 其他功能正常工作
- **Verification**: `programmatic`

## Open Questions
- [ ] Q1: 用户说的"间距"是指图表边框之间的距离还是图表内容之间的距离？

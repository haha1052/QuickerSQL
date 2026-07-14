# 仪表盘背景设置后图表加载失败修复 - Product Requirement Document

## Overview
- **Summary**: 修复用户反馈的"修改背景后图表加载失败"问题。从代码层面全面排查 dashboard 更新流程，加固数据读取和写入的健壮性，确保背景设置功能稳定可用。
- **Purpose**: 解决用户在修改仪表盘背景设置后出现的图表加载失败问题，确保背景设置功能的稳定性和可靠性。
- **Target Users**: 所有使用仪表盘背景设置功能的用户

## Goals
- G1: 修复背景设置后图表加载失败的问题
- G2: 确保 dashboard 更新后 layout 数据完整不丢失
- G3: 确保 savedCharts 数据的正确加载
- G4: 添加错误日志，方便后续调试

## Non-Goals (Out of Scope)
- 不改变背景设置弹窗的 UI
- 不改变图表渲染逻辑
- 不新增背景设置功能

## Background & Context
- 用户反馈：修改仪表盘背景设置后，图表显示"加载失败，缺少 SQL / 图表配置"
- 背景颜色确实改变了，说明 UPDATE 基本成功
- 但图表数据似乎不完整
- 需要从以下几个方面排查：
  1. `update_dashboard` 参数化查询是否正确工作
  2. `get_dashboard` 返回的数据是否完整
  3. `row_to_dashboard_by_name` 是否正确解析所有字段
  4. `get_dashboard_items` 是否正确返回 layout 数据

## Functional Requirements
- **FR-1**: 修复 `update_dashboard` 参数化查询，确保所有字段正确更新
- **FR-2**: 加固 `row_to_dashboard_by_name`，添加错误日志
- **FR-3**: 加固 `get_dashboard_items`，失败时输出错误日志
- **FR-4**: 确保前端 `updateDashboard` 正确传递和处理返回数据
- **FR-5**: 确保 DashboardCanvas 正确应用背景设置且不影响图表渲染

## Non-Functional Requirements
- **NFR-1**: 向后兼容 — 不破坏现有数据
- **NFR-2**: 健壮性 — 数据读取失败时有明确的错误日志

## Constraints
- **Technical**: 必须遵循 security.md 参数化查询规范
- **Technical**: 必须遵循 architecture.md 分层架构约束
- **Business**: 不能破坏现有功能

## Assumptions
- 参数化查询可能有类型匹配问题（数字类型被转成字符串）
- `get_dashboard_items` 可能在某些场景下失败
- 前端 store 更新可能导致状态不一致

## Acceptance Criteria

### AC-1: 背景颜色设置后正常显示
- **Given**: 用户打开一个有图表的仪表盘
- **When**: 用户设置背景颜色并点击应用
- **Then**: 画布背景颜色改变，图表正常显示
- **Verification**: `human-judgment`

### AC-2: 画布宽度设置后正常显示
- **Given**: 用户打开一个有图表的仪表盘
- **When**: 用户设置画布宽度（如 1200px）并点击应用
- **Then**: 画布宽度变为设定值，图表正常显示
- **Verification**: `human-judgment`

### AC-3: 重新打开背景设置弹窗能回显值
- **Given**: 用户已设置了背景颜色和画布宽度
- **When**: 用户再次点击背景按钮
- **Then**: 弹窗中显示之前保存的值
- **Verification**: `human-judgment`

### AC-4: 编译通过
- **Given**: 代码修改完成
- **When**: 运行 cargo check 和 tsc
- **Then**: 无编译错误
- **Verification**: `programmatic`

### AC-5: 安全检测通过
- **Given**: 代码修改完成
- **When**: 运行 SQL 注入检测
- **Then**: 无 format! 拼接 SQL 的情况
- **Verification**: `programmatic`

## Open Questions
- [ ] 图表加载失败是否确实由修改背景导致，还是原本就存在？

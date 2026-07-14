# 仪表盘画布背景设置修复 - Product Requirement Document

## Overview
- **Summary**: 修复仪表盘画布背景设置不生效的问题，根因是数据库表 `__dashboards` 缺少背景设置相关列（background_color、background_image、canvas_width、canvas_height、padding），导致数据无法持久化保存和读取。
- **Purpose**: 解决用户反馈的"背景画布设置后并没有生效"的问题，确保画布尺寸、背景颜色、背景图片、内边距等设置能够正确保存到数据库并在重新打开时恢复。
- **Target Users**: 所有使用仪表盘功能的用户

## Goals
- G1: `__dashboards` 表新增 5 个背景设置列（background_color、background_image、canvas_width、canvas_height、padding）
- G2: 后端 update_dashboard 能够正确保存背景设置到数据库
- G3: 后端读取仪表盘时能够正确读取背景设置字段
- G4: 前端 DashboardCanvas 能够正确应用背景颜色、背景图片、画布尺寸、内边距
- G5: 设置后重新打开背景设置弹窗，能够回显之前保存的值

## Non-Goals (Out of Scope)
- 不改变背景设置弹窗的 UI 布局
- 不改变编辑模式和非编辑模式的切换逻辑
- 不改变图表项的布局计算逻辑
- 不新增背景设置的新功能（如背景图片上传等）

## Background & Context
- 当前项目已在 Dashboard 数据模型中定义了背景设置相关字段（background_color、background_image、canvas_width、canvas_height、padding）
- 前端 DashboardCanvas 组件已实现了背景设置的应用逻辑
- 但数据库表 `__dashboards` 缺少这些列，导致 UPDATE 和 SELECT 都无法正确处理这些字段
- 用户反馈"背景画布设置后并没有生效"，根本原因是数据库层不支持

## Functional Requirements
- **FR-1**: 数据库迁移 — `__dashboards` 表新增 5 个列：background_color (TEXT)、background_image (TEXT)、canvas_width (INTEGER)、canvas_height (INTEGER)、padding (INTEGER)
- **FR-2**: 后端读取 — `row_to_dashboard` 函数正确读取背景设置字段（使用列名而非列索引，避免老数据库列顺序不一致问题）
- **FR-3**: 后端更新 — `update_dashboard` 函数正确保存背景设置字段
- **FR-4**: 前端回显 — 背景设置弹窗打开时，从当前 dashboard 数据中读取已保存的背景设置作为初始值
- **FR-5**: 画布应用 — DashboardCanvas 正确应用背景颜色、背景图片、固定画布尺寸、内边距

## Non-Functional Requirements
- **NFR-1**: 向后兼容 — 老数据库自动迁移时自动添加新列，不影响现有数据
- **NFR-2**: 默认值 — 新列均有合理默认值（背景色默认空、画布宽度高度为 0）
- **NFR-3**: 性能 — 迁移操作在应用启动时完成，用户无感知

## Constraints
- **Technical**: 必须使用参数化查询（遵循 security.md），但 ALTER TABLE 不涉及用户输入，可直接执行
- **Business**: 必须向后兼容老数据库，不能破坏现有数据
- **Dependencies**: 依赖 rusqlite / duckdb 的 ALTER TABLE ADD COLUMN 支持

## Assumptions
- ALTER TABLE ADD COLUMN 在 SQLite/DuckDB 中可用且安全
- 老数据库中 `__dashboards` 表列顺序可能不一致，读取时应使用列名而非索引

## Acceptance Criteria

### AC-1: 数据库迁移成功
- **Given**: 一个已存在的老数据库（没有背景设置列）
- **When**: 应用启动并初始化数据库
- **Then**: `__dashboards` 表自动新增 5 个背景设置列，且有默认值
- **Verification**: `programmatic`
- **Notes**: 可通过查询 SQLite 命令验证表结构验证

### AC-2: 背景设置能够保存
- **Given**: 用户在背景设置弹窗中设置了背景颜色、画布宽度、内边距
- **When**: 用户点击"应用"按钮
- **Then**: 设置被保存到数据库的 `__dashboards` 表
- **Verification**: `programmatic`
- **Notes**: 通过查询数据库验证数据已保存

### AC-3: 背景设置能够回显
- **Given**: 用户已保存了背景设置
- **When**: 用户再次打开背景设置弹窗
- **Then**: 弹窗中显示之前保存的值
- **Verification**: `human-judgment`
- **Notes**: 手动验证弹窗初始值

### AC-4: 画布尺寸固定时宽度不随窗口改变
- **Given**: 用户设置了画布宽度为 1200px
- **When**: 用户切换全屏或调整窗口大小
- **Then**: 画布宽度保持 1200px 不变
- **Verification**: `human-judgment`
- **Notes**: 手动验证全屏前后画布宽度一致

### AC-5: 背景颜色正确应用
- **Given**: 用户设置了背景颜色为 #f0f0f0
- **When**: 用户点击应用后
- **Then**: 仪表盘画布背景变为 #f0f0f0
- **Verification**: `human-judgment`
- **Notes**: 手动验证背景颜色

## Open Questions
- 无

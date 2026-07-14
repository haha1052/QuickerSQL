# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0-beta] - 2026-06-27

### Added
- SQL 编辑器：支持多语句执行、查询历史、结果导出
- 数据导入：支持 CSV/Excel 批量导入，进度可视化
- 仪表盘：支持多仪表盘管理、图表拖拽布局、筛选器
- 图表系统：支持柱状图、折线图、饼图等 10+ 图表类型
- 自动化任务：定时 SQL 执行、Webhook 通知
- 回收站：表删除后可恢复
- 项目管理：多项目隔离
- 审计日志：操作记录可追溯
- 主题系统：明暗主题切换

### Tech Stack
- 前端：React 18 + TypeScript + Zustand + ECharts + AgGrid
- 后端：Rust + Tauri + SQLite + DuckDB
- 架构：前后端分离，三层架构（commands/services/database）

### Known Issues
- 部分高级图表类型仍在优化中
- 大文件导入性能有待提升

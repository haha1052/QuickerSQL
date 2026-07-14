# DuckDB 预加载优化 - 产品需求文档

## Overview
- **Summary**: 将 DuckDB 从"首次 SQL 使用时懒加载"改为"前端启动成功后5秒自动预加载"，避免用户执行分析查询时等待长达1分钟的初始化时间。
- **Purpose**: 解决分析查询执行时卡住的问题，提升用户体验。
- **Target Users**: 所有需要执行分析查询的用户

## Goals
- G1: 后端新增 `preload_duckdb` 命令，支持异步预加载 DuckDB
- G2: 前端启动成功后5秒自动调用预加载命令
- G3: 预加载期间不阻塞其他操作
- G4: 预加载失败不影响正常使用（回退到懒加载）

## Non-Goals
- 不修改 DuckDB 初始化逻辑本身
- 不改变 SQL 路由规则
- 不引入新的数据库引擎

## Background & Context

### 当前问题
- DuckDB 懒加载导致首次分析查询时需要等待1分钟初始化
- 用户执行 `SELECT department, COUNT(*) FROM employees GROUP BY department` 时卡住

### 解决方案
- 前端启动成功后5秒发起预加载请求
- 后端异步执行 DuckDB 初始化
- 后续分析查询可直接使用已初始化的连接

## Functional Requirements

### FR-1: 后端新增预加载命令
- **FR-1.1**: 新增 `preload_duckdb` Tauri 命令
- **FR-1.2**: 命令异步执行，不阻塞前端
- **FR-1.3**: 返回初始化状态（成功/失败/进行中）

### FR-2: 前端自动触发预加载
- **FR-2.1**: AppWrapper 启动成功后5秒调用预加载命令
- **FR-2.2**: 预加载结果不影响主流程

## Acceptance Criteria

### AC-1: 预加载命令可用
- **Given**: 应用已启动，SQLite 数据库已连接
- **When**: 调用 `preload_duckdb` 命令
- **Then**: DuckDB 开始初始化，命令立即返回
- **Verification**: `human-judgment`

### AC-2: 前端自动预加载
- **Given**: 前端启动成功，进入 workspace 状态
- **When**: 等待5秒
- **Then**: 前端自动调用 `preload_duckdb`
- **Verification**: `human-judgment`

### AC-3: 分析查询不再卡住
- **Given**: DuckDB 已预加载完成
- **When**: 执行 GROUP BY 查询
- **Then**: 查询立即执行，不再等待初始化
- **Verification**: `human-judgment`

### AC-4: 预加载失败不影响使用
- **Given**: DuckDB 预加载失败
- **When**: 执行分析查询
- **Then**: 回退到懒加载模式，查询仍能执行
- **Verification**: `human-judgment`

## Constraints
- **Technical**: 后端使用 Tokio 异步运行时
- **Dependencies**: Tauri IPC 通信

## Open Questions
- [ ] Q1: 是否需要在 UI 上显示预加载进度？

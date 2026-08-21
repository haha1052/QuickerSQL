# Day 5 待改进项综合修复方案

## Overview
- **Summary**: 针对架构现状文档中的待改进项进行综合修复，包括后端 unwrap 清理、前端 JSDoc 补充、查询缓存命中率监控功能、虚拟滚动接入，将质量评分从 8.4 提升到 8.6+
- **Purpose**: 推进 Day 5 发布准备，解决技术债务，提升代码质量和用户体验
- **Target Users**: 开发团队和最终用户

## Goals
- G1: 清理后端 Service 层关键文件的 unwrap()，从生产代码中减少 30+ 个
- G2: 为前端关键模块（store、services、utils）补充 JSDoc 注释，注释覆盖率提升
- G3: 实现查询缓存命中率监控功能（前端展示实时统计）
- G4: 在 QueryHistory 面板接入虚拟滚动，提升长列表性能
- G5: 更新架构现状文档，综合评分从 8.4/10 提升到 8.6/10

## Non-Goals
- 不做完整的用户使用手册（范围太大，需要单独项目）
- 不做完整的集成测试（需要 tauri-driver 和完整测试环境）
- 不做所有文件的 JSDoc（只做关键模块）
- 不做所有 unwrap 的清理（只做高风险的 service 层）

## Background & Context

当前待改进项（架构现状文档 7.4）：
1. ⚠️ 缺少集成测试（端到端业务流程）
2. ⚠️ 前端注释较少（JSDoc 覆盖率低）
3. ⚠️ 后端 unwrap 数量偏多（110 个，含测试）
4. ⚠️ 用户使用手册待编写

待完成功能（架构现状文档 6.5）：
1. 文档完善 - 使用手册、API 文档
2. 查询缓存命中率监控 - 前端展示实时统计
3. 虚拟滚动实际接入 - QueryHistory / TaskLogs

当前 unwrap 分布（Top 5）：
- query_history_service.rs: 26 个
- settings_service.rs: 25 个
- tests.rs: 18 个（测试代码，允许）
- schedule.rs: 16 个
- project_service.rs: 13 个

## Functional Requirements

### FR-1: 后端 unwrap 清理（Service 层高风险部分）
系统 SHALL 清理以下文件中的 unwrap()，替换为安全的错误处理：
- query_history_service.rs（26 个 → 减少到 5 个以内）
- settings_service.rs（25 个 → 减少到 5 个以内）
- project_service.rs（13 个 → 减少到 3 个以内）
- dashboard_service.rs（12 个 → 减少到 3 个以内）

清理原则：
- lock().unwrap() → lock().map_err(|e| format!("..."))?
- vec.get(n).unwrap() → vec.get(n).ok_or("index out of bounds")?
- iter().find().unwrap() → iter().find().ok_or("not found")?
- 明确安全的场景保留 unwrap，但添加注释说明

### FR-2: 前端 JSDoc 注释补充
系统 SHALL 为以下关键模块补充 JSDoc 注释：
- workspaceStore.ts（工作区状态管理）
- tableStore.ts（表数据状态管理）
- taskStore.ts（任务状态管理）
- tauri.ts（Tauri 通信封装）
- dashboardExport.ts（仪表盘导出工具）

每个文件至少包含：
- 模块级文档注释（文件用途说明）
- 导出函数/方法的 JSDoc（参数、返回值、副作用）
- 关键类型接口的注释

### FR-3: 查询缓存命中率监控
系统 SHALL 提供查询缓存命中率监控功能：
- 后端：query_cache_service::stats() 返回统计数据（命中数、未命中数、命中率、缓存大小）
- 前端：设置页面或 SQL 页面展示缓存统计
- 支持手动清空缓存
- 实时刷新统计数据

### FR-4: 虚拟滚动接入（QueryHistory）
系统 SHALL 在查询历史面板接入虚拟滚动：
- 使用现有的 src/utils/virtual.ts
- QueryHistory 列表支持大数据量流畅滚动
- 保持原有功能（搜索、筛选、点击查看详情）
- 性能提升：1000 条记录以上流畅滚动

## Non-Functional Requirements
- NFR-1: 所有改动必须通过 cargo check 和 tsc 类型检查
- NFR-2: 所有改动必须通过现有测试（cargo test + vitest）
- NFR-3: 不能引入新的 any 类型和 console.log
- NFR-4: 向后兼容，不破坏现有功能

## Constraints
- **Technical**: 必须遵循现有架构分层（commands/services/database）
- **Business**: 控制改动范围，确保质量和稳定性
- **Dependencies**: 依赖现有 query_cache_service 和 virtual.ts

## Assumptions
- query_cache_service 已有 stats() 或类似的统计接口
- virtual.ts 已经实现并测试通过（已有 15 个测试）
- QueryHistory 面板使用列表渲染，可以替换为虚拟滚动

## Acceptance Criteria

### AC-1: 后端 unwrap 清理
- **Given**: 生产代码（非测试）中有大量 unwrap()
- **When**: 清理 service 层关键文件的 unwrap
- **Then**: query_history_service + settings_service + project_service + dashboard_service 的 unwrap 总数从 76 减少到 16 以内（减少 60+）
- **Verification**: `programmatic`
- **Notes**: 用 PowerShell 命令验证数量

### AC-2: 前端 JSDoc 补充
- **Given**: 前端关键模块缺少 JSDoc
- **When**: 为 5 个关键文件补充 JSDoc
- **Then**: 每个文件都有模块级注释和主要函数的 JSDoc
- **Verification**: `human-judgment`

### AC-3: 查询缓存命中率监控
- **Given**: query_cache_service 已有统计能力
- **When**: 用户查看缓存统计
- **Then**: 能看到命中率、命中数、未命中数、缓存大小等数据
- **Verification**: `programmatic`（代码审查 + 编译通过）
- **Notes**: 后端 API + 前端展示

### AC-4: 虚拟滚动接入
- **Given**: QueryHistory 面板使用普通列表渲染
- **When**: 接入 virtual.ts 虚拟滚动
- **Then**: 长列表滚动流畅，功能正常
- **Verification**: `programmatic`（编译通过 + 代码审查）
- **Notes**: 确保不破坏现有功能

### AC-5: 文档更新
- **Given**: 改进完成
- **When**: 更新架构现状文档
- **Then**: 待改进项状态更新，评分提升到 8.6/10
- **Verification**: `human-judgment`

## Open Questions
- [x] Q1: 优先做哪些改进？→ unwrap清理 + 缓存监控 + 虚拟滚动 + JSDoc
- [x] Q2: 不做什么？→ 完整用户手册、集成测试
- [x] Q3: 质量目标？→ 综合评分 8.6/10

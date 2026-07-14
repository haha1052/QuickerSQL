# Day 5 待改进项综合修复任务清单

## 任务 1: 后端 unwrap 清理 - query_history_service.rs

- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 清理 query_history_service.rs 中的 26 个 unwrap()
  - 替换为安全的错误处理（map_err、ok_or、? 等）
  - 保留明确安全的 unwrap，但添加注释说明
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic`: cargo check --quiet 通过
  - `programmatic`: cargo test 通过
  - `programmatic`: unwrap 数量减少到 5 个以内
- **Notes**: 注意 lock().unwrap() 这种常见模式的处理

## 任务 2: 后端 unwrap 清理 - settings_service.rs

- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 清理 settings_service.rs 中的 25 个 unwrap()
  - 替换为安全的错误处理
  - 保留明确安全的 unwrap，添加注释
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic`: cargo check --quiet 通过
  - `programmatic`: cargo test 通过
  - `programmatic`: unwrap 数量减少到 5 个以内
- **Notes**: settings 操作很多是确定安全的，但仍需规范化

## 任务 3: 后端 unwrap 清理 - project_service.rs & dashboard_service.rs

- **Priority**: medium
- **Depends On**: None
- **Description**: 
  - 清理 project_service.rs 中的 13 个 unwrap()
  - 清理 dashboard_service.rs 中的 12 个 unwrap()
  - 替换为安全的错误处理
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic`: cargo check --quiet 通过
  - `programmatic`: cargo test 通过
  - `programmatic`: 两个文件 unwrap 总数减少到 6 个以内
- **Notes**: 中等优先级，做关键部分即可

## 任务 4: 查询缓存命中率监控 - 后端 API

- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 完善 query_cache_service::stats() 接口
  - 返回统计数据：命中数、未命中数、命中率、缓存大小、配置
  - 添加 Tauri command 暴露给前端
  - 添加清空缓存的 command
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `programmatic`: cargo check --quiet 通过
  - `programmatic`: 测试通过
- **Notes**: 先检查现有 stats 实现情况

## 任务 5: 查询缓存命中率监控 - 前端展示

- **Priority**: high
- **Depends On**: 任务 4
- **Description**: 
  - 在设置页面（查询缓存分类）添加统计展示区域
  - 展示命中率、命中数、未命中数、缓存大小
  - 添加清空缓存按钮
  - 添加刷新按钮
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `programmatic`: npx tsc --noEmit 通过
  - `human-judgement`: UI 布局合理
- **Notes**: 使用 tauriService 调用后端 API

## 任务 6: 虚拟滚动接入 - QueryHistory 面板

- **Priority**: medium
- **Depends On**: None
- **Description**: 
  - 在 QueryHistory 面板接入 virtual.ts 虚拟滚动
  - 保持原有功能（搜索、筛选、点击查看）
  - 优化长列表性能
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `programmatic`: npx tsc --noEmit 通过
  - `human-judgement`: 滚动流畅，功能正常
- **Notes**: 注意虚拟滚动的高度计算和事件处理

## 任务 7: 前端 JSDoc 注释补充

- **Priority**: medium
- **Depends On**: None
- **Description**: 
  - 为 workspaceStore.ts 补充 JSDoc
  - 为 tableStore.ts 补充 JSDoc
  - 为 taskStore.ts 补充 JSDoc
  - 为 tauri.ts 补充 JSDoc
  - 为 dashboardExport.ts 补充 JSDoc
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `human-judgement`: 每个文件都有模块级注释和主要函数注释
- **Notes**: 重点是导出的函数和类型

## 任务 8: 运行完整测试验证

- **Priority**: high
- **Depends On**: 任务 1-7
- **Description**: 
  - 运行 cargo check 验证 Rust 编译
  - 运行 cargo test 验证后端测试
  - 运行 npx tsc --noEmit 验证前端类型
  - 运行 npx vitest run 验证前端测试
  - 运行安全检测命令
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-3, AC-4
- **Test Requirements**:
  - `programmatic`: 所有测试通过，无错误
- **Notes**: 确保没有破坏现有功能

## 任务 9: 更新架构现状文档

- **Priority**: medium
- **Depends On**: 任务 8
- **Description**: 
  - 更新 7.3 测试覆盖章节（如有变化）
  - 更新 7.4 质量评分（8.4 → 8.6）
  - 更新待改进项列表
  - 更新 Day 5 进展状态
  - 更新 6.5 待完成功能状态
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `human-judgement`: 文档更新准确完整
- **Notes**: 保持与实际数据一致

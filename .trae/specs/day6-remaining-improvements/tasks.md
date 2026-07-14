# Day 6 待改进项任务清单

## 任务 1: 前端 JSDoc 注释补充

- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 为 `src/store/appStore.ts` 补充模块级注释和所有导出函数注释
  - 为 `src/store/settingsStore.ts` 补充模块级注释和所有导出函数注释
  - 为 `src/store/taskStore.ts` 补充模块级注释和所有导出函数注释
  - 为 `src/services/tauri.ts` 补充完整注释（invokeCommand、类型定义等）
  - 为 `src/components/common/` 下的 5 个核心组件补充注释
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic`: npx tsc --noEmit 通过
  - `programmatic`: JSDoc 行数从 178 行提升到 300+ 行
- **Notes**: 重点是导出的函数、interface、type

## 任务 2: 集成测试 - 设置系统 CRUD

- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 在 `src-tauri/src/services/tests/` 创建集成测试文件
  - 测试设置创建 → 读取 → 更新 → 删除的完整流程
  - 使用临时数据库确保测试隔离
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `programmatic`: cargo test 设置相关测试全部通过
  - `programmatic`: 至少 5 个集成测试用例
- **Notes**: 参考现有 query_history_service 的测试模式

## 任务 3: 集成测试 - 仪表盘系统

- **Priority**: medium
- **Depends On**: None
- **Description**: 
  - 测试创建图表 → 保存 → 加载 → 删除的完整流程
  - 测试仪表盘创建 → 添加图表 → 布局 → 保存 → 删除
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `programmatic`: cargo test 仪表盘相关测试全部通过
  - `programmatic`: 至少 3 个集成测试用例
- **Notes**: 可以并行进行

## 任务 4: 集成测试 - 自动化任务系统

- **Priority**: medium
- **Depends On**: None
- **Description**: 
  - 测试任务创建 → 配置调度 → 触发运行 → 查看日志
  - 测试任务状态变更（启用/暂停/删除）
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `programmatic`: cargo test 任务相关测试全部通过
  - `programmatic`: 至少 3 个集成测试用例
- **Notes**: 可以并行进行

## 任务 5: 用户使用手册 - 快速开始章节

- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 创建 `docs/用户手册.md`
  - 编写第 1 章：快速开始（约 500-800 字）
    - 1.1 安装说明
    - 1.2 启动应用
    - 1.3 创建第一个数据库连接
    - 1.4 基本操作流程
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `human-judgment`: 内容完整、结构清晰、可读性强
- **Notes**: 使用 Markdown 格式，添加必要的截图说明占位符

## 任务 6: 用户使用手册 - 功能模块章节

- **Priority**: high
- **Depends On**: 任务 5
- **Description**: 
  - 编写第 2 章：数据查询
    - 2.1 连接管理
    - 2.2 SQL 编辑器
    - 2.3 查询执行
    - 2.4 结果展示
  - 编写第 3 章：仪表盘
    - 3.1 创建图表
    - 3.2 布局调整
    - 3.3 保存与加载
  - 编写第 4 章：自动化任务
    - 4.1 创建任务
    - 4.2 调度配置
    - 4.3 运行监控
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `human-judgment`: 内容完整、覆盖核心功能、可操作性强
- **Notes**: 每章至少 500 字

## 任务 7: 完整测试验证

- **Priority**: high
- **Depends On**: 任务 1-6
- **Description**: 
  - 运行 cargo check 验证 Rust 编译
  - 运行 cargo test 验证所有测试（包括新增集成测试）
  - 运行 npx tsc --noEmit 验证前端类型
  - 运行 npx vitest run 验证前端测试
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-3, AC-4
- **Test Requirements**:
  - `programmatic`: 所有测试通过，无编译错误
- **Notes**: 确保没有破坏现有功能

## 任务 8: 更新架构现状文档

- **Priority**: medium
- **Depends On**: 任务 7
- **Description**: 
  - 更新质量评分（8.6 → 8.8）
  - 更新待改进项列表
  - 添加 Day 6 进展记录
  - 更新注释完整性评分
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `human-judgment`: 文档更新准确完整
- **Notes**: 与实际数据保持一致

## 任务依赖关系

```
任务 1 ─┬─▶ 任务 7 ─▶ 任务 8
任务 2 ─┤
任务 3 ─┤
任务 4 ─┤
任务 5 ─┼─▶ 任务 6 ─┘
```

**说明**：
- 任务 2、3、4 可以并行进行
- 任务 6 依赖任务 5
- 任务 7 依赖任务 1-6
- 任务 8 依赖任务 7

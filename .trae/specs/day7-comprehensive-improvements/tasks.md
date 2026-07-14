# Day 7 综合质量提升任务清单

## 任务 1: 集成测试扩展 - query_history_service

- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 新增查询历史服务的边界测试
  - 复杂 SQL 查询测试
  - 批量操作测试
  - 超长 SQL 测试
  - 空值处理测试
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic`: cargo test 通过
  - `programmatic`: 新增至少 8 个测试用例
- **Notes**: 参考现有测试模式

## 任务 2: 集成测试扩展 - task_service & dashboard_service

- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 任务服务：并发执行测试、超时处理测试
  - 仪表盘服务：多图表布局测试、权限边界测试
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic`: cargo test 通过
  - `programmatic`: 新增至少 8 个测试用例
- **Notes**: 可以并行进行

## 任务 3: 集成测试扩展 - workspace & app_state

- **Priority**: medium
- **Depends On**: None
- **Description**: 
  - workspace_service 集成测试
  - app_state_service 集成测试
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic`: cargo test 通过
  - `programmatic`: 新增至少 5 个测试用例
- **Notes**: 新系统测试

## 任务 4: 前端组件 JSDoc - common 组件

- **Priority**: high
- **Depends On**: None
- **Description**: 
  - ErrorBoundary.tsx 组件注释
  - LoadingSpinner.tsx 组件注释
  - Toast.tsx 组件注释
  - 其他 common 组件
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `programmatic`: npx tsc --noEmit 通过
  - `human-judgment`: 所有导出函数和组件有注释
- **Notes**: 重点是导出函数

## 任务 5: 前端组件 JSDoc - feature 组件

- **Priority**: medium
- **Depends On**: None
- **Description**: 
  - QueryHistoryPanel.tsx 注释
  - SettingsPanel.tsx 注释
  - TaskList.tsx 注释
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `programmatic`: npx tsc --noEmit 通过
  - `human-judgment`: 核心函数有注释
- **Notes**: 可以并行进行

## 任务 6: API 文档编写 - 数据库相关命令

- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 创建 docs/API参考.md
  - 文档化 list_databases、execute_sql、list_tables 等命令
  - 每个命令包含：名称、描述、参数、返回值
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `human-judgment`: 文档结构清晰
  - `programmatic`: 至少覆盖 10 个命令
- **Notes**: 使用 Markdown 表格格式

## 任务 7: API 文档编写 - 设置与仪表盘命令

- **Priority**: medium
- **Depends On**: 任务 6
- **Description**: 
  - 文档化设置相关命令
  - 文档化仪表盘相关命令
  - 文档化任务相关命令
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `human-judgment`: 文档完整准确
  - `programmatic`: 至少覆盖 20 个命令
- **Notes**: 总计覆盖 20+ 命令

## 任务 8: 可访问性改进 - 表单控件

- **Priority**: medium
- **Depends On**: None
- **Description**: 
  - 设置面板表单控件添加 aria-label
  - 输入框添加 aria-describedby
  - 下拉框添加 aria-haspopup
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `human-judgment`: 组件可访问性改善
- **Notes**: 不改变视觉效果

## 任务 9: 可访问性改进 - 交互组件

- **Priority**: medium
- **Depends On**: None
- **Description**: 
  - 按钮组件添加 aria-pressed/aria-disabled
  - 模态框添加 role="dialog"、aria-modal
  - 表格添加 scope 属性
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `human-judgment`: 核心组件支持屏幕阅读器
- **Notes**: 可以并行进行

## 任务 10: 完整测试验证

- **Priority**: high
- **Depends On**: 任务 1-9
- **Description**: 
  - cargo check 编译检查
  - cargo test 后端测试
  - npx tsc --noEmit 前端类型检查
  - npx vitest run 前端测试
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-3, AC-4, AC-5
- **Test Requirements**:
  - `programmatic`: 所有测试通过
- **Notes**: 确保没有破坏现有功能

## 任务 11: 更新架构现状文档

- **Priority**: medium
- **Depends On**: 任务 10
- **Description**: 
  - 更新质量评分（8.8 → 9.0+）
  - 更新测试覆盖记录
  - 更新待改进项列表
  - 添加 Day 7 进展记录
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `human-judgment`: 文档更新准确完整
- **Notes**: 与实际数据保持一致

## 任务依赖关系

```
任务 1 ─┬─▶ 任务 2 ─┬─▶ 任务 3 ─┬─▶ 任务 10 ─▶ 任务 11
任务 4 ─┤                                    ↑
任务 5 ─┤                                    │
任务 6 ─┼─▶ 任务 7 ─┤                        │
任务 8 ─┤            │                        │
任务 9 ─┘            │                        │
```

**并行执行说明**：
- 任务 1、2、4、6、8 可同时进行
- 任务 3 依赖任务 1、2 的模式
- 任务 5 可与任务 4 并行
- 任务 7 依赖任务 6
- 任务 9 可与任务 4、5 并行
- 任务 10 依赖所有开发任务
- 任务 11 依赖任务 10

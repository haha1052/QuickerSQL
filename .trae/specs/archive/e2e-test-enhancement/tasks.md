# E2E 测试改进任务清单

## 任务 1：增强基础启动测试

- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 增强 `e2e/specs/00-basic-startup.spec.ts`
  - 添加应用启动验证
  - 验证主界面关键元素存在
- **Acceptance Criteria Addressed**: AC-1, AC-2
- **Test Requirements**:
  - `programmatic`: 运行 `npx playwright test e2e/specs/00-basic-startup.spec.ts --headed` 通过
- **Notes**: 使用稳定的 CSS 选择器或 aria-label

## 任务 2：编写 SQL 查询测试

- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 新建 `e2e/specs/01-sql-query.spec.ts`
  - 覆盖 SQL 执行、结果展示、历史记录
- **Acceptance Criteria Addressed**: AC-2, AC-3
- **Test Requirements**:
  - `programmatic`: 运行测试用例通过
- **Notes**: 使用 SELECT 1 等简单查询避免数据库依赖

## 任务 3：编写仪表盘测试

- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 新建 `e2e/specs/02-dashboard.spec.ts`
  - 覆盖仪表盘导航、图表操作
- **Acceptance Criteria Addressed**: AC-2, AC-3
- **Test Requirements**:
  - `programmatic`: 运行测试用例通过
- **Notes**: 仪表盘操作测试

## 任务 4：编写自动化任务测试

- **Priority**: medium
- **Depends On**: None
- **Description**: 
  - 新建 `e2e/specs/03-automation.spec.ts`
  - 覆盖任务中心、任务创建
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `programmatic`: 运行测试用例通过
- **Notes**: 任务创建可能需要数据库支持

## 任务 5：编写设置页面测试

- **Priority**: medium
- **Depends On**: None
- **Description**: 
  - 新建 `e2e/specs/04-settings.spec.ts`
  - 覆盖设置页面、主题切换
- **Acceptance Criteria Addressed**: AC-2, AC-3
- **Test Requirements**:
  - `programmatic`: 运行测试用例通过
- **Notes**: 主题切换测试

## 任务 6：更新 README 文档

- **Priority**: medium
- **Depends On**: 任务 1-5
- **Description**: 
  - 更新 `e2e/README.md`
  - 说明运行方式、测试用例列表
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `human-judgement`: 文档清晰易读
- **Notes**: 包含故障排查指南

## 任务 7：更新架构现状文档

- **Priority**: low
- **Depends On**: 任务 1-6
- **Description**: 
  - 更新 `docs/架构现状.md` 第6章测试部分
  - 记录 E2E 测试进展
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `human-judgement`: 文档更新准确
- **Notes**: 更新测试章节

## 任务 8：运行完整测试验证

- **Priority**: high
- **Depends On**: 任务 1-5
- **Description**: 
  - 运行完整 E2E 测试套件
  - 验证所有用例可执行
- **Acceptance Criteria Addressed**: AC-1, AC-2
- **Test Requirements**:
  - `programmatic`: `npm run e2e` 输出显示用例数量
- **Notes**: 确保没有语法错误

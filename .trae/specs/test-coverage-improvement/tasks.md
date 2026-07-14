# 测试覆盖提升任务清单

## 任务 1: sqlFormatter 单元测试

- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 新建 `src/__tests__/sqlFormatter.test.ts`
  - 覆盖 formatSql 函数的各种场景
  - 包括 SELECT、JOIN、子查询、INSERT/UPDATE/DELETE、空输入等
- **Acceptance Criteria Addressed**: AC-1, AC-4
- **Test Requirements**:
  - `programmatic`: `npx vitest run sqlFormatter` 全部通过，至少 10 个用例
- **Notes**: 参考现有 filterSql.test.ts 的风格

## 任务 2: sqlStatementParser 单元测试

- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 新建 `src/__tests__/sqlStatementParser.test.ts`
  - 覆盖 splitSqlStatements、getStatementAtCursor、extractParameters
  - 包括多语句、字符串中字符、注释、参数提取等场景
- **Acceptance Criteria Addressed**: AC-2, AC-4
- **Test Requirements**:
  - `programmatic`: `npx vitest run sqlStatementParser` 全部通过，至少 10 个用例
- **Notes**: 注意边界情况测试

## 任务 3: echartsNormalize 单元测试

- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 新建 `src/__tests__/echartsNormalize.test.ts`
  - 覆盖 normalizeEChartsConfig 函数
  - 包括 snake_case 转换、嵌套对象、数组、幂等性、默认值补充
- **Acceptance Criteria Addressed**: AC-3, AC-4
- **Test Requirements**:
  - `programmatic`: `npx vitest run echartsNormalize` 全部通过，至少 8 个用例
- **Notes**: 验证对象不被修改（返回新对象）

## 任务 4: E2E 测试增强

- **Priority**: medium
- **Depends On**: None
- **Description**: 
  - 新增数据导入页面导航测试
  - 新增回收站页面导航测试
  - 新增查询历史面板测试
  - 新增设置分类切换测试
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `programmatic`: `npx playwright test --list` 显示 >= 28 个用例
- **Notes**: 只做导航和元素存在性测试，不做数据库操作

## 任务 5: 运行完整测试验证

- **Priority**: high
- **Depends On**: 任务 1, 2, 3, 4
- **Description**: 
  - 运行 `npx vitest run` 验证所有前端测试通过
  - 运行 `cargo test --quiet` 验证后端测试通过
  - 运行 `npx tsc --noEmit` 验证类型检查
  - 确认测试总数 >= 70
- **Acceptance Criteria Addressed**: AC-4, AC-5
- **Test Requirements**:
  - `programmatic`: 所有测试通过，测试总数达标
- **Notes**: 确保没有破坏现有测试

## 任务 6: 更新架构现状文档

- **Priority**: medium
- **Depends On**: 任务 5
- **Description**: 
  - 更新 docs/架构现状.md 7.3 测试覆盖章节
  - 更新前端测试数量
  - 更新 E2E 测试数量
  - 更新 7.4 质量评分（测试覆盖从 7.0 提到 7.5）
  - 更新 Day 4 进展状态
- **Acceptance Criteria Addressed**: AC-6
- **Test Requirements**:
  - `human-judgement`: 文档更新准确完整
- **Notes**: 保持与实际数据一致

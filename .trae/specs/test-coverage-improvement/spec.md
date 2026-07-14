# 测试覆盖提升改进方案

## Overview
- **Summary**: 提升项目测试覆盖率，新增前端单元测试（工具函数）、增强 E2E 测试场景，将测试覆盖评分从 7.0 提升到 7.5+
- **Purpose**: 提高代码质量保障能力，减少回归 bug，为 Day 4 测试加固目标做准备
- **Target Users**: 开发团队

## Goals
- G1: 新增 3 个前端工具函数单元测试文件（sqlFormatter、sqlStatementParser、echartsNormalize）
- G2: 前端单元测试从 43 个提升到 70+ 个
- G3: 增强 E2E 测试，增加数据导入、回收站等场景
- G4: 更新架构现状文档，测试覆盖评分提升到 7.5/10

## Non-Goals
- 不做后端 Rust 单元测试新增（当前 169 个已经比较充足）
- 不做组件级集成测试（需要 React Testing Library，范围较大）
- 不做性能测试
- 不做完整的 CI/CD 集成

## Background & Context
当前测试覆盖现状（架构现状文档 7.3/7.4）：
- 后端 Rust：169 个单元测试，分布在 database/tests.rs 和各 service 内联 tests
- 前端 TypeScript：3 个测试文件，43 个测试（virtual、gridLayout、filterSql）
- E2E：Playwright 框架就绪，23 个测试用例
- 质量评分：测试覆盖 7.0/10

可增加测试的工具函数：
- `src/utils/sqlFormatter.ts` - SQL 格式化（tokenize、formatSql 等纯函数）
- `src/utils/sqlStatementParser.ts` - SQL 语句解析（splitSqlStatements、getStatementAtCursor、extractParameters）
- `src/utils/echartsNormalize.ts` - ECharts 配置归一化（normalizeEChartsConfig、toCamelCase）

## Functional Requirements

### FR-1: sqlFormatter 单元测试
系统 SHALL 为 sqlFormatter.ts 提供完整的单元测试，覆盖：
- 基本 SELECT 语句格式化
- 关键字大写转换
- 多表 JOIN 格式化
- 子查询缩进
- 字符串/注释保留
- 空输入处理
- INSERT/UPDATE/DELETE 语句

### FR-2: sqlStatementParser 单元测试
系统 SHALL 为 sqlStatementParser.ts 提供完整的单元测试，覆盖：
- 单语句拆分
- 多语句拆分（分号分隔）
- 字符串中的分号不拆分
- 注释中的分号不拆分
- 光标位置定位语句
- 参数提取（位置参数 ? 和命名参数 :name）

### FR-3: echartsNormalize 单元测试
系统 SHALL 为 echartsNormalize.ts 提供完整的单元测试，覆盖：
- snake_case 键名转 camelCase
- 嵌套对象递归转换
- 数组元素转换
- 幂等性（已经是 camelCase 的不变化）
- 默认 grid/legend/color 补充
- 可视化选项应用
- null/undefined 输入处理

### FR-4: E2E 测试增强
系统 SHALL 增强 E2E 测试，新增：
- 数据导入页面导航测试
- 回收站页面导航测试
- 查询历史面板测试
- 更多设置分类切换测试

## Non-Functional Requirements
- NFR-1: 所有新增测试必须可重复执行，确定性结果
- NFR-2: 测试执行时间不超过现有测试的 2 倍
- NFR-3: 测试代码遵循项目代码规范（无 any、无 console.log）

## Constraints
- **Technical**: 使用 Vitest 框架，与现有测试保持一致风格
- **Business**: 纯函数测试优先，避免需要 DOM/数据库的测试
- **Dependencies**: 依赖现有 Vitest 配置（`src/__tests__/setup.ts`）

## Assumptions
- 现有 Vitest 配置可以直接运行新增测试
- 工具函数都是纯函数，可以直接单元测试
- E2E 测试不需要 tauri-driver，用 HTTP 模式即可

## Acceptance Criteria

### AC-1: sqlFormatter 测试通过
- **Given**: sqlFormatter.test.ts 已创建
- **When**: 运行 `npx vitest run sqlFormatter`
- **Then**: 至少 10 个测试用例全部通过
- **Verification**: `programmatic`

### AC-2: sqlStatementParser 测试通过
- **Given**: sqlStatementParser.test.ts 已创建
- **When**: 运行 `npx vitest run sqlStatementParser`
- **Then**: 至少 10 个测试用例全部通过
- **Verification**: `programmatic`

### AC-3: echartsNormalize 测试通过
- **Given**: echartsNormalize.test.ts 已创建
- **When**: 运行 `npx vitest run echartsNormalize`
- **Then**: 至少 8 个测试用例全部通过
- **Verification**: `programmatic`

### AC-4: 前端测试总数提升
- **Given**: 所有新测试已创建
- **When**: 运行 `npx vitest run`
- **Then**: 测试总数 >= 70，通过率 100%
- **Verification**: `programmatic`

### AC-5: E2E 测试增强
- **Given**: 新 E2E 测试已创建
- **When**: 运行 `npx playwright test --list`
- **Then**: 测试用例总数 >= 28
- **Verification**: `programmatic`

### AC-6: 架构文档更新
- **Given**: 所有测试完成
- **When**: 查看 docs/架构现状.md
- **Then**: 测试覆盖数据已更新，评分调整
- **Verification**: `human-judgment`

## Open Questions
- [x] Q1: 是否需要后端测试增加？→ 暂不需要，169 个已充足
- [x] Q2: E2E 是否需要 tauri-driver？→ 暂不需要，HTTP 模式足够验证导航
- [x] Q3: 组件测试是否做？→ 暂不做，工具函数优先

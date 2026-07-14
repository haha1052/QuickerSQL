# E2E 测试改进验证清单

## 代码实现检查

- [x] Checkpoint 1: `e2e/specs/00-basic-startup.spec.ts` 包含至少 3 个测试用例
- [x] Checkpoint 2: `e2e/specs/01-sql-query.spec.ts` 存在且包含 SQL 查询测试
- [x] Checkpoint 3: `e2e/specs/02-dashboard.spec.ts` 存在且包含仪表盘测试
- [x] Checkpoint 4: `e2e/specs/03-automation.spec.ts` 存在且包含任务测试
- [x] Checkpoint 5: `e2e/specs/04-settings.spec.ts` 存在且包含设置测试
- [x] Checkpoint 6: 所有测试文件无语法错误（可被 Playwright 解析）

## 测试用例检查

- [x] Checkpoint 7: 至少 15 个测试用例（不含 skip）
- [x] Checkpoint 8: 每个测试用例有清晰的 test.describe 分组
- [x] Checkpoint 9: 每个测试用例有明确的 expect 断言
- [x] Checkpoint 10: 使用稳定的选择器（避免频繁变化的 class）

## 文档更新检查

- [x] Checkpoint 11: `e2e/README.md` 更新了运行说明
- [x] Checkpoint 12: `e2e/README.md` 包含测试用例列表
- [x] Checkpoint 13: `docs/架构现状.md` 更新了 E2E 测试章节

## 运行验证检查

- [x] Checkpoint 14: `npx playwright test --list` 能列出所有测试用例
- [x] Checkpoint 15: `npx playwright test e2e/specs/00-basic-startup.spec.ts` 无语法错误

# 设置系统去重优化验证清单

## 后端 default_settings 去重
- [ ] Checkpoint 1: default_settings 中 appearance 分类不包含 tabSize
- [ ] Checkpoint 2: default_settings 中 editor 分类包含 tabSize
- [ ] Checkpoint 3: default_settings 中 performance 分类不包含 query_timeout
- [ ] Checkpoint 4: default_settings 中 database 分类包含 queryTimeout

## 后端 implemented_settings 去重
- [ ] Checkpoint 5: implemented_settings 中 appearance.tabSize 不存在
- [ ] Checkpoint 6: implemented_settings 中 editor.tabSize 存在
- [ ] Checkpoint 7: implemented_settings 中 performance.query_timeout 不存在

## 后端兼容层
- [ ] Checkpoint 8: get_setting("editor", "tabSize") 有 fallback 到 appearance.tabSize 的逻辑
- [ ] Checkpoint 9: get_setting("database", "queryTimeout") 有 fallback 到 performance.query_timeout 的逻辑

## 前端引用更新
- [ ] Checkpoint 10: SQLEditor.tsx 中不包含 useSetting('appearance', 'tabSize')
- [ ] Checkpoint 11: SQLEditor.tsx 中包含 useSetting('editor', 'tabSize')

## 编译验证
- [ ] Checkpoint 12: cargo check --quiet 无错误
- [ ] Checkpoint 13: npx tsc --noEmit --pretty 无错误

## 文档更新
- [ ] Checkpoint 14: 设置系统现状分析报告版本更新到 v23.0
- [ ] Checkpoint 15: 设置项总数从 112 减少到 110
- [ ] Checkpoint 16: 已实现项从 83 减少到 81
- [ ] Checkpoint 17: 去重任务在报告中标记为完成

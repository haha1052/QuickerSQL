# 设置系统 P2/P3 修复验证清单

## formatOnSave 功能
- [ ] Checkpoint 1: SQLEditor 中有保存时格式化的逻辑
- [ ] Checkpoint 2: 读取 sql.formatOnSave 设置
- [ ] Checkpoint 3: 启用时保存后 SQL 被格式化

## autoExecute 功能
- [ ] Checkpoint 4: SQLEditor 中有分号检测逻辑
- [ ] Checkpoint 5: 读取 sql.autoExecute 设置
- [ ] Checkpoint 6: 启用时输入 `;` 后按 Enter 自动执行

## enableAutoRecover 功能
- [ ] Checkpoint 7: SQLEditor 中有自动保存到 localStorage 的逻辑
- [ ] Checkpoint 8: 读取 sql.enableAutoRecover 设置
- [ ] Checkpoint 9: 启用时能保存恢复点
- [ ] Checkpoint 10: 应用启动时能检测并提示恢复

## developerMode 功能
- [ ] Checkpoint 11: 应用启动时读取 advanced.developerMode 设置
- [ ] Checkpoint 12: 启用后控制台显示详细日志

## showDebugInfo 功能
- [ ] Checkpoint 13: 应用中有调试信息面板
- [ ] Checkpoint 14: 读取 advanced.showDebugInfo 设置
- [ ] Checkpoint 15: 启用时显示调试面板

## implemented_settings 更新
- [ ] Checkpoint 16: implemented_settings 中包含 sql.formatOnSave
- [ ] Checkpoint 17: implemented_settings 中包含 sql.autoExecute
- [ ] Checkpoint 18: implemented_settings 中包含 sql.enableAutoRecover
- [ ] Checkpoint 19: implemented_settings 中包含 advanced.developerMode
- [ ] Checkpoint 20: implemented_settings 中包含 advanced.showDebugInfo

## 编译验证
- [ ] Checkpoint 21: cargo check --quiet 无错误
- [ ] Checkpoint 22: npx tsc --noEmit --pretty 无错误

## 文档更新
- [ ] Checkpoint 23: 设置系统现状分析报告版本更新到 v22.0
- [ ] Checkpoint 24: P2/P3 任务在报告中标记为完成

# DuckDB VIEW 同步表过滤统一修复 — Verification Checklist

## 编译与安全验证
- [x] Checkpoint 1: Rust 编译通过（`cargo check --quiet` 无 error）
- [x] Checkpoint 2: TS 类型检查通过（`npx tsc --noEmit --pretty` 0 errors）
- [ ] Checkpoint 3: SQL 注入检测通过（0 个 format! 拼接 SELECT/INSERT/UPDATE/DELETE）
- [x] Checkpoint 4: 敏感字符串检测通过（0 个 sk-/Bearer/ghp_/eyJ/password:）

## 功能验证
- [x] Checkpoint 5: QueryRouter::get_table_names() 返回结果不包含 `__` 前缀的系统表
- [ ] Checkpoint 6: DuckDB 预加载日志显示的用户表数量与实际一致（如 3 个）
- [ ] Checkpoint 7: VIEW 刷新日志显示的 VIEW 数量与用户表数量一致（如 3/3）
- [ ] Checkpoint 8: 数据浏览器中"用户表"数量显示正确
- [ ] Checkpoint 9: 系统表功能正常（设置保存/读取、查询历史等不受影响）

## 日志质量验证
- [x] Checkpoint 10: Win10 环境下 DWM 相关警告降级为 debug 级别
- [ ] Checkpoint 11: 启动日志中无不必要的 warn 级别日志
- [ ] Checkpoint 12: 透明窗口成功率诊断信息准确

## 回归测试
- [ ] Checkpoint 13: SQL 查询（简单查询和复杂分析查询）正常执行
- [ ] Checkpoint 14: DuckDB 懒初始化正常工作
- [ ] Checkpoint 15: 表创建/删除后 VIEW 同步正常

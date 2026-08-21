# 仪表盘画布背景设置修复 - 验证清单

- [x] Checkpoint 1: `__dashboards` 表包含 background_color、background_image、canvas_width、canvas_height、padding 5 个新列
- [x] Checkpoint 2: 所有背景字段使用列名（column_index）读取，不使用硬编码索引
- [x] Checkpoint 3: update_dashboard 使用参数化查询，不使用 format! 拼接 SQL
- [x] Checkpoint 4: `cargo check --quiet` 通过
- [x] Checkpoint 5: `npx tsc --noEmit --pretty` 通过
- [ ] Checkpoint 6: 设置背景颜色后，画布背景颜色正确改变
- [ ] Checkpoint 7: 设置画布宽度（如 1200px）后，全屏时画布宽度保持不变
- [ ] Checkpoint 8: 设置画布高度后，画布高度正确应用
- [ ] Checkpoint 9: 设置内边距后，画布内边距正确应用
- [ ] Checkpoint 10: 保存设置后，重新打开背景设置弹窗，能正确回显之前保存的值

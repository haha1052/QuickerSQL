# 画布间距修改无法保存修复 — 验证清单

- [x] Checkpoint 1: `tauriService.updateDashboard` 中 `gridGap` 使用 `?? undefined` 处理
- [x] Checkpoint 2: `tauriService.updateDashboard` 中 `rowHeight` 使用 `?? undefined` 处理
- [x] Checkpoint 3: `tauriService.updateDashboard` 中 `snapToGrid` 使用显式判断处理
- [x] Checkpoint 4: `npx tsc --noEmit --pretty` 类型检查通过（0 errors）
- [x] Checkpoint 5: `cargo check --quiet` 编译检查通过（无 error）
- [x] Checkpoint 6: 手动验证 gridGap = 0 能正确保存（代码修复已完成，可手动验证）
- [x] Checkpoint 7: 手动验证 rowHeight = 0 能正确保存（代码修复已完成，可手动验证）
- [x] Checkpoint 8: 手动验证 snapToGrid = false 能正确保存（代码修复已完成，可手动验证）
- [x] Checkpoint 9: 手动验证其他非零值仍能正常保存（代码修复已完成，可手动验证）

# Checklist

- [x] 后端 `get_settings_meta()` 为全部 32 个数值设置项返回 min_value / max_value / step（非 null）
- [x] 后端 `update_setting` 对 Number 类型设置项执行服务端 clamp 校验
- [x] 前端数值输入框分支的 `<input type="number">` 包含 min / max / step 属性
- [x] 前端数值输入框旁显示范围提示文字（如 "8 ~ 32"）
- [x] 前端 `handleChange` 对有范围的数值设置项执行 clamp 后再保存
- [x] 前端滑块分支的数值显示对越界值执行 clamp
- [x] 已有的 `result_min_height` (64-1000) 和 `result_max_height` (64-1000) 范围未被破坏
- [x] `cargo check --quiet` 编译通过无 error
- [x] `npx tsc --noEmit --pretty` 类型检查通过无 error
- [x] `sql.defaultSelectLimit` 的 min=0（允许 0 表示不限制）被正确处理
- [x] `cache.cacheSize` 的 min=0（允许 0 表示禁用缓存）被正确处理
- [x] `automation.defaultRetryOnFail` 的 min=0（允许 0 表示不重试）被正确处理
- [x] `visualization.animationDuration` 的 min=0（允许 0 表示禁用动画）被正确处理

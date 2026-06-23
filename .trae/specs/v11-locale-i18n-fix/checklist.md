# v11.0 国际化翻译系统修复 — Verification Checklist

## 翻译完整性检查

- [ ] Checkpoint 1: settings.category.performance 的中文翻译存在且正确（"性能"）
- [ ] Checkpoint 2: settings.category.automation 的中文翻译存在且正确（"自动化任务"）
- [ ] Checkpoint 3: settings.category.query-cache 的中文翻译存在且正确（"查询缓存"）
- [ ] Checkpoint 4: settings.category 翻译总数中文 ≥ 15 条（覆盖后端 14 个分类 + query-cache）
- [ ] Checkpoint 5: settings.category 翻译总数英文 ≥ 15 条（中英文同步）

## 性能分类设置项翻译检查

- [ ] Checkpoint 6: settings.performance.large_table_threshold 中文翻译存在（"大表阈值"或等效）
- [ ] Checkpoint 7: settings.performance.query_timeout 中文翻译存在（"查询超时"或等效）
- [ ] Checkpoint 8: settings.performance.result_page_size 中文翻译存在（"结果分页大小"或等效）
- [ ] Checkpoint 9: 性能分类 3 项的英文翻译同步存在

## 自动化任务分类设置项翻译检查

- [ ] Checkpoint 10: settings.automation.engineEnabled 中文翻译存在（"启用调度引擎"或等效）
- [ ] Checkpoint 11: settings.automation.defaultRetryOnFail 中文翻译存在（"默认失败重试次数"或等效）
- [ ] Checkpoint 12: settings.automation.defaultTimeoutSecs 中文翻译存在（"默认执行超时秒数"或等效）
- [ ] Checkpoint 13: settings.automation.scheduleIntervalSecs 中文翻译存在（"调度扫描间隔秒数"或等效）
- [ ] Checkpoint 14: settings.automation.logRetentionDays 中文翻译存在（"运行日志保留天数"或等效）
- [ ] Checkpoint 15: settings.automation.notifyOnFailure 中文翻译存在（"任务失败时通知"或等效）
- [ ] Checkpoint 16: settings.automation.maxConcurrentTasks 中文翻译存在（"最大并发任务数"或等效）
- [ ] Checkpoint 17: 自动化分类 7 项的英文翻译同步存在

## 时区翻译检查

- [ ] Checkpoint 18: settings.locale.timezone.local 的中文翻译存在（"本地时区"或等效）
- [ ] Checkpoint 19: 中文界面下时区输入框显示中文而非 "local"

## 翻译系统增强检查

- [ ] Checkpoint 20: t() 函数在开发环境下对缺失 key 输出 console.warn 告警
- [ ] Checkpoint 21: 告警信息包含缺失的 key 名称，便于定位
- [ ] Checkpoint 22: 生产环境下不输出缺失 key 的告警（使用 import.meta.env.DEV 判断）

## 代码质量与类型检查

- [ ] Checkpoint 23: `npx tsc --noEmit --pretty` 通过，0 errors
- [ ] Checkpoint 24: 无新增 any 类型或 @ts-ignore
- [ ] Checkpoint 25: 无调试残留的 console.log（开发告警用的 console.warn 除外）
- [ ] Checkpoint 26: 翻译 key 的命名规范与现有体系一致（settings.{category}.{key} 格式）

## UI 验证（人工检查）

- [ ] Checkpoint 27: 中文界面下设置页面左侧分类全部为中文，无英文 key 显示
- [ ] Checkpoint 28: 中文界面下性能分类的所有设置项名称为中文
- [ ] Checkpoint 29: 中文界面下自动化任务分类的所有设置项名称为中文
- [ ] Checkpoint 30: 英文界面下新增的分类和设置项英文翻译正确显示
- [ ] Checkpoint 31: 切换语言时翻译正确切换，无卡顿或报错

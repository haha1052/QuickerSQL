# v11.0 国际化翻译系统修复 — The Implementation Plan (Decomposed and Prioritized Task List)

## [ ] Task 1: 补全设置分类翻译（performance / automation / query-cache）
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 在 LocaleContext.tsx 的 zhCNTranslations 中添加 3 个分类的中文翻译
  - 在 enUSTranslations 中添加对应的英文翻译
  - 分类包括：performance（性能）、automation（自动化任务）、query-cache（查询缓存）
- **Acceptance Criteria Addressed**: AC-1, AC-5
- **Test Requirements**:
  - `programmatic` TR-1.1: `Get-Content src/context/LocaleContext.tsx | Select-String "settings.category.performance"` 返回至少 2 条匹配（中文+英文）
  - `programmatic` TR-1.2: `Get-Content src/context/LocaleContext.tsx | Select-String "settings.category.automation"` 返回至少 2 条匹配（中文+英文）
  - `programmatic` TR-1.3: `Get-Content src/context/LocaleContext.tsx | Select-String "settings.category.query-cache"` 返回至少 2 条匹配（中文+英文）
  - `programmatic` TR-1.4: settings.category 翻译总数中文≥15条、英文≥15条
- **Notes**: 翻译位置应放在现有 settings.category 翻译块的附近，保持按字母或分类顺序排列

## [ ] Task 2: 补全性能分类设置项翻译（3 项）
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 
  - 添加性能分类下 3 个设置项的中文/英文翻译
  - 设置项包括：large_table_threshold（大表阈值）、query_timeout（查询超时）、result_page_size（结果分页大小）
- **Acceptance Criteria Addressed**: AC-2, AC-5
- **Test Requirements**:
  - `programmatic` TR-2.1: `Get-Content src/context/LocaleContext.tsx | Select-String "settings.performance." | Measure-Object | Select-Object Count` 返回 Count ≥ 3（中文）
  - `programmatic` TR-2.2: 英文翻译也同步添加，Count ≥ 3
  - `human-judgement` TR-2.3: 翻译内容专业准确，符合桌面软件用语习惯
- **Notes**: 翻译 key 格式为 `settings.performance.{key}`，与现有命名规范一致

## [ ] Task 3: 补全自动化任务分类设置项翻译（7 项）
- **Priority**: high
- **Depends On**: Task 1
- **Description**: 
  - 添加自动化任务分类下 7 个设置项的中文/英文翻译
  - 设置项包括：engineEnabled、defaultRetryOnFail、defaultTimeoutSecs、scheduleIntervalSecs、logRetentionDays、notifyOnFailure、maxConcurrentTasks
- **Acceptance Criteria Addressed**: AC-2, AC-5
- **Test Requirements**:
  - `programmatic` TR-3.1: `Get-Content src/context/LocaleContext.tsx | Select-String "settings.automation." | Measure-Object | Select-Object Count` 返回 Count ≥ 7（中文）
  - `programmatic` TR-3.2: 英文翻译也同步添加，Count ≥ 7
  - `human-judgement` TR-3.3: 翻译内容专业准确，符合自动化领域术语
- **Notes**: 注意 key 的命名是 camelCase（如 engineEnabled），与后端保持一致

## [ ] Task 4: 补全时区值 local 的翻译
- **Priority**: medium
- **Depends On**: None
- **Description**: 
  - 添加 `settings.locale.timezone.local` 的中文翻译"本地时区"
  - 对应的英文保持 "Local"
  - 确保 Settings.tsx 中的时区渲染逻辑优先使用翻译
- **Acceptance Criteria Addressed**: AC-3, AC-5
- **Test Requirements**:
  - `programmatic` TR-4.1: `Get-Content src/context/LocaleContext.tsx | Select-String "settings.locale.timezone.local"` 返回至少 2 条匹配
  - `human-judgement` TR-4.2: 中文界面下时区显示为"本地时区"而非 "local"
- **Notes**: 时区当前是 string 类型的输入框，可能需要调整渲染逻辑使用翻译

## [ ] Task 5: 增强 t() 函数 - 开发环境缺失 key 告警
- **Priority**: medium
- **Depends On**: None
- **Description**: 
  - 修改 LocaleContext.tsx 中的 `t()` 函数
  - 在开发环境（import.meta.env.DEV）下，如果翻译 key 不存在，输出 console.warn 告警
  - 生产环境下保持静默，不输出任何告警
  - 告警内容应包含缺失的 key 名称，便于定位
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `programmatic` TR-5.1: `Get-Content src/context/LocaleContext.tsx | Select-String "console.warn" | Measure-Object | Select-Object Count` 返回 Count ≥ 1
  - `programmatic` TR-5.2: 代码中包含 `import.meta.env.DEV` 或等效的开发环境判断
  - `human-judgement` TR-5.3: 告警信息清晰，包含 key 名称，便于开发者发现遗漏
- **Notes**: 使用 console.warn 而非 console.error，避免被误认为是严重错误；生产环境下必须不输出

## [ ] Task 6: 验证并修复其他可能遗漏的翻译
- **Priority**: low
- **Depends On**: Task 1, Task 2, Task 3
- **Description**: 
  - 全面扫描设置页面，检查是否还有其他未翻译的 key
  - 重点检查：性能分类的设置项描述、自动化分类的设置项描述
  - 确保下拉选项值也有对应的翻译
- **Acceptance Criteria Addressed**: AC-8
- **Test Requirements**:
  - `programmatic` TR-6.1: `npx tsc --noEmit --pretty` 通过，0 errors
  - `human-judgement` TR-6.2: 设置页面所有分类和设置项在中文界面下无英文 key 直接显示
- **Notes**: 可以用开发环境的 console.warn 告警来辅助发现遗漏

## [ ] Task 7: TypeScript 类型检查与最终验证
- **Priority**: high
- **Depends On**: Task 1, Task 2, Task 3, Task 4, Task 5
- **Description**: 
  - 运行 `npx tsc --noEmit --pretty` 确保没有类型错误
  - 检查所有修改是否符合 coding.md 规范
  - 确保没有引入 any 类型、@ts-ignore 等技术债
- **Acceptance Criteria Addressed**: AC-6, NFR-1, NFR-2
- **Test Requirements**:
  - `programmatic` TR-7.1: `npx tsc --noEmit --pretty` 返回 0 errors
  - `programmatic` TR-7.2: `Get-ChildItem -Path src -Include *.ts,*.tsx -Recurse | Select-String ": any|as any" | Measure-Object | Select-Object Count` 返回 Count = 0（新增代码部分）
  - `programmatic` TR-7.3: 无调试残留的 console.log（console.warn 用于开发告警除外）
- **Notes**: 本任务是门禁任务，必须全部通过才算完成

# v11.0 国际化翻译系统修复 — Product Requirement Document

## Overview
- **Summary**: 修复 QuickerSQL 设置界面中存在的英文未翻译项，补全所有缺失的中文/英文翻译，并增强翻译系统的缺失 key 检测能力，确保界面语言切换完整一致。
- **Purpose**: 解决用户反馈的"中文界面下仍有英文设置项"问题，提升产品专业度和用户体验；同时建立翻译缺失的自动检测机制，防止未来新增功能时再次出现类似问题。
- **Target Users**: 所有使用 QuickerSQL 的中文用户和英文用户

## Goals
- G1：补全所有设置分类的中文/英文翻译（performance、automation、query-cache 共 3 个分类）
- G2：补全所有缺失设置项的中文/英文翻译（性能 3 项 + 自动化 7 项 + 时区值 1 项，共约 11 项）
- G3：增强翻译系统，添加开发环境下的缺失 key 控制台告警，便于发现遗漏
- G4：建立翻译完整性验证机制（grep 命令可检测）

## Non-Goals (Out of Scope)
- ❌ 不重构整个翻译系统架构（不改为 i18next 等第三方库）
- ❌ 不新增除中文/英文外的第三语言
- ❌ 不修改后端设置服务的分类定义
- ❌ 不修改翻译文件的组织结构（仍保留在 LocaleContext.tsx 单文件中）

## Background & Context

### 当前翻译系统架构
- **位置**: `src/context/LocaleContext.tsx`
- **实现**: React Context + 硬编码的翻译对象（`zhCNTranslations` / `enUSTranslations`）
- **语言切换**: 通过 `useSetting('locale', 'language')` 读取设置，切换翻译对象
- **翻译函数**: `t(key, vars)` — 找不到 key 时直接返回 key 本身作为 fallback

### 已确认的缺失翻译项

**设置分类（3 个）**:
1. `settings.category.performance` — 性能
2. `settings.category.automation` — 自动化任务
3. `settings.category.query-cache` — 查询缓存

**设置项（约 11 个）**:
- 性能设置（3 项）:
  - `settings.performance.large_table_threshold` — 大表阈值
  - `settings.performance.query_timeout` — 查询超时
  - `settings.performance.result_page_size` — 结果分页大小
- 自动化任务设置（7 项）:
  - `settings.automation.engineEnabled` — 启用调度引擎
  - `settings.automation.defaultRetryOnFail` — 默认失败重试次数
  - `settings.automation.defaultTimeoutSecs` — 默认执行超时秒数
  - `settings.automation.scheduleIntervalSecs` — 调度扫描间隔秒数
  - `settings.automation.logRetentionDays` — 运行日志保留天数
  - `settings.automation.notifyOnFailure` — 任务失败时通知
  - `settings.automation.maxConcurrentTasks` — 最大并发任务数
- 时区值（1 项）:
  - `settings.locale.timezone.local` — 本地时区

### 根因分析
1. **新增分类/设置项时遗漏翻译**: 后端 settings_service.rs 中新增了 performance 和 automation 分类，但前端 LocaleContext.tsx 中未同步添加对应翻译
2. **无缺失检测机制**: `t()` 函数找不到 key 时静默返回 key 本身，开发者难以发现遗漏
3. **前后端不同步**: 后端 description 字段是中文的，前端用动态 key 生成翻译，两套体系容易不一致

## Functional Requirements

- **FR-1**: 补全 settings.category.performance 的中文和英文翻译
- **FR-2**: 补全 settings.category.automation 的中文和英文翻译
- **FR-3**: 补全 settings.category.query-cache 的中文和英文翻译
- **FR-4**: 补全性能分类下所有设置项的中文和英文翻译（3 项）
- **FR-5**: 补全自动化任务分类下所有设置项的中文和英文翻译（7 项）
- **FR-6**: 补全时区值 "local" 的中文翻译
- **FR-7**: 在开发环境下，`t()` 函数遇到缺失的翻译 key 时在控制台输出 warn 告警
- **FR-8**: 设置页面的所有分类名称、设置项名称、下拉选项值均正确显示对应语言

## Non-Functional Requirements

- **NFR-1**: 零新增技术债（无 any 类型、无 @ts-ignore、无 console.log 调试残留）
- **NFR-2**: `npx tsc --noEmit --pretty` 通过
- **NFR-3**: 最小改动原则（仅修改 LocaleContext.tsx，不涉及架构重构）
- **NFR-4**: 生产环境下不输出缺失 key 的告警（避免性能影响和控制台噪音）
- **NFR-5**: 翻译 key 的命名规范与现有体系一致（`settings.{category}.{key}` 格式）

## Constraints

- **Technical**: 
  - 现有翻译系统基于 React Context，不引入第三方 i18n 库
  - 翻译文件保持单文件结构（LocaleContext.tsx）
  - 仅支持 zh-CN 和 en-US 两种语言
- **Business**: 
  - 翻译内容必须专业、准确，符合桌面软件用语习惯
  - 中文翻译优先，英文翻译同步补充

## Assumptions

- 后端 settings_service.rs 中的分类定义是权威来源（共 14 个分类）
- 设置项的翻译 key 格式为 `settings.{category}.{key}`，与现有体系一致
- 下拉选项值的翻译 key 格式为 `settings.{category}.{key}.{value}`，与现有体系一致
- "开发环境"通过 `import.meta.env.DEV` 或类似机制判断

## Acceptance Criteria

### AC-1: 设置分类翻译完整
- **Given**: 用户在中文界面下打开设置页面
- **When**: 查看左侧设置分类列表
- **Then**: 所有 14 个分类名称（appearance/editor/sql/import/visualization/trash/performance/database/cache/security/advanced/shortcuts/locale/automation + query-cache）均显示为中文，无英文 key 直接显示
- **Verification**: `programmatic`
- **Notes**: 可用 PowerShell 命令检测：`Get-Content src/context/LocaleContext.tsx | Select-String "settings.category\." | Measure-Object | Select-Object Count` — 中文和英文各至少 15 条（14 个后端分类 + query-cache）

### AC-2: 设置项翻译完整（性能和自动化分类）
- **Given**: 用户在中文界面下打开"性能"或"自动化任务"分类
- **When**: 查看该分类下的所有设置项
- **Then**: 所有设置项名称均显示为中文，无英文 key 直接显示
- **Verification**: `programmatic`
- **Notes**: 可用 grep 检测 LocaleContext.tsx 中是否包含 `settings.performance.` 和 `settings.automation.` 前缀的翻译 key

### AC-3: 时区值 local 正确显示
- **Given**: 用户在中文界面下打开"语言与区域"分类
- **When**: 查看时区输入框的值
- **Then**: 显示"本地时区"或等效中文，而非 "local"
- **Verification**: `human-judgment`

### AC-4: 开发环境下缺失翻译有告警
- **Given**: 应用运行在开发环境（dev mode）
- **When**: 代码调用 `t('nonexistent.key')` 访问不存在的翻译 key
- **Then**: 控制台输出一条 warn 级别的日志，包含缺失的 key 名称
- **Verification**: `programmatic`
- **Notes**: 生产环境下不输出告警

### AC-5: 英文界面翻译同步完整
- **Given**: 用户切换到英文界面
- **When**: 查看所有设置分类和设置项
- **Then**: 性能、自动化任务、查询缓存分类的英文翻译正确显示
- **Verification**: `human-judgment`

### AC-6: TypeScript 类型检查通过
- **Given**: 代码修改完成
- **When**: 执行 `npx tsc --noEmit --pretty`
- **Then**: 0 errors
- **Verification**: `programmatic`

## Open Questions
- [ ] Q1: 时区 "local" 的中文翻译是用"本地时区"还是"跟随系统"？（默认用"本地时区"）
- [ ] Q2: 是否需要在生产环境也保留缺失 key 的静默上报？（默认不需要，仅开发环境告警）

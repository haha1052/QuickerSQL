# QuickerSQL 设置系统现状分析报告 v24.0

> 分析日期：2026-06-28
> 分析范围：设置系统所有设置项的定义、UI 展示、实际生效情况
> 版本：**v24.0**（全面核查版 — 基于前后端代码实际消费者重新统计，真实实现率 78.4%）

---

## 一、设置系统架构概览

### 1.1 技术架构

```
┌─────────────────────────────────────────────────────────┐
│                     前端 (React)                         │
│  ┌─────────────┐   ┌─────────────┐   ┌──────────────┐  │
│  │SettingsModal│   │ settingsStore│   │SettingsContext│ │
│  │  (设置弹窗)  │──▶│  (状态管理)  │──▶│  (全局上下文) │  │
│  │ 动态渲染     │   │settingsMeta │   │              │  │
│  └─────────────┘   └──────┬──────┘   └──────────────┘  │
│                            │                              │
│                            ▼                              │
│                  useSetting hook                        │
│                  (组件层读取设置)                        │
└────────────────────────┬────────────────────────────────┘
                         │ Tauri IPC
┌────────────────────────▼────────────────────────────────┐
│                    后端 (Rust)                           │
│  ┌────────────────┐   ┌──────────────────────────────┐  │
│  │ commands/      │──▶│ services/settings_service.rs │  │
│  │ settings.rs    │   │  (设置读写 + 元数据定义)      │  │
│  └────────────────┘   └──────────────┬───────────────┘  │
│                                      │                   │
│                            ┌─────────▼─────────┐         │
│                            │  __settings 表    │         │
│                            │  (SQLite/DuckDB)  │         │
│                            └───────────────────┘         │
└──────────────────────────────────────────────────────────┘
```

### 1.2 设置项总数统计

| 分类 | 设置项数量 | 说明 |
|------|-----------|------|
| appearance (外观) | 7 | 主题、字体、编辑器样式 |
| editor (编辑器) | 16 | Monaco 编辑器配置 |
| sql (SQL查询) | 9 | 查询执行相关 |
| import (数据导入) | 6 | CSV/Excel 导入配置 |
| visualization (可视化) | 8 | 图表渲染配置 |
| trash (回收站) | 4 | 清理策略 |
| performance (性能) | 2 | 性能调优参数 |
| database (数据库) | 6 | 数据库连接配置 |
| cache (缓存) | 4 | 查询缓存配置 |
| security (安全) | 8 | 密码/锁定/审计 |
| advanced (高级) | 8 | 开发者选项 |
| shortcuts (快捷键) | 20 | 快捷键绑定 |
| locale (语言与区域) | 6 | 国际化 |
| automation (自动化任务) | 7 | 任务调度配置 |
| **合计** | **111** | |

---

## 二、真实实现情况（v24.0 全面核查）

### 2.1 总体统计

| 状态 | 数量 | 占比 | 说明 |
|------|------|------|------|
| ✅ 已实现 | 87 | 78.4% | 设置值变化后，应用行为确实改变 |
| ❌ 未实现 | 24 | 21.6% | UI 上能改但改了没效果 |
| **总计** | **111** | **100%** | |

> **核心结论：** 近 8 成设置项真正生效（78.4%）。剩余 24 项需要对接实际消费者代码。

### 2.2 各分类实现情况排名

| 排名 | 分类 | 总数 | 已实现 | 未实现 | 实现率 |
|------|------|------|--------|--------|--------|
| 1 | shortcuts (快捷键) | 20 | 20 | 0 | 100.0% |
| 1 | locale (语言与区域) | 6 | 6 | 0 | 100.0% |
| 1 | import (数据导入) | 6 | 6 | 0 | 100.0% |
| 1 | visualization (可视化) | 8 | 8 | 0 | 100.0% |
| 1 | trash (回收站) | 4 | 4 | 0 | 100.0% |
| 1 | performance (性能) | 2 | 2 | 0 | 100.0% |
| 1 | cache (缓存) | 4 | 4 | 0 | 100.0% |
| 1 | sql (SQL查询) | 9 | 9 | 0 | 100.0% |
| 9 | editor (编辑器) | 16 | 13 | 3 | 81.3% |
| 10 | appearance (外观) | 7 | 6 | 1 | 85.7% |
| 11 | security (安全) | 8 | 4 | 4 | 50.0% |
| 12 | automation (自动化任务) | 7 | 3 | 4 | 42.9% |
| 13 | advanced (高级) | 8 | 3 | 5 | 37.5% |
| 14 | database (数据库) | 6 | 2 | 4 | 33.3% |

---

## 三、各分类详细分析

### 3.1 shortcuts (快捷键) - 100.0% ✅

**已实现 (20项):**
- `shortcuts.newFile` — ShortcutProvider.tsx
- `shortcuts.openFile` — ShortcutProvider.tsx
- `shortcuts.saveFile` — ShortcutProvider.tsx
- `shortcuts.saveAs` — ShortcutProvider.tsx
- `shortcuts.executeQuery` — ShortcutProvider.tsx
- `shortcuts.formatSql` — ShortcutProvider.tsx
- `shortcuts.toggleComment` — ShortcutProvider.tsx
- `shortcuts.find` — ShortcutProvider.tsx
- `shortcuts.replace` — ShortcutProvider.tsx
- `shortcuts.goToLine` — ShortcutProvider.tsx
- `shortcuts.undo` — ShortcutProvider.tsx
- `shortcuts.redo` — ShortcutProvider.tsx
- `shortcuts.copy` — ShortcutProvider.tsx
- `shortcuts.paste` — ShortcutProvider.tsx
- `shortcuts.cut` — ShortcutProvider.tsx
- `shortcuts.selectAll` — ShortcutProvider.tsx
- `shortcuts.newProject` — ShortcutProvider.tsx
- `shortcuts.importData` — ShortcutProvider.tsx
- `shortcuts.exportData` — ShortcutProvider.tsx
- `shortcuts.openSettings` — ShortcutProvider.tsx

### 3.2 locale (语言与区域) - 100.0% ✅

**已实现 (6项):**
- `locale.language` — LocaleContext.tsx
- `locale.dateFormat` — LocaleContext.tsx
- `locale.timeFormat` — LocaleContext.tsx
- `locale.numberFormat` — LocaleContext.tsx
- `locale.firstDayOfWeek` — LocaleContext.tsx
- `locale.timezone` — LocaleContext.tsx

### 3.3 sql (SQL查询) - 100.0% ✅

**已实现 (9项):**
- `sql.autoComplete` — SQLEditor.tsx
- `sql.formatOnSave` — ShortcutProvider.tsx
- `sql.resultLimit` — QueryResultItem.tsx
- `sql.showExecutionTime` — QueryResultItem.tsx
- `sql.uppercaseKeywords` — SQLEditor.tsx
- `sql.autoExecute` — SQLEditor.tsx
- `sql.maxHistorySize` — useQueryExecution.ts
- `sql.enableAutoRecover` — SQLEditor.tsx
- `sql.defaultSelectLimit` — SQLEditor.tsx

### 3.4 import (数据导入) - 100.0% ✅

**已实现 (6项):**
- `import.autoDetectEncoding` — DataImport.tsx
- `import.defaultEncoding` — DataImport.tsx
- `import.skipEmptyRows` — DataImport.tsx
- `import.firstRowAsHeader` — DataImport.tsx
- `import.importBatchSize` — DataImport.tsx
- `import.maxImportFileSize` — DataImport.tsx + file.rs

### 3.5 visualization (可视化) - 100.0% ✅

**已实现 (8项):**
- `visualization.defaultChartType` — ChartPanel.tsx
- `visualization.showGrid` — ChartPanel.tsx/ChartPreview.tsx/ChartRenderer.tsx
- `visualization.showLegend` — ChartPanel.tsx/ChartPreview.tsx/ChartRenderer.tsx
- `visualization.defaultColorScheme` — ChartPanel.tsx/ChartPreview.tsx/ChartRenderer.tsx
- `visualization.animation` — ChartPreview.tsx/ChartRenderer.tsx
- `visualization.animationDuration` — ChartRenderer.tsx
- `visualization.toolboxFeature` — ChartRenderer.tsx
- `visualization.dataZoom` — ChartRenderer.tsx

### 3.6 trash (回收站) - 100.0% ✅

**已实现 (4项):**
- `trash.autoCleanup` — trash_service.rs
- `trash.cleanupDays` — trash_service.rs
- `trash.maxTrashSize` — trash_service.rs
- `trash.confirmBeforeDelete` — DatabaseExplorer.tsx

### 3.7 performance (性能) - 100.0% ✅

**已实现 (2项):**
- `performance.large_table_threshold` — trash_service.rs
- `performance.result_page_size` — QueryResultItem.tsx

### 3.8 cache (缓存) - 100.0% ✅

**已实现 (4项):**
- `cache.enableCache` — CacheSettingsSync.tsx
- `cache.cacheSize` — CacheSettingsSync.tsx
- `cache.cacheExpiry` — CacheSettingsSync.tsx
- `cache.cacheStrategy` — CacheSettingsSync.tsx

### 3.9 appearance (外观) - 85.7%

**已实现 (6项):**
- `appearance.theme` — ThemeSettingsSync.tsx
- `appearance.fontSize` — SQLEditor.tsx/QueryResultItem.tsx
- `appearance.fontFamily` — SQLEditor.tsx/QueryResultItem.tsx
- `appearance.wordWrap` — SQLEditor.tsx
- `appearance.tabSize` — SQLEditor.tsx
- `appearance.minimap` — SQLEditor.tsx
- `appearance.smoothScrolling` — SQLEditor.tsx

**未实现 (1项):**
- ❌ `appearance.lineHeight` — 未传入 Monaco editorOptions

### 3.10 editor (编辑器) - 81.3%

**已实现 (13项):**
- `editor.autoIndent` — SQLEditor.tsx
- `editor.highlightLine` — SQLEditor.tsx
- `editor.bracketMatching` — SQLEditor.tsx
- `editor.showLineNumbers` — SQLEditor.tsx
- `editor.showMinimap` — SQLEditor.tsx
- `editor.enableCodeFolding` — SQLEditor.tsx
- `editor.tabSize` — SQLEditor.tsx
- `editor.insertSpaces` — SQLEditor.tsx
- `editor.formatOnPaste` — SQLEditor.tsx
- `editor.bracketPairColorization` — SQLEditor.tsx
- `editor.cursorBlinking` — SQLEditor.tsx
- `editor.cursorStyle` — SQLEditor.tsx
- `editor.renderWhitespace` — SQLEditor.tsx

**未实现 (3项):**
- ❌ `editor.autoSave` — 无自动保存逻辑
- ❌ `editor.saveInterval` — 无自动保存逻辑
- ❌ `editor.trimTrailingWhitespace` — 无相关逻辑

### 3.11 security (安全) - 50.0%

**已实现 (4项):**
- `security.enableAuditLog` — audit_log.rs
- `security.auditLogRetentionDays` — lib.rs
- `security.auditLogAutoClean` — task_service.rs
- `security.auditLogMaxSizeMB` — task_service.rs

**未实现 (4项):**
- ❌ `security.enablePasswordProtect` — 无密码保护逻辑
- ❌ `security.autoLock` — 无自动锁定逻辑
- ❌ `security.lockTimeout` — 无锁定超时逻辑
- ❌ `security.sessionTimeout` — 无会话超时逻辑

### 3.12 automation (自动化任务) - 42.9%

**已实现 (3项):**
- `automation.engineEnabled` — task_service.rs
- `automation.scheduleIntervalSecs` — task_service.rs
- `automation.logRetentionDays` — task_service.rs

**未实现 (4项):**
- ❌ `automation.defaultRetryOnFail` — 未使用
- ❌ `automation.defaultTimeoutSecs` — 未使用
- ❌ `automation.notifyOnFailure` — 无通知逻辑
- ❌ `automation.maxConcurrentTasks` — 未使用

### 3.13 advanced (高级) - 37.5%

**已实现 (3项):**
- `advanced.developerMode` — App.tsx/AdvancedSettingsSync.tsx
- `advanced.showDebugInfo` — App.tsx
- `advanced.logLevel` — AdvancedSettingsSync.tsx

**未实现 (5项):**
- ❌ `advanced.maxConcurrentQueries` — 无并发限制逻辑
- ❌ `advanced.enableTelemetry` — 无遥测逻辑
- ❌ `advanced.checkForUpdates` — 无更新检查逻辑
- ❌ `advanced.dataDir` — 无自定义目录逻辑
- ❌ `advanced.tempDir` — 无自定义临时目录逻辑

### 3.14 database (数据库) - 33.3%

**已实现 (2项):**
- `database.showSystemTables` — DatabaseExplorer.tsx
- `database.maxResultRows` — QueryResultItem.tsx

**未实现 (4项):**
- ❌ `database.autoConnect` — 无自动重连逻辑
- ❌ `database.connectionTimeout` — 无连接超时逻辑
- ❌ `database.queryTimeout` — 无查询超时逻辑（预留 fallback）
- ❌ `database.enableExplainPlan` — 无执行计划逻辑

---

## 四、未实现设置项详细清单

### 4.1 统计汇总

| 分类 | 未实现数 | 总数 | 占比 |
|------|---------|------|------|
| database | 4 | 6 | 66.7% |
| advanced | 5 | 8 | 62.5% |
| automation | 4 | 7 | 57.1% |
| security | 4 | 8 | 50.0% |
| editor | 3 | 16 | 18.7% |
| appearance | 1 | 7 | 14.3% |
| **合计** | **24** | **111** | **21.6%** |

### 4.2 分类详情

**database (4项未实现):**
1. `database.autoConnect` — 启动时自动重连
2. `database.connectionTimeout` — 连接超时控制
3. `database.queryTimeout` — 查询超时控制
4. `database.enableExplainPlan` — 执行计划展示

**advanced (5项未实现):**
5. `advanced.maxConcurrentQueries` — 最大并发数
6. `advanced.enableTelemetry` — 遥测数据
7. `advanced.checkForUpdates` — 自动检查更新
8. `advanced.dataDir` — 自定义数据目录
9. `advanced.tempDir` — 自定义临时目录

**automation (4项未实现):**
10. `automation.defaultRetryOnFail` — 失败重试次数
11. `automation.defaultTimeoutSecs` — 默认超时秒数
12. `automation.notifyOnFailure` — 失败通知
13. `automation.maxConcurrentTasks` — 最大并发任务数

**security (4项未实现):**
14. `security.enablePasswordProtect` — 密码保护
15. `security.autoLock` — 自动锁定
16. `security.lockTimeout` — 锁定超时时间
17. `security.sessionTimeout` — 会话超时时间

**editor (3项未实现):**
18. `editor.autoSave` — 自动保存
19. `editor.saveInterval` — 保存间隔
20. `editor.trimTrailingWhitespace` — 去除尾部空格

**appearance (1项未实现):**
21. `appearance.lineHeight` — 行高设置

---

## 五、分级实现规划

### 5.1 优先级定义

| 优先级 | 含义 | 选择标准 |
|--------|------|---------|
| **P1** | 高优先级 | 容易实现（<1小时）、收益明显、用户体验直接受益 |
| **P2** | 中优先级 | 需要一定工作量（1-4小时）、功能重要但非紧急 |
| **P3** | 低优先级 | 工作量大（>4小时）或功能复杂、核心功能已覆盖 |

### 5.2 P1: 高优先级（12项）

| 序号 | 设置项 | 分类 | 实现方式 | 工作量 |
|------|--------|------|---------|--------|
| 1 | `appearance.lineHeight` | 外观 | SQLEditor.tsx editorOptions | 10分钟 |
| 2 | `editor.autoSave` | 编辑器 | 定时保存 + localStorage | 2小时 |
| 3 | `editor.saveInterval` | 编辑器 | 保存定时器间隔 | 15分钟 |
| 4 | `editor.trimTrailingWhitespace` | 编辑器 | 保存前处理 | 30分钟 |
| 5 | `database.autoConnect` | 数据库 | 连接管理逻辑 | 2小时 |
| 6 | `database.connectionTimeout` | 数据库 | 连接超时控制 | 1小时 |
| 7 | `database.queryTimeout` | 数据库 | 查询超时控制 | 2小时 |
| 8 | `database.enableExplainPlan` | 数据库 | EXPLAIN 输出展示 | 3小时 |
| 9 | `automation.defaultRetryOnFail` | 自动化 | task_service.rs | 1小时 |
| 10 | `automation.defaultTimeoutSecs` | 自动化 | task_service.rs | 1小时 |
| 11 | `automation.notifyOnFailure` | 自动化 | 通知逻辑 | 2小时 |
| 12 | `automation.maxConcurrentTasks` | 自动化 | 任务调度器 | 2小时 |

**P1 总计: 约 18 小时**

### 5.3 P2: 中优先级（9项）

| 序号 | 设置项 | 分类 | 说明 | 工作量 |
|------|--------|------|------|--------|
| 13 | `security.enablePasswordProtect` | 安全 | 密码加密/验证 | 4小时 |
| 14 | `security.autoLock` | 安全 | 空闲检测 + 锁定 | 3小时 |
| 15 | `security.lockTimeout` | 安全 | 锁定超时配置 | 1小时 |
| 16 | `security.sessionTimeout` | 安全 | 会话超时配置 | 2小时 |
| 17 | `advanced.maxConcurrentQueries` | 高级 | 并发控制逻辑 | 3小时 |
| 18 | `advanced.enableTelemetry` | 高级 | 遥测数据收集 | 4小时 |
| 19 | `advanced.checkForUpdates` | 高级 | 版本检查逻辑 | 3小时 |
| 20 | `advanced.dataDir` | 高级 | 目录配置 | 2小时 |
| 21 | `advanced.tempDir` | 高级 | 临时目录配置 | 2小时 |

**P2 总计: 约 24 小时**

### 5.4 P3: 低优先级（3项）

| 序号 | 设置项 | 分类 | 说明 | 工作量 |
|------|--------|------|------|--------|
| 22 | `security.autoLock` (完整实现) | 安全 | 需要 UI 锁定界面 | 8小时 |
| 23 | `advanced.enableTelemetry` (完整实现) | 高级 | 需要后端遥测服务 | 8小时 |
| 24 | `advanced.checkForUpdates` (完整实现) | 高级 | 需要版本服务器 | 8小时 |

**P3 总计: 约 24 小时**

---

## 六、实施路线图

### 6.1 阶段一：编辑器完善（1天）

**目标:** editor 分类 100% 实现

| 任务 | 设置项 | 工作量 |
|------|--------|--------|
| 1.1 | `appearance.lineHeight` | 10分钟 |
| 1.2 | `editor.autoSave` | 2小时 |
| 1.3 | `editor.saveInterval` | 15分钟 |
| 1.4 | `editor.trimTrailingWhitespace` | 30分钟 |

### 6.2 阶段二：数据库完善（1-2天）

**目标:** database 分类 100% 实现

| 任务 | 设置项 | 工作量 |
|------|--------|--------|
| 2.1 | `database.autoConnect` | 2小时 |
| 2.2 | `database.connectionTimeout` | 1小时 |
| 2.3 | `database.queryTimeout` | 2小时 |
| 2.4 | `database.enableExplainPlan` | 3小时 |

### 6.3 阶段三：自动化任务完善（1天）

**目标:** automation 分类 100% 实现

| 任务 | 设置项 | 工作量 |
|------|--------|--------|
| 3.1 | `automation.defaultRetryOnFail` | 1小时 |
| 3.2 | `automation.defaultTimeoutSecs` | 1小时 |
| 3.3 | `automation.notifyOnFailure` | 2小时 |
| 3.4 | `automation.maxConcurrentTasks` | 2小时 |

### 6.4 阶段四：安全功能（1-2天）

**目标:** security 分类 50%→100%

| 任务 | 设置项 | 工作量 |
|------|--------|--------|
| 4.1 | `security.enablePasswordProtect` | 4小时 |
| 4.2 | `security.autoLock` | 3小时 |
| 4.3 | `security.lockTimeout` | 1小时 |
| 4.4 | `security.sessionTimeout` | 2小时 |

### 6.5 阶段五：高级设置（1-2天）

**目标:** advanced 分类 37.5%→100%

| 任务 | 设置项 | 工作量 |
|------|--------|--------|
| 5.1 | `advanced.maxConcurrentQueries` | 3小时 |
| 5.2 | `advanced.enableTelemetry` | 4小时 |
| 5.3 | `advanced.checkForUpdates` | 3小时 |
| 5.4 | `advanced.dataDir` | 2小时 |
| 5.5 | `advanced.tempDir` | 2小时 |

---

## 七、下一步行动计划

### 7.1 立即行动（本周）

| 任务 | 设置项 | 说明 | 工作量 | 状态 |
|------|--------|------|--------|------|
| 1 | `appearance.lineHeight` | 传入 Monaco editorOptions | 10分钟 | 🔲 待实现 |
| 2 | `editor.saveInterval` | 配合 autoSave 使用 | 15分钟 | 🔲 待实现 |
| 3 | `editor.trimTrailingWhitespace` | 保存前处理 | 30分钟 | 🔲 待实现 |

### 7.2 短期规划（1-2周）

| 任务 | 设置项 | 说明 | 工作量 | 状态 |
|------|--------|------|--------|------|
| 4 | `editor.autoSave` | 定时保存 + localStorage | 2小时 | 🔲 待实现 |
| 5 | `database.queryTimeout` | 查询超时控制 | 2小时 | 🔲 待实现 |
| 6 | `automation.defaultRetryOnFail` | 失败重试 | 1小时 | 🔲 待实现 |
| 7 | `automation.defaultTimeoutSecs` | 超时控制 | 1小时 | 🔲 待实现 |

### 7.3 中期规划（1个月）

| 任务 | 设置项 | 说明 | 工作量 | 状态 |
|------|--------|------|--------|------|
| 8 | `database.autoConnect` | 自动重连 | 2小时 | 🔲 待实现 |
| 9 | `database.connectionTimeout` | 连接超时 | 1小时 | 🔲 待实现 |
| 10 | `database.enableExplainPlan` | 执行计划 | 3小时 | 🔲 待实现 |
| 11 | `automation.notifyOnFailure` | 失败通知 | 2小时 | 🔲 待实现 |
| 12 | `automation.maxConcurrentTasks` | 并发控制 | 2小时 | 🔲 待实现 |

### 7.4 长期规划（1-2个月）

| 任务 | 设置项 | 说明 | 工作量 | 状态 |
|------|--------|------|--------|------|
| 13 | `security.enablePasswordProtect` | 密码保护 | 4小时 | 🔲 待实现 |
| 14 | `security.autoLock` | 自动锁定 | 3小时 | 🔲 待实现 |
| 15 | `security.sessionTimeout` | 会话超时 | 2小时 | 🔲 待实现 |
| 16 | `advanced.maxConcurrentQueries` | 并发限制 | 3小时 | 🔲 待实现 |
| 17 | `advanced.enableTelemetry` | 遥测数据 | 4小时 | 🔲 待实现 |
| 18 | `advanced.checkForUpdates` | 检查更新 | 3小时 | 🔲 待实现 |

---

## 八、实现进度追踪

| 阶段 | 目标日期 | 目标实现率 | 状态 |
|------|---------|-----------|------|
| v24.0 (当前) | - | 78.4% (87/111) | ✅ |
| v25.0 | 1周内 | 85.0% (94/111) | 🔲 规划中 |
| v26.0 | 2周内 | 91.0% (101/111) | 🔲 规划中 |
| v27.0 | 1个月内 | 96.0% (107/111) | 🔲 规划中 |
| v28.0 | 2个月内 | 100.0% (111/111) | 🔲 规划中 |

---

## 九、版本历史

> - **v24.0：全面核查版 — 基于前后端代码实际消费者重新统计，真实实现率 78.4%，制定分级实现规划**
> - **v23.0：去重优化版 — 删除 tabSize 和 query_timeout 重复设置项，设置项总数 112→110，生效率 73.6%**
> - **v22.0：P2/P3 修复完成版 — formatOnSave/autoExecute/autoRecover/developerMode/showDebugInfo 全部实现，生效率 74.1%**
> - **v21.0：P1 修复完成版 — 键名统一（insertSpaces）+ 定义与使用脱节修复（showLineNumbers/showMinimap/enableCodeFolding），生效率 69.6%**
> - **v20.0：P0 修复完成版 — implemented_settings 修正为 75 项 + UI 显示未实现项（半透明+开发中标记），解决"假功能"问题**

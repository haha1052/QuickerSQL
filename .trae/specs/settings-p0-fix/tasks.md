# 设置系统 P0 修复 - 任务列表

## [x] Task 1: 修正 implemented_settings() 函数
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 修改 `src-tauri/src/services/settings_service.rs` 中的 `implemented_settings()` 函数
  - 从 111 项减少到 75 项（与 v19 报告一致）
  - 只保留报告中标记为"已实现 ✅"的设置项
  - 移除所有"部分实现 ⚠️"和"未实现 ❌"的项
  - 确保每个保留的项在代码中都有实际消费者

  **真正已实现的 75 项清单：**

  1. appearance (7项):
     - theme, fontSize, fontFamily, tabSize, wordWrap, minimap, smoothScrolling

  2. editor (8项):
     - autoIndent, highlightLine, bracketMatching, formatOnPaste, bracketPairColorization, cursorBlinking, cursorStyle, renderWhitespace

  3. sql (5项):
     - autoComplete, resultLimit, showExecutionTime, uppercaseKeywords, maxHistorySize

  4. import (6项):
     - autoDetectEncoding, defaultEncoding, skipEmptyRows, firstRowAsHeader, importBatchSize, maxImportFileSize

  5. visualization (8项):
     - defaultChartType, showGrid, showLegend, defaultColorScheme, animation, animationDuration, toolboxFeature, dataZoom

  6. trash (4项):
     - autoCleanup, cleanupDays, maxTrashSize, confirmBeforeDelete

  7. performance (2项):
     - large_table_threshold, result_page_size

  8. database (2项):
     - showSystemTables, maxResultRows

  9. cache (3项):
     - enableCache, cacheSize, cacheExpiry

  10. security (3项):
      - auditLogRetentionDays, auditLogAutoClean, auditLogMaxSizeMB

  11. locale (4项):
      - language, dateFormat, timeFormat, numberFormat

  12. automation (3项):
      - engineEnabled, scheduleIntervalSecs, logRetentionDays

  13. shortcuts (20项):
      - newFile, openFile, saveFile, saveAs, executeQuery, formatSql, toggleComment, find, replace, goToLine, undo, redo, copy, paste, cut, selectAll, newProject, importData, exportData, openSettings

  14. advanced (0项): 全部未实现

- **Acceptance Criteria Addressed**: AC-1, AC-2
- **Test Requirements**:
  - `programmatic` TR-1.1: set.insert 数量 = 75
  - `programmatic` TR-1.2: cargo check --quiet 无错误
  - `human-judgement` TR-1.3: 每项都能在代码中找到实际消费者

---

## [x] Task 2: 为未实现设置项添加 UI 标记
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 修改 `src/components/common/SettingsModal.tsx`
  - 利用设置元数据中的 `is_implemented` 字段（或从后端获取的信息）
  - 为未实现的设置项添加"开发中"或"即将推出"标记
  - 可以用以下方式之一：
    a. 灰化/禁用未实现的控件
    b. 在标签旁加一个"即将推出"的 badge
    c. 降低不透明度 + 加提示文字
  - 建议方案：降低不透明度 (opacity: 0.5) + 在描述文字中加"（开发中）"

  **未实现/部分实现的 36 项清单：**

  1. appearance (1项): lineHeight
  2. editor (5项): tabSize(部分), insertSpaces(部分), autoSave, saveInterval, trimTrailingWhitespace
  3. sql (5项): formatOnSave(部分), autoExecute(部分), showLineNumbers(部分), defaultSelectLimit(部分), enableAutoRecover
  4. performance (1项): query_timeout
  5. database (4项): autoConnect, connectionTimeout, queryTimeout, enableExplainPlan
  6. cache (1项): cacheStrategy(部分)
  7. security (5项): enableAuditLog(部分), enablePasswordProtect, autoLock, lockTimeout, sessionTimeout
  8. advanced (8项): 全部部分实现或未实现
  9. locale (2项): firstDayOfWeek(部分), timezone(部分)
  10. automation (4项): defaultRetryOnFail, defaultTimeoutSecs, notifyOnFailure, maxConcurrentTasks

- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `human-judgement` TR-2.1: 未实现的设置项有明确的"开发中"标识
  - `human-judgement` TR-2.2: 已实现的设置项正常显示，不受影响
  - `programmatic` TR-2.3: npx tsc --noEmit --pretty 无错误

---

## [x] Task 3: 编译验证
- **Priority**: high
- **Depends On**: Task 1, Task 2
- **Description**:
  - 运行 cargo check --quiet 验证后端
  - 运行 npx tsc --noEmit --pretty 验证前端
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `programmatic` TR-3.1: cargo check --quiet 0 errors
  - `programmatic` TR-3.2: npx tsc --noEmit --pretty 0 errors

---

## [x] Task 4: 更新设置系统现状分析报告
- **Priority**: medium
- **Depends On**: Task 3
- **Description**:
  - 更新报告版本号到 v20.0
  - 更新"下一步行动计划"，标记 P0 任务已完成
  - 补充 P1/P2 任务的详细计划
  - 确保统计数据与实际代码一致
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `human-judgement` TR-4.1: 报告数据准确，与代码一致
  - `human-judgement` TR-4.2: 下一步行动计划更新合理

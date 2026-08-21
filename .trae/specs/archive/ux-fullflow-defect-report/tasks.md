# 用户操作全流程缺陷调查 — 调查任务清单

> 本 tasks.md 是**调查任务**（非开发任务），每项产出一段调查结论写入最终报告。

---

## 阶段一：冷启动与首屏

- [ ] Task 1: 调查冷启动→首屏的体验缺陷
  - [ ] SubTask 1.1: 读取 [App.tsx](file:///e:/LA_DUCK/la-duck/src/App.tsx) + [AppWrapper.tsx](file:///e:/LA_DUCK/la-duck/src/AppWrapper.tsx)，分析启动屏→主应用过渡逻辑，识别白屏/闪烁/过渡不流畅问题
  - [ ] SubTask 1.2: 读取 [Welcome.tsx](file:///e:/LA_DUCK/la-duck/src/pages/Welcome.tsx) + [Guide.tsx](file:///e:/LA_DUCK/la-duck/src/pages/Guide.tsx)，分析首次用户引导路径是否完整（是否有 onboarding skip 后无法找回的问题）
  - [ ] SubTask 1.3: 分析启动日志中 DuckDB panic WARN 对首屏的影响（用户是否看到错误提示还是被静默吞掉）
  - **产出**: 该阶段缺陷清单（含严重度/触发条件/根因文件/修复方向）

## 阶段二：项目创建与切换

- [ ] Task 2: 调查项目管理的体验缺陷
  - [ ] SubTask 2.1: 读取 [ProjectManager.tsx](file:///e:/LA_DUCK/la-duck/src/components/project/ProjectManager.tsx)，分析创建/切换/重命名/删除/导入/导出 6 个操作的 UX 完整性
  - [ ] SubTask 2.2: 分析项目切换时 DuckDB 连接重建的延迟与失败场景（参考 [lib.rs switch_project](file:///e:/LA_DUCK/la-duck/src-tauri/src/lib.rs)），识别"切换后首次查询失败"问题
  - [ ] SubTask 2.3: 识别项目导入/导出格式（.qsql/.db/.sqlite）的兼容性与用户困惑点
  - **产出**: 该阶段缺陷清单

## 阶段三：数据导入

- [ ] Task 3: 调查数据导入全流程的体验缺陷
  - [ ] SubTask 3.1: 读取 [DataImport.tsx](file:///e:/LA_DUCK/la-duck/src/components/import/DataImport.tsx) + [DataPreview.tsx](file:///e:/LA_DUCK/la-duck/src/components/import/DataPreview.tsx) + [FileQueue.tsx](file:///e:/LA_DUCK/la-duck/src/components/import/FileQueue.tsx)，分析拖拽→预览→建表→完成 4 步的 UX
  - [ ] SubTask 3.2: 分析大文件（>100MB）导入无进度条问题（参考 [fast_import_csv_duckdb](file:///e:/LA_DUCK/la-duck/src-tauri/src/commands/file.rs) 同步阻塞调用）
  - [ ] SubTask 3.3: 分析"导入成功 0 行"误导问题（I-01 from engine-arch-assessment）在前端的表现
  - [ ] SubTask 3.4: 分析导入失败后无"一键重试"按钮问题（用户必须重新拖文件）
  - [ ] SubTask 3.5: 分析多文件队列的并发导入与错误隔离问题
  - **产出**: 该阶段缺陷清单（预期是缺陷最多的阶段）

## 阶段四：SQL 查询与编辑

- [ ] Task 4: 调查 SQL 查询编辑的体验缺陷
  - [ ] SubTask 4.1: 读取 [SqlQueryPage.tsx](file:///e:/LA_DUCK/la-duck/src/components/sql/SqlQueryPage.tsx) + [SQLEditor.tsx](file:///e:/LA_DUCK/la-duck/src/components/sql/SQLEditor.tsx) + [ExecutionBar.tsx](file:///e:/LA_DUCK/la-duck/src/components/sql/ExecutionBar.tsx)，分析编辑→执行→结果 UX
  - [ ] SubTask 4.2: 分析查询永不自动恢复问题（I-02: classify_panic 判 B 类→不重建→死循环）对用户的影响
  - [ ] SubTask 4.3: 分析多语句执行（; 分割）的错误中断与部分成功处理
  - [ ] SubTask 4.4: 分析 SQL 补全（[sqlCompletionProvider.ts](file:///e:/LA_DUCK/la-duck/src/utils/sqlCompletionProvider.ts)）的覆盖率与准确性
  - [ ] SubTask 4.5: 分析参数化查询（[ParameterPanel.tsx](file:///e:/LA_DUCK/la-duck/src/components/sql/ParameterPanel.tsx)）的用户可发现性
  - **产出**: 该阶段缺陷清单

## 阶段五：结果查看与导出

- [ ] Task 5: 调查询结果查看与导出的体验缺陷
  - [ ] SubTask 5.1: 读取 [QueryResult.tsx](file:///e:/LA_DUCK/la-duck/src/components/sql/QueryResult.tsx) + [QueryResultItem.tsx](file:///e:/LA_DUCK/la-duck/src/components/sql/QueryResultItem.tsx)，分析大结果集（10万行+）渲染性能
  - [ ] SubTask 5.2: 分析结果导出 CSV/JSON 的完整性（是否有行数限制/编码问题）
  - [ ] SubTask 5.3: 分析结果复制（行/列/单元格）的交互便捷性
  - [ ] SubTask 5.4: 分析 DuckDB 列类型 toString 丢失问题（TD-P2-15）对结果展示的影响（日期被当字符串、数字精度丢失）
  - **产出**: 该阶段缺陷清单

## 阶段六：图表创建与保存

- [ ] Task 6: 调查图表创建的体验缺陷
  - [ ] SubTask 6.1: 读取 [ChartConfigPanel.tsx](file:///e:/LA_DUCK/la-duck/src/components/chart/ChartConfigPanel.tsx) + [ChartTypeSelector.tsx](file:///e:/LA_DUCK/la-duck/src/components/chart/ChartTypeSelector.tsx) + [SaveChartModal.tsx](file:///e:/LA_DUCK/la-duck/src/components/chart/SaveChartModal.tsx)，分析从查询结果→配图→保存的 UX
  - [ ] SubTask 6.2: 分析图表类型选择与数据类型的匹配提示（用户选了饼图但数据是时间序列→是否提示不合适？）
  - [ ] SubTask 6.3: 分析图表保存后的"去哪了"问题（保存到图表库但用户不知道如何找到它）
  - [ ] SubTask 6.4: 分析图表预览（[ChartPreview.tsx](file:///e:/LA_DUCK/la-duck/src/components/chart/ChartPreview.tsx)）与实际仪表盘渲染的一致性
  - **产出**: 该阶段缺陷清单

## 阶段七：仪表盘搭建与管理

- [ ] Task 7: 调查仪表盘的体验缺陷
  - [ ] SubTask 7.1: 读取 [DashboardPage.tsx](file:///e:/LA_DUCK/la-duck/src/components/dashboard/DashboardPage.tsx) + [DashboardCanvas.tsx](file:///e:/LA_DUCK/la-duck/src/components/dashboard/DashboardCanvas.tsx) + [AddChartModal.tsx](file:///e:/LA_DUCK/la-duck/src/components/dashboard/AddChartModal.tsx)，分析新建→加图→布局→保存 UX
  - [ ] SubTask 7.2: **重点调查**"从图表库添加图表进入某个选定的仪表盘会失败"问题（用户之前报告过），定位根因
  - [ ] SubTask 7.3: 分析布局保存（[gridLayout.ts](file:///e:/LA_DUCK/la-duck/src/utils/gridLayout.ts)）的拖拽→保存→刷新一致性
  - [ ] SubTask 7.4: 分析仪表盘筛选器（[DashboardFilterBar.tsx](file:///e:/LA_DUCK/la-duck/src/components/dashboard/filters/DashboardFilterBar.tsx)）的配置复杂度
  - [ ] SubTask 7.5: 分析全屏模式与退出全屏的交互流畅性
  - **产出**: 该阶段缺陷清单

## 阶段八：自动化任务配置

- [ ] Task 8: 调查自动化任务的体验缺陷
  - [ ] SubTask 8.1: 读取 [TaskCenterPage.tsx](file:///e:/LA_DUCK/la-duck/src/components/automation/TaskCenterPage.tsx) + [TaskEditorModal.tsx](file:///e:/LA_DUCK/la-duck/src/components/automation/TaskEditorModal.tsx) + [TaskRunLogsPanel.tsx](file:///e:/LA_DUCK/la-duck/src/components/automation/TaskRunLogsPanel.tsx)，分析新建→调度→查看日志 UX
  - [ ] SubTask 8.2: 分析任务调度表达式（cron）的配置门槛（普通用户不懂 cron 语法）
  - [ ] SubTask 8.3: 分析任务运行失败后的通知机制（是否有 toast / 是否有重试）
  - [ ] SubTask 8.4: 分析任务依赖（[task_service.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/services/task_service.rs) __task_dependencies）的用户可见性
  - **产出**: 该阶段缺陷清单

## 阶段九：设置与偏好

- [ ] Task 9: 调查设置的体验缺陷
  - [ ] SubTask 9.1: 读取 [SettingsModal.tsx](file:///e:/LA_DUCK/la-duck/src/components/common/SettingsModal.tsx)，分析设置项的分类与可发现性
  - [ ] SubTask 9.2: 分析设置修改后"需要重启应用"的场景有多少（用户不知改了什么要重启）
  - [ ] SubTask 9.3: 分析快捷键（[shortcutManager.ts](file:///e:/LA_DUCK/la-duck/src/utils/shortcutManager.ts)）的自定义与冲突检测
  - [ ] SubTask 9.4: 分析导入参数（skipEmptyRows/firstRowAsHeader/encoding）的默认值合理性
  - **产出**: 该阶段缺陷清单

## 阶段十：错误恢复与异常处理

- [ ] Task 10: 调查错误恢复的体验缺陷
  - [ ] SubTask 10.1: 分析 DuckDB 永久损坏后必须重启应用问题（I-03 / UX-08 F 级）
  - [ ] SubTask 10.2: 分析查询超时后的状态恢复（[import_data_v2 超时](file:///e:/LA_DUCK/la-duck/src-tauri/src/commands/file.rs)）
  - [ ] SubTask 10.3: 分析 [ErrorBoundary.tsx](file:///e:/LA_DUCK/la-duck/src/components/common/ErrorBoundary.tsx) 的覆盖范围与用户可见的错误信息质量
  - [ ] SubTask 10.4: 分析 [StatusBar.tsx](file:///e:/LA_DUCK/la-duck/src/components/common/StatusBar.tsx) 引擎状态反馈的准确性（B 类 panic 不累计 rebuild_count → StatusBar 显示"正常"但实际查询一直失败）
  - [ ] SubTask 10.5: 分析 toast 通知（[Toast.tsx](file:///e:/LA_DUCK/la-duck/src/components/common/Toast.tsx)）的信息可读性（Rust 内部错误直接暴露给用户）
  - **产出**: 该阶段缺陷清单

---

## 横向调查：跨功能数据流断链

- [ ] Task 11: 调查跨功能切换的上下文丢失
  - [ ] SubTask 11.1: 导入→查询：导入完成后 DatabaseExplorer 是否自动刷新？
  - [ ] SubTask 11.2: 查询→图表：查询结果页是否有"保存为图表"直接入口？
  - [ ] SubTask 11.3: 图表→仪表盘：从图表库添加图表到仪表盘是否失败？（已知 bug）
  - [ ] SubTask 11.4: 仪表盘→自动化：仪表盘刷新任务是否能从仪表盘页直接创建？
  - [ ] SubTask 11.5: 项目切换→所有功能：切换项目后各功能页状态是否正确重置？
  - **产出**: 跨功能断链清单

## 横向调查：3 类用户画像痛点

- [ ] Task 12: 3 类用户画像 × 各自 Top-3 痛点
  - [ ] SubTask 12.1: 数据分析师视角：查询性能 / 结果导出 / SQL 补全 的 Top-3 痛点
  - [ ] SubTask 12.2: 业务运营视角：仪表盘交互 / 任务调度 / 图表配置 的 Top-3 痛点
  - [ ] SubTask 12.3: 开发者视角：错误诊断 / 项目切换 / 日志可观测性 的 Top-3 痛点
  - **产出**: 用户画像 × 痛点矩阵

---

## 汇总任务

- [ ] Task 13: 汇总所有缺陷为优先级排序总表
  - [ ] SubTask 13.1: 合并 10 阶段 + 横向调查的所有缺陷为统一清单
  - [ ] SubTask 13.2: 按 UX-P0~UX-P3 分级排序
  - [ ] SubTask 13.3: 标注每条缺陷与 [engine-arch-assessment-v25.3](file:///e:/LA_DUCK/la-duck/.trae/specs/engine-arch-assessment-v25.3/spec.md) 技术债的关联关系
  - [ ] SubTask 13.4: 产出 v25.4 修复建议清单（从 UX 角度，与引擎侧 v25.4 任务对齐）
  - **产出**: 最终调查报告完整文档

---

# Task Dependencies
- Task 1~10 可并行执行（各阶段独立调查）
- Task 11 依赖 Task 3+4+6+7+8（需先完成相关阶段调查才能分析跨功能断链）
- Task 12 依赖 Task 1~10（需全阶段调查完成才能做用户画像归纳）
- Task 13 依赖 Task 1~12 全部完成

# 用户操作全流程缺陷调查报告 Spec

## Why
QuickerSQL 当前综合技术分 75.65 / SUS 71.2，但已有评估仅覆盖"数仓引擎"维度（[engine-arch-assessment-v25.3](file:///e:/LA_DUCK/la-duck/.trae/specs/engine-arch-assessment-v25.3/spec.md)）。用户解决问题与体验视角的全流程缺陷尚无系统化调查。本 spec 是一份**调查研究分支报告**（不实施代码），覆盖从"双击图标→日常使用→异常恢复"完整用户旅程的 10 个阶段，识别可复现的体验缺陷，为 v25.4 / v26.0 路线图补充用户侧输入。

## What Changes
- **新增** 调查报告文档：基于真实代码 + 已有日志 + 启动报错，枚举用户操作全流程 10 阶段的体验缺陷
- **新增** 每个缺陷的「严重度 / 触发条件 / 用户感知 / 根因文件 / 修复方向」5 维评估
- **新增** 跨功能切换的"断链"清单（如：导入→查询→图表→仪表盘的数据流断点）
- **新增** 用户角色画像 3 类（数据分析师 / 业务运营 / 开发者）×各自最痛的 Top-3 缺陷
- **不修改** 任何代码（纯调查报告）
- **不修改** 已有 [engine-arch-assessment-v25.3](file:///e:/LA_DUCK/la-duck/.trae/specs/engine-arch-assessment-v25.3/spec.md) 的 spec/tasks/checklist

## Impact
- **Affected specs**: [engine-arch-assessment-v25.3](file:///e:/LA_DUCK/la-duck/.trae/specs/engine-arch-assessment-v25.3/spec.md)（本报告是其 UX 章节的横向扩展，覆盖非引擎领域）
- **Affected code**: 调查覆盖但不修改以下文件——
  - [App.tsx](file:///e:/LA_DUCK/la-duck/src/App.tsx)（路由/首屏/密码保护）
  - [Welcome.tsx](file:///e:/LA_DUCK/la-duck/src/pages/Welcome.tsx)（首次启动引导）
  - [DataImport.tsx](file:///e:/LA_DUCK/la-duck/src/components/import/DataImport.tsx)（导入流程）
  - [SqlQueryPage.tsx](file:///e:/LA_DUCK/la-duck/src/components/sql/SqlQueryPage.tsx)（查询流程）
  - [DashboardPage.tsx](file:///e:/LA_DUCK/la-duck/src/components/dashboard/DashboardPage.tsx)（仪表盘）
  - [TaskCenterPage.tsx](file:///e:/LA_DUCK/la-duck/src/components/automation/TaskCenterPage.tsx)（自动化）
  - [ProjectManager.tsx](file:///e:/LA_DUCK/la-duck/src/components/project/ProjectManager.tsx)（项目）
  - [SettingsModal.tsx](file:///e:/LA_DUCK/la-duck/src/components/common/SettingsModal.tsx)（设置）
  - [StatusBar.tsx](file:///e:/LA_DUCK/la-duck/src/components/common/StatusBar.tsx)（状态反馈）

---

## ADDED Requirements

### Requirement: 用户操作全流程 10 阶段缺陷调查
调查报告 SHALL 覆盖以下 10 个用户操作阶段，每阶段产出缺陷清单：

#### 阶段清单
1. **冷启动与首屏**（双击图标→看到主界面）
2. **项目创建与切换**（新建项目 / 切换 / 导入 / 导出）
3. **数据导入**（拖拽文件→预览→建表→完成）
4. **SQL 查询与编辑**（写 SQL→执行→看结果）
5. **结果查看与导出**（分页 / 复制 / 导出 CSV）
6. **图表创建与保存**（从查询结果→配图→保存）
7. **仪表盘搭建与管理**（新建画布→加图表→布局→保存）
8. **自动化任务配置**（新建任务→调度→查看运行日志）
9. **设置与偏好**（主题/快捷键/导入参数/缓存）
10. **错误恢复与异常处理**（引擎崩溃 / 导入失败 / 查询超时后的恢复路径）

#### Scenario: 每个缺陷条目可被独立验证
- **WHEN** 审阅者阅读某条缺陷
- **THEN** 该条目包含：①严重度(P0~P3) ②触发条件 ③用户感知 ④根因文件 ⑤修复方向
- **AND** 至少 70% 条目的根因文件有具体行号或函数名引用

### Requirement: 跨功能数据流断链清单
调查报告 SHALL 识别"功能间数据流断链"——即用户从一个功能跳到另一个功能时数据/上下文丢失的场景。

#### Scenario: 导入→查询的数据流
- **WHEN** 用户导入一张表后想立即查询
- **THEN** 报告应说明：导入完成 toast 消失后，左侧 DatabaseExplorer 是否自动刷新？用户是否需要手动点刷新才能看到新表？

#### Scenario: 查询→图表的数据流
- **WHEN** 用户在 SQL 查询结果上想直接创建图表
- **THEN** 报告应说明：查询结果页是否有"保存为图表"入口？还是必须先保存查询再进仪表盘？

#### Scenario: 图表→仪表盘的数据流
- **WHEN** 用户从图表库添加图表到仪表盘
- **THEN** 报告应说明：该路径是否有已知 bug（参考之前对话中"仪表盘界面从图表库添加图表进入某个选定的仪表盘会失败"）

### Requirement: 3 类用户画像 × 各自 Top-3 痛点
调查报告 SHALL 针对以下 3 类用户角色，各列出最痛的 3 个缺陷：

| 角色 | 典型场景 | 关注点 |
|------|---------|--------|
| **数据分析师** | 每天写 50+ 条 SQL，导入 100MB+ CSV | 查询性能、结果导出、SQL 补全 |
| **业务运营** | 每周搭建仪表盘，配置自动化报表 | 仪表盘交互、任务调度、图表配置 |
| **开发者/DBA** | 排查引擎错误、管理多项目 | 错误诊断、项目切换、日志可观测性 |

---

## MODIFIED Requirements

### Requirement: 调查方法论
报告 SHALL 采用"代码静态分析 + 启动日志分析 + 已知问题回溯"三结合方法：

1. **代码静态分析**：Read 关键组件源码，识别 UX 反模式（如：无 loading 态、无错误边界、confirm() 原生弹窗、无进度条）
2. **启动日志分析**：基于 [npm run tauri dev 启动日志](file:///e:/LA_DUCK/la-duck/src-tauri/src/lib.rs) 中的 WARN/ERROR 推断用户可见的异常
3. **已知问题回溯**：汇总本对话历史中已确认的 bug（I-01~I-08 from engine-arch-assessment）+ 之前对话中提到的"仪表盘添加图表失败"等

### Requirement: 缺陷优先级评估
每条缺陷 SHALL 标注严重度，标准如下：

| 等级 | 定义 | 用户影响 |
|------|------|---------|
| **UX-P0** | 阻塞核心路径，用户无法完成任务 | 数据丢失 / 功能完全不可用 |
| **UX-P1** | 核心路径可用但严重困惑 | 误导性信息 / 需重启才能恢复 |
| **UX-P2** | 非核心路径缺陷或体验不佳 | 额外操作步骤 / 视觉噪音 |
| **UX-P3** | 微优化项 | 打磨级别 |

---

## REMOVED Requirements

### Requirement: 代码实施
**Reason**: 本 spec 明确是"调查研究分支报告"，不实施任何代码修改
**Migration**: 识别出的缺陷将被整理为后续独立 spec 的输入（如 `ux-fix-v25.4` 等）

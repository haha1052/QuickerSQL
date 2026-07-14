# 设置系统 Phase 8: 功能扩展与响应式完善 - 实施计划

## [x] Task 1: 语言与区域设置接入（5 项）
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 接入 `locale.dateFormat` - 日期格式
  - 接入 `locale.timeFormat` - 时间格式
  - 接入 `locale.numberFormat` - 数字格式
  - 接入 `locale.firstDayOfWeek` - 每周第一天
  - 接入 `locale.timezone` - 时区
  - 在 LocaleContext 中新增格式化工具函数：formatDate、formatTime、formatNumber
  - 创建 LocaleSettingsSync 组件，监听设置变化并更新上下文
  - 后端标记为已实现
- **Acceptance Criteria Addressed**: AC-2, AC-4, AC-5
- **Test Requirements**:
  - `programmatic` TR-1.1: implemented_settings() 包含 5 项 locale 设置
  - `programmatic` TR-1.2: LocaleContext 提供 formatDate/formatTime/formatNumber 函数
  - `programmatic` TR-1.3: npx tsc 和 cargo check 均通过
  - `human-judgement` TR-1.4: 日期/数字显示格式与设置一致
- **Notes**: 低难度，快速见效，先做这个积累动量

## [x] Task 2: 可视化设置接入（4 项）
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 接入 `visualization.showGrid` - 显示网格线
  - 接入 `visualization.showLegend` - 显示图例
  - 接入 `visualization.animation` - 启用动画效果
  - 接入 `visualization.defaultColorScheme` - 默认配色方案
  - 在 ChartRenderer 和 echartsNormalize 中应用设置
  - 创建设置同步组件或直接在渲染时读取设置
  - 支持动态更新：设置变更后已渲染的图表实时更新
  - 后端标记为已实现
- **Acceptance Criteria Addressed**: AC-1, AC-4, AC-5
- **Test Requirements**:
  - `programmatic` TR-2.1: implemented_settings() 包含 4 项 visualization 设置
  - `programmatic` TR-2.2: ChartRenderer 从 useSetting 读取可视化设置
  - `programmatic` TR-2.3: npx tsc 和 cargo check 均通过
  - `human-judgement` TR-2.4: 网格/图例/动画/配色可通过设置控制
- **Notes**: 中难度，ECharts setOption 支持动态更新

## [x] Task 3: 回收站设置接入（3 项）
- **Priority**: medium
- **Depends On**: None
- **Description**:
  - 接入 `trash.autoCleanup` - 自动清理开关
  - 接入 `trash.cleanupDays` - 清理天数阈值
  - 接入 `trash.maxTrashSize` - 最大回收站大小
  - 在 TrashService 中新增 auto_cleanup 函数
  - 应用启动时执行自动清理（如启用）
  - 删除表时检查回收站大小，超过阈值警告
  - 后端标记为已实现
- **Acceptance Criteria Addressed**: AC-3, AC-4, AC-5
- **Test Requirements**:
  - `programmatic` TR-3.1: implemented_settings() 包含 3 项 trash 设置
  - `programmatic` TR-3.2: TrashService 有 auto_cleanup 函数
  - `programmatic` TR-3.3: cargo check 通过
  - `human-judgement` TR-3.4: 启用自动清理后，过期项目被清理
  - `human-judgement` TR-3.5: 回收站大小超过阈值时有提示
- **Notes**: 中难度，主要在后端实现

## [x] Task 4: 响应式机制完善 + 测试验证
- **Priority**: high
- **Depends On**: Task 1, 2, 3
- **Description**:
  - 审计所有新增设置，确保变更后实时生效
  - 确保所有组件通过 useSetting hook 读取设置
  - 运行所有安全和规范检测命令
  - 更新设置系统现状分析报告到 v6.0
  - 启动应用验证所有新增设置项正常显示和工作
  - 验证原有 38 项设置不受影响
- **Acceptance Criteria Addressed**: AC-4, AC-5, AC-6
- **Test Requirements**:
  - `programmatic` TR-4.1: cargo check --quiet 通过
  - `programmatic` TR-4.2: npx tsc --noEmit 通过
  - `programmatic` TR-4.3: SQL 注入检测 0 新增
  - `programmatic` TR-4.4: TS any 检测 0 新增
  - `programmatic` TR-4.5: 总已实现设置项 ≥ 50
  - `human-judgement` TR-4.6: 所有新增设置项功能正常
  - `human-judgement` TR-4.7: 原有设置功能不受影响
- **Notes**: 最终验证和文档更新

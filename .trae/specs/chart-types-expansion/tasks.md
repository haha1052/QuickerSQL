# 图表类型扩展 - 实施计划（任务分解与优先级）

## [x] Task 1: 扩展前后端图表类型枚举与类型定义
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 后端 `src-tauri/src/services/chart_service.rs` 的 `ChartType` 枚举新增 6 种类型
  - 前端 `src/types/chart.ts` 的 `ChartType` 类型同步扩展
  - `src/components/chart/ChartTypeSelector.tsx` 的类型定义同步
  - `src/components/dashboard/ChartEditSidebar.tsx` 的类型定义同步
  - `src/types/dashboard.ts` 的 `ChartType` 类型同步扩展
- **Acceptance Criteria Addressed**: AC-7
- **Test Requirements**:
  - `programmatic` TR-1.1: TypeScript 编译通过，无类型错误
  - `programmatic` TR-1.2: Rust 编译通过（cargo check）
  - `programmatic` TR-1.3: 所有已有图表类型的测试仍然通过
- **Notes**: 这是基础工作，必须最先完成

## [x] Task 2: 后端新增条形图配置生成逻辑
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - 在 `chart_service.rs` 中新增条形图（横向柱状图）的 ECharts 配置生成
  - 翻转 X/Y 轴配置，类别在 Y 轴，数值在 X 轴
  - 支持多系列并列条形图、堆叠条形图
  - 新增推荐逻辑：类别标签较长时推荐条形图
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-2.1: 条形图配置生成的单元测试通过
  - `human-judgement` TR-2.2: 生成的配置在 ECharts 中渲染正确
- **Notes**: 条形图实现最简单，可以作为第一个实现的新图表

## [x] Task 3: 后端新增环形图配置生成逻辑
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - 在 `chart_service.rs` 中新增环形图（甜甜圈图）的 ECharts 配置生成
  - 使用 pie 图的 radius 配置实现环形效果
  - 支持中心显示总计数值
  - 推荐逻辑：占比分析场景与饼图并列推荐
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `programmatic` TR-3.1: 环形图配置生成的单元测试通过
  - `human-judgement` TR-3.2: 生成的配置在 ECharts 中渲染正确
- **Notes**: 基于饼图改造，实现简单

## [x] Task 4: 后端新增双轴图配置生成逻辑
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - 在 `chart_service.rs` 中新增双轴图的 ECharts 配置生成
  - 自动分配：第一个数值列用左轴柱状图，第二个数值列用右轴折线图
  - 左右 Y 轴独立刻度
  - 推荐逻辑：存在两个数值列且量级差异大时推荐
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `programmatic` TR-4.1: 双轴图配置生成的单元测试通过
  - `human-judgement` TR-4.2: 生成的配置在 ECharts 中渲染正确
- **Notes**: 双轴图是高频需求，优先实现

## [x] Task 5: 后端新增雷达图配置生成逻辑
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - 在 `chart_service.rs` 中新增雷达图的 ECharts 配置生成
  - 第一列作为指标名称，后续列作为系列数值
  - 支持多个数据系列对比
  - 推荐逻辑：维度数量在 3-8 个且都是数值时推荐
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `programmatic` TR-5.1: 雷达图配置生成的单元测试通过
  - `human-judgement` TR-5.2: 生成的配置在 ECharts 中渲染正确
- **Notes**: 雷达图数据格式与基础图表不同，需要特殊处理

## [x] Task 6: 后端新增漏斗图配置生成逻辑
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - 在 `chart_service.rs` 中新增漏斗图的 ECharts 配置生成
  - 第一列作为阶段名称，第二列作为数值
  - 支持显示转化率标签
  - 推荐逻辑：有序类别 + 数值递减趋势时推荐
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `programmatic` TR-6.1: 漏斗图配置生成的单元测试通过
  - `human-judgement` TR-6.2: 生成的配置在 ECharts 中渲染正确
- **Notes**: 漏斗图是转化分析的核心图表

## [x] Task 7: 后端新增仪表盘配置生成逻辑
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - 在 `chart_service.rs` 中新增仪表盘（Gauge）的 ECharts 配置生成
  - 自动计算百分比或直接使用数值
  - 默认三色阈值区间（绿/黄/红）
  - 推荐逻辑：单个数值列且值在 0-100 范围时推荐
- **Acceptance Criteria Addressed**: AC-6
- **Test Requirements**:
  - `programmatic` TR-7.1: 仪表盘配置生成的单元测试通过
  - `human-judgement` TR-7.2: 生成的配置在 ECharts 中渲染正确
- **Notes**: KPI 展示场景高频使用

## [x] Task 8: 前端图表选择器 UI 更新
- **Priority**: high
- **Depends On**: Task 2-7
- **Description**:
  - 更新 `ChartTypeSelector.tsx`：新增 6 种图表类型的选项卡
  - 更新 `ChartEditSidebar.tsx`：图表类型选择网格更新
  - 为每种新图表选择合适的 emoji 图标
  - 确保布局美观，12 种图表不拥挤
- **Acceptance Criteria Addressed**: AC-8
- **Test Requirements**:
  - `human-judgement` TR-8.1: SQL 查询页图表选择器显示完整 12 种
  - `human-judgement` TR-8.2: 仪表盘编辑侧边栏图表选择显示完整 12 种
  - `programmatic` TR-8.3: TypeScript 编译通过
- **Notes**: 两个 UI 入口都要更新

## [x] Task 9: 集成测试与回归验证
- **Priority**: high
- **Depends On**: Task 8
- **Description**:
  - 验证所有 12 种图表类型都能正常生成配置并渲染
  - 验证旧图表（原 6 种）不受影响
  - 验证推荐图表逻辑合理
  - 验证保存/加载/编辑流程对新图表正常工作
- **Acceptance Criteria Addressed**: AC-1 ~ AC-8
- **Test Requirements**:
  - `programmatic` TR-9.1: 所有 Rust 单元测试通过（262 个，新增 8 个）
  - `programmatic` TR-9.2: TypeScript 编译通过（0 errors）
  - `human-judgement` TR-9.3: 手动验证每种图表至少能渲染一个示例
- **Notes**: 最终验收环节

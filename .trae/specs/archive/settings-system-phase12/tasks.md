# Phase 12 设置功能接入深化 — The Implementation Plan

## [x] Task 1: 可视化设置完善（3 项）
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 在 settings_service.rs 的 implemented_settings() 中新增 3 项可视化设置：animationDuration、toolboxFeature、dataZoom
  - 在 ChartRenderer.tsx 中读取这 3 项设置并应用到 ECharts 配置
  - animationDuration：控制动画时长（默认 1000ms，范围 100-5000ms）
  - toolboxFeature：控制工具箱显示/隐藏
  - dataZoom：控制数据区域缩放条显示/隐藏
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-3, AC-7, AC-8
- **Test Requirements**:
  - `programmatic` TR-1.1: implemented_settings 中包含 visualization.animationDuration、visualization.toolboxFeature、visualization.dataZoom
  - `programmatic` TR-1.2: cargo check 无错误
  - `programmatic` TR-1.3: npx tsc 无错误
  - `human-judgement` TR-1.4: 打开设置界面，可视化分类下 3 项设置正确显示
  - `human-judgement` TR-1.5: 修改 animationDuration 后，图表动画时长改变
  - `human-judgement` TR-1.6: 切换 toolboxFeature 后，图表工具箱显示/隐藏
  - `human-judgement` TR-1.7: 切换 dataZoom 后，图表底部缩放条显示/隐藏
- **Notes**: toolbox 和 dataZoom 需要在 ECharts option 中正确配置

## [x] Task 2: 外观设置完善（2 项）
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 在 settings_service.rs 的 implemented_settings() 中新增 2 项外观设置：minimap、smoothScrolling
  - 在 SQLEditor.tsx 中读取这 2 项设置并应用到 Monaco Editor 配置
  - minimap：控制编辑器右侧小地图显示/隐藏
  - smoothScrolling：控制编辑器平滑滚动
- **Acceptance Criteria Addressed**: AC-4, AC-5, AC-7, AC-8
- **Test Requirements**:
  - `programmatic` TR-2.1: implemented_settings 中包含 appearance.minimap、appearance.smoothScrolling
  - `programmatic` TR-2.2: cargo check 无错误
  - `programmatic` TR-2.3: npx tsc 无错误
  - `human-judgement` TR-2.4: 打开设置界面，外观分类下 2 项设置正确显示
  - `human-judgement` TR-2.5: 切换 minimap 后，编辑器小地图显示/隐藏立即改变
  - `human-judgement` TR-2.6: 切换 smoothScrolling 后，编辑器滚动行为改变
- **Notes**: 注意区分 appearance.minimap 和 editor.showMinimap（两个不同的设置项）

## [x] Task 3: 数据库设置完善（1 项）
- **Priority**: medium
- **Depends On**: None
- **Description**:
  - 在 settings_service.rs 的 implemented_settings() 中新增 enableExplainPlan 设置
  - 设置项先接入，实际的执行计划功能留待后续迭代
  - 确保设置能正确保存和读取
- **Acceptance Criteria Addressed**: AC-6, AC-7, AC-8
- **Test Requirements**:
  - `programmatic` TR-3.1: implemented_settings 中包含 database.enableExplainPlan
  - `programmatic` TR-3.2: cargo check 无错误
  - `programmatic` TR-3.3: npx tsc 无错误
  - `programmatic` TR-3.4: 设置项能正确保存和读取（通过命令验证数据库值）
  - `human-judgement` TR-3.5: 打开设置界面，数据库分类下 enableExplainPlan 设置正确显示
- **Notes**: 本阶段只接入设置项定义，不实现实际执行计划功能

## [x] Task 4: 测试验证与文档更新
- **Priority**: medium
- **Depends On**: Task 1, Task 2, Task 3
- **Description**:
  - 启动应用验证所有新增设置项的显示和效果
  - 执行所有验证命令（cargo check、npx tsc、安全检测等）
  - 更新设置系统现状分析报告.md 到 v11.0
  - 添加 Phase 12 完成总结
  - 制定 Phase 13 规划
- **Acceptance Criteria Addressed**: AC-7, AC-8
- **Test Requirements**:
  - `programmatic` TR-4.1: 总 implemented_settings 数量 = 80 项
  - `programmatic` TR-4.2: cargo check --quiet 无错误
  - `programmatic` TR-4.3: npx tsc --noEmit --pretty 0 errors
  - `programmatic` TR-4.4: SQL 注入检测 0 处
  - `programmatic` TR-4.5: 敏感字符串检测 0 处
  - `human-judgement` TR-4.6: 设置系统现状分析报告已更新到 v11.0
  - `human-judgement` TR-4.7: Phase 12 完成总结已添加
  - `human-judgement` TR-4.8: Phase 13 规划已制定
- **Notes**: 所有验证必须通过才算完成

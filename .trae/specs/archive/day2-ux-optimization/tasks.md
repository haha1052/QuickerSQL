# Day 2 - 用户体验优化 - The Implementation Plan

## [x] Task 1: 修复欢迎页引导跳转 bug
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 修复 `AppWrapper.tsx` 中 Welcome 组件的 `onGoToGuide` prop 错误绑定问题
  - 添加 `handleGoToGuide` 函数，设置 state 为 'guide'
  - 引导页完成后应正确返回工作区
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-1.1: 点击欢迎页"观看教程"按钮后，state 变为 'guide'
  - `programmatic` TR-1.2: 点击引导页"开始使用"按钮后，state 变为 'workspace'
  - `human-judgement` TR-1.3: 引导页四步流程能正常切换，样式与主题一致
- **Notes**: 这是 P0 bug，必须首先修复

## [x] Task 2: 添加全局错误边界（Error Boundary）
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 创建 `ErrorBoundary.tsx` 组件，使用 class component 实现
  - 捕获子组件渲染错误，显示友好的错误页面
  - 错误页面包含：错误图标、错误摘要、重试按钮、返回首页按钮
  - 在 `AppWrapper.tsx` 中包裹主要内容区域
- **Acceptance Criteria Addressed**: AC-2, AC-6
- **Test Requirements**:
  - `programmatic` TR-2.1: ErrorBoundary 组件能正确捕获子组件 throw 的错误
  - `human-judgement` TR-2.2: 错误页面样式美观，与主题色一致
  - `human-judgement` TR-2.3: 错误页面的重试按钮和返回按钮能正常工作
- **Notes**: 参考 React 官方 Error Boundary 最佳实践

## [x] Task 3: 设置中添加引导入口
- **Priority**: medium
- **Depends On**: Task 1
- **Description**: 
  - 在设置页面添加"查看欢迎页"和"查看引导教程"按钮
  - 点击后跳转到对应页面，看完后能返回工作区
  - 不修改 `has_launched` 状态，只是临时查看
  - 需要扩展 `AppPageState` 和 AppContext 的导航能力
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `programmatic` TR-3.1: 设置中能找到两个引导相关的按钮
  - `programmatic` TR-3.2: 查看完引导页后能正常返回工作区
  - `human-judgement` TR-3.3: 按钮位置合理，文案清晰
- **Notes**: 可以放在设置的"关于"或"通用"分类下

## [x] Task 4: 优化错误提示文案
- **Priority**: medium
- **Depends On**: None
- **Description**: 
  - 梳理常见错误场景，优化错误提示文案
  - 错误提示应包含：发生了什么 + 为什么会这样 + 用户可以做什么
  - 重点优化：SQL 执行错误、数据导入错误、连接错误
  - 保持错误代码/技术细节在 console 中，UI 只显示友好提示
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `human-judgement` TR-4.1: 至少优化 5 种常见错误的提示文案
  - `human-judgement` TR-4.2: 错误提示友好、具体、有指导意义
  - `programmatic` TR-4.3: 不影响现有错误处理逻辑
- **Notes**: 不要把技术细节暴露给普通用户

## [x] Task 5: 添加空状态页面
- **Priority**: medium
- **Depends On**: None
- **Description**: 
  - SQL 编辑器空状态：无查询结果时的提示
  - 仪表盘空状态：没有仪表盘时的引导
  - 数据导入空状态：没有导入任务时的引导
  - 空状态包含：图标、说明文字、操作按钮
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `human-judgement` TR-5.1: 至少 3 个核心页面有空状态
  - `human-judgement` TR-5.2: 空状态样式美观，引导清晰
  - `programmatic` TR-5.3: 有数据时正常显示，不显示空状态
- **Notes**: 空状态是提升产品完成度的重要细节

## [x] Task 6: 编译验证和回归测试
- **Priority**: high
- **Depends On**: Task 1, 2, 3, 4, 5
- **Description**: 
  - 运行 `npx tsc --noEmit --pretty` 确保 0 errors
  - 运行前端单元测试确保全部通过
  - 手动验证主要功能流程
  - 验证欢迎页、引导页、错误边界、空状态都正常工作
- **Acceptance Criteria Addressed**: AC-6
- **Test Requirements**:
  - `programmatic` TR-6.1: TypeScript 编译 0 errors
  - `programmatic` TR-6.2: 所有现有单元测试通过
  - `human-judgement` TR-6.3: 核心功能（SQL执行、数据导入、仪表盘）正常工作
- **Notes**: 这是发布前的最后检查

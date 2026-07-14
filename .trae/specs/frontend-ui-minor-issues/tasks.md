# QuickerSQL 前端交互细节问题修复 - 任务分解

## [x] Task 1: 修复项目名称响应式更新
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 检查 AppWrapper.tsx 中 currentProject 状态的更新逻辑
  - 确保 Header 组件正确接收更新后的项目名称
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `human-judgement` TR-1.1: 切换项目时，Header 中的项目名称立即更新
- **Files Modified**:
  - `src/store/projectStore.ts`

## [x] Task 2: 修改CSV导入按钮文字为数据导入
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 修改 LocaleContext.tsx 中的翻译值
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `human-judgement` TR-2.1: 顶级tab栏显示"数据导入"按钮
- **Files Modified**:
  - `src/context/LocaleContext.tsx`

## [x] Task 3: 查询历史按钮优化
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 缩小查询历史中执行按钮和删除按钮的尺寸为原来的 1/2
  - 实现执行按钮功能：新建查询标签页并执行SQL
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `human-judgement` TR-3.1: 按钮尺寸缩小
  - `human-judgement` TR-3.2: 执行按钮点击后新建标签页并执行SQL
- **Files Modified**:
  - `src/components/query-history/index.tsx`
  - `src/components/query-history/QueryHistory.css`
  - `src/components/common/Sidebar.tsx`

## [x] Task 4: 回收站按钮优化
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 缩小回收站中恢复按钮和删除按钮的尺寸为原来的 1/2
  - 将 alert() 替换为统一的 toast 消息系统
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `human-judgement` TR-4.1: 按钮尺寸缩小
  - `human-judgement` TR-4.2: 操作结果通过 toast 显示
- **Files Modified**:
  - `src/components/trash/index.tsx`
  - `src/components/trash/TrashPanel.css`

## [x] Task 5: 仪表盘工具栏优化
- **Priority**: medium
- **Depends On**: None
- **Description**: 
  - 移除仪表盘页面的新建/打开/布局按钮
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `human-judgement` TR-5.1: 仪表盘工具栏简化，不显示新建/打开/布局按钮
- **Files Modified**:
  - `src/components/dashboard/DashboardToolbar.tsx`

## [x] Task 6: 自动化任务布局优化
- **Priority**: medium
- **Depends On**: None
- **Description**: 
  - 优化任务列表和运行日志面板的布局
  - 确保窗口放大时右侧面板合理填充，无大面积空白
- **Acceptance Criteria Addressed**: AC-6
- **Test Requirements**:
  - `human-judgement` TR-6.1: 最大化窗口时，右侧面板合理填充
- **Files Modified**:
  - `src/components/automation/TaskRunLogsPanel.tsx`
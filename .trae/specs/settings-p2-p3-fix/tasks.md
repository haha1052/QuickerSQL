# 设置系统 P2/P3 修复 - 任务列表

## [ ] Task 1: 实现 formatOnSave 功能
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 在 SQLEditor 中实现保存时自动格式化
  - 监听保存事件，检查 `formatOnSave` 设置
  - 如果启用，调用 Monaco 格式化 API
  - 考虑：只在手动保存时触发，不在 autoSave 时触发
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-1.1: 保存 SQL 后内容被格式化
  - `programmatic` TR-1.2: 禁用 formatOnSave 后保存不格式化
- **Notes**: 
  - 建议使用 Monaco 的 `editor.getAction('editor.action.formatDocument')` 或 `format` command
  - 区分手动保存(Ctrl+S)和自动保存

---

## [ ] Task 2: 实现 autoExecute 功能
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 在 SQLEditor 中实现分号自动执行
  - 监听键盘事件，检测 `;` 后按 Enter
  - 检查 `autoExecute` 设置
  - 如果启用，自动触发执行当前 SQL
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `programmatic` TR-2.1: 输入 `;` 后按 Enter 自动执行
  - `programmatic` TR-2.2: 禁用 autoExecute 后需手动点击执行
- **Notes**:
  - 需要监听 `editor.onKeyUp` 或 `onKeyDown` 事件
  - 检测到 `;` 后设置标志，下次 Enter 时触发执行
  - 执行后清除标志

---

## [ ] Task 3: 实现 enableAutoRecover 功能
- **Priority**: medium
- **Depends On**: None
- **Description**:
  - 在 SQLEditor 中实现自动恢复功能
  - 监听 editor 内容变化，定期保存到 localStorage
  - 检查 `enableAutoRecover` 设置
  - 应用启动时检测是否有未保存内容，提示恢复
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `programmatic` TR-3.1: 刷新页面后能恢复未保存内容
  - `programmatic` TR-3.2: 禁用 enableAutoRecover 后不保存恢复点
- **Notes**:
  - localStorage key 格式：`__autorecover_${tabId}`
  - 保存频率：每 30 秒或内容变化时
  - 恢复时弹出确认对话框

---

## [ ] Task 4: 实现 developerMode 功能
- **Priority**: medium
- **Depends On**: None
- **Description**:
  - 在应用启动时读取 `developerMode` 设置
  - 控制 console.log 的显示（开发模式下显示，发布模式下隐藏）
  - 可以通过环境变量或全局配置控制
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `human-judgment` TR-4.1: 启用后控制台显示详细日志
  - `human-judgment` TR-4.2: 禁用后控制台只显示必要信息
- **Notes**:
  - 可以通过 `window.__DEVELOPER_MODE__` 全局变量控制
  - 配合前端日志工具（如 loglevel）使用

---

## [ ] Task 5: 实现 showDebugInfo 功能
- **Priority**: medium
- **Depends On**: None
- **Description**:
  - 在应用中添加调试信息面板
  - 监听 `showDebugInfo` 设置
  - 如果启用，显示性能指标、网络请求、组件状态等信息
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `human-judgment` TR-5.1: 启用后界面显示调试面板
  - `human-judgment` TR-5.2: 禁用后调试面板隐藏
- **Notes**:
  - 可以放在页面角落，作为浮动面板
  - 显示：内存使用、API 响应时间、当前 SQL 等

---

## [ ] Task 6: 更新 implemented_settings() 标记
- **Priority**: high
- **Depends On**: Task 1, Task 2, Task 3, Task 4, Task 5
- **Description**:
  - 修改 `src-tauri/src/services/settings_service.rs` 中的 `implemented_settings()` 函数
  - 添加 sql.formatOnSave、sql.autoExecute、sql.enableAutoRecover
  - 添加 advanced.developerMode、advanced.showDebugInfo
- **Acceptance Criteria Addressed**: AC-6
- **Test Requirements**:
  - `programmatic` TR-6.1: implemented_settings 包含新增的已实现项
  - `programmatic` TR-6.2: set.insert 总数正确
- **Notes**: 预计增加 5 项，总数从 78 增加到 83

---

## [ ] Task 7: 编译验证
- **Priority**: high
- **Depends On**: Task 1, Task 2, Task 3, Task 4, Task 5, Task 6
- **Description**:
  - 运行 cargo check --quiet 验证后端
  - 运行 npx tsc --noEmit --pretty 验证前端
- **Acceptance Criteria Addressed**: AC-6
- **Test Requirements**:
  - `programmatic` TR-7.1: cargo check --quiet 无错误
  - `programmatic` TR-7.2: npx tsc --noEmit --pretty 无错误
- **Notes**: 必须全部通过才算完成

---

## [ ] Task 8: 更新设置系统现状分析报告
- **Priority**: medium
- **Depends On**: Task 7
- **Description**:
  - 更新报告版本号到 v22.0
  - 更新各分类已实现数量统计
  - 标记 P2/P3 任务完成
  - 更新下一步行动计划
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `human-judgment` TR-8.1: 报告版本号已更新
  - `human-judgment` TR-8.2: 各分类统计数据准确
- **Notes**: 生效率预计从 69.6% 提升到约 74%

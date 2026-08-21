# 设置系统去重优化 - 任务列表

## [ ] Task 1: 后端 default_settings 去重
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 修改 `src-tauri/src/services/settings_service.rs` 中的 `default_settings()` 函数
  - 从 appearance 分类中移除 `tabSize`
  - 从 performance 分类中移除 `query_timeout`
  - 保留 editor.tabSize 和 database.queryTimeout
- **Acceptance Criteria Addressed**: AC-1, AC-2
- **Test Requirements**:
  - `programmatic` TR-1.1: default_settings 中 appearance 分类不包含 tabSize
  - `programmatic` TR-1.2: default_settings 中 editor 分类包含 tabSize
  - `programmatic` TR-1.3: default_settings 中 performance 分类不包含 query_timeout
  - `programmatic` TR-1.4: default_settings 中 database 分类包含 queryTimeout
- **Notes**: 设置项总数减少 2 项（112 → 110）

---

## [ ] Task 2: 后端 implemented_settings 去重
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - 修改 `src-tauri/src/services/settings_service.rs` 中的 `implemented_settings()` 函数
  - 从 appearance 分类中移除 `tabSize`
  - 从 performance 分类中移除 `query_timeout`
  - 保留 editor.tabSize（已实现）和 database.queryTimeout（未实现，不加入）
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `programmatic` TR-2.1: implemented_settings 中 appearance.tabSize 不存在
  - `programmatic` TR-2.2: implemented_settings 中 editor.tabSize 存在
  - `programmatic` TR-2.3: implemented_settings 中 performance.query_timeout 不存在
- **Notes**: 已实现项总数减少 2 项（83 → 81）

---

## [ ] Task 3: 后端兼容层 - get_setting fallback
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - 修改 `settings_service.rs` 中的 `get_setting` 函数
  - 读取 `editor.tabSize` 时，如果不存在，fallback 到 `appearance.tabSize`
  - 读取 `database.queryTimeout` 时，如果不存在，fallback 到 `performance.query_timeout`
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `programmatic` TR-3.1: get_setting("editor", "tabSize") 在老数据库中返回 appearance.tabSize 的值
  - `programmatic` TR-3.2: get_setting("database", "queryTimeout") 在老数据库中返回 performance.query_timeout 的值
- **Notes**: 保持向后兼容，老用户设置不丢失

---

## [ ] Task 4: 前端 SQLEditor 引用更新
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 修改 `src/components/sql/SQLEditor.tsx`
  - 将 `useSetting('appearance', 'tabSize')` 改为 `useSetting('editor', 'tabSize')`
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `programmatic` TR-4.1: SQLEditor.tsx 中不包含 useSetting('appearance', 'tabSize')
  - `programmatic` TR-4.2: SQLEditor.tsx 中包含 useSetting('editor', 'tabSize')
  - `programmatic` TR-4.3: npx tsc --noEmit --pretty 无错误
- **Notes**: 保持逻辑不变，只改分类名

---

## [ ] Task 5: 编译验证
- **Priority**: high
- **Depends On**: Task 1, Task 2, Task 3, Task 4
- **Description**:
  - 运行 cargo check --quiet 验证后端
  - 运行 npx tsc --noEmit --pretty 验证前端
- **Acceptance Criteria Addressed**: AC-6
- **Test Requirements**:
  - `programmatic` TR-5.1: cargo check --quiet 无错误
  - `programmatic` TR-5.2: npx tsc --noEmit --pretty 无错误
- **Notes**: 必须全部通过才算完成

---

## [ ] Task 6: 更新设置系统现状分析报告
- **Priority**: medium
- **Depends On**: Task 5
- **Description**:
  - 更新报告版本号到 v23.0
  - 更新设置项总数统计（112 → 110）
  - 更新已实现项统计（83 → 81）
  - 更新各分类实现率排名
  - 标记去重任务完成
  - 更新下一步行动计划
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `human-judgement` TR-6.1: 报告版本号已更新
  - `human-judgement` TR-6.2: 各分类统计数据准确
  - `human-judgement` TR-6.3: 去重任务标记为完成
- **Notes**: 生效率预计从 74.1% 略升到 73.6%（分母减小）

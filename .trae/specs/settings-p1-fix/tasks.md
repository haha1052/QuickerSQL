# 设置系统 P1 修复 - 任务列表

## [x] Task 1: 修正后端 default_settings 定义
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 修改 `src-tauri/src/services/settings_service.rs` 中的 `default_settings()` 函数
  - 将 `showLineNumbers` 从 `sql` 分类移到 `editor` 分类
  - 添加 `editor.showMinimap` 设置项（Boolean, 默认 true, "显示小地图"）
  - 添加 `editor.enableCodeFolding` 设置项（Boolean, 默认 true, "启用代码折叠"）
  - `editor.insertSpaces` 已存在，保留不动
- **Acceptance Criteria Addressed**: AC-2, AC-3, AC-4
- **Test Requirements**:
  - `programmatic` TR-1.1: default_settings 中 editor 分类包含 showLineNumbers
  - `programmatic` TR-1.2: default_settings 中 editor 分类包含 showMinimap
  - `programmatic` TR-1.3: default_settings 中 editor 分类包含 enableCodeFolding
  - `programmatic` TR-1.4: default_settings 中 sql 分类不包含 showLineNumbers
- **Notes**: 老数据库兼容：get_setting 返回 None 时使用默认值

---

## [x] Task 2: 修正 implemented_settings() 标记
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - 修改 `src-tauri/src/services/settings_service.rs` 中的 `implemented_settings()` 函数
  - 将 `showLineNumbers` 从 `sql` 移到 `editor` 分类
  - 添加 `editor.showMinimap` 到已实现集合
  - 添加 `editor.enableCodeFolding` 到已实现集合
  - `editor.insertSpaces` 已在集合中（检查确认）
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `programmatic` TR-2.1: implemented_settings 中 editor.showLineNumbers 存在
  - `programmatic` TR-2.2: implemented_settings 中 editor.showMinimap 存在
  - `programmatic` TR-2.3: implemented_settings 中 editor.enableCodeFolding 存在
  - `programmatic` TR-2.4: implemented_settings 中 sql.showLineNumbers 不存在
- **Notes**: editor 分类已实现项从 8 项增加到 11 项

---

## [x] Task 3: 修正前端 SQLEditor 键名引用
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 修改 `src/components/sql/SQLEditor.tsx`
  - 将 `useSetting('editor', 'useSoftTabs')` 改为 `useSetting('editor', 'insertSpaces')`
  - 将变量名 `useSoftTabs` 改为 `insertSpaces`
  - 将变量名 `insertSpacesEnabled` 保留（语义正确）
  - `showLineNumbers`、`showMinimap`、`enableCodeFolding` 前端已从 editor 分类读取，无需修改
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-3.1: SQLEditor.tsx 中 useSetting('editor', 'useSoftTabs') 不存在
  - `programmatic` TR-3.2: SQLEditor.tsx 中 useSetting('editor', 'insertSpaces') 存在
  - `programmatic` TR-3.3: npx tsc --noEmit --pretty 无错误
- **Notes**: 保持逻辑不变，只改键名和变量名

---

## [x] Task 4: 更新多语言翻译键名
- **Priority**: medium
- **Depends On**: Task 1
- **Description**:
  - 修改 `src/context/LocaleContext.tsx`
  - 将 sql 分类下的 showLineNumbers 翻译移到 editor 分类
  - 添加 editor.showMinimap 翻译（中/英）
  - 添加 editor.enableCodeFolding 翻译（中/英）
  - 检查 settings.editor.insertSpaces 翻译是否存在
- **Acceptance Criteria Addressed**: AC-2, AC-3, AC-4
- **Test Requirements**:
  - `human-judgement` TR-4.1: 设置界面中所有新增/移动的设置项显示正确的中文标签
  - `human-judgement` TR-4.2: 英文模式下显示正确的英文标签
- **Notes**: 翻译键名格式：`settings.editor.showMinimap`、`settings.editor.enableCodeFolding`

---

## [x] Task 5: 编译验证
- **Priority**: high
- **Depends On**: Task 1, Task 2, Task 3
- **Description**:
  - 运行 cargo check --quiet 验证后端
  - 运行 npx tsc --noEmit --pretty 验证前端
- **Acceptance Criteria Addressed**: AC-6
- **Test Requirements**:
  - `programmatic` TR-5.1: cargo check --quiet 无错误
  - `programmatic` TR-5.2: npx tsc --noEmit --pretty 无错误
- **Notes**: 必须全部通过才算完成

---

## [x] Task 6: 更新设置系统现状分析报告
- **Priority**: medium
- **Depends On**: Task 5
- **Description**:
  - 更新报告版本号到 v21.0
  - 更新各分类已实现数量统计
  - 标记 P1 任务完成
  - 更新下一步行动计划
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `human-judgement` TR-6.1: 报告版本号已更新
  - `human-judgement` TR-6.2: 各分类统计数据准确
  - `human-judgement` TR-6.3: P1 任务标记为完成
- **Notes**: 生效率从 67.6% 提升到约 70%

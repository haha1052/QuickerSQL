# 统一快捷键管理系统 - The Implementation Plan (Decomposed and Prioritized Task List)

## [ ] Task 1: 创建快捷键管理核心模块 (shortcutManager.ts)
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 创建 `src/utils/shortcutManager.ts` 核心模块
  - 实现快捷键字符串解析函数（如 "Ctrl+Enter" → Monaco KeyCode 对象）
  - 实现快捷键命令注册/注销机制（命令ID + 处理函数）
  - 实现快捷键绑定/解绑（键位组合 → 命令ID映射）
  - 实现快捷键冲突检测功能
  - 实现默认快捷键读取和恢复功能
- **Acceptance Criteria Addressed**: AC-1, AC-6
- **Test Requirements**:
  - `programmatic` TR-1.1: `parseShortcut("Ctrl+Enter")` 能正确解析为 Monaco KeyCode 组合
  - `programmatic` TR-1.2: 注册两个相同快捷键的命令时，冲突检测返回冲突信息
  - `programmatic` TR-1.3: 命令注册/注销后，绑定列表正确更新
  - `human-judgement` TR-1.4: 代码结构清晰，API 设计合理，易于扩展
- **Notes**: 注意 Monaco 的 KeyMod 和 KeyCode 枚举使用

## [ ] Task 2: 创建全局快捷键 Provider (ShortcutProvider)
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - 创建 `src/context/ShortcutProvider.tsx` Context Provider
  - 注册所有全局快捷键命令（新建、打开、保存、设置等）
  - 实现全局 keydown 事件监听
  - 实现输入框内的快捷键屏蔽逻辑
  - 与设置系统集成，从设置读取快捷键值
  - 实现设置变更时动态更新快捷键绑定
- **Acceptance Criteria Addressed**: AC-3, AC-5
- **Test Requirements**:
  - `programmatic` TR-2.1: 在应用聚焦时按 Ctrl+, 能触发设置打开
  - `programmatic` TR-2.2: 在输入框中打字时，字母键不触发全局快捷键
  - `programmatic` TR-2.3: 修改设置后，新快捷键立即生效
  - `human-judgement` TR-2.4: 全局快捷键不影响 Monaco 编辑器内置功能
- **Notes**: 注意事件冒泡和 preventDefault 的使用

## [ ] Task 3: 改造 SQLEditor 快捷键为可配置
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - 修改 `src/components/sql/SQLEditor.tsx`
  - 将 5 个硬编码的编辑器快捷键改为从设置读取
  - 实现设置变更时动态注销/重新注册快捷键
  - 确保编辑器内快捷键优先级高于全局快捷键
  - 保持默认快捷键与原硬编码完全一致
- **Acceptance Criteria Addressed**: AC-2, AC-5
- **Test Requirements**:
  - `programmatic` TR-3.1: 默认快捷键行为与改造前完全一致
  - `programmatic` TR-3.2: 修改设置中的快捷键后，编辑器立即使用新快捷键
  - `programmatic` TR-3.3: 编辑器聚焦时，相同键位的编辑器快捷键优先于全局快捷键
  - `human-judgement` TR-3.4: 代码改造不影响编辑器其他功能
- **Notes**: Monaco addCommand 返回值可用于后续注销

## [ ] Task 4: 设置界面增加快捷键编辑功能
- **Priority**: medium
- **Depends On**: Task 1
- **Description**:
  - 修改 `src/components/common/SettingsModal.tsx`
  - 为 shortcut 类型的设置项增加编辑按钮
  - 实现快捷键编辑输入框（文本输入模式）
  - 实现"恢复默认"按钮
  - 实现保存/取消编辑逻辑
  - 实时显示冲突检测提示
- **Acceptance Criteria Addressed**: AC-4, AC-6
- **Test Requirements**:
  - `programmatic` TR-4.1: 点击快捷键值能进入编辑模式
  - `programmatic` TR-4.2: 输入非法格式的快捷键会提示错误
  - `programmatic` TR-4.3: 点击"恢复默认"能恢复默认值
  - `human-judgement` TR-4.4: UI 交互流畅，视觉设计与整体风格一致
- **Notes**: 先实现文本输入方式，简单可靠

## [ ] Task 5: 编译验证与集成测试
- **Priority**: high
- **Depends On**: Task 2, Task 3, Task 4
- **Description**:
  - 运行 `npx tsc --noEmit --pretty` 验证类型
  - 运行 `cargo check --quiet` 验证后端（预期无变化）
  - 手动验证主要快捷键功能
  - 确保不破坏现有设置系统
  - 检查是否符合架构分层约束
- **Acceptance Criteria Addressed**: AC-7
- **Test Requirements**:
  - `programmatic` TR-5.1: `npx tsc --noEmit --pretty` 返回 0 errors
  - `programmatic` TR-5.2: `cargo check --quiet` 无 error
  - `programmatic` TR-5.3: 前端无 `invoke()` 直接调用在组件层
  - `human-judgement` TR-5.4: 代码遵循现有项目风格和架构规范
- **Notes**: 编译验证是必须通过的硬门禁

## [ ] Task 6: 更新文档
- **Priority**: medium
- **Depends On**: Task 5
- **Description**:
  - 创建快捷键管理系统技术文档
  - 更新设置系统现状分析报告（快捷键标记为已实现）
  - 记录架构决策和设计思路
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `human-judgement` TR-6.1: 文档内容完整，覆盖架构设计、API 使用、扩展方法
  - `human-judgement` TR-6.2: 设置系统现状分析报告数据准确
- **Notes**: 文档放在 docs/ 目录下

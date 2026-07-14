# 设置系统 Phase 6 架构改写 - 实施计划

## [ ] Task 1: 后端新增设置元数据接口
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 在 `settings_service.rs` 中新增 `get_settings_meta()` 函数
  - 从 `default_settings()` 返回元数据（不查询数据库，只返回定义）
  - 新增 `is_implemented` 字段，标记 27 个已实现的设置项
  - 返回结构包含：category、key、value_type、default_value、options、description、is_visible、is_system、is_implemented
  - 新增 `SettingMeta` 结构体到 models
  - 在 commands/settings.rs 中新增 `get_settings_meta_cmd` 命令
  - 在 lib.rs 中注册新命令
  - 在 capabilities/default.json 中添加权限
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-1.1: cargo check 通过
  - `programmatic` TR-1.2: 能正确返回 110 个设置项的元数据
  - `programmatic` TR-1.3: 27 个设置项的 is_implemented 为 true
- **Notes**: 元数据从 default_settings() 获取，不从数据库读取

## [ ] Task 2: 前端 settingsStore 支持元数据
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - 在 settingsStore 中添加 settingsMeta 状态
  - 添加 loadSettingsMeta action
  - 在 tauriService.ts 中添加 getSettingsMeta 封装
  - 应用启动时加载元数据
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `programmatic` TR-2.1: TypeScript 编译通过
  - `programmatic` TR-2.2: settingsMeta 正确加载
- **Notes**: 保持现有 categories 状态不变

## [ ] Task 3: SettingsModal 改为动态渲染
- **Priority**: high
- **Depends On**: Task 1, Task 2
- **Description**:
  - 删除 SettingsModal.tsx 中的 SETTING_CONFIGS
  - 从 settingsMeta 读取设置元数据
  - 根据 value_type 动态渲染设置项
  - boolean → 开关
  - number → 数字输入/select（根据 options 决定）
  - select → 下拉选择
  - string → 文本输入
  - 只渲染 is_implemented 为 true 的设置项
  - 使用 description 作为标签文字
- **Acceptance Criteria Addressed**: AC-2, AC-3, AC-5
- **Test Requirements**:
  - `programmatic` TR-3.1: TypeScript 编译通过
  - `programmatic` TR-3.2: SETTING_CONFIGS 已删除
  - `human-judgement` TR-3.3: 设置页面正常显示 27 个已实现项
- **Notes**: 保持现有样式不变

## [ ] Task 4: 删除冗余的 pages/Settings.tsx
- **Priority**: medium
- **Depends On**: Task 3
- **Description**:
  - 确认 pages/Settings.tsx 没有被使用
  - 删除该文件
  - 删除 App.tsx 中相关的引用
  - 从路由中移除
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `programmatic` TR-4.1: TypeScript 编译通过
  - `programmatic` TR-4.2: Settings.tsx 已删除
- **Notes**: 确保没有其他地方引用

## [ ] Task 5: 功能验证与回归测试
- **Priority**: high
- **Depends On**: Task 1, Task 2, Task 3, Task 4
- **Description**:
  - 验证所有 27 个已实现设置项正常显示
  - 验证设置修改和保存功能正常
  - 验证 useSetting hook 正常工作
  - 验证外观设置在 SQLEditor 中生效
  - 验证 SQL 查询设置正常工作
  - 验证回收站和数据库设置正常工作
- **Acceptance Criteria Addressed**: AC-3, AC-4, AC-6
- **Test Requirements**:
  - `programmatic` TR-5.1: TypeScript 编译通过
  - `programmatic` TR-5.2: Rust 编译通过
  - `human-judgement` TR-5.3: 所有已实现设置项正常显示和工作
- **Notes**: 重点测试不破坏现有功能

## 任务依赖图
```
Task 1 (后端元数据)
    ↓
Task 2 (前端 store)
    ↓
Task 3 (动态渲染) ← Task 2
    ↓
Task 4 (删除冗余)
    ↓
Task 5 (验证测试)
```

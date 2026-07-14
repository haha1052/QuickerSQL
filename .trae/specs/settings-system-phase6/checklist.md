# 设置系统 Phase 6 架构改写 - 验证清单

## 后端验证

- [ ] 1.1 get_settings_meta 命令存在
  - lib.rs 中已注册新命令
  - commands/settings.rs 中有对应函数

- [ ] 1.2 SettingMeta 结构体存在
  - models/settings.rs 中有 SettingMeta 定义
  - 包含必要字段：category、key、value_type、default_value、options、description、is_visible、is_system、is_implemented

- [ ] 1.3 is_implemented 标记正确
  - 27 个设置项的 is_implemented 为 true
  - 其他设置项的 is_implemented 为 false

## 前端验证

- [ ] 2.1 settingsStore 支持元数据
  - 有 settingsMeta 状态
  - 有 loadSettingsMeta action
  - tauriService.ts 中有 getSettingsMeta 封装

- [ ] 2.2 SettingsModal 动态渲染
  - SETTING_CONFIGS 已删除
  - 从元数据动态渲染
  - boolean 类型渲染为开关
  - number 类型渲染为数字输入
  - select 类型渲染为下拉选择
  - 只渲染 is_implemented 为 true 的项

- [ ] 2.3 冗余代码已删除
  - pages/Settings.tsx 已删除
  - 没有其他地方引用已删除的文件

## 功能验证

- [ ] 3.1 所有 27 个已实现设置项正常显示
  - 外观 6 项：theme、fontSize、fontFamily、lineHeight、tabSize、wordWrap
  - 编辑器 3 项：autoSave、saveInterval、tabSize
  - SQL 查询 3 项：resultLimit、showExecutionTime、maxHistorySize
  - 自动化 5 项：engineEnabled、scheduleIntervalSecs、logRetentionDays、defaultRetryOnFail、defaultTimeoutSecs
  - 回收站 1 项：confirmBeforeDelete
  - 数据库 1 项：showSystemTables
  - 其他 8 项：性能/安全/缓存/语言等

- [ ] 3.2 设置修改和保存功能正常
  - 修改设置能正确保存
  - 刷新页面后设置保持
  - useSetting hook 能正确读取设置值

- [ ] 3.3 外观设置在 SQLEditor 中生效
  - 字体大小变化立即生效
  - 字体族变化立即生效
  - 行高变化立即生效
  - Tab 宽度变化立即生效
  - 自动换行变化立即生效

- [ ] 3.4 SQL 查询设置正常工作
  - resultLimit 限制结果行数
  - maxHistorySize 限制历史记录数量
  - showExecutionTime 控制执行时间显示

- [ ] 3.5 回收站和数据库设置正常工作
  - confirmBeforeDelete 控制删除确认
  - showSystemTables 控制系统表显示

## 编译验证

- [ ] 4.1 Rust 编译通过（cargo check --quiet，0 error）
- [ ] 4.2 TypeScript 编译通过（npx tsc --noEmit，0 errors）

## 代码规范验证

- [ ] 5.1 无 SQL 注入（format! 拼接 SQL）
- [ ] 5.2 无 unwrap/expect（非测试代码）
- [ ] 5.3 无 any 类型
- [ ] 5.4 架构分层正确（组件层不直接 invoke）

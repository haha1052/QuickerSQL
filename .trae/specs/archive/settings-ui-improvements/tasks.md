# Tasks - 设置界面改进

## 任务清单

- [x] Task 1: 创建设置子窗口组件和样式
  - [x] SubTask 1.1: 创建 SettingsModal.tsx 组件，实现子窗口结构
  - [x] SubTask 1.2: 更新 Settings.css，实现子窗口样式（居中显示、遮罩背景、关闭按钮）
  - [x] SubTask 1.3: 添加 ESC 键关闭功能

- [x] Task 2: 缩小设置界面字体为原来的 3/4
  - [x] SubTask 2.1: 调整 Settings.css 中所有字号（乘以 0.75）

- [x] Task 3: 添加重启应用功能
  - [x] SubTask 3.1: 在后端添加 restart_app 命令（src-tauri/src/commands/app_state.rs）
  - [x] SubTask 3.2: 在前端 tauri.ts 添加 restartApp 函数
  - [x] SubTask 3.3: 在安全分类设置页面添加重启按钮

- [x] Task 4: 梳理翻译系统，迁移硬编码中文到 LocaleContext.tsx
  - [x] SubTask 4.1: 在 LocaleContext.tsx 添加活动记录管理相关翻译键
  - [x] SubTask 4.2: 在 LocaleContext.tsx 添加首次启动设置相关翻译键
  - [x] SubTask 4.3: 在 LocaleContext.tsx 添加重置按钮相关翻译键
  - [x] SubTask 4.4: 更新 Settings.tsx，使用 t() 函数替换硬编码中文
  - [x] SubTask 4.5: 更新 Header.tsx，使用 t() 函数替换硬编码中文

- [x] Task 5: 验证和测试
  - [x] SubTask 5.1: TypeScript 类型检查通过
  - [x] SubTask 5.2: Rust 编译检查通过
  - [ ] SubTask 5.3: 手动测试子窗口打开/关闭
  - [ ] SubTask 5.4: 手动测试重启应用按钮
  - [ ] SubTask 5.5: 手动测试中英文界面翻译完整性

## 任务依赖

- Task 3 依赖 Task 1（子窗口实现后添加重启按钮）
- Task 4 可独立进行
- Task 5 依赖 Task 1-4 全部完成

## 优先级

1. Task 1（子窗口）— 核心 UX 改进
2. Task 2（字体缩小）— UX 改进
3. Task 3（重启应用）— 功能增强
4. Task 4（翻译梳理）— 国际化完善
5. Task 5（验证测试）— 最终验证

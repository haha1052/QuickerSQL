# 设置界面改进方案 — Product Requirement Document

## Why

1. 当前设置界面采用整页覆盖工作区的方式，用户无法同时查看工作区和修改设置
2. 设置界面字体偏大，影响阅读体验
3. 部分硬编码的中文字符串未纳入翻译系统，英文界面下会显示中文
4. 缺少重启应用功能，某些设置（如语言切换）需要重启才能完全生效

## What Changes

- [x] 将设置界面从整页覆盖改为弹出式子窗口，可通过按钮或 ESC 关闭
- [x] 设置界面字体缩小为原来的 3/4（所有字号 × 0.75）
- [x] 在安全分类下增加"重启应用"按钮
- [x] 梳理翻译系统，将 Settings.tsx 中的硬编码中文迁移到 LocaleContext.tsx
- [x] 确保英文界面下所有设置相关文本正确显示英文

## Impact

- Affected specs: 无（纯前端 UI 改进）
- Affected code:
  - `src/pages/Settings.tsx` — 子窗口模式、翻译键使用
  - `src/pages/Settings.css` — 字体缩小
  - `src/context/LocaleContext.tsx` — 新增翻译键
  - `src/services/tauri.ts` — 重启命令封装
  - `src-tauri/src/commands/app.rs` — 重启命令实现

## ADDED Requirements

### Requirement: 设置子窗口模式
系统 SHALL 提供弹出式设置窗口，用户可以同时查看工作区和修改设置，窗口可通过关闭按钮或 ESC 键关闭。

#### Scenario: 打开设置
- **WHEN** 用户点击设置按钮
- **THEN** 弹出设置子窗口，工作区保持可见

#### Scenario: 关闭设置
- **WHEN** 用户点击关闭按钮或按下 ESC 键
- **THEN** 设置子窗口关闭，返回工作区

### Requirement: 重启应用按钮
系统 SHALL 提供"重启应用"按钮，允许用户在不关闭手动关闭应用的情况下重启。

#### Scenario: 重启应用
- **WHEN** 用户在设置页面点击"重启应用"按钮
- **THEN** 应用自动重启

## MODIFIED Requirements

### Requirement: 设置界面字体大小
设置界面的字体大小 SHALL 缩小为原来的 3/4（所有字号乘以 0.75），提升阅读体验。

#### Scenario: 字体缩小
- **WHEN** 用户打开设置界面
- **THEN** 界面所有文本（分类名、设置项名称、按钮等）的字体大小为原来的 75%

### Requirement: 设置界面翻译完整性
所有设置相关的用户可见文本 SHALL 正确使用 `t()` 函数翻译，中英文界面下均正确显示。

#### Scenario: 英文界面翻译完整
- **WHEN** 用户切换到英文界面
- **THEN** 设置页面所有文本（包括安全分类下的活动记录、重置按钮等）均显示英文

## REMOVED Requirements

无

## Open Questions

- [ ] Q1: 子窗口大小应该固定还是可调整？（建议固定宽度 800px，高度 600px，居中显示）
- [ ] Q2: 子窗口是否需要半透明背景遮罩？（建议需要，点击遮罩也可关闭）

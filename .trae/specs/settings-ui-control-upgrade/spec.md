# Phase 10 设置界面 UI 控件升级 — Product Requirement Document

## Why

1. 当前设置界面所有设置项都使用统一的文本输入框，用户体验不统一
2. 布尔值设置使用 toggle switch，与其他设置项风格不一致
3. 数值大小参数没有范围限制，用户可能输入不合理值
4. 用户期望更直观的设置交互方式

## What Changes

- [x] 布尔值设置从 toggle switch 改为下拉选项（开启/关闭）
- [x] 数值类型设置有范围时改为滑块控件 + 数值显示
- [x] 数值类型设置有 options 时改为下拉选择器
- [x] 无范围无选项的数值设置保留数字输入框作为降级
- [x] 后端元数据新增数值范围字段（min_value、max_value、step）
- [x] 前端动态渲染逻辑根据元数据类型自动选择控件

## Impact

- Affected specs: 设置系统 Phase 6 元数据驱动架构
- Affected code:
  - `src-tauri/src/models/settings.rs` — SettingMeta 新增范围字段
  - `src-tauri/src/services/settings_service.rs` — default_settings 补充范围元数据
  - `src/types/settings.ts` — SettingMeta 接口新增范围字段
  - `src/components/common/SettingsModal.tsx` — 动态渲染逻辑
  - `src/pages/Settings.css` — 滑块控件样式

## ADDED Requirements

### Requirement: 布尔值下拉选项
系统 SHALL 将所有布尔值设置项渲染为下拉选项，选项为"开启"和"关闭"。

#### Scenario: 布尔值设置渲染
- **WHEN** 设置项的 value_type 为 "boolean"
- **THEN** 渲染为 `<select>` 下拉，选项为"开启"(true)和"关闭"(false)

### Requirement: 数值范围滑块
系统 SHALL 将有范围定义的数值设置项渲染为滑块控件，显示当前值。

#### Scenario: 数值滑块渲染
- **WHEN** 设置项的 value_type 为 "number" 且有 min_value/max_value
- **THEN** 渲染为 `<input type="range">` 滑块 + 数值显示

#### Scenario: 数值滑块交互
- **WHEN** 用户拖动滑块
- **THEN** 数值显示实时更新，设置值随滑块变化

## MODIFIED Requirements

### Requirement: 数值下拉选择
系统 SHALL 将有 options 定义的数值设置项渲染为下拉选择器。

#### Scenario: 数值下拉渲染
- **WHEN** 设置项的 value_type 为 "number" 且有 options
- **THEN** 渲染为 `<select>` 下拉选择器

### Requirement: 数值降级输入
系统 SHALL 将既无范围定义也无 options 的数值设置项保留为数字输入框。

#### Scenario: 数字输入框渲染
- **WHEN** 设置项的 value_type 为 "number" 且无 min/max 和 options
- **THEN** 渲染为 `<input type="number">` 数字输入框

## REMOVED Requirements

无

## Open Questions

无

## 技术实现细节

### 后端元数据字段
```rust
pub struct SettingMeta {
    // ... 已有字段
    pub min_value: Option<f64>,  // 新增：最小值
    pub max_value: Option<f64>,  // 新增：最大值
    pub step: Option<f64>,       // 新增：步长
}
```

### 控件渲染优先级
1. 布尔值 → 下拉（开启/关闭）
2. 数值 + 有 options → 下拉选择器
3. 数值 + 有 min/max → 滑块 + 数值显示
4. 数值 + 无约束 → 数字输入框（降级）
5. 其他 → 文本输入框

### 滑块样式要求
- 滑块轨道：灰色（--border-secondary）
- 滑块滑块：主题色（--primary）
- 悬浮效果：放大 10%
- 数值显示：右对齐，等宽数字字体

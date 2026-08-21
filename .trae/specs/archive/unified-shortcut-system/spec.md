# 统一快捷键管理系统 - Product Requirement Document

## Overview
- **Summary**: 建立一个完整的、可扩展的统一快捷键管理系统，替代当前硬编码的快捷键绑定，使用户可以通过设置界面自定义所有快捷键。
- **Purpose**: 解决 20 个快捷键设置项全部"有 UI 无功能"的问题，让设置系统中的快捷键真正生效，同时建立可扩展的快捷键管理架构，为未来新增快捷键提供统一接口。
- **Target Users**: 所有 QuickerSQL 用户，尤其是需要自定义快捷键的高级用户。

## Goals
- G1：建立统一的快捷键管理系统架构（ShortcutManager）
- G2：实现编辑器内快捷键的可配置化（从设置读取，而非硬编码）
- G3：实现全局快捷键系统（新建、打开、保存、设置等应用级快捷键）
- G4：在设置界面中显示快捷键修改功能（点击修改、恢复默认）
- G5：快捷键变更实时生效，无需重启应用
- G6：提供快捷键冲突检测功能

## Non-Goals (Out of Scope)
- ❌ 不实现按键录制功能（只支持文本输入修改）
- ❌ 不实现多套快捷键方案切换
- ❌ 不实现导入/导出快捷键配置
- ❌ 不修改后端 Rust 代码（快捷键设置已在 __settings 表中定义）
- ❌ 不实现 Mac 专用的 Cmd 键适配（Monaco 的 CtrlCmd 已自动处理）

## Background & Context
- 当前有 20 个快捷键设置项定义在 `default_settings()` 中，但全部没有实际功能
- SQLEditor 中有 5 个硬编码的 Monaco 快捷键绑定
- 全局快捷键完全没有实现（如 Ctrl+N 新建文件、Ctrl+S 保存等）
- 项目使用 Zustand 做状态管理，SettingsContext 提供设置读取
- Monaco Editor 有成熟的 addCommand API，可以动态注册/注销快捷键

## Functional Requirements

### FR-1: 快捷键管理核心 (ShortcutManager)
- **描述**: 建立统一的快捷键管理核心模块
- **实现位置**: `src/utils/shortcutManager.ts`
- **功能**:
  - 注册快捷键命令（命令ID + 处理函数）
  - 绑定快捷键到命令（从设置读取键位）
  - 动态更新快捷键绑定（设置变更时重新绑定）
  - 快捷键冲突检测
  - 解析快捷键字符串（如 "Ctrl+Enter" → Monaco KeyCode）
  - 恢复默认快捷键

### FR-2: 编辑器内快捷键可配置
- **描述**: 将 SQLEditor 中的硬编码快捷键改为从设置读取
- **实现位置**: `src/components/sql/SQLEditor.tsx`
- **涉及快捷键**:
  - `executeQuery` (Ctrl+Enter) - 执行当前语句
  - `executeAll` (Ctrl+Shift+Enter) - 执行全部
  - `explainQuery` (Ctrl+E) - 解释当前语句
  - `explainAll` (Ctrl+Shift+E) - 解释全部
  - `formatSql` (Shift+Alt+F) - 格式化SQL
- **要求**: 设置变更后，编辑器快捷键实时更新

### FR-3: 全局快捷键系统
- **描述**: 实现应用级别的全局快捷键
- **实现位置**: `src/context/ShortcutProvider.tsx`
- **涉及快捷键**:
  - `newFile` (Ctrl+N) - 新建文件
  - `openFile` (Ctrl+O) - 打开文件
  - `saveFile` (Ctrl+S) - 保存文件
  - `saveAs` (Ctrl+Shift+S) - 另存为
  - `find` (Ctrl+F) - 查找
  - `replace` (Ctrl+H) - 替换
  - `goToLine` (Ctrl+G) - 跳转到行
  - `undo` (Ctrl+Z) - 撤销
  - `redo` (Ctrl+Y) - 重做
  - `copy` (Ctrl+C) - 复制
  - `paste` (Ctrl+V) - 粘贴
  - `cut` (Ctrl+X) - 剪切
  - `selectAll` (Ctrl+A) - 全选
  - `newProject` (Ctrl+Shift+N) - 新建项目
  - `importData` (Ctrl+I) - 导入数据
  - `exportData` (Ctrl+E) - 导出数据
  - `openSettings` (Ctrl+,) - 打开设置
- **要求**: 全局快捷键在应用聚焦时生效，输入框内酌情屏蔽

### FR-4: 设置界面快捷键编辑
- **描述**: 在设置界面中支持快捷键的编辑功能
- **实现位置**: `src/components/common/SettingsModal.tsx`
- **功能**:
  - 点击快捷键值进入编辑模式
  - 显示"保存"和"取消"按钮
  - 显示"恢复默认"按钮
  - 冲突检测提示
  - 快捷键字符串格式验证

### FR-5: 快捷键冲突检测
- **描述**: 当用户设置的快捷键与现有快捷键冲突时给出提示
- **实现位置**: `src/utils/shortcutManager.ts`
- **功能**:
  - 同范围内（编辑器内/全局）快捷键冲突检测
  - 跨范围冲突提示（如全局快捷键与编辑器快捷键重叠）

## Non-Functional Requirements
- **NFR-1**: 性能：快捷键绑定/解绑操作应在 10ms 内完成
- **NFR-2**: 响应性：设置变更后，新快捷键应在 100ms 内生效
- **NFR-3**: 兼容性：默认快捷键与现有硬编码保持一致，用户无感升级
- **NFR-4**: 可靠性：快捷键设置损坏时自动恢复默认值，不导致应用崩溃
- **NFR-5**: 可维护性：新增快捷键只需注册命令 + 添加默认值，无需修改核心代码

## Constraints
- **技术**: React + TypeScript + Zustand + Monaco Editor
- **架构**: 遵循前端三层架构（components → store → services）
- **数据**: 快捷键设置存储在 __settings 表，通过现有设置系统读写
- **兼容性**: 必须保持现有默认快捷键不变，确保向后兼容

## Assumptions
- 快捷键字符串格式使用加号连接："Ctrl+Enter"、"Ctrl+Shift+E"
- 编辑器内快捷键优先级高于全局快捷键（在编辑器聚焦时，编辑器快捷键先响应）
- 默认快捷键定义在后端 `default_settings()` 中，前端只读取
- 所有快捷键在同一分类 `shortcuts` 下

## Acceptance Criteria

### AC-1: 快捷键管理核心模块完成
- **Given**: 开发者查看代码库
- **When**: 检查 shortcutManager.ts
- **Then**: 包含快捷键注册、绑定、解绑、冲突检测、字符串解析等核心功能
- **Verification**: `programmatic`

### AC-2: 编辑器内快捷键可配置
- **Given**: 用户在设置中修改 `executeQuery` 快捷键为 Ctrl+R
- **When**: 用户在编辑器中按 Ctrl+R
- **Then**: 执行当前 SQL 语句
- **Verification**: `programmatic`

### AC-3: 全局快捷键系统生效
- **Given**: 用户在应用任意位置按 Ctrl+,
- **When**: 快捷键触发
- **Then**: 打开设置窗口
- **Verification**: `programmatic`

### AC-4: 设置界面支持快捷键编辑
- **Given**: 用户打开设置界面的快捷键分类
- **When**: 用户点击某个快捷键的值
- **Then**: 进入编辑模式，可以修改快捷键
- **Verification**: `human-judgment`

### AC-5: 快捷键变更实时生效
- **Given**: 用户修改了某个快捷键
- **When**: 用户立即使用新快捷键
- **Then**: 新快捷键立即生效，无需重启
- **Verification**: `programmatic`

### AC-6: 冲突检测正常工作
- **Given**: 用户尝试将两个快捷键设置为相同的键位组合
- **When**: 用户保存设置
- **Then**: 显示冲突提示，阻止保存或提示用户
- **Verification**: `programmatic`

### AC-7: 编译和类型检查通过
- **Given**: 代码修改完成
- **When**: 执行 cargo check 和 npx tsc
- **Then**: 全部通过
- **Verification**: `programmatic`

## Open Questions
- [ ] 全局快捷键在文本输入框中是否需要全部屏蔽？（建议：大部分屏蔽，除了 Ctrl+S、Ctrl+Z 等通用的）
- [ ] 快捷键编辑是用"点击录制"还是"文本输入"？（建议：先做文本输入，简单可靠）

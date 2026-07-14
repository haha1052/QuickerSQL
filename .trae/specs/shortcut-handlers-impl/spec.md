# 快捷键 Handler 对接实施 — Product Requirement Document

## Overview
- **Summary**: 将统一快捷键管理系统中剩余 14 个空 handler 的快捷键，全部对接上实际的应用功能。
- **Purpose**: 让所有 20 个快捷键设置项真正生效，从"有框架无功能"提升到"全部可用"，完成快捷键系统的闭环。
- **Target Users**: 所有 QuickerSQL 用户，尤其是经常使用快捷键提高效率的用户。

## Goals
- G1：编辑器作用域 4 个快捷键全部对接（find、replace、goToLine、toggleComment）
- G2：全局文件操作 4 个快捷键全部对接（newFile、openFile、saveFile、saveAs）
- G3：全局导入导出 2 个快捷键对接（importData、exportData）
- G4：全局编辑操作 6 个快捷键对接（undo、redo、copy、paste、cut、selectAll）
- G5：全局项目操作 1 个快捷键对接（newProject）
- G6：所有 20 个快捷键设置项 100% 生效

## Non-Goals (Out of Scope)
- ❌ 不新增任何应用功能（只把已有功能绑定到快捷键）
- ❌ 不修改后端代码
- ❌ 不改变快捷键系统的架构
- ❌ 不新增快捷键设置项
- ❌ 不实现按键录制功能
- ❌ 不实现多套快捷键方案

## Background & Context
- Phase 17 已建立完整的统一快捷键管理系统（方案 B）
- 20 个快捷键中，6 个已实现（5 个编辑器 + 1 个全局 openSettings）
- 剩余 14 个快捷键有框架、能在设置中配置，但 handler 是空函数
- 应用中已有很多对应功能（如新建文件、打开文件、保存等），只是没有绑定到快捷键
- 大部分功能可以通过现有的 Store 或直接调用 Tauri API 实现

## 14 个快捷键对接可行性分析

### ✅ 可以直接对接（有现成功能）

| # | 快捷键 | 作用域 | 对接方式 | 难度 |
|---|--------|--------|---------|------|
| 1 | `find` | editor | 调用 Monaco 编辑器的查找命令 | ⭐ 简单 |
| 2 | `replace` | editor | 调用 Monaco 编辑器的替换命令 | ⭐ 简单 |
| 3 | `goToLine` | editor | 调用 Monaco 编辑器的跳转到行命令 | ⭐ 简单 |
| 4 | `toggleComment` | editor | 调用 Monaco 编辑器的切换注释命令 | ⭐ 简单 |
| 5 | `newFile` | global | 调用 workspaceStore.addTab() | ⭐ 简单 |
| 6 | `openFile` | global | 调用 Tauri 的 open dialog + 打开文件 | ⭐⭐ 中等 |
| 7 | `saveFile` | global | 调用 Monaco 的保存逻辑或现有保存功能 | ⭐⭐ 中等 |
| 8 | `importData` | global | 调用 importStore 或现有导入功能 | ⭐⭐ 中等 |
| 9 | `undo` | global | 触发 document.execCommand('undo') 或 Monaco 内置 | ⭐ 简单 |
| 10 | `redo` | global | 触发 document.execCommand('redo') 或 Monaco 内置 | ⭐ 简单 |
| 11 | `copy` | global | 触发 document.execCommand('copy') | ⭐ 简单 |
| 12 | `paste` | global | 触发 document.execCommand('paste')（可能受限制） | ⭐ 简单 |
| 13 | `cut` | global | 触发 document.execCommand('cut') | ⭐ 简单 |
| 14 | `selectAll` | global | 触发 document.execCommand('selectAll') | ⭐ 简单 |

### ⚠️ 需要谨慎处理

| # | 快捷键 | 问题 | 方案 |
|---|--------|------|------|
| `saveAs` | global | 另存为功能可能未完全实现 | 如果没有现成功能，先不实现或做降级 |
| `exportData` | global | 导出功能较复杂 | 如果没有现成功能，先不实现 |
| `newProject` | global | 新建项目流程较复杂 | 如果没有现成功能，先不实现 |
| `paste` | global | 浏览器安全限制，document.execCommand 可能不工作 | 在可编辑元素中允许浏览器默认行为即可 |

## Functional Requirements

### FR-1: 编辑器作用域快捷键（4个）
- **描述**: 对接 Monaco 编辑器内置的查找、替换、跳转到行、切换注释功能
- **实现位置**: `src/components/sql/SQLEditor.tsx`
- **功能**:
  - `find` (Ctrl+F): 打开 Monaco 查找小部件
  - `replace` (Ctrl+H): 打开 Monaco 替换小部件
  - `goToLine` (Ctrl+G): 打开 Monaco 跳转到行对话框
  - `toggleComment` (Ctrl+/): 切换当前行或选中内容的注释
- **实现方式**: 通过 `editor.getAction('actions.find')` 等 Monaco API 调用内置命令
- **注意**: 这些是 editor 作用域，只在编辑器聚焦时生效

### FR-2: 全局文件操作快捷键（4个）
- **描述**: 对接文件新建、打开、保存、另存为功能
- **实现位置**: `src/context/ShortcutProvider.tsx`
- **功能**:
  - `newFile` (Ctrl+N): 新建一个 SQL 标签页（调用 workspaceStore.addTab）
  - `openFile` (Ctrl+O): 打开文件对话框，选择 SQL 文件并打开
  - `saveFile` (Ctrl+S): 保存当前文件（如果有文件名则直接保存，否则另存为）
  - `saveAs` (Ctrl+Shift+S): 另存为对话框
- **注意**:
  - 新建文件功能已存在（workspaceStore.addTab）
  - 打开/保存功能参考 Toolbar.tsx 中的实现
  - 保存功能需要判断当前标签类型，只对 SQL 标签有效

### FR-3: 全局导入导出快捷键（2个）
- **描述**: 对接数据导入导出功能
- **实现位置**: `src/context/ShortcutProvider.tsx`
- **功能**:
  - `importData` (Ctrl+I): 打开数据导入对话框或跳转到导入页面
  - `exportData` (Ctrl+E): 打开数据导出功能（如果存在）
- **注意**:
  - 导入功能参考 Toolbar.tsx 中的批量导入
  - 如果导出功能未完全实现，先标记为部分实现或不做
  - ⚠️ 注意与编辑器的 Ctrl+E（explainQuery）冲突问题，编辑器内 Ctrl+E 优先级更高

### FR-4: 全局编辑操作快捷键（6个）
- **描述**: 对接撤销、重做、复制、粘贴、剪切、全选
- **实现位置**: `src/context/ShortcutProvider.tsx`
- **功能**:
  - `undo` (Ctrl+Z): 撤销
  - `redo` (Ctrl+Y): 重做
  - `copy` (Ctrl+C): 复制
  - `paste` (Ctrl+V): 粘贴
  - `cut` (Ctrl+X): 剪切
  - `selectAll` (Ctrl+A): 全选
- **实现方式**:
  - 对于可编辑元素（输入框、编辑器等）：不拦截，让浏览器默认行为处理
  - 对于非编辑区域：使用 document.execCommand 或 Monaco API
  - 实际上，大部分编辑操作浏览器已经有默认行为
  - 我们主要是确保这些快捷键在设置中可配置，并且不会被意外阻止
- **注意**:
  - 这些操作浏览器默认就支持，我们的主要工作是"确保它们可用"
  - 在 Monaco 编辑器中，这些操作由 Monaco 自己处理（editor 作用域）
  - 在普通输入框中，浏览器默认行为已经支持
  - 全局快捷键 handler 可以简单到什么都不做，让浏览器处理

### FR-5: 全局项目操作快捷键（1个）
- **描述**: 对接新建项目功能
- **实现位置**: `src/context/ShortcutProvider.tsx`
- **功能**:
  - `newProject` (Ctrl+Shift+N): 新建项目
- **注意**:
  - 新建项目流程较复杂，如果没有现成的简单调用方式，先不实现
  - 可以标记为"部分实现"，框架保留，后续完善

### FR-6: 快捷键优先级与冲突处理
- **描述**: 确保各作用域快捷键的优先级正确
- **优先级（从高到低）**:
  1. 编辑器作用域快捷键（在编辑器聚焦时）
  2. 浏览器默认行为（在可编辑元素中）
  3. 全局快捷键
- **冲突处理**:
  - Ctrl+E 在编辑器中是 explainQuery，在全局是 exportData — 编辑器优先级更高，没问题
  - Ctrl+C/V/X/Z/Y/A 在编辑器中由 Monaco 处理，在全局由浏览器处理 — 都不拦截，让默认行为生效

## Non-Functional Requirements
- **NFR-1**: 向后兼容 — 默认快捷键与主流编辑器一致（VS Code 风格）
- **NFR-2**: 性能 — 快捷键响应延迟 < 50ms
- **NFR-3**: 可靠性 — 快捷键不会导致应用崩溃或数据丢失
- **NFR-4**: 可维护性 — 每个快捷键 handler 都是独立的，便于修改

## Constraints
- **技术**: React + TypeScript + Zustand + Monaco Editor + Tauri
- **架构**: 遵循前端三层架构
- **数据**: 不修改后端，不新增设置项
- **兼容性**: 不改变默认快捷键值

## Assumptions
- Monaco 编辑器可以通过 `editor.getAction(id).run()` 调用内置命令
- 浏览器默认的编辑操作（Ctrl+C/V/Z 等）在大多数场景下已经够用
- 新建文件可以通过 workspaceStore.addTab() 实现
- 打开/保存文件可以参考 Toolbar.tsx 中的实现

## Acceptance Criteria

### AC-1: 编辑器快捷键全部生效
- **Given**: 用户在 SQL 编辑器中
- **When**: 用户按 Ctrl+F / Ctrl+H / Ctrl+G / Ctrl+/
- **Then**: 分别触发查找 / 替换 / 跳转到行 / 切换注释
- **Verification**: `programmatic`

### AC-2: 全局文件操作快捷键生效
- **Given**: 用户在应用任意位置
- **When**: 用户按 Ctrl+N / Ctrl+O / Ctrl+S / Ctrl+Shift+S
- **Then**: 分别触发新建文件 / 打开文件 / 保存文件 / 另存为
- **Verification**: `programmatic`

### AC-3: 全局编辑快捷键可用
- **Given**: 用户在输入框或编辑器中
- **When**: 用户按 Ctrl+Z / Ctrl+Y / Ctrl+C / Ctrl+V / Ctrl+X / Ctrl+A
- **Then**: 正常触发撤销 / 重做 / 复制 / 粘贴 / 剪切 / 全选
- **Verification**: `programmatic`

### AC-4: 快捷键优先级正确
- **Given**: 用户在 SQL 编辑器中按 Ctrl+E
- **When**: 同时有编辑器作用域（explainQuery）和全局（exportData）的绑定
- **Then**: 触发编辑器作用域的 explainQuery，而不是全局的 exportData
- **Verification**: `programmatic`

### AC-5: 编译通过
- **Given**: 代码修改完成
- **When**: 执行 npx tsc 和 cargo check
- **Then**: 全部通过
- **Verification**: `programmatic`

## Open Questions
- [ ] saveAs / exportData / newProject 如果没有现成功能，是先不实现还是做简单版本？
- [ ] 全局编辑快捷键（Ctrl+C/V/Z 等）是否真的需要我们实现？浏览器默认行为已经够用了吧？

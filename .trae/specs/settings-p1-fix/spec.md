# 设置系统 P1 修复 - Product Requirement Document

## Overview
- **Summary**: 修复设置系统中的键名不一致问题和定义与使用脱节问题，包括：统一 insertSpaces/useSoftTabs 命名，修正 showLineNumbers 分类归属，补充 editor.showMinimap 和 editor.enableCodeFolding 设置项定义。
- **Purpose**: 解决设置系统中前后端键名不匹配、分类归属错误、缺少定义等问题，确保设置项的定义和实际使用一致，提升设置系统的可靠性和可维护性。
- **Target Users**: 所有使用设置功能的用户

## Goals
- G1: 统一 `insertSpaces` / `useSoftTabs` 命名，前后端一致
- G2: 修正 `showLineNumbers` 分类归属，从 sql 移到 editor
- G3: 补充 `editor.showMinimap` 设置项定义
- G4: 补充 `editor.enableCodeFolding` 设置项定义
- G5: 更新 `implemented_settings()` 标记，所有新增/修正项都正确标记为已实现

## Non-Goals (Out of Scope)
- ❌ 不修改设置项的实际功能逻辑
- ❌ 不新增任何新的功能
- ❌ 不修改 UI 布局或样式
- ❌ 不处理其他分类的设置项问题
- ❌ 不做数据库迁移（老数据库的 showLineNumbers 从 sql 移动到 editor 会丢失默认值，走降级路径）

## Background & Context
### 当前问题
1. **键名不一致**：后端 default_settings 用 `editor.insertSpaces`，前端 SQLEditor 用 `editor.useSoftTabs`
2. **分类错误**：`showLineNumbers` 在 sql 分类下，但语义上属于编辑器功能，且前端从 editor 分类读取
3. **缺少定义**：`editor.showMinimap` 和 `editor.enableCodeFolding` 在前端 SQLEditor 中被引用，但后端 default_settings 中没有定义

### 影响
- 用户修改了设置但不生效（因为键名不匹配）
- 设置项分类混乱，用户找不到对应功能
- 代码维护困难，容易出错

## Functional Requirements
- **FR-1**: `editor.insertSpaces` 键名前后端一致，前端从 `editor.insertSpaces` 读取
- **FR-2**: `showLineNumbers` 从 `sql` 分类移到 `editor` 分类
- **FR-3**: `editor.showMinimap` 设置项在后端有定义，默认值 `true`
- **FR-4**: `editor.enableCodeFolding` 设置项在后端有定义，默认值 `true`
- **FR-5**: 所有上述设置项都在 `implemented_settings()` 中标记为已实现
- **FR-6**: 多语言翻译中相关键名同步更新

## Non-Functional Requirements
- **NFR-1**: 老数据库兼容：缺少的设置项自动使用默认值（降级路径）
- **NFR-2**: 编译无错误：cargo check 和 tsc 均通过
- **NFR-3**: 不破坏现有功能：已生效的设置项继续正常工作

## Constraints
- **Technical**: Rust + TypeScript + Tauri + SQLite
- **Business**: 保持向后兼容，老数据库不丢失数据
- **Dependencies**: 无外部依赖

## Assumptions
- 老数据库中 `sql.showLineNumbers` 的值不迁移到 `editor.showLineNumbers`，用户需要重新设置（走默认值降级路径）
- `editor.showMinimap` 默认值为 `true`（与 appearance.minimap 配合使用）
- `editor.enableCodeFolding` 默认值为 `true`（Monaco Editor 默认行为）

## Acceptance Criteria

### AC-1: insertSpaces 键名统一
- **Given**: 用户打开设置界面的编辑器分类
- **When**: 修改"使用空格替代Tab"设置
- **Then**: SQLEditor 中的 insertSpaces 行为正确响应
- **Verification**: `programmatic`
- **Notes**: 检查前端代码中 useSetting('editor', 'insertSpaces') 而非 useSoftTabs

### AC-2: showLineNumbers 分类修正
- **Given**: 用户打开设置界面
- **When**: 查看编辑器分类
- **Then**: "显示行号"设置项出现在编辑器分类而非 SQL 分类
- **Verification**: `programmatic`
- **Notes**: default_settings 中 showLineNumbers 的 category 为 editor

### AC-3: showMinimap 设置项存在
- **Given**: 用户打开设置界面的编辑器分类
- **When**: 查看编辑器设置项列表
- **Then**: 存在"显示小地图"设置项，且可正常开关
- **Verification**: `human-judgment`
- **Notes**: 默认值为 true

### AC-4: enableCodeFolding 设置项存在
- **Given**: 用户打开设置界面的编辑器分类
- **When**: 查看编辑器设置项列表
- **Then**: 存在"启用代码折叠"设置项，且可正常开关
- **Verification**: `human-judgment`
- **Notes**: 默认值为 true

### AC-5: implemented_settings 准确
- **Given**: 所有设置项定义已更新
- **When**: 调用 get_settings_meta API
- **Then**: insertSpaces、showLineNumbers、showMinimap、enableCodeFolding 都标记为已实现
- **Verification**: `programmatic`
- **Notes**: implemented_settings() 中 set.insert 数量正确

### AC-6: 编译通过
- **Given**: 所有代码修改完成
- **When**: 运行 cargo check 和 tsc
- **Then**: 无错误
- **Verification**: `programmatic`

### AC-7: 老数据库兼容
- **Given**: 老数据库中没有 editor.showLineNumbers、editor.showMinimap、editor.enableCodeFolding
- **When**: 应用启动并读取设置
- **Then**: 自动使用默认值，不报错
- **Verification**: `programmatic`
- **Notes**: get_setting 返回 None 时使用默认值

## Open Questions
- [ ] Q1: 是否需要将老数据库中 `sql.showLineNumbers` 的值迁移到 `editor.showLineNumbers`？（当前假设：不需要，走默认值降级）

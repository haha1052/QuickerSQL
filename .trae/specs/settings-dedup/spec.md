# 设置系统去重优化 - Product Requirement Document

## Overview
- **Summary**: 删除设置系统中的重复设置项，合并 `tabSize` 和 `queryTimeout`/`query_timeout` 的重复定义，减少用户困惑，提升设置系统可维护性。
- **Purpose**: 解决设置系统中同一功能有多个入口的问题，避免用户困惑，降低维护成本。
- **Target Users**: 所有使用设置功能的用户

## Goals
- G1: 合并 `appearance.tabSize` 和 `editor.tabSize`，只保留 `editor.tabSize`
- G2: 统一查询超时设置命名，只保留 `database.queryTimeout`（移除 `performance.query_timeout`）
- G3: 前端代码同步更新引用
- G4: 老数据库兼容：自动迁移旧值，或读取时 fallback 到旧值

## Non-Goals (Out of Scope)
- ❌ 不新增任何新功能
- ❌ 不修改设置项的实际功能逻辑
- ❌ 不处理其他可能的重复项（本次只处理明确的 2 组）
- ❌ 不做数据库迁移脚本（通过代码层 fallback 兼容）

## Background & Context
### 当前重复项

| 重复项 1 | 位置 | 说明 |
|---------|------|------|
| appearance.tabSize | appearance 分类 | 前端 SQLEditor 实际使用这个 |
| editor.tabSize | editor 分类 | 语义上属于编辑器设置，但前端未使用 |

| 重复项 2 | 位置 | 说明 |
|---------|------|------|
| performance.query_timeout | performance 分类 | snake_case 命名，已实现 |
| database.queryTimeout | database 分类 | camelCase 命名，未实现 |

### 影响
- 用户困惑：同一个设置在两个地方出现，不知道改哪个
- 维护困难：修改一处容易忘记另一处
- 命名不一致：snake_case vs camelCase 混用

## Functional Requirements
- **FR-1**: `editor.tabSize` 成为唯一的 Tab 宽度设置
- **FR-2**: `database.queryTimeout` 成为唯一的查询超时设置（命名统一为 camelCase）
- **FR-3**: 前端 SQLEditor 从 `editor.tabSize` 读取 Tab 宽度
- **FR-4**: 老数据库兼容：读取 `editor.tabSize` 时如果不存在，fallback 到 `appearance.tabSize` 的值
- **FR-5**: 更新 `implemented_settings()` 标记，移除重复项

## Non-Functional Requirements
- **NFR-1**: 编译无错误：cargo check 和 tsc 均通过
- **NFR-2**: 向后兼容：老数据库用户的设置值不丢失
- **NFR-3**: 不破坏现有功能：已生效的设置项继续正常工作

## Constraints
- **Technical**: Rust + TypeScript + Tauri + SQLite
- **Business**: 保持向后兼容，老数据库不丢失数据
- **Dependencies**: 无外部依赖

## Assumptions
- 老数据库中 `appearance.tabSize` 的值通过代码层 fallback 迁移到 `editor.tabSize`
- 老数据库中 `performance.query_timeout` 的值通过代码层 fallback 迁移到 `database.queryTimeout`
- 用户不需要手动操作，自动兼容

## Acceptance Criteria

### AC-1: tabSize 去重
- **Given**: 用户打开设置界面
- **When**: 查看外观和编辑器分类
- **Then**: 只在 editor 分类中看到"Tab宽度"设置，appearance 分类中没有
- **Verification**: `programmatic`

### AC-2: queryTimeout 去重
- **Given**: 用户打开设置界面
- **When**: 查看性能和数据库分类
- **Then**: 只在 database 分类中看到"查询超时时间"设置，performance 分类中没有
- **Verification**: `programmatic`

### AC-3: 前端引用更新
- **Given**: SQLEditor 组件
- **When**: 读取 Tab 宽度设置
- **Then**: 从 `editor.tabSize` 读取，而非 `appearance.tabSize`
- **Verification**: `programmatic`

### AC-4: 老数据库兼容
- **Given**: 老数据库中只有 `appearance.tabSize`，没有 `editor.tabSize`
- **When**: 应用读取 Tab 宽度设置
- **Then**: 自动使用 `appearance.tabSize` 的值作为 fallback
- **Verification**: `programmatic`

### AC-5: implemented_settings 准确
- **Given**: 所有去重完成后
- **When**: 调用 get_settings_meta API
- **Then**: 不包含已删除的重复设置项
- **Verification**: `programmatic`

### AC-6: 编译通过
- **Given**: 所有代码修改完成
- **When**: 运行 cargo check 和 tsc
- **Then**: 无错误
- **Verification**: `programmatic`

## Open Questions
- [ ] Q1: 是否需要在用户第一次打开设置时自动将旧值写入新位置？（当前假设：只做读取 fallback，不主动写入）

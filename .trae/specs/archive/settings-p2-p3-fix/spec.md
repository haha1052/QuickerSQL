# 设置系统 P2/P3 修复 - Product Requirement Document

## Overview
- **Summary**: 根据设置系统现状分析报告 v21.0，实施 P2（安全分类、高级分类完善）和 P3（"只读不用"项落地）修复工作。
- **Purpose**: 让更多设置项真正生效，提升设置系统生效率。
- **Target Users**: 所有使用设置功能的用户

## Goals
- G1: 让 `formatOnSave` 设置项真正生效（保存时自动格式化 SQL）
- G2: 让 `autoExecute` 设置项真正生效（输入分号自动执行）
- G3: 让 `enableAutoRecover` 设置项真正生效（自动恢复未保存内容）
- G4: 让 `developerMode` 设置项真正生效（切换开发者模式）
- G5: 让 `showDebugInfo` 设置项真正生效（显示调试信息）
- G6: 更新 `implemented_settings()` 标记，新增已实现项

## Non-Goals (Out of Scope)
- ❌ 不实现密码保护功能（需要完整的后端认证系统）
- ❌ 不实现自动锁定功能（需要完整的会话管理）
- ❌ 不实现 `defaultSelectLimit`（需要修改 SQL 执行逻辑）
- ❌ 不新增设置项，只修复已有设置项的定义与使用

## Background & Context
### 当前问题
根据设置系统现状分析报告：

**sql 分类"只读不用"项**：
| 设置项 | 状态 | 说明 |
|--------|------|------|
| formatOnSave | 部分实现 | 有 Context 但无消费者 |
| autoExecute | 部分实现 | 有 Context 但无消费者 |
| defaultSelectLimit | 部分实现 | 有 Context 但无消费者 |
| enableAutoRecover | 部分实现 | 有 Context 但无消费者 |

**advanced 分类**：
| 设置项 | 状态 | 说明 |
|--------|------|------|
| developerMode | 部分实现 | AdvancedSettingsSync 读取但无消费者 |
| showDebugInfo | 部分实现 | AdvancedSettingsSync 读取但无消费者 |

### 影响
- 用户修改设置但不生效，影响用户体验
- 设置系统可信度下降

## Functional Requirements
- **FR-1**: `formatOnSave` 设置项在保存 SQL 时自动格式化
- **FR-2**: `autoExecute` 设置项在编辑器输入 `;` 时自动执行
- **FR-3**: `enableAutoRecover` 设置项启用自动恢复功能
- **FR-4**: `developerMode` 设置项切换开发者模式（控制台日志级别）
- **FR-5**: `showDebugInfo` 设置项控制调试信息显示
- **FR-6**: 所有上述设置项都在 `implemented_settings()` 中标记为已实现

## Non-Functional Requirements
- **NFR-1**: 编译无错误：cargo check 和 tsc 均通过
- **NFR-2**: 不破坏现有功能：已生效的设置项继续正常工作
- **NFR-3**: 用户感知提升：设置修改后能立即看到效果

## Constraints
- **Technical**: Rust + TypeScript + Tauri + Monaco Editor
- **Business**: 保持向后兼容，老数据库不丢失数据
- **Dependencies**: 无外部依赖

## Assumptions
- `formatOnSave` 在用户手动保存 SQL 时触发格式化
- `autoExecute` 在用户输入 `;` 并按 Enter 时触发执行
- `enableAutoRecover` 在编辑器失焦或应用崩溃时尝试恢复
- `developerMode` 通过 console.log 级别控制
- `showDebugInfo` 控制调试面板显示

## Acceptance Criteria

### AC-1: formatOnSave 生效
- **Given**: 用户启用"保存时自动格式化"设置
- **When**: 用户保存 SQL 文件
- **Then**: SQL 内容被自动格式化
- **Verification**: `programmatic`

### AC-2: autoExecute 生效
- **Given**: 用户启用"输入分号自动执行"设置
- **When**: 用户在编辑器输入 `;` 并按 Enter
- **Then**: SQL 自动执行
- **Verification**: `programmatic`

### AC-3: developerMode 生效
- **Given**: 用户启用"开发者模式"设置
- **When**: 用户打开开发者工具
- **Then**: 能看到更详细的日志信息
- **Verification**: `human-judgment`

### AC-4: showDebugInfo 生效
- **Given**: 用户启用"显示调试信息"设置
- **When**: 用户操作应用
- **Then**: 界面上显示调试面板或信息
- **Verification**: `human-judgment`

### AC-5: implemented_settings 准确
- **Given**: 所有设置项修复完成
- **When**: 调用 get_settings_meta API
- **Then**: 新增的已实现项正确标记
- **Verification**: `programmatic`

### AC-6: 编译通过
- **Given**: 所有代码修改完成
- **When**: 运行 cargo check 和 tsc
- **Then**: 无错误
- **Verification**: `programmatic`

## Open Questions
- [ ] Q1: autoExecute 的触发时机？（分号后立即执行 vs 分号+回车）
- [ ] Q2: formatOnSave 的格式化范围？（仅当前标签 vs 所有打开的 SQL）
- [ ] Q3: enableAutoRecover 的恢复逻辑？（自动恢复 vs 提示用户确认）

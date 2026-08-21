# 快捷键系统全面审计与修复 - Product Requirement Document

## Overview
- **Summary**: 全面审计当前快捷键系统，修复执行查询快捷键不生效的问题，验证所有快捷键是否真正可用，补充缺失的常用快捷键，建立可靠的快捷键验证机制。
- **Purpose**: 解决用户反馈的"执行查询快捷键不实际执行查询命令"问题，同时系统性检查所有快捷键的实际可用性，修复潜在问题，补充常用快捷键，提升用户操作效率。
- **Target Users**: 所有 QuickerSQL 用户，尤其是依赖快捷键提高工作效率的用户。

## Goals
- G1：定位并修复执行查询快捷键（Ctrl+Enter）不生效的核心问题
- G2：全面验证所有 20 个快捷键设置项是否真正生效，修复发现的问题
- G3：补充缺失的常用快捷键（如关闭标签、切换标签、运行全部等）
- G4：优化快捷键系统架构，消除命令注册与绑定的时序问题
- G5：建立快捷键调试日志，便于排查问题

## Non-Goals (Out of Scope)
- ❌ 不修改后端 Rust 代码（不新增设置项，只修复前端绑定问题）
- ❌ 不实现按键录制功能（仍使用文本输入方式）
- ❌ 不实现多套快捷键方案切换
- ❌ 不改变快捷键系统的核心架构（ShortcutManager 保持不变）

## Background & Context

### 当前现状
1. **ShortcutManager**：已建立完整的快捷键管理核心（`src/utils/shortcutManager.ts`）
2. **ShortcutProvider**：全局快捷键提供者，注册了 22 个全局命令（其中很多 handler 是空函数）
3. **SQLEditor**：编辑器内注册了 9 个编辑器作用域命令
4. **设置系统**：定义了 20 个快捷键设置项，支持在设置界面编辑

### 已发现的问题

**问题 1：执行查询快捷键可能不生效**
- 用户反馈 Ctrl+Enter 不实际执行查询
- 可能原因：命令注册与快捷键绑定的时序问题、作用域判断错误、快捷键解析不一致等

**问题 2：缺少 executeAll / explainQuery / explainAll 快捷键设置**
- SQLEditor 中读取了这些设置值（`executeAllShortcut`、`explainQueryShortcut`、`explainAllShortcut`）
- 但 `settings_service.rs` 的 `default_settings()` 中没有定义这些设置项
- 导致 `useSetting` 返回 undefined，快捷键永远不会被绑定

**问题 3：命令注册与绑定分散在两个 useEffect 中**
- SQLEditor.tsx 中，命令注册在一个 useEffect（第 315 行），快捷键绑定在另一个 useEffect（第 477 行）
- 存在时序不确定性，可能导致绑定时命令未注册
- 空 catch 块掩盖了绑定失败的错误

**问题 4：全局快捷键与编辑器快捷键命名混乱**
- 全局有 `executeQuery` 命令（空 handler）
- 编辑器有 `editor.executeQuery` 命令（有效 handler）
- 设置中的键名是 `executeQuery`，被绑定到两个不同的命令

**问题 5：缺少常用快捷键**
- 缺少关闭标签页（Ctrl+W）
- 缺少切换到下一个/上一个标签（Ctrl+Tab / Ctrl+Shift+Tab）
- 缺少新建标签页（Ctrl+T）
- 缺少运行全部 SQL（Ctrl+Shift+Enter）

**问题 6：缺少调试日志**
- 快捷键绑定失败时无任何错误提示
- 难以排查快捷键不生效的原因

## Functional Requirements

### FR-1: 修复执行查询快捷键不生效问题
- **描述**: 定位并修复 Ctrl+Enter 执行查询不生效的根本原因
- **关键修复点**:
  - 合并 SQLEditor 中的命令注册与快捷键绑定到同一个 useEffect
  - 确保命令先注册再绑定，顺序确定
  - 移除空 catch 块，添加错误日志
  - 验证 `isMonacoEditor` 检测逻辑是否正确
  - 验证快捷键解析（parseShortcut）与键盘事件转换（keyboardEventToKeyCode）的一致性
- **验证方法**: 在编辑器中按 Ctrl+Enter 能执行 SQL 查询

### FR-2: 补充缺失的快捷键设置项
- **描述**: 在设置系统中补充 SQLEditor 需要但未定义的快捷键
- **新增设置项**（后端 default_settings 与 implemented_settings 中补充）:
  - `executeAll` - 执行全部 SQL（默认 Ctrl+Shift+Enter）
  - `explainQuery` - 解释当前查询（默认 Ctrl+E）
  - `explainAll` - 解释全部查询（默认 Ctrl+Shift+E）
- **注意**: 确保这些设置项在设置界面正确显示

### FR-3: 全面验证所有快捷键有效性
- **描述**: 逐一验证所有 20+ 快捷键是否真正生效
- **验证清单**:
  - 编辑器作用域：executeQuery、executeAll、explainQuery、explainAll、formatSql、find、replace、goToLine、toggleComment
  - 全局作用域：newFile、openFile、saveFile、saveAs、newProject、importData、exportData、openSettings、explainPlan
  - 透传命令：undo、redo、copy、paste、cut、selectAll（确保不被意外阻止）
- **修复发现的所有问题**

### FR-4: 优化命令注册与绑定机制
- **描述**: 消除时序问题，提高可靠性
- **优化点**:
  - SQLEditor 中合并命令注册与快捷键绑定到同一个 useEffect
  - 绑定前检查命令是否已注册，未注册则先注册
  - 添加绑定成功/失败的日志（仅开发模式）
  - ShortcutProvider 中同理优化

### FR-5: 补充常用快捷键（可选增强）
- **描述**: 根据用户常用操作补充新的快捷键
- **新增快捷键候选**:
  - `closeTab` - 关闭当前标签页（默认 Ctrl+W）
  - `nextTab` - 切换到下一个标签（默认 Ctrl+Tab）
  - `prevTab` - 切换到上一个标签（默认 Ctrl+Shift+Tab）
  - `newTab` - 新建标签页（默认 Ctrl+T，与 newFile 合并或独立）
- **注意**: 新增快捷键须同时在后端设置定义和前端实现中同步添加

### FR-6: 添加快捷键调试支持
- **描述**: 添加开发模式下的快捷键调试日志
- **功能**:
  - 命令注册时日志（开发模式）
  - 快捷键绑定时日志（开发模式）
  - 快捷键触发时日志（开发模式）
  - 便于排查问题

## Non-Functional Requirements
- **NFR-1**: 可靠性：所有快捷键绑定失败时必须有日志，不能静默失败
- **NFR-2**: 性能：快捷键响应延迟 < 50ms
- **NFR-3**: 向后兼容：默认快捷键保持不变，用户无感升级
- **NFR-4**: 可维护性：新增快捷键只需 3 步（后端定义 + 前端注册 handler + 绑定）

## Constraints
- **技术**: React + TypeScript + Zustand + Monaco Editor + Tauri
- **架构**: 遵循前端三层架构，快捷键逻辑放在 utils 和 context 层
- **数据**: 新增快捷键设置项须同步更新后端 default_settings 和 implemented_settings
- **兼容性**: 不改变现有默认快捷键值

## Assumptions
- 执行查询快捷键不生效的主要原因是时序问题或绑定失败被静默忽略
- Monaco 编辑器的 `getAction()` API 可用于调用内置命令
- 新增快捷键设置项不会导致数据库迁移问题（设置系统使用 INSERT OR IGNORE）

## Acceptance Criteria

### AC-1: 执行查询快捷键修复
- **Given**: 用户在 SQL 编辑器中输入了 SQL 语句
- **When**: 用户按下 Ctrl+Enter
- **Then**: 执行当前光标所在语句或选中的 SQL，结果正确显示
- **Verification**: `human-judgment`

### AC-2: 所有编辑器快捷键生效
- **Given**: 用户在 SQL 编辑器中
- **When**: 用户按下对应快捷键
- **Then**: 
  - Ctrl+Enter → 执行当前语句
  - Ctrl+Shift+Enter → 执行全部 SQL
  - Ctrl+E → 解释当前语句
  - Ctrl+Shift+E → 解释全部 SQL
  - Ctrl+Shift+F → 格式化 SQL
  - Ctrl+F → 查找
  - Ctrl+H → 替换
  - Ctrl+G → 跳转到行
  - Ctrl+/ → 切换注释
- **Verification**: `human-judgment`

### AC-3: 所有全局快捷键生效
- **Given**: 用户在应用任意位置（非编辑器聚焦或全局快捷键场景）
- **When**: 用户按下对应快捷键
- **Then**:
  - Ctrl+N → 新建 SQL 标签
  - Ctrl+O → 打开文件对话框
  - Ctrl+S → 保存当前文件
  - Ctrl+, → 打开设置窗口
  - 其他全局快捷键按预期工作
- **Verification**: `human-judgment`

### AC-4: 快捷键设置新增项完整
- **Given**: 用户打开设置 → 快捷键分类
- **When**: 浏览所有快捷键项
- **Then**: 至少包含 executeAll、explainQuery、explainAll 三个新项，且都有默认值
- **Verification**: `programmatic`

### AC-5: 编译和类型检查通过
- **Given**: 代码修改完成
- **When**: 执行 npx tsc --noEmit
- **Then**: 0 errors
- **Verification**: `programmatic`

### AC-6: 无控制台错误
- **Given**: 用户使用快捷键过程中
- **When**: 打开浏览器开发者工具
- **Then**: 无快捷键相关的 JavaScript 错误
- **Verification**: `programmatic`

## Open Questions
- [ ] 是否需要新增关闭标签、切换标签等常用快捷键？（建议：是，提升用户体验）
- [ ] 全局快捷键中的 explainPlan 与编辑器的 explainQuery 是否有冲突？（Ctrl+E 优先级问题）
- [ ] 快捷键调试日志是否需要一个开关？（建议：开发模式默认开启，生产模式关闭）

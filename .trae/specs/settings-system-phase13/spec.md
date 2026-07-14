# Phase 13 设置功能接入深化 — Product Requirement Document

## Overview
- **Summary**: 继续扩展高优先级设置项接入，将生效比例从 70.2% 提升到 75%+，重点覆盖编辑器完善、SQL 查询完善、安全设置首批接入、高级设置深化四大任务。
- **Purpose**: 持续提升设置系统的实际生效比例，让用户可配置的选项越来越多地真正影响应用行为。
- **Target Users**: 所有 QuickerSQL 用户，尤其是对编辑器体验、查询功能有个性化需求的用户。

## Goals
- G1：新增 9 项设置接入，总生效数从 80 项提升到 89 项
- G2：总生效率从 70.2% 提升到 75%+（+5%+）
- G3：编辑器设置生效率从 92.3% 提升到 100%
- G4：SQL 查询设置生效率从 81.8% 提升到 100%
- G5：安全设置生效率从 50% 提升到 75%

## Non-Goals (Out of Scope)
- ❌ 不做快捷键设置（20 项），复杂度高，留待后续 Phase
- ❌ 不做安全设置的密码保护、加密等高级功能
- ❌ 不做高级设置的遥测、数据目录配置等复杂功能
- ❌ 不重构设置系统架构，保持现有元数据驱动架构不变

## Background & Context
- 当前设置系统共 114 项设置，已实现 80 项，生效率 70.2%
- Phase 12 已完成可视化、外观、数据库三大分类的完善（+6 项）
- 剩余未生效设置主要分布在：快捷键 20 项、高级 5 项、安全 4 项、编辑器 1 项、SQL 查询 2 项、自动化 2 项
- 本次 Phase 13 优先接入编辑器、SQL 查询、安全、高级四个分类，这些设置与用户核心体验直接相关

## Functional Requirements
- **FR-1**: 编辑器设置完善：新增 cursorBlinking（光标闪烁）、cursorStyle（光标样式）、renderWhitespace（显示空白字符）3 项接入
- **FR-2**: SQL 查询设置完善：新增 showLineNumbers（显示行号）、enableAutoRecover（自动恢复）2 项接入
- **FR-3**: 安全设置首批接入：新增 auditLogAutoClean（自动清理日志）、auditLogMaxSizeMB（日志大小限制）2 项接入
- **FR-4**: 高级设置深化：新增 maxConcurrentQueries（最大并发数）、checkForUpdates（自动检查更新）2 项接入
- **FR-5**: 所有新增设置项在设置界面正确显示，修改后立即生效
- **FR-6**: 所有新增设置项持久化存储，重启应用后保留

## Non-Functional Requirements
- **NFR-1**: 设置修改后 UI 响应时间 < 100ms（不阻塞主线程）
- **NFR-2**: 不引入任何新的依赖包
- **NFR-3**: 代码符合项目现有架构分层和编码规范

## Constraints
- **Technical**: 遵循现有元数据驱动架构，后端定义设置元数据，前端动态渲染
- **Business**: 本次为渐进式优化，不改变用户现有使用习惯
- **Dependencies**: 依赖现有 SettingsContext、settingsStore、settings_service.rs 等基础设施

## Assumptions
- Monaco Editor 已支持 cursorBlinking、cursorStyle、renderWhitespace 配置，只需接入设置读取
- SQL 编辑器已支持 showLineNumbers 配置，只需接入设置读取
- enableAutoRecover 只需先接入设置项定义，实际功能可后续迭代
- auditLogAutoClean 和 auditLogMaxSizeMB 只需先接入设置项定义，实际自动清理功能可后续迭代

## Acceptance Criteria

### AC-1: 编辑器 cursorBlinking 设置接入
- **Given**: 用户打开设置界面的编辑器分类
- **When**: 用户修改 cursorBlinking 选择值
- **Then**: 编辑器光标闪烁方式立即改变
- **Verification**: `human-judgment`
- **Notes**: 选项值：blink、smooth、phase、expand

### AC-2: 编辑器 cursorStyle 设置接入
- **Given**: 用户打开设置界面的编辑器分类
- **When**: 用户修改 cursorStyle 选择值
- **Then**: 编辑器光标样式立即改变
- **Verification**: `human-judgment`
- **Notes**: 选项值：line、block、underline、vertical

### AC-3: 编辑器 renderWhitespace 设置接入
- **Given**: 用户打开设置界面的编辑器分类
- **When**: 用户修改 renderWhitespace 选择值
- **Then**: 编辑器空白字符显示方式立即改变
- **Verification**: `human-judgment`
- **Notes**: 选项值：none、boundary、all

### AC-4: SQL 查询 showLineNumbers 设置接入
- **Given**: 用户打开设置界面的 SQL 查询分类
- **When**: 用户切换 showLineNumbers 开关
- **Then**: SQL 编辑器行号显示/隐藏立即改变
- **Verification**: `human-judgment`

### AC-5: SQL 查询 enableAutoRecover 设置接入
- **Given**: 用户打开设置界面的 SQL 查询分类
- **When**: 用户切换 enableAutoRecover 开关
- **Then**: 设置项正确显示并持久化保存（实际自动恢复功能后续迭代）
- **Verification**: `programmatic`
- **Notes**: 验证设置项能正确保存和读取

### AC-6: 安全 auditLogAutoClean 设置接入
- **Given**: 用户打开设置界面的安全分类
- **When**: 用户切换 auditLogAutoClean 开关
- **Then**: 设置项正确显示并持久化保存（实际自动清理功能后续迭代）
- **Verification**: `programmatic`
- **Notes**: 验证设置项能正确保存和读取

### AC-7: 安全 auditLogMaxSizeMB 设置接入
- **Given**: 用户打开设置界面的安全分类
- **When**: 用户修改 auditLogMaxSizeMB 数值
- **Then**: 设置项正确显示并持久化保存（实际大小限制功能后续迭代）
- **Verification**: `programmatic`
- **Notes**: 数值范围 100-5000MB，步进 100MB

### AC-8: 高级 maxConcurrentQueries 设置接入
- **Given**: 用户打开设置界面的高级分类
- **When**: 用户修改 maxConcurrentQueries 数值
- **Then**: 设置项正确显示并持久化保存（实际并发控制后续迭代）
- **Verification**: `programmatic`
- **Notes**: 数值范围 1-20，步进 1

### AC-9: 高级 checkForUpdates 设置接入
- **Given**: 用户打开设置界面的高级分类
- **When**: 用户切换 checkForUpdates 开关
- **Then**: 设置项正确显示并持久化保存（实际更新检查后续迭代）
- **Verification**: `programmatic`
- **Notes**: 验证设置项能正确保存和读取

### AC-10: 编译与类型检查通过
- **Given**: 代码修改完成
- **When**: 执行 cargo check 和 npx tsc
- **Then**: 无任何错误
- **Verification**: `programmatic`

### AC-11: 安全与架构规范合规
- **Given**: 代码修改完成
- **When**: 执行 SQL 注入检测、敏感字符串检测、架构分层检测
- **Then**: 全部通过，无违规
- **Verification**: `programmatic`

## Open Questions
- [ ] Q1：enableAutoRecover 是否需要在本阶段实现实际的自动恢复功能？（暂定只接入设置项，功能留待后续）
- [ ] Q2：auditLogAutoClean 和 auditLogMaxSizeMB 是否需要在本阶段实现实际的自动清理功能？（暂定只接入设置项，功能留待后续）

# Phase 12 设置功能接入深化 — Product Requirement Document

## Overview
- **Summary**: 继续扩展高优先级设置项接入，将生效比例从 67.3% 提升到 72.8%，重点覆盖可视化完善、外观完善、数据库完善三大任务。
- **Purpose**: 持续提升设置系统的实际生效比例，让用户可配置的选项越来越多地真正影响应用行为。
- **Target Users**: 所有 QuickerSQL 用户，尤其是对图表可视化、编辑器外观有个性化需求的用户。

## Goals
- G1：新增 6 项设置接入，总生效数从 74 项提升到 80 项
- G2：总生效率从 67.3% 提升到 72.8%（+5.5%）
- G3：可视化设置生效率从 70% 提升到 100%
- G4：外观设置生效率从 75% 提升到 100%
- G5：数据库设置生效率从 83.3% 提升到 100%

## Non-Goals (Out of Scope)
- ❌ 不做快捷键设置（20 项），复杂度高，留待后续 Phase
- ❌ 不做安全设置的密码保护、加密等高级功能
- ❌ 不做高级设置的遥测、自动更新等功能
- ❌ 不重构设置系统架构，保持现有元数据驱动架构不变

## Background & Context
- 当前设置系统共 114 项设置，已实现 74 项，生效率 67.3%
- Phase 11 已完成编辑器、SQL 查询、数据导入、高级、缓存五大分类的深化接入
- 剩余未生效设置主要分布在：可视化 3 项、外观 2 项、数据库 1 项、安全 4 项、高级 5 项、快捷键 20 项、编辑器 1 项、SQL 查询 2 项
- 本次 Phase 12 优先接入可视化、外观、数据库三个分类，这些设置与用户核心体验直接相关，且接入成本较低

## Functional Requirements
- **FR-1**: 可视化设置新增 animationDuration、toolboxFeature、dataZoom 3 项接入，分别控制动画时长、工具箱显示、数据区域缩放
- **FR-2**: 外观设置新增 minimap、smoothScrolling 2 项接入，分别控制编辑器小地图显示和平滑滚动
- **FR-3**: 数据库设置新增 enableExplainPlan 1 项接入，控制是否启用执行计划功能
- **FR-4**: 所有新增设置项在设置界面正确显示，修改后立即生效
- **FR-5**: 所有新增设置项持久化存储，重启应用后保留

## Non-Functional Requirements
- **NFR-1**: 设置修改后 UI 响应时间 < 100ms（不阻塞主线程）
- **NFR-2**: 不引入任何新的依赖包
- **NFR-3**: 代码符合项目现有架构分层和编码规范

## Constraints
- **Technical**: 遵循现有元数据驱动架构，后端定义设置元数据，前端动态渲染
- **Business**: 本次为渐进式优化，不改变用户现有使用习惯
- **Dependencies**: 依赖现有 SettingsContext、settingsStore、settings_service.rs 等基础设施

## Assumptions
- 图表组件已经支持 animationDuration、toolbox、dataZoom 配置，只需接入设置读取
- Monaco Editor 已经支持 minimap 和 smoothScrolling 配置，只需接入设置读取
- enableExplainPlan 只需先接入设置项定义，实际功能可后续迭代

## Acceptance Criteria

### AC-1: 可视化 animationDuration 设置接入
- **Given**: 用户打开设置界面的可视化分类
- **When**: 用户修改 animationDuration 数值
- **Then**: 图表动画时长立即改变，刷新图表可见效果变化
- **Verification**: `human-judgment`
- **Notes**: 数值范围 100-5000ms，步进 100ms

### AC-2: 可视化 toolboxFeature 设置接入
- **Given**: 用户打开设置界面的可视化分类
- **When**: 用户切换 toolboxFeature 开关
- **Then**: 图表工具箱（保存、刷新等）显示/隐藏立即改变
- **Verification**: `human-judgment`

### AC-3: 可视化 dataZoom 设置接入
- **Given**: 用户打开设置界面的可视化分类
- **When**: 用户切换 dataZoom 开关
- **Then**: 图表底部数据区域缩放条显示/隐藏立即改变
- **Verification**: `human-judgment`

### AC-4: 外观 minimap 设置接入
- **Given**: 用户打开设置界面的外观分类
- **When**: 用户切换 minimap 开关
- **Then**: 编辑器右侧小地图显示/隐藏立即改变
- **Verification**: `human-judgment`

### AC-5: 外观 smoothScrolling 设置接入
- **Given**: 用户打开设置界面的外观分类
- **When**: 用户切换 smoothScrolling 开关
- **Then**: 编辑器滚动动画平滑/立即改变
- **Verification**: `human-judgment`

### AC-6: 数据库 enableExplainPlan 设置接入
- **Given**: 用户打开设置界面的数据库分类
- **When**: 用户切换 enableExplainPlan 开关
- **Then**: 设置项正确显示并持久化保存（实际执行计划功能后续迭代）
- **Verification**: `programmatic`
- **Notes**: 验证设置项能正确保存和读取

### AC-7: 编译与类型检查通过
- **Given**: 代码修改完成
- **When**: 执行 cargo check 和 npx tsc
- **Then**: 无任何错误
- **Verification**: `programmatic`

### AC-8: 安全与架构规范合规
- **Given**: 代码修改完成
- **When**: 执行 SQL 注入检测、敏感字符串检测、架构分层检测
- **Then**: 全部通过，无违规
- **Verification**: `programmatic`

## Open Questions
- [ ] Q1：enableExplainPlan 是否需要在本阶段实现实际的执行计划功能？（暂定只接入设置项，功能留待后续）

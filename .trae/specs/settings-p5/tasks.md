# 设置系统 P5 阶段 - The Implementation Plan (Decomposed and Prioritized Task List)

## [x] Task 1: 修正报告数据错误（3 项从"部分实现"升级为"已实现"）
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 核查 editor.autoSave、editor.saveInterval、database.connectionTimeout 的实际实现状态
  - 更新设置系统现状分析报告 v29.0 中的统计数据
  - editor 分类：16 项全部实现（87.5%→100%）
  - database 分类：6 项全部实现（83.3%→100%）
  - 总体生效率：96.4%→99.1%（110/111）
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `human-judgement` TR-1.1: 报告中 editor 分类 100%，database 分类 100%
  - `human-judgement` TR-1.2: 3 项设置项描述准确，有代码引用佐证

## [x] Task 2: 实现 cache.cacheStrategy 多策略支持
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 在 query_cache_service.rs 中支持多种缓存策略
  - 策略选项：lru（默认，当前 LRU 策略）、none（不缓存）
  - 从设置中读取 cacheStrategy 并应用
  - 策略切换时清除现有缓存（可选）
  - 更新 settings_service.rs 中 cacheStrategy 的可选值（从 memory/disk/hybrid 改为 lru/none，或保留原选项但调整行为）
- **Acceptance Criteria Addressed**: AC-2, AC-3
- **Test Requirements**:
  - `programmatic` TR-2.1: cargo check --quiet 无错误
  - `programmatic` TR-2.2: 缓存服务支持策略配置接口
  - `human-judgement` TR-2.3: lru 策略正常工作，none 策略不缓存

## [x] Task 3: 前端接入 cache.cacheStrategy
- **Priority**: medium
- **Depends On**: Task 2
- **Description**: 
  - 前端调用缓存统计/配置接口时传递策略
  - 或者通过设置变更触发后端重新配置缓存策略
  - 确保设置修改后立即生效
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `programmatic` TR-3.1: npx tsc --noEmit --pretty 无错误
  - `human-judgement` TR-3.2: 设置中切换 cacheStrategy 后缓存行为变化

## [x] Task 4: 更新 implemented_settings() 标记
- **Priority**: high
- **Depends On**: Task 2
- **Description**: 
  - 确认 settings_service.rs 中 implemented_settings() 已包含 cache.cacheStrategy
  - 如未包含则添加
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `programmatic` TR-4.1: grep 统计 set.insert 数量 = 111

## [x] Task 5: 更新设置系统现状分析报告到 v29.0
- **Priority**: high
- **Depends On**: Task 1, Task 2, Task 3, Task 4
- **Description**: 
  - 更新版本号为 v29.0
  - 更新总体统计：111 项全部实现，生效率 100%
  - 更新各分类实现率排名：14 个分类全部 100%
  - 更新重点问题清单：无剩余问题（全部解决）
  - 更新下一步行动计划：设置系统全面完成，进入维护阶段
  - 添加版本变更记录
- **Acceptance Criteria Addressed**: AC-4, AC-6
- **Test Requirements**:
  - `human-judgement` TR-5.1: 报告版本号 v29.0
  - `human-judgement` TR-5.2: 生效率 100%，14 个分类全部 100%
  - `human-judgement` TR-5.3: 版本变更记录完整

## [x] Task 6: 最终验证
- **Priority**: high
- **Depends On**: Task 5
- **Description**: 
  - Rust 编译检查：cargo check --quiet
  - TypeScript 类型检查：npx tsc --noEmit --pretty
  - SQL 注入检测
  - 敏感字符串检测
  - 所有门禁命令通过
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `programmatic` TR-6.1: cargo check --quiet 无错误
  - `programmatic` TR-6.2: npx tsc --noEmit --pretty 无错误
  - `programmatic` TR-6.3: SQL 注入检测 0 匹配
  - `programmatic` TR-6.4: 敏感字符串检测 0 匹配

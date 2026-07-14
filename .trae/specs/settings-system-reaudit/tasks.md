# 设置系统现状重新梳理 - The Implementation Plan

## [x] Task 1: 修正 implemented_settings() 函数
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 重新定义 `implemented_settings()` 函数，只包含真正有功能实现的设置项
  - 判断标准：设置值的变化确实会影响应用行为
  - 从 111 项缩减到约 55 项真正已实现的
- **Acceptance Criteria Addressed**: AC-1, AC-4
- **Test Requirements**:
  - `programmatic` TR-1.1: cargo check --quiet 无错误
  - `programmatic` TR-1.2: implemented_settings() 返回的数量与真实已实现数量一致
  - `human-judgement` TR-1.3: 每个设置项的状态判断准确，有代码依据
- **Notes**: 这是 P0 级问题，错误标记会误导用户

## [x] Task 2: 重新撰写设置系统现状分析报告
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - 基于真实状态完全重写分析报告
  - 包含准确的统计数据：已实现 55 项 (49.5%)、部分实现 13 项 (11.7%)、未实现 43 项 (38.7%)
  - 各分类详细分析表
  - 重点问题清单（快捷键空壳、设置项键名不一致、只读不用等）
  - 优先级建议
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `human-judgement` TR-2.1: 统计数据准确，与代码实际情况一致
  - `human-judgement` TR-2.2: 重点问题描述清晰，有代码依据
- **Notes**: 报告版本号从 v15.0 升级到 v16.0

## [x] Task 3: 快捷键设置实施难度分析
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 分析 20 个快捷键设置的实施技术方案
  - 方案对比：Monaco 内置快捷键 vs 自定义全局快捷键系统
  - 工作量估算
  - 风险点分析
  - 分阶段实施建议（Phase 1: 核心快捷键，Phase 2: 全局快捷键）
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `human-judgement` TR-3.1: 技术方案可行，有明确实现路径
  - `human-judgement` TR-3.2: 工作量估算合理
- **Notes**: 回答用户"快捷键为什么不实施"的疑问

## [x] Task 4: 编译验证
- **Priority**: medium
- **Depends On**: Task 1
- **Description**:
  - 执行 cargo check 验证 Rust 编译
  - 执行 npx tsc 验证 TypeScript 类型
  - 执行安全检测（SQL 注入、敏感字符串）
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `programmatic` TR-4.1: cargo check --quiet 无错误
  - `programmatic` TR-4.2: npx tsc --noEmit --pretty 无错误

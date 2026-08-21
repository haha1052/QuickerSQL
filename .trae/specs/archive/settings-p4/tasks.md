# Tasks

- [x] Task 1: 修正报告数据错误 — 基于代码实际核查修正 v27.0 报告中的矛盾数据
  - **Priority**: high
  - **Description**: 
    - 修正 sql 分类统计（formatOnSave/autoExecute/enableAutoRecover 已实现）
    - 修正 editor 分类统计（trimTrailingWhitespace 已实现、autoSave 已部分实现）
    - 修正 appearance 分类统计（lineHeight 已实现）
    - 修正各分类实现率排名
    - 更新重点问题清单，移除已解决的问题
  - **Acceptance Criteria Addressed**: AC-1
  - **Test Requirements**:
    - `human-judgement` TR-1.1: 报告数据与代码实际状态一致
    - `human-judgement` TR-1.2: 各分类数字加总正确，无矛盾

- [x] Task 2: 实现 security.enableAuditLog — 审计日志开关
  - **Priority**: high
  - **Description**: 
    - 在 audit_log_service.rs 中添加开关检查
    - enableAuditLog=false 时不写入审计日志
    - 从 settings_service 读取设置值
  - **Acceptance Criteria Addressed**: AC-2
  - **Test Requirements**:
    - `programmatic` TR-2.1: cargo check --quiet 无错误
    - `human-judgement` TR-2.2: 审计日志函数在开关关闭时返回 early

- [x] Task 3: 实现 advanced.logLevel — 日志级别控制
  - **Priority**: medium
  - **Description**: 
    - 在前端 logger.ts 中添加 logLevel 过滤
    - 支持 debug/info/warn/error 四级
    - 从设置读取当前级别
  - **Acceptance Criteria Addressed**: AC-3
  - **Test Requirements**:
    - `programmatic` TR-3.1: npx tsc --noEmit --pretty 无错误
    - `human-judgement` TR-3.2: logger 函数根据 level 过滤输出

- [x] Task 4: 实现 editor.insertSpaces — 空格替代 Tab
  - **Priority**: medium
  - **Description**: 
    - 在 SQLEditor.tsx 中传入 insertSpaces 配置到 Monaco
    - 确认键名与后端一致（insertSpaces）
  - **Acceptance Criteria Addressed**: AC-4
  - **Test Requirements**:
    - `programmatic` TR-4.1: npx tsc --noEmit --pretty 无错误
    - `human-judgement` TR-4.2: Monaco 编辑器配置中包含 insertSpaces

- [x] Task 5: 实现 sql.defaultSelectLimit — 默认 SELECT 行数限制限制
  - **Priority**: medium
  - **Description**: 
    - 在 SQL 执行前检查是否为 SELECT 语句且无 LIMIT
    - 如果 defaultSelectLimit > 0，自动追加 LIMIT 子句
    - 在 useQueryExecution.ts 或 sql_service.rs 中实现
  - **Acceptance Criteria Addressed**: AC-5
  - **Test Requirements**:
    - `programmatic` TR-5.1: cargo check --quiet 无错误
    - `programmatic` TR-5.2: npx tsc --noEmit --pretty 无错误

- [x] Task 6: 更新 implemented_settings() 标记
  - **Priority**: high
  - **Depends On**: Task 2, Task 3, Task 4, Task 5
  - **Description**: 在 settings_service.rs 的 implemented_settings() 中更新新增实现的设置项标记
  - **Acceptance Criteria Addressed**: AC-6
  - **Test Requirements**:
    - `programmatic` TR-6.1: cargo check --quiet 无错误

- [x] Task 7: 更新设置系统现状分析报告到 v28.0
  - **Priority**: high
  - **Depends On**: Task 1, Task 6
  - **Description**: 更新报告版本到 v28.0，更新统计数据、各分类实现率排名、下一步行动计划
  - **Acceptance Criteria Addressed**: AC-7
  - **Test Requirements**:
    - `human-judgement` TR-7.1: 报告版本号已更新为 v28.0
    - `human-judgement` TR-7.2: 各分类实现率已更新且数字一致

# Task Dependencies
- Task 6 depends on Task 2, Task 3, Task 4, Task 5
- Task 7 depends on Task 1, Task 6

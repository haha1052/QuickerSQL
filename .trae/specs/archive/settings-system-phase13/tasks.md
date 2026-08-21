# Phase 13 设置功能接入深化 — 任务分解

## 任务列表

- [x] Task 1: 编辑器设置完善（3 项）
  - [x] SubTask 1.1: 在 SQLEditor.tsx 中接入 cursorBlinking 设置
  - [x] SubTask 1.2: 在 SQLEditor.tsx 中接入 cursorStyle 设置
  - [x] SubTask 1.3: 在 SQLEditor.tsx 中接入 renderWhitespace 设置
  - [x] SubTask 1.4: 验证编辑器 3 项设置功能正常
  - **Test Requirements**:
    - `human-judgment`: 打开设置界面编辑器分类，确认 3 项设置显示正常，修改后编辑器行为改变

- [ ] Task 2: SQL 查询设置完善（2 项）
  - [x] SubTask 2.1: 在 SQLEditor.tsx 中接入 showLineNumbers 设置
  - [x] SubTask 2.2: 在 settings_service.rs 中确认 enableAutoRecover 定义存在
  - [x] SubTask 2.3: 验证 SQL 查询 2 项设置功能正常
  - **Test Requirements**:
    - `human-judgment`: 打开设置界面 SQL 查询分类，确认 2 项设置显示正常
    - `programmatic`: 通过 Tauri invoke 验证设置项可正确保存和读取

- [x] Task 3: 安全设置首批接入（2 项）
  - [x] SubTask 3.1: 在 settings_service.rs 中确认 auditLogAutoClean 定义存在
  - [x] SubTask 3.2: 在 settings_service.rs 中确认 auditLogMaxSizeMB 定义存在
  - [x] SubTask 3.3: 验证安全设置 2 项在设置界面正确显示
  - **Test Requirements**:
    - `human-judgment`: 打开设置界面安全分类，确认 2 项设置显示正常
    - `programmatic`: 通过 Tauri invoke 验证设置项可正确保存和读取

- [x] Task 4: 高级设置深化（2 项）
  - [x] SubTask 4.1: 在 settings_service.rs 中确认 maxConcurrentQueries 定义存在
  - [x] SubTask 4.2: 在 settings_service.rs 中确认 checkForUpdates 定义存在
  - [x] SubTask 4.3: 验证高级设置 2 项在设置界面正确显示
  - **Test Requirements**:
    - `human-judgment`: 打开设置界面高级分类，确认 2 项设置显示正常
    - `programmatic`: 通过 Tauri invoke 验证设置项可正确保存和读取

- [ ] Task 5: 编译验证与安全检测
  - [ ] SubTask 5.1: 执行 cargo check 验证 Rust 编译通过
  - [ ] SubTask 5.2: 执行 npx tsc 验证 TypeScript 类型通过
  - [ ] SubTask 5.3: 执行 SQL 注入检测
  - [ ] SubTask 5.4: 执行敏感字符串检测
  - [ ] SubTask 5.5: 更新 implemented_settings() 标记新增 9 项为已实现
  - **Test Requirements**:
    - `programmatic`: cargo check 无错误
    - `programmatic`: npx tsc 无类型错误
    - `programmatic`: SQL 注入检测 Count = 0
    - `programmatic`: 敏感字符串检测 Count = 0

- [x] Task 6: 更新设置系统现状分析报告
  - [x] SubTask 6.1: 更新 Phase 13 完成统计
  - [x] SubTask 6.2: 更新分类生效率数据
  - [x] SubTask 6.3: 制定 Phase 14 规划
  - **Test Requirements**:
    - `programmatic`: 验证文档格式正确，内容完整

## 任务依赖关系

```
Task 1 (编辑器设置) ──────┐
                          │
Task 2 (SQL查询设置) ─────┼──▶ Task 5 (验证) ──▶ Task 6 (报告)
                          │
Task 3 (安全设置) ────────┤
                          │
Task 4 (高级设置) ────────┘
```

## 预估工作量

- Task 1: 编辑器设置（3 项）— 中等复杂度，约 1-2 小时
- Task 2: SQL 查询设置（2 项）— 低复杂度，约 0.5-1 小时
- Task 3: 安全设置（2 项）— 低复杂度，约 0.5-1 小时
- Task 4: 高级设置（2 项）— 低复杂度，约 0.5-1 小时
- Task 5: 编译验证 — 快速，约 10 分钟
- Task 6: 更新报告 — 快速，约 15 分钟

**总计**: 约 3-5 小时

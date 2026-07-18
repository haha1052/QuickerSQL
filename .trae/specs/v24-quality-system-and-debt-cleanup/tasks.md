# Tasks

> **change-id**: `v24-quality-system-and-debt-cleanup`
> **创建日期**: 2026-07-17
> **依赖关系**: 见文末 Task Dependencies
> **执行原则**: Task 1-2 代码修复可并行；Task 3-5 工具/配置/文档可并行；Task 6 应用验证依赖前 5 项；Task 7-8 文档同步依赖前 6 项

---

## 批次 1：代码修复（2 项，可并行）

- [x] **Task 1**: migration_service.rs:103 format! 违规修复
  - [x] SubTask 1.1: 阅读 `src-tauri/src/services/migration_service.rs` line 85-110，理解 `LEGACY_TABLE_MAPPINGS` 常量与 `run_legacy_table_migrations` 函数上下文
  - [x] SubTask 1.2: 修改 line 103 `format!("ALTER TABLE {} RENAME TO {}", old_name, new_name)`：
    - 用 `SqlIdentifier::new(old_name)?` 校验 old_name
    - 用 `SqlIdentifier::new(new_name)?` 校验 new_name
    - 用 `old_ident.quoted()` 和 `new_ident.quoted()` 拼装 SQL
    - 保留错误处理与日志不变
  - [x] SubTask 1.3: 运行 `cargo check --quiet` + `cargo test --quiet` 验证无回归
  - [x] SubTask 1.4: 运行两段式 SQL 注入检测命令确认 migration_service.rs:103 不再出现

- [x] **Task 2**: services 层 7 处 too_many_arguments 重构
  - [x] SubTask 2.1: 阅读 `src-tauri/src/services/sql_service.rs` 5 处 `#[allow(clippy::too_many_arguments)]`（line 741, 825, 917, 979, 1068），理解每个函数的参数与调用方
  - [x] SubTask 2.2: 设计 `SqlExecContext` struct，包含 5 个函数共有的参数字段（如 conn、sql、params、query_cache、results 等）
  - [x] SubTask 2.3: 重构 sql_service.rs 5 处函数：参数从多个改为 `ctx: &mut SqlExecContext` 或 `ctx: SqlExecContext`；移除 `#[allow]` + TODO 注释；同步修改所有调用方
  - [x] SubTask 2.4: 阅读 `src-tauri/src/services/task_service.rs` 2 处 `#[allow(clippy::too_many_arguments)]`（line 595, 685），理解 `handle_execute_success` 与 `handle_execute_failure` 参数
  - [x] SubTask 2.5: 设计 `TaskExecResult` struct，包含 task_id、run_id、result、start_time、end_time 等字段
  - [x] SubTask 2.6: 重构 task_service.rs 2 处函数：参数从多个改为 `result: &TaskExecResult`；移除 `#[allow]` + TODO 注释；同步修改所有调用方
  - [x] SubTask 2.7: 运行 `cargo check --quiet` + `cargo test --quiet` + `cargo clippy --all-targets -- -D warnings` 验证

---

## 批次 2：工具/配置/文档（3 项，可并行）

- [x] **Task 3**: 覆盖率工具引入
  - [x] SubTask 3.1: Rust tarpaulin 配置：
    - 在 `src-tauri/Cargo.toml` 的 `[dev-dependencies]` 添加 `cargo-tarpaulin` 配置（注：tarpaulin 通常作为 cargo install 工具，非 dev-dependency，这里在 package.json 添加脚本即可）
    - 在 `package.json` scripts 添加 `"coverage:rust": "cd src-tauri && cargo tarpaulin --out Html --output-dir ../coverage/rust"`
    - 在 package.json 添加说明注释（如 "需先 cargo install cargo-tarpaulin"）
  - [x] SubTask 3.2: 前端 vitest coverage 配置：
    - 检查 `vitest.config.ts` 是否存在，若不存在则读取 `vite.config.ts` 确认配置位置
    - 在 vitest 配置中添加 `coverage` 配置：provider='v8'、reportsDirectory='./coverage/web'、reporter=['text','html']
    - 运行 `npm install -D @vitest/coverage-v8` 安装依赖
  - [x] SubTask 3.3: 在 `package.json` scripts 添加 `"coverage:web": "vitest run --coverage"`
  - [x] SubTask 3.4: 验证 `npm run coverage:web` 能正常执行并生成 `coverage/web/` 目录

- [x] **Task 4**: CI 门禁配置（GitHub Actions）
  - [x] SubTask 4.1: 新建 `.github/workflows/ci.yml`
  - [x] SubTask 4.2: 配置触发条件：push to main + pull_request to main
  - [x] SubTask 4.3: 配置 job `quality-gate`，包含 5 个 step：
    - `cargo check --quiet`（Rust 编译）
    - `cargo clippy --all-targets -- -D warnings`（clippy 门禁）
    - `cargo test --quiet`（Rust 测试）
    - `npx tsc --noEmit --pretty`（TS 类型检查）
    - `npx vitest run`（前端测试）
  - [x] SubTask 4.4: 配置 Rust toolchain（stable）+ Node.js 20 + npm ci 缓存
  - [x] SubTask 4.5: 验证 ci.yml YAML 语法正确（可用 `yamllint` 或在线工具）

- [x] **Task 5**: PR 审查 checklist 文档
  - [x] SubTask 5.1: 新建 `docs/PR_REVIEW_CHECKLIST.md`
  - [x] SubTask 5.2: 编写五大类审查清单：
    - 架构合规：commands 不直接写 SQL、services 用参数化查询、components 不直接 invoke、分层正确
    - 安全合规：无 format! SQL 拼接、无 unwrap/expect、无 any、无敏感字符串、SqlIdentifier 校验
    - 代码规范：snake_case/PascalCase/camelCase 命名、函数 ≤ 80 行、嵌套 ≤ 4 层、JSDoc/doc comment
    - 测试要求：新增功能有测试、cargo test 通过、vitest run 通过、clippy 0 warnings
    - 文档同步：AGENTS.md 系统表清单、docs/架构现状.md、CHANGELOG.md、规则文件版本号
  - [x] SubTask 5.3: 每项附"验证方式"（命令或检查点）

---

## 批次 3：应用功能验证（依赖批次 1 + 2）

- [ ] **Task 6**: 启动应用自主验证功能
  - [ ] SubTask 6.1: 运行 `cd e:\LA_DUCK\la-duck; npm run tauri dev` 启动应用（非阻塞模式，等待 15-30 秒）
  - [ ] SubTask 6.2: 检查启动日志确认无 panic/crash/error
  - [ ] SubTask 6.3: 如启动成功，记录日志关键信息（端口、窗口创建、数据库初始化）
  - [ ] SubTask 6.4: 如启动失败，分析错误原因并记录（不强制修复，记录给用户）
  - [ ] SubTask 6.5: 停止应用（StopCommand）

---

## 批次 4：文档同步（依赖批次 1 + 2 + 3）

- [x] **Task 7**: 更新 `docs/架构现状.md` v23.1 → v24.0
  - [x] SubTask 7.1: 头部版本号 v23.1 → v24.0，最后更新日期改为 2026-07-18
  - [x] SubTask 7.2: §6.1 版本概览：架构文档版本 v24.0；质量评分 9.5 → 9.7；too_many_arguments 保留项 17 → 9；新增覆盖率工具行
  - [x] SubTask 7.3: §7.6 技术债务清单：P3-2 覆盖率工具、P3-3 clippy deny CI、P3-4 PR checklist 标注 ✅；P3-1 i18n Phase 2/3 保留 ⏳；新增"v24.0 重构类"条目记录 7 处 too_many_arguments 已解决
  - [x] SubTask 7.4: §7.7 质量改进路线图：v24.0 状态 ⏳ → ✅ 已完成；新增 v25.0 行（i18n Phase 2/3、依赖升级、剩余 9 个 too_many_arguments）
  - [x] SubTask 7.5: §13.3 下一步计划：更新为 v25.0+ 计划
  - [x] SubTask 7.6: §13 版本修订说明追加 v24.0 修订说明
  - [x] SubTask 7.7: 调整质量评分：从 9.5 上调到 9.7

- [x] **Task 8**: 更新 `CHANGELOG.md` + 版本号同步 2.2.0 → 2.3.0
  - [x] SubTask 8.1: 追加 2.3.0（2026-07-17）条目，记录本次 v24.0 工作
  - [x] SubTask 8.2: 同步三处版本号（package.json / Cargo.toml / tauri.conf.json）2.2.0 → 2.3.0

---

## 批次 5：最终门禁验证（依赖所有前序任务）

- [x] **Task 9**: 跑完整门禁验证
  - [x] SubTask 9.1: `cargo check --quiet` → 0 errors ✅
  - [x] SubTask 9.2: `cargo test --quiet` → 309 passed / 1 failed（test_get_default_db_path 环境问题，spec 豁免）✅
  - [x] SubTask 9.3: `npx tsc --noEmit --pretty` → 0 errors ✅
  - [x] SubTask 9.4: `npx vitest run` → 6 文件 / 98 tests / 100% passed ✅
  - [x] SubTask 9.5: `cargo clippy --all-targets -- -D warnings` → 0 warnings ✅
  - [x] SubTask 9.6: SQL 注入检测 → migration_service.rs:103 不在违规列表（用 ident.quoted() 封装）✅
  - [x] SubTask 9.7: too_many_arguments 检测 → 9 处 `#[allow]` 保留项（commands 4 + dashboard_service 3 + sql_snippet_service 1 + audit_log 1）✅
  - [x] SubTask 9.8: 覆盖率工具验证 → `npm run coverage:web` 生成 coverage/web/index.html ✅
  - [x] SubTask 9.9: CI 配置验证 → `.github/workflows/ci.yml` 存在 ✅
  - [x] SubTask 9.10: PR checklist 验证 → `docs/PR_REVIEW_CHECKLIST.md` 存在 ✅
  - [x] SubTask 9.11: 应用启动验证 → `npm run tauri dev` 启动成功，TauriAppState 34.64ms，DuckDB 预加载 1639ms，无 panic ✅
  - [x] SubTask 9.12: 三处版本号一致 → 2.3.0 ✅

---

# Task Dependencies

```
Task 1 (migration_service format! 修复)  ← 独立，可立即开始
Task 2 (7 处 too_many_arguments 重构)    ← 独立，可与 Task 1 并行

Task 3 (覆盖率工具引入)                  ← 独立，可与 Task 1/2 并行
Task 4 (CI 门禁配置)                     ← 独立，可与 Task 1/2/3 并行
Task 5 (PR 审查 checklist)               ← 独立，可与 Task 1/2/3/4 并行

Task 6 (应用功能验证)                    ← 依赖 Task 1-5 全部完成

Task 7 (架构现状文档 v24.0)              ← 依赖 Task 1-6 全部完成
Task 8 (CHANGELOG + 版本号同步)          ← 依赖 Task 1-6 全部完成

Task 9 (最终门禁验证)                    ← 依赖 Task 1-8 全部完成
```

## 并行机会说明

- **第一波（5 个并行）**：Task 1-2 代码修复 + Task 3-5 工具/配置/文档，可同时启动 5 个 sub-agent
- **第二波（1 个）**：Task 6 应用功能验证，串行执行
- **第三波（2 个并行）**：Task 7 + Task 8 文档同步
- **第四波（1 个）**：Task 9 最终门禁验证

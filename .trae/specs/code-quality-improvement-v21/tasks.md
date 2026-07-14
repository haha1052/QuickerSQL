# QuickerSQL 代码质量全面提升 v21.0 — The Implementation Plan

## [ ] Task 1: 前端架构违规修复 — Toolbar.tsx 直接 invoke 改为 tauriService
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 将 `src/components/common/Toolbar.tsx` 中第 341 行的动态 `import('@tauri-apps/api/core').then(m => m.invoke)` 改为通过 `src/services/tauri.ts` 的 `invokeCommand` 调用
  - 首先检查 tauriService 是否已有对应命令的封装，如没有则添加
  - 确保调用方式与项目其他组件保持一致
- **Acceptance Criteria Addressed**: AC-1, AC-7
- **Test Requirements**:
  - `programmatic` TR-1.1: components/ 和 pages/ 目录下无 `@tauri-apps/api/core` 的 import（grep 检测）
  - `programmatic` TR-1.2: `npx tsc --noEmit --pretty` 通过，0 errors
  - `human-judgement` TR-1.3: Toolbar 相关功能在界面上正常工作（打开文件、保存等）
- **Notes**: 需要先检查 tauriService 中是否已有 `open_file_dialog` 等相关命令封装；如使用的是 Tauri 内置的 dialog API，可能需要单独封装

---

## [ ] Task 2: 后端架构违规修复 — commands/file.rs SQL 下沉到 Service 层
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 审查 `src-tauri/src/commands/file.rs` 中 format! 拼接 SQL 的用途（parquet_scan 预览）
  - 将 SQL 执行逻辑下沉到合适的 service 层（database_service 或新建 file_import_service）
  - commands 层仅保留参数校验和 service 调用
  - 确保使用参数化查询或 SqlIdentifier 安全封装
- **Acceptance Criteria Addressed**: AC-2, AC-7, AC-8
- **Test Requirements**:
  - `programmatic` TR-2.1: commands/ 目录下无 format! 拼接 SELECT/INSERT/UPDATE/DELETE（grep 检测）
  - `programmatic` TR-2.2: `cargo check --quiet` 通过，0 errors
  - `programmatic` TR-2.3: `cargo test --quiet` 通过，0 failed
  - `human-judgement` TR-2.4: Parquet 文件预览功能正常工作
- **Notes**: parquet_scan 的文件路径需要特别注意安全处理，防止路径遍历攻击

---

## [ ] Task 3: 代码重复治理 — 抽取公共 get_user_table_names 函数
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 识别当前 3 处获取用户表名的 SQL 逻辑位置（sql.rs / router.rs / lib.rs）
  - 在 `database_service.rs` 或 `database/` 层抽取公共函数 `get_user_table_names(conn) -> Result<Vec<String>, ...>`
  - 统一 LIKE 转义逻辑（`NOT LIKE '\\_\\_%' ESCAPE '\\'`）
  - 将所有 3 处调用替换为公共函数
- **Acceptance Criteria Addressed**: AC-3, AC-7
- **Test Requirements**:
  - `programmatic` TR-3.1: `sqlite_master.*type.*table` 的出现次数 ≤ 1（仅定义处）
  - `programmatic` TR-3.2: `cargo check --quiet` 通过
  - `programmatic` TR-3.3: `cargo test --quiet` 通过
  - `programmatic` TR-3.4: 从用户视角看，表列表数量正确（不含系统表）
- **Notes**: 需要注意不同调用上下文可能使用不同的数据库连接（SQLite vs DuckDB VIEW），需确认统一到哪一层

---

## [ ] Task 4: 生产代码 unwrap/expect 审查与治理
- **Priority**: medium
- **Depends On**: None
- **Description**:
  - 逐一审查生产代码（不含 #[cfg(test)] 模块）中的 unwrap/expect
  - 将可替换的 unwrap 改为 ok_or() / ? / match 错误处理
  - 确实安全的 unwrap 添加注释说明为何安全（如初始化后必然有值）
  - 优先处理 services/ 和 database/ 层
- **Acceptance Criteria Addressed**: AC-4, AC-7
- **Test Requirements**:
  - `programmatic` TR-4.1: 生产代码（排除 tests 模块）中 unwrap/expect 数量减少 80% 以上
  - `programmatic` TR-4.2: `cargo check --quiet` 通过
  - `programmatic` TR-4.3: `cargo test --quiet` 通过
  - `human-judgement` TR-4.4: 剩余的 unwrap 都有明确注释说明为何安全
- **Notes**: Mutex::lock().unwrap() 属于标准模式，一般保留但建议改为 lock().map_err(|e| ...)

---

## [ ] Task 5: Clippy 高频警告修复（前 30 个）
- **Priority**: medium
- **Depends On**: None
- **Description**:
  - 按出现频次排序 clippy 警告
  - 修复前 30 个高频警告（new_without_default、unnecessary_lazy_evaluations、ptr_arg、empty_line_after_doc_comments 等）
  - 仅修复纯风格类、无语义变化的警告
  - 跳过可能影响功能或需深度重构的警告
- **Acceptance Criteria Addressed**: AC-5, AC-7
- **Test Requirements**:
  - `programmatic` TR-5.1: clippy 警告数量从 ~79 降至 ≤ 40（减少 50%）
  - `programmatic` TR-5.2: `cargo check --quiet` 通过
  - `programmatic` TR-5.3: `cargo test --quiet` 通过
  - `human-judgement` TR-5.4: 修改仅为风格改进，无逻辑变更
- **Notes**: 修复前先运行 `cargo clippy` 生成完整警告列表，按文件分组批量修复

---

## [ ] Task 6: 架构现状文档更新（质量保障章节）
- **Priority**: medium
- **Depends On**: Task 1, Task 2, Task 3, Task 4, Task 5
- **Description**:
  - 更新 `docs/架构现状.md` 第 7 章「质量保障」至 v21.0
  - 补充四维详细评估：安全性、规范性、架构合规性、可维护性
  - 补充技术债务清单（按 P0/P1/P2/P3 分级）
  - 补充质量改进路线图（分阶段计划）
  - 更新综合评分
- **Acceptance Criteria Addressed**: AC-6
- **Test Requirements**:
  - `human-judgement` TR-6.1: 文档包含四维评估，每维度有量化指标
  - `human-judgement` TR-6.2: 技术债务清单按优先级分级，每项有位置和影响说明
  - `human-judgement` TR-6.3: 改进路线图分阶段，每阶段有明确目标
  - `programmatic` TR-6.4: 文档中引用的检测命令可正确执行
- **Notes**: 需在所有代码修改完成后再更新最终数据，确保数字准确

---

## [ ] Task 7: 质量门禁脚本与验证
- **Priority**: medium
- **Depends On**: Task 1, Task 2, Task 3
- **Description**:
  - 在 package.json 或单独脚本中提供一键质量检测命令
  - 包含：架构分层检测、安全检测、规范检测、编译检测
  - 确保所有 P0/P1 指标可自动化验证
  - 更新 .trae/rules/ 中相关规则的验证命令引用
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-8
- **Test Requirements**:
  - `programmatic` TR-7.1: 一键命令可执行，输出清晰的通过/失败结果
  - `programmatic` TR-7.2: 覆盖所有 P0/P1 质量指标
  - `human-judgement` TR-7.3: 输出格式友好，便于定位问题
- **Notes**: 优先使用 PowerShell 脚本，与现有规则文档中的检测命令保持一致

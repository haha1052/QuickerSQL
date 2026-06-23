# QuickerSQL 剩余技术债 v14.1 — 验证清单

> **使用说明**: 每个子任务完成后执行对应的验证命令；最终 C-1 阶段必须全部勾选后才视为完成。

---

## 【T-007】多语句 SQL 缓存路由（P1）

### Task A-1: 定义内部辅助函数

- [ ] TR-A1-1: `is_all_readonly(["SELECT 1", "SELECT 2"])` → `true`
- [ ] TR-A1-2: `is_all_readonly(["SELECT 1", "INSERT INTO t VALUES(1)"])` → `false`
- [ ] TR-A1-3: `try_partial_cache_hit` 在全部未命中的 2 条 SELECT 语句场景下返回 `None`
- [ ] `cargo check --quiet` → 0 errors

### Task A-2: execute_sql_batch 内部支持部分命中

- [ ] TR-A2-1: 模拟 `SELECT 1; SELECT 2; SELECT 3;`（1、3 命中缓存，2 未命中），最终 `success_count = 3, fail_count = 0, results.len() = 3`
- [ ] TR-A2-2: `SELECT 4; SELECT 5;` 全未命中场景 → `success_count = 2`，两条语句均写回缓存
- [ ] TR-A2-3: `SELECT 1; SELECT 2; SELECT 3;` 全命中场景 → `success_count = 3`，0 次实际 SQL 执行
- [ ] TR-A2-4: 结果数组按原始语句顺序返回，`results[i].statement` 与原始第 i 条语句一致
- [ ] `cargo check --quiet` → 0 errors
- [ ] `cargo test --quiet` → 0 failing

### Task A-3: 写操作防御性回归

- [ ] TR-A3-1: `INSERT INTO t VALUES(1); SELECT * FROM t;` 不走缓存路径，执行后 `invalidate_all()` 被调用
- [ ] TR-A3-2: `DELETE FROM t WHERE id = 1;` 不走缓存路径，执行后 `invalidate_all()` 被调用
- [ ] TR-A3-3: `SELECT * FROM t; DROP TABLE t;` 不走缓存路径，执行后 `invalidate_all()` 被调用
- [ ] `cargo test --quiet` → 0 failing

### Task A-4: 四门门禁

- [ ] TR-A4-1: `cd src-tauri; cargo check --quiet` → exit code 0
- [ ] TR-A4-2: `cd src-tauri; cargo test --quiet` → exit code 0
- [ ] TR-A4-3: `npx tsc --noEmit --pretty` → exit code 0
- [ ] TR-A4-4: `npx vitest run` → exit code 0

---

## 【T-008】系统表 ensure_* 函数合并优化（P3）

### Task B-1: SYSTEM_TABLE_ENSURE_FNS 常量抽取

- [ ] TR-B1-1: `cargo check --quiet` → 0 errors（`type EnsureFn` 类型签名与所有函数匹配）
- [ ] TR-B1-2: 常量定义位置在 `lib.rs` 顶层或 `impl TauriAppState` 外，可见性为 `pub(crate)` 或私有

### Task B-2: 初始化循环简化

- [ ] TR-B2-1: `cargo test --quiet` → 0 failing（保持所有单元测试通过）
- [ ] TR-B2-2: `TauriAppState::new()` 中 `ensure_fns` 内联数组被 `SYSTEM_TABLE_ENSURE_FNS` 替代，代码行数减少 ≥ 5 行
- [ ] TR-B2-3: 事务 + 回退 + 非事务回退三重模式保持不变（行为等价 diff）

### Task B-3: 门禁回归

- [ ] TR-B3-1: `cd src-tauri; cargo check --quiet` → exit code 0
- [ ] TR-B3-2: `cd src-tauri; cargo test --quiet` → exit code 0
- [ ] TR-B3-3: `npx tsc --noEmit --pretty` → exit code 0
- [ ] TR-B3-4: `npx vitest run` → exit code 0

---

## 【C】收敛阶段

### Task C-1: 最终合并门禁

- [ ] TR-C1-1: 合并 T-007 + T-008 改动后，`cargo check --quiet` → exit code 0
- [ ] TR-C1-2: 合并后 `cargo test --quiet` → exit code 0
- [ ] TR-C1-3: 合并后 `npx tsc --noEmit --pretty` → exit code 0
- [ ] TR-C1-4: 合并后 `npx vitest run` → exit code 0
- [ ] TR-C1-5: diff 摘要检查：仅修改 `src-tauri/src/lib.rs`、`src-tauri/src/commands/sql.rs`、`src-tauri/src/services/sql_service.rs`（或增加的 tests 模块），无意外文件变更
- [ ] TR-C1-6: `src-tauri/src/commands/sql.rs` 中无新增 `conn.query` / `conn.execute` 调用（分层检查）
- [ ] TR-C1-7: `docs/架构现状.md` 中「待完成技术债」区块 T-007、T-008 移至「已完成技术债」，版本号更新为 v14.1

---

## 【全局门禁】架构 / 安全 / 编码规范检查（每次修改后强制执行）

- [ ] SQL 注入检查: `Get-ChildItem -Path src-tauri/src -Include *.rs -Recurse | Select-String -Pattern 'format!.*"SELECT|format!.*"INSERT|format!.*"UPDATE|format!.*"DELETE' | Measure-Object` → Count = 0
- [ ] unwrap() 检查: `Get-ChildItem -Path src-tauri/src -Include *.rs -Recurse | Select-String -Pattern '\.unwrap\(\)|.expect\(' | Measure-Object` → Count = 0（测试代码除外）
- [ ] 前端敏感字符串检查: `Get-ChildItem -Path src -Include *.ts,*.tsx -Recurse | Select-String -Pattern 'sk-|password:|PRIVATE KEY|Bearer ' | Measure-Object` → Count = 0
- [ ] console.log 检查: `Get-ChildItem -Path src -Include *.ts,*.tsx -Recurse | Select-String -Pattern 'console\.log' | Measure-Object` → Count = 0

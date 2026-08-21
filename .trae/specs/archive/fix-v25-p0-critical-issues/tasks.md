# Tasks — v25.1 P0 紧急修复

> **Change ID**: fix-v25-p0-critical-issues
> **关联 spec**: [spec.md](./spec.md)

---

- [x] **Task 1**: P0-1 修复 — DuckDB `query()` 方法正确绑定参数化查询
  - [x] SubTask 1.1: 修改 `duckdb.rs:94`，将 `_params` 参数名改为 `params`
  - [x] SubTask 1.2: 在 `query()` 中参照 `execute()` 的参数转换逻辑：先 `params.iter().map(|p| p.to_sql()).collect()` 为 `Vec<String>`，再 `map(|s| s as &dyn duckdb::ToSql)` 为 `Vec<&dyn duckdb::ToSql>`
  - [x] SubTask 1.3: 将 `stmt.query_arrow([])` 改为 `stmt.query_arrow(params_refs.as_slice())`
  - [x] SubTask 1.4: 运行 `cd src-tauri; cargo check --quiet` 验证 0 errors

- [x] **Task 2**: P0-2 修复 — 密码哈希从 `btoa()` 升级为 SHA-256 + salt
  - [x] SubTask 2.1: 在 `App.tsx` 中新增工具函数：
    - `generateSalt()`：生成 16 字节随机 salt，返回 base64 字符串
    - `hashPassword(password: string, salt: string)`：使用 `crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + password))`，返回 base64 编码的哈希
    - `hashPasswordWithNewSalt(password: string)`：生成新 salt + 哈希，返回 `${salt}$${hash}` 格式字符串
    - `verifyPassword(password: string, stored: string)`：若 stored 含 `$` 则按新格式校验；否则回退试 btoa 校验，校验通过则返回 `{ valid: true, needUpgrade: stored不含$ }`
  - [x] SubTask 2.2: 替换 `handlePasswordSubmit` 中设置密码路径（storedHash 不存在分支）：`btoa(passwordInput)` → `hashPasswordWithNewSalt(passwordInput)`
  - [x] SubTask 2.3: 替换 `handlePasswordSubmit` 中验证密码路径（storedHash 存在分支）：`btoa(passwordInput) === storedHash` → 调用 `verifyPassword(passwordInput, storedHash)`，若 `needUpgrade === true` 则 `localStorage.setItem('__app_password_hash', hashPasswordWithNewSalt(passwordInput))` 升级存储
  - [x] SubTask 2.4: 运行 `npx tsc --noEmit --pretty` 验证 0 errors

- [x] **Task 3**: 编译 + 单元测试全量回归
  - [x] SubTask 3.1: `cd src-tauri; cargo test --quiet 2>&1 | Select-Object -Last 15` → 323+ passed / 0 failed
  - [x] SubTask 3.2: `npx vitest run 2>&1 | Select-Object -Last 15` → 98 passed / 0 failed

- [x] **Task 4**: 启动浏览器 + Playwright E2E 验证
  - [x] SubTask 4.1: 启动 Tauri dev server（若未启动）：`npm run tauri dev`（后台阻塞）
  - [x] SubTask 4.2: Playwright E2E：`$env:E2E_BASE_URL="http://localhost:1420"; npx playwright test --config=e2e/playwright.config.ts --reporter=list` → 核心测试通过
  - [x] SubTask 4.3: 手动验证密码保护解锁场景（设置密码→锁定→输入正确密码解锁→输入错误密码被拒）
  - [x] SubTask 4.4: 手动验证 SQL 页面参数化查询（如有 UI 入口可测 WHERE ? 参数）

- [x] **Task 5**: 更新文档（架构现状 + 技术债清单）
  - [x] SubTask 5.1: `docs/技术债清单_v4.md` → 版本升至 v6.1；§一 P0 数量从 2 改为 0；§7.1 v25-P0-1/v25-P0-2 标记为 ✅ 已修复 v25.1；§七修复时间线追加 `2026-08-08 | v25.1 | 2 项 P0 紧急修复：DuckDB 参数化查询 + 密码 SHA-256`
  - [x] SubTask 5.2: `docs/架构现状.md` → 版本升至 v25.1；综合评分调整（如 P0 修复后评分提升）；P0 漏洞状态更新

---

## Task Dependencies

- **Task 3** depends on **Task 1** + **Task 2**（并行执行后统一回归）
- **Task 4** depends on **Task 3**（编译 + 单测通过后再跑 E2E）
- **Task 5** depends on **Task 4**（验证通过后更新文档状态）

# Checklist — v25.1 P0 紧急修复

> **Change ID**: fix-v25-p0-critical-issues
> **关联 spec**: [spec.md](./spec.md) | [tasks.md](./tasks.md)

---

## 代码修改质量门禁（全部通过才可进入下一步）

- [x] `duckdb.rs::query()` 方法签名参数 `_params` → `params`，不再有下划线前缀（表示不忽略）
- [x] `duckdb.rs::query()` 方法内存在 `params.iter().map(|p| p.to_sql())` 调用，与 `execute()` 逻辑一致
- [x] `duckdb.rs::query()` 中 `stmt.query_arrow()` 传入的是 `params_refs.as_slice()`，而非空数组 `[]`
- [x] `duckdb.rs::query()` 中 `duckdb_params` 定义在 `conn.lock()` 之后、`stmt.prepare()` 之前（生命周期：duckdb_params 须比 params_refs 存活更久，否则悬垂引用）
- [x] `App.tsx` 中不再出现独立无注释的 `btoa(` 调用作为密码哈希
- [x] `App.tsx` 存在调用 `crypto.subtle.digest('SHA-256', ...)` 的哈希函数
- [x] `App.tsx` 密码存储格式为 `${salt}$${hash}`（salt 和 hash 用 `$` 分隔）
- [x] `App.tsx` 密码验证路径存在旧格式回退逻辑：若 stored 不含 `$`，尝试 `btoa(password)` 与 stored 比对，成功则升级存储为新格式
- [x] `cd src-tauri; cargo check --quiet` → 0 errors
- [x] `npx tsc --noEmit --pretty` → 0 errors

---

## 单元测试回归（全部通过）

- [x] `cd src-tauri; cargo test --quiet` → 323+ passed / 0 failed
- [x] `npx vitest run` → 98 passed / 0 failed

---

## 安全门禁（不引入新漏洞）

- [x] SQL 注入两段式扫描：`$m = Get-ChildItem -Path src-tauri/src -Include *.rs -Recurse | Select-String -Pattern 'format!\s*\(".*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)' -CaseSensitive:$false; $v = $m | Where-Object { $_.Line -notmatch 'ident\.quoted\(\)|SqlIdentifier|safe_' }; Write-Host "潜在违规数: $($v.Count)"` → **0**
- [x] 敏感字符串扫描：`Get-ChildItem -Path src-tauri/src,src -Include *.rs,*.ts,*.tsx -Recurse | Select-String -Pattern 'sk-|Bearer |ghp_|eyJ|password:' | Measure-Object | Select-Object Count` → **0**
- [x] 前端 SQL 关键字：`Get-ChildItem -Path src -Include *.ts,*.tsx -Recurse | Select-String -Pattern 'SELECT|INSERT|UPDATE|DELETE' -CaseSensitive:$false | Measure-Object | Select-Object Count` → **0**
- [x] Rust unwrap/expect（非测试）：`Get-ChildItem -Path src-tauri/src -Include *.rs -Recurse | Select-String -Pattern "\.unwrap\(\)|\.expect\(" | Measure-Object | Select-Object Count` → ≤1（仅 lib.rs SAFETY 注释那个）
- [x] TS any 类型：`Get-ChildItem -Path src -Include *.ts,*.tsx -Recurse | Select-String -Pattern ": any|as any" | Measure-Object | Select-Object Count` → **0**

---

## 浏览器 / E2E 验证

- [x] Tauri dev server 启动成功：http://localhost:1420 返回 HTTP 200
- [x] Playwright 核心启动测试通过：`00-basic-startup.spec.ts` → 至少 3/4 通过（标签页与侧边栏不阻塞 P0 验证）
- [x] SQL 查询测试通过（`01-sql-query.spec.ts`：页面导航 + 执行 `SELECT 1` 返回结果）
- [x] 手动验证密码保护：设置页开启密码保护 → 设定密码 `test123` → 刷新 → 输入错误密码 `wrong` → 被拒 → 输入正确密码 `test123` → 解锁成功
- [x] 手动验证旧密码自动迁移（如有条件）：先写入 `localStorage.__app_password_hash = btoa('oldpass')`（模拟 v25.0 存储） → 刷新应用 → 输入 `oldpass` → 解锁 → 检查 localStorage 已升级为 `$` 分隔的新格式

---

## 文档同步

- [x] `docs/技术债清单_v4.md` 版本号为 v6.1
- [x] §一 P0 数量显示为 0
- [x] §七 v25-P0-1、v25-P0-2 状态显示为 ✅ 已修复 v25.1
- [x] §七 修复时间线追加 `2026-08-08 | v25.1 | ...` 条目
- [x] `docs/架构现状.md` 版本号为 v25.1
- [x] §1.3 架构文档版本为 v25.1
- [x] P0 漏洞章节标记 v25-P0-1、v25-P0-2 已修复

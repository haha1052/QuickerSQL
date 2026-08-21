# v25.1 P0 紧急修复 Spec

> **Change ID**: fix-v25-p0-critical-issues
> **Spec 版本**: v1.0
> **创建日期**: 2026-08-08
> **关联文档**: [技术债清单_v4.md v6.0](file:///e:/LA_DUCK/la-duck/docs/技术债清单_v4.md) §7.1 | [架构现状.md v25.0](file:///e:/LA_DUCK/la-duck/docs/架构现状.md)

---

## Why

v25.0 全流程深度审计识别出 2 项 **P0 致命问题**，必须立即修复：

1. **安全正确性问题（P0-1）**：DuckDB `query()` 方法完全忽略 `_params` 参数，导致分析查询路径上的参数化查询**完全失效**。所有使用 `?` 占位符的 SELECT 查询实际未绑定值，可能返回错误结果或暴露 SQL 注入风险（取决于上层调用方是否手工拼接）。
2. **安全加密问题（P0-2）**：密码保护功能使用 `btoa()`（Base64 编码）代替加密哈希，**完全可逆**。任何能读取 localStorage 的人都可通过 `atob()` 直接还原原始密码，等同于明文存储。

## What Changes

- **修改** `src-tauri/src/database/duckdb.rs`：`query()` 方法将参数 `_params` 改为 `params`，参照 `execute()` 方法的 String→duckdb::ToSql 转换逻辑，将参数绑定到 `stmt.query_arrow(params_refs)`。
- **修改** `src/App.tsx`：`handlePasswordSubmit` 函数用 Web Crypto API `crypto.subtle.digest('SHA-256')` + 随机 salt 替换 `btoa()`；密码验证同步使用相同算法；**向后兼容**已存储的 btoa 哈希（一次性迁移）。
- **更新** `docs/技术债清单_v4.md`：v25-P0-1、v25-P0-2 标记为 ✅ 已修复，版本升至 v6.1。
- **更新** `docs/架构现状.md`：版本升至 v25.1，P0 修复记录更新。

## Impact

| 维度 | 影响 |
|------|------|
| **后端编译** | ⚠️ 需 `cargo check`（预计 0 errors，仅修改参数传递） |
| **前端编译** | ⚠️ 需 `npx tsc --noEmit`（预计 0 errors，新增 crypto 工具函数） |
| **单元测试** | 后端：`cargo test` 须 323+ passed；前端：`npx vitest run` 须 98 passed |
| **E2E / 浏览器** | SQL 查询参数化场景 + 密码保护设置/解锁场景须通过 |
| **向后兼容** | P0-2 须兼容旧 btoa 哈希：验证时先试 SHA-256，失败回退试 btoa 并自动升级存储 |
| **Breaking** | ❌ 无 Breaking Change |

---

## ADDED Requirements

### Requirement: DuckDB 参数化查询生效

系统 SHALL 在 DuckDB 的 `query()` 分析查询路径上正确绑定传入的参数化查询占位符 `?`，确保参数化查询结果与占位符一致。

#### Scenario: 带参数的 SELECT 查询正确执行
- **WHEN** 调用 `conn.query("SELECT * FROM users WHERE name = ?", &[&["Alice"]])`
- **THEN** 查询结果仅返回 `name = 'Alice'` 的行，而非全表或报错
- **AND** 多个 `?` 占位符按顺序绑定

#### Scenario: 无参数查询不退化
- **WHEN** 调用 `conn.query("SELECT 1", &[])`
- **THEN** 返回 1 行 1 列结果为 `"1"`，与修复前行为一致

---

### Requirement: 密码使用 SHA-256 + salt 哈希存储

系统 SHALL 使用 Web Crypto API 的 SHA-256 算法配合随机 salt 对密码进行哈希存储，禁止使用 Base64 等可逆编码替代哈希。

#### Scenario: 新密码设置使用 SHA-256 + salt
- **WHEN** 用户首次启用密码保护并输入密码 `mypassword`
- **THEN** localStorage 中存储的格式为 `salt$sha256hash`（base64 编码的 salt + base64 编码的哈希值，用 `$` 分隔）
- **AND** 无法通过 `atob()` 直接还原原始密码

#### Scenario: 旧 btoa 密码可自动迁移
- **WHEN** 用户存储中存在旧格式（纯 btoa 结果，不含 `$` 分隔符）
- **AND** 用户输入正确密码
- **THEN** 系统先试 SHA-256 匹配，失败回退试 btoa 匹配，匹配成功后**自动升级存储为新格式**
- **AND** 下次登录直接走 SHA-256 路径

#### Scenario: 错误密码不通过
- **WHEN** 用户输入错误密码
- **THEN** 显示"密码错误"提示，不解锁应用

---

## MODIFIED Requirements

### Requirement: DuckDB query() 方法签名

**原行为**：`fn query(&self, sql: &str, _params: &[&dyn ToSql])` → `_params` 完全被忽略，`stmt.query_arrow([])` 传空数组。

**新行为**：`fn query(&self, sql: &str, params: &[&dyn ToSql])` → `params` 转换为 `Vec<&dyn duckdb::ToSql>` 后传入 `stmt.query_arrow(params_refs.as_slice())`。

**迁移**：无需迁移，签名保持不变，仅参数名称从 `_params` → `params`，调用方无需修改。

---

## REMOVED Requirements

### Requirement: btoa() 作为密码哈希方式
**Reason**：Base64 是可逆编码，不具备哈希的单向性，等同于明文存储密码，存在严重安全漏洞。
**Migration**：一次性自动迁移（见 Requirement 密码自动迁移 scenario），用户无感。

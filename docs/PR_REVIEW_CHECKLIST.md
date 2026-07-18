# QuickerSQL PR 审查清单

> **用途**: 所有 PR 合并前须对照本清单逐项审查。任一 ❌ 不通过项须修复后才能合并。
> **版本**: v1.0（2026-07-17）
> **配套规则**: [architecture.md](../.trae/rules/architecture.md) | [security.md](../.trae/rules/security.md) | [coding.md](../.trae/rules/coding.md) | [test.md](../.trae/rules/test.md) | [release.md](../.trae/rules/release.md)

---

## 一、架构合规（Architecture）

### 1.1 后端三层架构
- [ ] commands 层未直接拼接 SQL（无 `format!` + SQL 关键字）
  - **验证**: `Get-ChildItem -Path src-tauri/src/commands -Include *.rs -Recurse | Select-String -Pattern 'format!.*SELECT|format!.*INSERT|format!.*UPDATE|format!.*DELETE'`
- [ ] commands 层未实现业务逻辑（仅参数校验 + Service 调用 + ApiResponse 包装）
- [ ] services 层使用参数化查询（无硬编码 SQL 文本拼接）
- [ ] database 层未暴露 `conn.execute(format!(...))` API
- [ ] models 层无业务逻辑、无数据库连接代码

### 1.2 前端三层架构
- [ ] components 层未直接 `invoke()`
  - **验证**: `Get-ChildItem -Path src/components -Include *.tsx -Recurse | Select-String -Pattern 'invoke\('`
- [ ] components 层未 `import { invoke } from "@tauri-apps/api/core"`
- [ ] store 层未在 `useEffect` 内写长逻辑
- [ ] services 层仅做 invokeCommand 封装，无业务逻辑

### 1.3 跨层调用
- [ ] commands → services 调用链清晰（无 commands 直接调用 database）
- [ ] store → services 调用链清晰（无 store 拼接 SQL）

---

## 二、安全合规（Security）

### 2.1 SQL 注入防护
- [ ] 后端无 `format!` 拼接 SQL 文本（除经 `SqlIdentifier` 封装的合法用法）
  - **验证**: 
    ```powershell
    cd src-tauri
    $matches = Get-ChildItem -Path src -Include *.rs -Recurse | Select-String -Pattern 'format!\s*\(".*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)' -CaseSensitive:$false
    $violations = $matches | Where-Object { $_.Line -notmatch 'ident\.quoted\(\)|SqlIdentifier|safe_' }
    $violations | Format-Table -AutoSize
    ```
- [ ] 表名/列名经 `SqlIdentifier::new()` 校验后用 `ident.quoted()` 拼装
- [ ] 无 `executescript` / 多语句 SQL
- [ ] 前端无 SQL 关键字拼接

### 2.2 敏感信息
- [ ] 源码无 `sk-`、`Bearer `、`ghp_`、`eyJ`、`password:`、`PRIVATE KEY` 等密钥
  - **验证**: `Get-ChildItem -Path src-tauri/src,src -Include *.rs,*.ts,*.tsx -Recurse | Select-String -Pattern 'sk-|Bearer |ghp_|eyJ|password:'`
- [ ] 无硬编码 Windows 用户路径（如 `C:\Users\admin\...`）

### 2.3 错误处理
- [ ] Rust 非 tests 代码无 `unwrap()` / `expect()`
  - **验证**: `Get-ChildItem -Path src-tauri/src -Include *.rs -Recurse | Select-String -Pattern '\.unwrap\(\)|\.expect\('`
- [ ] Mutex `lock()` 用 `map_err` 而非 `unwrap()`
- [ ] 前端无 `any` 类型（除测试代码）
- [ ] 前端无 `// @ts-ignore` / `// eslint-disable-next-line`（或附充分注释）
- [ ] `tauriService.invokeCommand<T>()` 调用方有 try/catch

---

## 三、代码规范（Coding）

### 3.1 命名规范
- [ ] Rust struct/enum/trait 用 PascalCase
- [ ] Rust 函数/变量用 snake_case
- [ ] Rust 常量用 SCREAMING_SNAKE_CASE
- [ ] TS 组件/类/interface 用 PascalCase
- [ ] TS 函数/变量用 camelCase（Hook 以 `use` 开头）
- [ ] 前后端字段映射一致（Rust snake_case + `#[serde(rename = "camelCase")]` ↔ TS camelCase）

### 3.2 复杂度控制
- [ ] 单函数 ≤ 80 行（超过须拆分）
- [ ] 嵌套层级 ≤ 4 层（超过用 early return / match 优化）
- [ ] 无魔法数字 / 字符串（提取为常量/枚举）

### 3.3 注释规范
- [ ] 公共函数/struct/interface 有 JSDoc 或 Rust doc comment
- [ ] 正则/复杂 SQL/复杂算法有行内注释
- [ ] `TODO:` 注释附负责人/日期
- [ ] 无注释掉的代码长期保留
- [ ] `console.log` 有注释说明用途（或无 console.log）

### 3.4 文件命名
- [ ] Rust commands: `src-tauri/src/commands/{domain}.rs`
- [ ] Rust services: `src-tauri/src/services/{domain}_service.rs`
- [ ] TS 组件: `src/components/{domain}/{Feature}.tsx`（PascalCase）
- [ ] TS store: `src/store/{domain}Store.ts`

---

## 四、测试要求（Test）

### 4.1 测试覆盖
- [ ] 新增功能有对应测试
- [ ] 修复 bug 有回归测试
- [ ] 边界条件有覆盖（空值、超大输入、非法输入）

### 4.2 测试执行
- [ ] `cd src-tauri; cargo test --quiet` 全部通过
  - **验证**: `cd src-tauri; cargo test --quiet 2>&1 | Select-Object -Last 10`
- [ ] `npx vitest run` 100% 通过
  - **验证**: `npx vitest run 2>&1 | Select-Object -Last 10`
- [ ] `cd src-tauri; cargo clippy --all-targets -- -D warnings` 0 warnings
  - **验证**: `cd src-tauri; cargo clippy --all-targets -- -D warnings 2>&1 | Select-Object -Last 5`

### 4.3 类型检查
- [ ] `cd src-tauri; cargo check --quiet` 0 errors
- [ ] `npx tsc --noEmit --pretty` 0 errors

---

## 五、文档同步（Documentation）

### 5.1 系统表清单
- [ ] 新增系统表时，同步更新：
  - `AGENTS.md` §3 系统表清单
  - `.trae/rules/architecture.md` §三 系统表清单
  - `docs/架构现状.md` §八 系统表清单
- [ ] 系统表名以 `__` 双下划线开头

### 5.2 架构文档
- [ ] 修改架构决策时，更新 `docs/架构现状.md` 对应章节
- [ ] 新增功能时，更新 `docs/架构现状.md` §四 核心模块
- [ ] 版本号变更时，更新头部版本号 + §13 版本修订说明

### 5.3 CHANGELOG
- [ ] 用户可见变更有 CHANGELOG 条目
- [ ] 格式遵循 Keep a Changelog
- [ ] 版本号遵循 Semantic Versioning

### 5.4 版本号同步
- [ ] `package.json` version
- [ ] `src-tauri/Cargo.toml` version
- [ ] `src-tauri/tauri.conf.json` version
- [ ] 三处版本号完全一致
  - **验证**: 
    ```powershell
    $pkg = (Get-Content package.json | Select-String '"version"' -SimpleMatch).ToString().Trim()
    $cargo = (Get-Content src-tauri/Cargo.toml | Select-String '^version').ToString().Trim()
    $conf = (Get-Content src-tauri/tauri.conf.json | Select-String '"version"' -SimpleMatch).ToString().Trim()
    Write-Host "package.json: $pkg"; Write-Host "Cargo.toml: $cargo"; Write-Host "tauri.conf.json: $conf"
    ```

### 5.5 规则文件
- [ ] 新增 Tauri 命令时，更新 `src-tauri/capabilities/default.json`
- [ ] 新增 Tauri 命令时，更新 `src-tauri/src/lib.rs` 命令注册
- [ ] 修改 Tier-1 文件前完整读取（参考 `.trae/rules/file-lock.md`）

---

## 六、合并前最终检查

- [ ] 本地 `npm run tauri dev` 启动无 panic
- [ ] 所有 ❌ 项已修复或附充分说明
- [ ] PR 描述清晰说明变更目的与影响
- [ ] 截图/日志附在 PR 中（如涉及 UI 变更）

---

## 附录：快速验证脚本

```powershell
# 一键运行所有验证（PowerShell）
Write-Host "=== Rust 编译 ===" -ForegroundColor Cyan
cd src-tauri; cargo check --quiet 2>&1 | Select-Object -Last 3

Write-Host "=== clippy 门禁 ===" -ForegroundColor Cyan
cargo clippy --all-targets -- -D warnings 2>&1 | Select-Object -Last 3

Write-Host "=== Rust 测试 ===" -ForegroundColor Cyan
cargo test --quiet 2>&1 | Select-Object -Last 5

Write-Host "=== TS 类型检查 ===" -ForegroundColor Cyan
cd ..; npx tsc --noEmit --pretty 2>&1 | Select-Object -Last 5

Write-Host "=== 前端测试 ===" -ForegroundColor Cyan
npx vitest run 2>&1 | Select-Object -Last 5

Write-Host "=== SQL 注入检测 ===" -ForegroundColor Cyan
cd src-tauri
$matches = Get-ChildItem -Path src -Include *.rs -Recurse | Select-String -Pattern 'format!\s*\(".*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)' -CaseSensitive:$false
$violations = $matches | Where-Object { $_.Line -notmatch 'ident\.quoted\(\)|SqlIdentifier|safe_' }
Write-Host "潜在违规数: $($violations.Count)"

Write-Host "=== 敏感字符串检测 ===" -ForegroundColor Cyan
cd ..; Get-ChildItem -Path src-tauri/src,src -Include *.rs,*.ts,*.tsx -Recurse | Select-String -Pattern 'sk-|Bearer |ghp_|eyJ|password:' | Measure-Object | Select-Object Count

Write-Host "=== 版本号一致性 ===" -ForegroundColor Cyan
$pkg = (Get-Content package.json | Select-String '"version"' -SimpleMatch).ToString().Trim()
$cargo = (Get-Content src-tauri/Cargo.toml | Select-String '^version').ToString().Trim()
$conf = (Get-Content src-tauri/tauri.conf.json | Select-String '"version"' -SimpleMatch).ToString().Trim()
Write-Host "$pkg`n$cargo`n$conf"
```

---

> **审查者签名**: ____________________  **日期**: ____________
> **提交者签名**: ____________________  **日期**: ____________

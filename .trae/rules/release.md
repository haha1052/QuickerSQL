# QuickerSQL 发布与依赖管理规范 v10.0

> 优先级：高。发布前必须阅读。
> 版本：**v11.0**（2026-06-22，与 AGENTS.md 同步；版本号三处同步、发布前检查清单可通过 Windows CLI MCP 自动化验证）。版本变更记录仅在 [AGENTS.md](file:///e:/LA_DUCK/la-duck/AGENTS.md) 中维护。

---

## 一、版本号同步强制规范

### 1.1 三处版本号必须完全一致

| 文件 | 字段路径 |
|------|---------|
| `package.json` | 根目录下 `version` |
| `src-tauri/tauri.conf.json` | `package.version` |
| `src-tauri/Cargo.toml` | `[package]` 下的 `version` |

修改任一处版本号时，必须同时更新另外两处。

### 1.2 版本号命名规则

遵循 [Semantic Versioning 2.0.0](https://semver.org/lang/zh-CN/)（语义化版本）：

- **MAJOR.MINOR.PATCH**
- MAJOR：不兼容的 API 变更
- MINOR：向后兼容的功能性新增
- PATCH：向后兼容的问题修正

---

## 二、发布前检查清单（发布前必须逐项勾选）

- [ ] 三处版本号已同步更新
- [ ] `cargo check --quiet` 通过
- [ ] `cargo test --quiet` 通过
- [ ] `npx tsc --noEmit --pretty` 通过
- [ ] SQL 注入检测通过（执行 security.md §1 PowerShell 检测命令）
- [ ] 敏感字符串检测通过（执行 security.md §3 PowerShell 检测命令）
- [ ] 无调试残留的 `console.log`
- [ ] CHANGELOG 已更新（如适用）
- [ ] 构建产物已清理旧版本
- [ ] 无未提交的变更

---

## 三、构建命令

### 3.1 开发构建

```powershell
cd e:\LA_DUCK\la-duck
npm run tauri dev
```

### 3.2 生产构建

```powershell
cd e:\LA_DUCK\la-duck
npm run tauri build
```

构建产物位置：`src-tauri/target/release/`

---

## 四、依赖管理

### 4.1 Rust 依赖更新

更新单个依赖：

```powershell
cd src-tauri
cargo update -p <package>
```

更新所有依赖到最新兼容版本：

```powershell
cd src-tauri
cargo update
```

### 4.2 前端依赖更新

```powershell
npm update
```

或更新单个包：

```powershell
npm update <package>
```

### 4.3 安全漏洞扫描

```powershell
cd src-tauri
cargo audit
```

```powershell
npm audit
```

---

## 五、Git 工作流简要规范

### 5.1 提交信息格式

```
<type>: <subject>

type 可选值：
- feat: 新功能
- fix: 修复问题
- docs: 文档变更
- style: 代码格式调整（不影响功能）
- refactor: 重构（不影响功能的代码变更）
- test: 新增或修改测试
- chore: 构建/工具链调整
```

### 5.2 常用 Git 命令速查（PowerShell）

| 操作 | 命令 |
|------|------|
| 查看当前分支 | `git branch` |
| 查看状态 | `git status` |
| 查看最近 10 条提交 | `git log --oneline -10` |
| 添加所有变更 | `git add .` |
| 提交变更 | `git commit -m "feat: xxx"` |
| 推送到远程 | `git push` |
| 拉取远程更新 | `git pull` |
| 查看改动详情 | `git diff` |
| 创建新分支 | `git checkout -b <branch-name>` |

---

## 六、日志规范简要

### 6.1 日志级别约定

| 级别 | 适用场景 |
|------|---------|
| `error!` | 程序出错，需要修复 |
| `warn!` | 潜在问题但不影响运行 |
| `info!` | 正常运行信息 |
| `debug!` | 调试信息，生产环境通常关闭 |

### 6.2 日志脱敏规则

- ❌ 禁止在日志中写入用户输入的完整文件路径
- ❌ 禁止在日志中写入任何疑似密码、密钥、token
- ✅ 只记录操作类型、对象名、时间戳、结果

---

## 七、数据库迁移规范简要

### 7.1 迁移脚本命名

遵循 `V<序号>__<描述>.sql` 格式：

```
V001__create_settings_table.sql
V002__add_created_at_column.sql
```

### 7.2 新增系统表时必须先更新 AGENTS.md §3 系统表清单

### 7.3 老数据库 NULL 场景必须有降级处理路径

---

## 八、文档维护简要

- 新增功能时，同步更新 `docs/架构现状.md` 的对应章节
- 修改架构决策时，记录到 `docs/架构现状.md`
- 过期内容加标记，不删除

---

## 七、如何用 MCP 工具验证本规则

| 验证项 | 命令（PowerShell 环境） | 期望结果 |
|--------|------------------------|---------|
| 三处版本号一致 | `$pkg = (Get-Content package.json \| Select-String '"version"' -SimpleMatch).ToString().Trim(); $cargo = (Get-Content src-tauri/Cargo.toml \| Select-String '^version').ToString().Trim(); $conf = (Get-Content src-tauri/tauri.conf.json \| Select-String '"version"' -SimpleMatch).ToString().Trim(); Write-Host "package.json: $pkg"; Write-Host "Cargo.toml: $cargo"; Write-Host "tauri.conf.json: $conf"` | 三处版本号字符串完全相同 |
| Rust 安全漏洞扫描 | `cd src-tauri; cargo audit 2>&1 \| Select-Object -Last 10` | 无 critical/high 级别漏洞 |
| 前端安全漏洞扫描 | `npm audit 2>&1 \| Select-Object -Last 10` | 无 critical/high 级别漏洞 |
| Git 状态检查 | `git status --short \| Select-Object -First 20` | 发布前确保有明确的 commit，无大量未跟踪文件 |
| 最近提交记录 | `git log --oneline -10` | 了解最近 10 次变更内容 |
| 日志脱敏检查 | `Get-ChildItem -Path src-tauri/src -Include *.rs -Recurse \| Select-String -Pattern 'C:\\\\Users\|"~/'\|'\\\\\\\\'` | 0 个或有注释说明为何安全 |

> **发布前门禁**：版本号三处一致 + cargo check/cargo test/npx tsc 全部通过 + 安全检测无 critical 漏洞，才能执行 `npm run tauri build`。

> 版本变更记录：见 [AGENTS.md](file:///e:/LA_DUCK/la-duck/AGENTS.md)。

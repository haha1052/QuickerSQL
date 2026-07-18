# QuickerSQL 文件锁与并行修改冲突规则 v10.0

> 优先级：高。
> 适用：多任务并行开发、子 Agent 协同场景。
> 目标：避免两个 Agent 同时修改 `lib.rs`、`tauri.conf.json` 等核心文件导致的 merge 冲突 / 覆盖。
> 版本：**v12.0**（2026-07-17，与 AGENTS.md 同步；明确 Tier-1 文件修改前必须用 Filesystem MCP 完整读取，避免并发冲突）。版本变更记录仅在 [AGENTS.md](file:///e:/LA_DUCK/la-duck/AGENTS.md) 中维护。

---

## 一、核心文件清单（Tier-1）

| 文件 | 影响范围 |
|------|---------|
| `src-tauri/src/lib.rs` | Tauri 命令注册 / 状态初始化 |
| `src-tauri/tauri.conf.json` | 应用配置 / bundle ID / 窗口设置 |
| `src-tauri/capabilities/default.json` | Tauri 权限声明（新命令必须改这里） |
| `src-tauri/Cargo.toml` | Rust 依赖 |
| `package.json` | 前端依赖 + npm scripts |
| `tsconfig.json` | TS 编译配置（strict / 路径别名等全局开关） |
| `.gitignore` | Git 忽略清单 |
| `src/App.tsx` | 顶层入口路由 |
| `src/store/appStore.ts` | 全局状态（所有组件可能依赖） |
| `src/services/tauri.ts` | 前端 invoke 统一封装 |
| `.trae/rules/*.md` | 规则体系（所有 Agent 依赖读取） |

### 1.1 修改 Tier-1 文件的唯一强制规则

> ❌ 禁止"只读取了需要改写的那几行"就直接 Edit
> ✅ **修改 Tier-1 文件前必须先完整读取整个文件**

原因：如果只读几行，会丢失该文件其他人刚刚写入的内容，也会破坏整个文件的结构完整性。

### 1.2 修改时的实用规范

- 同一 Tier-1 文件，建议同一对话内串行修改（避免前一次编辑覆盖后一次的预期）
- 新 command 函数追加到 `lib.rs` 的列表末尾，不重排
- 新权限追加到 `capabilities/default.json` 的数组末尾，不重排
- 必须用"旧内容字符串匹配"定位修改位置（不按行号）

---

## 二、次核心文件（Tier-2）

| 文件 | 建议策略 |
|------|---------|
| `src-tauri/src/services/*_service.rs` | 不同 *_service.rs 彼此独立；同一文件内建议串行修改 |
| `src-tauri/src/commands/*.rs` | 不同领域 commands 彼此独立 |
| `src/store/*Store.ts` | 各 Store 彼此独立 |
| `docs/架构现状.md` | 新增条目形式的追加通常无冲突；结构性修改需先读取最新版本 |

---

## 三、非冲突文件（Tier-3）

以下文件彼此互不影响，可并行修改：

- 新创建的组件文件（如 `src/components/new-feature/*.tsx`）
- 新创建的纯逻辑模块（如 `src/utils/*.ts`）
- `docs/` 目录下的独立文档
- 图片资源文件
- `.trae/specs/` 下的 spec 文件

---

## 三、如何用 MCP 工具验证本规则

| 验证项 | 命令（PowerShell 环境） | 说明 |
|--------|------------------------|------|
| Tier-1 文件清单完整性 | `Test-Path src-tauri/src/lib.rs; Test-Path src-tauri/tauri.conf.json; Test-Path src-tauri/Cargo.toml; Test-Path package.json; Test-Path src/App.tsx; Test-Path src/store/appStore.ts; Test-Path src/services/tauri.ts; Test-Path .gitignore` | 所有路径返回 True |
| 修改前是否完整读取 | `Get-ChildItem -Path src-tauri/src/lib.rs \| Select-Object Length` | 修改前必须先用 Filesystem MCP `read_file` 完整读取 |
| 三处版本号一致 | `Get-Content package.json \| Select-String '"version"'; Get-Content src-tauri/Cargo.toml \| Select-String '^version'; Get-Content src-tauri/tauri.conf.json \| Select-String '"version"'` | 三处版本号字符串完全相同 |
| 命令注册与权限同步 | `Get-Content src-tauri/src/lib.rs \| Select-String '#\[tauri::command\]' \| Measure-Object; Get-Content src-tauri/capabilities/default.json \| Select-String '"commands"' \| Measure-Object` | command 函数数量应与 capabilities 中注册的命令数一致 |

> 版本变更记录：见 [AGENTS.md](file:///e:/LA_DUCK/la-duck/AGENTS.md)。

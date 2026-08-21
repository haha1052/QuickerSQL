# QuickerSQL MCP 工具使用指南 v10.0

> 优先级：高。AI 在 Code/IDE 模式下做开发时的工具使用规范。
> 配套文档：[AGENTS.md 第七部分（§7）](file:///e:/LA_DUCK/la-duck/AGENTS.md)
> 生效范围：主 Agent 与所有子 Agent（通过 general_purpose_task 发起的任务）
> 版本：**v12.0**（2026-07-17，与 AGENTS.md 同步；增加 Spec-MD 规格驱动开发工具说明、MCP 工具验证命令汇总、典型任务的工具调用模板）。版本变更记录仅在 [AGENTS.md](file:///e:/LA_DUCK/la-duck/AGENTS.md) 中维护。

---

## 一、工具总览

| 工具 | 适用场景 | 典型命令 | 安全等级 |
|------|---------|---------|---------|
| `filesystem` | 读代码、搜文件、列目录 | `read_file(path)` / `list_directory(path)` / `search(dir, pattern)` | ✅ 安全 |
| `windows_cli` | 编译、测试、数据库、git、启动应用 | `cargo check --quiet` / `npx tsc --noEmit --pretty` / `sqlite3 路径.db "SQL"` / `git status` | ⚠️ 需要用户确认写操作 |
| `ollama_custom` | 代码解释、代码生成、写文档、代码审查 | 本地推理 | 模型名：`qwen2.5:7b` |
| `github` | 查仓库、issues、commit、PR、管理 | 写操作需要用户确认 |
| `browser_use` | 打开本地应用、截图、UI 验证 | 打开 http://localhost:1420 |
|  `browser_use` 仅在确实需要打开浏览器验证页面时使用，默认不启动 |

---

## 二、filesystem — 详细规范

### 2.1 常用操作

| 操作 | 示例 | 注意事项 |
|------|------|---------|
| 读单个文件 | `read_file("src-tauri/src/services/task_service.rs")` | 路径必须是绝对路径或以项目根目录开始 |
| 列目录 | `list_directory("src/components/")` | 不要一次列太深的嵌套目录 |
| 搜索关键词 | `search("src-tauri/src/", "SqlIdentifier")` | 搜索范围不要太大，先缩小目录范围，每次不超过 3 个目录 |

### 2.2 文件读取限制

- 一次对话最多读 **3 个大文件**（> 300 行）。如果需要读更多，**分多次读**，先给用户摘要。
- 读文件必须给出**文件路径**，不要让用户把代码贴到对话里。
- 如果文件中有多个函数，优先读相关部分，不要整文件全读进来。

### 2.3 典型使用案例

**案例**：用户问"task_service.rs 里的 `cancel_task 是怎么实现的？"

正确流程：
```
第一步：filesystem.read_file("路径/src-tauri/src/services/task_service.rs")
第二步：定位到 cancel_task 函数的位置
第三步：给用户分析该函数的输入、输出、错误处理、数据流
```

错误流程：
```
❌ 直接凭记忆回答（可能记错或回答）
```

---

## 三、windows_cli — 命令执行规范

### 3.1 常用命令速查

| 场景 | 命令 | 预期输出 |
|------|------|---------|
| Rust 编译检查 | `cd 项目根; cargo check --quiet` | 0 errors / 具体错误信息 |
| Rust 测试 | `cd 项目根; cargo test` | 测试结果（多少 passed） |
| TS 类型检查 | `cd 项目根; npx tsc --noEmit --pretty` | 0 errors / 具体类型错误 |
| 前端构建 | `cd 项目根; npm run build` | 构建产物大小、有没有 error |
| Git 状态 | `cd 项目根; git status` | 当前分支、改动文件列表 |
| Git 最近 commit | `cd 项目根; git log --oneline -10` | commit 哈希 + 一行摘要 |
| SQLite 数据库表名 | `sqlite3 "C:\Users\xxx\AppData\...\main.db" ".tables"` | 系统表列表 |
| SQLite 查询 | `sqlite3 "路径.db" "SELECT * FROM __automation_tasks LIMIT 5"` | 查询结果 |
| 启动应用 | `cd 项目根; npm run tauri dev` | 开发服务器启动日志 |

### 3.2 必须先进入项目目录再执行命令。

### 3.3 写操作 / 破坏性操作必须先让用户确认：
- `git commit -m "..."` → 必须先给用户看过 diff，再提交
- `cargo build --release` → 仅在用户明确要求时执行
- 任何 `DELETE / DROP / rm / DEL 类命令 → 一律先跟用户确认

### 3.4 超时 / 终止 / 重试策略

| 场景 | 策略 |
|------|------|
| 命令执行 > 60 秒未返回 | 先告诉用户"命令执行中，请稍候"，继续等待最多 120 秒（长构建除外） |
| 120 秒超时后 | 终止该命令，告诉用户"超时了，请手动在终端执行"，并给出完整命令供用户复制 |
| 命令执行失败 | 把命令 + 完整错误输出回传给用户；给出下一步建议（"看起来像是缺少某个依赖 / 目录路径不对"） |
| `npm run tauri dev` 启动失败 | 告诉用户错误内容；建议检查 Node.js 版本、依赖是否安装完整；必要时 `npm install` 重试 |
| `cargo build` 长时间未响应 | 不强制终止，告诉用户"Rust 首次构建会下载依赖，可能需要 5-10 分钟，请耐心等待" |

### 3.5 重试策略

- `cargo check` 第一次失败 → 先检查依赖是否安装完整，再重试一次
- `npx tsc` 第一次失败 → 检查是否 `npm install` 后再重试一次
- `sqlite3` 路径访问失败 → 检查路径是否正确、数据库文件是否存在，再重试一次
- **任何破坏性命令（DELETE / DROP / rm / DEL）永不重试**，失败即停止并告知用户

---

## 四、ollama_custom — 本地大模型使用规范

### 4.1 模型选择

| 任务类型 | 推荐模型 |
|---------|--------|
| 代码解释 / 代码分析 | `qwen2.5:7b`
| 代码生成 / 重构 | `qwen2.5:7b`
| 写文档 / 写注释 | `qwen2.5:7b`
| SQL 生成 / 优化 | `qwen2.5:7b`

默认都是 `qwen2.5:7b`，有需要换模型时先告诉用户。

### 4.2 使用约束（用 ollama 前必须做的事）

用 ollama 做代码分析 / 生成时，**必须先读取相关文件内容作为上下文**。禁止凭空让 ollama 生成代码。

| 用 ollama 前 | 必须做 | 为什么 |
|------------|--------|-------|
| 代码生成 / 重构 | 先 `filesystem.read_file` 读取相关文件 | 让生成的代码匹配项目现有风格 |
| SQL 生成 | 先读取相关 model/service 定义 | 确保生成的是参数化查询 |
| 写测试 | 先读取被测文件 + 同目录已有测试 | 让测试匹配项目风格 |

**推荐的三段式流程：**
```
filesystem.read_file(读取上下文）
   ↓
ollama_custom：基于真实文件内容生成方案
   ↓（写入代码后）
windows_cli: cargo check / npx tsc 验证能编译
```

### 4.3 生成代码的长度限制

- 单次最多生成 **50 行**代码；超过的话分多次生成，让用户确认。
- 生成的代码必须**严格遵守项目现有风格**：snake_case、PascalCase、参数化查询、错误处理风格等。

### 4.4 超时 / 终止 / 重试策略

| 场景 | 策略 |
|------|------|
| ollama 响应 > 30 秒未返回 | 先告诉用户"本地模型推理中，请稍候"，继续等待最多 60 秒 |
| 60 秒超时后 | 改用 AI 自身推理能力给出方案（注明"本地模型无响应，以下方案未经验证"） |
| ollama 第一次调用失败 | 重试一次（最多 1 次）；仍失败则走上面的超时降级路径 |
| 推理过程中发现生成的代码违反安全规则 | 立即停止生成，用红色标记说明问题，并给出安全替代方案 |

---

## 五、github — GitHub API 使用规范

### 5.1 常用场景

| 场景 | 操作 | 是否需要用户确认 |
|------|------|-----------------|
| 查看最近 commit | `查最近 10 条 commit` | 否 |
| 查看 open issues | `列出所有 open issues` | 否 |
| 创建 issue | `新建 issue` | **必须让用户确认** |
| 查看 PR | `列出/查看 PR` | 否 |
| push / merge | 实际执行 | **必须让用户确认** |

---

## 六、browser_use — 浏览器工具使用规范

### 6.1 什么时候用

- 用户问"页面看起来怎么样"
- 改完 UI 后想验证视觉效果
- 想打开文档页面

### 6.2 典型流程

```
第一步：windows_cli: npm run tauri dev（先启动服务器）
       ↓（等 10-15 秒）
第二步：browser_use: 打开 http://localhost:1420
       ↓
第三步：截图回传给用户看
```

### 6.3 用完后请告知用户浏览器可能仍然在跑，用完后不需要保留着

---

## 七、推荐工作流对照速查表

| 用户问题类型 | 第一步 | 第二步 | 第三步 | 第四步 |
|-----------|-------|-------|--------|--------|
| "这段代码有什么问题？ | filesystem.read_file | windows_cli: cargo check | 基于真实信息分析 | ollama_custom（可选） |
| "帮我写测试" | filesystem.read_file(被测文件) | filesystem.read_file(同目录测试文件) | ollama_custom: 生成测试代码 | windows_cli: 跑测试验证 |
| "能编译过吗？ | windows_cli: cargo check / npx tsc | — | — | — |
| "SQL 怎么写？" | filesystem.read_file(相关模型定义) | ollama_custom: 生成参数化 SQL | 写回代码 | windows_cli: cargo check 验证 |
| "帮我解释这个函数 | filesystem.read_file(该函数所在文件) | ollama_custom: 解释代码结构 + 逻辑 | 返回用户总结 | — |
| "最近提交了什么？ | github 或 windows_cli: git log | — | — | — |
| "页面看起来正常吗？ | windows_cli: npm run tauri dev | browser_use: 打开页面截图 | 返回用户看 | — |

---

## 八、常见问题排查

### 8.1 某个 MCP 工具调用失败时怎么办

按以下优先级处理：

| 失败工具 | 首选替代方案 | 次选替代方案 | 都失败时 |
|---------|-------------|-------------|-----------|
| filesystem | windows_cli: cat 路径 / dir 路径 | 让用户自己打开文件看 | 告诉用户该工具当前不可用 |
| ollama_custom | 让用户手动执行 ollama run qwen2.5:7b | 用 AI 自身推理能力 | 告诉用户本地模型暂不可用 |
| github | windows_cli: git log / git status | 让用户自己去 GitHub 看 | 告诉用户 Github API 暂不可用 |
| browser_use | 让用户自己打开应用看 | 用 filesystem + 让用户验证 | 告诉用户浏览器工具不可用 |
| windows_cli | 让用户手动在终端跑命令 | 用 filesystem 读报错文件 | 告诉用户当前无法执行命令 |

### 8.2 速度慢怎么办

如果 MCP 工具响应慢（>15 秒），应该先告诉用户"这个操作可能需要等一会儿，请稍等。然后继续等结果。

### 8.3 ollama_custom 没启动怎么办

先在 windows_cli 里跑 `ollama list` 确认 ollama 在运行。

---

## 九、使用原则（总领所有其他规则）

1. **能用工具拿到答案的，绝不靠猜。
2. **工具结果必须**必须**有引用工具结果。
3. **用户问代码问题，先读后分析。
4. **安全优先。

---

## 十、补充：Spec-MD 规格驱动开发工具说明

### 10.1 Spec-MD 的核心价值

> **"在写代码之前，先定义什么叫完成。"**

传统开发的最大问题：没有验收标准，边界不清晰。Spec-MD 解决的是：

1. **明确边界**：每个开发任务先写 spec.md，说明 Goals（要做什么）、Non-Goals（不做什么）、Acceptance Criteria（怎么才算完成）
2. **工具验证**：Acceptance Criteria 中写的是具体命令（如 `cargo check --quiet`、`grep` 检测等），而不是模糊描述
3. **用户确认**：用户先确认 spec，AI 再写代码，避免大方向走偏

### 10.2 什么时候用 Spec-MD

| 场景 | 是否需要 Spec-MD |
|------|-----------------|
| 新增功能 / 新模块 | ✅ 必须 |
| 重构 / 架构变更 | ✅ 必须 |
| 代码修改 > 50 行 | ✅ 建议 |
| 代码修改 < 50 行且目标明确 | ⚠️ 可选（但建议写迷你 spec） |
| 纯 bug 修复（明确问题所在） | ❌ 不需要 |

### 10.3 Spec-MD 的最小 spec.md 模板

```
# <版本号> <任务名> — Product Requirement Document

## Overview
· Summary：一句话说明做什么、为什么做

## Goals（必须量化，不能模糊）
· G1：<具体目标，可用命令验证>

## Non-Goals（明确不做什么，禁止写空话）
· ❌ 不做 XXX

## Background & Context
· 当前架构现状 / 问题分析

## Functional Requirements
· FR-1：<具体的功能需求>

## Acceptance Criteria（验收标准，必须写清用什么命令验证）
· AC-1：<标准内容，Verification: programmatic/human-judgment>

## Files Changed（明确修改范围）
· src-tauri/src/services/xxx_service.rs
· src/components/xxx/XXX.tsx

## Open Questions（未确定事项）
· [ ] Q1：...
```

### 10.4 Spec-MD 的典型流程

```
第一步：生成 spec.md（AI 写，用户确认）
  ↓
第二步：Filesystem MCP 读取相关文件（了解代码风格/结构）
  ↓
第三步：写代码（按 architecture.md/coding.md/security.md 约束）
  ↓
第四步：Windows CLI MCP 执行验证命令（cargo check / npx tsc / grep）
  ↓
第五步：输出"可验证变更清单"（见 AGENTS.md §6）
  ↓
第六步：用户确认（根据 spec 验收标准和验证结果）
```

---

## 十一、补充：MCP 工具失败降级对照表（速查）

| 失败工具 | 首选替代方案 | 次选替代方案 | 都失败时 |
|---------|-------------|-------------|----------|
| filesystem | windows_cli: `Get-Content 路径` 或 `dir 路径` | 让用户自己打开文件看 | 告诉用户该工具当前不可用 |
| ollama_custom | 让用户手动执行 `ollama run qwen2.5:7b` | 用 AI 自身推理能力（注明"本地模型无响应，以下方案未经验证"） | 告诉用户本地模型暂不可用，请先确认 ollama 已启动 |
| github | windows_cli: `git log` / `git status` | 让用户自己去 GitHub 看 | 告诉用户 Github API 暂不可用 |
| browser_use | 让用户自己打开应用看 | 用 filesystem + 让用户验证 | 告诉用户浏览器工具不可用 |
| windows_cli | 让用户手动在终端跑命令 | 用 filesystem 读报错信息 | 告诉用户当前无法执行命令，请手动操作 |
| **Spec-MD** | 用户手动定义 Goals/Acceptance Criteria | 在对话中用文字描述验收标准 | 降级为"目标明确后再开发"模式 |

---

## 十二、MCP 工具验证命令汇总表（一键复制执行）

> **核心门禁命令**：每次代码修改后必须执行以下命令并确认通过。

| 类别 | 命令（PowerShell 环境） | 通过标准 | 引用规则文件 |
|------|------------------------|---------|-------------|
| **编译门禁** | `cd src-tauri; cargo check --quiet 2>&1 \| Select-Object -Last 5` | 无 error | [test.md](file:///e:/LA_DUCK/la-duck/.trae/rules/test.md) |
| **编译门禁** | `npx tsc --noEmit --pretty 2>&1 \| Select-Object -Last 10` | 0 errors | [test.md](file:///e:/LA_DUCK/la-duck/.trae/rules/test.md) |
| **测试门禁** | `cd src-tauri; cargo test --quiet 2>&1 \| Select-Object -Last 10` | 无 FAIL | [test.md](file:///e:/LA_DUCK/la-duck/.trae/rules/test.md) |
| **安全门禁-SQL注入（两段式）** | `cd src-tauri; $m = Get-ChildItem -Path src -Include *.rs -Recurse \| Select-String -Pattern 'format!\s*\(".*(SELECT\|INSERT\|UPDATE\|DELETE\|CREATE\|ALTER\|DROP)' -CaseSensitive:$false; $v = $m \| Where-Object { $_.Line -notmatch 'ident\.quoted\(\)\|SqlIdentifier\|safe_' }; $v \| Format-Table -AutoSize; Write-Host "潜在违规数: $($v.Count)"` | **潜在违规数 = 0**（排除 SqlIdentifier 封装后的违规数） | [security.md](file:///e:/LA_DUCK/la-duck/.trae/rules/security.md) |
| **安全门禁-敏感字符串** | `Get-ChildItem -Path src-tauri/src,src -Include *.rs,*.ts,*.tsx -Recurse \| Select-String -Pattern 'sk-\|Bearer \|ghp_\|eyJ\|password:' \| Measure-Object \| Select-Object Count` | **Count = 0** | [security.md](file:///e:/LA_DUCK/la-duck/.trae/rules/security.md) |
| **安全门禁-前端SQL拼接（v26.2 修订，case-sensitive + 排除 SQL 工具目录 + safe_sql 白名单）** | `Get-ChildItem -Path src -Include *.ts,*.tsx -Recurse -File \| Where-Object { $_.FullName -notmatch '\\components\\sql\\' -and $_.FullName -notmatch '\\utils\\sql' -and $_.FullName -notmatch '\\utils\\resultCopy' -and $_.FullName -notmatch '\\__tests__\\' -and $_.FullName -notmatch '\\context\\LocaleContext\.tsx$' -and $_.Name -notmatch '\.test\.tsx?$' } \| Select-String -Pattern 'SELECT\|INSERT\|UPDATE\|DELETE' -CaseSensitive \| Where-Object { $_.Line -notmatch '//\s*safe_sql' } \| Measure-Object \| Select-Object Count` | **Count = 0**（case-sensitive 匹配 + 排除 SQL 客户端工具类目录 + safe_sql 白名单后） | [security.md](file:///e:/LA_DUCK/la-duck/.trae/rules/security.md) |
| **代码规范-unwrap** | `Get-ChildItem -Path src-tauri/src -Include *.rs -Recurse \| Select-String -Pattern "\.unwrap\(\)\|\.expect\(" \| Measure-Object \| Select-Object Count` | **Count = 0**（测试代码除外） | [coding.md](file:///e:/LA_DUCK/la-duck/.trae/rules/coding.md) |
| **代码规范-TS any** | `Get-ChildItem -Path src -Include *.ts,*.tsx -Recurse \| Select-String -Pattern ": any\|as any" \| Measure-Object \| Select-Object Count` | **Count = 0** | [coding.md](file:///e:/LA_DUCK/la-duck/.trae/rules/coding.md) |
| **代码规范-调试残留** | `Get-ChildItem -Path src -Include *.ts,*.tsx -Recurse \| Select-String -Pattern "console\.log" \| Select-String -NotMatch "//" \| Measure-Object \| Select-Object Count` | **Count = 0** | [coding.md](file:///e:/LA_DUCK/la-duck/.trae/rules/coding.md) |
| **架构规范-目录结构** | `Get-ChildItem -Path src-tauri/src -Directory \| Select-Object Name; Get-ChildItem -Path src -Directory \| Select-Object Name` | Rust 至少 5 目录并列；TS 至少 5 目录并列 | [architecture.md](file:///e:/LA_DUCK/la-duck/.trae/rules/architecture.md) |
| **发布规范-版本号一致** | `Get-Content package.json \| Select-String '"version"'; Get-Content src-tauri/Cargo.toml \| Select-String '^version'; Get-Content src-tauri/tauri.conf.json \| Select-String '"version"'` | 三处版本号字符串完全相同 | [release.md](file:///e:/LA_DUCK/la-duck/.trae/rules/release.md) |

> **使用原则**：所有上述命令都可以在 Windows CLI MCP 中执行，不需要人工分析代码。前 8 项（编译门禁 + 安全门禁 + 代码规范门禁）是**非 0 不通过**的硬门禁。

> 版本变更记录：见 [AGENTS.md](file:///e:/LA_DUCK/la-duck/AGENTS.md)。

# Trae 多任务并行：根目录选择 vs 任务描述约束

> 版本：v1.0（2026-06-24）
> 核心问题：选择子文件夹作为项目根目录，会不会影响任务？

---

## 一、直接答案

### ❌ 不能用"选择子文件夹作为根目录"来隔离模块

**原因：智能体会失去对项目关键文件的访问权。**

| 失去的东西 | 影响 |
|-----------|------|
| `package.json` | 不知道项目依赖，无法正确生成代码 |
| `tsconfig.json` | TypeScript 编译失败 |
| `Cargo.toml` | Rust 编译失败 |
| `.trae/rules/*.md` | 不遵守项目规则（架构、安全、命名规范等） |
| `.trae/specs/` | 看不到规格文档 |
| `AGENTS.md` | 不知道项目整体约定 |

---

## 二、具体影响分析（以 QuickersQL 为例）

### 场景：选择 `src/components/dashboard/` 作为根目录

```
你以为的效果：
✅ 只能修改 dashboard 目录的文件
✅ 不会干扰其他模块

实际的效果：
❌ 看不到 package.json → 不知道用 React 还是 Vue
❌ 看不到 tsconfig.json → tsc 命令报错
❌ 看不到 .trae/rules/ → 不遵守架构规则
❌ 看不到 types/ → 不知道类型定义
❌ 看不到 store/ → 不知道状态管理
❌ 编译验证全部失败
```

### 为什么会这样？

Trae 的工作原理：

```
项目根目录
  ├── package.json          ← 智能体需要读这个
  ├── tsconfig.json         ← 智能体需要读这个
  ├── .trae/
  │   └── rules/            ← 智能体需要读这个
  └── src/
      ├── components/
      │   └── dashboard/    ← 你想限制在这里
      ├── store/
      └── types/
```

**如果把 dashboard/ 设为根目录：**
- 智能体"看不到"上面的所有文件
- 就像在一个全新的空目录里工作
- 完全不知道这是一个 React + Tauri 项目

---

## 三、正确的隔离方式：任务描述约束

### ✅ 推荐方式：项目根目录不变，在任务描述中限定范围

```
项目根目录：e:\LA_DUCK\la-duck\  （保持不变）

任务描述中写：
"只修改 src/components/dashboard/ 目录，禁止修改其他目录"
```

**效果对比：**

| 对比项 | 选子文件夹做根 | 任务描述约束 |
|--------|--------------|-------------|
| 能读 package.json | ❌ 不能 | ✅ 能 |
| 能读 .trae/rules/ | ❌ 不能 | ✅ 能 |
| 能运行 tsc 验证 | ❌ 失败 | ✅ 正常 |
| 能运行 cargo check | ❌ 失败 | ✅ 正常 |
| 只修改目标目录 | ⚠️ 被迫（但无知） | ✅ 主动遵守 |
| 代码质量 | ❌ 差（不懂规则） | ✅ 好（懂规则） |

---

## 四、具体操作流程

### 正确流程（推荐）

```
1. Trae 打开项目：e:\LA_DUCK\la-duck\  （整个项目根目录）
   
2. 发起任务A（对话1）：
   "请改进 src/components/dashboard/ 目录下的仪表盘拖拽体验。
    约束：只修改 src/components/dashboard/ 目录，
         不要修改 src/components/automation/、src/store/ 等其他目录。"
   
3. 发起任务B（对话2）：
   "请改进 src/components/automation/ 目录下的任务日志展示。
    约束：只修改 src/components/automation/ 目录，
         不要修改 src/components/dashboard/、src/store/ 等其他目录。"
   
4. 两个任务并行执行，互不干扰
```

### 错误流程（不推荐）

```
1. Trae 打开项目：e:\LA_DUCK\la-duck\src\components\dashboard\
   （选 dashboard 子文件夹作为根）
   
2. 发起任务A
   → 智能体看不到 package.json，乱生成代码
   → tsc 验证失败
   → 不遵守项目规则
   
3. 另开 Trae 窗口打开：e:\LA_DUCK\la-duck\src\components\automation\
   （选 automation 子文件夹作为根）
   
4. 发起任务B
   → 同样的问题
```

---

## 五、任务描述约束的写法模板

### 模板1：前端组件模块

```
请修改 src/components/【模块名】/ 目录下的文件。

【具体需求】
1. 需求1
2. 需求2

【禁止访问】
- src/components/【其他模块】/
- src/store/
- src/pages/
- src/App.tsx
- src-tauri/

【验收标准】
1. npx tsc --noEmit 通过
2. 功能正常工作
```

### 模板2：后端服务模块

```
请修改 src-tauri/src/services/【服务名】_service.rs 和
src-tauri/src/commands/【命令名】.rs 文件。

【具体需求】
1. 需求1
2. 需求2

【禁止访问】
- src-tauri/src/lib.rs
- src-tauri/src/database/
- src-tauri/Cargo.toml
- src/

【验收标准】
1. cargo check --quiet 通过
2. cargo test 通过
```

---

## 六、QuickersQL 可并行模块清单

基于任务描述约束的方式，以下模块可以安全并行：

### 前端模块

| 模块 | 目录 | 可并行的模块 |
|------|------|-------------|
| 仪表盘 | `src/components/dashboard/` | 自动化、导入、设置 |
| 自动化 | `src/components/automation/` | 仪表盘、导入、设置 |
| 数据导入 | `src/components/import/` | 仪表盘、自动化、设置 |
| SQL查询 | `src/components/sql/` | 自动化、导入、回收站 |
| 回收站 | `src/components/trash/` | 仪表盘、自动化、导入 |

### 后端模块

| 模块 | 文件 | 可并行的模块 |
|------|------|-------------|
| 仪表盘服务 | `services/dashboard_service.rs` | 自动化、回收站、设置 |
| 自动化服务 | `services/task_service.rs` | 仪表盘、回收站、设置 |
| 回收站服务 | `services/trash_service.rs` | 仪表盘、自动化、设置 |
| 设置服务 | `services/settings_service.rs` | 仪表盘、自动化、回收站 |

---

## 七、如何验证智能体遵守了目录约束

### 方法1：Git 状态检查

任务完成后，在终端运行：

```powershell
git status
```

查看改动的文件是否都在预期目录内。

### 方法2：查看改动文件列表

```powershell
git diff --name-only
```

### 方法3：快速验证

```powershell
# 检查是否修改了禁止的目录
git diff --name-only | Select-String "src/store/|src/App.tsx|src-tauri/src/lib.rs"
```

如果有输出，说明智能体越界了。

---

## 八、常见问题

### Q1：智能体不遵守目录约束怎么办？

**A：** 在任务描述中强调 + 事后检查。

```
在任务开头强调：
"重要：本任务严格限制在 src/components/dashboard/ 目录内。
如果需要修改其他目录的文件，请先询问我，不要直接修改。"

在任务结尾再强调一次：
"再次确认：只修改 src/components/dashboard/ 目录下的文件。"
```

### Q2：任务需要跨目录怎么办？

**A：** 确需跨目录时，明确列出允许访问的目录。

```
允许修改：
- src/components/dashboard/
- src/store/dashboardStore.ts
- src/types/dashboard.ts

禁止修改：
- src/components/automation/
- src/components/import/
- src/App.tsx
```

### Q3：两个任务都改了同一个文件怎么办？

**A：** 用 Git 合并，或串行执行。

```
如果两个任务都修改了：
- src/types/xxx.ts （类型定义）

处理方式：
1. 先让任务A完成
2. 再让任务B在任务A的基础上继续
3. 或手动合并冲突
```

---

## 九、总结

| 方式 | 效果 | 推荐 |
|------|------|------|
| 选择子文件夹做根目录 | 智能体失去上下文，代码质量差 | ❌ 不推荐 |
| 任务描述约束目录 | 智能体有完整上下文，且遵守约束 | ✅ 推荐 |

**核心原则：**
- 项目根目录必须是完整的项目根（`e:\LA_DUCK\la-duck\`）
- 通过任务描述约束修改范围
- 用 Git 检查验证是否越界

---

> 版本：v1.0
> 创建日期：2026-06-24
> 适用：QuickersQL + Trae Solo

# Trae Solo 多任务并行操作指南

> 版本：v1.0（2026-06-24）
> 问题：手工发起多个任务，如何避免相互干扰

---

## 一、核心答案

### Trae Solo 不支持"选择文件夹"功能

Trae Solo 的 Code/IDE 模式没有"选择工作目录"或"限定任务范围"的 UI 控件。

### 解决方案：通过任务描述约束目录

```
✅ 有效方式：在任务描述中明确指定目录范围
❌ 无效方式：期望有 UI 控件选择文件夹
```

**具体写法：**

```
请只修改 src/components/dashboard/ 目录下的文件，禁止修改其他目录。
```

---

## 二、具体工作流（你的场景）

### 场景：同时改进仪表盘 + 检查自动化任务

```
你（手动操作）                        智能体A（仪表盘）          智能体B（自动化任务）
     │                                     │                         │
     │  发起任务A                          │                         │
     ├────────────────────────────────────>│                         │
     │  "改进 src/components/dashboard/"   │                         │
     │                                     │                         │
     │  [等待结果]                         ▼                         │
     │                              执行任务中...                    │
     │                                     │                         │
     │  看到任务A执行中...                  │                         │
     │  开始手动检查自动化任务界面           │                         │
     │  发现问题：日志展示不清晰            │                         │
     │                                     │                         │
     │  发起任务B                          │                         │
     ├─────────────────────────────────────────────────────────────>│
     │  "改进 src/components/automation/"                          │
     │                                     │                         │
     │  [继续等待两个任务]                  │                         │
     │                                     ▼                         ▼
     │                              任务A完成                   任务B执行中
     │                                     │                         │
     │  汇总结果                           │                         │
     ▼                                     ▼                         ▼
```

---

## 三、具体操作步骤

### 步骤 1：发起第一个任务（仪表盘改进）

在 Trae Solo 中新建一个对话，输入：

```
请改进 src/components/dashboard/ 目录下的仪表盘拖拽体验。

具体要求：
1. 改进 DashboardCanvas 的拖拽逻辑，支持网格吸附
2. 添加拖拽时的视觉占位符
3. 优化 DashboardItem 的 resize 体验

约束：
- 只修改 src/components/dashboard/ 目录
- 不要修改 src/store/、src/pages/Settings.tsx 等其他目录
- 每次修改后运行 npx tsc --noEmit 验证
```

### 步骤 2：等待执行 + 检查其他模块

任务A执行期间，你手动打开应用检查其他功能：
- 打开自动化任务页面
- 检查数据导入功能
- 查看设置页面

发现的问题记录下来。

### 步骤 3：发起第二个任务（自动化改进）

再新建一个对话，输入：

```
请改进 src/components/automation/ 目录下的任务日志展示。

具体要求：
1. 改进 TaskRunLogsPanel 的日志显示格式
2. 添加日志级别颜色区分（info/warn/error）
3. 优化日志时间戳显示

约束：
- 只修改 src/components/automation/ 目录
- 不要修改 src/components/dashboard/、src/store/ 等其他目录
- 每次修改后运行 npx tsc --noEmit 验证
```

### 步骤 4：汇总结果

两个任务都完成后，回到主会话汇总：

```
请帮我验证以下改动：
1. 运行 npx tsc --noEmit --pretty
2. 运行 cargo check --quiet
3. 检查是否有冲突文件
```

---

## 四、关键操作技巧

### 4.1 任务描述模板（直接复制使用）

```
请修改 src/【具体子目录】/ 目录下的文件。

【禁止访问】
- src/components/【其他目录】/
- src/store/
- src/pages/Settings.tsx
- src/App.tsx
- src-tauri/src/lib.rs

【验收标准】
1. [具体标准1]
2. [具体标准2]

请开始执行。
```

### 4.2 当前项目可并行目录组合

| 任务A | 任务B | 任务C |
|-------|-------|-------|
| `src/components/dashboard/` | `src/components/automation/` | `src/components/chart/` |
| `src/components/import/` | `src/components/sql/` | `src/components/common/` |
| `src/pages/Settings.tsx` | `src/store/settingsStore.ts` | - |

### 4.3 冲突风险评估

| 目录组合 | 冲突风险 | 说明 |
|----------|---------|------|
| dashboard/ + automation/ | ✅ 无 | 完全独立 |
| dashboard/ + chart/ | ✅ 无 | 完全独立 |
| sql/ + store/ | ⚠️ 中 | store可能被多个页面引用 |
| Settings.tsx + settingsStore.ts | ⚠️ 中 | 前后端接口相关 |
| dashboard/ + App.tsx | ❌ 高 | App.tsx引用dashboard组件 |

---

## 五、禁止同时发起的任务

以下任务组合**禁止同时发起**，因为会相互干扰：

| 任务A | 任务B | 原因 |
|-------|-------|------|
| 修改 `src/App.tsx` | 修改 `src/components/dashboard/` | App.tsx 引用仪表盘组件 |
| 修改 `src/store/appStore.ts` | 修改任何页面组件 | appStore是全局状态 |
| 修改 `src-tauri/src/lib.rs` | 修改任何 `src-tauri/src/services/` | lib.rs 注册所有命令 |
| 修改 `Cargo.toml` | 修改任何 Rust 代码 | 依赖变更可能影响编译 |
| 修改 `package.json` | 修改任何 TS/TSX 代码 | 依赖变更可能影响编译 |

---

## 六、实际示例（当前项目）

### 示例1：同时改进仪表盘 + 自动化任务

**任务A（对话1）：**
```
请只修改 src/components/dashboard/ 目录，实现以下改进：
1. 仪表盘网格拖拽时添加吸附效果
2. DashboardItem 支持双击全屏

禁止修改：src/components/automation/、src/store/、src/App.tsx
```

**任务B（对话2，同时发起）：**
```
请只修改 src/components/automation/ 目录，实现以下改进：
1. 任务运行日志支持滚动加载
2. 日志支持按级别筛选

禁止修改：src/components/dashboard/、src/store/、src/App.tsx
```

### 示例2：前端改进 + 后端优化

**任务A（对话1）：**
```
请只修改 src/components/sql/ 目录：
1. 优化查询结果的分页体验
2. 添加查询结果的列排序功能

禁止修改：src-tauri/、src/pages/、src/store/
```

**任务B（对话2，同时发起）：**
```
请只修改 src-tauri/src/services/ 目录：
1. 优化 database_service 的连接池管理
2. 添加慢查询日志记录

禁止修改：src/、Cargo.toml、src-tauri/src/lib.rs
```

---

## 七、验证与合并

### 7.1 任务完成后验证

每个任务完成后，在对应会话中执行：

```powershell
# 验证 TypeScript
npx tsc --noEmit --pretty

# 验证 Rust（如果涉及后端）
cargo check --quiet
```

### 7.2 检查改动冲突

在任一任务会话中执行：

```powershell
git status
```

如果出现冲突文件（同时被两个任务修改），需要手动合并。

### 7.3 安全检测命令

```powershell
# SQL 注入检测
Get-ChildItem -Path src,src-tauri/src -Include *.ts,*.tsx,*.rs -Recurse | Select-String -Pattern 'format!.*SELECT|SELECT\|INSERT' | Measure-Object

# 敏感字符串检测
Get-ChildItem -Path src,src-tauri/src -Include *.ts,*.tsx,*.rs -Recurse | Select-String -Pattern 'sk-|password:|Bearer '
```

---

## 八、总结：你的操作流程

```
1️⃣ 打开 Trae Solo，新建对话1
   └─> 输入任务A + 目录约束
   
2️⃣ 切换到应用，手动检查其他功能
   └─> 记录发现的问题
   
3️⃣ 新建对话2（不要关闭对话1）
   └─> 输入任务B + 目录约束
   
4️⃣ 等待两个任务都完成
   └─> 对话1结果 + 对话2结果
   
5️⃣ 在任一对话中运行验证命令
   └─> npx tsc --noEmit
   └─> cargo check --quiet
   
6️⃣ Git 提交
   └─> git add . && git commit -m "feat: 改进仪表盘和自动化任务"
```

---

## 九、快速参考卡

### 可以同时发起的任务组合

| ✅ 组合A | ✅ 组合B | ✅ 组合C |
|---------|---------|---------|
| dashboard/ | automation/ | chart/ |
| import/ | sql/ | common/ |
| pages/Settings.tsx | store/settingsStore.ts | - |

### ❌ 禁止同时发起的任务

| ❌ 任务A | ❌ 任务B | 原因 |
|---------|---------|------|
| 修改 appStore.ts | 修改任何页面 | 全局状态冲突 |
| 修改 lib.rs | 修改任何 service | 命令注册冲突 |
| 修改 App.tsx | 修改任何 component | 路由引用冲突 |

---

> 版本：v1.0
> 创建日期：2026-06-24
> 适用：QuickersQL 项目 + Trae Solo Code/IDE 模式

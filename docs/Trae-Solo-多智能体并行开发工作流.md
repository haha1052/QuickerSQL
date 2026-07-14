# Trae Solo 多智能体并行开发工作流方案

> 版本：v1.0（2026-06-24）
> 项目：QuickersQL
> 目标：解决单智能体串行开发效率低的问题，实现安全的多智能体并行开发

---

## 一、核心问题分析

### 1.1 当前困境

| 问题 | 原因 | 影响 |
|------|------|------|
| 大量时间等待 | 单智能体串行执行所有任务 | 开发效率低 |
| 分工后仍等待 | 未真正实现并行，都在排队 | 时间浪费 |
| 担心互相干扰 | 缺乏文件锁和模块隔离机制 | 不敢并行 |

### 1.2 并行开发的可行性与风险

| 可行性 | 风险等级 | 应对方案 |
|--------|---------|---------|
| ✅ 不同子目录的代码 | 低 | 目录隔离，几乎无冲突 |
| ✅ 不同语言的代码（TS vs Rust） | 低 | 技术栈隔离 |
| ⚠️ 同一模块的不同文件 | 中 | 必须串行或加锁 |
| ❌ Tier-1 核心文件 | 高 | 禁止并行修改 |

---

## 二、项目模块划分

### 2.1 前端模块划分（React/TypeScript）

| 模块 | 目录路径 | 职责 | 并行安全度 |
|------|---------|------|-----------|
| **M1: 仪表盘模块** | `src/components/dashboard/` | 仪表盘画布、图表项、布局管理 | ⭐⭐⭐⭐⭐ |
| **M2: 可视化模块** | `src/components/chart/` | 图表配置、渲染、类型选择 | ⭐⭐⭐⭐⭐ |
| **M3: SQL 查询模块** | `src/components/sql/` | SQL 编辑器、结果展示、查询执行 | ⭐⭐⭐⭐ |
| **M4: 自动化任务模块** | `src/components/automation/` | 任务中心、任务编辑、运行日志 | ⭐⭐⭐⭐⭐ |
| **M5: 数据导入模块** | `src/components/import/` | CSV/Excel 导入、文件队列 | ⭐⭐⭐⭐⭐ |
| **M6: 状态管理层** | `src/store/` | Zustand 状态管理 | ⭐⭐⭐ |
| **M7: 国际化模块** | `src/context/LocaleContext.tsx` | 中英文翻译 | ⭐⭐⭐⭐ |
| **M8: 设置页面** | `src/pages/Settings.tsx` | 设置 UI + `src/store/settingsStore.ts` | ⭐⭐⭐ |
| **M9: 全局组件** | `src/components/common/` | 通用组件（图标、按钮等） | ⭐⭐⭐ |

### 2.2 后端模块划分（Rust）

| 模块 | 目录/文件 | 职责 | 并行安全度 |
|------|----------|------|-----------|
| **B1: 仪表盘服务** | `services/dashboard_service.rs` + `commands/dashboard.rs` | 仪表盘 CRUD | ⭐⭐⭐⭐⭐ |
| **B2: 自动化任务服务** | `services/task_service.rs` + `commands/automation.rs` | 任务调度、执行 | ⭐⭐⭐⭐⭐ |
| **B3: 数据库服务** | `services/database_service.rs` + `commands/database.rs` | 数据库连接管理 | ⭐⭐⭐ |
| **B4: 设置服务** | `services/settings_service.rs` + `commands/settings.rs` | 应用设置 | ⭐⭐⭐⭐ |
| **B5: 回收站服务** | `services/trash_service.rs` + `commands/trash.rs` | 回收站管理 | ⭐⭐⭐⭐⭐ |
| **B6: 数据库层** | `database/` 目录 | DuckDB/SQLite 访问 | ⭐⭐ |
| **B7: 数据模型** | `models/` 目录 | 数据结构定义 | ⭐⭐⭐⭐ |

### 2.3 并行开发矩阵

```
✅ 可以并行（同一行内可同时进行）
┌─────────────────────────────────────────────────────────────┐
│  M1(dashboard) + M4(automation) + M5(import) + M7(i18n)     │
│  B1(dashboard) + B2(automation) + B5(trash)               │
│  M6(store) + M9(common)  【通用模块，可与其他并行】          │
└─────────────────────────────────────────────────────────────┘

⚠️ 谨慎并行（需要协调）
┌─────────────────────────────────────────────────────────────┐
│  M3(sql) + B3(database) 【涉及数据库层，可能冲突】           │
│  M8(settings) + B4(settings) 【设置相关，需同步】           │
│  B6(database/) + B7(models/) 【底层依赖，可能影响多个服务】 │
└─────────────────────────────────────────────────────────────┘

❌ 禁止并行（Tier-1 文件，必须串行）
┌─────────────────────────────────────────────────────────────┐
│  lib.rs / tauri.conf.json / Cargo.toml / package.json     │
│  App.tsx / appStore.ts / tauri.ts / rules/*.md            │
└─────────────────────────────────────────────────────────────┘
```

---

## 三、多智能体并行工作流

### 3.1 角色分配策略

| 角色 | 负责任务类型 | 可访问目录 |
|------|-------------|-----------|
| **Agent-A** | 前端 UI 开发（仪表盘、可视化、自动化） | `src/components/automation/`、`src/components/dashboard/`、`src/components/chart/` |
| **Agent-B** | 前端功能开发（SQL、导入、设置） | `src/components/sql/`、`src/components/import/`、`src/pages/`、`src/store/` |
| **Agent-C** | 后端服务开发 | `src-tauri/src/services/`、`src-tauri/src/commands/` |
| **Agent-D** | 架构/规则维护（需要单独授权） | `.trae/rules/`、`docs/`、`AGENTS.md` |

### 3.2 具体操作流程

#### 阶段一：任务规划（5 分钟）

```
1. 用户在主会话中分析需求
   ↓
2. 将需求拆分为独立模块任务
   ↓
3. 识别并行可能性和冲突风险
   ↓
4. 为每个智能体分配独立模块 + 具体任务
```

**示例：改进仪表盘 + 自动化任务两个模块**

| 智能体 | 模块 | 具体任务 |
|--------|------|---------|
| Trae-1 | 仪表盘模块 | 改进图表拖拽体验 |
| Trae-2 | 自动化任务模块 | 添加任务执行日志 |

#### 阶段二：并行执行（各智能体独立工作）

```
Trae-1 (仪表盘)                    Trae-2 (自动化任务)
     │                                  │
     ├─> 读取 dashboardStore.ts         ├─> 读取 taskStore.ts
     ├─> 读取 DashboardItem.tsx         ├─> 读取 TaskCenterPage.tsx
     ├─> 读取 DashboardCanvas.tsx       ├─> 读取 TaskRunLogsPanel.tsx
     │                                  │
     ├─> 分析拖拽实现                   ├─> 分析日志展示逻辑
     ├─> 编写改进代码                   ├─> 编写日志增强代码
     │                                  │
     ├─> 运行 tsc 验证                  ├─> 运行 tsc 验证
     │                                  │
     ▼                                  ▼
  ✅ 任务完成                        ✅ 任务完成
```

#### 阶段三：合并与验证（10 分钟）

```
1. 每个智能体完成任务后报告
   ↓
2. 汇总改动到主会话
   ↓
3. 在主会话运行整体验证：
   - cargo check --quiet
   - npx tsc --noEmit --pretty
   - cargo test --quiet
   ↓
4. Git 提交（分模块 commit）
```

### 3.3 任务描述模板

给每个智能体的任务描述必须包含：

```
【任务分配】
- 模块：<模块名称>
- 目录：<具体目录路径>
- 禁止访问：<禁止修改的目录>

【任务目标】
- 具体要实现什么功能
- 具体的验收标准

【执行约束】
- Tier-1 文件禁止修改
- 每次修改后运行 tsc/cargo check 验证
- 完成后报告改动清单
```

**示例任务描述（给 Trae-1）：**

```
## Trae-1 任务：改进仪表盘拖拽体验

### 模块分配
- ✅ 可修改：`src/components/dashboard/`、`src/store/dashboardStore.ts`
- ❌ 禁止修改：其他所有目录

### 任务目标
1. 改进 DashboardCanvas 的拖拽逻辑，支持网格吸附
2. 添加拖拽时的视觉反馈（占位符）
3. 优化 DashboardItem 的 resize 体验

### 验收标准
- [ ] 拖拽时网格吸附工作正常
- [ ] 视觉反馈清晰
- [ ] tsc 编译通过

### 执行流程
1. 先读取 DashboardCanvas.tsx 和 dashboardStore.ts
2. 分析现有拖拽实现
3. 编写改进代码
4. 运行 npx tsc --noEmit 验证
5. 报告改动文件列表
```

---

## 四、冲突避免机制

### 4.1 Tier-1 文件清单（禁止并行修改）

根据 [file-lock.md](file:///e:/LA_DUCK/la-duck/.trae/rules/file-lock.md) §1：

| 文件 | 风险 |
|------|------|
| `src-tauri/src/lib.rs` | 命令注册冲突 |
| `src-tauri/tauri.conf.json` | 配置覆盖 |
| `src-tauri/Cargo.toml` | 依赖冲突 |
| `package.json` | 依赖冲突 |
| `src/App.tsx` | 路由冲突 |
| `src/store/appStore.ts` | 全局状态冲突 |
| `src/services/tauri.ts` | 调用接口冲突 |
| `.trae/rules/*.md` | 规则冲突 |

### 4.2 目录级锁机制

```
模块级锁（通过文件标记）

src/components/dashboard/.agent-lock
  - locked_by: "Trae-1"
  - locked_at: "2026-06-24 10:00:00"
  - task: "改进拖拽体验"
  - expires: "2026-06-24 11:00:00"
```

**使用方式：**
1. 智能体开始工作时，在目标目录创建 `.agent-lock` 文件
2. 其他智能体读取到锁文件则跳过该目录
3. 任务完成后删除锁文件

### 4.3 Git 分支隔离（推荐）

```
主分支：main / master
         │
         ├── branch: feature/dashboard-enhancement
         │     └── Trae-1 工作目录
         │
         ├── branch: feature/automation-logs
         │     └── Trae-2 工作目录
         │
         └── branch: feature/backend-optimization
               └── Trae-3 工作目录
```

**合并策略：**
1. 各自在独立分支开发
2. 合并前在主会话验证无冲突
3. 依次合并到 main

---

## 五、针对 QuickerSQL 的具体工作流

### 5.1 场景一：改进仪表盘 + 自动化任务（前端并行）

```
【主会话 - 任务规划】
用户："我想同时改进仪表盘的拖拽体验和自动化任务的日志展示"

【拆解】
1. Trae-1：src/components/dashboard/ + src/components/chart/
2. Trae-2：src/components/automation/ + src/store/taskStore.ts

【操作步骤】
1. 在 Trae-1 开启任务 1："改进仪表盘拖拽"
   - 限制目录：仅 src/components/dashboard/
   
2. 在 Trae-2 开启任务 2："增强任务日志"
   - 限制目录：仅 src/components/automation/

3. 两个任务并行执行

4. 主会话汇总结果，运行验证
```

### 5.2 场景二：前端改进 + 后端开发（前后端并行）

```
【主会话 - 任务规划】
用户："我想改进前端设置页面的 UI，同时优化后端数据库查询性能"

【拆解】
1. Trae-1：前端设置 UI（src/pages/Settings.tsx + src/store/settingsStore.ts）
2. Trae-2：后端优化（src-tauri/src/services/database_service.rs + sql_service.rs）

【冲突风险】
⚠️ settingsStore.ts 和 settings_service.rs 有关联
✅ 约定：接口不变，各自优化内部实现

【操作步骤】
1. Trae-1 改进 Settings.tsx UI 样式
2. Trae-2 优化数据库查询逻辑
3. 主会话验证前后端接口一致
```

### 5.3 场景三：多个前端模块并行

```
【主会话 - 任务规划】
用户："我想同时改进仪表盘、自动化任务、数据导入三个模块"

【拆解】
1. Trae-1：src/components/dashboard/（仪表盘）
2. Trae-2：src/components/automation/（自动化）
3. Trae-3：src/components/import/（导入）

【操作步骤】
1. Trae-1：改进仪表盘拖拽
2. Trae-2：改进任务编辑弹窗
3. Trae-3：改进导入进度展示
4. 三个任务完全独立，可以并行
```

---

## 六、工作流操作指南

### 6.1 主会话职责

| 职责 | 具体操作 |
|------|---------|
| 需求分析 | 将用户需求拆分为可并行的模块 |
| 任务分配 | 为每个智能体指定目录和任务 |
| 冲突协调 | 处理智能体报告的冲突 |
| 最终验证 | 运行 cargo check / tsc 验证 |
| Git 管理 | 合并分支、提交代码 |

### 6.2 子智能体职责

| 职责 | 具体操作 |
|------|---------|
| 严格隔离 | 仅访问分配的目录 |
| 实时验证 | 每次修改后运行编译检查 |
| 冲突上报 | 发现 Tier-1 文件冲突时报告 |
| 完整交付 | 提供改动清单和验证结果 |

### 6.3 推荐任务分配模式

```
【单次任务分配模板】

你好，我需要你完成以下任务：

---
任务名称：<任务名称>
模块目录：<具体目录路径>
禁止访问：<禁止修改的目录>

具体要求：
1. <具体需求1>
2. <具体需求2>

执行约束：
- 每次修改代码后运行 npx tsc --noEmit 验证
- 不要修改 Tier-1 文件（lib.rs, App.tsx, appStore.ts 等）
- 完成后列出所有改动的文件

请开始执行。
---
```

### 6.4 验证命令清单

| 验证项 | 命令 | 通过标准 |
|--------|------|---------|
| TypeScript 编译 | `npx tsc --noEmit --pretty` | Exit code 0 |
| Rust 编译 | `cargo check --quiet` | 无 error |
| Rust 测试 | `cargo test --quiet` | 无 FAIL |
| 安全检测 | 见 security.md §5 | Count = 0 |

---

## 七、常见问题处理

### 7.1 智能体报告冲突

**问题：** 智能体发现要修改的文件在其他任务中被修改

**解决：**
1. 评估冲突文件是否属于 Tier-1
2. 如果是 Tier-1，停止相关任务，主会话协调
3. 如果不是 Tier-1，让智能体等待或跳过

### 7.2 编译失败

**问题：** 并行开发导致编译错误

**解决：**
1. 停止所有并行任务
2. 主会话逐一检查每个智能体的改动
3. 修复冲突后重新分配任务

### 7.3 目录选择困惑

**问题：** 不知道该把任务分配给哪个目录

**解决：**
- 参考本文档 §2.1-§2.2 的模块划分
- 优先选择 ⭐⭐⭐⭐⭐ 安全度的模块
- 避免选择有 ⭐⭐⭐ 风险以上的模块

---

## 八、总结：最佳实践

### 8.1 推荐工作流

```
1. 主会话规划（5分钟）
   → 拆解需求 → 分配模块 → 识别风险
   
2. 子智能体并行（各自独立）
   → 严格目录隔离 → 实时验证 → 报告结果
   
3. 主会话汇总（10分钟）
   → 验证整体 → 修复冲突 → Git 提交
```

### 8.2 并行开发安全度速查

| 场景 | 安全度 | 推荐 |
|------|--------|------|
| 不同前端组件目录并行 | ⭐⭐⭐⭐⭐ | ✅ 强烈推荐 |
| 前端 + 后端服务并行 | ⭐⭐⭐⭐ | ✅ 推荐 |
| 前端组件 + 状态管理并行 | ⭐⭐⭐ | ⚠️ 需要协调 |
| 同一模块内并行 | ⭐⭐ | ❌ 不推荐 |
| 涉及 Tier-1 文件 | ⭐ | ❌ 禁止 |

### 8.3 核心原则

1. **目录隔离是根本**：不同目录的文件天然隔离
2. **Tier-1 禁止并行**：核心文件必须串行
3. **实时验证是关键**：每次修改后立即验证
4. **主会话协调**：冲突和汇总由主会话处理
5. **Git 分支隔离**：复杂场景用分支管理

---

## 九、附录：QuickersQL 当前可并行模块

基于项目当前结构，推荐以下并行组合：

| 组合 | Trae-1 | Trae-2 | Trae-3 |
|------|--------|--------|--------|
| **组合 A** | dashboard/ | automation/ | import/ |
| **组合 B** | dashboard/ | chart/ | backend services/ |
| **组合 C** | sql/ | database service/ | settings/ |
| **组合 D** | dashboard/ | task service/ | common/ |

---

> 文档版本：v1.0
> 创建日期：2026-06-24
> 适用项目：QuickersQL
> 参考规则：[file-lock.md](file:///e:/LA_DUCK/la-duck/.trae/rules/file-lock.md)、[architecture.md](file:///e:/LA_DUCK/la-duck/.trae/rules/architecture.md)

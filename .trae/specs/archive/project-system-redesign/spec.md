# 项目系统重构设计方案 v2.0 — Product Requirement Document

## Overview
- **Summary**: 重构 QuickerSQL 的项目管理系统，引入项目 ID 解耦项目名与目录路径，完善创建/复制/重命名/切换/删除的完整业务闭环，确保切换项目时所有相关状态（SQL编辑器、表列表、仪表盘、自动化任务等）正确刷新，提供接近商业软件的流畅体验。
- **Purpose**: 解决当前项目名与目录强绑定导致的重命名 bug、切换项目状态不刷新、复制项目缺失、新建项目残留旧查询等一系列问题，建立科学合理的项目数据模型。
- **Target Users**: 所有使用 QuickerSQL 进行多项目数据管理的用户

---

## Goals
- **G1**: 项目 ID 化 — 项目目录用 UUID 命名，项目名存储在数据库内，彻底解耦名称与路径
- **G2**: 功能完整 — 支持创建、复制（另存为）、重命名、切换、删除、导入、导出 7 个核心操作
- **G3**: 切换即刷新 — 切换项目后，SQL编辑器标签、表列表、查询历史、仪表盘、自动化任务全部刷新
- **G4**: 速度流畅 — 项目切换耗时 < 200ms（不含大数据量表行数统计）
- **G5**: 数据安全 — 删除/重命名前有确认，操作可追溯，避免数据丢失

---

## Non-Goals (Out of Scope)
- ❌ 不做团队协作 / 云同步
- ❌ 不做项目级用户权限管理
- ❌ 不做项目模板市场
- ❌ 不修改底层数据库引擎（继续使用 SQLite）
- ❌ 本次不做项目分组/分类（留待后续版本）

---

## Background & Context

### 当前架构问题诊断

#### 问题 1：项目名与目录强绑定（根本原因）
```
当前：项目名 "练习" → 目录 "quickersql/练习/" → 文件 "meta.db"
导致：
  - 重命名 = 重命名目录 → 必须断开数据库连接 → 慢
  - 特殊字符 / 中文 / 空格 都可能出问题
  - Windows 路径长度限制
```

#### 问题 2：功能残缺
- ❌ 没有"复制项目"功能
- ❌ 重命名实际上是"复制了一个空项目"（因为实际上是新建了目录）
- ❌ 新建项目后，之前的 SQL 查询标签页还在（状态没有重置）

#### 问题 3：切换项目状态不刷新
- SQL 编辑器标签页（workspaceStore）存在 localStorage 中，不随项目切换
- 表列表缓存（tableStore）不自动刷新
- 仪表盘（dashboardStore）不刷新
- 自动化任务（taskStore）不刷新

#### 问题 4：性能瓶颈
- 每次切换项目都要 `getDatabaseStatus()` → 逐表统计行数 → 慢
- 重命名需要断开重连 → 慢（但这是 Windows 的限制，无法避免）

### 商业软件参考做法

| 软件 | 项目模型 | 存储方式 | 切换体验 |
|------|---------|---------|---------|
| **DBeaver** | 连接配置（含 ID） | 配置文件统一管理 | 切换连接 = 切换标签页，不刷新 UI |
| **DataGrip** | Data Source（UUID） | 配置文件 + 缓存目录 | 即时切换，后台预加载 |
| **VS Code** | Workspace（文件路径） | `.code-workspace` 文件 | 切换工作区 = 重新加载窗口 |
| **Postman** | Workspace（ID） | 云端 + 本地缓存 | 即时切换，侧栏刷新 |

**QuickerSQL 最优参考模型**：混合模型
- 项目元数据（名称、ID、创建时间等）→ 统一注册表
- 项目数据（表、查询、仪表盘等）→ 每个项目独立 SQLite 文件
- 目录用 UUID，避免重命名问题

---

## Functional Requirements

### FR-1: 项目 ID 化与数据模型重构

**项目注册表（全局）**：
- 存储位置：`quickersql/projects.db`
- 表名：`__projects_registry`
- 字段：
  - `id` TEXT PRIMARY KEY（UUID）
  - `name` TEXT NOT NULL（项目显示名，可重复）
  - `db_path` TEXT NOT NULL（数据库文件相对路径，如 `projects/<uuid>/meta.db`）
  - `created_at` DATETIME
  - `updated_at` DATETIME
  - `last_opened_at` DATETIME
  - `description` TEXT

**每个项目内部数据库（meta.db）**：
- 新增表：`__project_info`
  - `id` TEXT PRIMARY KEY（与注册表一致）
  - `name` TEXT（冗余存储，方便导入导出）
  - `created_at` DATETIME
  - `schema_version` INTEGER（数据库结构版本，用于迁移）

### FR-2: 项目创建

**流程**：
1. 生成 UUID
2. 创建目录：`quickersql/projects/<uuid>/`
3. 创建并初始化 `meta.db`（系统表 + __project_info）
4. 写入项目注册表
5. （可选）如果是当前项目，切换过去

**前端操作**：
- 项目管理窗口 → "创建新项目"输入框 → 输入名称 → 确认
- 新建后自动切换到新项目
- 新项目是"干净的"：无 SQL 标签页、无历史、无仪表盘、无任务

### FR-3: 项目复制（另存为）

**流程**：
1. 生成新 UUID
2. 创建新目录
3. **拷贝整个 meta.db 文件**（SQLite 文件级复制，原子操作）
4. 更新新库的 `__project_info.id` 和 `name`
5. 写入项目注册表
6. （可选）切换到新项目

**关键点**：
- 复制是完整复制：表、查询历史、仪表盘、自动化任务、设置全都复制
- 用文件级 copy，保证数据一致性
- 大项目复制有进度提示（如果超过 100MB）

### FR-4: 项目重命名

**流程**：
1. 更新项目注册表中的 `name` 字段
2. 更新项目内部 `__project_info.name` 字段
3. 更新 `updated_at`
4. **目录不动**（因为是 UUID 命名）

**优点**：
- ⚡ 超快 — 只改两条 SQL，不需要动文件
- 🔒 安全 — 没有文件系统操作，不会出错
- 📝 可以随时改名，无副作用

### FR-5: 项目切换

**流程**：
1. 保存当前项目工作区状态（SQL 标签页等）到当前项目数据库
2. 关闭当前数据库连接
3. 打开新项目数据库连接
4. 前端统一调度刷新：
   - 重置 workspaceStore → 从新项目加载
   - 刷新 tableStore 表列表
   - 刷新 queryHistoryStore 查询历史
   - 刷新 dashboardStore 仪表盘
   - 刷新 taskStore 自动化任务
   - 更新 header 显示的项目名
5. 更新注册表 `last_opened_at`

**前端状态刷新策略**：
| Store | 刷新时机 | 方式 |
|-------|---------|------|
| workspaceStore | 切换后立即 | 清空 → 从后端加载 |
| tableStore | 切换后立即 | 清空 → 加载表名（延迟加载行数） |
| queryHistoryStore | 切换后立即 | 清空 → 加载第一页 |
| dashboardStore | 进入仪表盘页时 | 懒加载 |
| taskStore | 进入自动化任务页时 | 懒加载 |

**性能优化**：
- 表列表先只加载表名，行数统计异步后台进行
- 仪表盘和任务页面进入时才加载，不阻塞切换

### FR-6: 项目删除

**流程**：
1. 弹出确认框："确定要删除项目「xxx」吗？此操作不可恢复。"
2. （如果是当前项目）切换到 default 项目
3. 从注册表删除记录
4. 删除项目目录文件（直接删除，不保留回收站）

### FR-7: 项目导入 / 导出

**导出**：
- 导出为单个 `.qsql` 文件（就是 SQLite 文件，改个扩展名）
- 包含项目所有数据

**导入**：
- 选择 `.qsql` 或 `.db` 文件
- 生成新 UUID，复制文件到项目目录
- 初始化系统表（如果缺失）
- 更新 `__project_info` 的 ID
- 写入注册表
- 导入后自动切换到新项目

### FR-8: 项目管理弹窗 UI 优化

**弹窗尺寸**：
- 当前弹窗过小，需要加大
- 宽度：至少 720px（当前约 500px）
- 高度：至少 560px（当前约 400px）
- 最大宽高：90vw / 85vh，保证小屏幕可用

**布局优化**：
- 项目列表区域更大，显示更多信息（名称、创建时间、最近打开）
- 操作按钮区域更宽敞，避免误触
- 创建新项目区域更醒目

---

## Non-Functional Requirements

- **NFR-1（性能）**: 项目切换耗时 < 200ms（从点击切换到 UI 刷新完成，不含大表行数统计）
- **NFR-2（可靠性）**: 所有破坏性操作（删除、重命名）有确认对话框，误操作可恢复
- **NFR-3（兼容性）**: 自动迁移旧版项目目录结构（项目名目录 → UUID 目录）
- **NFR-4（可维护性）**: 项目操作集中在 `ProjectService`，commands 层只做参数校验和调用
- **NFR-5（用户体验）**: 切换项目时有 loading 状态提示，操作成功有 toast 反馈

---

## Constraints

- **Technical**: Rust + Tauri + SQLite + React + Zustand
- **Business**: 保持向后兼容，旧数据自动迁移
- **Dependencies**: 现有系统表结构（__settings、__query_history 等）保持不变

---

## Assumptions

- 绝大多数项目数据库文件 < 100MB，复制操作 < 1 秒
- 用户同时打开的项目数 < 50 个，注册表内存占用可忽略
- Windows 平台为主，后续可支持 macOS/Linux

---

## Acceptance Criteria

### AC-1: 项目创建功能正常
- **Given**: 用户在项目管理窗口输入项目名并点击创建
- **When**: 系统完成创建
- **Then**: 
  - 新项目出现在项目列表中
  - 自动切换到新项目
  - SQL 编辑器是干净的（无残留标签页）
  - 表列表是空的
- **Verification**: `human-judgment`

### AC-2: 项目重命名即时生效且不丢失数据
- **Given**: 用户在项目管理窗口重命名一个项目
- **When**: 点击确认
- **Then**:
  - 项目名立即更新（< 500ms）
  - 项目中的所有表、查询、仪表盘都保留
  - 不需要重启应用
- **Verification**: `human-judgment`

### AC-3: 项目复制功能完整
- **Given**: 用户选择一个项目并点击"复制"，输入新名称
- **When**: 复制完成
- **Then**:
  - 新项目包含原项目的所有数据（表、查询历史、仪表盘、任务）
  - 两个项目相互独立，修改一个不影响另一个
- **Verification**: `human-judgment`

### AC-4: 切换项目所有状态正确刷新
- **Given**: 用户在项目 A 打开了 3 个 SQL 标签页，创建了仪表盘
- **When**: 切换到项目 B，再切回项目 A
- **Then**:
  - 项目 B 是自己的标签页和表
  - 切回项目 A 时，3 个标签页都还在（自动恢复）
  - 表列表始终对应当前项目
- **Verification**: `human-judgment`

### AC-5: 旧数据自动迁移
- **Given**: 用户有旧版项目（按名称命名的目录）
- **When**: 升级到新版本后首次启动
- **Then**:
  - 旧项目自动迁移到 UUID 目录结构
  - 项目名称和数据都保留
  - 注册表正确生成
- **Verification**: `programmatic`

### AC-6: 编译与类型检查通过
- **Given**: 代码修改完成
- **When**: 执行 cargo check 和 tsc --noEmit
- **Then**: 全部通过，0 error
- **Verification**: `programmatic`

---

## Open Questions

（已全部确认，无待解决问题）

- [x] Q1: 不需要项目"回收站"，直接删除
- [x] Q2: 需要"导入项目"功能
- [x] Q3: 不需要项目列表排序方式
- [x] Q4: 不需要项目"收藏"功能

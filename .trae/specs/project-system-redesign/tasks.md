# 项目系统重构 — Implementation Plan (Decomposed and Prioritized Task List)

## [x] Task 1: 后端数据模型 — 项目注册表与 ProjectInfo 结构体
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 新增 `ProjectInfo` 结构体（models/project.rs）：id, name, db_path, created_at, updated_at, last_opened_at, description
  - 新增 `projects_service.rs` 中注册表管理
  - 新增 `__projects_registry` 表创建与 CRUD（无 is_deleted / is_favorite 字段）
  - 每个项目内部新增 `__project_info` 表
- **Acceptance Criteria Addressed**: FR-1
- **Test Requirements**:
  - `programmatic` TR-1.1: `cargo check --quiet` 返回无 error
  - `programmatic` TR-1.2: 注册表初始化函数单元测试通过
- **Notes**: 注册表数据库文件 `quickersql/projects.db` 单独管理，不与项目数据混在一起

## [x] Task 2: 后端项目服务重构 — 创建/重命名/复制/删除/切换/导入
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - 重构 `ProjectService::create()` — 生成 UUID，写入注册表
  - 重构 `ProjectService::rename_project()` — 只改注册表和 __project_info，不动文件
  - 新增 `ProjectService::duplicate_project()` — 复制项目（文件级复制 + 更新 ID）
  - 重构 `ProjectService::delete_project()` — 从注册表删除 + 直接删除文件（无回收站）
  - 重构 `ProjectService::list_projects()` — 从注册表读取
  - 重构 `ProjectService::switch_project()` — 切换到指定项目 ID
  - 新增 `ProjectService::import_project()` — 从外部 .db/.qsql 文件导入为新项目
  - 保留 `ProjectService::export_database()` — 导出为 .qsql 文件
- **Acceptance Criteria Addressed**: FR-2, FR-3, FR-4, FR-5, FR-6, FR-7
- **Test Requirements**:
  - `programmatic` TR-2.1: `cargo check --quiet` 返回无 error
  - `programmatic` TR-2.2: 项目 CRUD 单元测试通过
- **Notes**: 保持向后兼容，旧项目自动迁移

## [x] Task 3: 后端命令层适配 — commands/project.rs 重写
- **Priority**: high
- **Depends On**: Task 2
- **Description**:
  - `create_project` — 调用新服务
  - `rename_project` — 调用新服务，不需要关闭连接
  - `delete_project` — 调用新服务，当前项目时先切换到 default
  - `switch_project` — 按 ID 切换
  - `list_projects` — 返回 ProjectInfo 列表（包含 id/name/created_at 等）
  - `duplicate_project` — 新增复制命令
  - `import_project` — 新增导入命令（接收文件路径 + 新项目名）
  - `export_project` — 导出命令（接收项目 ID + 目标路径）
- **Acceptance Criteria Addressed**: FR-2 ~ FR-7
- **Test Requirements**:
  - `programmatic` TR-3.1: `cargo check --quiet` 返回无 error
  - `programmatic` TR-3.2: lib.rs 注册所有新命令
- **Notes**: 保持 command 签名变化要同步更新 capabilities/default.json

## [x] Task 4: 后端数据迁移 — 旧项目自动迁移到新结构
- **Priority**: high
- **Depends On**: Task 2
- **Description**:
  - 启动时检测旧版项目目录（`quickersql/<name>/meta.db`）
  - 为每个旧项目生成 UUID，移动到 `projects/<uuid>/`
  - 写入注册表
  - 在项目内写入 __project_info
  - default 项目保留名称为 "default"
- **Acceptance Criteria Addressed**: NFR-3, AC-5
- **Test Requirements**:
  - `programmatic` TR-4.1: 迁移后旧项目数据完整
  - `human-judgement` TR-4.2: 迁移后项目列表正确显示
- **Notes**: 迁移失败时回滚，不破坏原始数据

## [x] Task 5: 前端类型与服务层适配 — tauriService API 更新
- **Priority**: high
- **Depends On**: Task 3
- **Description**:
  - 新增 `ProjectInfo` TS 类型
  - `tauriService.listProjects()` 返回 ProjectInfo[]
  - `tauriService.createProject(name)`
  - `tauriService.renameProject(projectId, newName)`
  - `tauriService.deleteProject(projectId)`
  - `tauriService.switchProject(projectId)`
  - `tauriService.duplicateProject(projectId, newName)`
  - `tauriService.importProject(filePath, newName)`
  - `tauriService.exportProject(projectId, destPath)`
- **Acceptance Criteria Addressed**: FR-2 ~ FR-7
- **Test Requirements**:
  - `programmatic` TR-5.1: `npx tsc --noEmit` 0 errors
- **Notes**: 保持向后兼容的 API

## [x] Task 6: 前端项目管理窗口重构 — ProjectManager 组件 + 弹窗尺寸加大
- **Priority**: high
- **Depends On**: Task 5
- **Description**:
  - **弹窗尺寸加大**：宽度至少 720px，高度至少 560px，最大 90vw/85vh
  - 项目列表显示项目名 + 描述 + 创建时间
  - 操作按钮：切换 / 重命名 / 复制 / 删除
  - 新增"导入项目"入口（选择文件 + 输入名称）
  - 新增"导出项目"按钮
  - 创建新项目区域更醒目
  - 删除操作有确认对话框
- **Acceptance Criteria Addressed**: FR-2 ~ FR-8, NFR-5
- **Test Requirements**:
  - `human-judgement` TR-6.1: UI 交互流畅，功能完整
  - `human-judgement` TR-6.2: 弹窗尺寸明显增大，布局合理
  - `programmatic` TR-6.3: `npx tsc --noEmit` 0 errors
- **Notes**: 参考商业软件项目管理器设计

## [x] Task 7: 前端状态刷新 — 切换项目时所有 Store 正确刷新
- **Priority**: high
- **Depends On**: Task 6
- **Description**:
  - App.tsx 中统一调度项目切换后的状态刷新
  - workspaceStore: 清空旧状态，从新项目加载
  - tableStore: 清空缓存，重新加载表列表（只加载表名，行数异步）
  - queryHistoryStore: 清空，重新加载
  - dashboardStore: 进入仪表盘页时懒加载
  - taskStore: 进入任务页时懒加载
  - Header 显示正确的项目名
- **Acceptance Criteria Addressed**: FR-5, G3, G4
- **Test Requirements**:
  - `human-judgement` TR-7.1: 切换项目后各页面数据正确
  - `human-judgement` TR-7.2: 切换流畅，无卡顿感
- **Notes**: 懒加载策略优化首屏速度

## [x] Task 8: 集成测试与回归验证
- **Priority**: medium
- **Depends On**: Task 7
- **Description**:
  - 完整测试创建/重命名/复制/切换/删除/导入/导出全流程
  - 测试旧数据迁移
  - 测试边界情况：删除当前项目、重命名当前项目
  - 性能测试：切换项目耗时
- **Acceptance Criteria Addressed**: AC-1 ~ AC-6
- **Test Requirements**:
  - `human-judgement` TR-8.1: 所有验收用例全部通过
  - `programmatic` TR-8.2: cargo test 全部通过
- **Notes**: 重点验证数据完整性，防止数据丢失

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2
- Task 4 depends on Task 2
- Task 5 depends on Task 3
- Task 6 depends on Task 5
- Task 7 depends on Task 6
- Task 8 depends on Task 7

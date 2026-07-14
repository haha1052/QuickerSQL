//! 项目管理服务
//!
//! 负责项目的创建、打开、删除、重命名、复制、切换、导入、导出等业务逻辑。
//!
//! v2.0 重构：从"项目名=目录名"模型改为"UUID 目录 + 注册表"模型
//! - 项目目录用 UUID 命名，与项目名解耦（重命名不动文件系统）
//! - 全局注册表存储在 `<data_dir>/quickersql/projects.db` 的 `__projects_registry` 表
//! - 每个项目内部 `meta.db` 有 `__project_info` 表存储项目元数据
//!
//! 关键约束：
//! - 所有 SQL 必须用参数化查询（`params![]`），禁止 `format!` 拼接 SQL 文本
//! - 错误处理用 `map_err` 转化，禁止 `unwrap()` / `expect()`（非测试代码）

use std::path::{Path, PathBuf};
use rusqlite::{params, Connection, OpenFlags};
use dirs::data_dir;
use uuid::Uuid;
use chrono::Utc;

use crate::models::database::ProjectInfo;

/// 项目管理服务
pub struct ProjectService;

/// 应用数据根目录名
const APP_DATA_DIR: &str = "quickersql";
/// 项目子目录名（所有项目目录的父目录）
const PROJECTS_SUBDIR: &str = "projects";
/// 注册表数据库文件名
const REGISTRY_DB_FILENAME: &str = "projects.db";
/// 项目内部数据库文件名
const PROJECT_DB_FILENAME: &str = "meta.db";
/// __project_info 当前 schema 版本
const CURRENT_SCHEMA_VERSION: i32 = 1;

impl ProjectService {
    // ==================== 辅助方法 ====================

    /// 生成 UUID v4 字符串
    fn generate_uuid() -> String {
        Uuid::new_v4().to_string()
    }

    /// 获取当前时间的 ISO 8601 字符串（UTC）
    fn now_iso8601() -> String {
        Utc::now().to_rfc3339()
    }

    /// 获取应用数据根目录（`<data_dir>/quickersql`）
    fn get_app_data_dir() -> Result<PathBuf, String> {
        let data_dir = data_dir()
            .ok_or_else(|| "无法获取数据目录".to_string())?;
        Ok(data_dir.join(APP_DATA_DIR))
    }

    /// 将相对路径（如 `projects/<uuid>/meta.db`）解析为绝对路径
    ///
    /// 相对路径以 `<data_dir>/quickersql/` 为基准
    pub fn resolve_db_path(relative_path: &str) -> Result<PathBuf, String> {
        let base = Self::get_app_data_dir()?;
        Ok(base.join(relative_path))
    }

    /// 构造项目数据库的相对路径（`projects/<uuid>/meta.db`）
    fn build_relative_db_path(uuid: &str) -> String {
        // 用 / 分隔，跨平台一致（不依赖 OS 路径分隔符）
        format!("{}/{}/{}", PROJECTS_SUBDIR, uuid, PROJECT_DB_FILENAME)
    }

    // ==================== 注册表管理 ====================

    /// 确保注册表数据库存在，返回注册表数据库文件路径
    ///
    /// 注册表位于 `<data_dir>/quickersql/projects.db`，
    /// 包含 `__projects_registry` 表（spec.md FR-1）
    pub fn ensure_registry() -> Result<PathBuf, String> {
        let app_dir = Self::get_app_data_dir()?;
        std::fs::create_dir_all(&app_dir)
            .map_err(|e| {
                let msg = format!("创建应用数据目录失败: {}", e);
                log::error!("{}", msg);
                msg
            })?;

        let registry_path = app_dir.join(REGISTRY_DB_FILENAME);

        if !registry_path.exists() {
            // 首次创建：打开连接并建表
            let conn = Self::open_connection_with_flags(&registry_path)?;
            conn.execute(
                "CREATE TABLE IF NOT EXISTS __projects_registry (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    db_path TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    last_opened_at TEXT,
                    description TEXT
                )",
                [],
            ).map_err(|e| {
                let msg = format!("创建项目注册表失败: {}", e);
                log::error!("{}", msg);
                msg
            })?;
            log::info!("项目注册表已创建: {}", registry_path.display());
        }

        Ok(registry_path)
    }

    /// 打开注册表数据库连接（确保注册表已创建）
    ///
    /// 返回的连接具有读写权限，调用方负责管理生命周期
    pub fn open_registry() -> Result<Connection, String> {
        let registry_path = Self::ensure_registry()?;
        Self::open_connection_with_flags(&registry_path)
    }

    /// 内部工具：以读写+创建+无互斥模式打开 SQLite 连接
    fn open_connection_with_flags(path: &Path) -> Result<Connection, String> {
        let flags = OpenFlags::SQLITE_OPEN_READ_WRITE
            | OpenFlags::SQLITE_OPEN_CREATE
            | OpenFlags::SQLITE_OPEN_NO_MUTEX;
        Connection::open_with_flags(path, flags)
            .map_err(|e| {
                let msg = format!("打开数据库连接失败: {} (path={})", e, path.display());
                log::error!("{}", msg);
                msg
            })
    }

    /// 从 rusqlite 行映射为 ProjectInfo
    ///
    /// 列顺序必须与 SELECT 语句一致：
    /// id, name, db_path, created_at, updated_at, last_opened_at, description
    fn row_to_project_info(row: &rusqlite::Row<'_>) -> rusqlite::Result<ProjectInfo> {
        Ok(ProjectInfo {
            id: row.get(0)?,
            name: row.get(1)?,
            db_path: row.get(2)?,
            created_at: row.get(3)?,
            updated_at: row.get(4)?,
            last_opened_at: row.get(5)?,
            description: row.get(6)?,
        })
    }

    // ==================== 项目 CRUD ====================

    /// 创建新项目
    ///
    /// 流程（spec.md FR-2）：
    /// 1. 生成 UUID
    /// 2. 创建目录 `<data_dir>/quickersql/projects/<uuid>/`
    /// 3. 创建并初始化 `meta.db`（PRAGMA + __project_info 表）
    /// 4. 写入 __project_info 一行
    /// 5. 写入注册表 __projects_registry 一行
    /// 6. 返回 ProjectInfo
    pub fn create(project_name: &str, description: Option<&str>) -> Result<ProjectInfo, String> {
        // 参数校验
        if project_name.trim().is_empty() {
            let msg = "项目名称不能为空".to_string();
            log::warn!("{}", msg);
            return Err(msg);
        }

        // 1. 确保注册表存在
        Self::ensure_registry()?;

        // 2. 生成 UUID 和时间戳
        let project_id = Self::generate_uuid();
        let now = Self::now_iso8601();

        // 3. 创建项目目录
        let app_dir = Self::get_app_data_dir()?;
        let project_dir = app_dir.join(PROJECTS_SUBDIR).join(&project_id);
        std::fs::create_dir_all(&project_dir)
            .map_err(|e| {
                let msg = format!("创建项目目录失败: {}", e);
                log::error!("{}", msg);
                msg
            })?;

        // 4. 创建并初始化 meta.db（含 __project_info 表）
        let db_path = project_dir.join(PROJECT_DB_FILENAME);
        Self::init_database(&db_path)?;

        // 5. 写入 __project_info 一行
        {
            let conn = Connection::open(&db_path)
                .map_err(|e| format!("打开项目数据库失败: {}", e))?;
            conn.execute(
                "INSERT INTO __project_info (id, name, created_at, schema_version) VALUES (?, ?, ?, ?)",
                params![&project_id, project_name, &now, CURRENT_SCHEMA_VERSION],
            ).map_err(|e| format!("写入项目信息失败: {}", e))?;
        }

        // 6. 构造相对路径
        let relative_db_path = Self::build_relative_db_path(&project_id);

        // 7. 写入注册表
        let registry_conn = Self::open_registry()?;
        registry_conn.execute(
            "INSERT INTO __projects_registry (id, name, db_path, created_at, updated_at, last_opened_at, description) VALUES (?, ?, ?, ?, ?, NULL, ?)",
            params![&project_id, project_name, &relative_db_path, &now, &now, description],
        ).map_err(|e| {
            let msg = format!("写入项目注册表失败: {}", e);
            log::error!("{}", msg);
            msg
        })?;

        log::info!("项目已创建: id={}, name={}", project_id, project_name);

        Ok(ProjectInfo {
            id: project_id,
            name: project_name.to_string(),
            db_path: relative_db_path,
            created_at: now.clone(),
            updated_at: now,
            last_opened_at: None,
            description: description.map(|s| s.to_string()),
        })
    }

    /// 重命名项目（不动文件系统）
    ///
    /// 流程（spec.md FR-4）：
    /// 1. 更新注册表 __projects_registry.name 和 updated_at
    /// 2. 更新项目内部 __project_info.name
    /// 3. 返回更新后的 ProjectInfo
    ///
    /// 关键优化：因为目录用 UUID 命名，重命名不需要动文件系统
    pub fn rename_project(project_id: &str, new_name: &str) -> Result<ProjectInfo, String> {
        if new_name.trim().is_empty() {
            let msg = "项目名称不能为空".to_string();
            log::warn!("{}", msg);
            return Err(msg);
        }

        let now = Self::now_iso8601();

        // 1. 更新注册表
        let registry_conn = Self::open_registry()?;
        let affected = registry_conn.execute(
            "UPDATE __projects_registry SET name = ?, updated_at = ? WHERE id = ?",
            params![new_name, &now, project_id],
        ).map_err(|e| {
            let msg = format!("更新项目注册表失败: {}", e);
            log::error!("{}", msg);
            msg
        })?;

        if affected == 0 {
            let msg = format!("项目不存在: {}", project_id);
            log::warn!("{}", msg);
            return Err(msg);
        }

        // 2. 更新项目内部 __project_info.name
        let project_info = Self::get_project_info(project_id)?;
        let db_full_path = Self::resolve_db_path(&project_info.db_path)?;

        if db_full_path.exists() {
            let conn = Connection::open(&db_full_path)
                .map_err(|e| format!("打开项目数据库失败: {}", e))?;
            conn.execute(
                "UPDATE __project_info SET name = ? WHERE id = ?",
                params![new_name, project_id],
            ).map_err(|e| {
                let msg = format!("更新项目内部信息失败: {}", e);
                log::error!("{}", msg);
                msg
            })?;
        } else {
            log::warn!("项目数据库文件不存在，跳过 __project_info 更新: {}", db_full_path.display());
        }

        log::info!("项目已重命名: id={}, new_name={}", project_id, new_name);

        Self::get_project_info(project_id)
    }

    /// 复制项目（文件级复制 + 更新 ID）
    ///
    /// 流程（spec.md FR-3）：
    /// 1. 读取源项目信息
    /// 2. 生成新 UUID，创建新目录
    /// 3. 文件级复制 meta.db（原子操作，保证数据一致性）
    /// 4. 更新新库的 __project_info（id 和 name）
    /// 5. 写入注册表
    /// 6. 返回新 ProjectInfo
    ///
    /// 复制是完整复制：表、查询历史、仪表盘、自动化任务、设置全都复制
    pub fn duplicate_project(source_id: &str, new_name: &str) -> Result<ProjectInfo, String> {
        if new_name.trim().is_empty() {
            let msg = "新项目名称不能为空".to_string();
            log::warn!("{}", msg);
            return Err(msg);
        }

        // 1. 读取源项目信息
        let source = Self::get_project_info(source_id)?;
        let source_db_path = Self::resolve_db_path(&source.db_path)?;

        if !source_db_path.exists() {
            let msg = format!("源项目数据库文件不存在: {}", source_db_path.display());
            log::error!("{}", msg);
            return Err(msg);
        }

        // 2. 生成新 UUID 和目录
        let new_id = Self::generate_uuid();
        let now = Self::now_iso8601();
        let app_dir = Self::get_app_data_dir()?;
        let new_project_dir = app_dir.join(PROJECTS_SUBDIR).join(&new_id);
        std::fs::create_dir_all(&new_project_dir)
            .map_err(|e| {
                let msg = format!("创建新项目目录失败: {}", e);
                log::error!("{}", msg);
                msg
            })?;

        let new_db_path = new_project_dir.join(PROJECT_DB_FILENAME);

        // 3. 文件级复制（保证数据一致性的原子操作）
        std::fs::copy(&source_db_path, &new_db_path)
            .map_err(|e| {
                let msg = format!("复制项目数据库文件失败: {}", e);
                log::error!("{}", msg);
                msg
            })?;

        // 4. 更新新库的 __project_info（确保表存在 → 清空旧记录 → 插入新记录）
        {
            let conn = Connection::open(&new_db_path)
                .map_err(|e| format!("打开新项目数据库失败: {}", e))?;

            // 确保 __project_info 表存在（源库可能没有）
            conn.execute(
                "CREATE TABLE IF NOT EXISTS __project_info (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    schema_version INTEGER NOT NULL
                )",
                [],
            ).map_err(|e| format!("确保项目信息表存在失败: {}", e))?;

            // 清空旧记录（源项目的 id），写入新 id 和 name
            conn.execute("DELETE FROM __project_info", [])
                .map_err(|e| format!("清理项目信息表失败: {}", e))?;
            conn.execute(
                "INSERT INTO __project_info (id, name, created_at, schema_version) VALUES (?, ?, ?, ?)",
                params![&new_id, new_name, &now, CURRENT_SCHEMA_VERSION],
            ).map_err(|e| format!("写入新项目信息失败: {}", e))?;
        }

        // 5. 写入注册表
        let relative_db_path = Self::build_relative_db_path(&new_id);
        let registry_conn = Self::open_registry()?;
        registry_conn.execute(
            "INSERT INTO __projects_registry (id, name, db_path, created_at, updated_at, last_opened_at, description) VALUES (?, ?, ?, ?, ?, NULL, ?)",
            params![&new_id, new_name, &relative_db_path, &now, &now, source.description.as_deref()],
        ).map_err(|e| {
            let msg = format!("写入项目注册表失败: {}", e);
            log::error!("{}", msg);
            msg
        })?;

        log::info!(
            "项目已复制: source_id={}, new_id={}, new_name={}",
            source_id, new_id, new_name
        );

        Ok(ProjectInfo {
            id: new_id,
            name: new_name.to_string(),
            db_path: relative_db_path,
            created_at: now.clone(),
            updated_at: now,
            last_opened_at: None,
            description: source.description,
        })
    }

    /// 删除项目
    ///
    /// 流程（spec.md FR-6）：
    /// 1. 从注册表读取项目信息（获取 db_path）
    /// 2. 从注册表删除记录
    /// 3. 删除项目目录（直接删除，无回收站）
    ///
    /// 注意：调用方负责先切换到其他项目（避免删除当前已连接的库）
    pub fn delete_project(project_id: &str) -> Result<(), String> {
        // 1. 读取项目信息（获取 db_path 用于定位目录）
        let project_info = Self::get_project_info(project_id)?;

        // 2. 从注册表删除
        let registry_conn = Self::open_registry()?;
        let affected = registry_conn.execute(
            "DELETE FROM __projects_registry WHERE id = ?",
            params![project_id],
        ).map_err(|e| {
            let msg = format!("从注册表删除项目失败: {}", e);
            log::error!("{}", msg);
            msg
        })?;

        if affected == 0 {
            let msg = format!("项目不存在: {}", project_id);
            log::warn!("{}", msg);
            return Err(msg);
        }

        // 3. 删除项目目录
        // db_path 形如 "projects/<uuid>/meta.db"，取其父目录
        let app_dir = Self::get_app_data_dir()?;
        let db_path_buf = PathBuf::from(&project_info.db_path);
        let project_dir_relative = db_path_buf.parent()
            .ok_or_else(|| format!("项目 db_path 格式错误: {}", project_info.db_path))?;
        let project_dir = app_dir.join(project_dir_relative);

        if project_dir.exists() {
            std::fs::remove_dir_all(&project_dir)
                .map_err(|e| {
                    let msg = format!("删除项目目录失败: {}", e);
                    log::error!("{}", msg);
                    msg
                })?;
        } else {
            log::warn!("项目目录不存在，跳过文件删除: {}", project_dir.display());
        }

        log::info!("项目已删除: id={}", project_id);
        Ok(())
    }

    /// 列出所有项目
    ///
    /// 从注册表读取，按 last_opened_at DESC 排序（NULL 视为最早）
    pub fn list_projects() -> Result<Vec<ProjectInfo>, String> {
        Self::ensure_registry()?;
        let conn = Self::open_registry()?;

        let mut stmt = conn.prepare(
            "SELECT id, name, db_path, created_at, updated_at, last_opened_at, description \
             FROM __projects_registry \
             ORDER BY last_opened_at IS NULL, last_opened_at DESC, created_at DESC"
        ).map_err(|e| format!("准备查询失败: {}", e))?;

        let rows = stmt.query_map([], Self::row_to_project_info)
            .map_err(|e| format!("查询项目列表失败: {}", e))?;

        let mut projects = Vec::new();
        for row in rows {
            let project = row.map_err(|e| format!("读取项目行失败: {}", e))?;
            projects.push(project);
        }

        Ok(projects)
    }

    /// 切换项目
    ///
    /// 流程（spec.md FR-5）：
    /// 1. 更新注册表 last_opened_at = now
    /// 2. 返回 ProjectInfo
    ///
    /// 注意：本方法只更新注册表，不操作 db_manager（保持 service 层纯粹）
    /// 调用方（commands 层）负责实际数据库连接切换和前端状态刷新
    pub fn switch_project(project_id: &str) -> Result<ProjectInfo, String> {
        let now = Self::now_iso8601();

        // 更新 last_opened_at
        let registry_conn = Self::open_registry()?;
        let affected = registry_conn.execute(
            "UPDATE __projects_registry SET last_opened_at = ? WHERE id = ?",
            params![&now, project_id],
        ).map_err(|e| {
            let msg = format!("更新项目最近打开时间失败: {}", e);
            log::error!("{}", msg);
            msg
        })?;

        if affected == 0 {
            let msg = format!("项目不存在: {}", project_id);
            log::warn!("{}", msg);
            return Err(msg);
        }

        log::info!("项目已切换: id={}", project_id);
        Self::get_project_info(project_id)
    }

    /// 导入项目（从外部 .db/.qsql 文件）
    ///
    /// 流程（spec.md FR-7）：
    /// 1. 校验源文件存在
    /// 2. 生成新 UUID，创建新目录
    /// 3. 复制源文件到 `<new_dir>/meta.db`
    /// 4. 确保新库有 __project_info 表，写入新 id 和 name
    /// 5. 写入注册表
    /// 6. 返回 ProjectInfo
    ///
    /// 简化策略：仅创建 __project_info 并写入；
    /// 其他系统表由 commands 层在切换到该项目时调用 ensure（与现有 switch_project 命令一致）
    pub fn import_project(source_file_path: &Path, new_name: &str) -> Result<ProjectInfo, String> {
        if new_name.trim().is_empty() {
            let msg = "项目名称不能为空".to_string();
            log::warn!("{}", msg);
            return Err(msg);
        }

        if !source_file_path.exists() {
            let msg = format!("源文件不存在: {}", source_file_path.display());
            log::warn!("{}", msg);
            return Err(msg);
        }

        // 1. 生成新 UUID 和目录
        let new_id = Self::generate_uuid();
        let now = Self::now_iso8601();
        let app_dir = Self::get_app_data_dir()?;
        let new_project_dir = app_dir.join(PROJECTS_SUBDIR).join(&new_id);
        std::fs::create_dir_all(&new_project_dir)
            .map_err(|e| {
                let msg = format!("创建新项目目录失败: {}", e);
                log::error!("{}", msg);
                msg
            })?;

        let new_db_path = new_project_dir.join(PROJECT_DB_FILENAME);

        // 2. 复制源文件到新位置
        std::fs::copy(source_file_path, &new_db_path)
            .map_err(|e| {
                let msg = format!("复制源数据库文件失败: {}", e);
                log::error!("{}", msg);
                msg
            })?;

        // 3. 确保新库有 __project_info 表，写入新 id 和 name
        {
            let conn = Connection::open(&new_db_path)
                .map_err(|e| format!("打开导入的数据库失败: {}", e))?;

            conn.execute(
                "CREATE TABLE IF NOT EXISTS __project_info (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    schema_version INTEGER NOT NULL
                )",
                [],
            ).map_err(|e| format!("确保项目信息表存在失败: {}", e))?;

            // 清空旧记录，写入新记录
            conn.execute("DELETE FROM __project_info", [])
                .map_err(|e| format!("清理项目信息表失败: {}", e))?;
            conn.execute(
                "INSERT INTO __project_info (id, name, created_at, schema_version) VALUES (?, ?, ?, ?)",
                params![&new_id, new_name, &now, CURRENT_SCHEMA_VERSION],
            ).map_err(|e| format!("写入项目信息失败: {}", e))?;
        }

        // 4. 写入注册表
        let relative_db_path = Self::build_relative_db_path(&new_id);
        let registry_conn = Self::open_registry()?;
        registry_conn.execute(
            "INSERT INTO __projects_registry (id, name, db_path, created_at, updated_at, last_opened_at, description) VALUES (?, ?, ?, ?, ?, NULL, ?)",
            params![&new_id, new_name, &relative_db_path, &now, &now, None::<&str>],
        ).map_err(|e| {
            let msg = format!("写入项目注册表失败: {}", e);
            log::error!("{}", msg);
            msg
        })?;

        log::info!(
            "项目已导入: id={}, name={}, source={}",
            new_id, new_name, source_file_path.display()
        );

        Ok(ProjectInfo {
            id: new_id,
            name: new_name.to_string(),
            db_path: relative_db_path,
            created_at: now.clone(),
            updated_at: now,
            last_opened_at: None,
            description: None,
        })
    }

    /// 导出项目到指定路径
    ///
    /// 流程（spec.md FR-7）：
    /// 1. 从注册表读取项目 db_path
    /// 2. 复制 meta.db 到 dest_path
    pub fn export_project(project_id: &str, dest_path: &Path) -> Result<(), String> {
        let project_info = Self::get_project_info(project_id)?;
        let source_db_path = Self::resolve_db_path(&project_info.db_path)?;

        if !source_db_path.exists() {
            let msg = format!("项目数据库文件不存在: {}", source_db_path.display());
            log::error!("{}", msg);
            return Err(msg);
        }

        Self::export_database(&source_db_path, dest_path)?;

        log::info!(
            "项目已导出: id={}, dest={}",
            project_id, dest_path.display()
        );
        Ok(())
    }

    /// 获取单个项目信息
    pub fn get_project_info(project_id: &str) -> Result<ProjectInfo, String> {
        Self::ensure_registry()?;
        let conn = Self::open_registry()?;

        conn.query_row(
            "SELECT id, name, db_path, created_at, updated_at, last_opened_at, description \
             FROM __projects_registry WHERE id = ?",
            params![project_id],
            Self::row_to_project_info,
        ).map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                format!("项目不存在: {}", project_id)
            }
            other => {
                let msg = format!("查询项目信息失败: {}", other);
                log::error!("{}", msg);
                msg
            }
        })
    }

    /// 按名称查找项目
    ///
    /// 用于旧数据迁移和默认项目查找
    /// 如果有多个同名项目，返回最早创建的一个
    pub fn find_project_by_name(name: &str) -> Result<Option<ProjectInfo>, String> {
        Self::ensure_registry()?;
        let conn = Self::open_registry()?;

        let result = conn.query_row(
            "SELECT id, name, db_path, created_at, updated_at, last_opened_at, description \
             FROM __projects_registry WHERE name = ? \
             ORDER BY created_at ASC LIMIT 1",
            params![name],
            Self::row_to_project_info,
        );

        match result {
            Ok(project) => Ok(Some(project)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => {
                let msg = format!("按名称查询项目失败: {}", e);
                log::error!("{}", msg);
                Err(msg)
            }
        }
    }

    /// 获取最近打开的项目
    ///
    /// 返回 `last_opened_at` 最新且不为 NULL 的项目。
    /// 用于应用启动时恢复上次退出时的项目。
    /// 如果没有任何项目有 last_opened_at，返回 None。
    pub fn get_last_opened_project() -> Result<Option<ProjectInfo>, String> {
        Self::ensure_registry()?;
        let conn = Self::open_registry()?;

        let result = conn.query_row(
            "SELECT id, name, db_path, created_at, updated_at, last_opened_at, description \
             FROM __projects_registry \
             WHERE last_opened_at IS NOT NULL \
             ORDER BY last_opened_at DESC LIMIT 1",
            [],
            Self::row_to_project_info,
        );

        match result {
            Ok(project) => Ok(Some(project)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => {
                let msg = format!("查询最近打开的项目失败: {}", e);
                log::error!("{}", msg);
                Err(msg)
            }
        }
    }

    /// 获取默认数据库路径（向后兼容）
    ///
    /// 1. 优先使用最近打开的项目（last_opened_at 最新）
    /// 2. fallback 到名为 "default" 的项目（兼容旧版）
    /// 3. 不存在则创建 "default" 项目
    pub fn get_default_db_path() -> Result<PathBuf, String> {
        // 1. 确保注册表存在
        Self::ensure_registry()?;

        // 2. 优先使用最近打开的项目
        if let Ok(Some(last_proj)) = Self::get_last_opened_project() {
            let full_path = Self::resolve_db_path(&last_proj.db_path)?;
            if full_path.exists() {
                log::info!("恢复上次打开的项目: {} ({})", last_proj.name, last_proj.id);
                return Ok(full_path);
            }
            log::warn!(
                "上次打开的项目数据库文件缺失，将回退到 default 项目: {}",
                full_path.display()
            );
        }

        // 3. fallback 到名为 "default" 的项目
        if let Some(default_proj) = Self::find_project_by_name("default")? {
            let full_path = Self::resolve_db_path(&default_proj.db_path)?;
            if full_path.exists() {
                return Ok(full_path);
            }
            // 文件不存在但注册表有记录，继续创建新的
            log::warn!(
                "default 项目注册表记录存在但数据库文件缺失，将重新创建: {}",
                full_path.display()
            );
        }

        // 4. 不存在则创建
        let proj = Self::create("default", None)?;
        Self::resolve_db_path(&proj.db_path)
    }

    // ==================== 旧版项目迁移 ====================

    /// 迁移旧版项目目录结构到新版 UUID 结构
    ///
    /// 检测 `<data_dir>/quickersql/` 下的旧版项目目录（含 meta.db 的非 "projects" 目录），
    /// 为每个旧项目：
    /// 1. 生成 UUID
    /// 2. 移动目录到 projects/<uuid>/
    /// 3. 在 meta.db 中创建/更新 __project_info 表
    /// 4. 写入注册表
    ///
    /// 返回迁移的项目数量。迁移是幂等的：已迁移过的项目（在注册表中）会被跳过。
    /// 单个项目迁移失败不影响其他项目，失败的项目会回滚目录移动。
    pub fn migrate_legacy_projects() -> Result<usize, String> {
        let base_dir = Self::get_app_data_dir()?;
        Self::migrate_legacy_projects_in(&base_dir)
    }

    /// 迁移指定基础目录下的旧版项目（内部可测试函数）
    ///
    /// `base_dir` 对应 `<data_dir>/quickersql/`，包含：
    /// - 旧版项目子目录（含 meta.db）
    /// - projects.db 注册表
    /// - projects/ 子目录（新结构）
    ///
    /// 本函数不依赖全局 `data_dir()`，便于单元测试使用临时目录。
    fn migrate_legacy_projects_in(base_dir: &Path) -> Result<usize, String> {
        // 1. 确保注册表存在
        let registry_path = Self::ensure_registry_at(base_dir)?;

        // 2. 读取所有已注册的项目名（用于去重）
        let registered_names = Self::get_registered_project_names(&registry_path)?;

        // 3. 遍历 base_dir 下的子目录
        let entries = match std::fs::read_dir(base_dir) {
            Ok(e) => e,
            Err(e) => {
                log::info!("读取基础目录失败，无需迁移: {}", e);
                return Ok(0);
            }
        };

        let mut migrated_count: usize = 0;

        for entry in entries {
            let entry = match entry {
                Ok(e) => e,
                Err(e) => {
                    log::warn!("读取目录条目失败，跳过: {}", e);
                    continue;
                }
            };

            let path = entry.path();

            // 只处理目录
            if !path.is_dir() {
                continue;
            }

            let dir_name = match path.file_name().and_then(|n| n.to_str()) {
                Some(n) => n.to_string(),
                None => {
                    log::warn!("目录名非有效 UTF-8，跳过: {}", path.display());
                    continue;
                }
            };

            // 排除 projects 目录（新结构）
            if dir_name == PROJECTS_SUBDIR {
                continue;
            }

            // 必须含 meta.db
            let meta_db_path = path.join(PROJECT_DB_FILENAME);
            if !meta_db_path.exists() {
                continue;
            }

            // 跳过已注册的项目（已迁移过）
            if registered_names.contains(&dir_name) {
                log::info!("项目 '{}' 已在注册表中，跳过迁移", dir_name);
                continue;
            }

            // 迁移单个项目（失败不影响其他）
            match Self::migrate_single_legacy_project(&path, &dir_name, base_dir, &registry_path) {
                Ok(true) => migrated_count += 1,
                Ok(false) => {}
                Err(e) => {
                    log::warn!("迁移项目 '{}' 失败: {}", dir_name, e);
                }
            }
        }

        Ok(migrated_count)
    }

    /// 在指定基础目录下确保注册表存在
    ///
    /// 与 `ensure_registry()` 功能相同，但接受显式 base_dir 参数，便于测试。
    /// 始终使用 CREATE TABLE IF NOT EXISTS 保证幂等。
    fn ensure_registry_at(base_dir: &Path) -> Result<PathBuf, String> {
        std::fs::create_dir_all(base_dir)
            .map_err(|e| format!("创建基础目录失败: {}", e))?;

        let registry_path = base_dir.join(REGISTRY_DB_FILENAME);
        let is_new = !registry_path.exists();

        let flags = OpenFlags::SQLITE_OPEN_READ_WRITE
            | OpenFlags::SQLITE_OPEN_CREATE
            | OpenFlags::SQLITE_OPEN_NO_MUTEX;
        let conn = Connection::open_with_flags(&registry_path, flags)
            .map_err(|e| format!("打开注册表连接失败: {}", e))?;

        // 始终确保表存在（CREATE TABLE IF NOT EXISTS 是幂等的）
        conn.execute(
            "CREATE TABLE IF NOT EXISTS __projects_registry (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                db_path TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                last_opened_at TEXT,
                description TEXT
            )",
            [],
        ).map_err(|e| format!("创建注册表失败: {}", e))?;

        if is_new {
            log::info!("项目注册表已创建: {}", registry_path.display());
        }

        Ok(registry_path)
    }

    /// 读取注册表中所有项目名（用于迁移去重）
    ///
    /// 调用前须确保注册表已存在（通过 `ensure_registry_at`）。
    fn get_registered_project_names(
        registry_path: &Path,
    ) -> Result<std::collections::HashSet<String>, String> {
        let flags = OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX;
        let conn = Connection::open_with_flags(registry_path, flags)
            .map_err(|e| format!("打开注册表读取失败: {}", e))?;

        let mut stmt = conn.prepare("SELECT name FROM __projects_registry")
            .map_err(|e| format!("准备查询注册表失败: {}", e))?;
        let names = stmt.query_map([], |row| row.get::<_, String>(0))
            .map_err(|e| format!("查询注册表失败: {}", e))?;

        let mut set = std::collections::HashSet::new();
        for name in names {
            if let Ok(n) = name {
                set.insert(n);
            }
        }
        Ok(set)
    }

    /// 迁移单个旧版项目
    ///
    /// 流程：
    /// 1. 生成新 UUID
    /// 2. 确保 projects/ 目录存在
    /// 3. 移动整个旧目录到 projects/<uuid>/（同盘原子操作）
    /// 4. 后处理：创建 __project_info + 写入注册表
    ///
    /// 返回 Ok(true) 表示已迁移，Ok(false) 表示跳过。
    /// 后处理失败时回滚目录移动，避免产生孤儿项目。
    fn migrate_single_legacy_project(
        old_dir: &Path,
        project_name: &str,
        base_dir: &Path,
        registry_path: &Path,
    ) -> Result<bool, String> {
        // 生成新 UUID 和时间戳
        let new_id = Self::generate_uuid();
        let now = Self::now_iso8601();

        // 确保 projects/ 目录存在
        let projects_dir = base_dir.join(PROJECTS_SUBDIR);
        std::fs::create_dir_all(&projects_dir)
            .map_err(|e| format!("创建 projects 目录失败: {}", e))?;

        // 移动整个旧目录到新位置（同盘原子操作，包含 meta.db 及可能的 WAL 文件）
        let new_project_dir = projects_dir.join(&new_id);
        if new_project_dir.exists() {
            // UUID 冲突（极端不可能），跳过
            return Err(format!("目标目录已存在（UUID 冲突）: {}", new_project_dir.display()));
        }
        if let Err(e) = std::fs::rename(old_dir, &new_project_dir) {
            return Err(format!("移动项目目录失败: {}", e));
        }

        // 后续步骤失败时需要回滚目录移动
        let finalize_result = Self::finalize_migrated_project(
            &new_project_dir,
            &new_id,
            project_name,
            &now,
            registry_path,
        );

        if let Err(e) = finalize_result {
            log::warn!("迁移后处理失败，尝试回滚: {}", e);
            if std::fs::rename(&new_project_dir, old_dir).is_err() {
                return Err(format!(
                    "迁移失败且回滚也失败: {} (项目数据已移至: {}，但未写入注册表)",
                    e, new_project_dir.display()
                ));
            }
            return Err(format!("迁移失败已回滚: {}", e));
        }

        log::info!("项目 '{}' 已迁移到 UUID 目录: {}", project_name, new_id);
        Ok(true)
    }

    /// 完成迁移后的项目（创建 __project_info + 写入注册表）
    ///
    /// 此函数在目录已移动后执行，失败时由调用方负责回滚目录移动。
    fn finalize_migrated_project(
        new_project_dir: &Path,
        new_id: &str,
        project_name: &str,
        now: &str,
        registry_path: &Path,
    ) -> Result<(), String> {
        let new_meta_db = new_project_dir.join(PROJECT_DB_FILENAME);

        // 1. 打开新位置的 meta.db, 创建/更新 __project_info 表
        {
            let conn = Connection::open(&new_meta_db)
                .map_err(|e| format!("打开迁移后的数据库失败: {}", e))?;

            conn.execute(
                "CREATE TABLE IF NOT EXISTS __project_info (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    schema_version INTEGER NOT NULL
                )",
                [],
            ).map_err(|e| format!("创建项目信息表失败: {}", e))?;

            // 清空旧记录，写入新记录（防止旧数据残留）
            conn.execute("DELETE FROM __project_info", [])
                .map_err(|e| format!("清理项目信息表失败: {}", e))?;
            conn.execute(
                "INSERT INTO __project_info (id, name, created_at, schema_version) VALUES (?, ?, ?, ?)",
                params![new_id, project_name, now, CURRENT_SCHEMA_VERSION],
            ).map_err(|e| format!("写入项目信息失败: {}", e))?;
        }

        // 2. 写入注册表
        let relative_db_path = Self::build_relative_db_path(new_id);
        let flags = OpenFlags::SQLITE_OPEN_READ_WRITE
            | OpenFlags::SQLITE_OPEN_CREATE
            | OpenFlags::SQLITE_OPEN_NO_MUTEX;
        let registry_conn = Connection::open_with_flags(registry_path, flags)
            .map_err(|e| format!("打开注册表失败: {}", e))?;
        registry_conn.execute(
            "INSERT INTO __projects_registry (id, name, db_path, created_at, updated_at, last_opened_at, description) VALUES (?, ?, ?, ?, ?, NULL, ?)",
            params![new_id, project_name, &relative_db_path, now, now, None::<&str>],
        ).map_err(|e| format!("写入项目注册表失败: {}", e))?;

        Ok(())
    }

    // ==================== 保留的现有方法 ====================

    /// 打开项目（保留原签名）
    ///
    /// 校验数据库文件存在并启用 WAL 模式
    pub fn open(db_path: &Path) -> Result<bool, String> {
        if !db_path.exists() {
            let msg = "数据库文件不存在".to_string();
            log::warn!("{}", msg);
            return Err(msg);
        }

        let mut conn = Connection::open(db_path)
            .map_err(|e| {
                let msg = format!("打开数据库失败: {}", e);
                log::error!("{}", msg);
                msg
            })?;

        Self::ensure_wal(&mut conn)
            .map_err(|e| {
                let msg = format!("配置数据库 WAL 模式失败: {}", e);
                log::error!("{}", msg);
                msg
            })?;

        Ok(true)
    }

    /// 导出数据库（底层工具函数）
    ///
    /// 文件级复制源数据库到目标路径
    pub fn export_database(source_path: &Path, dest_path: &Path) -> Result<(), String> {
        if !source_path.exists() {
            let msg = "源数据库文件不存在".to_string();
            log::warn!("{}", msg);
            return Err(msg);
        }

        if dest_path.exists() {
            std::fs::remove_file(dest_path)
                .map_err(|e| {
                    let msg = format!("删除目标文件失败: {}", e);
                    log::error!("{}", msg);
                    msg
                })?;
        }

        std::fs::copy(source_path, dest_path)
            .map_err(|e| {
                let msg = format!("导出数据库失败: {}", e);
                log::error!("{}", msg);
                msg
            })?;

        Ok(())
    }

    /// 初始化数据库
    ///
    /// 创建新数据库文件，配置 PRAGMA 参数，并创建 __project_info 表
    fn init_database(db_path: &PathBuf) -> Result<(), String> {
        let conn = Self::open_connection_with_flags(db_path)?;

        conn.execute_batch(
            "PRAGMA journal_mode=WAL;
             PRAGMA synchronous=NORMAL;
             PRAGMA cache_size=-20000;
             PRAGMA temp_store=MEMORY;"
        ).map_err(|e| format!("配置数据库参数失败: {}", e))?;

        // 创建项目信息表（spec.md FR-1）
        conn.execute(
            "CREATE TABLE IF NOT EXISTS __project_info (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                created_at TEXT NOT NULL,
                schema_version INTEGER NOT NULL
            )",
            [],
        ).map_err(|e| format!("创建项目信息表失败: {}", e))?;

        Ok(())
    }

    /// 确保 WAL 模式启用（保留不动）
    fn ensure_wal(conn: &mut Connection) -> Result<(), String> {
        let mode: String = conn.query_row("PRAGMA journal_mode", [], |row| row.get(0))
            .map_err(|e| format!("查询 journal_mode 失败: {}", e))?;

        if mode != "wal" {
            conn.execute("PRAGMA journal_mode=WAL", [])
                .map_err(|e| format!("设置 WAL 模式失败: {}", e))?;
        }

        Ok(())
    }

    /// 获取 WAL 状态（保留不动）
    pub fn get_wal_status(db_path: &Path) -> Result<bool, String> {
        let conn = Connection::open(db_path)
            .map_err(|e| {
                let msg = format!("打开数据库失败: {}", e);
                log::error!("{}", msg);
                msg
            })?;

        let mode: String = conn.query_row("PRAGMA journal_mode", [], |row| row.get(0))
            .map_err(|e| {
                let msg = format!("查询 WAL 状态失败: {}", e);
                log::error!("{}", msg);
                msg
            })?;

        Ok(mode == "wal")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use tempfile::tempdir;

    /// 测试辅助：清理可能残留的同名测试项目
    fn cleanup_test_project(project_id: &str) {
        let _ = ProjectService::delete_project(project_id);
    }

    /// 测试辅助：清理所有名为指定名称的测试项目
    fn cleanup_test_project_by_name(name: &str) {
        if let Ok(Some(proj)) = ProjectService::find_project_by_name(name) {
            let _ = ProjectService::delete_project(&proj.id);
        }
    }

    #[test]
    fn test_create_project() {
        cleanup_test_project_by_name("test_create");
        let result = ProjectService::create("test_create", None);
        assert!(result.is_ok(), "创建项目失败: {:?}", result.err());

        let project_info = result.unwrap();
        assert!(!project_info.id.is_empty(), "项目 ID 不能为空");
        assert_eq!(project_info.name, "test_create");
        assert!(project_info.db_path.starts_with("projects/"), "db_path 应以 projects/ 开头");
        assert!(project_info.db_path.ends_with("/meta.db"), "db_path 应以 /meta.db 结尾");
        assert!(project_info.last_opened_at.is_none(), "新建项目 last_opened_at 应为 None");
        assert!(project_info.description.is_none(), "未传描述时 description 应为 None");

        let db_path = ProjectService::resolve_db_path(&project_info.db_path).unwrap();
        assert!(db_path.exists(), "数据库文件不存在");

        let wal_status = ProjectService::get_wal_status(&db_path);
        assert!(wal_status.is_ok(), "获取WAL状态失败");
        assert!(wal_status.unwrap(), "WAL模式未开启");

        // 验证 __project_info 表中有记录
        let conn = Connection::open(&db_path).unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM __project_info", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 1, "__project_info 应有 1 条记录");

        cleanup_test_project(&project_info.id);
    }

    #[test]
    fn test_create_project_with_description() {
        cleanup_test_project_by_name("test_create_desc");
        let result = ProjectService::create("test_create_desc", Some("测试描述"));
        assert!(result.is_ok(), "创建项目失败: {:?}", result.err());

        let project_info = result.unwrap();
        assert_eq!(project_info.description, Some("测试描述".to_string()));

        // 验证注册表中的 description
        let fetched = ProjectService::get_project_info(&project_info.id).unwrap();
        assert_eq!(fetched.description, Some("测试描述".to_string()));

        cleanup_test_project(&project_info.id);
    }

    #[test]
    fn test_open_project() {
        cleanup_test_project_by_name("test_open");
        let result = ProjectService::create("test_open", None);
        assert!(result.is_ok());

        let project_info = result.unwrap();
        let db_path = ProjectService::resolve_db_path(&project_info.db_path).unwrap();
        let open_result = ProjectService::open(&db_path);
        assert!(open_result.is_ok(), "打开项目失败");
        assert!(open_result.unwrap());

        let wal_status = ProjectService::get_wal_status(&db_path);
        assert!(wal_status.unwrap(), "WAL模式未保持");

        cleanup_test_project(&project_info.id);
    }

    #[test]
    fn test_open_nonexistent_project() {
        let nonexistent_path = PathBuf::from("/nonexistent/path/meta.db");
        let result = ProjectService::open(&nonexistent_path);
        assert!(result.is_err());
        assert!(result.err().unwrap().contains("数据库文件不存在"));
    }

    #[test]
    fn test_list_projects() {
        cleanup_test_project_by_name("test_list_1");
        cleanup_test_project_by_name("test_list_2");
        let p1 = ProjectService::create("test_list_1", None).unwrap();
        let p2 = ProjectService::create("test_list_2", None).unwrap();

        let projects = ProjectService::list_projects();
        assert!(projects.is_ok());

        let project_list = projects.unwrap();
        let ids: Vec<&str> = project_list.iter().map(|p| p.id.as_str()).collect();
        assert!(ids.contains(&p1.id.as_str()), "列表中应包含 test_list_1");
        assert!(ids.contains(&p2.id.as_str()), "列表中应包含 test_list_2");

        cleanup_test_project(&p1.id);
        cleanup_test_project(&p2.id);
    }

    #[test]
    fn test_delete_project() {
        cleanup_test_project_by_name("test_delete");
        let project_info = ProjectService::create("test_delete", None).unwrap();

        let result = ProjectService::delete_project(&project_info.id);
        assert!(result.is_ok(), "删除项目失败");

        let projects = ProjectService::list_projects().unwrap();
        let ids: Vec<&str> = projects.iter().map(|p| p.id.as_str()).collect();
        assert!(!ids.contains(&project_info.id.as_str()), "删除后仍存在");

        // 验证目录也被删除
        let db_path = ProjectService::resolve_db_path(&project_info.db_path).unwrap();
        assert!(!db_path.exists(), "数据库文件未删除");
    }

    #[test]
    fn test_export_database() {
        cleanup_test_project_by_name("test_export");
        let project_info = ProjectService::create("test_export", None).unwrap();
        let source_path = ProjectService::resolve_db_path(&project_info.db_path).unwrap();

        let temp_dir = tempdir().expect("创建临时目录失败");
        let dest_path = temp_dir.path().join("exported.db");

        let result = ProjectService::export_database(&source_path, &dest_path);
        assert!(result.is_ok(), "导出数据库失败");
        assert!(dest_path.exists(), "导出文件不存在");

        cleanup_test_project(&project_info.id);
    }

    #[test]
    fn test_wal_mode_enabled() {
        cleanup_test_project_by_name("test_wal");
        let project_info = ProjectService::create("test_wal", None).unwrap();
        let db_path = ProjectService::resolve_db_path(&project_info.db_path).unwrap();
        let wal_status = ProjectService::get_wal_status(&db_path);

        assert!(wal_status.is_ok());
        assert!(wal_status.unwrap(), "WAL模式应该开启");

        cleanup_test_project(&project_info.id);
    }

    // ==================== 新增测试 ====================

    #[test]
    fn test_rename_project_no_file_change() {
        cleanup_test_project_by_name("test_rename_before");
        cleanup_test_project_by_name("test_rename_after");
        let project_info = ProjectService::create("test_rename_before", None).unwrap();
        let original_db_path = ProjectService::resolve_db_path(&project_info.db_path).unwrap();
        assert!(original_db_path.exists(), "原始数据库文件应存在");

        // 记录原始路径
        let original_relative_path = project_info.db_path.clone();

        // 重命名
        let renamed = ProjectService::rename_project(&project_info.id, "test_rename_after");
        assert!(renamed.is_ok(), "重命名失败: {:?}", renamed.err());

        let renamed = renamed.unwrap();
        assert_eq!(renamed.name, "test_rename_after");
        assert_eq!(renamed.id, project_info.id, "ID 不应变");

        // 关键验证：数据库文件相对路径不变
        assert_eq!(
            renamed.db_path, original_relative_path,
            "重命名后 db_path 不应改变"
        );

        let new_db_path = ProjectService::resolve_db_path(&renamed.db_path).unwrap();
        assert_eq!(
            original_db_path, new_db_path,
            "重命名后数据库绝对路径不应改变"
        );
        assert!(new_db_path.exists(), "数据库文件应仍存在");

        // 验证 __project_info 中的 name 已更新
        let conn = Connection::open(&new_db_path).unwrap();
        let name: String = conn
            .query_row(
                "SELECT name FROM __project_info WHERE id = ?",
                params![&project_info.id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(name, "test_rename_after", "__project_info.name 未更新");

        cleanup_test_project(&project_info.id);
    }

    #[test]
    fn test_duplicate_project() {
        cleanup_test_project_by_name("test_dup_source");
        cleanup_test_project_by_name("test_dup_copy");
        let source = ProjectService::create("test_dup_source", None).unwrap();

        let duplicated = ProjectService::duplicate_project(&source.id, "test_dup_copy");
        assert!(duplicated.is_ok(), "复制项目失败: {:?}", duplicated.err());

        let duplicated = duplicated.unwrap();
        assert_ne!(duplicated.id, source.id, "新项目 ID 应不同");
        assert_eq!(duplicated.name, "test_dup_copy");
        assert!(duplicated.db_path.starts_with("projects/"));

        // 验证新项目存在
        let new_db_path = ProjectService::resolve_db_path(&duplicated.db_path).unwrap();
        assert!(new_db_path.exists(), "新项目数据库文件应存在");

        // 验证源项目数据库仍存在（未被破坏）
        let source_db_path = ProjectService::resolve_db_path(&source.db_path).unwrap();
        assert!(source_db_path.exists(), "源项目数据库应仍存在");

        // 验证两个项目都在列表中
        let projects = ProjectService::list_projects().unwrap();
        let ids: Vec<&str> = projects.iter().map(|p| p.id.as_str()).collect();
        assert!(ids.contains(&source.id.as_str()), "源项目应在列表中");
        assert!(ids.contains(&duplicated.id.as_str()), "新项目应在列表中");

        // 验证新项目 __project_info 的 id 是新 id
        let conn = Connection::open(&new_db_path).unwrap();
        let info_id: String = conn
            .query_row(
                "SELECT id FROM __project_info LIMIT 1",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(info_id, duplicated.id, "__project_info.id 应为新 UUID");

        cleanup_test_project(&source.id);
        cleanup_test_project(&duplicated.id);
    }

    #[test]
    fn test_switch_project_updates_last_opened_at() {
        cleanup_test_project_by_name("test_switch");
        let project_info = ProjectService::create("test_switch", None).unwrap();

        // 切换前 last_opened_at 应为 None
        let before = ProjectService::get_project_info(&project_info.id).unwrap();
        assert!(before.last_opened_at.is_none(), "新建项目 last_opened_at 应为 None");

        // 切换
        let switched = ProjectService::switch_project(&project_info.id);
        assert!(switched.is_ok(), "切换项目失败: {:?}", switched.err());

        let switched = switched.unwrap();
        assert!(switched.last_opened_at.is_some(), "切换后 last_opened_at 应有值");
        assert_eq!(switched.id, project_info.id);

        cleanup_test_project(&project_info.id);
    }

    #[test]
    fn test_get_project_info_not_found() {
        let result = ProjectService::get_project_info("nonexistent-uuid-12345");
        assert!(result.is_err(), "查询不存在的项目应返回错误");
        assert!(result.err().unwrap().contains("项目不存在"));
    }

    #[test]
    fn test_find_project_by_name() {
        cleanup_test_project_by_name("test_find_by_name");
        // 不存在时返回 None
        let not_found = ProjectService::find_project_by_name("test_find_by_name").unwrap();
        assert!(not_found.is_none(), "项目不存在时应返回 None");

        // 创建后应能找到
        let project_info = ProjectService::create("test_find_by_name", None).unwrap();
        let found = ProjectService::find_project_by_name("test_find_by_name").unwrap();
        assert!(found.is_some(), "项目应能被找到");
        assert_eq!(found.unwrap().id, project_info.id);

        cleanup_test_project(&project_info.id);
    }

    #[test]
    fn test_import_project() {
        cleanup_test_project_by_name("test_import_source");
        cleanup_test_project_by_name("test_imported");
        // 先创建一个源项目，导出为文件
        let source = ProjectService::create("test_import_source", None).unwrap();
        let source_db_path = ProjectService::resolve_db_path(&source.db_path).unwrap();

        let temp_dir = tempdir().expect("创建临时目录失败");
        let export_path = temp_dir.path().join("source_export.db");
        ProjectService::export_database(&source_db_path, &export_path).unwrap();
        assert!(export_path.exists());

        // 导入
        let result = ProjectService::import_project(&export_path, "test_imported");
        assert!(result.is_ok(), "导入项目失败: {:?}", result.err());

        let imported = result.unwrap();
        assert_eq!(imported.name, "test_imported");
        assert_ne!(imported.id, source.id, "导入项目应有新 ID");

        let new_db_path = ProjectService::resolve_db_path(&imported.db_path).unwrap();
        assert!(new_db_path.exists(), "导入的数据库文件应存在");

        // 验证 __project_info 表中的 id 是新 id
        let conn = Connection::open(&new_db_path).unwrap();
        let info_id: String = conn
            .query_row(
                "SELECT id FROM __project_info LIMIT 1",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(info_id, imported.id, "__project_info.id 应为导入后的新 UUID");

        cleanup_test_project(&source.id);
        cleanup_test_project(&imported.id);
    }

    #[test]
    fn test_export_project() {
        cleanup_test_project_by_name("test_export_project");
        let project_info = ProjectService::create("test_export_project", None).unwrap();

        let temp_dir = tempdir().expect("创建临时目录失败");
        let dest_path = temp_dir.path().join("exported_project.db");

        let result = ProjectService::export_project(&project_info.id, &dest_path);
        assert!(result.is_ok(), "导出项目失败: {:?}", result.err());
        assert!(dest_path.exists(), "导出文件应存在");

        cleanup_test_project(&project_info.id);
    }

    #[test]
    fn test_get_default_db_path() {
        // 先清理可能存在的 default 项目
        if let Ok(Some(existing)) = ProjectService::find_project_by_name("default") {
            let _ = ProjectService::delete_project(&existing.id);
        }

        let result = ProjectService::get_default_db_path();
        assert!(result.is_ok(), "获取默认数据库路径失败: {:?}", result.err());

        let db_path = result.unwrap();
        assert!(db_path.exists(), "默认数据库文件应存在");
        assert!(db_path.ends_with("meta.db"));

        // 验证注册表中有名为 "default" 的项目
        let default_proj = ProjectService::find_project_by_name("default").unwrap();
        assert!(default_proj.is_some(), "注册表应有 default 项目");

        // 再次调用应返回相同路径（幂等）
        let result2 = ProjectService::get_default_db_path();
        assert!(result2.is_ok());
        assert_eq!(result2.unwrap(), db_path, "重复调用应返回相同路径");

        // 注意：不删除 default 项目，保留给其他测试
    }

    #[test]
    fn test_ensure_registry_idempotent() {
        // 多次调用 ensure_registry 应该是幂等的
        let path1 = ProjectService::ensure_registry().unwrap();
        let path2 = ProjectService::ensure_registry().unwrap();
        assert_eq!(path1, path2, "ensure_registry 应返回相同路径");

        // 验证 __projects_registry 表存在
        let conn = ProjectService::open_registry().unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='__projects_registry'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1, "__projects_registry 表应存在");
    }

    // ==================== 旧版项目迁移测试 ====================

    /// 测试辅助：在指定目录下创建一个旧版项目结构（含 meta.db 和测试数据）
    fn create_legacy_project_structure(base_dir: &Path, project_name: &str) -> PathBuf {
        let project_dir = base_dir.join(project_name);
        std::fs::create_dir_all(&project_dir)
            .unwrap_or_else(|e| panic!("创建旧版项目目录失败: {}", e));
        let db_path = project_dir.join(PROJECT_DB_FILENAME);
        let conn = Connection::open(&db_path)
            .unwrap_or_else(|e| panic!("打开旧版项目数据库失败: {}", e));
        conn.execute(
            "CREATE TABLE test_data (id INTEGER, name TEXT)",
            [],
        )
        .unwrap_or_else(|e| panic!("创建测试表失败: {}", e));
        conn.execute(
            "INSERT INTO test_data VALUES (1, ?)",
            params![project_name],
        )
        .unwrap_or_else(|e| panic!("插入测试数据失败: {}", e));
        drop(conn);
        project_dir
    }

    #[test]
    fn test_migrate_legacy_projects() {
        let temp_dir = tempdir().expect("创建临时目录失败");
        let base_dir = temp_dir.path();

        // 创建旧版项目目录结构
        let old_project_dir = create_legacy_project_structure(base_dir, "default");
        let old_db_path = old_project_dir.join(PROJECT_DB_FILENAME);
        assert!(old_db_path.exists(), "旧版 meta.db 应存在");

        // 运行迁移
        let result = ProjectService::migrate_legacy_projects_in(base_dir);
        assert!(result.is_ok(), "迁移失败: {:?}", result.err());
        let count = result.unwrap();
        assert_eq!(count, 1, "应迁移 1 个项目");

        // 验证旧目录已被移走
        assert!(!old_project_dir.exists(), "旧目录应已被移走");

        // 验证 projects/<uuid>/meta.db 存在
        let projects_dir = base_dir.join(PROJECTS_SUBDIR);
        assert!(projects_dir.exists(), "projects 目录应存在");

        let project_entries: Vec<_> = std::fs::read_dir(&projects_dir)
            .unwrap_or_else(|e| panic!("读取 projects 目录失败: {}", e))
            .collect();
        assert_eq!(project_entries.len(), 1, "应有 1 个项目目录");

        let uuid_dir = project_entries[0]
            .as_ref()
            .unwrap()
            .path();
        let new_db_path = uuid_dir.join(PROJECT_DB_FILENAME);
        assert!(new_db_path.exists(), "新位置 meta.db 应存在");

        // 验证注册表中有对应记录
        let registry_path = base_dir.join(REGISTRY_DB_FILENAME);
        let registry_conn = Connection::open(&registry_path)
            .unwrap_or_else(|e| panic!("打开注册表失败: {}", e));
        let reg_count: i64 = registry_conn
            .query_row(
                "SELECT COUNT(*) FROM __projects_registry WHERE name = ?",
                params!["default"],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(reg_count, 1, "注册表应有 default 项目");

        // 验证 __project_info 表中有数据
        let project_conn = Connection::open(&new_db_path)
            .unwrap_or_else(|e| panic!("打开迁移后的数据库失败: {}", e));
        let info_count: i64 = project_conn
            .query_row(
                "SELECT COUNT(*) FROM __project_info",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(info_count, 1, "__project_info 应有 1 条记录");

        let info_name: String = project_conn
            .query_row(
                "SELECT name FROM __project_info LIMIT 1",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(info_name, "default", "__project_info.name 应为 default");

        // 验证原始业务数据保留
        let data_count: i64 = project_conn
            .query_row(
                "SELECT COUNT(*) FROM test_data",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(data_count, 1, "原始业务数据应保留");

        let data_name: String = project_conn
            .query_row(
                "SELECT name FROM test_data WHERE id = 1",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(data_name, "default", "原始业务数据内容应保留");
    }

    #[test]
    fn test_migrate_legacy_projects_idempotent() {
        let temp_dir = tempdir().expect("创建临时目录失败");
        let base_dir = temp_dir.path();

        // 创建旧版项目结构
        create_legacy_project_structure(base_dir, "idempotent_test");

        // 第一次迁移
        let result1 = ProjectService::migrate_legacy_projects_in(base_dir);
        assert!(result1.is_ok(), "第一次迁移失败: {:?}", result1.err());
        let count1 = result1.unwrap();
        assert_eq!(count1, 1, "第一次迁移应处理 1 个项目");

        // 第二次迁移 - 应返回 0（无旧目录可迁移）
        let result2 = ProjectService::migrate_legacy_projects_in(base_dir);
        assert!(result2.is_ok(), "第二次迁移失败: {:?}", result2.err());
        let count2 = result2.unwrap();
        assert_eq!(count2, 0, "第二次迁移应返回 0（幂等）");

        // 第三次迁移 - 仍然返回 0
        let result3 = ProjectService::migrate_legacy_projects_in(base_dir);
        assert!(result3.is_ok(), "第三次迁移失败: {:?}", result3.err());
        let count3 = result3.unwrap();
        assert_eq!(count3, 0, "第三次迁移应返回 0（幂等）");

        // 验证 projects 目录下仍只有 1 个项目
        let projects_dir = base_dir.join(PROJECTS_SUBDIR);
        let project_count = std::fs::read_dir(&projects_dir)
            .unwrap_or_else(|e| panic!("读取 projects 目录失败: {}", e))
            .count();
        assert_eq!(project_count, 1, "应仍只有 1 个项目目录");
    }

    #[test]
    fn test_migrate_legacy_projects_skips_already_migrated() {
        let temp_dir = tempdir().expect("创建临时目录失败");
        let base_dir = temp_dir.path();

        // 1. 先设置一个已在新结构中的项目（模拟已迁移）
        let registry_path = ProjectService::ensure_registry_at(base_dir).unwrap();
        {
            let conn = Connection::open(&registry_path).unwrap();
            conn.execute(
                "INSERT INTO __projects_registry (id, name, db_path, created_at, updated_at, last_opened_at, description) VALUES (?, ?, ?, ?, ?, NULL, NULL)",
                params![
                    "existing-uuid-1234",
                    "already_migrated",
                    "projects/existing-uuid-1234/meta.db",
                    "2024-01-01T00:00:00Z",
                    "2024-01-01T00:00:00Z"
                ],
            )
            .unwrap();
        }

        // 创建已迁移项目的目录和数据库
        let existing_project_dir = base_dir
            .join(PROJECTS_SUBDIR)
            .join("existing-uuid-1234");
        std::fs::create_dir_all(&existing_project_dir).unwrap();
        {
            let conn = Connection::open(existing_project_dir.join(PROJECT_DB_FILENAME)).unwrap();
            conn.execute(
                "CREATE TABLE __project_info (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL, schema_version INTEGER NOT NULL)",
                [],
            )
            .unwrap();
            conn.execute(
                "INSERT INTO __project_info VALUES (?, ?, ?, ?)",
                params!["existing-uuid-1234", "already_migrated", "2024-01-01T00:00:00Z", 1],
            )
            .unwrap();
        }

        // 2. 创建一个旧版项目目录（需要迁移）
        create_legacy_project_structure(base_dir, "needs_migration");

        // 3. 运行迁移
        let result = ProjectService::migrate_legacy_projects_in(base_dir);
        assert!(result.is_ok(), "迁移失败: {:?}", result.err());
        let count = result.unwrap();
        assert_eq!(count, 1, "应只迁移 1 个项目（needs_migration）");

        // 4. 验证旧目录已被移走
        let old_needs_migration_dir = base_dir.join("needs_migration");
        assert!(
            !old_needs_migration_dir.exists(),
            "needs_migration 旧目录应已被移走"
        );

        // 5. 验证已迁移项目未被改动
        let existing_db = existing_project_dir.join(PROJECT_DB_FILENAME);
        let conn = Connection::open(&existing_db).unwrap();
        let existing_id: String = conn
            .query_row(
                "SELECT id FROM __project_info WHERE name = ?",
                params!["already_migrated"],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(
            existing_id, "existing-uuid-1234",
            "已迁移项目不应被修改"
        );

        // 6. 验证 projects 目录下有 2 个项目
        let projects_dir = base_dir.join(PROJECTS_SUBDIR);
        let project_count = std::fs::read_dir(&projects_dir)
            .unwrap_or_else(|e| panic!("读取 projects 目录失败: {}", e))
            .count();
        assert_eq!(project_count, 2, "应有 2 个项目目录（原有 + 新迁移）");

        // 7. 验证注册表中有 2 条记录
        let registry_conn = Connection::open(&registry_path).unwrap();
        let total_count: i64 = registry_conn
            .query_row(
                "SELECT COUNT(*) FROM __projects_registry",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(total_count, 2, "注册表应有 2 条记录");
    }
}

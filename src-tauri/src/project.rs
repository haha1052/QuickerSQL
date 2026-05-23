use std::path::{Path, PathBuf};
use rusqlite::{Connection, OpenFlags};
use thiserror::Error;
use dirs::data_dir;

#[derive(Error, Debug)]
pub enum ProjectError {
    #[error("无法获取数据目录")]
    DataDirNotFound,
    
    #[error("创建目录失败: {0}")]
    CreateDirFailed(String),
    
    #[error("创建数据库失败: {0}")]
    CreateDbFailed(String),
    
    #[error("打开数据库失败: {0}")]
    OpenDbFailed(String),
    
    #[error("配置数据库失败: {0}")]
    ConfigDbFailed(String),
    
    #[error("数据库文件不存在")]
    DbNotFound,
    
    #[error("数据库验证失败: {0}")]
    ValidationFailed(String),
    
    #[error("项目名称无效: {0}")]
    InvalidName(String),
    
    #[error("项目已存在: {0}")]
    ProjectExists(String),
    
    #[error("重命名项目失败: {0}")]
    RenameFailed(String),
}

pub type Result<T> = std::result::Result<T, ProjectError>;

pub struct ProjectManager;

impl ProjectManager {
    pub fn create(project_name: &str) -> Result<PathBuf> {
        let data_dir = data_dir()
            .ok_or(ProjectError::DataDirNotFound)?
            .join("la-duck")
            .join(project_name);
        
        std::fs::create_dir_all(&data_dir)
            .map_err(|e| ProjectError::CreateDirFailed(e.to_string()))?;
        
        let db_path = data_dir.join("meta.db");
        
        if db_path.exists() {
            std::fs::remove_file(&db_path)
                .map_err(|e| ProjectError::CreateDirFailed(e.to_string()))?;
        }
        
        Self::init_database(&db_path)?;
        
        Ok(db_path)
    }
    
    pub fn open(db_path: &Path) -> Result<bool> {
        if !db_path.exists() {
            return Err(ProjectError::DbNotFound);
        }
        
        let mut conn = Connection::open(db_path)
            .map_err(|e| ProjectError::OpenDbFailed(e.to_string()))?;
        
        Self::ensure_wal(&mut conn)?;
        
        Ok(true)
    }
    
    pub fn list_projects() -> Result<Vec<String>> {
        let base_dir = data_dir()
            .ok_or(ProjectError::DataDirNotFound)?
            .join("la-duck");
        
        if !base_dir.exists() {
            return Ok(Vec::new());
        }
        
        let mut projects = Vec::new();
        
        for entry in std::fs::read_dir(&base_dir)
            .map_err(|e| ProjectError::CreateDirFailed(e.to_string()))?
        {
            let entry = entry.map_err(|e| ProjectError::CreateDirFailed(e.to_string()))?;
            let path = entry.path();
            
            if path.is_dir() && path.join("meta.db").exists() {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    projects.push(name.to_string());
                }
            }
        }
        
        projects.sort();
        Ok(projects)
    }
    
    pub fn delete_project(project_name: &str) -> Result<()> {
        let project_dir = data_dir()
            .ok_or(ProjectError::DataDirNotFound)?
            .join("la-duck")
            .join(project_name);
        
        if !project_dir.exists() {
            return Err(ProjectError::DbNotFound);
        }
        
        std::fs::remove_dir_all(&project_dir)
            .map_err(|e| ProjectError::CreateDirFailed(e.to_string()))?;
        
        Ok(())
    }
    
    pub fn rename_project(old_name: &str, new_name: &str) -> Result<()> {
        let base_dir = data_dir()
            .ok_or(ProjectError::DataDirNotFound)?
            .join("la-duck");
        
        let old_dir = base_dir.join(old_name);
        let new_dir = base_dir.join(new_name);
        
        if !old_dir.exists() {
            return Err(ProjectError::DbNotFound);
        }
        
        if new_dir.exists() {
            return Err(ProjectError::ProjectExists(new_name.to_string()));
        }
        
        if new_name.trim().is_empty() {
            return Err(ProjectError::InvalidName("项目名称不能为空".to_string()));
        }
        
        std::fs::rename(&old_dir, &new_dir)
            .map_err(|e| ProjectError::RenameFailed(e.to_string()))?;
        
        Ok(())
    }
    
    pub fn get_default_db_path() -> Result<PathBuf> {
        let db_path = data_dir()
            .ok_or(ProjectError::DataDirNotFound)?
            .join("la-duck")
            .join("default")
            .join("meta.db");
        
        if !db_path.exists() {
            let _ = Self::create("default");
        }
        
        Ok(db_path)
    }
    
    pub fn export_database(source_path: &Path, dest_path: &Path) -> Result<()> {
        if !source_path.exists() {
            return Err(ProjectError::DbNotFound);
        }
        
        if dest_path.exists() {
            std::fs::remove_file(dest_path)
                .map_err(|e| ProjectError::CreateDirFailed(e.to_string()))?;
        }
        
        std::fs::copy(source_path, dest_path)
            .map_err(|e| ProjectError::CreateDirFailed(e.to_string()))?;
        
        Ok(())
    }
    
    fn init_database(db_path: &PathBuf) -> Result<()> {
        let flags = OpenFlags::SQLITE_OPEN_READ_WRITE 
            | OpenFlags::SQLITE_OPEN_CREATE
            | OpenFlags::SQLITE_OPEN_NO_MUTEX;
        
        let conn = Connection::open_with_flags(db_path, flags)
            .map_err(|e| ProjectError::CreateDbFailed(e.to_string()))?;
        
        conn.execute_batch(
            "PRAGMA journal_mode=WAL;
             PRAGMA synchronous=NORMAL;
             PRAGMA cache_size=-20000;
             PRAGMA temp_store=MEMORY;"
        ).map_err(|e| ProjectError::ConfigDbFailed(e.to_string()))?;
        
        Ok(())
    }
    
    fn ensure_wal(conn: &mut Connection) -> Result<()> {
        let mode: String = conn.query_row("PRAGMA journal_mode", [], |row| row.get(0))
            .map_err(|e| ProjectError::ConfigDbFailed(e.to_string()))?;
        
        if mode != "wal" {
            conn.execute("PRAGMA journal_mode=WAL", [])
                .map_err(|e| ProjectError::ConfigDbFailed(e.to_string()))?;
        }
        
        Ok(())
    }
    
    pub fn get_wal_status(db_path: &Path) -> Result<bool> {
        let conn = Connection::open(db_path)
            .map_err(|e| ProjectError::OpenDbFailed(e.to_string()))?;
        
        let mode: String = conn.query_row("PRAGMA journal_mode", [], |row| row.get(0))
            .map_err(|e| ProjectError::ValidationFailed(e.to_string()))?;
        
        Ok(mode == "wal")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use tempfile::tempdir;

    #[test]
    fn test_create_project() {
        let result = ProjectManager::create("test_create");
        assert!(result.is_ok(), "创建项目失败: {:?}", result.err());

        let db_path = result.unwrap();
        assert!(db_path.exists(), "数据库文件不存在");
        assert!(db_path.ends_with("la-duck/test_create/meta.db"));

        let wal_status = ProjectManager::get_wal_status(&db_path);
        assert!(wal_status.is_ok(), "获取WAL状态失败");
        assert!(wal_status.unwrap(), "WAL模式未开启");

        let _ = ProjectManager::delete_project("test_create");
    }

    #[test]
    fn test_open_project() {
        let result = ProjectManager::create("test_open");
        assert!(result.is_ok());

        let db_path = result.unwrap();
        let open_result = ProjectManager::open(&db_path);
        assert!(open_result.is_ok(), "打开项目失败");
        assert!(open_result.unwrap());

        let wal_status = ProjectManager::get_wal_status(&db_path);
        assert!(wal_status.unwrap(), "WAL模式未保持");

        let _ = ProjectManager::delete_project("test_open");
    }

    #[test]
    fn test_open_nonexistent_project() {
        let nonexistent_path = PathBuf::from("/nonexistent/path/meta.db");
        let result = ProjectManager::open(&nonexistent_path);
        assert!(matches!(result.err(), Some(ProjectError::DbNotFound)));
    }

    #[test]
    fn test_list_projects() {
        ProjectManager::create("test_list_1").unwrap();
        ProjectManager::create("test_list_2").unwrap();

        let projects = ProjectManager::list_projects();
        assert!(projects.is_ok());

        let project_list = projects.unwrap();
        assert!(project_list.contains(&"test_list_1".to_string()));
        assert!(project_list.contains(&"test_list_2".to_string()));

        let _ = ProjectManager::delete_project("test_list_1");
        let _ = ProjectManager::delete_project("test_list_2");
    }

    #[test]
    fn test_delete_project() {
        ProjectManager::create("test_delete").unwrap();

        let result = ProjectManager::delete_project("test_delete");
        assert!(result.is_ok(), "删除项目失败");

        let projects = ProjectManager::list_projects().unwrap();
        assert!(!projects.contains(&"test_delete".to_string()));
    }

    #[test]
    fn test_export_database() {
        let source_path = ProjectManager::create("test_export").unwrap();

        let temp_dir = tempdir().expect("创建临时目录失败");
        let dest_path = temp_dir.path().join("exported.db");

        let result = ProjectManager::export_database(&source_path, &dest_path);
        assert!(result.is_ok(), "导出数据库失败");
        assert!(dest_path.exists(), "导出文件不存在");

        let _ = ProjectManager::delete_project("test_export");
    }

    #[test]
    fn test_wal_mode_enabled() {
        let db_path = ProjectManager::create("test_wal").unwrap();
        let wal_status = ProjectManager::get_wal_status(&db_path);

        assert!(wal_status.is_ok());
        assert!(wal_status.unwrap(), "WAL模式应该开启");

        let _ = ProjectManager::delete_project("test_wal");
    }
}
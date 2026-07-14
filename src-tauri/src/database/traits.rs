use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum DatabaseError {
    #[error("连接失败: {0}")]
    ConnectionFailed(String),
    
    #[error("查询执行失败: {0}")]
    QueryFailed(String),
    
    #[error("准备语句失败: {0}")]
    PrepareFailed(String),
    
    #[error("列索引无效: {0}")]
    InvalidColumnIndex(usize),
    
    #[error("数据类型转换失败: {0}")]
    TypeConversionFailed(String),
    
    #[error("表不存在: {0}")]
    TableNotFound(String),
    
    #[error("数据库文件不存在")]
    FileNotFound,
    
    #[error("配置失败: {0}")]
    ConfigurationFailed(String),
    
    #[error("事务失败: {0}")]
    TransactionFailed(String),
    
    #[error("权限不足")]
    PermissionDenied,
    
    #[error("数据库已关闭")]
    DatabaseClosed,

    #[error("数据库连接未初始化")]
    ConnectionNotInitialized,

    #[error("数据库连接占用超时，请关闭其他查询再重试")]
    ConnectionTimeout,

    #[error("未知错误: {0}")]
    Unknown(String),
}

pub type Result<T> = std::result::Result<T, DatabaseError>;

#[derive(Clone)]
pub struct QueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<String>>,
}

pub trait DatabaseConnection: Send + Sync + 'static {
    fn get_database_type(&self) -> &'static str;
    
    fn execute(&self, sql: &str, params: &[&dyn ToSql]) -> Result<u64>;
    
    fn query(&self, sql: &str, params: &[&dyn ToSql]) -> Result<QueryResult>;
    
    fn begin_transaction(&self) -> Result<()>;
    
    fn commit_transaction(&self) -> Result<()>;
    
    fn rollback_transaction(&self) -> Result<()>;
    
    fn is_open(&self) -> bool;
    
    fn close(&self);
    
    /// 批量插入数据
    /// table: 表名
    /// columns: 列名列表
    /// rows: 数据行列表
    /// batch_size: 每批行数（默认1000）
    fn batch_insert(&self, table: &str, columns: &[&str], rows: &[Vec<String>], batch_size: usize) -> Result<u64>;
}

pub trait ToSql {
    fn to_sql(&self) -> String;
}

impl ToSql for str {
    fn to_sql(&self) -> String {
        self.to_string()
    }
}

impl ToSql for String {
    fn to_sql(&self) -> String {
        self.clone()
    }
}

impl ToSql for i32 {
    fn to_sql(&self) -> String {
        self.to_string()
    }
}

impl ToSql for i64 {
    fn to_sql(&self) -> String {
        self.to_string()
    }
}

impl ToSql for u64 {
    fn to_sql(&self) -> String {
        self.to_string()
    }
}

impl ToSql for f64 {
    fn to_sql(&self) -> String {
        self.to_string()
    }
}

impl ToSql for bool {
    fn to_sql(&self) -> String {
        if *self { "1".to_string() } else { "0".to_string() }
    }
}

impl<T: ToSql + ?Sized> ToSql for &T {
    fn to_sql(&self) -> String {
        (*self).to_sql()
    }
}

pub trait DatabaseDriver: Send + Sync + 'static {
    fn get_driver_name(&self) -> &'static str;
    
    fn is_available(&self) -> bool;
    
    fn connect(&self, path: &Path) -> Result<Box<dyn DatabaseConnection>>;
    
    fn create_database(&self, path: &Path) -> Result<Box<dyn DatabaseConnection>>;
    
    fn supports_wal(&self) -> bool;
}

pub struct DatabaseManager {
    drivers: Vec<Box<dyn DatabaseDriver>>,
    active_connection: Mutex<Option<Box<dyn DatabaseConnection>>>,
    // 记录最近一次成功连接的 driver name + 路径，用于 open_temporary_connection
    active_driver_name: Mutex<Option<String>>,
    active_db_path: Mutex<Option<PathBuf>>,
}

impl Default for DatabaseManager {
    fn default() -> Self {
        Self::new()
    }
}

impl DatabaseManager {
    pub fn new() -> Self {
        DatabaseManager {
            drivers: Vec::new(),
            active_connection: Mutex::new(None),
            active_driver_name: Mutex::new(None),
            active_db_path: Mutex::new(None),
        }
    }

    pub fn register_driver(&mut self, driver: Box<dyn DatabaseDriver>) {
        self.drivers.push(driver);
    }

    pub fn get_available_drivers(&self) -> Vec<&dyn DatabaseDriver> {
        self.drivers.iter()
            .filter(|d| d.is_available())
            .map(|d| d.as_ref())
            .collect()
    }

    pub fn connect(&self, driver_name: &str, path: &Path) -> Result<()> {
        let driver = self.drivers.iter()
            .find(|d| d.get_driver_name() == driver_name)
            .ok_or_else(|| DatabaseError::ConnectionFailed(format!("未找到驱动: {}", driver_name)))?;

        let connection = driver.connect(path)?;
        *self.lock_active_connection()? = Some(connection);
        self.record_connection_meta(driver_name, path);
        Ok(())
    }

    pub fn create_and_connect(&self, driver_name: &str, path: &Path) -> Result<()> {
        let driver = self.drivers.iter()
            .find(|d| d.get_driver_name() == driver_name)
            .ok_or_else(|| DatabaseError::ConnectionFailed(format!("未找到驱动: {}", driver_name)))?;

        let connection = driver.create_database(path)?;
        *self.lock_active_connection()? = Some(connection);
        self.record_connection_meta(driver_name, path);
        Ok(())
    }

    /// 暴露主连接的 guard（内部使用），对 Mutex poison 自动恢复
    fn lock_active_connection(&self)
        -> Result<std::sync::MutexGuard<'_, Option<Box<dyn DatabaseConnection>>>>
    {
        match self.active_connection.lock() {
            Ok(guard) => Ok(guard),
            Err(poisoned) => {
                log::warn!("DB Mutex 被 poison（上一命令可能 panic），自动恢复到 poison 前状态");
                Ok(poisoned.into_inner())
            }
        }
    }

    fn record_connection_meta(&self, driver_name: &str, path: &Path) {
        if let Ok(mut g) = self.active_driver_name.lock() {
            *g = Some(driver_name.to_string());
        }
        if let Ok(mut g) = self.active_db_path.lock() {
            *g = Some(path.to_path_buf());
        }
    }

    /// 读取最近一次成功连接的 driver name 与 db_path（供 open_temporary_connection 使用）
    pub fn get_connection_meta(&self) -> (Option<String>, Option<PathBuf>) {
        let driver = self.active_driver_name.lock().ok().and_then(|g| g.clone());
        let path = self.active_db_path.lock().ok().and_then(|g| g.clone());
        (driver, path)
    }

    /// 获取主连接（Mutex guard）——所有短命令（get_app_state, settings, 工作区）都走这里
    pub fn get_connection(&self) -> Result<MutexGuardConnection<'_>> {
        let guard = self.lock_active_connection()?;
        let _ = guard.as_ref().ok_or(DatabaseError::DatabaseClosed)?;
        Ok(MutexGuardConnection { guard })
    }

    /// 获取主连接（带超时）——使用 try_lock + sleep 实现超时逻辑
    /// 默认超时 5 秒，超时返回 ConnectionTimeout 错误
    pub fn get_connection_with_timeout(&self, timeout: Duration) -> Result<MutexGuardConnection<'_>> {
        let start = Instant::now();
        
        loop {
            match self.active_connection.try_lock() {
                Ok(guard) => {
                    let _ = guard.as_ref().ok_or(DatabaseError::DatabaseClosed)?;
                    return Ok(MutexGuardConnection { guard });
                }
                Err(std::sync::TryLockError::WouldBlock) => {
                    if start.elapsed() >= timeout {
                        return Err(DatabaseError::ConnectionTimeout);
                    }
                    // 短暂休眠后重试，避免 CPU 空转
                    thread::sleep(Duration::from_millis(50));
                }
                Err(std::sync::TryLockError::Poisoned(poisoned)) => {
                    log::warn!("DB Mutex 被 poison（上一命令可能 panic），自动恢复到 poison 前状态");
                    let guard = poisoned.into_inner();
                    let _ = guard.as_ref().ok_or(DatabaseError::DatabaseClosed)?;
                    return Ok(MutexGuardConnection { guard });
                }
            }
        }
    }

    /// 打开一条独立的临时连接（通过同一名 driver 再 connect 一次到同一路径），
    /// 用于"长 SQL / 自动化任务中的用户脚本"，避免持有主连接锁阻塞前端短命令。
    /// 该连接由调用方负责释放（Box<dyn DatabaseConnection> 自身 drop 时会关闭）。
    pub fn open_temporary_connection(&self) -> Result<Box<dyn DatabaseConnection>> {
        let (driver_name, db_path) = self.get_connection_meta();
        let driver_name = driver_name.ok_or_else(|| {
            DatabaseError::ConnectionFailed("尚未建立任何数据库连接".to_string())
        })?;
        let db_path = db_path.ok_or_else(|| {
            DatabaseError::ConnectionFailed("尚未建立任何数据库路径".to_string())
        })?;

        let driver = self.drivers.iter()
            .find(|d| d.get_driver_name() == driver_name)
            .ok_or_else(|| DatabaseError::ConnectionFailed(format!("未找到驱动: {}", driver_name)))?;

        driver.connect(&db_path)
    }

    pub fn close_connection(&self) {
        if let Ok(mut conn) = self.active_connection.lock() {
            if let Some(c) = conn.take() {
                c.close();
            }
        }
    }

    pub fn is_connected(&self) -> bool {
        self.active_connection.lock()
            .map(|conn| conn.as_ref().is_some_and(|c| c.is_open()))
            .unwrap_or(false)
    }
}

pub struct MutexGuardConnection<'a> {
    guard: std::sync::MutexGuard<'a, Option<Box<dyn DatabaseConnection>>>,
}

impl<'a> MutexGuardConnection<'a> {
    pub fn get_database_type(&self) -> &'static str {
        match self.guard.as_ref() {
            Some(conn) => conn.get_database_type(),
            None => {
                log::warn!("MutexGuardConnection: 数据库连接未初始化");
                "unknown"
            }
        }
    }

    pub fn execute(&self, sql: &str, params: &[&dyn ToSql]) -> Result<u64> {
        let conn = self.guard.as_ref().ok_or(DatabaseError::ConnectionNotInitialized)?;
        conn.execute(sql, params)
    }

    pub fn query(&self, sql: &str, params: &[&dyn ToSql]) -> Result<QueryResult> {
        let conn = self.guard.as_ref().ok_or(DatabaseError::ConnectionNotInitialized)?;
        conn.query(sql, params)
    }

    pub fn begin_transaction(&self) -> Result<()> {
        let conn = self.guard.as_ref().ok_or(DatabaseError::ConnectionNotInitialized)?;
        conn.begin_transaction()
    }

    pub fn commit_transaction(&self) -> Result<()> {
        let conn = self.guard.as_ref().ok_or(DatabaseError::ConnectionNotInitialized)?;
        conn.commit_transaction()
    }

    pub fn rollback_transaction(&self) -> Result<()> {
        let conn = self.guard.as_ref().ok_or(DatabaseError::ConnectionNotInitialized)?;
        conn.rollback_transaction()
    }

    pub fn batch_insert(&self, table: &str, columns: &[&str], rows: &[Vec<String>], batch_size: usize) -> Result<u64> {
        let conn = self.guard.as_ref().ok_or(DatabaseError::ConnectionNotInitialized)?;
        conn.batch_insert(table, columns, rows, batch_size)
    }
}

pub type SharedDatabaseManager = Arc<DatabaseManager>;
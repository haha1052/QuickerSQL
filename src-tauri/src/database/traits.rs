use std::path::Path;
use std::sync::{Arc, Mutex};
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
}

impl DatabaseManager {
    pub fn new() -> Self {
        DatabaseManager {
            drivers: Vec::new(),
            active_connection: Mutex::new(None),
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
        *self.active_connection.lock().map_err(|e| DatabaseError::ConnectionFailed(e.to_string()))? = Some(connection);
        Ok(())
    }
    
    pub fn create_and_connect(&self, driver_name: &str, path: &Path) -> Result<()> {
        let driver = self.drivers.iter()
            .find(|d| d.get_driver_name() == driver_name)
            .ok_or_else(|| DatabaseError::ConnectionFailed(format!("未找到驱动: {}", driver_name)))?;
        
        let connection = driver.create_database(path)?;
        *self.active_connection.lock().map_err(|e| DatabaseError::ConnectionFailed(e.to_string()))? = Some(connection);
        Ok(())
    }
    
    pub fn get_connection(&self) -> Result<MutexGuardConnection<'_>> {
        let guard = self.active_connection.lock().map_err(|e| DatabaseError::ConnectionFailed(e.to_string()))?;
        let _conn = guard.as_ref()
            .ok_or_else(|| DatabaseError::DatabaseClosed)?;
        
        Ok(MutexGuardConnection {
            guard,
        })
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
            .map(|conn| conn.as_ref().map_or(false, |c| c.is_open()))
            .unwrap_or(false)
    }
}

pub struct MutexGuardConnection<'a> {
    guard: std::sync::MutexGuard<'a, Option<Box<dyn DatabaseConnection>>>,
}

impl<'a> MutexGuardConnection<'a> {
    pub fn get_database_type(&self) -> &'static str {
        self.guard.as_ref().unwrap().get_database_type()
    }
    
    pub fn execute(&self, sql: &str, params: &[&dyn ToSql]) -> Result<u64> {
        self.guard.as_ref().unwrap().execute(sql, params)
    }
    
    pub fn query(&self, sql: &str, params: &[&dyn ToSql]) -> Result<QueryResult> {
        self.guard.as_ref().unwrap().query(sql, params)
    }
    
    pub fn begin_transaction(&self) -> Result<()> {
        self.guard.as_ref().unwrap().begin_transaction()
    }
    
    pub fn commit_transaction(&self) -> Result<()> {
        self.guard.as_ref().unwrap().commit_transaction()
    }
    
    pub fn rollback_transaction(&self) -> Result<()> {
        self.guard.as_ref().unwrap().rollback_transaction()
    }
    
    pub fn batch_insert(&self, table: &str, columns: &[&str], rows: &[Vec<String>], batch_size: usize) -> Result<u64> {
        self.guard.as_ref().unwrap().batch_insert(table, columns, rows, batch_size)
    }
}

pub type SharedDatabaseManager = Arc<DatabaseManager>;
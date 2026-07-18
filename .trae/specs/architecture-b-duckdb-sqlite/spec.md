# 方案 B 详细设计方案：系统表 SQLite + 用户数据 DuckDB（v2.1）

> **版本**: v2.1（根据用户决策点同步更新）
> **日期**: 2026-07-18
> **决策点确认**:
> - [x] 纯系统表走 SQLite，其他全走 DuckDB（简化路由，无需混合查询改写）
> - [x] DuckDB 版本支持 ATTACH（保留 sysdb 只读 ATTACH，支持用户手动 ATTACH 外部文件）
> - [x] 直接迁移，无需兼容旧版（用户已删除所有用户表，仅保留系统表）
> - [x] 需要展示系统表，前端由设置系统控制（默认展示，可通过设置关闭）

---

## 一、目标架构

### 1.1 架构对比

| 维度 | 当前架构 | 方案 B 架构 |
|------|---------|------------|
| 系统表存储 | SQLite | SQLite（**不变**） |
| 用户数据存储 | SQLite | **DuckDB（持久化文件模式）** |
| DuckDB 角色 | 内存模式 + ATTACH + VIEW 加速 | **独立持久化业务数据库** |
| 路由策略 | 按 SQL 关键字（写→SQLite，分析→DuckDB） | **按表名前缀（`__`→SQLite，其他→DuckDB）** |
| VIEW 机制 | 每张用户表一个 VIEW | **移除** |
| ATTACH 机制 | DuckDB ATTACH SQLite | **保留（仅 sysdb 只读 ATTACH，支持用户手动 ATTACH 外部 DuckDB 文件）** |
| 混合查询 | 支持（VIEW 机制） | **不支持**（纯系统表→SQLite，其他→DuckDB） |

### 1.2 新架构图

```
┌──────────────────────────────────────────────────────────────┐
│                      TauriAppState                            │
│                                                               │
│  ┌─────────────────────┐    ┌─────────────────────────────┐  │
│  │  sqlite_manager      │    │  duckdb_manager              │  │
│  │  (系统库 SQLite)     │    │  (业务库 DuckDB)             │  │
│  │                      │    │                              │  │
│  │  17 张系统表         │    │  用户业务表                  │  │
│  │  __settings          │    │  (用户导入/创建的数据)       │  │
│  │  __app_state         │    │                              │  │
│  │  __audit_logs        │    │  持久化文件模式              │  │
│  │  __query_history     │    │  business.duckdb             │  │
│  │  __automation_tasks  │    │                              │  │
│  │  __dashboards        │    │  支持 ATTACH 外部 DuckDB     │  │
│  │  __saved_charts      │    │  用户可手动 ATTACH 其他文件   │  │
│  │  ... (共17张)        │    │                              │  │
│  └──────────┬───────────┘    └──────────────┬───────────────┘  │
│             │                               │                  │
│             └──────────┬────────────────────┘                  │
│                        ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              SmartRouter (智能路由层)                    │  │
│  │                                                         │  │
│  │  1. SQL 解析：提取涉及的表名                            │  │
│  │  2. 表名分类：                                          │  │
│  │     - __ 前缀 → 系统表 → SQLite                         │  │
│  │     - 无前缀 → 用户表 → DuckDB                          │  │
│  │     - 无法识别 → DuckDB（默认）                         │  │
│  │  3. 混合查询：不支持，返回明确错误提示                   │  │
│  └─────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### 1.3 文件结构变化

```
<data_dir>/quickersql/
├── projects.db                    # 全局项目注册表 (SQLite) — 不变
│   └── __projects_registry
└── projects/<uuid>/
    ├── meta.db                    # 项目元数据 (SQLite) — 不变
    │   └── __project_info
    ├── system.db                  # 系统库 (SQLite) — 由原 data.db 改名
    │   ├── __settings
    │   ├── __app_state
    │   └── ... (15张系统表)
    └── business.duckdb            # 业务库 (DuckDB) — 新增
        └── 用户表（导入/创建的数据）
```

### 1.4 迁移策略（直接迁移，无需兼容旧版）

用户已确认删除所有用户表，迁移流程简化为：

```
应用首次启动（方案 B）
    │
    ├─ 1. 检测旧 data.db 是否存在
    │
    ├─ 2. 如果存在：
    │   ├─ 重命名为 system.db（保留系统表，用户表已删除）
    │   ├─ 创建 business.duckdb（空库）
    │   └─ ATTACH system.db 为 sysdb（只读模式）
    │
    └─ 3. 如果不存在：
        ├─ 创建 system.db（初始化系统表）
        ├─ 创建 business.duckdb（空库）
        └─ ATTACH system.db 为 sysdb（只读模式）
```

> **注意**：用户已删除所有用户表，无需执行数据迁移。ATTACH sysdb 仅用于用户需要通过 DuckDB 读取系统表数据的场景。

---

## 二、智能路由设计（简化版）

### 2.1 路由决策流程

```
用户在 SQL 查询框输入 SQL
        │
        ▼
┌───────────────────────────┐
│  Step 1: SQL 预处理       │
│  - 去除注释               │
│  - 拆分多语句（按 ; ）    │
│  - 标准化空白             │
└───────────┬───────────────┘
            ▼
┌───────────────────────────┐
│  Step 2: 语句类型判定     │
│  - DDL: CREATE/DROP/ALTER │
│  - DML: INSERT/UPDATE/DEL │
│  - DQL: SELECT/WITH       │
│  - DCL: PRAGMA/VACUUM     │
└───────────┬───────────────┘
            ▼
┌───────────────────────────┐
│  Step 3: 表名提取         │
│  - 从 FROM/INTO/UPDATE/   │
│    JOIN/TABLE 关键字后    │
│    提取表名               │
└───────────┬───────────────┘
            ▼
┌───────────────────────────┐
│  Step 4: 引擎路由         │
│                           │
│  全部 __ 前缀表？         │
│    → SQLite (系统库)      │
│                           │
│  包含非 __ 前缀表？       │
│    → DuckDB (业务库)      │
│                           │
│  混合表？                 │
│    → 返回错误：不支持跨库 │
│                           │
│  PRAGMA / VACUUM？       │
│    → SQLite (系统库)      │
│                           │
│  无法解析表名？           │
│    → DuckDB (默认)        │
└───────────────────────────┘
```

### 2.2 路由规则速查表

| SQL 语句 | 涉及表 | 路由结果 |
|---------|--------|---------|
| `SELECT * FROM users WHERE id=1` | users | DuckDB |
| `SELECT COUNT(*) FROM sales GROUP BY region` | sales | DuckDB |
| `SELECT * FROM __settings WHERE category='ui'` | __settings | SQLite |
| `INSERT INTO __audit_logs VALUES(...)` | __audit_logs | SQLite |
| `UPDATE __app_state SET value='x'` | __app_state | SQLite |
| `SELECT * FROM users JOIN __settings` | users, __settings | ❌ 错误：不支持跨库查询 |
| `CREATE TABLE new_table (id INT)` | new_table | DuckDB |
| `DROP TABLE old_data` | old_data | DuckDB |
| `PRAGMA table_info(users)` | — | SQLite |
| `SELECT * FROM __query_history ORDER BY executed_at` | __query_history | SQLite |

### 2.3 路由器接口设计

```rust
pub struct SmartRouter;

impl SmartRouter {
    /// 智能路由：根据 SQL 内容决定使用哪个引擎
    pub fn route(sql: &str) -> RouteResult {
        // 1. PRAGMA / VACUUM / REINDEX → 固定走 SQLite
        let upper = sql.trim().to_uppercase();
        if upper.starts_with("PRAGMA") || upper.starts_with("VACUUM") || upper.starts_with("REINDEX") {
            return RouteResult::Sqlite;
        }
        
        // 2. 提取表名
        let table_names = Self::extract_table_names(sql);
        
        // 3. 分类表名
        let has_system_table = table_names.iter().any(|t| t.starts_with("__"));
        let has_user_table = table_names.iter().any(|t| !t.starts_with("__"));
        
        // 4. 路由决策
        match (has_system_table, has_user_table) {
            (true, false) => RouteResult::Sqlite,       // 纯系统表
            (false, true) => RouteResult::Duckdb,       // 纯用户表
            (false, false) => RouteResult::Duckdb,      // 无法识别，默认 DuckDB
            (true, true) => RouteResult::CrossDbError,  // 混合查询，不支持
        }
    }
    
    /// 从 SQL 中提取表名
    pub fn extract_table_names(sql: &str) -> Vec<String> {
        // 实现：正则匹配 FROM/INTO/UPDATE/JOIN/TABLE 后的表名
    }
}

pub enum RouteResult {
    Sqlite,                    // 走 SQLite 系统库
    Duckdb,                    // 走 DuckDB 业务库
    CrossDbError,              // 混合查询，不支持
}
```

---

## 三、连接管理设计

### 3.1 双连接管理器

```rust
pub struct TauriAppState {
    // 系统库连接（SQLite）
    sqlite_manager: Arc<DatabaseManager>,  // 管理 system.db
    
    // 业务库连接（DuckDB）
    duckdb_manager: Arc<DuckDbManager>,    // 管理 business.duckdb
    
    // 业务库路径
    duckdb_path: Mutex<PathBuf>,
    
    // ... 其他现有字段（query_cache, app_handle 等）
}
```

### 3.2 初始化流程

```
应用启动
    │
    ├─ 1. 初始化 SQLite 系统库 (system.db)
    │   ├─ 检测旧 data.db → 重命名为 system.db
    │   ├─ 打开/创建 system.db
    │   ├─ PRAGMA journal_mode=WAL
    │   ├─ PRAGMA foreign_keys=ON
    │   └─ 初始化 17 张系统表（事务包裹）
    │
    ├─ 2. 初始化 DuckDB 业务库 (business.duckdb)
    │   ├─ 打开/创建 business.duckdb（持久化模式）
    │   ├─ SET preserve_insertion_order = false
    │   └─ ATTACH 'system.db' AS sysdb (只读模式)
    │
    └─ 3. 完成，通知前端
```

### 3.3 项目切换流程

```
用户切换项目
    │
    ├─ 1. 关闭当前项目的 DuckDB 连接（DETACH sysdb）
    │
    ├─ 2. 关闭当前项目的 SQLite 连接
    │
    ├─ 3. 打开新项目的 system.db (SQLite)
    │   └─ 初始化系统表（如需要）
    │
    ├─ 4. 打开新项目的 business.duckdb (DuckDB)
    │   ├─ 配置参数
    │   └─ ATTACH 'system.db' AS sysdb (只读模式)
    │
    └─ 5. 通知前端切换完成
```

---

## 四、各模块改造方案

### 4.1 database/router.rs — 智能路由重写

**改动清单**：

| 改动项 | 当前 | 改造后 |
|--------|------|--------|
| 新增 `extract_table_names()` | 无 | 从 SQL 中提取表名 |
| 重写 `should_use_duckdb()` | 按 SQL 关键字路由 | 改为 `route()` 返回 `RouteResult` |
| 删除 `route_table_names()` | VIEW 路由 | 删除（VIEW 机制移除） |
| 删除 `get_table_names()` | 获取 SQLite 表名 | 删除（移到 meta.rs） |

**关键代码**：

```rust
pub struct SmartRouter;

impl SmartRouter {
    pub fn route(sql: &str) -> RouteResult {
        let upper = sql.trim().to_uppercase();
        if upper.is_empty() {
            return RouteResult::Duckdb;
        }
        
        // PRAGMA / VACUUM / REINDEX → SQLite
        if upper.starts_with("PRAGMA") || upper.starts_with("VACUUM") || upper.starts_with("REINDEX") {
            return RouteResult::Sqlite;
        }
        
        // 提取表名
        let table_names = Self::extract_table_names(sql);
        let has_system_table = table_names.iter().any(|t| t.starts_with("__"));
        let has_user_table = table_names.iter().any(|t| !t.starts_with("__"));
        
        match (has_system_table, has_user_table) {
            (true, false) => RouteResult::Sqlite,
            (false, true) => RouteResult::Duckdb,
            (false, false) => RouteResult::Duckdb,
            (true, true) => RouteResult::CrossDbError,
        }
    }
    
    fn extract_table_names(sql: &str) -> Vec<String> {
        // 使用正则提取 FROM/INTO/UPDATE/JOIN/TABLE 后的表名
        // 示例：SELECT * FROM users WHERE ... → ["users"]
        // 示例：INSERT INTO __audit_logs ... → ["__audit_logs"]
    }
}

pub enum RouteResult {
    Sqlite,
    Duckdb,
    CrossDbError,
}
```

### 4.2 database/duckdb.rs — 持久化模式

**改动清单**：

| 改动项 | 当前 | 改造后 |
|--------|------|--------|
| `connect_memory()` | 内存模式 | 保留（用于临时查询） |
| 新增 `connect_persistent(path)` | 无 | 持久化文件模式 |
| ATTACH sqlite_db | DuckDB ATTACH SQLite | **保留（仅 sysdb 只读 ATTACH，支持用户手动 ATTACH 外部文件）** |
| 移除 CREATE VIEW | 为用户表创建 VIEW | 删除 |
| 保留 `batch_insert` | 参数化批量插入 | 保留（用于导入） |

**关键代码**：

```rust
impl DuckDbDriver {
    pub fn connect_persistent(&self, path: &Path) -> Result<Box<dyn DatabaseConnection>> {
        let conn = DuckDbConn::open(path)
            .map_err(|e| DatabaseError::ConnectionFailed(e.to_string()))?;
        
        Ok(Box::new(DuckDbConnection {
            conn: Arc::new(Mutex::new(conn)),
        }))
    }
}
```

### 4.3 services/sql_service.rs — 执行逻辑改造

**改动清单**：

| 改动项 | 当前 | 改造后 |
|--------|------|--------|
| `execute_via_duckdb_or_sqlite()` | 按关键字路由 | 改为 `execute_via_smart_route()` |
| `should_use_duckdb()` | 调用 router | 改为 `SmartRouter::route()` |
| 移除 VIEW 自动刷新重试 | 失败时刷新 VIEW + 重试 | 删除 |
| 新增混合查询错误处理 | 无 | 返回明确错误信息 |
| 保留缓存逻辑 | LRU + TTL | 保留 |

**关键代码**：

```rust
fn execute_via_smart_route(
    ctx: &mut SqlExecContext<'_>,
    trimmed_stmt: &str,
    stmt_start: &Instant,
) -> Result<ExecutionMetadata, String> {
    match SmartRouter::route(trimmed_stmt) {
        RouteResult::Sqlite => {
            Ok(Self::execute_with_connection_strategy(ctx, trimmed_stmt, stmt_start))
        }
        RouteResult::Duckdb => {
            let duckdb_conn_mutex = match ctx.duckdb_conn_opt {
                Some(m) => m,
                None => {
                    return Err("DuckDB 连接未初始化".to_string());
                }
            };
            let duckdb_conn_guard = duckdb_conn_mutex.lock().map_err(|e| format!("获取 DuckDB 锁失败: {}", e))?;
            Ok(Self::execute_on_duckdb(ctx, trimmed_stmt, &*duckdb_conn_guard, stmt_start))
        }
        RouteResult::CrossDbError => {
            Err("不支持跨数据库查询，请分别查询系统表和用户表".to_string())
        }
    }
}
```

### 4.4 services/database_service.rs — 元数据查询适配

**改动清单**：

| 查询场景 | 当前（SQLite） | 改造后 |
|---------|---------------|--------|
| 列出用户表 | `SELECT name FROM sqlite_master` | DuckDB: `SELECT table_name FROM information_schema.tables WHERE table_schema='main'` |
| 获取列信息 | `PRAGMA table_info(x)` | DuckDB: `DESCRIBE x` |
| 获取索引 | `PRAGMA index_list(x)` | DuckDB: `information_schema.indexes` |
| 表行数 | `SELECT COUNT(*) FROM x` | 不变（在对应引擎执行） |
| 数据库大小 | `PRAGMA page_size * page_count` | DuckDB: `PRAGMA database_size` |
| 列出所有表（含系统表） | SQLite 全部 | 合并 DuckDB 用户表 + SQLite 系统表 |

**关键代码**：

```rust
impl DatabaseService {
    pub fn list_tables_with_meta(
        sqlite_conn: &MutexGuardConnection,
        duckdb_conn: &MutexGuardConnection,
        show_system_tables: bool,
    ) -> Result<Vec<TableInfo>, String> {
        let mut tables = Vec::new();
        
        // 1. 从 DuckDB 获取用户表
        let duckdb_tables = Self::list_duckdb_tables(duckdb_conn)?;
        tables.extend(duckdb_tables);
        
        // 2. 如果需要展示系统表，从 SQLite 获取
        if show_system_tables {
            let sqlite_tables = Self::list_sqlite_system_tables(sqlite_conn)?;
            tables.extend(sqlite_tables);
        }
        
        Ok(tables)
    }
    
    fn list_duckdb_tables(conn: &MutexGuardConnection) -> Result<Vec<TableInfo>, String> {
        let result = conn.query(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'main'",
            &[],
        )?;
        // 转换为 TableInfo 列表
    }
}
```

### 4.5 services/view_service.rs — 移除

**当前**：为每张用户表创建 DuckDB VIEW 指向 `sqlite_db.表名`
**改造后**：**完全删除**（用户数据直接在 DuckDB 中）

**删除的文件**：`e:\LA_DUCK\la-duck\src-tauri\src\services\view_service.rs`

**需要删除的调用点**：

| 文件 | 行号 | 调用 |
|------|------|------|
| [lib.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/lib.rs) | 389-401 | `init_duckdb` 中 VIEW 创建 |
| [file.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/commands/file.rs) | 1155-1160 | 导入后 `refresh_single_view` |
| [database.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/commands/database.rs) | 118, 158 | 删除/重命名表时 `drop_single_view` |
| [sql_service.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/services/sql_service.rs) | 918-929 | VIEW 自动刷新重试 |
| [project.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/commands/project.rs) | 322-328 | 项目切换时 VIEW 创建 |

### 4.6 commands/file.rs — 导入流程改造

**改动清单**：

| 改动项 | 当前 | 改造后 |
|--------|------|--------|
| 连接获取 | `db_manager.get_connection()`（SQLite） | `duckdb_manager.get_connection()`（DuckDB） |
| 建表 DDL | SQLite 类型 | DuckDB 类型映射 |
| CSV 导入 | `fast_import_csv()`（DuckDB COPY 到 SQLite） | DuckDB COPY 到 DuckDB 表 |
| Parquet 导入 | `fast_import_parquet()` | DuckDB COPY PARQUET 到 DuckDB 表 |
| 批量插入 | `batch_insert_rows()`（SQLite） | DuckDB `batch_insert()` |
| VIEW 刷新 | `refresh_single_view()` | 删除 |

**DuckDB 数据类型映射**：

| SQLite 类型 | DuckDB 类型 |
|------------|------------|
| TEXT | VARCHAR |
| INTEGER | INTEGER |
| REAL | DOUBLE |
| BLOB | BLOB |
| BOOLEAN | BOOLEAN |
| DATETIME | TIMESTAMP |
| NUMERIC | DECIMAL |

### 4.7 commands/database.rs — 表管理改造

**改动清单**：

| 操作 | 当前（SQLite） | 改造后（DuckDB） |
|------|---------------|-----------------|
| `delete_table` | SQLite ALTER TABLE RENAME + 删 VIEW | DuckDB DROP TABLE + 记录回收站元数据到 SQLite |
| `rename_table` | SQLite ALTER TABLE RENAME + 删 VIEW | DuckDB ALTER TABLE RENAME |
| `get_table_meta` | SQLite PRAGMA | DuckDB information_schema |
| `get_duckdb_diagnostics` | 触发懒加载 | 返回持久化连接状态 |

### 4.8 services/trash_service.rs — 回收站改造

**改动清单**：

| 策略 | 当前（SQLite） | 改造后（DuckDB） |
|------|---------------|-----------------|
| 小表（Rename） | SQLite RENAME TO `__trash_xxx` | DuckDB CREATE TABLE `__trash_xxx` AS SELECT * + DROP 原表 |
| 大表（Parquet） | TODO 未实现 | DuckDB COPY TO parquet + DROP 原表 |
| 恢复 | SQLite RENAME 回原名 | DuckDB CREATE TABLE 原名 AS SELECT * + DROP trash 表 |
| 元数据 | SQLite `__trash_metadata` | **不变**（仍在 SQLite 系统库） |

### 4.9 services/project_service.rs — 项目管理改造

**改动清单**：

| 改动项 | 当前 | 改造后 |
|--------|------|--------|
| `init_database()` | 创建 data.db（SQLite） | 创建 system.db（SQLite）+ business.duckdb（DuckDB） |
| `switch_project()` | 切换 SQLite 连接 | 切换 SQLite + DuckDB 双连接 |
| `get_default_db_path()` | 返回 data.db 路径 | 返回 system.db 路径 |
| 新增 `get_duckdb_path()` | 无 | 返回 business.duckdb 路径 |

### 4.10 lib.rs — 初始化逻辑重写

**改动清单**：

| 改动项 | 当前 | 改造后 |
|--------|------|--------|
| `db_manager` | 单连接管理（SQLite） | `sqlite_manager` + `duckdb_manager` 双连接 |
| `init_duckdb()` | 内存模式 + ATTACH + VIEW | 持久化模式 + 参数配置 |
| `get_duckdb_connection()` | 懒加载 | 直接返回持久化连接 |
| `SYSTEM_TABLE_ENSURE_FNS` | 初始化到 SQLite | 不变（仍到 SQLite） |
| 移除 ATTACH + VIEW 创建 | 初始化时创建 | 删除 |

---

## 五、前端改动（最小化）

### 5.1 表列表展示控制

**需求**：前端由设置系统控制是否展示系统表。

**改动**：

| 文件 | 改动 |
|------|------|
| [settings_store.ts](file:///e:/LA_DUCK/la-duck/src/store/settingsStore.ts) | 新增 `showSystemTables` 设置项（默认 true） |
| [tauri.ts](file:///e:/LA_DUCK/la-duck/src/services/tauri.ts) | `listTables` API 新增 `showSystemTables` 参数 |
| [DatabaseExplorer.tsx](file:///e:/LA_DUCK/la-duck/src/components/database/DatabaseExplorer.tsx) | 根据设置控制是否展示系统表 |

**后端 API 改动**：

```rust
#[tauri::command]
pub async fn list_tables(
    state: State<'_, TauriAppState>,
    show_system_tables: bool,
) -> Result<ApiResponse<Vec<TableInfo>>, String> {
    let sqlite_conn = state.sqlite_manager.get_connection()?;
    let duckdb_conn = state.duckdb_manager.get_connection()?;
    
    let tables = DatabaseService::list_tables_with_meta(
        &sqlite_conn,
        &duckdb_conn,
        show_system_tables,
    )?;
    
    Ok(ApiResponse::success(tables))
}
```

### 5.2 其他前端改动

| 文件 | 改动 |
|------|------|
| 无其他改动 | 后端 API 保持一致，前端无需修改 |

---

## 六、改动范围总览

### 6.1 文件改动清单

| 文件 | 改动程度 | 核心改动 |
|------|---------|---------|
| [lib.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/lib.rs) | 🔴 重写 | 双连接管理 + 初始化逻辑 |
| [database/router.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/database/router.rs) | 🔴 重写 | 智能路由（表名前缀） |
| [database/duckdb.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/database/duckdb.rs) | 🟠 大改 | 持久化模式 |
| [services/sql_service.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/services/sql_service.rs) | 🟠 大改 | 执行逻辑 + 智能路由 |
| [services/database_service.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/services/database_service.rs) | 🟠 大改 | 元数据查询适配 |
| [services/view_service.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/services/view_service.rs) | 🔴 删除 | 移除 VIEW 机制 |
| [services/trash_service.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/services/trash_service.rs) | 🟠 大改 | 回收站策略适配 |
| [services/project_service.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/services/project_service.rs) | 🟠 大改 | 双库初始化 + 项目切换 |
| [services/profile_service.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/services/profile_service.rs) | 🟡 中改 | PRAGMA → DESCRIBE |
| [commands/sql.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/commands/sql.rs) | 🟡 中改 | 双连接获取 |
| [commands/database.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/commands/database.rs) | 🟡 中改 | 表管理操作目标改为 DuckDB |
| [commands/file.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/commands/file.rs) | 🟠 大改 | 导入目标改为 DuckDB |
| [commands/project.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/commands/project.rs) | 🟡 中改 | 项目切换双库 |
| [commands/trash.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/commands/trash.rs) | 🟡 中改 | 回收站操作适配 |
| 测试文件（8-10 个） | 🟠 大改 | 测试适配双引擎 |

### 6.2 不变的部分

| 模块 | 理由 |
|------|------|
| 17 张系统表的建表语句 | 仍在 SQLite，语法不变 |
| 系统表的 CRUD 逻辑 | 仍走 SQLite，代码不变 |
| 前端大部分代码 | API 不变，仅新增 showSystemTables 参数 |
| models/ 层 | 数据结构不变 |
| 查询缓存机制 | 缓存层不变 |
| SqlIdentifier 安全封装 | 不变 |

---

## 七、风险与缓解

| 风险 | 等级 | 缓解方案 |
|------|------|---------|
| DuckDB 小写入性能差 | 🔴 高 | 系统表保留 SQLite，避免 OLTP 场景 |
| 混合查询错误提示不友好 | 🟡 低 | 返回明确错误信息，指导用户分开查询 |
| DuckDB 文件格式不兼容 | 🟡 低 | 版本升级前做兼容性测试 |
| 回收站跨库操作复杂 | 🟠 中 | 小表用 CREATE AS SELECT；大表用 Parquet |
| 项目切换双库管理 | 🟡 低 | 串行关闭/打开，确保连接状态一致 |

---

## 八、实施阶段建议

| 阶段 | 目标 | 核心工作 |
|------|------|---------|
| **Phase 1** | 基础设施 | 双连接管理器 + 持久化 DuckDB |
| **Phase 2** | 智能路由 | SmartRouter 实现 + 表名提取 |
| **Phase 3** | 用户数据路径 | 导入流程改造 + 表管理改造 + 元数据查询适配 |
| **Phase 4** | 辅助功能 | 回收站改造 + 项目切换适配 + 移除 VIEW 机制 |
| **Phase 5** | 测试与验证 | 单元测试适配 + E2E 测试 + 性能基准 |

---

## 九、最小补丁清单（参考 ExperienceRecall）

### 9.1 配置层

- 数据库路径：`data.db` → `system.db`（SQLite）+ `business.duckdb`（DuckDB）
- 移除 SQLite 默认值与 fallback 分支

### 9.2 连接层

- 统一引擎创建函数：`sqlite_manager` + `duckdb_manager`
- 禁止在不同模块各自创建连接

### 9.3 路由层

- 移除 `should_use_duckdb`（按关键字路由）
- 新增 `SmartRouter::route`（按表名前缀路由）
- 混合查询返回明确错误

### 9.4 服务层

- `database_service.rs`：元数据查询适配（SQLite → DuckDB）
- `sql_service.rs`：执行逻辑适配（智能路由）
- `project_service.rs`：双库初始化与切换

### 9.5 命令层

- `file.rs`：导入目标改为 DuckDB
- `database.rs`：表管理操作目标改为 DuckDB
- `project.rs`：项目切换双库

### 9.6 清理

- 删除 `view_service.rs`
- 删除所有 VIEW 相关调用

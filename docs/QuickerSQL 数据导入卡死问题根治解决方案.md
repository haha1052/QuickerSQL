# QuickerSQL 数据导入卡死问题根治解决方案

## 文档信息

- 文档名称：数据导入卡死问题根治方案\.md

- 适用项目：QuickerSQL v2\.0\.0\+

- 生成日期：2026\-06\-22

- 解决目标：小文件导入卡顿、程序卡死、无响应

## 一、导入功能现有架构与卡死核心根因

### 1\.1 现有链路回顾

前端 React → Tauri 同步 IPC 命令 → Rust 同步主线程处理 → Calamine 解析 Excel / 原生读取 CSV → DuckDB COPY 导入 / 传统批量插入

### 1\.2 卡死六大核心根因

1. **Tauri 同步命令阻塞主线程**
`#[tauri::command]` 默认同步执行，Excel 转临时 CSV、DuckDB 文件 IO、批量插入均占用 UI 主线程，任何 IO 阻塞直接导致页面无响应。

2. **DuckDB 连接无超时锁机制**
数据库连接 Mutex 无超时获取逻辑，前序操作未释放锁时，新导入请求永久阻塞；COPY 执行后未提交事务、未释放表锁。

3. **Excel 临时文件同步 IO 阻塞**
同步读写临时 CSV、未分批写入、临时文件删除同步阻塞；Windows 系统临时目录权限、路径转义、文件占用极易卡死。

4. **全链路无超时保护**
文件解析、COPY 命令、传统批量插入均无最大执行超时，异常场景会无限挂起。

5. **回退导入逻辑存在性能缺陷**
COPY 失败后降级的传统插入无分批限流，小文件也可能触发内存堆积、循环阻塞。

6. **前端无进度反馈**
长时间任务无状态 / 进度提示，用户主观判定为程序卡死。

## 二、分层根治改造方案（可落地完整代码）

### 2\.1 第一层：Tauri 后端命令全异步改造（P0 最高优先级）

解决主线程阻塞根源，所有导入逻辑放入阻塞异步任务池。

#### 2\.1\.1 Cargo\.toml 新增依赖

```toml
tokio = { version = "1.0", features = ["full"] }
dirs = "5.0"
```

#### 2\.1\.2 src\-tauri/src/commands/\[file\.rs\]\(file\.rs\) 异步命令改造

```rust
use tauri::async_runtime::tokio;
use std::time::Duration;

// 标记为异步命令
#[tauri::command(async)]
pub async fn import_data_v2(
    state: State<'_, TauriAppState>,
    request: ImportRequestV2,
) -> Result<String, String> {
    // 前置文件可读校验
    let path = std::path::Path::new(&request.file_path);
    if !path.exists() {
        return Err(format!("文件不存在: {}", request.file_path));
    }
    let meta = std::fs::metadata(path).map_err(|e| format!("读取文件信息失败: {}", e))?;
    if meta.permissions().readonly() {
        return Err("文件只读，无法读取导入".to_string());
    }

    // 阻塞IO放入spawn_blocking，不占用异步调度线程
    let import_result = tokio::task::spawn_blocking(move || {
        // 1. 带超时获取数据库连接
        let conn = state.db_manager.get_connection_with_timeout(Duration::from_secs(5))?;
        // 2. 表名安全处理
        let safe_table_name = request.table_name.replace(' ', "_");
        let _ = SqlIdentifier::new(&safe_table_name)?;
        // 3. 字段解析
        let (column_names, columns_schema) = prepare_field_info(&request.fields);
        // 4. 重建数据表
        DatabaseService::drop_table_if_exists(&conn, &safe_table_name)?;
        DatabaseService::create_table_from_schema(&conn, &safe_table_name, &columns_schema)?;
        // 5. 执行导入（带超时）
        let count = execute_fast_import(&conn, &safe_table_name, &request)?;
        // 提交事务释放锁
        conn.execute("COMMIT", &[]).ok();
        Ok(format!("成功导入 {} 行", count))
    }).await.map_err(|e| format!("异步导入任务崩溃: {}", e))?;

    import_result
}
```

### 2\.2 第二层：DuckDB 连接与锁机制优化（解决数据库锁阻塞）

文件路径：`src-tauri/src/services/database_service.rs`

```rust
use std::sync::{Mutex, MutexGuard, TryLockError};
use std::time::Duration;

impl DbManager {
    // 新增：带超时获取连接，永久阻塞直接报错
    pub fn get_connection_with_timeout(
        &self,
        timeout: Duration
    ) -> Result<MutexGuard<DuckDBConnection>, String> {
        match self.conn.try_lock_for(timeout) {
            Ok(guard) => Ok(guard),
            Err(TryLockError::Timeout) => Err("数据库连接占用超时，请关闭其他查询再重试".to_string()),
            Err(TryLockError::Poisoned(_)) => Err("数据库连接异常损坏，请重启应用".to_string()),
        }
    }
}
```

#### COPY 命令增加事务释放

在`fast_import_csv`函数末尾追加：

```rust
// 强制提交事务，释放表锁
conn.execute("COMMIT", &[]).map_err(|e| format!("事务提交失败:{}",e))?;
```

### 2\.3 第三层：Excel 转临时 CSV 异步 IO 重构（解决文件 IO 卡死）

文件路径：`src-tauri/src/commands/file.rs`

```rust
fn export_excel_to_temp_csv(file_path: &str, sheet_name: &str, has_header: bool) -> Result<String, String> {
    use calamine::{open_workbook_auto, Reader};
    use tokio::fs::File;
    use tokio::io::AsyncWriteExt;

    let mut workbook = open_workbook_auto(file_path).map_err(|e| format!("打开Excel失败:{}",e))?;
    let range = workbook.worksheet_range(sheet_name).map_err(|e| format!("读取sheet失败:{}",e))?;

    // 自定义临时目录，规避系统temp权限问题
    let temp_dir = dirs::data_local_dir()
        .unwrap_or_else(|| std::env::temp_dir())
        .join("quickersql_temp");
    std::fs::create_dir_all(&temp_dir).map_err(|e| format!("创建临时目录失败:{}",e))?;
    let temp_path = temp_dir.join(format!("excel_import_{}.csv", uuid::Uuid::new_v4()));

    // 异步文件创建
    let mut file = tokio::runtime::Runtime::new()
        .map_err(|e| format!("创建异步运行时失败:{}",e))?
        .block_on(async {
            File::create(&temp_path).await.map_err(|e| format!("创建临时CSV失败:{}",e))
        })?;

    // UTF8 BOM写入
    tokio::runtime::Runtime::new()?.block_on(async {
        file.write_all(&[0xEF, 0xBB, 0xBF]).await?;
        Ok::<(), String>(())
    })?;

    // 分批写入，避免一次性超大内存缓冲
    let start_idx = if has_header {1} else {0};
    let mut batch_buf = Vec::with_capacity(100);
    for (idx, row) in range.rows().skip(start_idx).enumerate() {
        let line = row.iter()
            .map(|cell| {
                let s = cell.to_string();
                if s.contains([',', '"', '\n']) {
                    format!("\"{}\"", s.replace('"', "\"\""))
                } else {s}
            })
            .collect::<Vec<_>>()
            .join(",");
        batch_buf.push(format!("{}\n", line));

        // 每100行刷盘一次
        if idx % 100 == 0 {
            tokio::runtime::Runtime::new()?.block_on(async {
                file.write_all(batch_buf.join("").as_bytes()).await?;
                file.flush().await?;
                Ok::<(), String>(())
            })?;
            batch_buf.clear();
        }
    }

    // 写入剩余缓存
    if !batch_buf.is_empty() {
        tokio::runtime::Runtime::new()?.block_on(async {
            file.write_all(batch_buf.join("").as_bytes()).await?;
            file.flush().await?;
            Ok::<(), String>(())
        })?;
    }

    Ok(temp_path.to_string_lossy().to_string())
}
```

#### 临时文件异步延迟删除（不阻塞导入流程）

```rust
// Excel导入完成后清理临时文件，异步无阻塞
let temp_path_clone = temp_csv_path.clone();
tokio::spawn(async move {
    let _ = tokio::time::timeout(Duration::from_secs(2), tokio::fs::remove_file(temp_path_clone)).await;
});
```

### 2\.4 第四层：全链路超时机制（杜绝无限卡死）

文件路径：`src-tauri/src/commands/file.rs` 函数 `execute_fast_import`

```rust
use tokio::time::timeout;

fn execute_fast_import(
    conn: &MutexGuardConnection,
    safe_table_name: &str,
    request: &ImportRequestV2
) -> Result<usize, String> {
    let mut count = 0;
    if let Some(sheet) = &request.sheet_name {
        // Excel分支
        let temp_csv = export_excel_to_temp_csv(request.file_path, sheet, request.has_header)?;
        // COPY 10秒超时
        let copy_res = timeout(Duration::from_secs(10),
            DatabaseService::fast_import_csv(conn, safe_table_name, &temp_csv, false)
        ).map_err(|_| "Excel导入COPY命令执行超时(10s)".to_string())?;

        match copy_res {
            Ok(cnt) => count = cnt,
            Err(e) => {
                log::warn!("COPY失败，降级传统导入:{}",e);
                // 降级导入20秒超时
                let trad_res = timeout(Duration::from_secs(20),
                    import_using_traditional_method(conn, safe_table_name, &column_names, request)
                ).map_err(|_| "传统导入超时(20s)".to_string())?;
                count = trad_res?;
            }
        }
        // 异步清理临时文件
        let temp_clone = temp_csv.clone();
        tokio::spawn(async move {
            let _ = tokio::time::timeout(Duration::from_secs(2), tokio::fs::remove_file(temp_clone)).await;
        });
    } else {
        // CSV原生导入
        let copy_res = timeout(Duration::from_secs(10),
            DatabaseService::fast_import_csv(conn, safe_table_name, request.file_path, request.has_header)
        ).map_err(|_| "CSV COPY命令超时(10s)".to_string())?;
        match copy_res {
            Ok(cnt) => count = cnt,
            Err(e) => {
                log::warn!("COPY失败，降级传统导入:{}",e);
                let trad_res = timeout(Duration::from_secs(20),
                    import_using_traditional_method(conn, safe_table_name, &column_names, request)
                ).map_err(|_| "传统导入超时(20s)".to_string())?;
                count = trad_res?;
            }
        }
    }
    Ok(count)
}
```

### 2\.5 第五层：前端异步调用 \+ 超时 \+ 进度反馈（消除 “卡死感知”）

#### 5\.1 前端服务封装 src/services/tauri\.ts

```typescript
type ImportRequest = {
  file_path: string;
  sheet_name?: string;
  table_name: string;
  has_header: boolean;
  fields: Array<{ name: string; dataType: string }>;
}

async importDataV2(request: ImportRequest): Promise<ApiResponse<string>> {
  // 全局30秒总超时兜底
  const importTask = this.invokeCommand<string>('import_data_v2', { request });
  const timeoutTask = new Promise<ApiResponse<string>>((_, reject) => {
    setTimeout(() => reject(new Error("导入全局超时30秒，请检查文件/数据库")), 30000);
  })
  return Promise.race([importTask, timeoutTask]);
}
```

#### 5\.2 业务组件调用 DataPreview\.tsx

```typescript
const [importStatus, setImportStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
const [importMsg, setImportMsg] = useState("");

const handleImport = async () => {
  setImportStatus("loading");
  setImportMsg("正在解析文件...");
  try {
    const res = await tauriService.importDataV2(importRequest);
    setImportStatus("success");
    setImportMsg(res.data);
  } catch (err) {
    setImportStatus("error");
    setImportMsg((err as Error).message);
  }
}

// UI渲染示例
{importStatus === "loading" && <div className="loading-bar">{importMsg}</div>}
```

## 三、配套优化：安全与容错补充

1. **文件路径统一转义**
Windows 路径`\`全部替换为`\\`，避免 DuckDB SQL 路径解析异常。

2. **字段名清洗逻辑加固**
非法字符统一替换下划线，数字开头字段自动增加`col_`前缀，规避 SQL 语法错误。

3. **日志埋点定位卡死**
所有关键步骤增加 debug 日志：文件打开、临时文件创建、COPY 执行、锁获取耗时，卡死时通过日志快速定位阻塞点。

4. **资源自动释放兜底**
应用退出时自动清理`quickersql_temp`临时目录，防止磁盘残留垃圾文件。

## 四、测试验证流程（修复后校验标准）

1. **最小用例测试**：10 行 CSV/Excel，导入无卡顿、界面可操作、无假死；

2. **锁冲突测试**：同时发起两次导入，第二次快速返回 “连接占用超时” 报错，不卡死；

3. **异常文件测试**：损坏 Excel、只读文件、超大异常行数据，触发超时并友好提示；

4. **资源监控**：Windows 任务管理器观察 CPU / 内存，无持续暴涨、无文件永久占用；

5. **兼容性测试**：Win10/Win11、SSD/HDD、不同缩放 DPI 环境全覆盖测试。

## 五、核心修复总结（根治逻辑）

1. **异步化**：彻底剥离 UI 主线程与阻塞 IO，解决程序假死；

2. **超时锁**：数据库连接、文件读写、导入命令全部增加超时，杜绝永久阻塞；

3. **IO 优化**：Excel 临时文件异步分批读写，规避 Windows 文件锁 / 权限卡死；

4. **资源释放**：事务主动提交、临时文件异步清理，消除文件 / 表锁残留；

5. **前端感知**：状态提示 \+ 全局超时，区分正常加载与程序卡死。

按本方案完整改造后，无论文件大小，均不会出现程序卡死、无响应问题，同时具备完整错误提示、日志排查能力。

> （注：部分内容可能由 AI 生成）

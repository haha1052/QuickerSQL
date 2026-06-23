# 数据导入卡死问题根治 Spec

## Why

当前数据导入功能存在六大核心根因导致程序卡死、无响应：
1. Tauri 同步命令阻塞主线程
2. DuckDB 连接无超时锁机制
3. Excel 临时文件同步 IO 阻塞
4. 全链路无超时保护
5. 回退导入逻辑性能缺陷
6. 前端无进度反馈

用户反馈"小文件导入也卡死"，严重影响产品可用性。

## What Changes

### 核心改造（按优先级排序）

- **P0：Tauri 后端命令异步化** —— `import_data_v2` 改为 `#[tauri::command(async)]`，阻塞 IO 放入 `spawn_blocking`
- **P1：DuckDB 连接超时锁** —— 新增 `get_connection_with_timeout(Duration)`，防止永久阻塞
- **P1：全链路超时机制** —— COPY 命令 10s 超时、传统导入 20s 超时、前端 30s 全局超时
- **P2：Excel 临时文件异步 IO** —— 分批写入、异步删除临时文件
- **P3：前端进度反馈** —— 导入状态 UI + 超时提示

### 安全与容错补充

- 文件路径统一转义（Windows `\` → `\\`）
- 字段名清洗逻辑加固（数字开头加 `col_` 前缀）
- 日志埋点定位卡死
- 资源自动释放兜底

## Impact

- **Affected specs**: 无（新功能改造）
- **Affected code**:
  - `src-tauri/src/commands/file.rs` —— import_data_v2 异步化
  - `src-tauri/src/database/traits.rs` —— get_connection_with_timeout
  - `src-tauri/src/services/database_service.rs` —— fast_import_csv 超时
  - `src/services/tauri.ts` —— importDataV2 超时封装
  - `src/components/DataPreview.tsx` —— 导入状态 UI

---

## 方案合理性评估

### ✅ 合理的部分

| 改造点 | 评估 | 说明 |
|--------|------|------|
| 异步命令改造 | ✅ 合理 | `#[tauri::command(async)]` + `spawn_blocking` 是 Tauri 推荐的阻塞 IO 处理方式，能彻底解决主线程阻塞 |
| 连接超时锁 | ✅ 合理 | `try_lock_for(timeout)` 防止永久阻塞，符合数据库连接池最佳实践 |
| 全链路超时 | ✅ 合理 | COPY 10s / 传统 20s / 前端 30s 三级超时，覆盖所有阻塞点 |
| 前端进度反馈 | ✅ 合理 | 状态 UI + 超时提示，消除用户"卡死感知" |
| 字段名清洗 | ✅ 合理 | 数字开头加前缀、非法字符替换，防止 SQL 语法错误 |

### ⚠️ 需要调整的部分

| 改造点 | 问题 | 建议调整 |
|--------|------|---------|
| Excel 临时文件异步 IO | 文档中使用 `tokio::runtime::Runtime::new()?.block_on()` 在同步函数内创建异步运行时，**违反 Rust 异步最佳实践**，且每次调用创建新 Runtime 成本高 | 改为：在 `spawn_blocking` 内直接使用 `std::fs` 同步 IO（已脱离主线程），或使用 `tokio::fs` 在顶层异步上下文调用 |
| 临时文件路径 | 使用 `std::env::temp_dir()` 可能遇到 Windows 系统临时目录权限问题 | 改为：使用 `dirs::data_local_dir().join("quickersql_temp")`，应用专属临时目录 |
| COPY 命令超时 | 文档中 `timeout(Duration, DatabaseService::fast_import_csv(...))` 的用法不正确——`fast_import_csv` 是同步函数，不能直接用于 tokio timeout | 改为：在 `spawn_blocking` 内执行 COPY，外层用 `tokio::time::timeout` 包装整个 blocking task |
| 事务提交位置 | 文档建议在 COPY 后 `conn.execute("COMMIT", &[])`，但 DuckDB COPY 命令默认不开启事务，手动 COMMIT 可能报错 | 改为：仅在传统批量插入路径显式提交事务；COPY 路径不需要 |
| 前端超时实现 | `Promise.race([importTask, timeoutTask])` 中 timeoutTask 用 setTimeout reject，但未清理 setTimeout，可能导致内存泄漏 | 改为：使用 `AbortController` 或在 finally 中 clearTimeout |

### ❌ 不建议实施的部分

| 改造点 | 问题 | 建议 |
|--------|------|------|
| 文档中的 `export_excel_to_temp_csv` 异步实现 | 在同步函数内反复创建 `tokio::runtime::Runtime`，性能差、代码复杂 | 保持现有同步实现，但整体放入 `spawn_blocking` 执行；分批写入可保留（每 100 行刷盘） |

---

## ADDED Requirements

### Requirement: 异步导入命令

系统 SHALL 提供 `import_data_v2_async` 异步命令，将所有阻塞 IO（文件解析、COPY 执行、批量插入）放入 `tokio::task::spawn_blocking`，不占用 Tauri 主线程。

#### Scenario: 正常导入流程
- **WHEN** 用户导入 CSV/Excel 文件
- **THEN** 前端 UI 保持可操作，导入在后台线程执行
- **AND** 导入完成后返回成功消息

#### Scenario: 导入超时
- **WHEN** 导入执行超过 30 秒
- **THEN** 前端显示"导入超时，请检查文件/数据库"提示
- **AND** 后端取消导入任务，释放数据库连接锁

### Requirement: 连接超时锁

系统 SHALL 提供 `get_connection_with_timeout(Duration)` 方法，在指定时间内尝试获取数据库连接锁，超时返回错误而非永久阻塞。

#### Scenario: 连接锁冲突
- **WHEN** 前序操作持有数据库连接锁
- **AND** 新导入请求尝试获取连接
- **THEN** 5 秒内无法获取则返回"数据库连接占用超时，请关闭其他查询再重试"

### Requirement: 导入进度反馈

系统 SHALL 在前端显示导入状态（idle/loading/success/error）和进度提示，消除用户"卡死感知"。

#### Scenario: 导入进行中
- **WHEN** 导入任务正在执行
- **THEN** 前端显示"正在导入..."状态指示器
- **AND** 用户可继续操作其他 UI 元素

---

## MODIFIED Requirements

### Requirement: Excel 临时文件处理

**原有实现**：同步写入临时 CSV，导入完成后同步删除。

**修改后**：
- 临时文件写入放入 `spawn_blocking`（已脱离主线程，同步 IO 不阻塞 UI）
- 使用应用专属临时目录 `dirs::data_local_dir().join("quickersql_temp")`
- 临时文件删除改为异步 `tokio::spawn(async { tokio::fs::remove_file(...) })`
- 分批写入保留（每 100 行刷盘，避免内存堆积）

### Requirement: COPY 命令执行

**原有实现**：直接调用 `conn.execute(&sql, &[])`，无超时保护。

**修改后**：
- COPY 执行放入 `spawn_blocking`
- 外层用 `tokio::time::timeout(Duration::from_secs(10), blocking_task)` 包装
- 超时后自动降级到传统批量插入

---

## REMOVED Requirements

无移除项。本次改造为增量优化，不删除现有功能。

---

## 实施优先级

| 优先级 | 改造项 | 预估工作量 | 验证标准 |
|--------|--------|-----------|---------|
| P0 | `import_data_v2` 异步化 | 2h | 导入时 UI 可操作 |
| P1 | 连接超时锁 | 1h | 锁冲突 5s 内返回错误 |
| P1 | 全链路超时 | 1h | 异常文件 30s 内返回超时提示 |
| P2 | Excel 临时文件优化 | 1h | 临时目录在应用数据目录下 |
| P3 | 前端进度 UI | 1h | 导入时显示状态指示器 |

**总预估工作量**：6 小时

---

## 测试验证标准

1. **最小用例测试**：10 行 CSV/Excel，导入无卡顿、界面可操作、无假死
2. **锁冲突测试**：同时发起两次导入，第二次快速返回"连接占用超时"报错，不卡死
3. **异常文件测试**：损坏 Excel、只读文件、超大异常行数据，触发超时并友好提示
4. **资源监控**：Windows 任务管理器观察 CPU/内存，无持续暴涨、无文件永久占用
5. **兼容性测试**：Win10/Win11、SSD/HDD 环境全覆盖测试
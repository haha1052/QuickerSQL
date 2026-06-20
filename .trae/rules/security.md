# QuickerSQL 安全规则 v7.0

> 优先级：最高（仅次于本地 `CLAUDE.local.md`）。
> 任何涉及数据库操作、用户输入拼接的代码修改，必须先完整阅读本文件。
> 本文件任何一条被命中即"违规 → 必须回退或重新设计"。

---

## 一、SQL 注入防护

### 1.1 零容忍条款（违反即判定为 bug）

在 `src-tauri/src/` 内，禁止以下任一写法出现：

```rust
// ❌ 禁止 format! 拼接 SQL 文本
conn.execute(&format!("SELECT * FROM users WHERE name = '{}'", name))?;

// ❌ 禁止手动转义替代参数化查询
let safe_name = name.replace("'", "''");  // 不足，会有 LIKE / 引号嵌套 / Unicode 等绕过

// ❌ 禁止把用户输入的表名、列名直接拼入 SQL 文本
//    （必须先经 SqlIdentifier 校验 + quote_identifier 再加拼接）
let sql = format!("SELECT * FROM {}", user_supplied_table);

// ❌ 禁止 `executescript` / 多语句 SQL（本项目架构已禁止）
```

**检测方法（代码审查时执行）：**

```bash
cd src-tauri/src
grep -rn 'format!("' --include='*.rs' | grep -i 'select\|insert\|update\|delete\|create\|alter'
grep -rn "replace.*\"'\"" --include='*.rs'
```

### 1.2 参数化查询唯一合法写法

**情形 A — 固定列/固定表 + 有界参数（最常见）**

```rust
// ✅ 正确：固定 SQL 文本 + ? 占位符 + params 数组
let sql = "SELECT id, name FROM __automation_tasks WHERE state = ? LIMIT ?;";
let params: [&dyn ToSql; 2] = [&"enabled", &50];
let rows = conn.query(sql, &params)?;

// ✅ INSERT 同样
let sql = "INSERT INTO __automation_tasks (id, name, description) VALUES (?, ?, ?);";
let params = [&id, &name, &description];
conn.execute(sql, &params)?;
```

**情形 B — 动态 WHERE（多条件组合，如搜索页）**

```rust
// ✅ 正确：SQL 片段只含列名/常量/操作符；用户值只进 params
let mut clauses: Vec<String> = Vec::new();
let mut params: Vec<Box<dyn ToSql>> = Vec::new();

if let Some(v) = &state_filter {
    clauses.push("state = ?".into());
    params.push(Box::new(v.clone()));
}
if let Some(v) = &keyword {
    clauses.push("name LIKE ?".into());
    params.push(Box::new(format!("%{}%", v)));  // 通配符绑定到参数
}

let sql = if clauses.is_empty() {
    "SELECT id, name FROM __automation_tasks;".into()
} else {
    format!("SELECT id, name FROM __automation_tasks WHERE {};",
            clauses.join(" AND "))
};
conn.query(&sql, &params)?;
```

**情形 C — 动态表名 / 动态列名（最危险）**

```rust
// ✅ 正确：用户输入的表名必须先经 SqlIdentifier 校验 + quote
use crate::database::SqlIdentifier;

let safe_table = SqlIdentifier::new(user_supplied_table)?;  // 非法字符会失败
let quoted = safe_table.quote_identifier();                 // 返回带引号的安全标识符

// SQL 文本里只出现 `quoted`（在 Rust 编译期就是一个带引号的字符串字面量）
let sql = format!("SELECT * FROM {} WHERE id = ?;", quoted);
conn.query(&sql, &[&id])?;
```

**原则：SQL 文本中所有 `?` 之外的可变部分必须来自白名单 / 枚举 / quote_identifier 后的安全标识符。**

### 1.3 LIKE 通配符注入防范

```rust
// ❌ 错误：keyword 含 % _ [ ] 等字符时改变语义
conn.query(&format!("SELECT ... WHERE name LIKE '%{}%'", keyword), params![])?;

// ✅ 正确：通配符绑定到参数
let kw = format!("%{}%", keyword);
conn.query("SELECT ... WHERE name LIKE ?;", params![&kw])?;
```

---

## 二、前端安全

### 2.1 前端禁止拼接 SQL

`src/` 目录任何文件禁止出现：

```ts
// ❌ 禁止
const sql = `SELECT * FROM ${tableName}`;
let sql = `SELECT ${column} FROM ${table}`;
```

前端对数据库的唯一访问路径：

```
components → use*Store() → taskService.{listTasks, getTask, ...}
                                   └─ invoke("automation:list_automation_tasks")
                                       └─ commands/automation.rs  (Rust 参数化查询)
```

### 2.2 禁止 any 类型 + 未校验的用户输入

```ts
// ❌ 禁止（绕过类型系统）
function search(p: any): void { ... }

// ❌ 禁止（eval / new Function 字符串拼接执行）
window.eval(userInput);

// ✅ 正确：显式类型 + 校验
function search(keyword: string): Promise<ApiResponse<Task[]>> {
  if (keyword.length > 500) throw new Error("keyword too long");
  return tauriService.invokeCommand<...>("search", { keyword });
}
```

---

## 三、密钥 / 敏感数据 / 本地凭据

### 3.1 本项目当前无用户体系 + 无外部 API Key

- 本项目为 **本地桌面应用**（SQLite + DuckDB 文件作为数据），无鉴权服务、无外部云服务调用。
- 规则如下：**如果未来引入，必须遵循以下规范。**

### 3.2 禁止在源码 / commit 中出现的字符串

| 敏感内容样例 | 说明 |
|-------------|------|
| `sk-` / `Bearer ` / `ghp_` / `xoxb-` / `eyJ`（JWT 起始） | 第三方服务密钥 |
| `password:` / `pwd=` / `secret=` / `api_key=` / `token=`（赋值） | 配置泄露 |
| `-----BEGIN PRIVATE KEY-----` | PEM 私钥 |
| `postgres://` / `mysql://` / `mongodb://` + `@` | 带凭据的连接串 |
| Windows 绝对路径含用户名，如 `C:\Users\admin\...` | 用户身份泄露 |

**如果 Agent 生成的代码中出现上述字符串，且非 `CLAUDE.local.md` 模板中的占位符，必须回退。**

### 3.3 引入凭据时的强制路径

未来若引入外部凭据（例如调用 LLM 服务、云数据库），必须：

1. **新建文件** `src-tauri/.env.local` 或 `src-tauri/.env`，**立即加入 `.gitignore`**
2. **Rust 代码读取** 使用 `std::env::var("QUICKERSQL_XXX_KEY")`，禁止硬编码
3. **前端不可访问**：密钥不可通过 invoke 返回给前端 UI；前端只能拿到"已配置 / 未配置"布尔状态
4. **用户输入的敏感数据**：不可写入 `__audit_logs`、不可写入 `console.error` 文本中

### 3.4 审计日志的脱敏规则

`services/audit_log_service.rs` 写入 `__audit_logs` 时：

- ✅ 必须记录：操作人（当前固定为 local-user）、操作类型、对象名、时间戳、结果（success/fail）、错误信息摘要
- ❌ 禁止记录：SQL 全文、用户输入的完整文件路径（只保留文件名或短 hash）、任何疑似凭据的字符串

---

## 四、文件系统访问安全

### 4.1 路径穿越（Path Traversal）

- 所有接收用户输入路径的命令（`file.rs` 内 `load_csv` / `import_data` 等）必须 `canonicalize()` 后校验前缀是否在允许目录内
- 本项目当前仅允许：用户选择对话框返回的 `PathBuf` + 系统的临时目录
- ❌ 禁止接受自由字符串作为路径参数

### 4.2 文件删除的二次确认

- `trash_service.rs` 的永久删除操作只对 `__trash_metadata` 中的 ID 生效，禁止用 SQL 拼接的 `DROP TABLE` 对任意表名操作
- 回收站内表名也必须经 `SqlIdentifier` 校验

---

## 五、版本与变更记录

| 版本 | 日期 | 变更内容 |
|------|------|---------|
| v7.0 | 2026-06-20 | 初版。参数化查询模板（3 种情形 A/B/C）、前端禁止拼接 SQL、敏感词清单、审计日志脱敏规则、路径穿越防范 |

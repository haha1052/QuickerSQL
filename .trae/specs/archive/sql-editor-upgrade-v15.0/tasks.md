# QuickerSQL SQL 编辑器全面升级 — 多角色分工实施计划 tasks.md v15.0

## 总体里程碑

| 里程碑 | 预计时间 | 核心任务 | 验收标准 |
|--------|---------|---------|---------|
| **M1：Monaco Editor 基础架构升级** | 约 1~2 周 | 替换 textarea → Monaco Editor；语法高亮/行号/括号匹配/代码折叠/基础快捷键 | 编辑器可以正常输入 SQL，关键字高亮，基本快捷键生效 |
| **M2：智能补全引擎** | 约 1~2 周 | 表名列名列名列名列名列名/函数名/关键字补全；补全项数据源；补全上下文感知；错误行号定位 | 输入 SELECT/FROM 后出现补全建议；输入表名后列名补全生效 |
| **M3：SQL 格式化 + 执行计划 + 参数绑定** | 约 2~3 周 | 格式化引擎；执行计划 EXPLAIN；查询参数/变量绑定；增强工具栏 | 点击格式化按钮 SQL 变整洁；点击执行计划按钮显示树形节点 |
| **M4：SQL 片段/模板库** | 约 1 周 | `__sql_snippets` 系统表；片段库面板；片段 CRUD；预置模板 | 打开片段库面板，有预置 10 个模板，用户可创建/编辑/删除；片段可插入编辑器 |
| **M5：门禁 + 文档收尾** | 约 0.5 周 | cargo check/cargo test/npx tsc/console.log 全绿；文档更新 | 所有门禁命令通过，架构文档已更新 |

## 可并行任务分析

以下任务可**完全并行推进**，不互相阻塞：

```
M1（Monaco 基础）     M2（智能补全）      M4（片段库）
     │                    │                   │
     └─ 前端 A 角色       └─ 前端 B 角色      └─ 后端 + 前端角色
     │                    │                   │
     └─ 独立无阻塞        └─ 依赖 M1 完成      └─ 独立无阻塞

M3（格式化 + 执行计划） ─── 依赖 M1 完成（需在 Monaco Editor 中集成）

M5（门禁 + 文档）     ─── 所有任务完成后统一执行
```

## 角色分工建议

| 角色 | 代号 | 负责领域 | 关键技能 |
|------|------|---------|---------|
| **前端工程师 A** | F-A | Monaco Editor 集成；SQL 格式化；参数绑定；编辑器快捷键；编辑器主题集成 | React + TypeScript + Monaco Editor |
| **前端工程师 B** | F-B | 智能补全引擎（前端补全 Provider）；错误行号定位；查询历史/片段库面板；补全项数据源 IPC 封装 | React + TypeScript + Monaco Editor + Completion Provider |
| **后端工程师 A** | B-A | execute_explain 命令；get_sql_completion_items 命令；sql_service.rs 增强；补全项查询 | Rust + SQLite/DuckDB |
| **后端工程师 B** | B-B | save_sql_snippet/get_sql_snippets/delete_sql_snippet 命令；`__sql_snippets` 系统表 ensure_* 函数；预置模板插入 | Rust + SQLite/DuckDB |
| **前端全栈/Reviewer** | F-ALL | 代码 Review；架构一致性检查；与 commands/services 层接口对接检查 | Rust + TS 双栈 |

---

# 详细任务清单

## M1：Monaco Editor 基础架构升级（约 1~2 周，P0）

### 任务 1.1：SQLEditor.tsx 从 textarea → Monaco Editor 替换（F-A）

| 属性 | 详情 |
|------|------|
| **优先级** | P0 |
| **依赖** | 无（package.json 已有 @monaco-editor/react 4.6.0） |
| **阻塞后续** | 所有其他编辑器增强任务均依赖此任务 |
| **修改文件** | `src/components/sql/SQLEditor.tsx` |
| **验收标准** | 编辑器正常显示，可输入文本，基本主题（暗/亮）生效 |

**具体操作**：
1. 保留 `query`/`onChange`/`onExecute`/`isLoading` 四个 props 签名不变（兼容 SqlQueryPage.tsx）
2. 引入 `import { Editor } from '@monaco-editor/react'`（或直接用 `monaco-editor`）
3. 设置 language: 'sql'（monaco 内置 sql 语言支持语法高亮）
4. 设置编辑器配置 options：
   - theme: 'vs-dark' 或 'vs'（根据全局主题动态切换）
   - fontSize: 从 Settings 获取（已有 fontSize）
   - wordWrap: 'on'/'off'（从 Settings 获取 wordWrap）
   - tabSize: 从 Settings 获取 tabSize
   - minimap: { enabled: true }（迷你地图）
   - bracketPairColorization: { enabled: true }（括号配对彩色）
   - automaticLayout: true（自动布局）
   - folding: true（代码折叠）
   - formatOnPaste: true（粘贴时自动格式化）
   - formatOnType: true（输入时自动格式化）
5. 编辑器内容绑定到 query.sql，onChange 回调保持原有行为
6. 移除所有 `<textarea>` 相关代码

**验证命令**：
```powershell
cd e:\LA_DUCK\la-duck
npx tsc --noEmit --pretty  # 0 errors
Get-Content src/components/sql/SQLEditor.tsx | Select-String "monaco" | Measure-Object  # Count > 0
```

### 任务 1.2：基础快捷键实现（F-A）

| 属性 | 详情 |
|------|------|
| **优先级** | P0 |
| **依赖** | 任务 1.1 |
| **修改文件** | `src/components/sql/SQLEditor.tsx` |
| **验收标准** | 所有快捷键生效 |

**具体操作**：
1. `Ctrl+Enter`：执行当前光标所在语句（或选中部分）
   - 需要 `sqlStatementParser.ts` 辅助函数：`getStatementAtCursor(sql: string, cursorPosition: Position): { statement: string, startLine: number, endLine: number }`
   - 将单条语句传递给 `execute_sql` 命令（通过 onExecute 或直接调用 invoke）
2. `Ctrl+Shift+Enter`：执行全部 SQL 文本
   - 将全部 SQL 传递给 execute_sql
3. `Ctrl+S`：保存当前查询到查询历史
   - 调用现有查询历史保存逻辑
4. `Ctrl+/`：切换行注释（Monaco 内置支持，启用即可）
5. `Ctrl+Shift+/`：切换块注释（Monaco 内置支持）
6. `Ctrl+F` / `Ctrl+H`：搜索/替换（Monaco 内置支持）
7. `Tab`/`Shift+Tab`：缩进/反缩进（Monaco 内置支持）

**验证命令**：
```powershell
Get-Content src/components/sql/SQLEditor.tsx | Select-String "Ctrl|Ctrl\+Enter|Ctrl\+Shift" | Measure-Object  # Count >= 5
```

### 任务 1.3：编辑器主题与全局主题同步（F-A）

| 属性 | 详情 |
|------|------|
| **优先级** | P0 |
| **依赖** | 任务 1.1 |
| **修改文件** | `src/components/sql/SQLEditor.tsx` |
| **验收标准** | 编辑器暗/亮主题自动切换，与整体 UI 主题一致 |

**具体操作**：
1. 获取全局 ThemeContext 的主题
2. Monaco Editor 主题 'vs-dark'（暗色）/'vs'（亮色）
3. 监听全局主题变化，动态切换编辑器主题
4. 保留原有的 autoSave/saveInterval 等 Settings 配置

---

## M2：智能补全引擎（约 1~2 周，P0）

### 任务 2.1：SQL 关键字/函数名补全（F-B，纯前端）

| 属性 | 详情 |
|------|------|
| **优先级** | P0 |
| **依赖** | 任务 1.1 |
| **新建文件** | `src/utils/sqlCompletionProvider.ts`（补全项 Provider） + `src/types/sql.ts`（类型定义） |
| **验收标准** | 输入 "SEL" 提示 "SELECT"；输入 "SUM(" 提示函数签名 |

**具体操作**：
1. 定义内置 SQL 关键字列表（约 200 个常见 SQL 关键字）：
   - SELECT, FROM, WHERE, AND, OR, NOT, GROUP BY, ORDER BY, JOIN, LEFT JOIN, RIGHT JOIN, INNER JOIN, OUTER JOIN, LIMIT, OFFSET, HAVING, UNION, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, TABLE, VIEW, INDEX, PRIMARY, KEY, FOREIGN, REFERENCES, CASE, WHEN, THEN, ELSE, END, CAST, AS, COUNT, SUM, AVG, MIN, MAX, DISTINCT, IS, NULL, IN, LIKE, BETWEEN, EXISTS, TRUE, FALSE, DATE, TIME, TIMESTAMP, INTEGER, TEXT, REAL, BLOB, BOOLEAN, VARCHAR 等
2. 定义 DuckDB 常用函数名列表（约 100 个）：
   - 聚合函数：SUM, AVG, COUNT, MIN, MAX, FIRST, LAST, GROUP_CONCAT
   - 字符串函数：UPPER, LOWER, LENGTH, TRIM, SUBSTR, CONCAT, REPLACE, LIKE
   - 日期函数：CURRENT_DATE, CURRENT_TIME, CURRENT_TIMESTAMP, DATE, TIME, TIMESTAMP, YEAR, MONTH, DAY, HOUR, MINUTE, SECOND, EXTRACT
   - 数学函数：ABS, ROUND, FLOOR, CEIL, CEILING, SQRT, POW, POWER, MOD, LOG, EXP
   - 条件函数：COALESCE, NULLIF, CASE, IFNULL
3. 实现 Monaco Editor 的 CompletionItemProvider：
   - registerCompletionItemProvider('sql', { provideCompletionItems })
   - 关键字/函数名提供：基于光标位置的 token 做前缀匹配
   - 函数名提供参数签名提示（kind: 'function'）
4. 将 Provider 注册到 Monaco Editor 实例
5. 新增 `sqlEditorStore.ts` 管理补全项缓存（可空，初期纯前端关键字无需缓存）

**验证命令**：
```powershell
Get-ChildItem -Path src -Include sqlCompletionProvider.ts,sqlEditorStore.ts -Recurse | Measure-Object  # Count >= 2
npx tsc --noEmit --pretty  # 0 errors
```

### 任务 2.2：表名/列名补全（F-B + B-A，前后端配合）

| 属性 | 详情 |
|------|------|
| **优先级** | P0 |
| **依赖** | 任务 2.1 |
| **新建文件** | `src-tauri/src/commands/sql.rs`（新增命令） + `src-tauri/src/services/sql_service.rs`（增强） + `src/services/tauri.ts`（新增封装） |
| **验收标准** | 输入 "FROM u" 提示 "users"；输入 "SELECT id" 后提示列名列表 |

**前端实现（F-B）**：
1. 在 sqlEditorStore 中维护 `tableNames: string[]` / `columnNames: Map<string, string[]>` 缓存
2. 补全 Provider 中：
   - 当光标在 FROM/JOIN 关键字后时 → 提供表名补全
   - 当光标在 SELECT/UPDATE/INSERT 语句中，且光标所在 SQL 能解析出表名时 → 提供该表的列名列名补全
   - 当光标在普通位置 → 提供关键字/函数名补全
3. 补全项的 kind 区分：
   - tableNames → kind: 'table'
   - columnNames → kind: 'property'
   - keywords → kind: 'keyword'
   - functions → kind: 'function'

**后端实现（B-A）**：
1. 在 commands/sql.rs 新增命令：
   ```rust
   // 新增：获取当前数据库所有用户表名
   #[tauri::command]
   pub fn get_sql_table_names(state: State<'_, TauriAppState>) -> Result<ApiResponse<Vec<String>>, String> {
       // 调用 sql_service.rs 中的新函数
   }

   // 新增：获取指定表的所有列名
   #[tauri::command]
   pub fn get_sql_column_names(state: State<'_, TauriAppState>, table_name: String) -> Result<ApiResponse<Vec<(String, String)>>, String> {
       // 调用 sql_service.rs 中的新函数，返回 [(列名, 类型)]
   }
   ```
2. 在 services/sql_service.rs 新增函数：
   ```rust
   pub fn get_table_names(conn: &MutexGuardConnection<'_>) -> Result<Vec<String>, String> {
       // SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '__%'
   }
   pub fn get_column_names(conn: &MutexGuardConnection<'_>, table: &str) -> Result<Vec<(String, String)>, String> {
       // PRAGMA table_info('table_name')
   }
   ```
3. 在 lib.rs 注册这两个新命令（遵循 file-lock.md：修改前先完整读取 lib.rs）

**前端封装（F-B）**：
1. 在 `src/services/tauri.ts` 新增：
   ```typescript
   export async function getSqlTableNames(): Promise<ApiResponse<string[]>> {
     return invokeCommand('get_sql_table_names', {});
   }
   export async function getSqlColumnNames(tableName: string): Promise<ApiResponse<Array<[string, string]>>> {
     return invokeCommand('get_sql_column_names', { tableName });
   }
   ```
2. 在 sqlEditorStore 中：
   - 编辑器初始化时一次性拉取 tableNames
   - 当用户在 SELECT 后输入表名时，懒加载该表的列名（带缓存：同一张表不拉取第二次）
   - 表名列名缓存有效期：当用户刷新数据库或切换 Project 时清空

**验证命令**：
```powershell
cd e:\LA_DUCK\la-duck
cd src-tauri
cargo check --quiet  # 0 errors
cargo test --quiet  # 164+ passed
```

### 任务 2.3：错误行号定位（F-B，前端实现）

| 属性 | 详情 |
|------|------|
| **优先级** | P0 |
| **依赖** | 任务 1.1 |
| **新建文件** | `src/utils/sqlErrorParser.ts`（解析错误信息中的行号/列号） |
| **修改文件** | `src/components/sql/SQLEditor.tsx` |
| **验收标准** | 执行错误 SQL 时，编辑器错误行显示红色波浪线，悬浮显示错误信息 |

**具体操作**：
1. DuckDB/SQLite 的典型错误信息格式：
   - `Error: near "xxx": syntax error`
   - `Error: Parser Error: syntax error at line N column M`
   - `Error: Table "xxx" does not exist`
2. 实现 `parseSqlError(errorMsg: string): { line?: number, column?: number, message: string }`：
   - 用正则提取行号/列号（如有）
   - 返回标准化的位置信息 + 错误消息
3. 在 SQLEditor.tsx 中：
   - 执行错误后调用 parseSqlError
   - 使用 Monaco Editor 的 `editor.deltaDecorations()` 在错误行添加红色波浪线
   - 悬浮显示错误信息（通过 decoration 的 hoverMessage）
   - 自动定位光标到错误位置首行
4. 下次成功执行后清除波浪线装饰

**验证命令**：
```powershell
Get-Content src/utils/sqlErrorParser.ts | Select-String "parseSqlError|line|column" | Measure-Object  # Count > 0
npx tsc --noEmit --pretty  # 0 errors
```

### 任务 2.4：sqlStatementParser.ts（F-A，辅助函数）

| 属性 | 详情 |
|------|------|
| **优先级** | P0 |
| **依赖** | 无（纯工具函数，独立无依赖） |
| **新建文件** | `src/utils/sqlStatementParser.ts` |
| **验收标准** | 能正确从多语句 SQL 中提取光标所在的单条语句 |

**具体操作**：
1. 实现 `getStatementAtCursor(sql: string, cursorLine: number, cursorColumn: number): { statement: string, startLine: number, endLine: number }`：
   - 以分号 `;` 为语句分隔符（考虑字符串内的分号不分割）
   - 解析每个语句的起始行/结束行
   - 返回光标所在的语句范围
2. 实现 `splitSqlStatements(sql: string): string[]`：
   - 将多语句 SQL 拆分为语句数组（辅助 execute_sql_batch 使用）
3. 实现 `getCursorPositionInStatement(sql: string, cursorLine: number, cursorColumn: number): { statementIndex: number, lineInStatement: number }`：
   - 辅助错误定位时行号映射

**验证**：用 vitest 编写简单的单元测试（可放在 `src/__tests__/sqlStatementParser.test.ts`）

---

## M3：SQL 格式化 + 执行计划 + 参数绑定（约 2~3 周，P1）

### 任务 3.1：SQL 格式化/美化引擎（F-A）

| 属性 | 详情 |
|------|------|
| **优先级** | P1 |
| **依赖** | 任务 1.1 |
| **新建文件** | `src/utils/sqlFormatter.ts` |
| **修改文件** | `src/components/sql/SqlQueryPage.tsx`（工具栏按钮） |
| **验收标准** | 点击格式化按钮，SQL 变得整洁；关键字大写；缩进正确 |

**方案 A（推荐，轻量）**：自写轻量级 TS 格式化器
- 不依赖外部 npm 包
- 规则：
  1. 关键字（SELECT/FROM/WHERE 等）统一大写（或读取 Settings 配置）
  2. 每个子句（SELECT/FROM/WHERE/GROUP BY/ORDER BY/JOIN/AND/OR）单独一行
  3. 缩进 2/4/8 空格（读取 Settings 的 tabSize）
  4. 逗号位置：行首/行尾（读取 Settings）
  5. 括号配对：成对括号单独一行或跟随上下文
- 优势：零依赖、完全可控、体积小

**方案 B（备选，功能更强）**：引入 `sql-formatter` npm 包（~100KB，MIT License，支持多种 SQL 方言，开箱即用）

**具体操作**：
1. 实现 `formatSql(sql: string, options?: { keywordCase?: 'upper'|'lower'|'preserve', indentWidth?: number, commaPosition?: 'leading'|'trailing' }): string`
2. 默认值从 Settings 读取
3. 在 SqlQueryPage.tsx 工具栏添加"格式化"按钮
4. 快捷键：`Ctrl+Shift+F` 触发格式化
5. Monaco Editor 默认的 `editor.action.formatDocument` 命令也绑定到此函数

**验证命令**：
```powershell
Get-Content src/utils/sqlFormatter.ts | Select-String "function formatSql" | Measure-Object  # Count = 1
Get-Content src/components/sql/SqlQueryPage.tsx | Select-String "格式化|format" | Measure-Object  # Count > 0
```

### 任务 3.2：执行计划（EXPLAIN）面板（F-A + B-A）

| 属性 | 详情 |
|------|------|
| **优先级** | P1 |
| **依赖** | 任务 1.1 |
| **新建文件** | `src/components/sql/ExplainPlanPanel.tsx` + `src-tauri/src/commands/sql.rs`（增强） + `src-tauri/src/services/sql_service.rs`（增强） |
| **验收标准** | 点击执行计划按钮，下方显示树形节点（operation/table/rows/cost） |

**后端实现（B-A）**：
1. 在 commands/sql.rs 新增命令：
   ```rust
   #[tauri::command]
   pub fn execute_explain(state: State<'_, TauriAppState>, sql: String) -> Result<ApiResponse<ExplainPlan>, String> {
       // 1. 在 SQL 前加 "EXPLAIN "
       // 2. 执行查询，获取 EXPLAIN 输出
       // 3. 解析 EXPLAIN 输出为树形 JSON 结构
   }
   ```
2. 在 sql_service.rs 新增函数：
   ```rust
   pub fn execute_explain(conn: &MutexGuardConnection<'_>, sql: &str) -> Result<ExplainPlan, String> {
       // DuckDB EXPLAIN 输出格式（文本）：
       // ┌───────────────────────────┐
       // │┌─────────────────────────┐│
       // ││    PROJECTION           ││
       // ││   ──────────────────    ││
       // ││   ── ELIST: 0           ││
       // ││   ── PROJECTION_COLUMNS:││
       // ││       ┌─── COLUMN:      ││
       // ││       ├─── TABLE:       ││
       // ││       ├─── FILTER:      ││
       // │└─────────────────────────┘│
       // └───────────────────────────┘
       // 或者（简化版/老版本）：
       // ┌──────────────┬──────────────────────┐
       // │┌────────────┐│                      │
       // ││ PROJECTION ││  ── PROJECTION_COLUMNS │
       // ...
       // 需要用文本解析算法转换为 JSON 树结构：
       // {
       //   root: {
       //     operation: 'PROJECTION',
       //     rows: 100,
       //     cost: 5.0,
       //     children: [{ operation: 'TABLE_SCAN', table: 'users', rows: 1000, ... }]
       //   }
       // }
   }
   ```
3. 在 `src-tauri/src/models/` 下新增 `explain_plan.rs` 定义 ExplainPlan 结构体

**前端实现（F-A）**：
1. ExplainPlanPanel.tsx 展示树形结构：
   - 每个节点显示 operation 名称
   - 显示行数估算（rows）
   - 显示成本估算（cost，如果有）
   - 子节点缩进 + 可折叠/展开
2. 在 SqlQueryPage.tsx 工具栏添加"执行计划"按钮
3. 点击执行计划按钮后，面板显示在结果区域的第二个 Tab（与查询结果 Tab 切换）

**验证命令**：
```powershell
cd src-tauri
cargo check --quiet  # 0 errors
cargo test --quiet  # 164+ passed
```

### 任务 3.3：查询变量/参数绑定 UI（F-A）

| 属性 | 详情 |
|------|------|
| **优先级** | P1 |
| **依赖** | 任务 1.1 |
| **新建文件** | `src/components/sql/ParameterInputDialog.tsx` |
| **修改文件** | `src/components/sql/SQLEditor.tsx` |
| **验收标准** | 输入 `SELECT * FROM users WHERE id = ?` 执行时弹出参数输入框 |

**具体操作**：
1. 在执行 SQL 前检查 SQL 中是否有 `?` 或 `:name` 风格的参数
2. 如果有参数：
   - 弹出参数输入对话框（Modal 形式）
   - 对每个参数提供一个 input 输入框
   - `:name` 风格显示参数名，`?` 风格显示序号
   - 支持参数类型推断（字符串/数字/日期）
3. 用户输入完成后，将参数值传递给 `execute_sql` 命令的 `params` 参数（与现有参数化查询机制无缝对接）
4. 下次执行时保留上一次的参数值（localStorage 临时缓存）

---

## M4：SQL 片段/模板库（约 1 周，P1）

### 任务 4.1：__sql_snippets 系统表 + ensure 函数（B-B）

| 属性 | 详情 |
|------|------|
| **优先级** | P1 |
| **依赖** | 无（独立无阻塞，可与 M1/M2 并行） |
| **修改文件** | `src-tauri/src/lib.rs`（新增 ensure 函数） + `src-tauri/src/models/sql_snippet.rs`（新建） + `src-tauri/src/services/sql_service.rs`（增强） + `src-tauri/src/commands/sql.rs`（增强） |
| **验收标准** | 首次启动应用，`__sql_snippets` 表自动创建，预置 10 条模板 |

**具体操作**：
1. 在 models/sql_snippet.rs 定义 SqlSnippet 结构体：
   ```rust
   #[derive(Debug, Serialize, Deserialize)]
   pub struct SqlSnippet {
       pub id: i64,
       pub name: String,
       pub category: String,
       pub description: Option<String>,
       pub sql: String,
       pub is_template: i32,
       pub created_at: String,
       pub updated_at: String,
   }
   ```
2. 在 lib.rs 新增 `ensure_sql_snippets_table` 函数：
   - 建表（参考 architecture.md §3，表名必须以 `__` 开头）
   - 插入 10 条预置模板
   - 用 SqlIdentifier 校验表名（虽然表名硬编码为 `__sql_snippets`，但遵循架构规范）
3. 在 lib.rs 的 ensure_fns 列表中添加新函数（M1 中新增的 SYSTEM_TABLE_ENSURE_FNS 常量）
4. 在 commands/sql.rs 新增 4 个命令：
   - `save_sql_snippet(name, category, description, sql, is_template?)` → 保存/新建
   - `get_sql_snippets()` → 返回所有片段
   - `delete_sql_snippet(id)` → 删除
   - `get_sql_snippet_by_id(id)` → 按 ID 查询
5. 在 sql_service.rs 实现上述 4 个函数的 service 层逻辑

**验证命令**：
```powershell
cd src-tauri
cargo check --quiet  # 0 errors
cargo test --quiet  # 164+ passed
Get-Content src-tauri/src/lib.rs | Select-String "__sql_snippets|ensure_sql_snippets" | Measure-Object  # Count > 0
```

### 任务 4.2：片段库面板（F-B）

| 属性 | 详情 |
|------|------|
| **优先级** | P1 |
| **依赖** | 任务 4.1 |
| **新建文件** | `src/components/sql/SnippetLibrary.tsx` + `src/services/tauri.ts`（新增封装） |
| **验收标准** | 打开片段库面板，可查看/搜索/添加/编辑/删除片段，片段可插入编辑器 |

**具体操作**：
1. SnippetLibrary.tsx 功能：
   - 片段列表显示（名称 + 分类 + 描述）
   - 分类下拉选择过滤
   - 搜索框（按名称/内容/描述全文搜索）
   - 新建片段（名称 + 分类 + 描述 + SQL 编辑器）
   - 编辑/删除现有片段
   - "插入到编辑器"按钮（将片段 SQL 插入到编辑器光标位置）
   - 预置模板与用户片段用不同样式区分
2. 在 SQLEditor.tsx 中：
   - 工具栏添加"片段库"按钮
   - 快捷键 Ctrl+Shift+L 打开片段库面板
3. 前端 tauri.ts 封装：
   ```typescript
   export async function saveSqlSnippet(snippet: { name: string, category: string, description?: string, sql: string, isTemplate?: number }): Promise<ApiResponse<number>> {
     return invokeCommand('save_sql_snippet', snippet);
   }
   export async function getSqlSnippets(): Promise<ApiResponse<Array<{...}>>> {
     return invokeCommand('get_sql_snippets', {});
   }
   export async function deleteSqlSnippet(id: number): Promise<ApiResponse<boolean>> {
     return invokeCommand('delete_sql_snippet', { id });
   }
   ```

---

## M5：门禁 + 文档收尾（约 0.5 周，P0）

### 任务 5.1：架构文档更新（F-ALL，任何人都可）

| 属性 | 详情 |
|------|------|
| **优先级** | P0 |
| **依赖** | 所有任务完成 |
| **修改文件** | `docs/架构现状.md` + `docs/README.md`（如有） |
| **验收标准** | 文档反映最新的功能状态 |

**具体操作**：
1. 更新架构现状.md：
   - 版本号 → v15.0
   - 在"已实现功能"章节添加 "SQL IDE 编辑器"（语法高亮/智能补全/格式化/执行计划/错误定位）
   - 更新系统表列表：添加 `__sql_snippets`（SQL 片段库）
   - 更新命令列表：添加 `execute_explain` / `get_sql_table_names` / `get_sql_column_names` / `save_sql_snippet` / `get_sql_snippets` / `delete_sql_snippet` / `get_sql_snippet_by_id` 7 个新命令
   - 更新测试统计：`cargo test` 通过数量增加
2. 更新 M7 路线图说明：已完成 M7 全部核心目标

### 任务 5.2：最终门禁验证（F-ALL）

| 门禁项 | 命令 | 预期结果 |
|--------|------|---------|
| Rust 编译 | `cd src-tauri; cargo check --quiet` | 0 errors |
| Rust 测试 | `cargo test --quiet` | 164+ passed, 0 failed |
| TS 类型检查 | `npx tsc --noEmit --pretty` | 0 errors |
| 前端测试 | `npx vitest run` | 43+ tests passed |
| SQL 注入检测 | `Get-ChildItem -Path src,src-tauri/src -Include *.ts,*.tsx,*.rs -Recurse \| Select-String -Pattern 'format!.*SELECT\|format!.*INSERT\|format!.*UPDATE\|format!.*DELETE' \| Measure-Object \| Select-Object Count` | **Count = 0**（0 处 format! 拼接 SQL） |
| 敏感字符串检测 | `Get-ChildItem -Path src-tauri/src,src -Include *.rs,*.ts,*.tsx -Recurse \| Select-String -Pattern 'sk-\|Bearer \|ghp_\|eyJ\|password:\|PRIVATE KEY' \| Measure-Object \| Select-Object Count` | **Count = 0** |
| console.log 清零 | `Get-ChildItem -Path src -Include *.ts,*.tsx -Recurse \| Select-String -Pattern 'console\.log' \| Select-String -NotMatch '//' \| Measure-Object \| Select-Object Count` | **Count = 0** |

---

# 任务依赖图

```
┌─────────────────────────────────────────────────────────────────────┐
│ 前置条件：项目现有 execute_sql 命令 + cache 逻辑存在                  │
└──────────────────────────────────────┬──────────────────────────────┘
                                        │
                     ┌──────────────────┴──────────────────────────┐
                     │                                           │
                     ▼                                           ▼
              ┌───────────┐                              ┌───────────┐
              │  任务 1.1 │  F-A                        │  任务 4.1 │  B-B
              │ Monaco    │  ← 独立无阻塞               │ 系统表     │ ← 独立无阻塞
              │ Editor    │                              │ 创建       │
              └────┬──────┘                              └─────┬─────┘
                   │                                          │
         ┌─────────┴──────────┐                              │
         ▼                    ▼                              ▼
    ┌───────────┐      ┌───────────┐                   ┌───────────┐
    │  任务 1.2 │      │  任务 2.1 │ F-B               │  任务 4.2 │ F-B
    │ 快捷键    │      │ 关键字/   │ ← 依赖 1.1         │ 片段库面板 │ ← 依赖 4.1
    └────┬──────┘      │ 函数名补全│                   └───────────┘
         │             └─────┬─────┘
         │                   │
    ┌───────────┐            │
    │  任务 1.3 │            │
    │ 主题同步   │            │
    └────┬──────┘            │
         │                   │
         ▼                   ▼
    ┌────────────────────────────────────────────┐
    │  M1 完成（Monaco 基础）                     │
    └────┬───────────────────────────────────────┘
         │
         ├──────────────────────────────────────┐
         ▼                                      ▼
    ┌───────────┐                          ┌───────────┐
    │  任务 2.2 │ F-B + B-A                │  任务 3.1 │ F-A
    │ 表名/列名 │ ← 依赖 1.1 + 2.1         │ SQL 格式化 │ ← 依赖 1.1
    └────┬──────┘                          └─────┬─────┘
         │                                       │
         ▼                                       ▼
    ┌───────────┐                          ┌───────────┐
    │  任务 2.3 │ F-B                      │  任务 3.2 │ F-A + B-A
    │ 错误定位   │ ← 依赖 1.1                │ 执行计划   │ ← 依赖 1.1
    └────┬──────┘                          └─────┬─────┘
         │                                       │
         ▼                                       ▼
    ┌───────────┐                          ┌───────────┐
    │  任务 2.4 │ F-A                      │  任务 3.3 │ F-A
    │ 语句解析器 │ ← 独立无阻塞              │ 参数绑定   │ ← 依赖 1.1
    └────┬──────┘                          └─────┬─────┘
         │                                       │
         ├───────────────────────────────────────┘
         │
         ▼
    ┌────────────────────────────────────────────┐
    │  M2 完成（智能补全）                        │
    └────┬───────────────────────────────────────┘
         │
         │
         ▼
    ┌────────────────────────────────────────────┐
    │  M3 完成（格式化 + 执行计划 + 参数绑定）    │
    └────┬───────────────────────────────────────┘
         │
         ▼
    ┌────────────────────────────────────────────┐
    │  M4 完成（片段库）                          │
    └────┬───────────────────────────────────────┘
         │
         ▼
    ┌────────────────────────────────────────────┐
    │  任务 5.1 + 5.2（文档 + 门禁）             │
    └────────────────────────────────────────────┘
         │
         ▼
    ┌────────────────────────────────────────────┐
    │  ✅  v15.0 发布（SQL IDE 全面升级完成）     │
    └────────────────────────────────────────────┘
```

---

# 关键里程碑门禁

每个里程碑完成后必须执行以下验证：

| 里程碑 | 验证命令 | 通过标准 |
|--------|---------|---------|
| **M1 完成后** | `cd src-tauri; cargo check --quiet` | 0 errors |
| | `npx tsc --noEmit --pretty` | 0 errors |
| | `Get-Content src/components/sql/SQLEditor.tsx \| Select-String "monaco\|Editor" \| Measure-Object` | Count > 5 |
| **M2 完成后** | `cargo check --quiet` | 0 errors |
| | `cargo test --quiet` | 164+ passed |
| | `npx tsc --noEmit --pretty` | 0 errors |
| | `Get-Content src/utils/sqlCompletionProvider.ts \| Measure-Object -Line \| Select-Object Lines` | Lines > 50 |
| **M3 完成后** | `cargo check --quiet` | 0 errors |
| | `cargo test --quiet` | 164+ passed |
| | `npx tsc --noEmit --pretty` | 0 errors |
| | `Get-Content src/components/sql/ExplainPlanPanel.tsx \| Select-String "EXPLAIN\|Tree\|Node" \| Measure-Object` | Count > 3 |
| **M4 完成后** | `cargo check --quiet` | 0 errors |
| | `cargo test --quiet` | 164+ passed |
| | `npx tsc --noEmit --pretty` | 0 errors |
| | `Get-Content src-tauri/src/lib.rs \| Select-String "__sql_snippets" \| Measure-Object` | Count > 0 |
| **M5（最终）** | 执行 checklist.md 所有门禁命令 | **全部通过** |

---

*文档结束· QuickerSQL v15.0 · SQL 编辑器全面升级 实施计划*

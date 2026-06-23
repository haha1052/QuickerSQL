# QuickerSQL SQL 编辑器全面升级 — 验收检查清单 checklist.md v15.0

## 使用说明

本 checklist 包含 3 个维度的验收标准：
1. **🔧 门禁命令**（programmatic，在 Windows PowerShell 中执行，0 errors/Count = 0 才算通过）
2. **👤 人工验证**（human-judgment，在应用内直接操作验证功能是否正常）
3. **📄 文档与架构一致性**（确保文档、命名、架构规则完全一致）

**执行顺序**：门禁命令 → 人工验证 → 文档核对
每项必须全部通过后，方可标记为 ✅ 通过。

---

# 第一部分：门禁命令验证（在项目根目录执行）

## P0：核心门禁（每次修改后必须立即执行）

| # | 验证项 | PowerShell 命令 | 通过标准 | 执行时间 |
|---|--------|-----------------|---------|---------|
| C-1 | **Rust 编译检查** | `cd src-tauri; cargo check --quiet` | 0 errors | < 30 秒 |
| C-2 | **Rust 单元测试** | `cargo test --quiet` | 164+ passed, 0 failed | < 5 分钟 |
| C-3 | **TS 类型检查** | `npx tsc --noEmit --pretty 2>&1 \| Select-Object -Last 10` | 0 errors | < 2 分钟 |
| C-4 | **前端单元测试** | `npx vitest run 2>&1 \| Select-Object -Last 15` | 43+ tests passed | < 1 分钟 |
| C-5 | **console.log 清零** | `Get-ChildItem -Path src -Include *.ts,*.tsx -Recurse \| Select-String -Pattern 'console\.log' \| Select-String -NotMatch '//' \| Measure-Object \| Select-Object Count` | **Count = 0** | < 5 秒 |
| C-6 | **SQL 注入检测（Rust）** | `cd src-tauri; Get-ChildItem -Path src -Include *.rs -Recurse \| Select-String -Pattern 'format!.*SELECT\|format!.*INSERT\|format!.*UPDATE\|format!.*DELETE\|conn.execute(format!' -CaseSensitive:$false \| Measure-Object \| Select-Object Count` | **Count = 0** | < 5 秒 |
| C-7 | **SQL 注入检测（TS）** | `Get-ChildItem -Path src -Include *.ts,*.tsx -Recurse \| Select-String -Pattern 'SELECT\|INSERT\|UPDATE\|DELETE' -CaseSensitive:$false \| Measure-Object \| Select-Object Count` | **Count = 0**（前端不应拼接 SQL 文本，SQL 文本只允许作为常量字符串传给 invoke） | < 5 秒 |
| C-8 | **敏感字符串检测** | `Get-ChildItem -Path src-tauri/src,src -Include *.rs,*.ts,*.tsx -Recurse \| Select-String -Pattern 'sk-\|Bearer \|ghp_\|eyJ\|password:\|PRIVATE KEY' \| Measure-Object \| Select-Object Count` | **Count = 0** | < 10 秒 |

### C-1 ~ C-8 全部通过才能进入下一阶段。

---

## P1：目录结构与文件完整性检查

| # | 验证项 | PowerShell 命令 | 通过标准 |
|---|--------|-----------------|---------|
| C-9 | **编辑器组件存在** | `Test-Path src/components/sql/SQLEditor.tsx` | **True** |
| C-10 | **语句解析器存在** | `Test-Path src/utils/sqlStatementParser.ts` | **True** |
| C-11 | **SQL 格式化引擎存在** | `Test-Path src/utils/sqlFormatter.ts` | **True** |
| C-12 | **补全 Provider 存在** | `Test-Path src/utils/sqlCompletionProvider.ts` | **True** |
| C-13 | **错误解析器存在** | `Test-Path src/utils/sqlErrorParser.ts` | **True** |
| C-14 | **片段库面板存在** | `Test-Path src/components/sql/SnippetLibrary.tsx` | **True** |
| C-15 | **执行计划面板存在** | `Test-Path src/components/sql/ExplainPlanPanel.tsx` | **True** |
| C-16 | **参数对话框存在** | `Test-Path src/components/sql/ParameterInputDialog.tsx` | **True** |
| C-17 | **编辑器 Store 存在** | `Test-Path src/store/sqlEditorStore.ts` | **True** |
| C-18 | **SQL 类型定义存在** | `Test-Path src/types/sql.ts` | **True** |
| C-19 | **Rust 片段模型存在** | `Test-Path src-tauri/src/models/sql_snippet.rs` | **True** |
| C-20 | **Rust 执行计划模型存在** | `Test-Path src-tauri/src/models/explain_plan.rs` | **True** |
| C-21 | **Monaco Editor 引入** | `Get-Content package.json \| Select-String "monaco" \| Measure-Object` | Count > 0 |
| C-22 | **Monaco 在编辑器中使用** | `Get-Content src/components/sql/SQLEditor.tsx \| Select-String "monaco\|Monaco\|Editor" \| Measure-Object` | Count > 5 |

---

## P2：系统表与命令注册检查

| # | 验证项 | PowerShell 命令 | 通过标准 |
|---|--------|-----------------|---------|
| C-23 | **__sql_snippets 系统表命名规范** | `Get-ChildItem -Path src-tauri/src -Include *.rs -Recurse \| Select-String '__sql_snippets' \| Measure-Object \| Select-Object Count` | Count > 0 |
| C-24 | **ensure_sql_snippets_table 函数存在** | `Get-Content src-tauri/src/lib.rs \| Select-String 'ensure_sql_snippets\|SqlSnippet' \| Measure-Object` | Count > 0 |
| C-25 | **execute_explain 命令存在** | `Get-Content src-tauri/src/commands/sql.rs \| Select-String 'execute_explain' \| Measure-Object` | Count > 0 |
| C-26 | **get_sql_table_names 命令存在** | `Get-Content src-tauri/src/commands/sql.rs \| Select-String 'get_sql_table_names' \| Measure-Object` | Count > 0 |
| C-27 | **get_sql_column_names 命令存在** | `Get-Content src-tauri/src/commands/sql.rs \| Select-String 'get_sql_column_names' \| Measure-Object` | Count > 0 |
| C-28 | **save_sql_snippet 命令存在** | `Get-Content src-tauri/src/commands/sql.rs \| Select-String 'save_sql_snippet' \| Measure-Object` | Count > 0 |
| C-29 | **get_sql_snippets 命令存在** | `Get-Content src-tauri/src/commands/sql.rs \| Select-String 'get_sql_snippets' \| Measure-Object` | Count > 0 |
| C-30 | **delete_sql_snippet 命令存在** | `Get-Content src-tauri/src/commands/sql.rs \| Select-String 'delete_sql_snippet' \| Measure-Object` | Count > 0 |
| C-31 | **新命令已注册到 invoke 列表** | `Get-Content src-tauri/src/lib.rs \| Select-String 'execute_explain\|get_sql_table_names\|get_sql_column_names\|save_sql_snippet\|get_sql_snippets\|delete_sql_snippet' \| Measure-Object \| Select-Object Count` | **Count >= 6** |
| C-32 | **tauri.ts 封装完整** | `Get-Content src/services/tauri.ts \| Select-String 'execute_explain\|get_sql_table_names\|get_sql_column_names\|save_sql_snippet\|get_sql_snippets\|delete_sql_snippet' \| Measure-Object \| Select-Object Count` | **Count >= 6** |

---

## P3：功能逻辑完整性检查

| # | 验证项 | PowerShell 命令 | 通过标准 |
|---|--------|-----------------|---------|
| C-33 | **语法高亮启用** | `Get-Content src/components/sql/SQLEditor.tsx \| Select-String "language.*sql\|sql.*language\|language: 'sql'" \| Measure-Object` | Count > 0 |
| C-34 | **Ctrl+Enter 快捷键绑定** | `Get-Content src/components/sql/SQLEditor.tsx \| Select-String 'Ctrl.*Enter\|Ctrl\+Enter\|handleKey.*Enter' \| Measure-Object` | Count > 0 |
| C-35 | **Ctrl+Shift+Enter 全语句执行** | `Get-Content src/components/sql/SQLEditor.tsx \| Select-String 'Ctrl.*Shift.*Enter\|execute.*all\|execute_all' \| Measure-Object` | Count > 0 |
| C-36 | **补全 Provider 注册** | `Get-Content src/utils/sqlCompletionProvider.ts \| Select-String 'registerCompletionItemProvider\|provideCompletionItems\|CompletionItem' \| Measure-Object \| Select-Object Count` | Count > 5 |
| C-37 | **格式化函数实现** | `Get-Content src/utils/sqlFormatter.ts \| Select-String 'function formatSql\|const formatSql\|export.*formatSql' \| Measure-Object` | Count > 0 |
| C-38 | **错误行号解析** | `Get-Content src/utils/sqlErrorParser.ts \| Select-String 'parseSqlError\|line.*number\|line\|column' \| Measure-Object \| Select-Object Count` | Count > 3 |
| C-39 | **语句解析实现** | `Get-Content src/utils/sqlStatementParser.ts \| Select-String 'getStatementAtCursor\|splitSqlStatements\|cursor' \| Measure-Object \| Select-Object Count` | Count > 3 |
| C-40 | **编辑器主题自适应** | `Get-Content src/components/sql/SQLEditor.tsx \| Select-String 'theme.*dark\|theme.*light\|ThemeContext\|theme:' \| Measure-Object` | Count > 0 |
| C-41 | **迷你地图启用** | `Get-Content src/components/sql/SQLEditor.tsx \| Select-String 'minimap' \| Measure-Object` | Count > 0 |
| C-42 | **括号匹配启用** | `Get-Content src/components/sql/SQLEditor.tsx \| Select-String 'bracketPair\|bracket' \| Measure-Object` | Count > 0 |
| C-43 | **自动闭合括号** | `Get-Content src/components/sql/SQLEditor.tsx \| Select-String 'autoClosingBrackets\|autoClose' \| Measure-Object` | Count > 0 |
| C-44 | **代码折叠启用** | `Get-Content src/components/sql/SQLEditor.tsx \| Select-String 'folding' \| Measure-Object` | Count > 0 |
| C-45 | **行号显示** | `Get-Content src/components/sql/SQLEditor.tsx \| Select-String 'lineNumbers' \| Measure-Object` | Count > 0 |
| C-46 | **格式化按钮存在** | `Get-Content src/components/sql/SqlQueryPage.tsx \| Select-String 'format\|格式化\|美化' \| Measure-Object` | Count > 0 |
| C-47 | **执行计划按钮存在** | `Get-Content src/components/sql/SqlQueryPage.tsx \| Select-String 'explain\|执行计划\|EXPLAIN' \| Measure-Object` | Count > 0 |
| C-48 | **片段库按钮存在** | `Get-Content src/components/sql/SqlQueryPage.tsx \| Select-String 'snippet\|片段\|Snippet' \| Measure-Object` | Count > 0 |
| C-49 | **补全项关键字列表存在** | `Get-Content src/utils/sqlCompletionProvider.ts \| Select-String 'SELECT\|FROM\|WHERE\|GROUP\|ORDER\|JOIN' \| Measure-Object \| Select-Object Count` | Count > 5 |
| C-50 | **补全项函数名列表存在** | `Get-Content src/utils/sqlCompletionProvider.ts \| Select-String 'SUM\|AVG\|COUNT\|UPPER\|LOWER\|COALESCE\|DATE' \| Measure-Object \| Select-Object Count` | Count > 3 |
| C-51 | **参数识别正则** | `Get-Content src/components/sql/SQLEditor.tsx \| Select-String '\?.*\|:name\|:.*\b' \| Measure-Object` | Count > 0 |
| C-52 | **红色波浪线装饰** | `Get-Content src/components/sql/SQLEditor.tsx \| Select-String 'deltaDecorations\|decoration.*error\|red.*squiggly\|squiggly' \| Measure-Object` | Count > 0 |
| C-53 | **Settings 配置读取** | `Get-Content src/components/sql/SQLEditor.tsx \| Select-String 'useSetting\|SettingsContext\|fontSize\|tabSize\|wordWrap' \| Measure-Object \| Select-Object Count` | Count > 5 |

---

# 第二部分：人工验证（在应用内直接操作）

## P0：编辑器基础体验

| # | 操作步骤 | 预期结果 | 优先级 | 状态 |
|---|---------|---------|--------|------|
| H-1 | 打开应用，进入 SQL 查询页面 | 编辑器正常显示，字体清晰可读，可输入文字 | P0 | ⬜ |
| H-2 | 输入 `SELECT * FROM users` | SELECT/FROM/WHERE 等关键字变色，高亮正确 | P0 | ⬜ |
| H-3 | 编辑器左侧 | 显示数字行号 | P0 | ⬜ |
| H-4 | 输入 `SELECT (a + b) * c` | 括号自动配对，光标处括号与对应括号颜色相同 | P0 | ⬜ |
| H-5 | 输入 `SELECT 'hello'` | 单引号自动闭合（输入第一个 `'` 后自动补第二个 `'`） | P0 | ⬜ |
| H-6 | 输入 20 行以上的 SQL | 第 1 行左侧出现折叠按钮（▼），可点击折叠/展开 | P0 | ⬜ |
| H-7 | 编辑器右侧 | 显示迷你地图（代码缩略图） | P0 | ⬜ |
| H-8 | 切换全局主题（暗→亮→暗） | 编辑器主题同步切换，颜色与整体 UI 协调 | P0 | ⬜ |
| H-9 | 修改 Settings 中字体大小为 16px | 编辑器字体立即变大 | P0 | ⬜ |
| H-10 | 修改 Settings 中 tabSize 为 4 | Tab 键缩进变为 4 空格 | P0 | ⬜ |

### P0 功能 100% 通过才能进入 P1 功能验证。

---

## P0：编辑器快捷键验证

| # | 操作步骤 | 预期结果 | 优先级 | 状态 |
|---|---------|---------|--------|------|
| H-11 | 光标在 `SELECT * FROM users` 语句上，按 `Ctrl+Enter` | 仅执行该单条语句，返回正确结果，不执行其他语句 | P0 | ⬜ |
| H-12 | 输入多条 SQL（用分号分隔），光标在第 2 条，按 `Ctrl+Shift+Enter` | 全部语句依次执行，返回所有结果 | P0 | ⬜ |
| H-13 | 光标在一行文字上，按 `Ctrl+/` | 该行变为 `-- 注释文字`（SQL 行注释），再次按恢复 | P0 | ⬜ |
| H-14 | 选中多行文字，按 `Ctrl+Shift+/` | 多行被 `/* ... */` 包裹，再次按恢复 | P0 | ⬜ |
| H-15 | 按 `Ctrl+F` | 弹出搜索框，可输入关键字搜索 | P0 | ⬜ |
| H-16 | 按 `Ctrl+H` | 弹出替换框，可查找/替换 | P0 | ⬜ |
| H-17 | 按 `Ctrl+Z` | 撤销上一次编辑 | P0 | ⬜ |
| H-18 | 按 `Ctrl+Shift+Z` | 重做编辑（撤销的撤销） | P0 | ⬜ |
| H-19 | 按 `Tab` / `Shift+Tab` | 选中行缩进/反缩进 | P0 | ⬜ |

---

## P0：智能补全验证

| # | 操作步骤 | 预期结果 | 优先级 | 状态 |
|---|---------|---------|--------|------|
| H-20 | 清空编辑器，输入 `SEL` | 下拉列表出现 `SELECT`，按 Tab 或 Enter 自动补全 | P0 | ⬜ |
| H-21 | 输入 `SELECT * FROM u` | 下拉列表出现数据库中以 `u` 开头的表名 | P0 | ⬜ |
| H-22 | 输入 `SELECT id FROM users`，光标在 `SELECT` 后，输入 ` `（空格） | 下拉列表出现 `users` 表的列名（id/name/email 等） | P0 | ⬜ |
| H-23 | 输入 `SUM(` | 出现函数签名提示 `SUM(column): number` | P0 | ⬜ |
| H-24 | 输入 `WHERE name LIKE` | LIKE 关键字在补全列表中优先出现 | P0 | ⬜ |
| H-25 | 输入 `SELECT C` | `COUNT`/`CASE`/`CAST`/`CURRENT_DATE` 等 C 开头关键字/函数出现 | P0 | ⬜ |

---

## P0：错误行号定位验证

| # | 操作步骤 | 预期结果 | 优先级 | 状态 |
|---|---------|---------|--------|------|
| H-26 | 输入 `SELECT * FROM nonexistent_table`，执行 | 返回错误信息："表不存在"，错误行在编辑器显示红色波浪线 | P0 | ⬜ |
| H-27 | 鼠标悬停在红色波浪线上方 | 悬浮提示显示完整错误信息 | P0 | ⬜ |
| H-28 | 点击执行结果中的错误行 | 编辑器光标自动跳转到错误行 | P0 | ⬜ |
| H-29 | 再次执行一条正确的 SQL | 红色波浪线消失，结果正常显示 | P0 | ⬜ |
| H-30 | 输入 `SELECT FROM users`（缺少选择项），执行 | 返回语法错误，行号准确指向 `FROM` 所在行 | P0 | ⬜ |

---

## P1：SQL 格式化/美化验证

| # | 操作步骤 | 预期结果 | 优先级 | 状态 |
|---|---------|---------|--------|------|
| H-31 | 输入未格式化 SQL：`select id,name,email from users where id>5 and name='alice'`，点击工具栏"格式化"按钮 | SQL 变为整洁格式：关键字大写，每子句独立一行，缩进正确 | P1 | ⬜ |
| H-32 | 按 `Ctrl+Shift+F` | 同样触发格式化 | P1 | ⬜ |
| H-33 | 在 Settings 中修改缩进宽度为 4（原为 2），再格式化 | 格式化后使用 4 空格缩进 | P1 | ⬜ |
| H-34 | 在 Settings 中修改关键字大小写为 lower，再格式化 | 关键字变为小写（select/from/where） | P1 | ⬜ |

---

## P1：执行计划 EXPLAIN 面板验证

| # | 操作步骤 | 预期结果 | 优先级 | 状态 |
|---|---------|---------|--------|------|
| H-35 | 输入 `SELECT * FROM users WHERE id > 5`，点击工具栏"执行计划"按钮 | 编辑器下方或独立面板显示执行计划树形节点 | P1 | ⬜ |
| H-36 | 查看执行计划 | 每个节点显示 operation 名称（如 TABLE_SCAN/PROJECTION/FILTER） | P1 | ⬜ |
| H-37 | 执行计划中的节点 | 显示行数估算（rows） | P1 | ⬜ |
| H-38 | 点击执行计划中的节点 | 可展开/折叠子节点 | P1 | ⬜ |
| H-39 | 再次点击"执行"按钮执行正常查询 | 切换回正常查询结果，不显示执行计划 | P1 | ⬜ |

---

## P1：查询变量/参数绑定 UI 验证

| # | 操作步骤 | 预期结果 | 优先级 | 状态 |
|---|---------|---------|--------|------|
| H-40 | 输入 `SELECT * FROM users WHERE id = ?`，按 Ctrl+Enter | 弹出参数输入对话框 | P1 | ⬜ |
| H-41 | 在对话框中输入 `5`，点击确定 | 执行查询，返回 id = 5 的用户记录 | P1 | ⬜ |
| H-42 | 再次执行同一条 SQL | 弹出对话框时保留上次的参数值 `5` | P1 | ⬜ |
| H-43 | 输入 `SELECT * FROM users WHERE name = :username AND status = :status`，执行 | 弹出对话框，显示两个参数输入框，参数名 `username`/`status` 可见 | P1 | ⬜ |

---

## P1：SQL 片段/模板库验证

| # | 操作步骤 | 预期结果 | 优先级 | 状态 |
|---|---------|---------|--------|------|
| H-44 | 点击工具栏"片段库"按钮（或按 Ctrl+Shift+L） | 打开片段库面板，显示预置模板和用户创建的片段 | P1 | ⬜ |
| H-45 | 查看预置模板 | 至少显示 10 个预置模板（查询所有表、表结构、分组汇总等） | P1 | ⬜ |
| H-46 | 点击"查询所有表"模板的"插入到编辑器" | 编辑器插入 `SELECT name FROM sqlite_master WHERE type = 'table';` | P1 | ⬜ |
| H-47 | 点击"新建片段" | 弹出输入框，填写名称/分类/SQL，点击保存 | P1 | ⬜ |
| H-48 | 新建片段后，再次打开片段库面板 | 新建的片段出现在列表中 | P1 | ⬜ |
| H-49 | 按分类下拉选择"聚合" | 只显示分类为"聚合"的片段 | P1 | ⬜ |
| H-50 | 在搜索框输入"查询" | 只显示名称/描述/内容含"查询"的片段 | P1 | ⬜ |
| H-51 | 点击用户片段的"编辑"按钮 | 打开编辑对话框，修改并保存，列表更新 | P1 | ⬜ |
| H-52 | 点击用户片段的"删除"按钮（确认） | 片段从列表消失，数据库中记录被删除 | P1 | ⬜ |

---

# 第三部分：文档与架构一致性检查

## P0：架构规则一致性

| # | 验证项 | 操作方法 | 通过标准 | 状态 |
|---|--------|---------|---------|------|
| D-1 | **系统表命名规范** | 检查 `__sql_snippets` 表名是否以 `__` 开头 | 是 ✅ | ⬜ |
| D-2 | **SQL 文本不直接拼接** | commands/sql.rs 使用参数化查询，而非 format! | 0 处 format! 拼接 SQL | ⬜ |
| D-3 | **SQL 文本禁止在前端出现** | src/ 目录内没有动态构造 SQL 字符串 | 仅在编辑器中作为用户输入的字符串，不做代码级拼接 | ⬜ |
| D-4 | **新命令注册完整** | lib.rs 中的 invoke 列表包含所有新命令 | 6 个新命令都在列表中 | ⬜ |
| D-5 | **类型定义存在** | src/types/sql.ts 定义了 SqlSnippet/ExplainNode/CompletionItem 等类型 | 类型定义完整 | ⬜ |
| D-6 | **models/ 目录包含 SQL 相关结构体** | src-tauri/src/models/sql_snippet.rs 存在，且字段与表结构一致 | 字段一致 | ⬜ |
| D-7 | **commands/services 分层正确** | commands/sql.rs 仅做参数校验/状态获取/调用 service 层，不直接写 SQL | 0 处直接写 SQL | ⬜ |
| D-8 | **commands 层无 unwrap** | `cd src-tauri; Get-ChildItem -Path src/commands -Include *.rs -Recurse \| Select-String '\.unwrap\(\)' \| Measure-Object \| Select-Object Count` | **Count = 0** | ⬜ |
| D-9 | **Tier-1 文件修改前读取** | 查阅 `src-tauri/src/lib.rs` 的 Git commit history（如已有） | 改动前先完整读取（无需修改此项目前状态） | ⬜ |
| D-10 | **文件 lock 规范** | 检查 lib.rs 是否有多人同时修改（在协同场景下） | 单任务串行修改 Tier-1 文件 | ⬜ |

---

## P0：文档完整性

| # | 验证项 | 操作方法 | 通过标准 | 状态 |
|---|--------|---------|---------|------|
| D-11 | **spec.md 存在** | `Test-Path .trae/specs/sql-editor-upgrade-v15.0/spec.md` | True | ⬜ |
| D-12 | **tasks.md 存在** | `Test-Path .trae/specs/sql-editor-upgrade-v15.0/tasks.md` | True | ⬜ |
| D-13 | **checklist.md 存在** | `Test-Path .trae/specs/sql-editor-upgrade-v15.0/checklist.md` | True | ⬜ |
| D-14 | **架构现状.md 更新** | `docs/架构现状.md` 版本号已更新为 v15.0 | 版本号正确 | ⬜ |
| D-15 | **系统表列表更新** | `docs/架构现状.md` 包含 `__sql_snippets` | 已添加 | ⬜ |
| D-16 | **命令列表更新** | `docs/架构现状.md` 包含 6 个新命令说明 | 已添加 | ⬜ |
| D-17 | **SQL 片段库功能说明** | `docs/架构现状.md` 有 SQL IDE 升级相关功能说明 | 已添加 | ⬜ |
| D-18 | **spec.md 与实际代码一致** | 抽样检查 spec.md 中定义的功能是否实际实现 | 一致率 >= 95% | ⬜ |

---

# 最终交付物清单

| # | 交付物 | 位置 | 状态 |
|---|--------|------|------|
| F-1 | Monaco Editor 基础编辑器 | `src/components/sql/SQLEditor.tsx` | ⬜ |
| F-2 | SQL 语句解析器 | `src/utils/sqlStatementParser.ts` | ⬜ |
| F-3 | SQL 格式化引擎 | `src/utils/sqlFormatter.ts` | ⬜ |
| F-4 | 智能补全 Provider | `src/utils/sqlCompletionProvider.ts` | ⬜ |
| F-5 | SQL 错误解析器 | `src/utils/sqlErrorParser.ts` | ⬜ |
| F-6 | SQL 片段库面板 | `src/components/sql/SnippetLibrary.tsx` | ⬜ |
| F-7 | 执行计划面板 | `src/components/sql/ExplainPlanPanel.tsx` | ⬜ |
| F-8 | 参数输入对话框 | `src/components/sql/ParameterInputDialog.tsx` | ⬜ |
| F-9 | 编辑器状态管理 | `src/store/sqlEditorStore.ts` | ⬜ |
| F-10 | SQL 相关类型定义 | `src/types/sql.ts` | ⬜ |
| F-11 | Rust SQL 片段模型 | `src-tauri/src/models/sql_snippet.rs` | ⬜ |
| F-12 | Rust 执行计划模型 | `src-tauri/src/models/explain_plan.rs` | ⬜ |
| F-13 | Rust service 层增强 | `src-tauri/src/services/sql_service.rs`（新增 6+ 函数） | ⬜ |
| F-14 | Rust commands 层增强 | `src-tauri/src/commands/sql.rs`（新增 6+ 命令） | ⬜ |
| F-15 | invoke 列表更新 | `src-tauri/src/lib.rs`（注册新命令） | ⬜ |
| F-16 | 前端 tauri.ts 封装 | `src/services/tauri.ts`（新增 6+ 个 invoke 封装） | ⬜ |
| F-17 | 增强 SqlQueryPage | `src/components/sql/SqlQueryPage.tsx`（工具栏按钮 + 结果 Tab） | ⬜ |
| F-18 | `__sql_snippets` 系统表 | 应用启动后数据库中存在 | ⬜ |
| F-19 | 预置 10 条 SQL 模板 | 首次启动自动插入 | ⬜ |
| F-20 | 文档更新（v15.0） | `docs/架构现状.md` | ⬜ |

---

# 最终验收通过标准

1. **门禁命令 C-1 ~ C-53 全部通过**
2. **人工验证 H-1 ~ H-52 全部通过**
3. **文档一致性 D-1 ~ D-18 全部通过**
4. **功能优先级满足**：
   - P0 功能 100% 全部通过
   - P1 功能 >= 95% 通过
5. **性能基准**：
   - 编辑器打开 1MB SQL 文件不卡顿（加载时间 < 1 秒）
   - 智能补全响应时间 < 200ms
   - 格式化 100 行 SQL < 100ms
   - 执行计划查询 < 2 秒（含数据库查询）

---

# 通过后的下一步

1. ✅ 标记本 checklist 为全部通过
2. 更新 `docs/架构现状.md` 的版本号为 **v15.0**，添加 SQL IDE 升级说明
3. 更新 `docs/README.md`（如有），在功能列表中添加"SQL IDE 编辑器"
4. 提交 Git commit：`feat: SQL IDE 全面升级（v15.0）— Monaco Editor + 智能补全 + 格式化 + 执行计划 + 片段库`
5. 通知团队成员：v15.0 SQL IDE 升级已完成，所有门禁已通过

---

# 失败处理

如果任何一项验证未通过：

1. **记录失败项**：在 checklist 中标记对应项为 ❌，并在该项旁添加失败原因说明
2. **定位问题**：回溯对应任务（查看 tasks.md 的任务编号），定位修改文件与责任人
3. **修复方案**：分析失败原因，给出具体修复建议
4. **重新验证**：修复后重新执行该项目（不必从头跑全部门禁）
5. **批量失败（>= 3 项 P0 失败）**：
   - 停止本里程碑交付
   - 重新评估实现方案
   - 必要时回到 spec 设计阶段重新讨论方案

---

*文档结束· QuickerSQL v15.0 · SQL 编辑器全面升级 验收检查清单*

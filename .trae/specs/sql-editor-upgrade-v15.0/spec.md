# QuickerSQL SQL 编辑器全面升级 — Product Requirement Document v15.0

## Overview
- **Summary**：将当前 SQL 编辑器从"普通文本编辑器升级为"对标 DBeaver / DataGrip / TablePlus 的专业级 SQL IDE"。核心变化：（1）Monaco Editor 替换现有 textarea；（2）语法高亮 + 智能补全 + 括号匹配 + 代码折叠；（3）SQL 格式化/美化；（4）执行计划 EXPLAIN；（5）查询变量绑定；（6）错误行号定位；（7）多语句自动分语句定位；（8）SQL 片段/模板库复用；（9）Ctrl+Enter 执行当前语句/全选执行。
- **Purpose**：解决"当前编辑器无高亮、无补全、无智能提示"三大问题，重度 SQL 用户上手门槛高、日常编写效率低"三个核心痛点，使 QuickerSQL 的 SQL 编辑器达到或接近 DataGrip/TablePlus 级别的编辑体验。
- **Target Users**：QuickerSQL 的产品/研发负责人（即本项目所有者）与所有贡献者。

## Goals
- **G1**：编辑器核心架构升级为 Monaco Editor，完成语法高亮、行号、括号匹配、代码折叠四大基础能力全部启用。
- **G2**：智能补全引擎搭建（关键词（DuckDB 关键字 + 当前数据库表名/列名/函数名的分级提示）。
- **G3**：SQL 格式化引擎（关键字大写/自定义缩进），可配置缩进宽度/关键字大小写风格）。
- **G4**：执行计划（EXPLAIN）可视化面板（类 DBeaver 执行计划树形视图）。
- **G5**：多语句拆分与部分执行（Ctrl+Enter 当前语句，Ctrl+Shift+Enter 全语句），查询变量/参数绑定 UI。
- **G6**：错误行号定位（错误信息高亮显示错误位置，编辑器内红色波浪线）。
- **G7**：SQL 片段/模板库（常用查询可保存为片段/模板复用，支持分类/搜索/插入）。
- **G8**：与现有架构无破坏性变更（保留现有 execute_sql 命令与 cache 逻辑，不改变 commands/services 层保持不变）。

## Non-Goals (Out of Scope)
- ❌ **不做云服务化（保持本地轻量定位不变。
- ❌ **不做多用户协作系统。
- ❌ **不做自然语言提问（NL → SQL）
- ❌ **不引入 Python/R 脚本扩展。
- ❌ **不修改 tier-1 文件（本 spec 仅为规划阶段，不直接产生代码改动除新增文件）。
- ❌ **不写测试（本 spec 不包含实现阶段的测试。
- ❌ **不做可视化 Query Builder（拖拽条件拼接 SQL 下拉过滤在产品路线图 G-07 已规划，非本 spec 范围）。
- ❌ **不做 DataGrip 级别的数据库对象浏览器（本项目已有 components/common/DatabaseExplorer.tsx 已有，但这是独立功能，非编辑器本身）。

## Background & Context
- **项目现状**：QuickerSQL v14.1，Tauri (Rust) + React 桌面应用，SQLite + DuckDB 的本地数据分析引擎。
- **当前编辑器组件**：[SQLEditor.tsx](file:///e:/LA_DUCK/la-duck/src/components/sql/SQLEditor.tsx) — 136 行代码，纯 `<textarea>` 实现，无任何 IDE 能力。
- **已具备的 package.json 依赖**：`@monaco-editor/react: "^4.6.0`（已安装，未实际使用）。
- **已具备的 SQL 执行命令**：[commands/sql.rs](file:///e:/LA_DUCK/la-duck/src-tauri/src/commands/sql.rs) `execute_sql` + `SqlExecutionService::execute_sql_batch`，已有多语句拆分、参数化查询、缓存命中短路、写操作失效、写操作缓存失效全部下沉到 service 层。
- **已具备的 SQL 执行服务**：[services/sql_service.rs](file:///e:/LA_DUCK/la-duck/src/services/sql_service.rs) — 164 passed, 0 failed）。
- **已具备的查询历史**：[components/query-history](file:///e:/LA_DUCK/la-duck/src/components/query-history) + `__query_history` 表。
- **已具备的数据库对象浏览**：[DatabaseExplorer.tsx](file:///e:/LA_DUCK/la-duck/src/components/common/DatabaseExplorer.tsx) 表名、列名查询能力已有（表名/列名可直接用于补全引擎的数据源）。
- **技术约束**：遵循 architecture.md：commands 层不直接写 SQL；SQL 文本不能拼 SQL 层不写 SQL；SQL 文本 SQL 在 components 不 SQL 查询缓存 service 层做参数化查询为唯一合法路径（security.md 安全为唯一合法写路径SQL 路径为唯一合法的 SQL 表必须以 `__` 开头。
- **产品定位强化**：本地单用户 · 零部署 · 零学习门槛 · 轻量但功能完善的个人数据工作台。

## 对标商业 SQL IDE 功能对比（当前编辑器 vs 商业 IDE 功能对比表

| **能力维度** | **当前 QuickerSQL v14.1 | **DBeaver** | **DataGrip** | **TablePlus** | **DuckDB Studio | **本 spec 目标** |
|---|---|---|---|---|---|---|
| 语法高亮（关键字/函数/字符串） | ❌ 无 | ✅ 全高亮 | ✅ 全高亮 | ✅ 全高亮 | ✅ 全高亮 | ✅ **实现 |
| 行号显示 | ❌ 无 | ✅ 显示 | ✅ 显示 | ✅ 显示 | ✅ 显示 | ✅ 实现 |
| 括号匹配与自动补全 | ❌ 无 | ✅ 括号自动闭合 | ✅ 自动闭合 + 跳转 | ✅ 自动闭合 | ✅ 括号匹配 | ✅ 实现 |
| 代码折叠 | ❌ 无 | ✅ 折叠块 | ✅ 折叠块 | ⚠️ 基础 | ✅ 折叠块 | ✅ 实现 |
| 智能补全（关键字） | ❌ 无 | ✅ 关键字表名列名函数 | ✅ 智能上下文感知 | ✅ 基础 | ✅ 关键字/表名列名函数 | ✅ 实现（P1 |
| 智能补全（表名/列名 | ❌ 无 | ✅ 实时感知上下文敏感 | ✅ 上下文感知 | ✅ 基础 | ✅ 基础 | ✅ 实现 |
| 智能补全（函数名） | ❌ 无 | ✅ 函数签名 | ✅ 函数签名提示 | ✅ 基础 | ✅ 函数名 | ✅ 实现 |
| SQL 格式化/美化 | ❌ 无 | ✅ 可配置缩进宽度 | ✅ 可配置多种风格 | ✅ 美化按钮 | ✅ 格式化 | ✅ 实现 |
| 执行计划 EXPLAIN | ❌ 无 | ✅ 树形/成本估算 | ✅ 树形/可视化 | ✅ 基础执行 | ✅ 基础 | ✅ 实现（树形视图） |
| 查询变量/参数绑定 | ❌ 无 | ✅ `?`/`:name` 弹窗输入 | ✅ 参数化查询 | ✅ ? 参数 | ✅ 基础 | ✅ 实现 |
| 多语句拆分执行 | ✅ 已有（service 层） | ✅ 分号分隔 | ✅ 多语句批量执行 | ✅ 多语句 | ✅ 多语句 | ✅ 增强（当前语句/全语句快捷键） |
| 错误行号定位 | ❌ 无 | ✅ 行号列提示 | ✅ 精确位置提示 | ✅ 错误位置 | ✅ 错误位置行号 | ✅ 实现（编辑器内波浪线） |
| 多标签编辑 | ✅ 已有（SqlQueryPage 是单标签，但 Workspace Tabs） | ✅ 多标签 | ✅ 多标签 | ✅ 多标签 | ✅ 多标签 | ✅ 复用（已有 Workspace Tabs） |
| Ctrl+Enter 执行当前语句 | ❌ 无 | ✅ Ctrl+Enter | ✅ Ctrl+Enter | ✅ Ctrl+Enter | ✅ Ctrl+Enter | ✅ 实现 |
| SQL 片段/模板库 | ❌ 无 | ✅ 片段保存/搜索/分类 | ✅ 片段库 | ✅ 片段管理 | ✅ 基础保存 | ✅ 实现（独立面板） |
| 编辑器主题（暗色/亮色） | ✅ 已有（全局主题） | ✅ 多种主题 | ✅ Darcula 等 | ✅ 多种主题 | ✅ 多种主题 | ✅ 增强（Monaco 主题自适应全局主题） |
| 搜索/替换（正则） | ❌ 无（textarea 原生） | ✅ 高级搜索 | ✅ 高级搜索替换 | ✅ 基础搜索 | ✅ 基础搜索 | ✅ 实现（Monaco 内置） |
| 查询历史收藏/检索 | ✅ 已有（QueryHistory） | ✅ 历史收藏 | ✅ 历史收藏 | ✅ 历史收藏 | ✅ 历史收藏 | ✅ 复用与已有） |
| 大 SQL 结果分页 | ✅ 已有（QueryResult.tsx） | ✅ 分页/大结果 | ✅ 分页结果表格 | ✅ 分页 | ✅ 分页结果 | ✅ 复用已有） |
| 导出结果导出 | ✅ 已有（useQueryExport） | ✅ 导出多种格式 | ✅ 导出多种格式 | ✅ 基础导出 | ✅ 基础导出 | ✅ 复用（复用已有） |

### 差距小结：**当前编辑器在 18 个维度中仅 5 个（多语句拆分、查询历史、结果分页、主题、导出 5 个基本能力，但这些是独立于编辑器组件的基础设施已有；其余 13 个维度为 editor组件内直接在 service 层已有，但在编辑器组件本身上下功夫，需要升级。

## Functional Requirements（编辑器核心能力升级清单）

### FR-1：Monaco Editor 核心编辑器核心基础能力
- **FR-1.1（关键字、行号、括号匹配、代码折叠、智能缩进、自动闭合括号、引号等、大括号等全功能启用 Monaco Editor（`@monaco-editor/react` 4.6.0 已安装，核心编辑器核心编辑器核心组件）。
- **FR-1.2 编辑器主题**：Editor theme 主题自适应全局主题（dark/light）。
- **FR-1.3 编辑器字号/行号/当前行高亮/迷你地图（Minimap）/代码折叠/括号匹配/自动闭合引号等编辑器内部设置从 Settings 读取。
- **FR-1.4 编辑器快捷键**：
  - `Ctrl+Enter` 执行当前光标所在语句（或选中）
  - `Ctrl+Shift+Enter` 执行全部 SQL 文本
  - `Ctrl+S` 保存当前查询（写入查询历史
  - `Ctrl+/` 切换行注释
  - `Ctrl+Shift+/` 切换块注释
  - `Tab` / `Shift+Tab` 缩进/反缩进
  - `Ctrl+F` 搜索（Monaco 内置）
  - `Ctrl+H` 替换（Monaco 内置）

### FR-2：智能补全引擎
- **FR-2.1 关键字补全**：SQL 关键字（SELECT FROM WHERE GROUP BY ORDER BY JOIN HAVING LIMIT OFFSET UNION INSERT UPDATE DELETE CREATE TABLE ALTER TABLE DROP TABLE VIEW INDEX etc.）
- **FR-2.2 表名补全**：当前数据库中所有表名（通过现有 table 系统表过滤掉，用户表仅当在用户表名）
- **FR-2.3 列名补全**：当用户表名列名列名列名列名列列列名在 `table 表名在 FROM JOIN 语句中列名自动提示

- **FR-2.4 函数名补全**：DuckDB 内置函数名（SUM AVG COUNT MIN MAX ROUND COALESCE CAST DATE 列名提示）
- **FR-2.5 上下文感知补全**：根据光标位置在 SELECT 后的关键字名时，光标在表名后，按光标在表名，当光标在表表列时，只提示补全

### FR-3：SQL 格式化/美化引擎
- **FR-3.1 格式化按钮**：工具栏"格式化"按钮 + 右键菜单"格式化 SQL"
- **FR-3.2 格式化规则**：关键字大写/小写/首字母大写可配置（设置读取自 Settings 读取）
- **FR-3.3 缩进宽度**：2/4/8 空格可配置（从 Settings 读取）
- **FR-3.4 逗号位置**：行首/行尾可配置
- **FR-3.5 对齐风格**：左对齐/右对齐可配置
- **FR-3.6 格式化算法**：纯前端 TS 实现（不依赖外部 API），参考 sql-formatter 等开源实现

### FR-4：执行计划（EXPLAIN）面板
- **FR-4.1 EXPLAIN 命令**：新建 `execute_explain` 后端命令，对 SELECT 语句运行 `EXPLAIN SELECT ...` 并返回解析树
- **FR-4.2 执行计划树形视图**：类 DBeaver 的树形节点（operation/table/filter/aggregate/join 等）展示
- **FR-4.3 成本估算显示**：显示每个节点的行估算、成本估算
- **FR-4.4 执行计划按钮**：工具栏"执行计划"按钮（与"执行"并列）
- **FR-4.5 执行计划面板**：在编辑器下方或独立面板显示执行计划

### FR-5：错误行号定位
- **FR-5.1 行号映射**：解析 DuckDB/SQLite 返回的错误信息中提取行号/列号（如有）
- **FR-5.2 编辑器内高亮显示**：在错误行以红色波浪线 + 悬浮提示错误信息
- **FR-5.3 错误信息面板**：在编辑器显示完整错误信息，点击跳转定位到错误行
- **FR-5.4 多错误位置自动定位光标到错误位置首行

### FR-6：查询变量/参数绑定 UI
- **FR-6.1 参数识别**：识别 SQL 中的 `?` 或 `:variable_name` 两种参数风格
- **FR-6.2 参数输入面板**：弹出参数输入对话框，对每个参数输入值
- **FR-6.3 参数值持久化**：参数值保存到查询历史或临时缓存
- **FR-6.4 参数化查询调用**：通过 SqlExecutionService::execute_sql_batch 参数化查询调用（`?`作为参数占位符传递给 service 层（与现有参数化查询机制无缝集成

### FR-7：SQL 片段/模板库
- **FR-7.1 片段 CRUD**：新建 `__sql_snippets` 系统表（片段名/分类/描述/内容/创建时间/最后修改时间
- **FR-7.2 片段管理面板**：片段列表/搜索/分类/编辑/删除/插入到编辑器光标位置
- **FR-7.3 片段分类**：支持用户定义分类（如"常用查询"/"聚合"/"日期函数"/"数据清洗"等）
- **FR-7.4 预置模板**：内置常用 SQL 模板（如 "SELECT TOP N、"GROUP BY 分组汇总"、"JOIN 连接查询"、"CREATE TABLE 建表"等
- **FR-7.5 片段快捷键**：Ctrl+Shift+L 打开片段库面板

### FR-8：与现有架构集成
- **FR-8.1 commands 层零破坏性变更**：保留现有 execute_sql 命令与 cache 逻辑，不修改现有缓存逻辑不变
- **FR-8.2 与 Workspace Tabs 集成**：每个编辑器实例复用 Workspace Tabs，在多标签编辑能力已有
- **FR-8.3 与查询历史集成**：已有的查询历史保存、收藏、搜索、清理功能保留不变
- **FR-8.4 与设置集成**：编辑器配置（缩进、关键字大小写、主题等保存到 Settings

### FR-9：后端新增命令
- **FR-9.1 execute_sql 命令**：保留原有 `execute_sql`（保持不变
- **FR-9.2 execute_explain**：新 `execute_explain(sql: String) -> Result<ApiResponse<ExplainPlan>, String>`：对 SQL 做 EXPLAIN 返回解析树
- **FR-9.3 get_sql_completion_items**：新建 `get_sql_completion_items(context: "tables"/"columns"/"functions"/"keywords") -> Result<ApiResponse<CompletionItem[]>, String>`：返回补全项列表（表名列名函数名关键字

## Non-Functional Requirements
- **NFR-1（性能**：编辑器打开 1MB SQL 文件不卡顿（Monaco 原生支持大文件）
- **NFR-2（安全）**：SQL 文本禁止在前端拼接（security.md §2 禁止前端不允许在前端拼接 SQL 文本，所有 SQL 文本从编辑器用户输入的 SQL 文本是用户输入的字符串，不做任何修改直接传递给 commands/sql.rs 参数化查询执行
- **NFR-3（可维护）**：新增的 SQL 格式化引擎不依赖外部服务，纯前端 TS 实现
- **NFR-4（可访问性）**：补全引擎性能：打开编辑器 1 秒内响应
- **NFR-5（兼容性）**：不改变现有 execute_sql 命令签名，保持向后兼容

## Constraints
- **Technical**：保留 Tauri (Rust) + React + SQLite + DuckDB 的技术栈不变
- **Business**：本地单用户
- **Compliance**：不引入外部 API Key，不联网收集用户数据
- **Dependencies**：实施阶段只引入 `sql-formatter`（或等价纯 TS 实现的 SQL 格式化库，不引入重型依赖

## Assumptions
- 典型 SQL 编辑器场景：日常 SQL 开发人员，熟悉 SQL 语法
- 不引入付费组件（Monaco Editor MIT License 已在 MIT 免费
- 补全数据来源：当前数据库的表名/列名通过现有 `get_table_meta / list_databases 等命令获取，关键字内置函数名不引入数据库
- 错误信息行号：DuckDB 返回的错误信息已包含行号/位置

## Acceptance Criteria（验收标准，必须每项可验证）

### AC-1：编辑器基础能力（Monaco Editor 升级

| # | 验收项 | 验证方式 | 通过标准 | 门禁命令 |
|---|---|---|---|---|
| AC-1.1 | Monaco Editor 成功渲染 | programmatic | `npx tsc --noEmit 0 errors | `Get-ChildItem -Path src/components/sql/SQLEditor.tsx 中包含 `MonacoEditor/` imports |
| AC-1.2 | 语法高亮显示 | human-judgment | 打开 SQL 编辑器，SELECT/FROM/WHERE/AND 关键字有不同颜色 | 打开编辑器，输入 `SELECT * FROM users WHERE id = 1` 关键字高亮正确 |
| AC-1.3 | 行号显示 | human-judgment | 编辑器左侧显示数字行号 | 打开编辑器，有行号 |
| AC-1.4 | 括号匹配高亮 | human-judgment | 光标在 `(` 或 `)` 旁高亮对应 `(` 对匹配 | 输入 `SELECT (a + b) * c` 时括号高亮正确匹配 |
| AC-1.5 | 代码块折叠 | human-judgment | 长 SQL 的 BEGIN/END 或 SELECT 子句可折叠/展开 | 输入多行 SQL 时出现折叠按钮 |
| AC-1.6 | 自动闭合括号引号 | human-judgment | 输入 `(` 自动补 `)`；输入 `'` 自动补 `'` |
| AC-1.7 | Ctrl+Enter 执行当前语句 | human-judgment | 光标在一条 SELECT 语句内按 Ctrl+Enter，仅执行该语句 | 打开编辑器，输入多语句 SQL，光标在中间语句按 Ctrl+Enter，仅执行该语句 |
| AC-1.8 | Ctrl+Shift+Enter 全语句执行 | human-judgment | 按 Ctrl+Shift+Enter执行全部 SQL | 光标在任意位置按全执行全部 SQL |
| AC-1.9 | Ctrl+/ 行注释切换 | human-judgment | 光标在一行上按 Ctrl+/，该添加 -- 注释 | 输入 `SELECT * FROM users` 光标在 SELECT 行，按 Ctrl+/，该行变为 `-- SELECT * FROM users |

### AC-2：智能补全引擎验收

| # | 验收项 | 验证方式 | 通过标准 | 门禁命令 |
|---|---|---|---|---|
| AC-2.1 | 关键字补全 | human-judgment | 输入 `SEL` 提示 `SELECT`；按 Tab 完成 | 打开编辑器输入 `SEL` → 出现 SELECT 等关键字列表 |
| AC-2.2 | 表名补全 | human-judgment | 数据库中有 `users` 表时，输入 `FROM u` 提示 `users` | 打开编辑器输入 `FROM u` → 出现 `users` 补全项 |
| AC-2.3 | 列名补全 | human-judgment | `users` 表有 `id/name/email 列，光标在 SELECT 后面时按空格提示 id/name/email | 输入 `SELECT id` → 出现列名列表 |
| AC-2.4 | 函数名补全 | human-judgment | 输入 `SUM(` 提示函数签名参数说明 | 输入 `SUM(` → 出现 SUM 参数提示 `SUM(column)` 说明 |
| AC-2.5 | 上下文感知补全 | human-judgment | `FROM users` 后按空格→ 只提示表名列名不提示关键字 | 输入 `FROM users ` → 出现 users 表列名列名列名列表 |

### AC-3：SQL 格式化/美化

| # | 验收项 | 验证方式 | 通过标准 | 门禁命令 |
|---|---|---|---|---|
| AC-3.1 | 格式化按钮存在 | human-judgment | 工具栏有"格式化"按钮 | 打开编辑器 → 工具栏出现格式化按钮 |
| AC-3.2 | 格式化结果正确 | human-judgment | 输入未格式化 SQL，点击格式化后 SQL 变为整洁格式 | 输入 `select id,name,email from users where id>5 and name='alice'` → 格式化后关键字大写，每子句分行缩进正确 |
| AC-3.3 | 配置读取自 Settings | human-judgment | Settings 中修改缩进宽度从 2 改为 4，再次格式化使用新缩进 | Settings 改缩进宽度后格式化使用新缩进 |

### AC-4：执行计划（EXPLAIN）面板

| # | 验收项 | 验证方式 | 通过标准 | 门禁命令 |
|---|---|---|---|---|
| AC-4.1 | 执行计划按钮存在 | human-judgment | 工具栏有"执行计划"按钮 | 打开编辑器，工具栏显示"执行计划"按钮 |
| AC-4.2 | EXPLAIN 结果显示 | human-judgment | 点击"执行计划"按钮，下方出现执行计划树形视图 | 输入 SELECT 语句 → 点击执行计划 → 出现树形节点 |
| AC-4.3 | 执行计划节点可展开 | human-judgment | 每个节点可展开/折叠 | 树形节点可展开/折叠 |
| AC-4.4 | 执行计划成本显示 | human-judgment | 每个节点显示成本/行数估算 | 树形节点显示成本估算行数 |

### AC-5：错误行号定位

| # | 验收项 | 验证方式 | 通过标准 | 门禁命令 |
|---|---|---|---|---|
| AC-5.1 | 错误信息行号提取 | programmatic | 执行错误 SQL，错误行号被提取 | 输入错误 SQL（如 `SELECT * FROM nonexistent_table` → 错误信息包含行号 |
| AC-5.2 | 编辑器内波浪线显示 | human-judgment | 错误行以红色波浪线标记 | 执行错误 SQL，编辑器错误行红色波浪线 |
| AC-5.3 | 点击错误信息跳转 | human-judgment | 点击错误信息，光标跳转到错误行 | 点击错误信息，光标定位到错误行首 |

### AC-6：查询变量/参数绑定 UI

| # | 验收项 | 验证方式 | 通过标准 | 门禁命令 |
|---|---|---|---|---|
| AC-6.1 | 参数识别 | human-judgment | SQL 中 `?` 或 `:name` 被识别 | 输入 `SELECT * FROM users WHERE id = ?` → 弹出参数输入对话框 |
| AC-6.2 | 参数输入 | human-judgment | 弹出对话框输入参数值，执行返回结果 | 输入参数值 5 → 执行返回 id=5 的行 |
| AC-6.3 | 参数化查询调用 | programmatic | 参数值传递给 service 层参数化查询 | execute_sql_batch 接收到参数 `?` 替换为参数值，通过参数化查询 |

### AC-7：SQL 片段/模板库

| # | 验收项 | 验证方式 | 通过标准 | 门禁命令 |
|---|---|---|---|---|
| AC-7.1 | 片段 CRUD 功能完整 | programmatic | 新建/编辑/删除/搜索/分类 | 片段面板 CRUD 功能完整 |
| AC-7.2 | 片段插入到编辑器 | human-judgment | 选中片段点击"插入到编辑器" → 片段内容插入到光标位置 | 片段插入后编辑器光标位置插入片段 SQL |
| AC-7.3 | 预置模板存在 | human-judgment | 打开片段库面板有预置 10 个常用 SQL 模板 | 片段库面板有预置"常用查询"等分类 |
| AC-7.4 | 片段分类 | human-judgment | 片段可按分类浏览与搜索 | 片段分类下拉框选择分类后过滤显示对应分类片段列表 |
| AC-7.5 | `__sql_snippets` 系统表存在 | programmatic | 系统表创建成功 | `SELECT name FROM sqlite_master WHERE type='table' AND name='__sql_snippets'` 返回行 |

### AC-8：架构兼容性

| # | 验收项 | 验证方式 | 通过标准 | 门禁命令 |
|---|---|---|---|---|
| AC-8.1 | commands 层零破坏性变更 | programmatic | 现有 execute_sql 命令签名不变 | `grep "execute_sql` `commands/sql.rs` 签名保持不变 |
| AC-8.2 | 查询历史集成 | programmatic | 原有查询历史功能不变 | 打开查询历史面板功能正常 |
| AC-8.3 | 与 Workspace Tabs 集成 | human-judgment | 多标签编辑正常 | Workspace Tabs 切换不同查询标签编辑器不同编辑器实例正常 |
| AC-8.4 | 设置集成 | human-judgment | 编辑器配置（缩进/主题等保存到 Settings 后读取正常 | Settings 修改缩进宽度/主题/关键字大小写等设置持久化 |
| AC-8.5 | 编译门禁 | programmatic | `cargo check --quiet` 通过，cargo test 通过，`npx tsc --noEmit 通过 | 全部通过，0 errors |
| AC-8.6 | 安全门禁 | programmatic | `Get-ChildItem -Path src,src-tauri/src -Include *.ts,*.tsx,*.rs -Recurse | Select-String -Pattern 'sk-\|Bearer \|ghp_|eyJ\|password:|PRIVATE KEY' | Select-Object Count = 0 |

## Open Questions（待产品决策，在实施前确认）

| # | 问题 | 建议决策 | 说明 |
|---|---|---|---|
| Q1 | Monaco Editor vs CodeMirror 6 | ✅ Monaco Editor（已安装 @monaco-editor/react 4.6.0 | Monaco Editor 功能强大，VS Code 同款编辑器内核；CodeMirror 6 更轻但更简单但功能较弱，决定使用 Monaco）| 已安装 Monaco |
| Q2 | SQL 格式化库选择 | 内置自写轻量级 TS 实现 sql-formatter vs 自写轻量实现（不依赖重型依赖 | sql-formatter npm 包（~100KB 已成熟，支持多种 SQL 方言，MIT 协议；推荐使用）|
| Q3 | 补全数据源刷新频率 | ✅ 每次编辑器打开时一次性拉取表名列名函数名列表缓存到前端 store，不频繁 IPC 减少 | 表/列名列表通常变化不频繁 |
| Q4 | 执行计划展示格式 | ✅ DuckDB 的 EXPLAIN 输出解析为树形 JSON 结构 | DuckDB EXPLAIN 输出为文本格式，需要解析为树形结构，解析算法在前端完成，不做后端复杂处理 |
| Q5 | 查询参数风格 | ✅ 同时支持 `?` 和 `:name` 两种风格 | DuckDB 原生支持 `?` 参数，`:name` 风格在前端替换为 `?` 后传递给后端 |
| Q6 | SQL 片段系统表命名 | ✅ `__sql_snippets` | 遵循 architecture.md §3 系统表必须以 `__` 开头 |
| Q7 | 编辑器快捷键冲突 | ✅ 复用现有 Settings 中 editor 相关设置项（autoSave、saveInterval 等 | 不新增 Settings 项，复用现有设置架构) |
| Q8 | 多标签编辑器实例 | ✅ 复用已有 Workspace Tabs（`src/components/workspace/WorkspaceTabs.tsx 已有多标签架构，每标签一个编辑器实例 | 不必从零开始 |

---

# 附录 A：功能优先级矩阵（实施顺序建议）

## P0 · 核心能力（必须先完成）

| 顺序 | 功能 | 说明 | 为什么是 P0 |
|------|------|------|-----------|
| 1 | Monaco Editor 基础替换 textarea + 语法高亮/行号/括号匹配/代码折叠 | 基础中的基础 | 所有其他功能都依赖此 | 没有这个就不用谈其他 |
| 2 | Ctrl+Enter 当前语句执行 + Ctrl+Shift+Enter 全语句执行 | 最常用的快捷键之一 | 重度 SQL 用户每天用 |
| 3 | 智能补全（关键字+表名列名列名列名列名列名列 | 最核心效率提升功能 | 没有补全就不是 IDE |
| 4 | 错误行号定位 | 提升调试效率大幅提升 | 不做这个就等于让用户体验太差 |

## P1 · 增强能力（P0 完成后立即推进）

| 顺序 | 功能 | 说明 | 为什么是 P1 |
|------|------|------|-----------|
| 5 | SQL 格式化/美化 | 让 SQL 代码整洁可读 | 重度用户日常使用 |
| 6 | 执行计划（EXPLAIN）面板 | 让用户理解查询性能分析查询优化 | 专业 SQL 工具标，用户天天写复杂查询必用 |
| 7 | 查询变量/参数绑定 UI | 参数化查询体验提升 | 避免反复修改 WHERE 条件 |
| 8 | SQL 片段/模板库 | 常用查询复用减少重复编写 | 重度用户常用查询节省时间 |
| 9 | 编辑器设置持久化到 Settings | 缩进宽度/关键字大小写等 | 让编辑器可配置 |

## P2 · 锦上添花（P0/P1 完成后按需推进）

| 顺序 | 功能 | 说明 |
|------|------|------|
| 10 | 迷你地图（Minimap） | Monaco 内置，默认开启 |
| 11 | 当前行高亮 | Monaco 内置，默认开启 |
| 12 | 高级搜索/替换（正则） | Monaco 内置，默认开启 |
| 13 | 多光标编辑（Ctrl+Alt+Up/Down） | Monaco 内置 |
| 14 | 括号跳转（Ctrl+Bracket） | Monaco 内置，默认开启 |
| 15 | SQL 片段快捷键（Ctrl+Shift+L） | 打开片段库面板快捷键 |

---

# 附录 B：文件变更清单（建议路径）

## 前端文件（前端层 · 组件/Store/Service）

| 文件路径 | 变更类型 | 说明 |
|-----------|----------|------|
| `src/components/sql/SQLEditor.tsx` | ⚠️ **重构**（从 textarea → Monaco Editor 替换） | 从 `<textarea>` 全部替换为 `@monaco-editor/react` 的 `<MonacoEditor` 组件；新增智能补全、格式化、执行计划、错误定位等功能 |
| `src/components/sql/QueryResult.tsx` | ✅ 保留（零修改或最小改动） | 复用现有的查询结果表格，不做改动 |
| `src/components/sql/SqlQueryPage.tsx` | ⚠️ 增强 | 增强工具栏按钮（执行/格式化/执行计划）；保留现有分隔线布局 |
| `src/components/sql/SnippetLibrary.tsx` | 🆕 **新建** | SQL 片段/模板库管理面板（CRUD + 搜索 + 分类 |
| `src/components/sql/ExplainPlanPanel.tsx` | 🆕 **新建** | 执行计划（EXPLAIN）面板（树形视图） |
| `src/components/sql/ParameterInputDialog.tsx` | 🆕 **新建** | 查询参数输入对话框 |
| `src/store/sqlEditorStore.ts` | 🆕 **新建** | 编辑器状态管理（补全项缓存/当前查询状态/错误信息等 |
| `src/utils/sqlFormatter.ts` | 🆕 **新建** | SQL 格式化/美化引擎（纯 TS 实现） |
| `src/utils/sqlStatementParser.ts` | 🆕 **新建** | SQL 语句拆分解析器（识别当前光标所在语句/多语句拆分/行号计算 |
| `src/services/tauri.ts` | ⚠️ 增强 | 新增 `executeExplain` / `getSqlCompletionItems` / `saveSqlSnippet` / `getSqlSnippets` / `deleteSqlSnippet` 等 invokeCommand 封装 |
| `src/types/sql.ts` | 🆕 **新建** | SQL 相关类型定义（补全项/执行计划/片段等类型定义 |

## 后端 Rust 文件

| 文件路径 | 变更类型 | 说明 |
|-----------|----------|------|
| `src-tauri/src/commands/sql.rs` | ⚠️ **增强** | 新增 `execute_explain(sql: String)` / `get_sql_completion_items(context: String)` / `save_sql_snippet(name: String, category: String, description: String, sql: String)` / `get_sql_snippets()` / `delete_sql_snippet(id: i64)` 5 个新命令；保留原 `execute_sql` 不改变动 |
| `src-tauri/src/services/sql_service.rs` | ⚠️ 增强 | 新增 `execute_explain(sql: &str)` / `get_completion_items(context: &str)` / `save_snippet(...)` / `get_snippets()` / `delete_snippet(id)`；复用现有 execute_sql_batch 不变 |
| `src-tauri/src/models/sql_snippet.rs` | 🆕 **新建** | SQL 片段模型定义（id/name/category/description/sql/created_at/updated_at） |
| `src-tauri/src/models/completion_item.rs` | 🆕 **新建** | 补全项模型定义（name/kind/detail/documentation） |
| `src-tauri/src/lib.rs` | ⚠️ 增强 | 注册新 commands 注册到 invoke 列表中追加 5 个新 command（execute_explain` / `get_sql_completion_items` / `save_sql_snippet` / `get_sql_snippets` / `delete_sql_snippet`） |

## Tier-1 文件（须遵循 file-lock.md 规范

| 文件路径 | 变更类型 | 说明 |
|-----------|----------|------|
| `src-tauri/src/lib.rs` | ⚠️ **增强（新增 commands 注册** | 在 invoke 列表中追加 5 个新 command（遵循 file-lock.md 规范：修改前必须先完整读取 |

## 零修改文件（保持现有功能不变更不改变）

| 文件路径 | 说明 |
|-----------|------|
| `src-tauri/src/commands/sql.rs | 保留原 `execute_sql` / `get_query_cache_stats` / `configure_query_cache` / `clear_query_cache` 4 个 command 零改动 |
| `src-tauri/src/services/sql_service.rs` | 原 `execute_sql_batch` / `is_all_readonly` / `contains_write_operation` / `split_sql_statements` 函数零改动 |
| `src-tauri/src/models/*.rs` | 除新建 `sql_snippet.rs` + `completion_item.rs两个新增文件以外，其他文件零改动 |
| `src-tauri/src/database/*.rs` | 零改动 |
| `src/components/query-history/index.tsx` | 零改动 |
| `src/components/workspace/WorkspaceTabs.tsx` | 零改动（已有多标签架构保持不变 |
| `src/context/SettingsContext.tsx` | 零改动（复用已有 Settings 架构 |
| `src/store/settingsStore.ts` | 零改动（复用已有 settingsStore 设置架构 |

---

# 附录 C：数据库表设计（SQL 片段系统表）

## `__sql_snippets` 表（SQL 片段/模板库）

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | 片段 ID（主键自增 |
| `name` | TEXT | NOT NULL | 片段名称（如"用户查询"、"销售汇总"等 |
| `category` | TEXT | DEFAULT 'general' | 分类（如"常用查询"/"聚合"/"日期函数"/"数据清洗"等 |
| `description` | TEXT | | 片段描述说明 |
| `sql` | TEXT | NOT NULL | SQL 内容 |
| `is_template` | INTEGER | DEFAULT 0 | 是否为预置模板（0=用户定义，1=预置） |
| `created_at` | TEXT | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| `updated_at` | TEXT | DEFAULT CURRENT_TIMESTAMP | 最后修改时间 |

建表 SQL（在应用启动时 ensure_* 函数中创建）：

```sql
CREATE TABLE IF NOT EXISTS __sql_snippets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    description TEXT,
    sql TEXT NOT NULL,
    is_template INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_snippets_category ON __sql_snippets(category);
CREATE INDEX IF NOT EXISTS idx_snippets_name ON __sql_snippets(name);
```

预置模板（应用首次启动时插入，共约 10 个常用模板）：

| 模板名 | 分类 | SQL 内容 |
|--------|------|-----------|
| 查询所有表 | 常用查询 | `SELECT name FROM sqlite_master WHERE type='table';` |
| 查询表结构 | 常用查询 | `PRAGMA table_info('__tablename');` |
| 分组汇总 | 聚合 | `SELECT column1, SUM(column2) AS total FROM table GROUP BY column1;` |
| 日期范围查询 | 日期函数 | `SELECT * FROM table WHERE date_column BETWEEN '2024-01-01' AND '2024-12-31';` |
| 前 N 行 | 常用查询 | `SELECT * FROM table LIMIT 10;` |
| 空值检查 | 数据清洗 | `SELECT * FROM table WHERE column IS NULL;` |
| 连接查询 | 连接查询 | `SELECT a.*, b.column FROM table_a a JOIN table_b b ON a.id = b.id;` |
| 建表语句 | 数据清洗 | `CREATE TABLE IF NOT EXISTS new_table (id INTEGER PRIMARY KEY, name TEXT);` |
| 插入数据 | 数据清洗 | `INSERT INTO table (column1, column2) VALUES ('value1', 'value2');` |
| 更新数据 | 数据清洗 | `UPDATE table SET column2 = 'new_value' WHERE id = 1;` |

---

# 附录 D：补全项数据源说明

## 补全项来源分层级：

1. **关键字层**：内置 SQL 关键字（SELECT/FROM/WHERE/AND/OR/GROUP BY/ORDER BY/JOIN/LEFT/RIGHT/INNER/OUTER/LIMIT/OFFSET/INSERT/UPDATE/DELETE/CREATE/ALTER/DROP/INDEX/VIEW 等 200+ 关键字

2. **表名层**：当前数据库中所有用户表名（排除 `__` 开头的系统表）通过 `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '__%'` 获取

3. **列名列**：当前光标上下文在 `FROM table_name` 或 `JOIN table_name` 时，通过 `PRAGMA table_info(table_name)` 获取表列名

4. **函数名层**：DuckDB 内置函数名（SUM/AVG/COUNT/MIN/MAX/ROUND/COALESCE/CAST/DATE/TIME/DATETIME 等 100+ 函数名

5. **数据类型层**：INTEGER/TEXT/REAL/BLOB/BOOLEAN/DATE/TIMESTAMP 等

补全项获取策略：

- 首次打开编辑器：一次性从后端拉取表名列名函数名列表缓存到前端 sqlEditorStore，减少 IPC 调用
- 表名列名列表变化（如新建/删除/删除表时，缓存失效并重新拉取）
- 关键字/函数名内置在前端，不做 IPC 调用

---

# 附录 E：SQL 格式化规则配置项

| 设置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `editor.sqlKeywordCase` | string | `'UPPER'` | 关键字大小写：UPPER（大写）/lower（小写）/Capitalize（首字母大写） |
| `editor.sqlIndentWidth` | number | `2` | 缩进宽度：2/4/8 |
| `editor.sqlCommaPosition` | string | `'leading'` | 逗号位置：leading（行首）/trailing（行尾） |
| `editor.sqlAlignStyle` | string | `'left'` | 对齐风格：left（左对齐）/right（右对齐） |

这些设置项保存在 Settings 中，由 SQLEditor 在初始化时读取，格式化时使用。

---

# 附录 F：快捷键完整列表（Monaco Editor 内置 + 自定义）

| 快捷键 | 功能 | 来源 |
|---------|------|--------|
| `Ctrl+Enter` | 执行当前光标所在语句 | 自定义 |
| `Ctrl+Shift+Enter` | 执行全部 SQL 文本 | 自定义 |
| `Ctrl+S` | 保存当前查询到查询历史 | 自定义 |
| `Ctrl+/` | 切换行注释 | Monaco 内置 |
| `Ctrl+Shift+/` | 切换块注释 | Monaco 内置 |
| `Ctrl+F` | 搜索 | Monaco 内置 |
| `Ctrl+H` | 替换 | Monaco 内置 |
| `Ctrl+Shift+L` | 打开 SQL 片段库面板 | 自定义 |
| `Ctrl+Z` | 撤销 | Monaco 内置 |
| `Ctrl+Shift+Z` | 重做 | Monaco 内置 |
| `Ctrl+A` | 全选 | Monaco 内置 |
| `Ctrl+Shift+K` | 删除行 | Monaco 内置 |
| `Ctrl+Shift+\ | 跳转括号 | Monaco 内置 |
| `Tab` / `Shift+Tab` | 缩进/反缩进 | Monaco 内置 |
| `Ctrl+Alt+Up` / `Ctrl+Alt+Down` | 多光标编辑 | Monaco 内置 |

---

# 附录 G：与现有产品路线图的关系

本 spec 涉及产品路线图 G-11（SQL 片段/模板库）在原产品路线图 G-11 的扩展，但超越 G-11 为 P1 级别，位于 M2 里程碑。

本 spec 的 P0 能力（Monaco Editor 基础 + 智能补全 + 错误定位）未在原路线图中规划，属于本 spec 新增的核心升级，对整体产品竞争力提升最大。

建议将本 spec 的 P0 能力提升到 M1 与 G-01/G-02 并行推进，P1 能力在 M1 末或 M2 初。

---

*文档结束· QuickerSQL 产品路线图 v15.0 · SQL 编辑器全面升级 PRD

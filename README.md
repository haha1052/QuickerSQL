# QuickerSQL

> **DuckDB 驱动的桌面 SQL 查询与可视化工具 · v2.3.0**

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Tauri 2](https://img.shields.io/badge/Tauri-2-ffc131)](https://tauri.app/)
[![React 19](https://img.shields.io/badge/React-19-61dafb)](https://react.dev/)
[![Rust](https://img.shields.io/badge/Rust-2021-dea584)](https://www.rust-lang.org/)

QuickerSQL 是一款面向分析师和开发者的桌面端 SQL 工具。内置 **DuckDB** 作为主查询引擎、**SQLite** 作为回退引擎，提供 SQL 编辑、数据浏览、图表可视化、仪表盘和自动化任务等一体化能力。

---

## ✨ 核心特性

- **双引擎架构** — DuckDB（列式分析 / 大数据集）+ SQLite（轻量回退）自动路由
- **SQL 编辑器** — Monaco Editor，语法高亮、自动补全、参数化查询
- **数据结果网格** — AgGrid 35，百万级数据流畅滚动，支持排序 / 筛选 / 导出
- **图表可视化** — ECharts 5 驱动，20+ 图表类型，即时预览 + 高级样式编辑
- **仪表盘** — 拖拽式布局，保存图表组合，一键刷新
- **自动化任务** — 定时 SQL / 刷新仪表盘 / 任务依赖链，可视化任务中心
- **多项目管理** — 独立配置文件，快速切换数据源
- **数据导入** — CSV / JSON / Excel 一键导入 DuckDB
- **查询历史 & 收藏片段** — 自动记录、快速复用

---

## 📥 快速开始（用户）

### 下载安装

从 [Releases](https://github.com/haha1052/QuickerSQL/releases) 下载最新版本：

| 平台 | 格式 |
|------|------|
| Windows | `.msi` / `.exe` (NSIS) |
| macOS | `.dmg` |
| Linux | `.AppImage` / `.deb` / `.rpm` |

### 使用流程

```
1. 新建或打开一个项目（.qsdb 配置文件）
2. 切换到 SQL 编辑器，编写查询
3. Ctrl+Enter 执行，右下角切换 DuckDB / SQLite
4. 在结果面板点击"图表"按钮，选择可视化类型
5. 保存图表 → 添加到仪表盘 → 设定自动化任务
```

---

## 🛠️ 开发环境搭建

### 前置要求

| 工具 | 最低版本 | 安装方式 |
|------|---------|---------|
| [Node.js](https://nodejs.org/) | 18+ | `winget install OpenJS.NodeJS.LTS` |
| [Rust](https://www.rust-lang.org/) | 1.70+ | `winget install Rustlang.Rustup` |
| [Tauri 2 系统依赖](https://v2.tauri.app/start/prerequisites/) | — | Windows 需 WebView2（Win11 已内置） |

### 一键启动

```bash
# 1. 克隆仓库
git clone https://github.com/haha1052/QuickerSQL.git
cd QuickerSQL

# 2. 安装前端依赖
npm install

# 3. 启动开发模式（前端热重载 + Rust 后端）
npm run tauri dev
```

### 完整打包

```bash
npm run tauri build
```

产物位置：

```
src-tauri/target/release/bundle/
├── nsis/QuickerSQL_2.3.0_x64-setup.exe   # Windows 安装程序
├── msi/QuickerSQL_2.3.0_x64_en-US.msi    # Windows MSI
├── dmg/                                   # macOS
└── appimage/                              # Linux
```

---

## 📋 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 仅启动前端 Vite 开发服务器 |
| `npm run tauri dev` | Tauri 开发模式（前端 + Rust 后端） |
| `npm run tauri build` | 完整打包发布 |
| `npm run build` | 仅前端构建 |
| `npm run check:rs` | Rust 编译检查 |
| `npm run test` | 前端单元测试 (Vitest) |
| `npm run test:rs` | Rust 单元测试 |
| `npm run e2e` | E2E 测试 (Playwright) |
| `npm run e2e:headed` | E2E 有头模式（便于调试） |
| `npm run e2e:report` | 打开 Playwright 测试报告 |
| `npm run check:i18n` | 硬编码中文字符扫描（i18n 辅助） |

---

## 🏗️ 项目架构

```
QuickerSQL/
├── src/                        # React 前端
│   ├── components/             #   UI 组件（SQL / chart / dashboard / automation / ...）
│   ├── store/                  #   Zustand 状态管理
│   ├── services/               #   Tauri IPC 封装
│   ├── types/                  #   TS 类型定义
│   ├── utils/                  #   纯函数工具
│   ├── context/                #   React Context（Settings / Theme / Locale）
│   ├── App.tsx
│   └── main.tsx
├── src-tauri/                  # Rust 后端
│   ├── src/
│   │   ├── commands/            #   Tauri 命令（接口层）
│   │   ├── services/           #   业务层
│   │   ├── database/           #   数据层（DuckDB + SQLite）
│   │   ├── models/             #   数据结构定义
│   │   ├── utils/              #   Rust 工具
│   │   ├── lib.rs              #   命令注册入口
│   │   └── main.rs
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── capabilities/default.json
├── e2e/                        # Playwright E2E 测试
├── scripts/                    # 质量检查脚本
├── package.json
├── vite.config.ts
├── vitest.config.ts
└── README.md
```

**分层原则**：后端 `commands → services → database` 单向调用，SQL 只能在 `database/` 层出现；前端 `components → store → services` 单向依赖，组件禁止直接调用 `invoke()`。

---

## 🧰 技术栈

| 层级 | 技术 |
|------|------|
| **前端框架** | React 19 + TypeScript 5 |
| **构建** | Vite 7 |
| **状态管理** | Zustand 5 |
| **SQL 编辑器** | Monaco Editor |
| **数据表格** | AgGrid 35 |
| **图表** | ECharts 5 |
| **图标** | Lucide React |
| **桌面框架** | Tauri 2 |
| **查询引擎** | DuckDB 1.x（主） + SQLite 0.32（回退） |
| **序列化** | Serde |
| **测试** | Vitest + Playwright + cargo test |
| **代码质量** | ESLint + cargo clippy + i18n 扫描脚本 |

---

## 🤝 贡献指南

欢迎 PR！以下是快速上手步骤：

```bash
# 1. Fork 并创建特性分支
git checkout -b feat/your-feature

# 2. 保持代码风格，提交前跑完整检查
npm run check:all        # cargo check + vitest
npm run check:i18n       # 硬编码中文扫描
npm run e2e              # E2E 回归

# 3. Push 并发起 Pull Request
git push origin feat/your-feature
```

### PR 自检清单

- [ ] `cargo clippy --all-targets -- -D warnings` 通过
- [ ] `cargo test` 通过
- [ ] `npx tsc --noEmit` 通过
- [ ] `npx vitest run` 通过
- [ ] 没有 `format!` 拼接 SQL（参数化查询）
- [ ] 前后端字段 `snake_case ↔ camelCase` 一致
- [ ] 新增系统表以 `__` 开头

---

## 📝 更新日志

详见 [CHANGELOG.md](CHANGELOG.md)。

---

## 📄 许可证

[MIT License](LICENSE) © 2026 haha1052
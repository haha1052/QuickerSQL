# 构建配置分析与 Inno Setup 打包 Spec

## Overview
- **Summary**: 分析 QuickerSQL 项目当前构建配置存在的问题，评估是否能直接打包为 Inno Setup 安装程序，以及需要修复的问题。
- **Purpose**: 确保项目能够正确打包为标准 Windows 安装程序，满足分发需求。
- **Target Users**: 开发者、运维人员

## Goals
- 分析当前构建配置存在的问题
- 评估打包为 Inno Setup 的可行性
- 提供具体的修复方案和配置建议

## Non-Goals (Out of Scope)
- 实际创建 Inno Setup 脚本文件
- 执行代码签名操作
- 处理应用数据迁移逻辑

## Background & Context
- 当前项目使用 Tauri 2.x 框架
- 目标是打包为标准 Windows 安装程序，交给 Inno Setup 使用
- 已有的构建配置文件包括：tauri.conf.json、package.json、Cargo.toml

## 问题分析

### 问题 1: 版本号不一致（严重）
| 文件 | 当前版本号 | 问题 |
|------|-----------|------|
| tauri.conf.json | "1.1.0" | 根级别配置 |
| package.json | "2.0.0" | 前端配置 |
| Cargo.toml | "0.1.0" | Rust 后端配置 |

**影响**：安装程序版本混乱，用户无法正确判断版本升级。

### 问题 2: bundle.targets 配置不正确（严重）
- 当前配置：`"targets": ["app"]`
- 这只会生成应用目录，不会生成安装程序
- 需要配置为生成可打包的发布目录

### 问题 3: 缺少 Windows 打包配置（中等）
- 缺少 `bundle.windows` 配置
- 缺少代码签名配置（证书、时间戳等）

### 问题 4: 资源文件路径问题（中等）
- `frontendDist` 使用相对路径 "../dist"
- 在不同构建环境下可能存在路径问题

### 问题 5: 应用数据目录（中等）
- 应用运行时需要的数据库文件、配置文件需要正确放置
- 需要确保 Inno Setup 能正确处理用户数据

### 问题 6: 依赖库打包（中等）
- DuckDB 和 SQLite 的依赖库需要确保在发布目录中
- 需要验证所有必要的 DLL 文件都被正确包含

## 修复方案

### FR-1: 统一版本号
所有配置文件中的版本号必须保持一致。

### FR-2: 修改 bundle.targets 配置
配置为生成可打包的发布目录，支持 Inno Setup 打包。

### FR-3: 添加 Windows 打包配置
添加必要的 Windows 打包配置项，包括图标、签名等。

### FR-4: 验证资源文件路径
确保前端资源和后端可执行文件的路径正确。

### FR-5: 验证依赖库打包
确保所有必要的依赖库都被正确包含在发布目录中。

## Acceptance Criteria

### AC-1: 版本号一致
- **Given**: 检查三个配置文件的版本号
- **When**: 查看 tauri.conf.json、package.json、Cargo.toml
- **Then**: 三处版本号完全相同
- **Verification**: `programmatic`

### AC-2: bundle.targets 配置正确
- **Given**: 查看 tauri.conf.json 的 bundle 配置
- **When**: 检查 targets 配置项
- **Then**: 配置支持生成可打包的发布目录
- **Verification**: `programmatic`

### AC-3: 发布目录结构正确
- **Given**: 执行 `npm run tauri build`
- **When**: 检查 `src-tauri/target/release/bundle` 目录
- **Then**: 包含完整的应用文件和依赖库
- **Verification**: `human-judgment`

### AC-4: 应用可正常启动
- **Given**: 从发布目录启动应用
- **When**: 双击可执行文件
- **Then**: 应用正常启动，无缺失依赖错误
- **Verification**: `human-judgment`

## Open Questions
- [ ] 代码签名证书是否已准备好？
- [ ] 目标 Windows 版本是什么？
- [ ] 是否需要支持自动更新功能？

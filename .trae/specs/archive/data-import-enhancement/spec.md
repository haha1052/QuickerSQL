# 数据导入功能增强 Spec

## Why
数据导入界面的拖放功能已失效（注释说"浏览器安全限制"但 Tauri 应用应该支持），且文件格式支持有限（仅 CSV/Excel），需要恢复拖放功能并增加 JSON、Parquet、TXT 文件支持。

## What Changes
- 修复前端拖放功能：使用 Tauri 的文件系统能力处理拖放文件，获取真实路径后调用后端 API
- 后端新增 `load_json` 命令支持 JSON 文件预览和导入
- 后端新增 `load_parquet` 命令支持 Parquet 文件预览和导入（利用 DuckDB 的 Parquet 支持）
- 后端新增 `load_txt` 命令支持文本文件预览和导入
- 前端更新文件选择对话框过滤器，支持新文件格式
- 前端更新文件处理逻辑，根据文件扩展名调用对应的加载函数
- 更新 UI 提示文字，显示支持的所有文件格式

## Impact
- Affected code: `src/components/import/DataImport.tsx`（拖放修复 + 新格式处理）、`src/services/tauri.ts`（新增 API 封装）、`src/types/index.ts`（类型更新）、`src-tauri/src/commands/file.rs`（新增文件加载命令）、`src-tauri/Cargo.toml`（新增 parquet 依赖）

## ADDED Requirements

### Requirement: 拖放文件到导入区域必须正常工作
用户应该能够将外部文件拖放到数据导入界面的中间区域，系统自动识别文件格式并加载预览。

#### Scenario: 拖放 CSV 文件
- **WHEN** 用户将 CSV 文件拖放到导入区域
- **THEN** 文件被自动识别并加载预览
- **AND** 文件出现在导入队列中

#### Scenario: 拖放 Excel 文件
- **WHEN** 用户将 Excel 文件拖放到导入区域
- **THEN** 文件被自动识别并加载所有 Sheet 的预览
- **AND** 文件出现在导入队列中

### Requirement: 支持 JSON 文件格式
系统应该支持 JSON 文件的导入，包括 JSON Lines 和标准 JSON 数组格式。

#### Scenario: 导入 JSON Lines 文件
- **WHEN** 用户选择或拖放 `.jsonl` 文件
- **THEN** 文件被正确解析为表格形式
- **AND** 显示预览数据

#### Scenario: 导入 JSON 数组文件
- **WHEN** 用户选择或拖放 `.json` 文件（数组格式）
- **THEN** 文件被正确解析为表格形式
- **AND** 显示预览数据

### Requirement: 支持 Parquet 文件格式
系统应该支持 Parquet 文件的导入，利用 DuckDB 的 Parquet 读取能力。

#### Scenario: 导入 Parquet 文件
- **WHEN** 用户选择或拖放 `.parquet` 文件
- **THEN** 使用 DuckDB 读取文件并显示预览
- **AND** 导入时使用 COPY 命令快速导入

### Requirement: 支持 TXT 文件格式
系统应该支持纯文本文件的导入，每行作为一条记录，可选分隔符。

#### Scenario: 导入 TXT 文件
- **WHEN** 用户选择或拖放 `.txt` 文件
- **THEN** 文件按行解析，可选分隔符（默认制表符或空格）
- **AND** 显示预览数据

## MODIFIED Requirements

### Requirement: 文件选择对话框支持更多格式
文件选择对话框的过滤器应该包含所有支持的文件格式。

#### Scenario: 打开文件选择对话框
- **WHEN** 用户点击"选择文件"按钮
- **THEN** 对话框显示支持的格式：CSV、Excel、JSON、JSON Lines、Parquet、TXT

## NON-GOALS

- ❌ 不支持 XML 文件格式（需求中未提及）
- ❌ 不支持二进制文件格式（如 Avro、ORC）
- ❌ 不支持压缩文件（如 .gz、.zip）
- ❌ 不修改数据库导入逻辑（保持现有的 COPY/批量插入流程）

## Constraints

- DuckDB 的 Parquet 支持已在 `duckdb` crate 中启用（`bundled` 特性）
- 后端需要新增 `serde_json` 解析 JSON 文件（已存在）
- 前端类型定义需要同步更新

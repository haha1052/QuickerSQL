# Tasks

- [ ] Task 1: 修复前端拖放功能（使用 Tauri API 获取真实文件路径）
  - **Priority**: high
  - **Depends On**: None
  - **Description**: 
    - 修改 `DataImport.tsx` 的 `handleDrop` 函数，不再提示用户使用按钮
    - 使用 Tauri 的文件系统 API 获取拖放文件的真实路径
    - 调用后端 API 加载文件预览
  - **Acceptance Criteria Addressed**: AC-1 (拖放功能)
  - **Test Requirements**:
    - `human-judgment` TR-1.1: 拖放 CSV/Excel 文件到导入区域，文件被正确加载
    - `human-judgment` TR-1.2: 拖放后显示加载动画和预览数据

- [ ] Task 2: 后端新增 JSON 文件加载命令 (`load_json`)
  - **Priority**: high
  - **Depends On**: None
  - **Description**: 
    - 在 `file.rs` 中新增 `load_json` Tauri 命令
    - 支持 JSON Lines 和 JSON 数组两种格式
    - 返回 `CsvPreview` 格式的预览数据
    - 更新 `import_data_v2` 支持 JSON 文件导入
  - **Acceptance Criteria Addressed**: AC-2 (JSON 支持)
  - **Test Requirements**:
    - `programmatic` TR-2.1: `cargo check --quiet` 通过
    - `human-judgment` TR-2.2: JSON 文件能正确预览和导入

- [ ] Task 3: 后端新增 Parquet 文件加载命令 (`load_parquet`)
  - **Priority**: high
  - **Depends On**: None
  - **Description**: 
    - 在 `file.rs` 中新增 `load_parquet` Tauri 命令
    - 使用 DuckDB 读取 Parquet 文件（`SELECT * FROM parquet_scan('file.parquet')`）
    - 返回 `CsvPreview` 格式的预览数据
    - 更新 `import_data_v2` 支持 Parquet 文件导入（利用 DuckDB COPY）
  - **Acceptance Criteria Addressed**: AC-3 (Parquet 支持)
  - **Test Requirements**:
    - `programmatic` TR-3.1: `cargo check --quiet` 通过
    - `human-judgment` TR-3.2: Parquet 文件能正确预览和导入

- [ ] Task 4: 后端新增 TXT 文件加载命令 (`load_txt`)
  - **Priority**: medium
  - **Depends On**: None
  - **Description**: 
    - 在 `file.rs` 中新增 `load_txt` Tauri 命令
    - 支持按行解析，可选分隔符（默认制表符）
    - 返回 `CsvPreview` 格式的预览数据
    - 更新 `import_data_v2` 支持 TXT 文件导入
  - **Acceptance Criteria Addressed**: AC-4 (TXT 支持)
  - **Test Requirements**:
    - `programmatic` TR-4.1: `cargo check --quiet` 通过
    - `human-judgment` TR-4.2: TXT 文件能正确预览和导入

- [ ] Task 5: 前端更新文件格式支持
  - **Priority**: high
  - **Depends On**: Task 2, Task 3, Task 4
  - **Description**: 
    - 在 `tauri.ts` 中添加 `loadJson`、`loadParquet`、`loadTxt` 方法
    - 在 `DataImport.tsx` 中添加对应的加载函数
    - 更新文件选择对话框过滤器，添加新格式
    - 更新 UI 提示文字，显示所有支持的格式
  - **Acceptance Criteria Addressed**: AC-2, AC-3, AC-4, AC-5
  - **Test Requirements**:
    - `programmatic` TR-5.1: `npx tsc --noEmit --pretty` 通过
    - `human-judgment` TR-5.2: 文件选择对话框显示所有支持的格式

- [ ] Task 6: 更新架构现状报告
  - **Priority**: medium
  - **Depends On**: Task 1-5
  - **Description**: 
    - 更新 `docs/架构现状.md` 中数据导入相关章节
    - 记录新增的文件格式支持和拖放功能修复
  - **Acceptance Criteria Addressed**: 文档更新
  - **Test Requirements**:
    - `human-judgment` TR-6.1: 架构文档包含新增功能的描述

- [ ] Task 7: 编译验证与回归测试
  - **Priority**: high
  - **Depends On**: Task 1-5
  - **Description**: 
    - 运行 `cargo check --quiet`
    - 运行 `cargo test --lib`
    - 运行 `npx tsc --noEmit --pretty`
    - 启动应用验证拖放和新格式功能
  - **Acceptance Criteria Addressed**: 所有验证
  - **Test Requirements**:
    - `programmatic` TR-7.1: `cargo check` 通过
    - `programmatic` TR-7.2: `cargo test --lib` 全部通过
    - `programmatic` TR-7.3: `npx tsc` 通过
    - `human-judgment` TR-7.4: 应用启动后拖放和新格式功能正常工作

# Task Dependencies
- Task 5 depends on Task 2, Task 3, Task 4
- Task 6 depends on Task 1-5
- Task 7 depends on Task 1-5

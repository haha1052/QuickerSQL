# Tasks

- [x] Task 1: 修复前端拖放功能
  - **Priority**: high
  - **Depends On**: None
  - **Description**:
    - 诊断 `DataImport.tsx` 中拖放区域事件绑定是否正确
    - 修复 `handleDrop` 获取文件路径的逻辑，确保 Tauri 环境下能读取外部拖放文件路径
    - 确保拖放区域覆盖整个空状态和文件列表区域
    - 测试拖放 CSV/TXT 文件到导入区域
  - **Acceptance Criteria Addressed**: 拖放外部文件到导入区域必须正常工作
  - **Test Requirements**:
    - `human-judgment` TR-1.1: 拖放 CSV 文件到导入区域，文件被正确加载
    - `human-judgment` TR-1.2: 拖放逗号分隔 TXT 文件到导入区域，文件被正确加载

- [x] Task 2: 后端实现 TXT 分隔符自动检测
  - **Priority**: high
  - **Depends On**: None
  - **Description**:
    - 在 `file.rs` 中新增 `detect_delimiter` 函数
    - 候选分隔符：逗号、制表符、分号、竖线
    - 基于文件前 5 行统计，选择产生最多一致列数的分隔符
    - 修改 `load_txt` 命令：未传入分隔符时自动检测
  - **Acceptance Criteria Addressed**: TXT 文件支持分隔符自动检测
  - **Test Requirements**:
    - `programmatic` TR-2.1: `cargo check --quiet` 通过
    - `human-judgment` TR-2.2: 逗号分隔 TXT 被正确解析为多列
    - `human-judgment` TR-2.3: 制表符分隔 TXT 被正确解析为多列

- [x] Task 3: 前端在导入配置面板增加自定义分隔符输入
  - **Priority**: high
  - **Depends On**: Task 2
  - **Description**:
    - 在 TXT 文件的导入配置面板中增加分隔符输入框
    - 输入框默认显示自动检测到的分隔符
    - 用户修改分隔符后，重新调用 `loadTxt` 刷新预览
    - 同步更新 `ImportItem.delimiter`、`fields` 和 `preview`
  - **Acceptance Criteria Addressed**: 用户可手动设置 TXT 文件分隔符
  - **Test Requirements**:
    - `programmatic` TR-3.1: `npx tsc --noEmit --pretty` 通过
    - `human-judgment` TR-3.2: 修改分隔符后预览实时更新

- [x] Task 4: 后端导入逻辑使用自定义分隔符
  - **Priority**: high
  - **Depends On**: Task 2
  - **Description**:
    - 修改 `import_data_v2` 和相关函数，确保 TXT 文件导入时使用 `ImportItem.delimiter`
    - 验证 `load_all_txt_data` 函数接受分隔符参数
    - 验证 `fast_import_csv` 的 COPY 命令正确使用分隔符
  - **Acceptance Criteria Addressed**: 导入时使用自定义分隔符
  - **Test Requirements**:
    - `programmatic` TR-4.1: `cargo check --quiet` 通过
    - `human-judgment` TR-4.2: 使用自定义分隔符导入逗号分隔 TXT 成功

- [x] Task 5: 更新国际化文案
  - **Priority**: medium
  - **Depends On**: Task 3
  - **Description**:
    - 在 `LocaleContext.tsx` 中新增分隔符相关中英文文案
    - 包括：标签"分隔符"、占位符"自动检测"、提示文字
  - **Acceptance Criteria Addressed**: 用户可手动设置 TXT 文件分隔符
  - **Test Requirements**:
    - `programmatic` TR-5.1: `npx tsc --noEmit --pretty` 通过
    - `human-judgment` TR-5.2: 配置面板正确显示中英文分隔符标签

- [x] Task 6: 编译验证与回归测试
  - **Priority**: high
  - **Depends On**: Task 1-5
  - **Description**:
    - 运行 `cargo check --quiet`
    - 运行 `cargo test --lib`
    - 运行 `npx tsc --noEmit --pretty`
    - 启动应用验证拖放和分隔符功能
  - **Acceptance Criteria Addressed**: 所有验证
  - **Test Requirements**:
    - `programmatic` TR-6.1: `cargo check` 通过
    - `programmatic` TR-6.2: `cargo test --lib` 全部通过
    - `programmatic` TR-6.3: `npx tsc` 通过
    - `human-judgment` TR-6.4: 应用启动后拖放和自定义分隔符功能正常工作

# Task Dependencies
- Task 3 depends on Task 2
- Task 4 depends on Task 2
- Task 5 depends on Task 3
- Task 6 depends on Task 1-5

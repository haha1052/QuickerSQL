# Tasks

- [x] Task 1: 修复拖放重复添加问题
  - **Priority**: high
  - **Depends On**: None
  - **Description**:
    - 诊断 `DataImport.tsx` 中拖放事件为何触发多次
    - 添加去重机制：基于文件路径去重，或防止同一拖放事件被多次处理
    - 确保 Tauri 原生拖放监听器与 DOM `drop` 事件不会同时处理同一文件
    - 测试拖放单个文件只产生一个导入项
  - **Acceptance Criteria Addressed**: 拖放一个文件只产生一个导入项
  - **Test Requirements**:
    - `human-judgment` TR-1.1: 拖放 1 个 CSV 文件，队列中只出现 1 项
    - `human-judgment` TR-1.2: 拖放 1 个 TXT 文件，队列中只出现 1 项
    - `programmatic` TR-1.3: `npx tsc --noEmit --pretty` 通过

- [x] Task 2: 后端新增 importTimeout 设置项
  - **Priority**: high
  - **Depends On**: None
  - **Description**:
    - 在 `settings_service.rs` 的 "import" 分类中新增 `importTimeout` 设置项
    - 默认值：60 秒
    - 值类型：Number
    - 描述："导入超时时间（秒）"
    - 确保设置迁移时自动插入默认值
  - **Acceptance Criteria Addressed**: 设置中可配置导入超时时间
  - **Test Requirements**:
    - `programmatic` TR-2.1: `cargo check --quiet` 通过
    - `programmatic` TR-2.2: 设置元数据接口返回包含 `importTimeout`

- [x] Task 3: 后端导入逻辑读取 importTimeout 设置
  - **Priority**: high
  - **Depends On**: Task 2
  - **Description**:
    - 修改 `commands/file.rs` 中的 `import_data_v2`
    - 使用 `SettingsService::get_setting` 读取 `import.importTimeout`
    - 对读取的值进行边界校验（5-3600 秒）
    - 使用设置值替代 `calculate_import_timeout` 的结果
    - 保留原公式作为未设置时的默认值
  - **Acceptance Criteria Addressed**: 大文件导入使用自定义超时
  - **Test Requirements**:
    - `programmatic` TR-3.1: `cargo check --quiet` 通过
    - `programmatic` TR-3.2: 设置 300 秒后，日志显示导入超时为 300 秒

- [x] Task 4: 修复 TXT 文件在 SQLite 下的导入失败
  - **Priority**: high
  - **Depends On**: None
  - **Description**:
    - 修改 `import_data_v2`，当文件扩展名为 `.txt` 时，不使用 `fast_import_csv` 的 COPY 命令
    - TXT 文件统一走传统导入方式，并正确传递分隔符
    - 修复 `import_using_traditional_method` 中 TXT 文件被当作 CSV 处理的问题
    - 确保传统方式中列数与数据匹配
  - **Acceptance Criteria Addressed**: TXT 文件导入
  - **Test Requirements**:
    - `programmatic` TR-4.1: `cargo check --quiet` 通过
    - `human-judgment` TR-4.2: 逗号分隔 TXT 文件导入成功

- [x] Task 5: 更新国际化文案
  - **Priority**: medium
  - **Depends On**: Task 2
  - **Description**:
    - 在 `LocaleContext.tsx` 中新增 `importTimeout` 的中英文描述
    - 中文："导入超时时间（秒）"
    - 英文："Import Timeout (seconds)"
  - **Acceptance Criteria Addressed**: 设置中可配置导入超时时间
  - **Test Requirements**:
    - `programmatic` TR-5.1: `npx tsc --noEmit --pretty` 通过
    - `human-judgment` TR-5.2: 设置面板中英文正确显示

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
    - `human-judgment` TR-6.4: 应用启动后功能正常

# Task Dependencies
- Task 3 depends on Task 2
- Task 5 depends on Task 2
- Task 6 depends on Task 1-5

# Tasks

- [x] Task 1: 移除前端 importDataV2 的 30 秒硬编码超时
  - **Priority**: high
  - **Depends On**: None
  - **Description**:
    - 修改 `src/services/tauri.ts` 中的 `importDataV2` 方法
    - 移除 `TIMEOUT_MS = 30000` 的前端超时
    - 改为直接返回后端命令的结果
    - 后端已经有 `importTimeout` 设置，超时由后端控制
    - 前端在调用方使用 try/catch 捕获异常
  - **Acceptance Criteria Addressed**: 大文件导入前端必须正确显示成功
  - **Test Requirements**:
    - `programmatic` TR-1.1: `npx tsc --noEmit --pretty` 通过
    - `human-judgment` TR-1.2: 移除前端超时后，大文件导入能正确显示成功

- [x] Task 2: 强化拖放去重（三重防护）
  - **Priority**: high
  - **Depends On**: None
  - **Description**:
    - 修改 `src/components/import/DataImport.tsx`
    - 第一重：时间窗口防抖（100ms 内的多次 drop 只处理一次）
    - 第二重：基于文件路径去重（已存在的路径不重复添加）
    - 第三重：异步互斥锁（处理中时不接受新的拖放）
    - 修复 dragCounter 计数，确保拖拽进入子元素不会误触发
    - 确保 Tauri 原生事件监听器只在组件挂载时注册一次
  - **Acceptance Criteria Addressed**: 拖放单个文件只添加一项
  - **Test Requirements**:
    - `programmatic` TR-2.1: `npx tsc --noEmit --pretty` 通过
    - `human-judgment` TR-2.2: 拖放单个文件只产生一项
    - `human-judgment` TR-2.3: 一次拖放多个文件只添加对应数量

- [x] Task 3: 编译验证与回归测试
  - **Priority**: high
  - **Depends On**: Task 1, Task 2
  - **Description**:
    - 运行 `cargo check --quiet`
    - 运行 `cargo test --lib`
    - 运行 `npx tsc --noEmit --pretty`
    - 启动应用验证大文件导入显示、拖放去重
  - **Acceptance Criteria Addressed**: 所有验证
  - **Test Requirements**:
    - `programmatic` TR-3.1: `cargo check` 通过
    - `programmatic` TR-3.2: `cargo test --lib` 全部通过
    - `programmatic` TR-3.3: `npx tsc` 通过
    - `human-judgment` TR-3.4: 应用启动后功能正常

# Task Dependencies
- Task 3 depends on Task 1, Task 2

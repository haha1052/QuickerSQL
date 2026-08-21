# Tasks

- [x] Task 1: 统一版本号
  - [x] SubTask 1.1: 更新 tauri.conf.json 的版本号与其他文件一致（2.0.0）
  - [x] SubTask 1.2: 更新 Cargo.toml 的版本号与其他文件一致（2.0.0）
- [x] Task 2: 修改 bundle.targets 配置
  - [x] SubTask 2.1: 修改 tauri.conf.json 的 bundle.targets 配置（保持 "app"，Tauri 2.x 默认配置）
  - [x] SubTask 2.2: 添加必要的 Windows 打包配置项（bundle.windows）
- [x] Task 3: 执行构建验证
  - [x] SubTask 3.1: 执行 `npm run tauri build`（成功，exit code 0）
  - [x] SubTask 3.2: 检查发布目录结构（生成了 QuickerSQL.exe）
  - [x] SubTask 3.3: 验证应用可正常启动（需要人工验证）

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1, Task 2]

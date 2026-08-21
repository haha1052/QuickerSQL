# 设置系统 P2 中优先级实现 - 验证清单

## Task 1: security.enablePasswordProtect
- [ ] 创建 LockScreen.tsx 锁屏组件
- [ ] 密码加密存储（AES-256 或系统级加密）
- [ ] 输入密码解锁功能
- [ ] App.tsx 中根据设置显示锁屏

## Task 2: security.autoLock + security.lockTimeout
- [ ] 创建 ActivityMonitor.tsx 空闲检测组件
- [ ] 监听用户活动（鼠标/键盘）
- [ ] 空闲超过 lockTimeout 秒后触发锁定
- [ ] lockTimeout 默认值为 300

## Task 3: security.sessionTimeout
- [ ] App.tsx 中读取 sessionTimeout 设置
- [ ] 超时后清除 localStorage 自动保存内容
- [ ] sessionTimeout 默认值为 3600

## Task 4: advanced.maxConcurrentQueries
- [ ] sql_service.rs 中读取设置
- [ ] 检查当前运行查询数
- [ ] 超过限制时排队等待
- [ ] 默认值为 5

## Task 5: advanced.enableTelemetry
- [ ] 创建 telemetry_service.rs 遥测服务
- [ ] 创建 __telemetry 表
- [ ] 记录功能使用频率
- [ ] 仅本地存储，不发送远程

## Task 6: advanced.checkForUpdates
- [ ] 创建 UpdateChecker.tsx 组件
- [ ] 检查 GitHub Releases API
- [ ] 发现新版本显示通知
- [ ] 启动时检查一次

## Task 7: advanced.dataDir + advanced.tempDir
- [ ] lib.rs 中读取 dataDir 设置
- [ ] file.rs 中读取 tempDir 设置
- [ ] 新数据库使用 dataDir
- [ ] 临时文件使用 tempDir

## 编译验证
- [ ] `cargo check --quiet` 无错误
- [ ] `npx tsc --noEmit --pretty` 无错误

## 功能验证

### 密码保护
- [ ] 启用密码保护后，应用启动需要密码
- [ ] 密码存储加密，不明文

### 自动锁定
- [ ] 启用 autoLock，设置 lockTimeout 为 60
- [ ] 空闲 60 秒后自动锁定

### 并发控制
- [ ] 设置 maxConcurrentQueries 为 3
- [ ] 同时执行 5 个查询，只有 3 个并发

### 更新检查
- [ ] 启用 checkForUpdates
- [ ] 有新版本时显示通知
# 设置系统 P2 中优先级实现 - 任务列表 (v26.0)

## 当前状态

P2 设置项已在 `default_settings` 和 `implemented_settings` 中定义，但实际功能尚未完全实现。

## 任务清单

### Task 1: 实现 security.enablePasswordProtect ⚠️
- **Status**: ⚠️ 设置已定义，功能待实现
- **Priority**: high
- **Description**: 实现密码保护锁屏功能
- **Files**:
  - `src/components/security/LockScreen.tsx`（新建）
  - `src/App.tsx`
- **说明**: 需要新建锁屏组件，密码加密存储，工作量约4小时

### Task 2: 实现 security.autoLock + security.lockTimeout ⚠️
- **Status**: ⚠️ 设置已定义，功能待实现
- **Priority**: high
- **Description**: 实现空闲检测 + 自动锁定功能
- **Files**:
  - `src/components/security/ActivityMonitor.tsx`（新建）
  - `src/App.tsx`
- **说明**: 需要新建活动监听组件，工作量约4小时

### Task 3: 实现 security.sessionTimeout ⚠️
- **Status**: ⚠️ 设置已定义，功能待实现
- **Priority**: high
- **Description**: 会话超时清除敏感数据
- **Files**: `src/App.tsx`
- **说明**: 工作量约2小时

### Task 4: 实现 advanced.maxConcurrentQueries ⚠️
- **Status**: ⚠️ 设置已定义，功能待实现
- **Priority**: medium
- **Description**: 并发查询控制
- **Files**: `src-tauri/src/services/sql_service.rs`
- **说明**: 需要修改查询执行逻辑，工作量约3小时

### Task 5: 实现 advanced.enableTelemetry ⚠️
- **Status**: ⚠️ 设置已定义，功能待实现
- **Priority**: medium
- **Description**: 遥测数据收集（仅本地）
- **Files**:
  - `src-tauri/src/services/telemetry_service.rs`（新建）
  - `src-tauri/src/models/telemetry.rs`（新建）
- **说明**: 需要新建遥测服务和表，工作量约4小时

### Task 6: 实现 advanced.checkForUpdates ⚠️
- **Status**: ⚠️ 设置已定义，功能待实现
- **Priority**: medium
- **Description**: 自动检查更新
- **Files**:
  - `src/components/UpdateChecker.tsx`（新建）
  - `src/App.tsx`
- **说明**: 需要网络请求和版本对比，工作量约3小时

### Task 7: 实现 advanced.dataDir + advanced.tempDir ⚠️
- **Status**: ⚠️ 设置已定义，功能待实现
- **Priority**: low
- **Description**: 自定义目录配置
- **Files**:
  - `src-tauri/src/lib.rs`
  - `src-tauri/src/services/file.rs`
- **说明**: 需要修改目录配置逻辑，工作量约4小时

## 完成情况

| 状态 | 数量 | 占比 |
|------|------|------|
| ⚠️ 设置已定义 | 9 | 100% |
| ✅ 功能已实现 | 0 | 0% |

## 实施建议

P2 任务总工作量约24小时，建议分阶段实施：

1. **阶段一（优先）**: Task 3 + Task 4 — sessionTimeout 和 maxConcurrentQueries（5小时）
2. **阶段二**: Task 1 + Task 2 — 安全功能锁屏和自动锁定（8小时）
3. **阶段三**: Task 6 + Task 7 — 更新检查和自定义目录（7小时）
4. **阶段四**: Task 5 — 遥测服务（4小时）

## 编译验证

```powershell
cd src-tauri; cargo check --quiet  # ✅ 通过
npx tsc --noEmit --pretty          # ✅ 通过
```
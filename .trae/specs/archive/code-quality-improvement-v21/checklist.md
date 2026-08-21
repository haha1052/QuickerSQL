# QuickerSQL 代码质量全面提升 v21.0 — Verification Checklist

## 一、架构合规性检查（P0，必须全部通过）

- [ ] 前端组件层无直接调用 Tauri invoke
  - 验证命令：`Get-ChildItem -Path src/components,src/pages -Include *.ts,*.tsx -Recurse | Select-String -Pattern '@tauri-apps/api/core' | Measure-Object`
  - 期望结果：Count = 0

- [ ] 后端 commands 层无 format! 拼接 SQL
  - 验证命令：`Get-ChildItem -Path src-tauri/src/commands -Include *.rs -Recurse | Select-String -Pattern 'format!.*"SELECT|format!.*"INSERT|format!.*"UPDATE|format!.*"DELETE' | Measure-Object`
  - 期望结果：Count = 0

- [ ] models 层无业务逻辑
  - 验证命令：`Get-ChildItem -Path src-tauri/src/models -Include *.rs -Recurse | Select-String -Pattern 'fn .*_service|impl.*Service' | Measure-Object`
  - 期望结果：Count = 0

- [ ] 系统表全部以 `__` 开头
  - 验证命令：`Get-ChildItem -Path src-tauri/src/services -Include *.rs -Recurse | Select-String -Pattern '"__\w+"' | Measure-Object`
  - 期望结果：所有系统表名均为双下划线前缀

---

## 二、安全性检查（P0，必须全部通过）

- [ ] 生产代码无敏感字符串硬编码
  - 验证命令：`Get-ChildItem -Path src-tauri/src,src -Include *.rs,*.ts,*.tsx -Recurse | Select-String -Pattern 'sk-|Bearer |ghp_|eyJ|password:' | Measure-Object`
  - 期望结果：Count = 0

- [ ] 前端生产代码无 SQL 关键字拼接
  - 验证命令：`Get-ChildItem -Path src -Include *.ts,*.tsx -Recurse | Where-Object { $_.FullName -notmatch '__tests__' } | Select-String -Pattern 'SELECT |INSERT |UPDATE |DELETE ' -CaseSensitive:$false | Measure-Object`
  - 期望结果：Count = 0

- [ ] 所有动态表名经 SqlIdentifier 校验
  - 验证方式：代码审查 format! 拼接表名的地方是否都使用了 SqlIdentifier
  - 期望结果：100% 动态表名经过 SqlIdentifier::new() 校验

---

## 三、编译与测试检查（P0，必须全部通过）

- [ ] Rust 编译检查通过
  - 验证命令：`cd src-tauri; cargo check --quiet 2>&1 | Select-Object -Last 5`
  - 期望结果：无 error

- [ ] Rust 单元测试通过
  - 验证命令：`cd src-tauri; cargo test --quiet 2>&1 | Select-Object -Last 10`
  - 期望结果：0 failed

- [ ] TS 类型检查通过
  - 验证命令：`npx tsc --noEmit --pretty 2>&1 | Select-Object -Last 10`
  - 期望结果：0 errors

- [ ] 前端单元测试通过
  - 验证命令：`npx vitest run 2>&1 | Select-Object -Last 10`
  - 期望结果：100% passed

---

## 四、代码规范性检查（P1，应全部通过）

- [ ] 前端生产代码无 any 类型
  - 验证命令：`Get-ChildItem -Path src -Include *.ts,*.tsx -Recurse | Where-Object { $_.FullName -notmatch '__tests__' } | Select-String -Pattern ': any|as any' | Measure-Object`
  - 期望结果：Count = 0

- [ ] 前端生产代码无无注释 console.log
  - 验证命令：`Get-ChildItem -Path src -Include *.ts,*.tsx -Recurse | Select-String -Pattern 'console\.log' | Select-String -NotMatch '//' | Measure-Object`
  - 期望结果：Count = 0

- [ ] 前端生产代码无 @ts-ignore
  - 验证命令：`Get-ChildItem -Path src -Include *.ts,*.tsx -Recurse | Where-Object { $_.FullName -notmatch '__tests__' } | Select-String -Pattern '@ts-ignore' | Measure-Object`
  - 期望结果：Count = 0

- [ ] clippy 警告数量减少 50% 以上
  - 验证命令：`cd src-tauri; cargo clippy --quiet 2>&1 | Select-String -Pattern '^warning' | Measure-Object`
  - 期望结果：Count ≤ 40（基线约 79）

- [ ] 生产代码 unwrap/expect 减少 80% 以上
  - 验证方式：统计非测试模块中的 unwrap/expect 数量
  - 期望结果：减少 80% 以上，剩余均有安全注释

---

## 五、可维护性检查（P2，逐步改进）

- [ ] 获取用户表名逻辑统一到一个公共函数
  - 验证命令：`Get-ChildItem -Path src-tauri/src -Include *.rs -Recurse | Select-String -Pattern 'sqlite_master.*type.*table' | Measure-Object`
  - 期望结果：Count ≤ 1（仅定义处）

- [ ] 前后端字段命名一致（camelCase ↔ snake_case）
  - 验证方式：抽查 models/*.rs 中的 serde rename 与 types/*.ts 中的字段名
  - 期望结果：字段一一对应

- [ ] 关键公共函数有文档注释
  - 验证方式：抽查 services/ 和 store/ 中的公共函数
  - 期望结果：核心函数均有 Rust doc comment 或 JSDoc

---

## 六、文档检查（P1，应全部通过）

- [ ] 架构现状文档版本更新至 v21.0
  - 验证方式：检查 docs/架构现状.md 顶部版本号
  - 期望结果：版本号为 v21.0，日期为当前日期

- [ ] 质量保障章节包含四维评估
  - 验证方式：检查文档第 7 章
  - 期望结果：包含安全性、规范性、架构合规性、可维护性四维度

- [ ] 技术债务清单按优先级分级
  - 验证方式：检查文档中技术债务章节
  - 期望结果：按 P0/P1/P2/P3 分级，每项有位置和影响说明

- [ ] 改进路线图分阶段
  - 验证方式：检查文档中改进路线图
  - 期望结果：至少 4 个阶段，每阶段有明确目标

---

## 七、回归测试（P0，必须全部通过）

- [ ] Toolbar 相关功能正常（打开/保存文件等）
  - 验证方式：手动测试或 E2E 测试
  - 期望结果：功能正常，无报错

- [ ] Parquet 文件预览功能正常
  - 验证方式：手动测试导入 Parquet 文件
  - 期望结果：预览正常显示

- [ ] 数据库表列表显示正确（不含系统表）
  - 验证方式：界面检查表数量和名称
  - 期望结果：仅显示用户表，数量与实际一致

- [ ] SQL 查询执行正常
  - 验证方式：执行几条典型查询
  - 期望结果：结果正确，无报错

- [ ] 仪表盘功能正常
  - 验证方式：打开已有仪表盘
  - 期望结果：图表正常渲染

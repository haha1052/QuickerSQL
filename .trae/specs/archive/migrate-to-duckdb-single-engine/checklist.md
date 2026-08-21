# QuickerSQL DuckDB 单引擎迁移 - 验证检查清单

## 一、环境准备
- [ ] 确认 DuckDB Rust crate 版本正确（1.10502.0）
- [ ] SQLite 数据库文件存在且可访问
- [ ] 完成 SQL 语句梳理清单，列出所有 SQLite 特有语法
- [ ] 迁移日志目录已创建

## 二、参数化查询实现
- [ ] DuckDB execute() 方法正确处理参数化查询
- [ ] DuckDB query() 方法正确处理参数化查询
- [ ] SQLite `?` 占位符自动转换为 DuckDB `$1, $2` 格式
- [ ] 参数类型映射正确（SQLite ToSql → DuckDB ToSql）
- [ ] 单元测试验证参数化查询执行成功
- [ ] 单元测试验证多个参数的查询

## 三、SQLite 特有语法替换
- [ ] `sqlite_master` 查询已替换为 `information_schema.tables` 或 `SHOW TABLES`
- [ ] `PRAGMA table_info()` 已替换为 `DESCRIBE` 或 `information_schema.columns`
- [ ] `PRAGMA index_list()` 已替换为 `SHOW INDEX`
- [ ] `randomblob(16)` 已替换为 `uuid()` 或应用层 UUID 生成
- [ ] `CURRENT_TIMESTAMP` 默认值处理正确（DuckDB 返回 TIMESTAMP 类型）
- [ ] 单元测试验证表列表查询正常工作
- [ ] 单元测试验证列信息查询正常工作

## 四、类型系统适配
- [ ] BOOLEAN 类型转换正确（SQLite INTEGER → DuckDB BOOLEAN）
- [ ] DATETIME 类型转换正确（SQLite TEXT → DuckDB TIMESTAMP）
- [ ] JSON 类型转换正确（SQLite TEXT → DuckDB JSON）
- [ ] 类型转换的降级方案实现（转换失败时使用 TEXT 类型）
- [ ] 单元测试验证 BOOLEAN 类型转换
- [ ] 单元测试验证 DATETIME 类型转换

## 五、系统表迁移
- [ ] DuckDB 版本的系统表 schema 创建完成（12+ 张表）
- [ ] 系统表类型适配完成（BOOLEAN → BOOLEAN, DATETIME → TIMESTAMP）
- [ ] 系统表索引创建完成（与 SQLite 版本一致或更优）
- [ ] 系统表数据迁移脚本执行成功
- [ ] 系统表迁移后记录数与 SQLite 一致
- [ ] 系统表迁移失败时回滚到 SQLite

## 六、用户数据迁移
- [ ] 用户数据表迁移脚本执行成功
- [ ] 用户表类型转换正确（自动检测并转换）
- [ ] 用户表索引迁移完成
- [ ] 用户表迁移后行数与 SQLite 一致
- [ ] 用户数据迁移失败时回滚到 SQLite

## 七、数据验证
- [ ] 迁移后数据验证函数实现
- [ ] 系统表记录数一致性验证通过
- [ ] 用户表行数一致性验证通过
- [ ] 关键数据完整性验证通过（设置值、查询历史等）
- [ ] 验证报告生成完成

## 八、回滚机制
- [ ] 迁移前自动备份功能实现（SQLite → .bak 文件）
- [ ] 系统表迁移失败自动回滚
- [ ] 用户数据迁移失败自动回滚
- [ ] 验证失败自动回滚
- [ ] 手动回滚功能实现（删除 DuckDB 文件触发）
- [ ] 备份文件创建成功验证
- [ ] 各种失败场景回滚测试通过

## 九、连接层重构
- [ ] QueryRouter 移除完成
- [ ] DatabaseManager 直接使用 DuckDB
- [ ] 所有 service 的数据库调用更新完成
- [ ] 连接管理简化（双连接 → 单连接）
- [ ] 错误处理逻辑统一为 DuckDB 错误类型
- [ ] 编译通过，无未使用的代码

## 十、SQLite 代码清理
- [ ] `sqlite.rs` 文件删除
- [ ] `router.rs` 文件删除（如不再需要）
- [ ] `rusqlite` 依赖从 Cargo.toml 移除
- [ ] 所有 SQLite 相关的 import 和 unused code 清理
- [ ] `cargo check --quiet` 通过
- [ ] 无 SQLite 相关代码残留

## 十一、集成测试与回归测试
- [ ] 集成测试编写完成
- [ ] 回归测试编写完成
- [ ] 边界情况测试（空数据库、大数据库、特殊字符等）
- [ ] 回滚机制测试（模拟各种失败场景）
- [ ] 所有集成测试通过
- [ ] 所有回归测试通过

## 十二、性能基准测试
- [ ] 性能基准测试环境设置完成
- [ ] 查询性能测试完成（简单查询、复杂分析查询）
- [ ] 写入性能测试完成（单条写入、批量写入）
- [ ] 查询性能不低于当前双引擎方案
- [ ] 性能对比报告生成完成

## 十三、文档更新
- [ ] `docs/架构现状.md` 更新完成
- [ ] `docs/数据库迁移指南.md` 创建完成
- [ ] `AGENTS.md` 系统表清单更新完成（如果有变化）
- [ ] 文档准确反映当前架构
- [ ] 迁移指南清晰易懂

## 十四、最终验证
- [ ] 应用启动正常，使用 DuckDB 单引擎
- [ ] 所有功能正常工作（设置、查询历史、自动化任务等）
- [ ] 系统表数据完整（迁移后与迁移前一致）
- [ ] 用户数据完整（迁移后与迁移前一致）
- [ ] 查询性能符合预期
- [ ] 回滚机制正常工作

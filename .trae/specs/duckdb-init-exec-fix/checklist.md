# Checklist

- [x] Checkpoint 1: 预加载表名查询与 `router.rs::get_table_names` 使用相同 SQL（不含 `__%` 过滤）
- [x] Checkpoint 2: PRAGMA busy_timeout 使用 `query()` 而非 `execute()`，不再报 "Execute returned results"
- [x] Checkpoint 3: DuckDB `query()` 方法使用 `query_arrow()` 作为主路径，不触发 `stmt.query([])` 的内部 panic
- [x] Checkpoint 4: `cargo check --quiet` 通过
- [x] Checkpoint 5: `cargo test --lib` 全部通过（262/262）
- [x] Checkpoint 6: `npx tsc --noEmit --pretty` 通过
- [x] Checkpoint 7: `SqlStatementResult` 新增 `engine` 字段
- [x] Checkpoint 8: sql_service 中所有结果创建处填入正确的 engine 值
- [x] Checkpoint 9: 前端类型同步更新
- [x] Checkpoint 10: 前端结果标签旁显示引擎徽章

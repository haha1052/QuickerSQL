# Tasks

- [x] Task 1: 修复 QueryResultItem 高度模型
  - [ ] SubTask 1.1: container 使用 flex column + maxHeight 800 + overflow hidden
  - [ ] SubTask 1.2: tableWrapper 改为内容决定高度（移除 flex:1，保留 minHeight 80 与 overflow hidden）
  - [ ] SubTask 1.3: tableContainer 改为内容决定高度但受限（移除 flex:1，保留 maxHeight 680 + overflow auto + minHeight 60）
  - [ ] SubTask 1.4: 保持 AgGridLazy domLayout="autoHeight"，添加 rowBuffer={5}

- [x] Task 2: 修复 QueryResult 滚动链路
  - [ ] SubTask 2.1: container 移除 overflow hidden，保持 flex column + minHeight 200
  - [ ] SubTask 2.2: resultsContainer 使用 flex:1 + minHeight 200 + overflowY auto + overflowX hidden

- [x] Task 3: 编译与性能验证
  - [ ] SubTask 3.1: 运行 `npx tsc --noEmit --pretty` 通过
  - [ ] SubTask 3.2: 运行 `npm run build` 或 `cargo check`（如需要）

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2

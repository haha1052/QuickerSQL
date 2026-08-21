# Fix EXPLAIN QUERY PLAN Display — Checklist

- [x] `should_use_duckdb` strips `EXPLAIN`/`EXPLAIN QUERY PLAN` prefix before keyword analysis
- [x] `EXPLAIN SELECT ... GROUP BY ...` routes to DuckDB
- [x] `EXPLAIN SELECT ... JOIN ...` routes to DuckDB
- [x] `EXPLAIN SELECT * FROM table LIMIT 100` (simple) routes to SQLite with `EXPLAIN QUERY PLAN`
- [x] Frontend uses `EXPLAIN QUERY PLAN` prefix for simple queries, `EXPLAIN` for analytical queries
- [x] QueryPlanTree.tsx exists and renders EXPLAIN results as formatted text/tree
- [x] QueryResultItem detects EXPLAIN results and switches to QueryPlanTree rendering
- [x] Normal SELECT/INSERT/UPDATE results still render as AgGrid tables
- [x] `cargo test` passes (including new router tests)
- [x] `npx tsc --noEmit --pretty` passes with 0 errors
- [x] No other component functionality is affected

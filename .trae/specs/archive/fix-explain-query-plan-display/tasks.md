# Fix EXPLAIN QUERY PLAN Display — Tasks

- [x] Task 1: Fix backend query router for EXPLAIN statements
  - [x] SubTask 1.1: Modify `database/router.rs` `should_use_duckdb` to strip EXPLAIN prefix before keyword analysis
  - [x] SubTask 1.2: Ensure `EXPLAIN SELECT ... GROUP BY ...` routes to DuckDB
  - [x] SubTask 1.3: Ensure `EXPLAIN SELECT * FROM table` (simple) still routes to SQLite
  - [x] SubTask 1.4: Add unit tests for EXPLAIN routing

- [x] Task 2: Adjust frontend explain prefix based on query complexity
  - [x] SubTask 2.1: Add `is_analytical_query` helper in frontend (detects GROUP BY, JOIN, aggregates, etc.)
  - [x] SubTask 2.2: For analytical queries: use `EXPLAIN ` (DuckDB handles it)
  - [x] SubTask 2.3: For simple queries: use `EXPLAIN QUERY PLAN ` (SQLite human-friendly plan)
  - [x] SubTask 2.4: Update `addExplainPrefix` to call the new logic

- [x] Task 3: Create execution plan renderer component
  - [x] SubTask 3.1: Create `src/components/sql/QueryPlanTree.tsx`
  - [x] SubTask 3.2: Detect EXPLAIN/EXPLAIN QUERY PLAN results in QueryResultItem
  - [x] SubTask 3.3: Render EXPLAIN results as pre-formatted text/tree instead of AgGrid
  - [x] SubTask 3.4: Support both SQLite EXPLAIN QUERY PLAN (id/parent/detail columns) and DuckDB EXPLAIN (text plan) formats

# Task Dependencies
- Task 2 depends on Task 1 (routing must be correct first)
- Task 3 depends on Task 2 (need correct EXPLAIN output to render)

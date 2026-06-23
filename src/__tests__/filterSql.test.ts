// M7.3 前端测试：SQL 筛选注入工具 (filterSql.ts)
import { describe, it, expect } from "vitest";
import { applyFiltersToSql, hasActiveFilters } from "../utils/filterSql";
import type { DashboardFilter } from "../types/dashboard";

const textFilter: DashboardFilter = {
  id: "f1",
  field: "name",
  type: "text",
  label: "名称",
  defaultValue: "",
};

const selectFilter: DashboardFilter = {
  id: "f2",
  field: "category",
  type: "select",
  label: "分类",
  options: [{ label: "A", value: "A" }, { label: "B", value: "B" }],
  defaultValue: "",
};

const dateRangeFilter: DashboardFilter = {
  id: "f3",
  field: "created_at",
  type: "date-range",
  label: "创建时间",
  defaultValue: "",
};

describe("applyFiltersToSql", () => {
  it("空 SQL 或无筛选器时原样返回", () => {
    expect(applyFiltersToSql("", {}, [])).toBe("");
    expect(applyFiltersToSql("SELECT * FROM users", {}, [])).toBe(
      "SELECT * FROM users"
    );
  });

  it("空筛选值不生成条件", () => {
    const sql = "SELECT * FROM users";
    const result = applyFiltersToSql(sql, { name: "" }, [textFilter]);
    expect(result).toBe(sql);
  });

  it("text 筛选器生成 LIKE 条件并注入 WHERE", () => {
    const sql = "SELECT * FROM users";
    const result = applyFiltersToSql(sql, { name: "Alice" }, [textFilter]);
    expect(result).toContain("WHERE");
    expect(result).toContain("LIKE '%Alice%'");
  });

  it("select 筛选器单个值生成 = 条件", () => {
    const result = applyFiltersToSql(
      "SELECT * FROM users",
      { category: "A" },
      [selectFilter]
    );
    expect(result).toContain("category = 'A'");
  });

  it("select 筛选器逗号分隔多值生成 IN (...)", () => {
    const result = applyFiltersToSql(
      "SELECT * FROM users",
      { category: "A,B,C" },
      [selectFilter]
    );
    expect(result).toContain("IN ('A', 'B', 'C')");
  });

  it("date-range 筛选器生成 BETWEEN 条件", () => {
    const result = applyFiltersToSql(
      "SELECT * FROM users",
      { created_at: "2024-01-01|2024-12-31" },
      [dateRangeFilter]
    );
    expect(result).toContain(
      "BETWEEN '2024-01-01' AND '2024-12-31'"
    );
  });

  it("date-range 只有起始时生成 >= 条件", () => {
    const result = applyFiltersToSql(
      "SELECT * FROM users",
      { created_at: "2024-01-01|" },
      [dateRangeFilter]
    );
    expect(result).toContain(">= '2024-01-01'");
    expect(result).not.toContain("BETWEEN");
  });

  it("date-range 只有结束时生成 <= 条件", () => {
    const result = applyFiltersToSql(
      "SELECT * FROM users",
      { created_at: "|2024-12-31" },
      [dateRangeFilter]
    );
    expect(result).toContain("<= '2024-12-31'");
    expect(result).not.toContain("BETWEEN");
  });

  it("已有 WHERE 时追加 AND", () => {
    const result = applyFiltersToSql(
      "SELECT * FROM users WHERE active = 1",
      { name: "Alice" },
      [textFilter]
    );
    // 同时保留原条件 AND 新条件
    expect(result).toContain("active = 1");
    expect(result).toContain("AND");
    expect(result).toContain("LIKE");
  });

  it("ORDER BY 之前插入 WHERE", () => {
    const result = applyFiltersToSql(
      "SELECT * FROM users ORDER BY id",
      { name: "Alice" },
      [textFilter]
    );
    expect(result.indexOf("WHERE")).toBeLessThan(result.indexOf("ORDER BY"));
  });

  it("LIMIT 之前插入 WHERE", () => {
    const result = applyFiltersToSql(
      "SELECT * FROM users LIMIT 100",
      { name: "Alice" },
      [textFilter]
    );
    expect(result.indexOf("WHERE")).toBeLessThan(result.indexOf("LIMIT"));
  });

  it("多个筛选器用 AND 组合", () => {
    const result = applyFiltersToSql(
      "SELECT * FROM users",
      { name: "Alice", category: "A" },
      [textFilter, selectFilter]
    );
    expect(result).toContain("AND");
    expect(result).toContain("LIKE");
    expect(result).toContain("= 'A'");
  });

  it("单引号转义防止注入", () => {
    const result = applyFiltersToSql(
      "SELECT * FROM users",
      { name: "O'Brien" },
      [textFilter]
    );
    expect(result).toContain("O''Brien");
    // 不会出现未转义的单引号破坏语法
    expect(result).not.toContain("O'Brien");
  });

  it("数组值走 IN (...) 分支", () => {
    const result = applyFiltersToSql(
      "SELECT * FROM users",
      { category: ["A", "B"] },
      [selectFilter]
    );
    expect(result).toContain("IN ('A', 'B')");
  });

  it("空数组不生成条件", () => {
    const sql = "SELECT * FROM users";
    const result = applyFiltersToSql(
      sql,
      { category: [] },
      [selectFilter]
    );
    expect(result).toBe(sql);
  });
});

describe("hasActiveFilters", () => {
  it("空对象返回 false", () => {
    expect(hasActiveFilters({})).toBe(false);
  });

  it("全空字符串返回 false", () => {
    expect(hasActiveFilters({ a: "", b: "  " })).toBe(false);
  });

  it("任一非空字符串返回 true", () => {
    expect(hasActiveFilters({ a: "", b: "x" })).toBe(true);
  });

  it("非空数组返回 true", () => {
    expect(hasActiveFilters({ a: ["x"] })).toBe(true);
  });

  it("空数组返回 false", () => {
    expect(hasActiveFilters({ a: [] })).toBe(false);
  });

  it("null/undefined 视为空", () => {
    expect(hasActiveFilters({ a: null as any, b: undefined as any })).toBe(false);
  });
});

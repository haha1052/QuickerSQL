import { describe, it, expect } from "vitest";
import formatSql from "../utils/sqlFormatter";

describe("formatSql", () => {
  it("基本 SELECT 语句格式化（关键字大写、换行）", () => {
    const input = "select id, name from users";
    const result = formatSql(input);
    expect(result).toContain("SELECT");
    expect(result).toContain("FROM");
    expect(result.indexOf("SELECT")).toBeLessThan(result.indexOf("FROM"));
    expect(result.split("\n").length).toBeGreaterThan(1);
  });

  it("多列 SELECT 格式化（逗号后换行）", () => {
    const input = "select id, name, email, age from users";
    const result = formatSql(input);
    const lines = result.split("\n");
    expect(lines.length).toBeGreaterThan(4);
    expect(lines[0]).toContain("SELECT");
    expect(lines[0]).toContain("id");
    expect(lines[1]).toContain("name");
    expect(lines[2]).toContain("email");
    expect(lines[3]).toContain("age");
  });

  it("WHERE 条件格式化", () => {
    const input = "select * from users where age > 18 and status = 'active'";
    const result = formatSql(input);
    expect(result).toContain("WHERE");
    expect(result).toContain("AND");
    expect(result.indexOf("WHERE")).toBeLessThan(result.indexOf("AND"));
    const whereLine = result.split("\n").find((line) => line.includes("WHERE"));
    expect(whereLine).toBeDefined();
  });

  it("JOIN 语句格式化", () => {
    const input =
      "select * from users left join orders on users.id = orders.user_id";
    const result = formatSql(input);
    expect(result).toContain("JOIN");
    expect(result).toContain("ON");
    expect(result.indexOf("JOIN")).toBeLessThan(result.indexOf("ON"));
    const lines = result.split("\n");
    const joinLine = lines.find((line) => line.trim().startsWith("JOIN"));
    const onLine = lines.find((line) => line.trim().startsWith("ON"));
    expect(joinLine).toBeDefined();
    expect(onLine).toBeDefined();
  });

  it("GROUP BY / ORDER BY 格式化", () => {
    const input =
      "select category, count(*) from products group by category order by count(*) desc";
    const result = formatSql(input);
    expect(result).toContain("GROUP BY");
    expect(result).toContain("ORDER BY");
    expect(result.indexOf("GROUP BY")).toBeLessThan(result.indexOf("ORDER BY"));
  });

  it("子查询缩进", () => {
    const input =
      "select * from (select id, name from users where age > 18) as sub where name like 'A%'";
    const result = formatSql(input);
    const lines = result.split("\n");
    const innerSelectLine = lines.find(
      (line, idx) =>
        line.includes("SELECT") &&
        idx > 0 &&
        lines.slice(0, idx).some((l) => l.includes("FROM"))
    );
    expect(innerSelectLine).toBeDefined();
    expect(innerSelectLine?.startsWith("  ")).toBe(true);
  });

  it("INSERT 语句格式化", () => {
    const input =
      "insert into users (name, email, age) values ('Alice', 'alice@example.com', 25)";
    const result = formatSql(input);
    expect(result).toContain("INSERT INTO");
    expect(result).toContain("VALUES");
    expect(result.indexOf("INSERT INTO")).toBeLessThan(result.indexOf("VALUES"));
  });

  it("UPDATE 语句格式化", () => {
    const input =
      "update users set name = 'Bob', age = 30 where id = 1";
    const result = formatSql(input);
    expect(result).toContain("UPDATE");
    expect(result).toContain("SET");
    expect(result).toContain("WHERE");
    expect(result.indexOf("UPDATE")).toBeLessThan(result.indexOf("SET"));
    expect(result.indexOf("SET")).toBeLessThan(result.indexOf("WHERE"));
  });

  it("空字符串输入返回空", () => {
    expect(formatSql("")).toBe("");
    expect(formatSql("   ")).toBe("");
  });

  it("注释保留（单行注释 -- 和多行注释 /* */）", () => {
    const input = `select
  id, -- 用户ID
  name
from users
/* 这是多行注释
   第二行 */
where status = 'active'`;
    const result = formatSql(input);
    expect(result).toContain("-- 用户ID");
    expect(result).toContain("/* 这是多行注释");
    expect(result).toContain("第二行 */");
  });

  it("字符串中的内容不被修改", () => {
    const input = `select * from users where name = 'select from where' and desc = "test keyword"`;
    const result = formatSql(input);
    expect(result).toContain("'select from where'");
    expect(result).toContain('"test keyword"');
  });

  it("幂等性：格式化两次结果相同", () => {
    const input = "select id, name, age from users where age > 18 order by name asc";
    const firstFormat = formatSql(input);
    const secondFormat = formatSql(firstFormat);
    expect(secondFormat).toBe(firstFormat);
  });
});

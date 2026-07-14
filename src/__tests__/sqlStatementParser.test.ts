import { describe, it, expect } from "vitest";
import {
  splitSqlStatements,
  getStatementAtCursor,
  extractParameters,
} from "../utils/sqlStatementParser";

describe("splitSqlStatements", () => {
  it("单语句返回一个元素", () => {
    const result = splitSqlStatements("SELECT * FROM users");
    expect(result).toEqual(["SELECT * FROM users"]);
  });

  it("多语句用分号分隔返回多个", () => {
    const result = splitSqlStatements(
      "SELECT * FROM users; SELECT * FROM orders"
    );
    expect(result).toEqual(["SELECT * FROM users", "SELECT * FROM orders"]);
  });

  it("空字符串返回空数组", () => {
    expect(splitSqlStatements("")).toEqual([]);
  });

  it("全空白字符串返回空数组", () => {
    expect(splitSqlStatements("   \n\t  ")).toEqual([]);
  });

  it("字符串中的分号不拆分", () => {
    const result = splitSqlStatements(
      "SELECT 'hello;world' AS msg FROM users"
    );
    expect(result).toEqual(["SELECT 'hello;world' AS msg FROM users"]);
  });

  it("双引号字符串中的分号不拆分", () => {
    const result = splitSqlStatements(
      'SELECT "hello;world" AS msg FROM users'
    );
    expect(result).toEqual(['SELECT "hello;world" AS msg FROM users']);
  });

  it("单行注释中的分号不拆分", () => {
    const sql = `SELECT * FROM users -- this is; a comment
; SELECT * FROM orders`;
    const result = splitSqlStatements(sql);
    expect(result).toEqual([
      "SELECT * FROM users -- this is; a comment",
      "SELECT * FROM orders",
    ]);
  });

  it("多行注释中的分号不拆分", () => {
    const sql = "SELECT * FROM /* this; is; a; comment */ users; SELECT * FROM orders";
    const result = splitSqlStatements(sql);
    expect(result).toEqual([
      "SELECT * FROM /* this; is; a; comment */ users",
      "SELECT * FROM orders",
    ]);
  });

  it("首尾空白被正确 trim", () => {
    const result = splitSqlStatements("   SELECT * FROM users   ");
    expect(result).toEqual(["SELECT * FROM users"]);
  });

  it("末尾分号不产生空语句", () => {
    const result = splitSqlStatements("SELECT * FROM users;");
    expect(result).toEqual(["SELECT * FROM users"]);
  });

  it("多个分号连续的情况", () => {
    const result = splitSqlStatements(
      "SELECT * FROM users;; SELECT * FROM orders;;;"
    );
    expect(result).toEqual(["SELECT * FROM users", "SELECT * FROM orders"]);
  });
});

describe("getStatementAtCursor", () => {
  it("光标在第一条语句中返回第一条", () => {
    const sql = "SELECT * FROM users;\nSELECT * FROM orders;";
    const result = getStatementAtCursor(sql, 0, 5);
    expect(result.statement).toBe("SELECT * FROM users");
    expect(result.statementIndex).toBe(0);
  });

  it("光标在第二条语句中返回第二条", () => {
    const sql = "SELECT * FROM users;\nSELECT * FROM orders;";
    const result = getStatementAtCursor(sql, 1, 5);
    expect(result.statement).toBe("SELECT * FROM orders");
    expect(result.statementIndex).toBe(1);
  });

  it("空输入返回空", () => {
    const result = getStatementAtCursor("", 0, 0);
    expect(result.statement).toBe("");
    expect(result.startLine).toBe(0);
    expect(result.endLine).toBe(0);
    expect(result.statementIndex).toBe(0);
  });

  it("全空白输入返回空", () => {
    const result = getStatementAtCursor("   \n\t  ", 0, 0);
    expect(result.statement).toBe("");
  });

  it("返回正确的行号范围", () => {
    const sql = `SELECT *
FROM users
WHERE id = 1;
SELECT * FROM orders`;
    const result = getStatementAtCursor(sql, 1, 0);
    expect(result.statement).toContain("SELECT *");
    expect(result.statement).toContain("FROM users");
    expect(result.startLine).toBe(0);
    expect(result.endLine).toBe(2);
  });
});

describe("extractParameters", () => {
  it("位置参数 ? 正确提取", () => {
    const result = extractParameters("SELECT * FROM users WHERE id = ? AND name = ?");
    expect(result.type).toBe("positional");
    expect(result.params).toHaveLength(2);
    expect(result.params[0]).toEqual({ index: 1 });
    expect(result.params[1]).toEqual({ index: 2 });
  });

  it("命名参数 :name 正确提取", () => {
    const result = extractParameters(
      "SELECT * FROM users WHERE id = :userId AND name = :userName"
    );
    expect(result.type).toBe("named");
    expect(result.params).toHaveLength(2);
    expect(result.params[0]).toEqual({ name: "userId", index: 1 });
    expect(result.params[1]).toEqual({ name: "userName", index: 2 });
  });

  it("字符串中的 ? 和 : 不被提取", () => {
    const result = extractParameters(
      "SELECT 'hello?world' AS msg, ':notParam' AS col FROM users WHERE id = ?"
    );
    expect(result.type).toBe("positional");
    expect(result.params).toHaveLength(1);
    expect(result.params[0]).toEqual({ index: 1 });
  });

  it("双引号字符串中的 ? 和 : 不被提取", () => {
    const result = extractParameters(
      'SELECT "hello?world" AS msg FROM users WHERE id = :userId'
    );
    expect(result.type).toBe("named");
    expect(result.params).toHaveLength(1);
    expect(result.params[0]).toEqual({ name: "userId", index: 1 });
  });

  it("混合参数类型的处理", () => {
    const result = extractParameters(
      "SELECT * FROM users WHERE id = ? AND name = :userName"
    );
    expect(result.type).toBe("named");
    expect(result.params).toHaveLength(2);
  });

  it("注释中的参数不被提取", () => {
    const sql = `SELECT * FROM users 
-- WHERE id = :userId
/* AND name = ? */
WHERE status = ?`;
    const result = extractParameters(sql);
    expect(result.type).toBe("positional");
    expect(result.params).toHaveLength(1);
    expect(result.params[0]).toEqual({ index: 1 });
  });

  it("命名参数支持下划线和数字", () => {
    const result = extractParameters(
      "SELECT * FROM users WHERE id = :user_id_123"
    );
    expect(result.type).toBe("named");
    expect(result.params).toHaveLength(1);
    expect(result.params[0]).toEqual({ name: "user_id_123", index: 1 });
  });

  it("无参数时返回空数组", () => {
    const result = extractParameters("SELECT * FROM users");
    expect(result.type).toBe("positional");
    expect(result.params).toEqual([]);
  });
});

/**
 * SQL 语句解析工具
 *
 * 为 SQL 编辑器提供语句拆分、光标定位、参数提取等能力。
 * 支撑 Ctrl+Enter 执行当前语句等功能。
 *
 * 所有函数均为纯函数，无副作用。
 */

interface StatementInfo {
  statement: string;
  startLine: number;
  endLine: number;
  startIndex: number;
  endIndex: number;
}

function parseStatementsWithPositions(sql: string): StatementInfo[] {
  const statements: StatementInfo[] = [];
  let currentStatementStart = 0;
  let currentStatementStartLine = 0;

  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inSingleLineComment = false;
  let inMultiLineComment = false;

  let line = 0;
  let i = 0;

  const finalizeStatement = (endIndex: number, endLine: number) => {
    const statement = sql.slice(currentStatementStart, endIndex);
    if (statement.trim().length > 0) {
      statements.push({
        statement: statement.trim(),
        startLine: currentStatementStartLine,
        endLine: endLine,
        startIndex: currentStatementStart,
        endIndex: endIndex,
      });
    }
  };

  while (i < sql.length) {
    const char = sql[i];
    const nextChar = sql[i + 1];

    if (inSingleLineComment) {
      if (char === '\n') {
        inSingleLineComment = false;
        line++;
      }
      i++;
      continue;
    }

    if (inMultiLineComment) {
      if (char === '*' && nextChar === '/') {
        inMultiLineComment = false;
        i += 2;
        continue;
      }
      if (char === '\n') {
        line++;
      }
      i++;
      continue;
    }

    if (inSingleQuote) {
      if (char === "'") {
        if (nextChar === "'") {
          i += 2;
          continue;
        }
        inSingleQuote = false;
      }
      if (char === '\n') {
        line++;
      }
      i++;
      continue;
    }

    if (inDoubleQuote) {
      if (char === '"') {
        inDoubleQuote = false;
      }
      if (char === '\n') {
        line++;
      }
      i++;
      continue;
    }

    if (char === '-' && nextChar === '-') {
      inSingleLineComment = true;
      i += 2;
      continue;
    }

    if (char === '/' && nextChar === '*') {
      inMultiLineComment = true;
      i += 2;
      continue;
    }

    if (char === "'") {
      inSingleQuote = true;
      i++;
      continue;
    }

    if (char === '"') {
      inDoubleQuote = true;
      i++;
      continue;
    }

    if (char === ';') {
      finalizeStatement(i, line);
      i++;
      currentStatementStart = i;
      currentStatementStartLine = line;
      continue;
    }

    if (char === '\n') {
      line++;
    }
    i++;
  }

  if (currentStatementStart < sql.length) {
    finalizeStatement(sql.length, line);
  }

  return statements;
}

export function splitSqlStatements(sql: string): string[] {
  if (!sql || sql.trim().length === 0) {
    return [];
  }
  const infos = parseStatementsWithPositions(sql);
  return infos.map((info) => info.statement);
}

export function getStatementAtCursor(
  sql: string,
  cursorLine: number,
  cursorColumn: number,
): { statement: string; startLine: number; endLine: number; statementIndex: number } {
  if (!sql || sql.trim().length === 0) {
    return { statement: '', startLine: 0, endLine: 0, statementIndex: 0 };
  }

  const statements = parseStatementsWithPositions(sql);
  if (statements.length === 0) {
    return { statement: '', startLine: 0, endLine: 0, statementIndex: 0 };
  }

  let cursorPos = 0;
  let currentLine = 0;
  let currentCol = 0;

  for (let i = 0; i < sql.length; i++) {
    if (currentLine === cursorLine && currentCol === cursorColumn) {
      cursorPos = i;
      break;
    }
    if (sql[i] === '\n') {
      currentLine++;
      currentCol = 0;
    } else {
      currentCol++;
    }
    cursorPos = i + 1;
  }

  let bestIndex = -1;
  let bestDistance = Infinity;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    if (cursorPos >= stmt.startIndex && cursorPos <= stmt.endIndex) {
      return {
        statement: stmt.statement,
        startLine: stmt.startLine,
        endLine: stmt.endLine,
        statementIndex: i,
      };
    }

    const distBefore = stmt.startIndex - cursorPos;
    const distAfter = cursorPos - stmt.endIndex;
    const minDist = Math.min(Math.abs(distBefore), Math.abs(distAfter));

    if (minDist < bestDistance) {
      bestDistance = minDist;
      bestIndex = i;
    }
  }

  if (bestIndex >= 0) {
    const stmt = statements[bestIndex];
    return {
      statement: stmt.statement,
      startLine: stmt.startLine,
      endLine: stmt.endLine,
      statementIndex: bestIndex,
    };
  }

  return { statement: '', startLine: 0, endLine: 0, statementIndex: 0 };
}

export function applyDefaultSelectLimit(sql: string, limit: number): string {
  if (limit <= 0) return sql;

  const trimmed = sql.trim();
  if (!trimmed) return sql;

  const upperSql = trimmed.toUpperCase();

  if (!upperSql.startsWith('SELECT')) {
    return sql;
  }

  if (/\bLIMIT\s+\d+/i.test(trimmed)) {
    return sql;
  }

  return `${trimmed.replace(/;?\s*$/, '')}\nLIMIT ${limit}`;
}

export function extractParameters(
  sql: string,
): { type: 'positional' | 'named'; params: Array<{ name?: string; index: number }> } {
  const params: Array<{ name?: string; index: number }> = [];
  let hasNamed = false;
  let positionalCount = 0;

  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inSingleLineComment = false;
  let inMultiLineComment = false;

  let i = 0;

  while (i < sql.length) {
    const char = sql[i];
    const nextChar = sql[i + 1];

    if (inSingleLineComment) {
      if (char === '\n') {
        inSingleLineComment = false;
      }
      i++;
      continue;
    }

    if (inMultiLineComment) {
      if (char === '*' && nextChar === '/') {
        inMultiLineComment = false;
        i += 2;
        continue;
      }
      i++;
      continue;
    }

    if (inSingleQuote) {
      if (char === "'") {
        if (nextChar === "'") {
          i += 2;
          continue;
        }
        inSingleQuote = false;
      }
      i++;
      continue;
    }

    if (inDoubleQuote) {
      if (char === '"') {
        inDoubleQuote = false;
      }
      i++;
      continue;
    }

    if (char === '-' && nextChar === '-') {
      inSingleLineComment = true;
      i += 2;
      continue;
    }

    if (char === '/' && nextChar === '*') {
      inMultiLineComment = true;
      i += 2;
      continue;
    }

    if (char === "'") {
      inSingleQuote = true;
      i++;
      continue;
    }

    if (char === '"') {
      inDoubleQuote = true;
      i++;
      continue;
    }

    if (char === ':' && /[a-zA-Z_]/.test(nextChar || '')) {
      let name = '';
      let j = i + 1;
      while (j < sql.length && /[a-zA-Z0-9_]/.test(sql[j])) {
        name += sql[j];
        j++;
      }
      if (name.length > 0) {
        hasNamed = true;
        params.push({ name, index: params.length + 1 });
        i = j;
        continue;
      }
    }

    if (char === '?') {
      positionalCount++;
      params.push({ index: positionalCount });
      i++;
      continue;
    }

    i++;
  }

  return {
    type: hasNamed ? 'named' : 'positional',
    params,
  };
}

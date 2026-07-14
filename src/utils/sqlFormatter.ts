/**
 * SQL 格式化/美化工具
 *
 * 简化但实用的 SQL 格式化器，用纯 TypeScript 实现。
 * 功能：
 *   - 关键字大写
 *   - 主要关键字换行
 *   - 缩进处理（括号、子查询）
 *   - 逗号后换行（SELECT 列名）
 *   - 保持字符串和注释不变
 *   - 去除多余空格和空行
 */

const TOP_LEVEL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING',
  'LIMIT', 'OFFSET', 'UNION', 'UNION ALL',
  'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM',
];

const INDENT_KEYWORDS = [
  'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'JOIN',
  'FULL OUTER JOIN', 'LEFT OUTER JOIN', 'RIGHT OUTER JOIN',
  'CROSS JOIN', 'NATURAL JOIN',
  'ON', 'AND', 'OR',
];

const ALL_KEYWORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'GROUP', 'BY', 'ORDER', 'HAVING',
  'LIMIT', 'OFFSET', 'UNION', 'ALL',
  'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
  'LEFT', 'RIGHT', 'INNER', 'JOIN', 'FULL', 'OUTER', 'CROSS', 'NATURAL',
  'ON', 'AND', 'OR', 'NOT', 'IN', 'IS', 'NULL', 'LIKE', 'BETWEEN',
  'AS', 'ASC', 'DESC', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
  'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  'EXISTS', 'ANY', 'SOME', 'ALL',
  'WITH', 'RECURSIVE',
  'TRUE', 'FALSE',
]);

interface Token {
  type: 'keyword' | 'identifier' | 'string' | 'number' | 'operator' | 'punctuation' | 'comment' | 'whitespace' | 'newline';
  value: string;
  raw: string;
}

function tokenize(sql: string, uppercaseKeywords: boolean = true): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = sql.length;

  while (i < len) {
    const char = sql[i];
    const nextChar = sql[i + 1];

    if (char === '\n') {
      tokens.push({ type: 'newline', value: '\n', raw: '\n' });
      i++;
      continue;
    }

    if (/\s/.test(char)) {
      let whitespace = '';
      while (i < len && /[ \t\r]/.test(sql[i])) {
        whitespace += sql[i];
        i++;
      }
      tokens.push({ type: 'whitespace', value: ' ', raw: whitespace });
      continue;
    }

    if (char === '-' && nextChar === '-') {
      let comment = '';
      while (i < len && sql[i] !== '\n') {
        comment += sql[i];
        i++;
      }
      tokens.push({ type: 'comment', value: comment, raw: comment });
      continue;
    }

    if (char === '/' && nextChar === '*') {
      let comment = '';
      comment += sql[i];
      i++;
      comment += sql[i];
      i++;
      while (i < len && !(sql[i - 1] === '*' && sql[i] === '/')) {
        comment += sql[i];
        i++;
      }
      if (i < len) {
        comment += sql[i];
        i++;
      }
      tokens.push({ type: 'comment', value: comment, raw: comment });
      continue;
    }

    if (char === "'") {
      let str = "'";
      i++;
      while (i < len) {
        if (sql[i] === "'") {
          str += "'";
          i++;
          if (i < len && sql[i] === "'") {
            str += "'";
            i++;
          } else {
            break;
          }
        } else {
          str += sql[i];
          i++;
        }
      }
      tokens.push({ type: 'string', value: str, raw: str });
      continue;
    }

    if (char === '"') {
      let str = '"';
      i++;
      while (i < len && sql[i] !== '"') {
        str += sql[i];
        i++;
      }
      if (i < len) {
        str += '"';
        i++;
      }
      tokens.push({ type: 'string', value: str, raw: str });
      continue;
    }

    if (char === '`') {
      let str = '`';
      i++;
      while (i < len && sql[i] !== '`') {
        str += sql[i];
        i++;
      }
      if (i < len) {
        str += '`';
        i++;
      }
      tokens.push({ type: 'string', value: str, raw: str });
      continue;
    }

    if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(nextChar || ''))) {
      let num = '';
      while (i < len && /[0-9.]/.test(sql[i])) {
        num += sql[i];
        i++;
      }
      tokens.push({ type: 'number', value: num, raw: num });
      continue;
    }

    if (/[a-zA-Z_]/.test(char)) {
      let word = '';
      while (i < len && /[a-zA-Z0-9_]/.test(sql[i])) {
        word += sql[i];
        i++;
      }
      const upperWord = word.toUpperCase();
      if (ALL_KEYWORDS.has(upperWord)) {
        const keywordValue = uppercaseKeywords ? upperWord : word;
        tokens.push({ type: 'keyword', value: keywordValue, raw: word });
      } else {
        tokens.push({ type: 'identifier', value: word, raw: word });
      }
      continue;
    }

    if (char === '(' || char === ')' || char === ',' || char === ';') {
      tokens.push({ type: 'punctuation', value: char, raw: char });
      i++;
      continue;
    }

    if (/[+\-*/%=<>!&|^~]/.test(char)) {
      let op = '';
      while (i < len && /[+\-*/%=<>!&|^~]/.test(sql[i])) {
        op += sql[i];
        i++;
      }
      tokens.push({ type: 'operator', value: op, raw: op });
      continue;
    }

    tokens.push({ type: 'identifier', value: char, raw: char });
    i++;
  }

  return tokens;
}

function detectMultiWordKeywords(tokens: Token[], uppercaseKeywords: boolean = true): Token[] {
  const result: Token[] = [];
  let i = 0;

  const multiWordPatterns = [
    ['GROUP', 'BY'],
    ['ORDER', 'BY'],
    ['INSERT', 'INTO'],
    ['DELETE', 'FROM'],
    ['LEFT', 'JOIN'],
    ['RIGHT', 'JOIN'],
    ['INNER', 'JOIN'],
    ['FULL', 'OUTER', 'JOIN'],
    ['LEFT', 'OUTER', 'JOIN'],
    ['RIGHT', 'OUTER', 'JOIN'],
    ['CROSS', 'JOIN'],
    ['NATURAL', 'JOIN'],
    ['UNION', 'ALL'],
  ];

  while (i < tokens.length) {
    let matched = false;

    for (const pattern of multiWordPatterns) {
      const patternLen = pattern.length;
      if (i + patternLen <= tokens.length) {
        let match = true;
        let nonWhitespaceCount = 0;
        const indices: number[] = [];

        for (let j = 0; j < patternLen; j++) {
          let k = i;
          let found = false;
          while (k < tokens.length) {
            if (tokens[k].type === 'keyword' && tokens[k].value.toUpperCase() === pattern[j]) {
              found = true;
              indices.push(k);
              break;
            } else if (tokens[k].type === 'whitespace') {
              k++;
            } else {
              break;
            }
          }
          if (!found) {
            match = false;
            break;
          }
          nonWhitespaceCount++;
        }

        if (match && nonWhitespaceCount === patternLen) {
          const combinedUpper = pattern.join(' ');
          const combinedValue = uppercaseKeywords ? combinedUpper : combinedUpper.toLowerCase();
          result.push({ type: 'keyword', value: combinedValue, raw: combinedValue });
          i = indices[indices.length - 1] + 1;
          matched = true;
          break;
        }
      }
    }

    if (!matched) {
      result.push(tokens[i]);
      i++;
    }
  }

  return result;
}

export function formatSql(sql: string, indentSize: number = 2, uppercaseKeywords: boolean = true): string {
  if (!sql || sql.trim().length === 0) {
    return '';
  }

  let tokens = tokenize(sql, uppercaseKeywords);
  tokens = detectMultiWordKeywords(tokens, uppercaseKeywords);

  const filteredTokens: Token[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === 'whitespace') {
      const prev = filteredTokens[filteredTokens.length - 1];
      const next = tokens[i + 1];
      if (prev && next && prev.type !== 'newline' && prev.type !== 'whitespace' && next.type !== 'newline' && next.type !== 'whitespace') {
        if (filteredTokens.length > 0 && filteredTokens[filteredTokens.length - 1].type !== 'whitespace') {
          filteredTokens.push(token);
        }
      }
    } else if (token.type === 'newline') {
      if (filteredTokens.length === 0 || filteredTokens[filteredTokens.length - 1].type !== 'newline') {
        filteredTokens.push(token);
      }
    } else {
      filteredTokens.push(token);
    }
  }

  const topLevelSet = new Set(TOP_LEVEL_KEYWORDS);
  const indentSet = new Set(INDENT_KEYWORDS);

  const lines: string[] = [];
  let currentLine = '';
  let indentLevel = 0;
  let selectMode = false;

  const pushLine = () => {
    if (currentLine.trim().length > 0) {
      lines.push(' '.repeat(indentLevel * indentSize) + currentLine.trim());
    }
    currentLine = '';
  };

  for (let i = 0; i < filteredTokens.length; i++) {
    const token = filteredTokens[i];
    const prevToken = i > 0 ? filteredTokens[i - 1] : null;
    const nextToken = i < filteredTokens.length - 1 ? filteredTokens[i + 1] : null;

    if (token.type === 'newline') {
      continue;
    }

    if (token.type === 'comment') {
      if (currentLine.trim().length > 0) {
        pushLine();
      }
      lines.push(' '.repeat(indentLevel * indentSize) + token.value);
      continue;
    }

    if (token.type === 'punctuation') {
      if (token.value === '(') {
        currentLine += '(';
        pushLine();
        indentLevel++;
        continue;
      }
      if (token.value === ')') {
        if (currentLine.trim().length > 0) {
          pushLine();
        }
        indentLevel = Math.max(0, indentLevel - 1);
        currentLine += ')';
        continue;
      }
      if (token.value === ',') {
        currentLine += ',';
        if (selectMode) {
          pushLine();
          continue;
        }
        if (nextToken && nextToken.type !== 'comment') {
          currentLine += ' ';
        }
        continue;
      }
      if (token.value === ';') {
        currentLine += ';';
        pushLine();
        selectMode = false;
        continue;
      }
    }

    if (token.type === 'keyword') {
      const keyword = token.value;
      const keywordUpper = keyword.toUpperCase();

      if (topLevelSet.has(keywordUpper)) {
        if (currentLine.trim().length > 0) {
          pushLine();
        }

        if (keywordUpper === 'SELECT') {
          selectMode = true;
        }

        if (keywordUpper === 'FROM') {
          selectMode = false;
        }

        currentLine = keyword + ' ';
        continue;
      }

      if (indentSet.has(keywordUpper)) {
        if (currentLine.trim().length > 0) {
          pushLine();
        }
        currentLine = keyword + ' ';
        continue;
      }

      if (currentLine.length > 0 && currentLine[currentLine.length - 1] !== ' ') {
        currentLine += ' ';
      }
      currentLine += keyword;
      continue;
    }

    if (token.type === 'whitespace') {
      if (currentLine.length > 0 && currentLine[currentLine.length - 1] !== ' ') {
        currentLine += ' ';
      }
      continue;
    }

    if (currentLine.length > 0 && currentLine[currentLine.length - 1] !== ' ') {
      const lastChar = currentLine[currentLine.length - 1];
      if (lastChar !== '(' && lastChar !== '.' && token.type !== 'punctuation') {
        const prevIsOp = prevToken && prevToken.type === 'operator';
        const currIsOp = token.type === 'operator';
        if (!prevIsOp && !currIsOp) {
          currentLine += ' ';
        }
      }
    }
    currentLine += token.value;
  }

  if (currentLine.trim().length > 0) {
    pushLine();
  }

  return lines.join('\n');
}

export default formatSql;

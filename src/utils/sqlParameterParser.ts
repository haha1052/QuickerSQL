export interface SqlParameter {
  name: string;
  type: 'numeric' | 'named' | 'template';
  position: number;
  raw: string;
}

export function extractParameters(sql: string): SqlParameter[] {
  if (!sql || sql.length === 0) {
    return [];
  }

  const params: SqlParameter[] = [];
  const seen = new Set<string>();

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

    if (char === '{' && nextChar === '{') {
      let j = i + 2;
      let name = '';
      while (j < sql.length && sql[j] !== '}') {
        name += sql[j];
        j++;
      }
      if (j < sql.length && sql[j] === '}' && sql[j + 1] === '}') {
        name = name.trim();
        if (name.length > 0 && !seen.has(name)) {
          seen.add(name);
          params.push({
            name,
            type: 'template',
            position: i,
            raw: `{{${name}}}`,
          });
        }
        i = j + 2;
        continue;
      }
      i++;
      continue;
    }

    if (char === '$' && /[0-9]/.test(nextChar || '')) {
      let j = i + 1;
      let numStr = '';
      while (j < sql.length && /[0-9]/.test(sql[j])) {
        numStr += sql[j];
        j++;
      }
      if (numStr.length > 0) {
        const name = `$${numStr}`;
        if (!seen.has(name)) {
          seen.add(name);
          params.push({
            name,
            type: 'numeric',
            position: i,
            raw: name,
          });
        }
        i = j;
        continue;
      }
    }

    if (char === ':' && /[a-zA-Z_]/.test(nextChar || '')) {
      let j = i + 1;
      let name = '';
      while (j < sql.length && /[a-zA-Z0-9_]/.test(sql[j])) {
        name += sql[j];
        j++;
      }
      if (name.length > 0 && !seen.has(`:${name}`)) {
        seen.add(`:${name}`);
        params.push({
          name,
          type: 'named',
          position: i,
          raw: `:${name}`,
        });
      }
      i = j;
      continue;
    }

    if (char === '@' && /[a-zA-Z_]/.test(nextChar || '')) {
      let j = i + 1;
      let name = '';
      while (j < sql.length && /[a-zA-Z0-9_]/.test(sql[j])) {
        name += sql[j];
        j++;
      }
      if (name.length > 0 && !seen.has(`@${name}`)) {
        seen.add(`@${name}`);
        params.push({
          name,
          type: 'named',
          position: i,
          raw: `@${name}`,
        });
      }
      i = j;
      continue;
    }

    if (char === '$' && /[a-zA-Z_]/.test(nextChar || '')) {
      let j = i + 1;
      let name = '';
      while (j < sql.length && /[a-zA-Z0-9_]/.test(sql[j])) {
        name += sql[j];
        j++;
      }
      if (name.length > 0 && !seen.has(`$${name}`)) {
        seen.add(`$${name}`);
        params.push({
          name,
          type: 'named',
          position: i,
          raw: `$${name}`,
        });
      }
      i = j;
      continue;
    }

    i++;
  }

  return params.sort((a, b) => a.position - b.position);
}

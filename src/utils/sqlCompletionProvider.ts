import type * as Monaco from 'monaco-editor';

const SQL_KEYWORDS: string[] = [
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'GROUP BY', 'ORDER BY',
  'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN', 'CROSS JOIN',
  'LIMIT', 'OFFSET', 'HAVING', 'UNION', 'UNION ALL', 'INTERSECT', 'EXCEPT',
  'DISTINCT', 'AS', 'IN', 'LIKE', 'BETWEEN', 'IS NULL', 'IS NOT NULL',
  'EXISTS', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'CAST', 'WITH',
  'WITH RECURSIVE', 'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM',
  'CREATE TABLE', 'CREATE VIEW', 'CREATE INDEX', 'ALTER TABLE', 'DROP TABLE',
  'DROP VIEW', 'DROP INDEX', 'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES',
  'UNIQUE', 'NOT NULL', 'DEFAULT', 'AUTO_INCREMENT', 'INTEGER', 'INT',
  'BIGINT', 'SMALLINT', 'TEXT', 'VARCHAR', 'CHAR', 'REAL', 'FLOAT', 'DOUBLE',
  'BOOLEAN', 'DATE', 'TIME', 'TIMESTAMP', 'DATETIME', 'BLOB', 'NUMERIC',
  'DECIMAL', 'TRUE', 'FALSE', 'NULL', 'ALL', 'ANY', 'SOME', 'ON', 'USING',
  'NATURAL',
];

interface SqlFunction {
  name: string;
  detail: string;
  insertText: string;
}

const SQL_FUNCTIONS: SqlFunction[] = [
  { name: 'SUM', detail: 'sqlCompletion.fn.sum', insertText: 'SUM(${1:expr})' },
  { name: 'AVG', detail: 'sqlCompletion.fn.avg', insertText: 'AVG(${1:expr})' },
  { name: 'COUNT', detail: 'sqlCompletion.fn.count', insertText: 'COUNT(${1:expr})' },
  { name: 'MIN', detail: 'sqlCompletion.fn.min', insertText: 'MIN(${1:expr})' },
  { name: 'MAX', detail: 'sqlCompletion.fn.max', insertText: 'MAX(${1:expr})' },
  { name: 'FIRST', detail: 'sqlCompletion.fn.first', insertText: 'FIRST(${1:expr})' },
  { name: 'LAST', detail: 'sqlCompletion.fn.last', insertText: 'LAST(${1:expr})' },
  { name: 'MEDIAN', detail: 'sqlCompletion.fn.median', insertText: 'MEDIAN(${1:expr})' },
  { name: 'MODE', detail: 'sqlCompletion.fn.mode', insertText: 'MODE(${1:expr})' },
  { name: 'STDDEV', detail: 'sqlCompletion.fn.stddev', insertText: 'STDDEV(${1:expr})' },
  { name: 'VARIANCE', detail: 'sqlCompletion.fn.variance', insertText: 'VARIANCE(${1:expr})' },
  { name: 'GROUP_CONCAT', detail: 'sqlCompletion.fn.groupConcat', insertText: 'GROUP_CONCAT(${1:expr})' },
  { name: 'STRING_AGG', detail: 'sqlCompletion.fn.stringAgg', insertText: 'STRING_AGG(${1:expr}, ${2:separator})' },
  { name: 'ARRAY_AGG', detail: 'sqlCompletion.fn.arrayAgg', insertText: 'ARRAY_AGG(${1:expr})' },
  { name: 'UPPER', detail: 'sqlCompletion.fn.upper', insertText: 'UPPER(${1:string})' },
  { name: 'LOWER', detail: 'sqlCompletion.fn.lower', insertText: 'LOWER(${1:string})' },
  { name: 'LENGTH', detail: 'sqlCompletion.fn.length', insertText: 'LENGTH(${1:string})' },
  { name: 'LEN', detail: 'sqlCompletion.fn.len', insertText: 'LEN(${1:string})' },
  { name: 'TRIM', detail: 'sqlCompletion.fn.trim', insertText: 'TRIM(${1:string})' },
  { name: 'LTRIM', detail: 'sqlCompletion.fn.ltrim', insertText: 'LTRIM(${1:string})' },
  { name: 'RTRIM', detail: 'sqlCompletion.fn.rtrim', insertText: 'RTRIM(${1:string})' },
  { name: 'SUBSTR', detail: 'sqlCompletion.fn.substr', insertText: 'SUBSTR(${1:string}, ${2:start}, ${3:length})' },
  { name: 'SUBSTRING', detail: 'sqlCompletion.fn.substring', insertText: 'SUBSTRING(${1:string}, ${2:start}, ${3:length})' },
  { name: 'CONCAT', detail: 'sqlCompletion.fn.concat', insertText: 'CONCAT(${1:string1}, ${2:string2})' },
  { name: 'CONCAT_WS', detail: 'sqlCompletion.fn.concatWs', insertText: 'CONCAT_WS(${1:separator}, ${2:string1}, ${3:string2})' },
  { name: 'REPLACE', detail: 'sqlCompletion.fn.replace', insertText: 'REPLACE(${1:string}, ${2:from}, ${3:to})' },
  { name: 'REGEXP_MATCHES', detail: 'sqlCompletion.fn.regexpMatches', insertText: 'REGEXP_MATCHES(${1:string}, ${2:pattern})' },
  { name: 'SPLIT_PART', detail: 'sqlCompletion.fn.splitPart', insertText: 'SPLIT_PART(${1:string}, ${2:delimiter}, ${3:field})' },
  { name: 'LEFT', detail: 'sqlCompletion.fn.left', insertText: 'LEFT(${1:string}, ${2:n})' },
  { name: 'RIGHT', detail: 'sqlCompletion.fn.right', insertText: 'RIGHT(${1:string}, ${2:n})' },
  { name: 'REVERSE', detail: 'sqlCompletion.fn.reverse', insertText: 'REVERSE(${1:string})' },
  { name: 'LPAD', detail: 'sqlCompletion.fn.lpad', insertText: 'LPAD(${1:string}, ${2:length}, ${3:pad})' },
  { name: 'RPAD', detail: 'sqlCompletion.fn.rpad', insertText: 'RPAD(${1:string}, ${2:length}, ${3:pad})' },
  { name: 'FORMAT', detail: 'sqlCompletion.fn.format', insertText: 'FORMAT(${1:format}, ${2:args})' },
  { name: 'CURRENT_DATE', detail: 'sqlCompletion.fn.currentDate', insertText: 'CURRENT_DATE' },
  { name: 'CURRENT_TIME', detail: 'sqlCompletion.fn.currentTime', insertText: 'CURRENT_TIME' },
  { name: 'CURRENT_TIMESTAMP', detail: 'sqlCompletion.fn.currentTimestamp', insertText: 'CURRENT_TIMESTAMP' },
  { name: 'DATE', detail: 'sqlCompletion.fn.date', insertText: 'DATE(${1:timestamp})' },
  { name: 'YEAR', detail: 'sqlCompletion.fn.year', insertText: 'YEAR(${1:date})' },
  { name: 'MONTH', detail: 'sqlCompletion.fn.month', insertText: 'MONTH(${1:date})' },
  { name: 'DAY', detail: 'sqlCompletion.fn.day', insertText: 'DAY(${1:date})' },
  { name: 'HOUR', detail: 'sqlCompletion.fn.hour', insertText: 'HOUR(${1:timestamp})' },
  { name: 'MINUTE', detail: 'sqlCompletion.fn.minute', insertText: 'MINUTE(${1:timestamp})' },
  { name: 'SECOND', detail: 'sqlCompletion.fn.second', insertText: 'SECOND(${1:timestamp})' },
  { name: 'EXTRACT', detail: 'sqlCompletion.fn.extract', insertText: 'EXTRACT(${1:part} FROM ${2:date})' },
  { name: 'DATE_TRUNC', detail: 'sqlCompletion.fn.dateTrunc', insertText: 'DATE_TRUNC(${1:precision}, ${2:timestamp})' },
  { name: 'DATE_PART', detail: 'sqlCompletion.fn.datePart', insertText: 'DATE_PART(${1:part}, ${2:date})' },
  { name: 'AGE', detail: 'sqlCompletion.fn.age', insertText: 'AGE(${1:date1}, ${2:date2})' },
  { name: 'TO_DATE', detail: 'sqlCompletion.fn.toDate', insertText: 'TO_DATE(${1:string}, ${2:format})' },
  { name: 'TO_TIMESTAMP', detail: 'sqlCompletion.fn.toTimestamp', insertText: 'TO_TIMESTAMP(${1:string}, ${2:format})' },
  { name: 'STRFTIME', detail: 'sqlCompletion.fn.strftime', insertText: 'STRFTIME(${1:format}, ${2:date})' },
  { name: 'ABS', detail: 'sqlCompletion.fn.abs', insertText: 'ABS(${1:number})' },
  { name: 'ROUND', detail: 'sqlCompletion.fn.round', insertText: 'ROUND(${1:number}, ${2:decimals})' },
  { name: 'FLOOR', detail: 'sqlCompletion.fn.floor', insertText: 'FLOOR(${1:number})' },
  { name: 'CEIL', detail: 'sqlCompletion.fn.ceil', insertText: 'CEIL(${1:number})' },
  { name: 'CEILING', detail: 'sqlCompletion.fn.ceiling', insertText: 'CEILING(${1:number})' },
  { name: 'SQRT', detail: 'sqlCompletion.fn.sqrt', insertText: 'SQRT(${1:number})' },
  { name: 'POW', detail: 'sqlCompletion.fn.pow', insertText: 'POW(${1:base}, ${2:exponent})' },
  { name: 'POWER', detail: 'sqlCompletion.fn.power', insertText: 'POWER(${1:base}, ${2:exponent})' },
  { name: 'MOD', detail: 'sqlCompletion.fn.mod', insertText: 'MOD(${1:dividend}, ${2:divisor})' },
  { name: 'LOG', detail: 'sqlCompletion.fn.log', insertText: 'LOG(${1:number})' },
  { name: 'LOG10', detail: 'sqlCompletion.fn.log10', insertText: 'LOG10(${1:number})' },
  { name: 'LN', detail: 'sqlCompletion.fn.ln', insertText: 'LN(${1:number})' },
  { name: 'EXP', detail: 'sqlCompletion.fn.exp', insertText: 'EXP(${1:number})' },
  { name: 'RANDOM', detail: 'sqlCompletion.fn.random', insertText: 'RANDOM()' },
  { name: 'SIN', detail: 'sqlCompletion.fn.sin', insertText: 'SIN(${1:radians})' },
  { name: 'COS', detail: 'sqlCompletion.fn.cos', insertText: 'COS(${1:radians})' },
  { name: 'TAN', detail: 'sqlCompletion.fn.tan', insertText: 'TAN(${1:radians})' },
  { name: 'COALESCE', detail: 'sqlCompletion.fn.coalesce', insertText: 'COALESCE(${1:expr1}, ${2:expr2})' },
  { name: 'NULLIF', detail: 'sqlCompletion.fn.nullif', insertText: 'NULLIF(${1:expr1}, ${2:expr2})' },
  { name: 'IFNULL', detail: 'sqlCompletion.fn.ifnull', insertText: 'IFNULL(${1:expr}, ${2:default})' },
  { name: 'GREATEST', detail: 'sqlCompletion.fn.greatest', insertText: 'GREATEST(${1:expr1}, ${2:expr2})' },
  { name: 'LEAST', detail: 'sqlCompletion.fn.least', insertText: 'LEAST(${1:expr1}, ${2:expr2})' },
];

let tableNames: string[] = [];
let columnNames: string[] = [];

export function setCompletionData(tables: string[], columns: string[]): void {
  tableNames = tables;
  columnNames = columns;
}

const TABLE_CONTEXT_KEYWORDS = [
  'FROM', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN',
  'CROSS JOIN', 'UPDATE', 'INSERT INTO', 'DROP TABLE', 'ALTER TABLE',
  'TRUNCATE TABLE', 'TABLE',
];

function isTableContext(textBeforeCursor: string): boolean {
  const upperText = textBeforeCursor.toUpperCase().trim();

  for (const keyword of TABLE_CONTEXT_KEYWORDS) {
    const pattern = new RegExp(`\\b${keyword.replace(/ /g, '\\s+')}\\s+\\w*$`, 'i');
    if (pattern.test(upperText)) {
      return true;
    }
  }

  return false;
}

let completionProviderDisposable: { dispose: () => void } | null = null;

export function registerSqlCompletionProvider(monaco: typeof Monaco, t: (key: string) => string): void {
  if (completionProviderDisposable) {
    return;
  }
  completionProviderDisposable = monaco.languages.registerCompletionItemProvider('sql', {
    provideCompletionItems: (model: Monaco.editor.ITextModel, position: Monaco.Position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const prefix = word.word.toUpperCase();

      const textUntilPosition = model.getValueInRange({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      const inTableContext = isTableContext(textUntilPosition);

      if (inTableContext && tableNames.length > 0) {
        const tableSuggestions = tableNames
          .filter((t) => t.toUpperCase().startsWith(prefix))
          .map((t) => ({
            label: t,
            kind: monaco.languages.CompletionItemKind.Class,
            detail: 'Table',
            insertText: t,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
            sortText: '0_' + t,
          }));

        return {
          suggestions: tableSuggestions,
        };
      }

      const keywordSuggestions = SQL_KEYWORDS
        .filter((k) => k.startsWith(prefix))
        .map((k) => ({
          label: k,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: k,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
          sortText: '1_' + k,
        }));

      const functionSuggestions = SQL_FUNCTIONS
        .filter((f) => f.name.startsWith(prefix))
        .map((f) => ({
          label: f.name,
          kind: monaco.languages.CompletionItemKind.Function,
          detail: t(f.detail),
          insertText: f.insertText,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
          sortText: '2_' + f.name,
        }));

      const tableSuggestions = tableNames
        .filter((t) => t.toUpperCase().startsWith(prefix))
        .map((t) => ({
          label: t,
          kind: monaco.languages.CompletionItemKind.Class,
          detail: 'Table',
          insertText: t,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
          sortText: '3_' + t,
        }));

      const columnSuggestions = columnNames
        .filter((c) => c.toUpperCase().startsWith(prefix))
        .map((c) => ({
          label: c,
          kind: monaco.languages.CompletionItemKind.Property,
          detail: 'Column',
          insertText: c,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
          sortText: '4_' + c,
        }));

      return {
        suggestions: [
          ...keywordSuggestions,
          ...functionSuggestions,
          ...tableSuggestions,
          ...columnSuggestions,
        ],
      };
    },
  });
}

export function unregisterSqlCompletionProvider(): void {
  if (completionProviderDisposable) {
    completionProviderDisposable.dispose();
    completionProviderDisposable = null;
  }
}

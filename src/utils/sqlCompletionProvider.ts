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
  { name: 'SUM', detail: '聚合函数: 返回数值列的总和', insertText: 'SUM(${1:expr})' },
  { name: 'AVG', detail: '聚合函数: 返回数值列的平均值', insertText: 'AVG(${1:expr})' },
  { name: 'COUNT', detail: '聚合函数: 返回行数', insertText: 'COUNT(${1:expr})' },
  { name: 'MIN', detail: '聚合函数: 返回列的最小值', insertText: 'MIN(${1:expr})' },
  { name: 'MAX', detail: '聚合函数: 返回列的最大值', insertText: 'MAX(${1:expr})' },
  { name: 'FIRST', detail: '聚合函数: 返回第一个值', insertText: 'FIRST(${1:expr})' },
  { name: 'LAST', detail: '聚合函数: 返回最后一个值', insertText: 'LAST(${1:expr})' },
  { name: 'MEDIAN', detail: '聚合函数: 返回中位数', insertText: 'MEDIAN(${1:expr})' },
  { name: 'MODE', detail: '聚合函数: 返回众数', insertText: 'MODE(${1:expr})' },
  { name: 'STDDEV', detail: '聚合函数: 返回标准差', insertText: 'STDDEV(${1:expr})' },
  { name: 'VARIANCE', detail: '聚合函数: 返回方差', insertText: 'VARIANCE(${1:expr})' },
  { name: 'GROUP_CONCAT', detail: '聚合函数: 连接字符串', insertText: 'GROUP_CONCAT(${1:expr})' },
  { name: 'STRING_AGG', detail: '聚合函数: 连接字符串', insertText: 'STRING_AGG(${1:expr}, ${2:separator})' },
  { name: 'ARRAY_AGG', detail: '聚合函数: 收集到数组中', insertText: 'ARRAY_AGG(${1:expr})' },
  { name: 'UPPER', detail: '字符串函数: 转换为大写', insertText: 'UPPER(${1:string})' },
  { name: 'LOWER', detail: '字符串函数: 转换为小写', insertText: 'LOWER(${1:string})' },
  { name: 'LENGTH', detail: '字符串函数: 返回字符串长度', insertText: 'LENGTH(${1:string})' },
  { name: 'LEN', detail: '字符串函数: 返回字符串长度', insertText: 'LEN(${1:string})' },
  { name: 'TRIM', detail: '字符串函数: 移除两端空格', insertText: 'TRIM(${1:string})' },
  { name: 'LTRIM', detail: '字符串函数: 移除左侧空格', insertText: 'LTRIM(${1:string})' },
  { name: 'RTRIM', detail: '字符串函数: 移除右侧空格', insertText: 'RTRIM(${1:string})' },
  { name: 'SUBSTR', detail: '字符串函数: 提取子字符串', insertText: 'SUBSTR(${1:string}, ${2:start}, ${3:length})' },
  { name: 'SUBSTRING', detail: '字符串函数: 提取子字符串', insertText: 'SUBSTRING(${1:string}, ${2:start}, ${3:length})' },
  { name: 'CONCAT', detail: '字符串函数: 连接字符串', insertText: 'CONCAT(${1:string1}, ${2:string2})' },
  { name: 'CONCAT_WS', detail: '字符串函数: 用分隔符连接字符串', insertText: 'CONCAT_WS(${1:separator}, ${2:string1}, ${3:string2})' },
  { name: 'REPLACE', detail: '字符串函数: 替换子字符串', insertText: 'REPLACE(${1:string}, ${2:from}, ${3:to})' },
  { name: 'REGEXP_MATCHES', detail: '字符串函数: 正则匹配', insertText: 'REGEXP_MATCHES(${1:string}, ${2:pattern})' },
  { name: 'SPLIT_PART', detail: '字符串函数: 分割字符串并取第n部分', insertText: 'SPLIT_PART(${1:string}, ${2:delimiter}, ${3:field})' },
  { name: 'LEFT', detail: '字符串函数: 返回左侧n个字符', insertText: 'LEFT(${1:string}, ${2:n})' },
  { name: 'RIGHT', detail: '字符串函数: 返回右侧n个字符', insertText: 'RIGHT(${1:string}, ${2:n})' },
  { name: 'REVERSE', detail: '字符串函数: 反转字符串', insertText: 'REVERSE(${1:string})' },
  { name: 'LPAD', detail: '字符串函数: 左侧填充', insertText: 'LPAD(${1:string}, ${2:length}, ${3:pad})' },
  { name: 'RPAD', detail: '字符串函数: 右侧填充', insertText: 'RPAD(${1:string}, ${2:length}, ${3:pad})' },
  { name: 'FORMAT', detail: '字符串函数: 格式化字符串', insertText: 'FORMAT(${1:format}, ${2:args})' },
  { name: 'CURRENT_DATE', detail: '日期函数: 当前日期', insertText: 'CURRENT_DATE' },
  { name: 'CURRENT_TIME', detail: '日期函数: 当前时间', insertText: 'CURRENT_TIME' },
  { name: 'CURRENT_TIMESTAMP', detail: '日期函数: 当前时间戳', insertText: 'CURRENT_TIMESTAMP' },
  { name: 'DATE', detail: '日期函数: 提取日期', insertText: 'DATE(${1:timestamp})' },
  { name: 'YEAR', detail: '日期函数: 提取年份', insertText: 'YEAR(${1:date})' },
  { name: 'MONTH', detail: '日期函数: 提取月份', insertText: 'MONTH(${1:date})' },
  { name: 'DAY', detail: '日期函数: 提取日', insertText: 'DAY(${1:date})' },
  { name: 'HOUR', detail: '日期函数: 提取小时', insertText: 'HOUR(${1:timestamp})' },
  { name: 'MINUTE', detail: '日期函数: 提取分钟', insertText: 'MINUTE(${1:timestamp})' },
  { name: 'SECOND', detail: '日期函数: 提取秒', insertText: 'SECOND(${1:timestamp})' },
  { name: 'EXTRACT', detail: '日期函数: 提取日期部分', insertText: 'EXTRACT(${1:part} FROM ${2:date})' },
  { name: 'DATE_TRUNC', detail: '日期函数: 截断日期', insertText: 'DATE_TRUNC(${1:precision}, ${2:timestamp})' },
  { name: 'DATE_PART', detail: '日期函数: 获取日期部分', insertText: 'DATE_PART(${1:part}, ${2:date})' },
  { name: 'AGE', detail: '日期函数: 计算年龄差', insertText: 'AGE(${1:date1}, ${2:date2})' },
  { name: 'TO_DATE', detail: '日期函数: 转换为日期', insertText: 'TO_DATE(${1:string}, ${2:format})' },
  { name: 'TO_TIMESTAMP', detail: '日期函数: 转换为时间戳', insertText: 'TO_TIMESTAMP(${1:string}, ${2:format})' },
  { name: 'STRFTIME', detail: '日期函数: 格式化日期', insertText: 'STRFTIME(${1:format}, ${2:date})' },
  { name: 'ABS', detail: '数学函数: 绝对值', insertText: 'ABS(${1:number})' },
  { name: 'ROUND', detail: '数学函数: 四舍五入', insertText: 'ROUND(${1:number}, ${2:decimals})' },
  { name: 'FLOOR', detail: '数学函数: 向下取整', insertText: 'FLOOR(${1:number})' },
  { name: 'CEIL', detail: '数学函数: 向上取整', insertText: 'CEIL(${1:number})' },
  { name: 'CEILING', detail: '数学函数: 向上取整', insertText: 'CEILING(${1:number})' },
  { name: 'SQRT', detail: '数学函数: 平方根', insertText: 'SQRT(${1:number})' },
  { name: 'POW', detail: '数学函数: 幂运算', insertText: 'POW(${1:base}, ${2:exponent})' },
  { name: 'POWER', detail: '数学函数: 幂运算', insertText: 'POWER(${1:base}, ${2:exponent})' },
  { name: 'MOD', detail: '数学函数: 取模', insertText: 'MOD(${1:dividend}, ${2:divisor})' },
  { name: 'LOG', detail: '数学函数: 自然对数', insertText: 'LOG(${1:number})' },
  { name: 'LOG10', detail: '数学函数: 以10为底的对数', insertText: 'LOG10(${1:number})' },
  { name: 'LN', detail: '数学函数: 自然对数', insertText: 'LN(${1:number})' },
  { name: 'EXP', detail: '数学函数: e的指数', insertText: 'EXP(${1:number})' },
  { name: 'RANDOM', detail: '数学函数: 随机数', insertText: 'RANDOM()' },
  { name: 'SIN', detail: '数学函数: 正弦', insertText: 'SIN(${1:radians})' },
  { name: 'COS', detail: '数学函数: 余弦', insertText: 'COS(${1:radians})' },
  { name: 'TAN', detail: '数学函数: 正切', insertText: 'TAN(${1:radians})' },
  { name: 'COALESCE', detail: '条件函数: 返回第一个非空值', insertText: 'COALESCE(${1:expr1}, ${2:expr2})' },
  { name: 'NULLIF', detail: '条件函数: 两值相等返回NULL', insertText: 'NULLIF(${1:expr1}, ${2:expr2})' },
  { name: 'IFNULL', detail: '条件函数: 若为NULL则返回替代值', insertText: 'IFNULL(${1:expr}, ${2:default})' },
  { name: 'GREATEST', detail: '条件函数: 返回最大值', insertText: 'GREATEST(${1:expr1}, ${2:expr2})' },
  { name: 'LEAST', detail: '条件函数: 返回最小值', insertText: 'LEAST(${1:expr1}, ${2:expr2})' },
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

export function registerSqlCompletionProvider(monaco: typeof Monaco): void {
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
          detail: f.detail,
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

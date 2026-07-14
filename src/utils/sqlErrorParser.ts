export interface ParsedSqlError {
  lineNumber: number | null;
  message: string;
}

export function parseSqlError(errorMessage: string): ParsedSqlError {
  if (!errorMessage) {
    return { lineNumber: null, message: errorMessage || '' };
  }

  const patterns = [
    /Error at line\s+(\d+)/i,
    /Parse error at line\s+(\d+)/i,
    /line\s+(\d+):/i,
    /line\s+(\d+),/i,
    /line\s+(\d+)\s/i,
  ];

  for (const pattern of patterns) {
    const match = errorMessage.match(pattern);
    if (match && match[1]) {
      const lineNumber = parseInt(match[1], 10);
      if (!isNaN(lineNumber) && lineNumber > 0) {
        return { lineNumber, message: errorMessage };
      }
    }
  }

  return { lineNumber: null, message: errorMessage };
}

export function calculateErrorLineOffset(
  fullSql: string,
  statement: string
): number {
  const statementIndex = fullSql.indexOf(statement);
  if (statementIndex === -1) return 0;

  const beforeStatement = fullSql.substring(0, statementIndex);
  const lineCount = (beforeStatement.match(/\n/g) || []).length;
  return lineCount;
}

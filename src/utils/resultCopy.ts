/**
 * resultCopy.ts — SQL 查询结果复制引擎
 *
 * 归一化中间层 CopyPayload：任何来源（选区/行/全表）都先转成 CopyPayload，
 * 再统一输出为 TSV / CSV / Markdown / JSON / INSERT 五种格式。
 *
 * 所有函数均为纯函数（writeClipboard 除外），便于单元测试。
 */

import { isNullToken } from './cellTypeDetection';

// ============================================================
// 类型定义
// ============================================================

export type CopyFormat = 'tsv' | 'csv' | 'markdown' | 'json' | 'insert';

/** 归一化数据包：选区/行/全表都先转成这个 */
export interface CopyPayload {
  /** 列名（按输出列顺序） */
  columns: string[];
  /** 行数据（按输出行顺序）；null 表示 NULL */
  rows: (string | null)[][];
}

export interface CopyOptions {
  /** 是否包含表头（默认 true） */
  includeHeader: boolean;
  /** 复制时 null 的表示文本（默认 ''，可设 'NULL'） */
  nullText: string;
}

export const DEFAULT_COPY_OPTIONS: CopyOptions = {
  includeHeader: true,
  nullText: '',
};

// ============================================================
// 选区 / 行 / 全表 → CopyPayload
// ============================================================

/** 内部 colId 前缀（与 ResultGrid columnDefs 生成规则一致） */
const COL_ID_PREFIX = 'col';
/** 行号列 colId（复制时忽略） */
const ROWNUM_COL_ID = '__rownum__';

/**
 * 从 colId 提取列索引。colId 格式为 "col0", "col1" 等。
 * 返回 -1 表示无法解析（如 __rownum__）。
 */
export function colIdToIndex(colId: string): number {
  if (colId === ROWNUM_COL_ID) return -1;
  if (colId.startsWith(COL_ID_PREFIX)) {
    const idx = parseInt(colId.slice(COL_ID_PREFIX.length), 10);
    return Number.isNaN(idx) ? -1 : idx;
  }
  return -1;
}

/**
 * 从选区矩阵提取行索引并集；升序去重；负数或 >=rowCount 过滤；空矩阵返回 []
 */
export function normalizeRowIndices(
  matrix: Map<number, Set<string>> | null,
  rowCount: number,
): number[] {
  if (!matrix || matrix.size === 0) return [];
  const result: number[] = [];
  const seen = new Set<number>();
  for (const rowIdx of matrix.keys()) {
    if (rowIdx < 0 || rowIdx >= rowCount) continue;
    if (seen.has(rowIdx)) continue;
    seen.add(rowIdx);
    result.push(rowIdx);
  }
  return result.sort((a, b) => a - b);
}

/**
 * 遍历 matrix.values()，收集 colId，调用 colIdToIndex 映射到列索引；
 * 过滤 <0 或 >=colCount；升序去重；空矩阵返回 []
 */
export function normalizeColIndices(
  matrix: Map<number, Set<string>> | null,
  colCount: number,
): number[] {
  if (!matrix || matrix.size === 0) return [];
  const result: number[] = [];
  const seen = new Set<number>();
  for (const colSet of matrix.values()) {
    for (const colId of colSet) {
      const idx = colIdToIndex(colId);
      if (idx < 0 || idx >= colCount) continue;
      if (seen.has(idx)) continue;
      seen.add(idx);
      result.push(idx);
    }
  }
  return result.sort((a, b) => a - b);
}

/**
 * 对 rowIndices 做升序去重；过滤 0 <= i < rows.length；
 * 每行的 cells = 所有列（columns 全部）的原值；NULL_TOKEN → null
 */
export function rowsToPayload(
  rowIndices: number[],
  columns: string[],
  rows: string[][],
): CopyPayload {
  const sortedUnique = [...new Set(rowIndices)]
    .filter(i => i >= 0 && i < rows.length)
    .sort((a, b) => a - b);

  const outRows: (string | null)[][] = sortedUnique.map(rowIdx => {
    const rawRow = rows[rowIdx] || [];
    return columns.map((_, colIdx) => {
      const val = rawRow[colIdx];
      return isNullToken(val) ? null : (val === undefined ? null : val);
    });
  });

  return { columns: [...columns], rows: outRows };
}

/**
 * colIndices：先升序去重 + 过滤合法索引；
 * 返回的 payload.columns = colIndices.map(i => columns[i])（列子集，保留原顺序）；
 * payload.rows = rows 每一行 → 只取 colIndices 对应位置（同样做 NULL_TOKEN → null 映射）
 */
export function colsToPayload(
  colIndices: number[],
  columns: string[],
  rows: string[][],
): CopyPayload {
  const sortedUnique = [...new Set(colIndices)]
    .filter(i => i >= 0 && i < columns.length)
    .sort((a, b) => a - b);

  const outColumns = sortedUnique.map(i => columns[i]);
  const outRows: (string | null)[][] = rows.map(row =>
    sortedUnique.map(colIdx => {
      const val = row[colIdx];
      return isNullToken(val) ? null : (val === undefined ? null : val);
    }),
  );

  return { columns: outColumns, rows: outRows };
}

/**
 * 将选区矩阵转换为 CopyPayload。
 *
 * @param matrix  选区矩阵：Map<rowIndex, Set<colId>>
 * @param columns 列名数组（如 ["id", "name", "age"]）
 * @param rows    原始行数据（如 [["1", "Alice", "30"], ...]）
 * @returns CopyPayload，列取所有选中列的并集，行按索引升序
 */
export function matrixToPayload(
  matrix: Map<number, Set<string>>,
  columns: string[],
  rows: string[][],
): CopyPayload {
  if (matrix.size === 0) {
    return { columns: [], rows: [] };
  }

  // 收集所有选中的列索引（并集），去重并排序
  const selectedColIndicesSet = new Set<number>();
  for (const colSet of matrix.values()) {
    for (const colId of colSet) {
      const idx = colIdToIndex(colId);
      if (idx >= 0 && idx < columns.length) {
        selectedColIndicesSet.add(idx);
      }
    }
  }

  const sortedColIndices = [...selectedColIndicesSet].sort((a, b) => a - b);
  if (sortedColIndices.length === 0) {
    return { columns: [], rows: [] };
  }

  const outColumns = sortedColIndices.map(i => columns[i]);

  // 按行索引升序，每行提取选中列的值
  const sortedRowIndices = [...matrix.keys()].sort((a, b) => a - b);
  const outRows: (string | null)[][] = sortedRowIndices.map(rowIdx => {
    const colSet = matrix.get(rowIdx);
    const rawRow = rows[rowIdx] || [];
    return sortedColIndices.map(colIdx => {
      // 如果该单元格不在选区中，用空字符串
      const colId = `${COL_ID_PREFIX}${colIdx}`;
      if (!colSet?.has(colId)) {
        return '';
      }
      const val = rawRow[colIdx];
      return val === undefined ? null : val;
    });
  });

  return { columns: outColumns, rows: outRows };
}

/**
 * 将单行转换为 CopyPayload。
 */
export function rowToPayload(
  rowIndex: number,
  columns: string[],
  rows: string[][],
): CopyPayload {
  const rawRow = rows[rowIndex] || [];
  const outRow: (string | null)[] = columns.map((_, i) => {
    const val = rawRow[i];
    return val === undefined ? null : val;
  });
  return { columns: [...columns], rows: [outRow] };
}

/**
 * 将整个表格转换为 CopyPayload。
 */
export function tableToPayload(
  rows: string[][],
  columns: string[],
): CopyPayload {
  const outRows: (string | null)[][] = rows.map(row =>
    columns.map((_, i) => {
      const val = row[i];
      return val === undefined ? null : val;
    }),
  );
  return { columns: [...columns], rows: outRows };
}

// ============================================================
// CopyPayload → 文本
// ============================================================

/** 空值渲染：复制时 null 用 nullText 替代 */
function renderCell(val: string | null, nullText: string): string {
  if (val === null) return nullText;
  return val;
}

/**
 * TSV 格式：制表符分隔，单元格内 \t/\n 替换为空格（Excel 粘贴安全）。
 */
export function payloadToTSV(
  payload: CopyPayload,
  opts: Partial<CopyOptions> = {},
): string {
  const o = { ...DEFAULT_COPY_OPTIONS, ...opts };
  const { columns, rows } = payload;

  const sanitize = (s: string): string => s.replace(/[\t\n\r]/g, ' ');

  const lines: string[] = [];
  if (o.includeHeader && columns.length > 0) {
    lines.push(columns.map(sanitize).join('\t'));
  }
  for (const row of rows) {
    lines.push(row.map(v => sanitize(renderCell(v, o.nullText))).join('\t'));
  }
  return lines.join('\n');
}

/**
 * CSV 格式：RFC 4180 转义（含引号、逗号、换行的单元格加双引号包裹）。
 */
export function payloadToCSV(
  payload: CopyPayload,
  opts: Partial<CopyOptions> = {},
): string {
  const o = { ...DEFAULT_COPY_OPTIONS, ...opts };
  const { columns, rows } = payload;

  const escapeCSV = (s: string): string => {
    if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines: string[] = [];
  if (o.includeHeader && columns.length > 0) {
    lines.push(columns.map(escapeCSV).join(','));
  }
  for (const row of rows) {
    lines.push(row.map(v => escapeCSV(renderCell(v, o.nullText))).join(','));
  }
  return lines.join('\n');
}

/**
 * Markdown 表格格式：| col1 | col2 | + | --- | --- | 分隔行。
 */
export function payloadToMarkdown(
  payload: CopyPayload,
  opts: Partial<CopyOptions> = {},
): string {
  const o = { ...DEFAULT_COPY_OPTIONS, ...opts };
  const { columns, rows } = payload;

  const escapeMd = (s: string): string => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

  if (columns.length === 0 && rows.length === 0) {
    return '';
  }

  const lines: string[] = [];

  // 表头
  const headerCells = columns.length > 0
    ? columns.map(c => escapeMd(c))
    : rows[0].map((_, i) => `col${i}`);
  lines.push(`| ${headerCells.join(' | ')} |`);
  // 对齐行
  lines.push(`| ${headerCells.map(() => '---').join(' | ')} |`);
  // 数据行
  for (const row of rows) {
    const cells = row.map(v => {
      const rendered = renderCell(v, o.nullText);
      return rendered === '' ? ' ' : escapeMd(rendered);
    });
    lines.push(`| ${cells.join(' | ')} |`);
  }
  return lines.join('\n');
}

/**
 * JSON 格式：[{ "col1": "val1", "col2": null }, ...] 数组对象。
 */
export function payloadToJSON(
  payload: CopyPayload,
  opts: Partial<CopyOptions> = {},
): string {
  const o = { ...DEFAULT_COPY_OPTIONS, ...opts };
  const { columns, rows } = payload;

  const objects = rows.map(row => {
    const obj: Record<string, string | null> = {};
    columns.forEach((col, i) => {
      const val = row[i];
      obj[col] = val === null ? null : renderCell(val, o.nullText);
    });
    return obj;
  });

  return JSON.stringify(objects, null, 2);
}

/**
 * INSERT 语句格式：INSERT INTO table (col1, col2) VALUES ('v1','v2'),(...);
 *
 * 字符串值中单引号转义为 ''；null → NULL（不加引号）。
 *
 * @param payload  数据包
 * @param opts.copyOptions  复制选项
 * @param opts.table  表名（从 SQL 语句中提取或使用默认值）
 */
export function payloadToInsert(
  payload: CopyPayload,
  opts: { copyOptions?: Partial<CopyOptions>; table: string },
): string {
  const { columns, rows } = payload;

  if (columns.length === 0 || rows.length === 0) {
    return '';
  }

  const colList = columns.join(', ');

  const valueTuples = rows.map(row => {
    const values = row.map(v => {
      if (v === null) return 'NULL';
      const escaped = v.replace(/'/g, "''");
      return `'${escaped}'`;
    });
    return `(${values.join(', ')})`;
  });

  return `INSERT INTO ${opts.table} (${colList}) VALUES\n${valueTuples.join(',\n')};`;
}

// ============================================================
// 剪贴板写入（带降级）
// ============================================================

/**
 * 写入剪贴板：优先 navigator.clipboard API，失败时降级到 textarea + execCommand。
 *
 * WebView2 在窗口失焦时 navigator.clipboard 可能 reject，
 * execCommand 同步路径作为兜底。
 *
 * @returns true 表示写入成功
 */
export async function writeClipboard(text: string): Promise<boolean> {
  // 优先使用现代 Clipboard API
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 降级到 execCommand
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

/**
 * 从 SQL 语句中提取表名（用于 INSERT 语句）。
 * 尝试匹配 FROM / INTO / UPDATE 后的表名。
 * 失败时返回 defaultTable。
 */
export function extractTableName(sql: string, defaultTable = 'my_table'): string {
  // INSERT INTO table_name
  let m = sql.match(/insert\s+into\s+([a-zA-Z_][\w.]*)/i);
  if (m) return m[1];

  // UPDATE table_name
  m = sql.match(/update\s+([a-zA-Z_][\w.]*)/i);
  if (m) return m[1];

  // SELECT ... FROM table_name
  m = sql.match(/from\s+([a-zA-Z_][\w.]*)/i);
  if (m) return m[1];

  return defaultTable;
}

/**
 * cellTypeDetection.ts — 前端类型启发式探测
 *
 * 后端返回的 rows 为 string[][]，其中 SQL NULL 序列化为 "NULL"（见
 * duckdb.rs / sqlite.rs 的 get_value_as_string 实现）。
 *
 * 本模块通过抽样前 N 行推断每列类型，用于：
 * - 数值列排序为数值序（coerceCell 返回 number）
 * - 布尔列返回 boolean
 * - NULL 单元格识别与灰色斜体渲染
 * - INSERT 复制时数字不加引号 // safe_sql: 注释中引用 SQL 关键字
 */

// ============================================================
// 类型定义
// ============================================================

export type CellType = 'integer' | 'float' | 'date' | 'datetime' | 'boolean' | 'string';

export interface ColumnTypeInfo {
  /** 探测出的列类型 */
  type: CellType;
  /** NULL 值比例（0-1），用于判断列是否大量含 NULL */
  nullRatio: number;
}

// ============================================================
// 常量
// ============================================================

/** 后端将 SQL NULL 序列化为此字符串 */
export const NULL_TOKEN = 'NULL';

/** 整数正则：可选正负号 + 数字（不支持科学计数法） */
const INTEGER_RE = /^[+-]?\d+$/;

/** 浮点数正则：可选正负号 + 数字 + 小数点 + 可选指数 */
const FLOAT_RE = /^[+-]?(\d+\.\d*|\.\d+|\d+)([eE][+-]?\d+)?$/;

/** ISO 日期：YYYY-MM-DD */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** ISO 日期时间：YYYY-MM-DDTHH:mm:ss 或 YYYY-MM-DD HH:mm:ss[.fff] */
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:?\d{2})?$/;

/** 布尔值：true / false（大小写不敏感） */
const BOOLEAN_RE = /^(true|false)$/i;

// ============================================================
// 探测函数
// ============================================================

/**
 * 检测单个值是否为 NULL 标记。
 * 后端将 SQL NULL 序列化为字符串 "NULL"。
 */
export function isNullToken(value: string | null | undefined): boolean {
  if (value === null || value === undefined) return true;
  return value === NULL_TOKEN;
}

/**
 * 检测单个字符串值的类型（不包含 NULL 判定）。
 * 已知为 NULL 的值应先过滤再调用。
 */
function detectSingleType(value: string): Exclude<CellType, 'string'> | null {
  if (INTEGER_RE.test(value)) return 'integer';
  if (FLOAT_RE.test(value)) return 'float';
  if (BOOLEAN_RE.test(value)) return 'boolean';
  if (DATE_RE.test(value)) return 'date';
  if (DATETIME_RE.test(value)) return 'datetime';
  return null;
}

/**
 * 对一列数据进行类型探测。
 *
 * 规则：
 * - 抽样前 sampleSize 行
 * - 跳过 NULL 值
 * - 所有非 NULL 样本 100% 匹配同一类型才判定为该类型
 * - 否则为 string
 *
 * @param columnValues 该列所有值（字符串数组）
 * @param sampleSize 抽样行数，默认 100
 * @returns 列类型信息
 */
export function detectColumnType(
  columnValues: string[],
  sampleSize = 100,
): ColumnTypeInfo {
  const sample = columnValues.slice(0, sampleSize);
  let nullCount = 0;
  let nonNullCount = 0;
  let detectedType: CellType | null = null;

  for (const val of sample) {
    if (isNullToken(val)) {
      nullCount++;
      continue;
    }
    nonNullCount++;

    const cellType = detectSingleType(val);
    if (cellType === null) {
      // 任一非 NULL 值无法识别 → string
      detectedType = 'string';
      break;
    }

    if (detectedType === null) {
      detectedType = cellType;
    } else if (detectedType !== cellType) {
      // 类型不一致：integer 和 float 可以兼容为 float
      const compat: Record<string, Set<string>> = {
        integer: new Set(['integer', 'float']),
        float: new Set(['integer', 'float']),
      };
      const compatSet = compat[detectedType];
      if (!compatSet || !compatSet.has(cellType)) {
        detectedType = 'string';
        break;
      }
      // integer + float → float
      if (detectedType === 'integer' && cellType === 'float') {
        detectedType = 'float';
      }
    }
  }

  const total = sample.length;
  const nullRatio = total > 0 ? nullCount / total : 0;

  // 空数据集（无样本）或全部为 NULL 的列都按 string 处理
  // 空数据集 nullRatio = 0；全 NULL 列 nullRatio = 1
  if (nonNullCount === 0) {
    return { type: 'string', nullRatio: total > 0 ? 1 : 0 };
  }

  return {
    type: detectedType ?? 'string',
    nullRatio,
  };
}

/**
 * 批量探测所有列的类型。
 *
 * @param rows 二维数据行（后端返回的 string[][]）
 * @param columnCount 列数
 * @param sampleSize 每列抽样行数
 * @returns 每列的类型信息数组
 */
export function detectColumnTypes(
  rows: string[][],
  columnCount: number,
  sampleSize = 100,
): ColumnTypeInfo[] {
  const result: ColumnTypeInfo[] = [];

  for (let colIdx = 0; colIdx < columnCount; colIdx++) {
    const columnValues = rows
      .slice(0, sampleSize)
      .map(row => row[colIdx] ?? NULL_TOKEN);
    result.push(detectColumnType(columnValues, sampleSize));
  }

  return result;
}

// ============================================================
// 类型转换
// ============================================================

/**
 * 将单元格字符串值按列类型转换为对应的 JS 原生类型。
 *
 * - NULL → null（用于 ag-grid 排序和 NULL 样式判定）
 * - integer/float → number
 * - boolean → boolean
 * - date/datetime/string → 原字符串
 *
 * @param value 后端返回的字符串值
 * @param type 列类型
 * @returns 转换后的值
 */
export function coerceCell(
  value: string | null | undefined,
  type: CellType,
): string | number | boolean | null {
  if (isNullToken(value)) return null;

  const str = value as string;

  switch (type) {
    case 'integer':
    case 'float': {
      const num = type === 'integer' ? parseInt(str, 10) : parseFloat(str);
      return Number.isNaN(num) ? str : num;
    }
    case 'boolean':
      return /^true$/i.test(str);
    case 'date':
    case 'datetime':
    case 'string':
    default:
      return str;
  }
}

/**
 * 筛选器 SQL 注入工具
 *
 * 将仪表盘筛选器的值转换为 SQL WHERE 条件，并注入到图表的原始 SQL 中。
 * 用于实现"筛选器联动"：筛选值变化时，图表数据自动按条件过滤。
 *
 * 支持的筛选器类型：
 *   - 'text'        → WHERE field LIKE '%value%'
 *   - 'select'      → WHERE field = 'value'（多值逗号分隔 → IN (...)）
 *   - 'date-range'  → WHERE field BETWEEN 'start' AND 'end'
 *
 * 安全说明：
 *   - 字符串值通过转义单引号防止 SQL 注入（' → ''）
 *   - 仅支持 SELECT 语句的 WHERE 注入，不处理 INSERT/UPDATE/DELETE // safe_sql: 注释中引用 SQL 关键字
 *   - 若 SQL 已有 WHERE 子句，则追加 AND 条件；否则新增 WHERE
 */

import type { DashboardFilter } from '../types/dashboard';

/** 转义 SQL 字符串字面量中的单引号，防止注入 */
function escapeSqlValue(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * 将单个筛选器的值转换为 SQL WHERE 片段
 *
 * @param filter 筛选器定义
 * @param value 当前值（字符串或字符串数组）
 * @returns SQL WHERE 片段（不含 WHERE/AND 关键字），若值为空则返回 null
 */
function buildWhereClause(
  filter: DashboardFilter,
  value: string | string[],
): string | null {
  const { field, type } = filter;

  // 空值不生成条件
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    // 数组值 → IN (...)
    const items = value.map((v) => `'${escapeSqlValue(v)}'`).join(', ');
    return `${field} IN (${items})`;
  }

  const strValue = String(value);

  if (type === 'date-range') {
    // 日期范围格式：'startDate|endDate'
    const parts = strValue.split('|');
    if (parts.length === 2 && parts[0] && parts[1]) {
      return `${field} BETWEEN '${escapeSqlValue(parts[0])}' AND '${escapeSqlValue(parts[1])}'`;
    }
    if (parts.length === 2 && parts[0] && !parts[1]) {
      return `${field} >= '${escapeSqlValue(parts[0])}'`;
    }
    if (parts.length === 2 && !parts[0] && parts[1]) {
      return `${field} <= '${escapeSqlValue(parts[1])}'`;
    }
    return null;
  }

  if (type === 'select') {
    // select 可能是多值（逗号分隔）→ IN (...)
    if (strValue.includes(',')) {
      const items = strValue
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v)
        .map((v) => `'${escapeSqlValue(v)}'`)
        .join(', ');
      return items ? `${field} IN (${items})` : null;
    }
    return `${field} = '${escapeSqlValue(strValue)}'`;
  }

  // text 类型 → LIKE 模糊匹配
  return `${field} LIKE '%${escapeSqlValue(strValue)}%'`;
}

/**
 * 将筛选条件注入到原始 SQL 中
 *
 * 策略：
 *   1. 收集所有非空的筛选条件
 *   2. 若无有效条件，返回原始 SQL（不修改）
 *   3. 若 SQL 已含 WHERE（不区分大小写），追加 AND 条件
 *   4. 否则在 SQL 末尾（ORDER BY/LIMIT 之前）插入 WHERE
 *
 * @param originalSql 原始 SQL 语句
 * @param filterValues 筛选值映射 { field: value }
 * @param filters 筛选器定义列表
 * @returns 注入筛选条件后的 SQL
 */
export function applyFiltersToSql(
  originalSql: string,
  filterValues: Record<string, string | string[]>,
  filters: DashboardFilter[],
): string {
  if (!originalSql || !filters || filters.length === 0) {
    return originalSql;
  }

  // 收集所有非空的 WHERE 条件
  const whereClauses: string[] = [];
  for (const filter of filters) {
    const value = filterValues[filter.field];
    if (value === undefined) continue;
    const clause = buildWhereClause(filter, value);
    if (clause) {
      whereClauses.push(clause);
    }
  }

  // 无有效条件，返回原始 SQL
  if (whereClauses.length === 0) {
    return originalSql;
  }

  const whereStr = whereClauses.join(' AND ');
  const sql = originalSql.trim();

  // 检测是否已有 WHERE 子句（不区分大小写）
  const hasWhere = /\bWHERE\b/i.test(sql);

  if (hasWhere) {
    // 已有 WHERE，追加 AND 条件
    return `${sql} AND ${whereStr}`;
  }

  // 无 WHERE，需要插入 WHERE 子句
  // 在 ORDER BY / LIMIT / GROUP BY 之前插入
  const insertMatch = sql.match(/\b(ORDER\s+BY|LIMIT|GROUP\s+BY|HAVING)\b/i);
  if (insertMatch && insertMatch.index !== undefined) {
    const insertPos = insertMatch.index;
    return `${sql.slice(0, insertPos)}WHERE ${whereStr} ${sql.slice(insertPos)}`;
  }

  // 末尾追加
  return `${sql} WHERE ${whereStr}`;
}

/**
 * 判断筛选值是否有非空的有效值
 * 用于判断是否需要触发图表刷新
 */
export function hasActiveFilters(
  filterValues: Record<string, string | string[]>,
): boolean {
  return Object.values(filterValues).some((v) => {
    if (v === null || v === undefined) return false;
    if (typeof v === 'string') return v.trim() !== '';
    if (Array.isArray(v)) return v.length > 0;
    return false;
  });
}

export default applyFiltersToSql;

/**
 * 图表结果段选择工具
 *
 * 背景：`execute_sql` 对多语句 SQL 返回 BatchExecuteResult —— results 按语句顺序排列
 * （见 SqlExecutionService::execute_sql_batch：split_sql_statements 拆分后逐条执行，
 * 每条语句 push 一个 SqlStatementResult）。
 *
 * 图表的 x/y 轴列通常只在其中一条语句（一般是最后的聚合查询）里存在。若盲目取
 * results[0]，很可能拿到列不匹配的结果段，使 generate_chart_config 因缺列报错
 * （「找不到Y轴列」/「找不到数值列」）。
 *
 * 典型事故（2026-10-24，用户反馈「切换图表类型预览完全不更新」）：
 *   图表 SQL 为两条语句——
 *     SELECT * FROM employees WHERE age BETWEEN 30 AND 40;      -- 语句1：探索用，列中无 cn
 *     SELECT department, count(*) cn FROM employees ...;        -- 语句2：真正的图表查询
 *   编辑图表类型时重建 config 取 results[0]（语句1）→ 缺 cn 列 → 生成失败静默返回
 *   → 旧 config 继续短路直渲 → 预览与保存均不生效。
 *
 * 策略：返回列集合完整包含 [xAxis, ...yAxis] 的**第一个**结果段；没有任何结果段
 * 匹配时退化为 results[0]（保持旧行为，让既有的缺列错误提示路径继续生效）。
 */

import type { SqlStatementResult } from '../types';

/**
 * 从多语句 SQL 的执行结果中挑选图表对应的结果段。
 *
 * @param results execute_sql 返回的结果数组（按语句顺序，可为 null/undefined）
 * @param xAxis   图表 X 轴列名
 * @param yAxis   图表 Y 轴列名列表（可为空数组）
 * @returns 匹配的结果段；results 为空时返回 null
 */
export function pickChartResultStatement(
  results: SqlStatementResult[] | null | undefined,
  xAxis: string,
  yAxis: string[],
): SqlStatementResult | null {
  if (!results || results.length === 0) return null;

  const requiredCols = [xAxis, ...(yAxis || [])].filter(
    (c): c is string => typeof c === 'string' && c.trim().length > 0,
  );
  // 没有轴信息时无法判断，保持旧行为取第一条
  if (requiredCols.length === 0) return results[0];

  const matched = results.find((r) => {
    const cols = r.columns;
    if (!cols || cols.length === 0) return false;
    return requiredCols.every((c) => cols.includes(c));
  });

  return matched ?? results[0];
}

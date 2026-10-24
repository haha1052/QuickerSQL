/**
 * pickChartResultStatement 单元测试（2026-10-24 新增）
 *
 * 锁定「多语句 SQL 结果段选择」行为：修复「切换图表类型预览不更新」根因的配套测试。
 * 真实事故：图表 SQL 含两条语句，results[0] 是探索查询（列中无图表 Y 轴列），
 * 盲目取 [0] 使 generate_chart_config 缺列报错、config 重建静默失败。
 *
 * 注意：describe/it 名称使用英文 —— 项目 i18n 严格门禁会扫描 src/utils 下的
 * 中文字符串字面量（注释不计），新增文件必须保持 0 hits（存量 167 处为既有债务）。
 */
import { describe, it, expect } from 'vitest';
import { pickChartResultStatement } from './chartResult';
import type { SqlStatementResult } from '../types';

const mkResult = (columns: string[], rows: string[][] = [['v']]): SqlStatementResult => ({
  statement: 'SELECT ...',
  success: true,
  error: null,
  columns,
  rows,
  affected_rows: null,
});

describe('pickChartResultStatement', () => {
  it('returns the only result for single-statement SQL', () => {
    const results = [mkResult(['city', 'avg_salary'])];
    const picked = pickChartResultStatement(results, 'city', ['avg_salary']);
    expect(picked).toBe(results[0]);
  });

  it('picks the result segment containing x/y columns for multi-statement SQL (real incident)', () => {
    const results = [
      // stmt1: SELECT * FROM employees WHERE age BETWEEN 30 AND 40 -- no cn column
      mkResult(['id', 'name', 'age', 'city', 'department', 'salary'], [['1', 'a', '30', 'BJ', 'Tech', '100']]),
      // stmt2: SELECT department, count(*) cn ... GROUP BY department -- the real chart query
      mkResult(['department', 'cn'], [['Tech', '5'], ['HR', '3']]),
    ];
    const picked = pickChartResultStatement(results, 'department', ['cn']);
    expect(picked).toBe(results[1]);
    expect(picked?.columns).toEqual(['department', 'cn']);
  });

  it('requires ALL y-axis columns to be present before matching', () => {
    const results = [
      mkResult(['city', 'emp_count']),
      mkResult(['city', 'emp_count', 'avg_salary']),
    ];
    const picked = pickChartResultStatement(results, 'city', ['emp_count', 'avg_salary']);
    expect(picked).toBe(results[1]);
  });

  it('falls back to results[0] when no segment matches (legacy behavior)', () => {
    const results = [mkResult(['a', 'b']), mkResult(['c', 'd'])];
    const picked = pickChartResultStatement(results, 'x', ['y']);
    expect(picked).toBe(results[0]);
  });

  it('returns null for empty input', () => {
    expect(pickChartResultStatement([], 'x', ['y'])).toBeNull();
    expect(pickChartResultStatement(null, 'x', ['y'])).toBeNull();
    expect(pickChartResultStatement(undefined, 'x', ['y'])).toBeNull();
  });

  it('skips result segments whose columns are null', () => {
    const results: SqlStatementResult[] = [
      { ...mkResult(['a']), columns: null },
      mkResult(['department', 'cn']),
    ];
    const picked = pickChartResultStatement(results, 'department', ['cn']);
    expect(picked).toBe(results[1]);
  });
});

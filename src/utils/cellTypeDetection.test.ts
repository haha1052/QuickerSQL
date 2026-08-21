/**
 * cellTypeDetection.test.ts — 类型探测单元测试
 *
 * 覆盖场景：
 * - 整数列 / 浮点列 / 日期列 / 日期时间列 / 布尔列 / 字符串列
 * - NULL 混合（部分 NULL / 全 NULL）
 * - integer + float 混合 → float
 * - 类型不一致 → string
 * - coerceCell 各类型转换
 * - isNullToken
 */
import { describe, it, expect } from 'vitest';
import {
  isNullToken,
  detectColumnType,
  detectColumnTypes,
  coerceCell,
  NULL_TOKEN,
} from './cellTypeDetection';

describe('isNullToken', () => {
  it('识别 "NULL" 字符串', () => {
    expect(isNullToken('NULL')).toBe(true);
  });

  it('识别 null / undefined', () => {
    expect(isNullToken(null)).toBe(true);
    expect(isNullToken(undefined)).toBe(true);
  });

  it('非 NULL 字符串返回 false', () => {
    expect(isNullToken('hello')).toBe(false);
    expect(isNullToken('')).toBe(false);
    expect(isNullToken('null')).toBe(false); // 小写不匹配
  });
});

describe('detectColumnType', () => {
  it('纯整数列 → integer', () => {
    const col = ['1', '2', '3', '-42', '0'];
    const info = detectColumnType(col);
    expect(info.type).toBe('integer');
    expect(info.nullRatio).toBe(0);
  });

  it('纯浮点列 → float', () => {
    const col = ['1.5', '2.0', '-3.14', '1e10'];
    const info = detectColumnType(col);
    expect(info.type).toBe('float');
  });

  it('整数 + 浮点混合 → float', () => {
    const col = ['1', '2.5', '3', '-4.0'];
    const info = detectColumnType(col);
    expect(info.type).toBe('float');
  });

  it('科学计数法 → float', () => {
    const col = ['1.5e10', '2.0E-5', '3e3'];
    const info = detectColumnType(col);
    expect(info.type).toBe('float');
  });

  it('日期列 → date', () => {
    const col = ['2024-01-15', '2023-12-31', '2025-06-01'];
    const info = detectColumnType(col);
    expect(info.type).toBe('date');
  });

  it('日期时间列 → datetime', () => {
    const col = ['2024-01-15T10:30:00', '2023-12-31 23:59:59', '2025-06-01 08:00:00.123'];
    const info = detectColumnType(col);
    expect(info.type).toBe('datetime');
  });

  it('布尔列 → boolean', () => {
    const col = ['true', 'false', 'TRUE', 'FALSE'];
    const info = detectColumnType(col);
    expect(info.type).toBe('boolean');
  });

  it('混合字符串 → string', () => {
    const col = ['hello', 'world', '2024-01-01', '42'];
    const info = detectColumnType(col);
    expect(info.type).toBe('string');
  });

  it('部分 NULL 的整数列 → integer + nullRatio > 0', () => {
    const col = ['1', 'NULL', '3', 'NULL', '5'];
    const info = detectColumnType(col);
    expect(info.type).toBe('integer');
    expect(info.nullRatio).toBeCloseTo(0.4);
  });

  it('全 NULL 列 → string + nullRatio = 1', () => {
    const col = ['NULL', 'NULL', 'NULL'];
    const info = detectColumnType(col);
    expect(info.type).toBe('string');
    expect(info.nullRatio).toBe(1);
  });

  it('空列 → string + nullRatio = 0', () => {
    const col: string[] = [];
    const info = detectColumnType(col);
    expect(info.type).toBe('string');
    expect(info.nullRatio).toBe(0);
  });

  it('整数与字符串混合 → string', () => {
    const col = ['1', '2', 'hello', '3'];
    const info = detectColumnType(col);
    expect(info.type).toBe('string');
  });

  it('抽样限制：超出 sampleSize 的行不影响判定', () => {
    const col = ['1', '2', '3', 'hello', '5', '6'];
    // sampleSize=3 只看前 3 行 → integer
    const info = detectColumnType(col, 3);
    expect(info.type).toBe('integer');
  });

  it('nullRatio 计算：3/5 NULL', () => {
    const col = ['NULL', '1', 'NULL', 'NULL', '2'];
    const info = detectColumnType(col);
    expect(info.nullRatio).toBeCloseTo(0.6);
  });
});

describe('detectColumnTypes', () => {
  it('批量探测多列', () => {
    const rows = [
      ['1', 'Alice', '30', 'true'],
      ['2', 'Bob', '25.5', 'false'],
      ['3', 'Charlie', 'NULL', 'true'],
    ];
    const infos = detectColumnTypes(rows, 4);
    expect(infos[0].type).toBe('integer');  // id
    expect(infos[1].type).toBe('string');   // name
    expect(infos[2].type).toBe('float');    // age (int + float → float)
    expect(infos[3].type).toBe('boolean');  // is_active
  });

  it('空数据集', () => {
    const infos = detectColumnTypes([], 3);
    expect(infos).toHaveLength(3);
    infos.forEach(info => {
      expect(info.type).toBe('string');
      expect(info.nullRatio).toBe(0);
    });
  });
});

describe('coerceCell', () => {
  it('integer → number', () => {
    expect(coerceCell('42', 'integer')).toBe(42);
    expect(coerceCell('-7', 'integer')).toBe(-7);
  });

  it('float → number', () => {
    expect(coerceCell('3.14', 'float')).toBeCloseTo(3.14);
    expect(coerceCell('1e10', 'float')).toBe(1e10);
  });

  it('boolean → boolean', () => {
    expect(coerceCell('true', 'boolean')).toBe(true);
    expect(coerceCell('TRUE', 'boolean')).toBe(true);
    expect(coerceCell('false', 'boolean')).toBe(false);
  });

  it('date → string (不转换)', () => {
    expect(coerceCell('2024-01-15', 'date')).toBe('2024-01-15');
  });

  it('datetime → string (不转换)', () => {
    expect(coerceCell('2024-01-15T10:30:00', 'datetime')).toBe('2024-01-15T10:30:00');
  });

  it('string → string', () => {
    expect(coerceCell('hello', 'string')).toBe('hello');
  });

  it('NULL → null (任意类型)', () => {
    expect(coerceCell('NULL', 'integer')).toBeNull();
    expect(coerceCell('NULL', 'string')).toBeNull();
    expect(coerceCell(NULL_TOKEN, 'float')).toBeNull();
  });

  it('null/undefined → null', () => {
    expect(coerceCell(null, 'integer')).toBeNull();
    expect(coerceCell(undefined, 'string')).toBeNull();
  });

  it('integer 非数字 → 原字符串', () => {
    // 不应该发生（探测器会判为 string），但防御性处理
    expect(coerceCell('abc', 'integer')).toBe('abc');
  });

  it('float 非数字 → 原字符串', () => {
    expect(coerceCell('xyz', 'float')).toBe('xyz');
  });
});

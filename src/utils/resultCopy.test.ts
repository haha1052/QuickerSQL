import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  matrixToPayload,
  rowToPayload,
  tableToPayload,
  payloadToTSV,
  payloadToCSV,
  payloadToMarkdown,
  payloadToJSON,
  payloadToInsert,
  writeClipboard,
  extractTableName,
  normalizeRowIndices,
  normalizeColIndices,
  rowsToPayload,
  colsToPayload,
  colIdToIndex,
  type CopyPayload,
} from './resultCopy';
import { NULL_TOKEN } from './cellTypeDetection';

// ============================================================
// matrixToPayload
// ============================================================
describe('matrixToPayload', () => {
  const columns = ['id', 'name', 'age'];
  const rows = [
    ['1', 'Alice', '30'],
    ['2', 'Bob', '25'],
    ['3', 'Charlie', '40'],
  ];

  it('空矩阵返回空 payload', () => {
    const result = matrixToPayload(new Map(), columns, rows);
    expect(result.columns).toEqual([]);
    expect(result.rows).toEqual([]);
  });

  it('单格选区', () => {
    const matrix = new Map([[0, new Set(['col1'])]]);
    const result = matrixToPayload(matrix, columns, rows);
    expect(result.columns).toEqual(['name']);
    expect(result.rows).toEqual([['Alice']]);
  });

  it('矩形选区（多行多列）', () => {
    const matrix = new Map([
      [0, new Set(['col0', 'col1'])],
      [1, new Set(['col0', 'col1'])],
    ]);
    const result = matrixToPayload(matrix, columns, rows);
    expect(result.columns).toEqual(['id', 'name']);
    expect(result.rows).toEqual([['1', 'Alice'], ['2', 'Bob']]);
  });

  it('非连续行选区（Ctrl 多块）', () => {
    const matrix = new Map([
      [0, new Set(['col0', 'col1', 'col2'])],
      [2, new Set(['col0', 'col1', 'col2'])],
    ]);
    const result = matrixToPayload(matrix, columns, rows);
    expect(result.rows).toEqual([['1', 'Alice', '30'], ['3', 'Charlie', '40']]);
  });

  it('行列升序输出', () => {
    const matrix = new Map([
      [2, new Set(['col2', 'col0'])],
      [0, new Set(['col2', 'col0'])],
    ]);
    const result = matrixToPayload(matrix, columns, rows);
    expect(result.columns).toEqual(['id', 'age']);
    expect(result.rows[0]).toEqual(['1', '30']);
    expect(result.rows[1]).toEqual(['3', '40']);
  });

  it('过滤 __rownum__ 列', () => {
    const matrix = new Map([
      [0, new Set(['__rownum__', 'col0'])],
    ]);
    const result = matrixToPayload(matrix, columns, rows);
    expect(result.columns).toEqual(['id']);
    expect(result.rows).toEqual([['1']]);
  });

  it('部分列未选中时非选中列输出空字符串', () => {
    const matrix = new Map([
      [0, new Set(['col0'])],
      [1, new Set(['col0', 'col2'])],
    ]);
    const result = matrixToPayload(matrix, columns, rows);
    // 列并集: col0, col2
    expect(result.columns).toEqual(['id', 'age']);
    // row 0: col0 选中, col2 未选中 → 空
    expect(result.rows[0]).toEqual(['1', '']);
    // row 1: col0 和 col2 都选中
    expect(result.rows[1]).toEqual(['2', '25']);
  });
});

// ============================================================
// rowToPayload
// ============================================================
describe('rowToPayload', () => {
  it('单行转换', () => {
    const result = rowToPayload(1, ['a', 'b'], [['x', 'y'], ['z', 'w']]);
    expect(result.columns).toEqual(['a', 'b']);
    expect(result.rows).toEqual([['z', 'w']]);
  });

  it('越界行返回 null 值', () => {
    const result = rowToPayload(5, ['a', 'b'], []);
    expect(result.rows).toEqual([[null, null]]);
  });
});

// ============================================================
// tableToPayload
// ============================================================
describe('tableToPayload', () => {
  it('全表转换', () => {
    const result = tableToPayload([['1', 'A'], ['2', 'B']], ['id', 'val']);
    expect(result.columns).toEqual(['id', 'val']);
    expect(result.rows).toEqual([['1', 'A'], ['2', 'B']]);
  });

  it('空表', () => {
    const result = tableToPayload([], ['id']);
    expect(result.rows).toEqual([]);
  });
});

// ============================================================
// payloadToTSV
// ============================================================
describe('payloadToTSV', () => {
  const payload: CopyPayload = {
    columns: ['id', 'name'],
    rows: [['1', 'Alice'], ['2', 'Bob']],
  };

  it('含表头', () => {
    const tsv = payloadToTSV(payload);
    expect(tsv).toBe('id\tname\n1\tAlice\n2\tBob');
  });

  it('不含表头', () => {
    const tsv = payloadToTSV(payload, { includeHeader: false });
    expect(tsv).toBe('1\tAlice\n2\tBob');
  });

  it('null 值用 nullText 替代', () => {
    const p: CopyPayload = { columns: ['a'], rows: [[null]] };
    expect(payloadToTSV(p, { nullText: 'NULL' })).toBe('a\nNULL');
    expect(payloadToTSV(p, { nullText: '' })).toBe('a\n');
  });

  it('制表符和换行符替换为空格', () => {
    const p: CopyPayload = { columns: ['a\tb'], rows: [['x\ny']] };
    const tsv = payloadToTSV(p);
    expect(tsv).toBe('a b\nx y');
  });

  it('空 payload', () => {
    expect(payloadToTSV({ columns: [], rows: [] })).toBe('');
  });
});

// ============================================================
// payloadToCSV
// ============================================================
describe('payloadToCSV', () => {
  it('基本 CSV', () => {
    const p: CopyPayload = { columns: ['a', 'b'], rows: [['1', '2']] };
    expect(payloadToCSV(p)).toBe('a,b\n1,2');
  });

  it('含逗号加引号', () => {
    const p: CopyPayload = { columns: ['a'], rows: [['x,y']] };
    expect(payloadToCSV(p)).toBe('a\n"x,y"');
  });

  it('含引号转义为双引号', () => {
    const p: CopyPayload = { columns: ['a'], rows: [['say "hi"']] };
    expect(payloadToCSV(p)).toBe('a\n"say ""hi"""');
  });

  it('含换行加引号', () => {
    const p: CopyPayload = { columns: ['a'], rows: [['line1\nline2']] };
    expect(payloadToCSV(p)).toBe('a\n"line1\nline2"');
  });

  it('不含表头', () => {
    const p: CopyPayload = { columns: ['a'], rows: [['1']] };
    expect(payloadToCSV(p, { includeHeader: false })).toBe('1');
  });

  it('null 值', () => {
    const p: CopyPayload = { columns: ['a'], rows: [[null]] };
    expect(payloadToCSV(p, { nullText: 'NULL' })).toBe('a\nNULL');
  });
});

// ============================================================
// payloadToMarkdown
// ============================================================
describe('payloadToMarkdown', () => {
  it('基本 Markdown 表格', () => {
    const p: CopyPayload = { columns: ['a', 'b'], rows: [['1', '2']] };
    const md = payloadToMarkdown(p);
    expect(md).toBe('| a | b |\n| --- | --- |\n| 1 | 2 |');
  });

  it('管道符转义', () => {
    const p: CopyPayload = { columns: ['a'], rows: [['x|y']] };
    expect(payloadToMarkdown(p)).toBe('| a |\n| --- |\n| x\\|y |');
  });

  it('空值渲染为空格', () => {
    const p: CopyPayload = { columns: ['a'], rows: [['']] };
    expect(payloadToMarkdown(p)).toBe('| a |\n| --- |\n|   |');
  });

  it('不含表头但有数据行', () => {
    const p: CopyPayload = { columns: [], rows: [['1', '2']] };
    const md = payloadToMarkdown(p);
    expect(md).toContain('col0');
    expect(md).toContain('col1');
  });

  it('空 payload', () => {
    expect(payloadToMarkdown({ columns: [], rows: [] })).toBe('');
  });
});

// ============================================================
// payloadToJSON
// ============================================================
describe('payloadToJSON', () => {
  it('基本 JSON', () => {
    const p: CopyPayload = { columns: ['id', 'name'], rows: [['1', 'Alice']] };
    const parsed = JSON.parse(payloadToJSON(p));
    expect(parsed).toEqual([{ id: '1', name: 'Alice' }]);
  });

  it('null 值保留为 JSON null', () => {
    const p: CopyPayload = { columns: ['a'], rows: [[null]] };
    const parsed = JSON.parse(payloadToJSON(p));
    expect(parsed).toEqual([{ a: null }]);
  });

  it('多行', () => {
    const p: CopyPayload = { columns: ['a'], rows: [['1'], ['2'], ['3']] };
    const parsed = JSON.parse(payloadToJSON(p));
    expect(parsed).toHaveLength(3);
  });
});

// ============================================================
// payloadToInsert
// ============================================================
describe('payloadToInsert', () => {
  it('基本 INSERT', () => {
    const p: CopyPayload = { columns: ['id', 'name'], rows: [['1', 'Alice']] };
    const sql = payloadToInsert(p, { table: 'users' });
    expect(sql).toBe("INSERT INTO users (id, name) VALUES\n('1', 'Alice');");
  });

  it('多行 VALUES', () => {
    const p: CopyPayload = { columns: ['id'], rows: [['1'], ['2']] };
    const sql = payloadToInsert(p, { table: 't' });
    expect(sql).toBe("INSERT INTO t (id) VALUES\n('1'),\n('2');");
  });

  it('null → NULL 不加引号', () => {
    const p: CopyPayload = { columns: ['a'], rows: [[null]] };
    const sql = payloadToInsert(p, { table: 't' });
    expect(sql).toBe('INSERT INTO t (a) VALUES\n(NULL);');
  });

  it('单引号转义', () => {
    const p: CopyPayload = { columns: ['a'], rows: [["it's"]] };
    const sql = payloadToInsert(p, { table: 't' });
    expect(sql).toBe("INSERT INTO t (a) VALUES\n('it''s');");
  });

  it('空数据返回空字符串', () => {
    const p: CopyPayload = { columns: [], rows: [] };
    expect(payloadToInsert(p, { table: 't' })).toBe('');
  });
});

// ============================================================
// extractTableName
// ============================================================
describe('extractTableName', () => {
  it('FROM 子句', () => {
    expect(extractTableName('SELECT * FROM users WHERE id = 1')).toBe('users');
  });

  it('INSERT INTO 子句', () => {
    expect(extractTableName('INSERT INTO orders (id) VALUES (1)')).toBe('orders');
  });

  it('UPDATE 子句', () => {
    expect(extractTableName('UPDATE products SET name = "x"')).toBe('products');
  });

  it('带模式名', () => {
    expect(extractTableName('SELECT * FROM main.users')).toBe('main.users');
  });

  it('无法匹配时返回默认值', () => {
    expect(extractTableName('SELECT 1 + 1')).toBe('my_table');
    expect(extractTableName('SELECT 1', 'fallback')).toBe('fallback');
  });
});

// ============================================================
// writeClipboard
// ============================================================
describe('writeClipboard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('navigator.clipboard 成功时返回 true', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const ok = await writeClipboard('test');
    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith('test');
  });

  it('clipboard API 失败时降级到 execCommand', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    // jsdom 未实现 execCommand，需先定义再 spy
    Object.defineProperty(document, 'execCommand', {
      value: vi.fn().mockReturnValue(true),
      configurable: true,
      writable: true,
    });
    const ok = await writeClipboard('test');
    expect(ok).toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith('copy');
  });

  it('两种方式都失败时返回 false', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    Object.defineProperty(document, 'execCommand', {
      value: vi.fn().mockImplementation(() => {
        throw new Error('exec failed');
      }),
      configurable: true,
      writable: true,
    });
    const ok = await writeClipboard('test');
    expect(ok).toBe(false);
  });
});

// ============================================================
// colIdToIndex（导出后补充基础测试）
// ============================================================
describe('colIdToIndex', () => {
  it('col0 → 0', () => expect(colIdToIndex('col0')).toBe(0));
  it('col2 → 2', () => expect(colIdToIndex('col2')).toBe(2));
  it('__rownum__ → -1', () => expect(colIdToIndex('__rownum__')).toBe(-1));
  it('非法格式 → -1', () => expect(colIdToIndex('foo')).toBe(-1));
});

// ============================================================
// normalizeRowIndices
// ============================================================
describe('normalizeRowIndices', () => {
  it('空 matrix 返回 []', () => {
    expect(normalizeRowIndices(null, 10)).toEqual([]);
    expect(normalizeRowIndices(new Map(), 10)).toEqual([]);
  });

  it('混合矩阵 Map{1:Set{col0},3:Set{col2,col0},7:Set{col1}} rowCount=10 → [1,3,7]', () => {
    const matrix = new Map<number, Set<string>>([
      [1, new Set(['col0'])],
      [3, new Set(['col2', 'col0'])],
      [7, new Set(['col1'])],
    ]);
    expect(normalizeRowIndices(matrix, 10)).toEqual([1, 3, 7]);
  });

  it('负数或 >= rowCount 的行号被过滤', () => {
    const matrix = new Map<number, Set<string>>([
      [-2, new Set(['col0'])],
      [1, new Set(['col0'])],
      [5, new Set(['col0'])],
      [99, new Set(['col0'])],
    ]);
    expect(normalizeRowIndices(matrix, 5)).toEqual([1]);
  });

  it('重复行号去重 + 升序', () => {
    const matrix = new Map<number, Set<string>>([
      [5, new Set(['col0'])],
      [2, new Set(['col1'])],
      [5, new Set(['col2'])],
      [0, new Set(['col0'])],
    ]);
    expect(normalizeRowIndices(matrix, 10)).toEqual([0, 2, 5]);
  });
});

// ============================================================
// normalizeColIndices
// ============================================================
describe('normalizeColIndices', () => {
  const columns = ['col0', 'col1', 'col2'];

  it('空 matrix 返回 []', () => {
    expect(normalizeColIndices(null, columns.length)).toEqual([]);
    expect(normalizeColIndices(new Map(), columns.length)).toEqual([]);
  });

  it('示例矩阵 columns.length=3 → [0,1,2]', () => {
    const matrix = new Map<number, Set<string>>([
      [1, new Set(['col0'])],
      [3, new Set(['col2', 'col0'])],
      [7, new Set(['col1'])],
    ]);
    expect(normalizeColIndices(matrix, columns.length)).toEqual([0, 1, 2]);
  });

  it('只含 Set{col2} → [2]', () => {
    const matrix = new Map<number, Set<string>>([
      [0, new Set(['col2'])],
    ]);
    expect(normalizeColIndices(matrix, columns.length)).toEqual([2]);
  });

  it('非法 colId（colIdToIndex 返回 -1）过滤', () => {
    const matrix = new Map<number, Set<string>>([
      [0, new Set(['__rownum__', 'col1', 'colXXX'])],
    ]);
    expect(normalizeColIndices(matrix, columns.length)).toEqual([1]);
  });

  it('>= colCount 的列索引被过滤', () => {
    const matrix = new Map<number, Set<string>>([
      [0, new Set(['col0', 'col5', 'col99'])],
    ]);
    expect(normalizeColIndices(matrix, 3)).toEqual([0]);
  });
});

// ============================================================
// rowsToPayload
// ============================================================
describe('rowsToPayload', () => {
  const columns = ['id', 'name', 'age'];
  const rows = [
    ['1', 'Alice', '30'],
    ['2', 'Bob', '25'],
    ['3', 'Charlie', '40'],
    ['4', 'Dave', '35'],
    ['5', 'Eve', '28'],
    ['6', 'Frank', '45'],
    ['7', 'Grace', '32'],
    ['8', 'Helen', '29'],
  ];

  it('rowsToPayload([3,1,3,7]) → 返回 3 行，顺序 rows[1], rows[3], rows[7]', () => {
    const payload = rowsToPayload([3, 1, 3, 7], columns, rows);
    expect(payload.rows).toHaveLength(3);
    expect(payload.rows[0]).toEqual(['2', 'Bob', '25']);
    expect(payload.rows[1]).toEqual(['4', 'Dave', '35']);
    expect(payload.rows[2]).toEqual(['8', 'Helen', '29']);
    expect(payload.columns).toEqual(columns);
  });

  it('NULL_TOKEN 单元格 → payload.rows[i][j] === null', () => {
    const rowsWithNull = [
      ['1', NULL_TOKEN, '30'],
      ['2', 'Bob', NULL_TOKEN],
    ];
    const payload = rowsToPayload([0, 1], columns, rowsWithNull);
    expect(payload.rows[0][1]).toBeNull();
    expect(payload.rows[1][2]).toBeNull();
    expect(payload.rows[0][0]).toBe('1');
  });

  it('空列空行安全返回', () => {
    const payload = rowsToPayload([], [], []);
    expect(payload.columns).toEqual([]);
    expect(payload.rows).toEqual([]);
  });

  it('行索引越界过滤', () => {
    const payload = rowsToPayload([-1, 0, 999, 1], columns, rows);
    expect(payload.rows).toHaveLength(2);
    expect(payload.rows[0]).toEqual(['1', 'Alice', '30']);
    expect(payload.rows[1]).toEqual(['2', 'Bob', '25']);
  });

  it('rowsToPayload + payloadToTSV（含 header:true，验证 headerLine + 三行 TSV 分隔）', () => {
    const payload = rowsToPayload([0, 2, 4], columns, rows);
    const tsv = payloadToTSV(payload, { includeHeader: true });
    const lines = tsv.split('\n');
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe('id\tname\tage');
    expect(lines[1]).toBe('1\tAlice\t30');
    expect(lines[2]).toBe('3\tCharlie\t40');
    expect(lines[3]).toBe('5\tEve\t28');
  });
});

// ============================================================
// colsToPayload
// ============================================================
describe('colsToPayload', () => {
  const columns = ['id', 'name', 'age', 'email'];
  const rows = [
    ['1', 'Alice', '30', 'a@x.com'],
    ['2', 'Bob', '25', 'b@x.com'],
    ['3', 'Charlie', '40', 'c@x.com'],
  ];

  it('colsToPayload([2,0,0,3]) → columns 长度=3（列 0,2,3），顺序正确', () => {
    const payload = colsToPayload([2, 0, 0, 3], columns, rows);
    expect(payload.columns).toHaveLength(3);
    expect(payload.columns).toEqual(['id', 'age', 'email']);
  });

  it('NULL_TOKEN 单元格 → payload.rows[i][j] === null', () => {
    const rowsWithNull = [
      ['1', NULL_TOKEN, '30', NULL_TOKEN],
    ];
    const payload = colsToPayload([0, 1, 3], columns, rowsWithNull);
    expect(payload.rows[0][0]).toBe('1');
    expect(payload.rows[0][1]).toBeNull();
    expect(payload.rows[0][2]).toBeNull();
  });

  it('边界：空列空行安全返回', () => {
    const payload = colsToPayload([], [], []);
    expect(payload.columns).toEqual([]);
    expect(payload.rows).toEqual([]);
  });

  it('列索引越界过滤', () => {
    const payload = colsToPayload([-1, 0, 99, 2], columns, rows);
    expect(payload.columns).toEqual(['id', 'age']);
    expect(payload.rows[0]).toEqual(['1', '30']);
  });

  it('colsToPayload + payloadToMarkdown（验证 markdown 合成正确，表头存在子集列名）', () => {
    const payload = colsToPayload([0, 2, 3], columns, rows);
    const md = payloadToMarkdown(payload);
    expect(md).toContain('| id | age | email |');
    expect(md).toContain('| --- | --- | --- |');
    expect(md).toContain('| 1 | 30 | a@x.com |');
    expect(md).toContain('| 3 | 40 | c@x.com |');
  });

  it('colsToPayload 数据行数保留全部 displayRows', () => {
    const payload = colsToPayload([1, 3], columns, rows);
    expect(payload.rows).toHaveLength(3);
    expect(payload.rows[0]).toEqual(['Alice', 'a@x.com']);
    expect(payload.rows[1]).toEqual(['Bob', 'b@x.com']);
    expect(payload.rows[2]).toEqual(['Charlie', 'c@x.com']);
  });
});

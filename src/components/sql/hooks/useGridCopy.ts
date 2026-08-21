/**
 * useGridCopy.ts — 复制与导出引擎
 *
 * 基于 resultCopy.ts，提供：
 * - 复制单元格值
 * - 复制选区（5 种格式：TSV/CSV/Markdown/JSON/INSERT）
 * - 复制当前行
 * - 复制全部（显示 vs 完整）
 * - 导出全量/仅选区到文件（CSV/JSON/Markdown）
 * - 剪贴板写入 + toast 反馈
 *
 * Phase 3：默认值从 SettingsContext 读取（sql.copy_include_header / sql.copy_null_text / sql.insert_default_table）。
 */
import { useCallback } from 'react';
import { save } from '@tauri-apps/plugin-dialog';
import { useAppStore } from '../../../store';
import { tauriService } from '../../../services';
import { useLocale } from '../../../context/LocaleContext';
import { useSetting } from '../../../context/SettingsContext';
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
  type CopyFormat,
} from '../../../utils/resultCopy';
import type { SqlStatementResult } from '../../../types';

/** 导出格式 */
export type ExportFormat = 'csv' | 'json' | 'markdown';

interface UseGridCopyArgs {
  /** 列名数组 */
  columns: string[];
  /** 截断后的显示行 */
  displayRows: string[][];
  /** 完整行数据（复制全量用） */
  fullRows: string[][];
  /** SQL 语句（INSERT 表名提取） */
  statement: string;
  /** 新：selection hook，用于读取 getSelectedMatrix / hasSelection */
  selection: {
    getSelectedMatrix: () => Map<number, Set<string>> | null;
    hasSelection: boolean;
  };
  /** 新：列数（=columns.length），用于 normalizeColIndices 过滤边界 */
  columnCount: number;
  /** 新：行数（=displayRows.length） */
  rowCount: number;
}

export function useGridCopy({
  columns,
  displayRows,
  fullRows,
  statement,
  selection,
  columnCount,
  rowCount,
}: UseGridCopyArgs) {
  const { t } = useLocale();
  const { setMessage } = useAppStore();

  // Phase 3：从 SettingsContext 读取（缺失时使用 fallback 默认值）
  const [includeHeaderRaw] = useSetting('sql', 'copy_include_header');
  const [nullTextRaw] = useSetting('sql', 'copy_null_text');
  const [defaultTableRaw] = useSetting('sql', 'insert_default_table');

  const includeHeaderFromSettings = includeHeaderRaw === undefined ? true : includeHeaderRaw === 'true';
  const nullText = nullTextRaw ?? '';
  const defaultTable = defaultTableRaw || 'my_table';

  /** 复制单元格值 */
  const copyCell = useCallback(
    async (cellValue: string | null) => {
      const text = cellValue ?? '';
      const ok = await writeClipboard(text);
      if (ok) {
        setMessage(t('grid.selection.copied'), 'success');
      } else {
        setMessage(t('hooks.copyFail'), 'error');
      }
    },
    [t, setMessage],
  );

  /** 复制选区 */
  const copySelection = useCallback(
    async (
      matrix: Map<number, Set<string>>,
      format: CopyFormat = 'tsv',
    ) => {
      const payload = matrixToPayload(matrix, columns, displayRows);
      if (payload.rows.length === 0) {
        setMessage(t('grid.selection.empty'), 'warning');
        return;
      }

      let text: string;
      switch (format) {
        case 'tsv':
          text = payloadToTSV(payload, { includeHeader: includeHeaderFromSettings, nullText });
          break;
        case 'csv':
          text = payloadToCSV(payload, { includeHeader: includeHeaderFromSettings, nullText });
          break;
        case 'markdown':
          text = payloadToMarkdown(payload, { includeHeader: includeHeaderFromSettings, nullText });
          break;
        case 'json':
          text = payloadToJSON(payload, { includeHeader: includeHeaderFromSettings, nullText });
          break;
        case 'insert':
          text = payloadToInsert(payload, {
            table: extractTableName(statement, defaultTable),
            copyOptions: { includeHeader: includeHeaderFromSettings, nullText },
          });
          break;
      }

      const ok = await writeClipboard(text);
      if (ok) {
        const count = payload.rows.length;
        setMessage(t('grid.selection.copiedRows', { count }), 'success');
      } else {
        setMessage(t('hooks.copyFail'), 'error');
      }
    },
    [columns, displayRows, includeHeaderFromSettings, nullText, statement, defaultTable, t, setMessage],
  );

  /** 复制选中的行（行并集 × 所有列）。format 默认 tsv；includeHeader 未传走设置 */
  const copySelectedRows = useCallback(
    async (format: CopyFormat = 'tsv', includeHeader?: boolean) => {
      const matrix = selection.getSelectedMatrix();
      if (!matrix || !selection.hasSelection) {
        setMessage(t('grid.selection.empty'), 'warning');
        return;
      }
      const indices = normalizeRowIndices(matrix, rowCount);
      if (indices.length === 0) {
        setMessage(t('grid.selection.empty'), 'warning');
        return;
      }
      const payload = rowsToPayload(indices, columns, displayRows);
      const withHeader = includeHeader ?? includeHeaderFromSettings;

      let text: string;
      switch (format) {
        case 'tsv':
          text = payloadToTSV(payload, { includeHeader: withHeader, nullText });
          break;
        case 'csv':
          text = payloadToCSV(payload, { includeHeader: withHeader, nullText });
          break;
        case 'markdown':
          text = payloadToMarkdown(payload, { includeHeader: withHeader, nullText });
          break;
        case 'json':
          text = payloadToJSON(payload, { includeHeader: withHeader, nullText });
          break;
        case 'insert':
          text = payloadToInsert(payload, {
            table: extractTableName(statement, defaultTable),
            copyOptions: { includeHeader: withHeader, nullText },
          });
          break;
      }

      const ok = await writeClipboard(text);
      if (ok) {
        setMessage(t('grid.copy.selectedRowsCopied', { count: payload.rows.length }), 'success');
      } else {
        setMessage(t('hooks.copyFail'), 'error');
      }
    },
    [selection, columns, displayRows, rowCount, includeHeaderFromSettings, nullText, defaultTable, statement, t, setMessage],
  );

  /** 复制选中的列（列并集 × 所有 displayRows 行） */
  const copySelectedCols = useCallback(
    async (format: CopyFormat = 'tsv', includeHeader?: boolean) => {
      const matrix = selection.getSelectedMatrix();
      if (!matrix || !selection.hasSelection) {
        setMessage(t('grid.selection.empty'), 'warning');
        return;
      }
      const indices = normalizeColIndices(matrix, columnCount);
      if (indices.length === 0) {
        setMessage(t('grid.selection.empty'), 'warning');
        return;
      }
      const payload = colsToPayload(indices, columns, displayRows);
      const withHeader = includeHeader ?? includeHeaderFromSettings;

      let text: string;
      switch (format) {
        case 'tsv':
          text = payloadToTSV(payload, { includeHeader: withHeader, nullText });
          break;
        case 'csv':
          text = payloadToCSV(payload, { includeHeader: withHeader, nullText });
          break;
        case 'markdown':
          text = payloadToMarkdown(payload, { includeHeader: withHeader, nullText });
          break;
        case 'json':
          text = payloadToJSON(payload, { includeHeader: withHeader, nullText });
          break;
        case 'insert':
          text = payloadToInsert(payload, {
            table: extractTableName(statement, defaultTable),
            copyOptions: { includeHeader: withHeader, nullText },
          });
          break;
      }

      const ok = await writeClipboard(text);
      if (ok) {
        setMessage(t('grid.copy.selectedColsCopied', { count: payload.columns.length }), 'success');
      } else {
        setMessage(t('hooks.copyFail'), 'error');
      }
    },
    [selection, columns, displayRows, columnCount, includeHeaderFromSettings, nullText, defaultTable, statement, t, setMessage],
  );

  /** 复制当前行 */
  const copyRow = useCallback(
    async (rowIndex: number) => {
      const payload = rowToPayload(rowIndex, columns, displayRows);
      const text = payloadToTSV(payload, { includeHeader: false, nullText });
      const ok = await writeClipboard(text);
      if (ok) {
        setMessage(t('grid.selection.copied'), 'success');
      } else {
        setMessage(t('hooks.copyFail'), 'error');
      }
    },
    [columns, displayRows, nullText, t, setMessage],
  );

  /** 复制全部（当前显示） */
  const copyAllDisplayed = useCallback(async () => {
    const payload = tableToPayload(displayRows, columns);
    const text = payloadToTSV(payload, { includeHeader: includeHeaderFromSettings, nullText });
    const ok = await writeClipboard(text);
    if (ok) {
      const count = payload.rows.length;
      setMessage(t('grid.selection.copiedRows', { count }), 'success');
    } else {
      setMessage(t('hooks.copyFail'), 'error');
    }
  }, [columns, displayRows, includeHeaderFromSettings, nullText, t, setMessage]);

  /** 复制全部（完整结果） */
  const copyAllFull = useCallback(async () => {
    const payload = tableToPayload(fullRows, columns);
    const text = payloadToTSV(payload, { includeHeader: includeHeaderFromSettings, nullText });
    const ok = await writeClipboard(text);
    if (ok) {
      const count = payload.rows.length;
      setMessage(t('grid.selection.copiedRows', { count }), 'success');
    } else {
      setMessage(t('hooks.copyFail'), 'error');
    }
  }, [columns, fullRows, includeHeaderFromSettings, nullText, t, setMessage]);

  /** Ctrl+C 复制（默认 TSV 含表头） */
  const copyFromKeyboard = useCallback(
    async (matrix: Map<number, Set<string>> | null) => {
      if (!matrix || matrix.size === 0) return;
      await copySelection(matrix, 'tsv');
    },
    [copySelection],
  );

  // ===== 导出功能（原 useQueryExport 逻辑并入） =====

  /** 导出全量数据到文件 */
  const exportToFile = useCallback(
    async (result: SqlStatementResult, format: ExportFormat) => {
      if (!result.columns || !result.rows) {
        setMessage(t('hooks.noDataToExport'), 'warning');
        return;
      }

      try {
        const defaultName = `result_${Date.now()}.${format}`;
        const filters = format === 'csv'
          ? [{ name: t('hooks.csvFile'), extensions: ['csv'] }]
          : format === 'json'
            ? [{ name: t('hooks.jsonFile'), extensions: ['json'] }]
            : [{ name: 'Markdown', extensions: ['md'] }];

        const path = await save({
          defaultPath: defaultName,
          filters,
        });

        if (path) {
          const payload = tableToPayload(result.rows, result.columns);
          let content = '';

          switch (format) {
            case 'csv':
              content = payloadToCSV(payload, { includeHeader: true, nullText: '' });
              break;
            case 'json':
              content = JSON.stringify({
                columns: result.columns,
                rows: result.rows,
                statement: result.statement,
                timestamp: new Date().toISOString(),
              }, null, 2);
              break;
            case 'markdown':
              content = payloadToMarkdown(payload, { includeHeader: true, nullText: '' });
              break;
          }

          await tauriService.writeTextFile(path, content);
          setMessage(`${t('hooks.exportedTo')} ${path}`, 'success');
        }
      } catch (error) {
        console.error(t('hooks.exportFail'), error);
        setMessage(t('hooks.exportFail'), 'error');
      }
    },
    [t, setMessage],
  );

  /** 导出选区到文件 */
  const exportSelectionToFile = useCallback(
    async (
      matrix: Map<number, Set<string>>,
      format: ExportFormat,
    ) => {
      const payload = matrixToPayload(matrix, columns, displayRows);
      if (payload.rows.length === 0) {
        setMessage(t('grid.selection.empty'), 'warning');
        return;
      }

      try {
        const defaultName = `selection_${Date.now()}.${format}`;
        const filters = format === 'csv'
          ? [{ name: t('hooks.csvFile'), extensions: ['csv'] }]
          : format === 'json'
            ? [{ name: t('hooks.jsonFile'), extensions: ['json'] }]
            : [{ name: 'Markdown', extensions: ['md'] }];

        const path = await save({
          defaultPath: defaultName,
          filters,
        });

        if (path) {
          let content = '';
          switch (format) {
            case 'csv':
              content = payloadToCSV(payload, { includeHeader: includeHeaderFromSettings, nullText });
              break;
            case 'json':
              content = payloadToJSON(payload, { includeHeader: includeHeaderFromSettings, nullText });
              break;
            case 'markdown':
              content = payloadToMarkdown(payload, { includeHeader: includeHeaderFromSettings, nullText });
              break;
          }

          await tauriService.writeTextFile(path, content);
          setMessage(`${t('hooks.exportedTo')} ${path}`, 'success');
        }
      } catch (error) {
        console.error(t('hooks.exportFail'), error);
        setMessage(t('hooks.exportFail'), 'error');
      }
    },
    [columns, displayRows, includeHeaderFromSettings, nullText, t, setMessage],
  );

  return {
    copyCell,
    copySelection,
    copySelectedRows,
    copySelectedCols,
    copyRow,
    copyAllDisplayed,
    copyAllFull,
    copyFromKeyboard,
    exportToFile,
    exportSelectionToFile,
  };
}

import { useState, useCallback } from 'react';
import { save } from '@tauri-apps/plugin-dialog';
import { useAppStore } from '../../../store';
import { tauriService } from '../../../services';
import { useLocale } from '../../../context/LocaleContext';
import type { SqlStatementResult } from '../../../types';

interface ExportMenuState {
  x: number;
  y: number;
  result: SqlStatementResult;
  index: number;
}

type ExportFormat = 'csv' | 'json';

export const useQueryExport = () => {
  const { t } = useLocale();
  const { setMessage } = useAppStore();
  const [exportMenu, setExportMenu] = useState<ExportMenuState | null>(null);

  const handleExport = useCallback(async (result: SqlStatementResult, format: ExportFormat) => {
    if (!result.columns || !result.rows) {
      setMessage(t('hooks.noDataToExport'), 'warning');
      setExportMenu(null);
      return;
    }

    try {
      const defaultName = `result_${Date.now()}.${format}`;
      const filters = format === 'csv'
        ? [{ name: t('hooks.csvFile'), extensions: ['csv'] }]
        : [{ name: t('hooks.jsonFile'), extensions: ['json'] }];

      const path = await save({
        defaultPath: defaultName,
        filters,
      });

      if (path) {
        let content = '';
        
        if (format === 'csv') {
          content = result.columns.join(',') + '\n';
          result.rows.forEach(row => {
            content += row.map(cell => {
              const cellStr = String(cell);
              // 处理包含引号、逗号或换行符的单元格
              if (cellStr.includes('"') || cellStr.includes(',') || cellStr.includes('\n')) {
                return `"${cellStr.replace(/"/g, '""')}"`;
              }
              return cellStr;
            }).join(',') + '\n';
          });
        } else {
          const jsonData = {
            columns: result.columns,
            rows: result.rows,
            statement: result.statement,
            timestamp: new Date().toISOString(),
          };
          content = JSON.stringify(jsonData, null, 2);
        }

        await tauriService.writeTextFile(path, content);
        setMessage(`${t('hooks.exportedTo')} ${path}`, 'success');
      }
    } catch (error) {
      console.error(t('hooks.exportFail'), error);
      setMessage(t('hooks.exportFail'), 'error');
    } finally {
      setExportMenu(null);
    }
  }, [t, setMessage]);

  const openExportMenu = useCallback((event: React.MouseEvent, result: SqlStatementResult, index: number) => {
    event.stopPropagation();
    setExportMenu({
      x: event.clientX,
      y: event.clientY,
      result,
      index,
    });
  }, []);

  const closeExportMenu = useCallback(() => {
    setExportMenu(null);
  }, []);

  return {
    exportMenu,
    setExportMenu,
    handleExport,
    openExportMenu,
    closeExportMenu,
  };
};

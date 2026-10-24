import React, { useState, useCallback, useEffect, useRef } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { FileQueue } from './FileQueue';
import { DataPreview } from './DataPreview';
import { FilePlusIcon, UploadIcon } from '../common/Icons';
import { useImportStore, useAppStore } from '../../store';
import { tauriService } from '../../services';
import { useSetting } from '../../context/SettingsContext';
import { useLocale } from '../../context/LocaleContext';
import type { ImportItem } from '../../types';

interface DataImportProps {
  onImportComplete?: () => void;
}

const SUPPORTED_EXTENSIONS = ['csv', 'xlsx', 'xls', 'json', 'jsonl', 'parquet', 'txt'];

export const DataImport: React.FC<DataImportProps> = ({
  onImportComplete,
}) => {
  const {
    importItems,
    addImportItems,
    setActiveImportItemId,
  } = useImportStore();
  const { setMessage } = useAppStore();
  const { t } = useLocale();
  
  // 获取数据导入设置
  const [skipEmptyRows] = useSetting('import', 'skipEmptyRows');
  const [firstRowAsHeader] = useSetting('import', 'firstRowAsHeader');
  const [autoDetectEncoding] = useSetting('import', 'autoDetectEncoding');
  const [defaultEncoding] = useSetting('import', 'defaultEncoding');
  const [importBatchSize] = useSetting('import', 'importBatchSize');
  const [maxImportFileSize] = useSetting('import', 'maxImportFileSize');
  
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const isProcessingDrop = useRef(false);
  const lastDropTimestamp = useRef(0);
  const processFilePathsRef = useRef<((filePaths: string[]) => Promise<void>) | null>(null);

  const handleFileSelect = (id: string) => {
    setActiveImportItemId(id);
  };

  const generateTableName = (fileName: string, sheetName?: string): string => {
    const baseName = fileName.replace(/\.(csv|xlsx?|xls|json|jsonl|parquet|txt)$/i, '');
    if (sheetName) {
      return `${baseName}_${sheetName}`;
    }
    return baseName;
  };

  const loadCsvFile = async (filePath: string, fileName: string): Promise<ImportItem | null> => {
    try {
      const batchSizeNum = parseInt(importBatchSize || '1000', 10);
      const response = await tauriService.loadCsv(filePath, {
        autoDetectEncoding: autoDetectEncoding === 'true',
        defaultEncoding,
        batchSize: isNaN(batchSizeNum) ? undefined : batchSizeNum,
      });
      if (response.success && response.data) {
        const id = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        let rows = response.data.rows;
        if (skipEmptyRows === 'true') {
          rows = rows.filter((row: string[]) => row.some((cell) => cell.trim() !== ''));
        }
        
        const hasHeader = firstRowAsHeader === 'true';
        let headers = hasHeader 
          ? (response.data.headers || []) 
          : (response.data.headers.length > 0 
              ? response.data.headers.map((_, i) => `column_${i + 1}`) 
              : rows[0]?.map((_, i) => `column_${i + 1}`) || []);
        
        return {
          id,
          fileType: 'csv',
          filePath,
          fileName,
          preview: {
            headers: response.data.headers || [],
            rows,
          },
          hasHeader,
          tableName: generateTableName(fileName),
          fields: headers.map((name: string) => ({
            name: name || `col_${headers.indexOf(name) + 1}`,
            dataType: 'TEXT' as const,
          })),
          selected: true,
          status: 'idle',
          isParent: false,
        };
      }
    } catch (e) {
      console.error('[DataImport] Failed to load CSV file:', e);
      setMessage('import.importFailed', 'error');
    }
    return null;
  };

  const loadExcelFile = async (filePath: string, fileName: string): Promise<ImportItem[]> => {
    try {
      const sheetsResponse = await tauriService.getExcelSheets(filePath);
      if (!sheetsResponse.success || !sheetsResponse.data) {
        setMessage(t('import.loadExcelFail'), 'error');
        return [];
      }

      const parentId = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const items: ImportItem[] = [];
      
      for (const sheet of sheetsResponse.data.sheets) {
        const sheetName = typeof sheet === 'string' ? sheet : sheet.name;
        const previewResponse = await tauriService.loadExcelSheet(filePath, sheetName);
        if (previewResponse.success && previewResponse.data) {
          const sheetId = `${parentId}_${sheetName}`;
          
          let rows = previewResponse.data.rows;
          if (skipEmptyRows === 'true') {
            rows = rows.filter((row: string[]) => row.some((cell) => cell.trim() !== ''));
          }
          
          const hasHeader = firstRowAsHeader === 'true';
          let headers = hasHeader ? (rows[0] || []) : rows[0]?.map((_, i) => `column_${i + 1}`) || [];
          let dataRows = hasHeader ? rows.slice(1) : rows;
          
          items.push({
            id: sheetId,
            fileType: 'excel',
            filePath,
            fileName,
            sheetName,
            preview: {
              headers,
              rows: dataRows,
            },
            hasHeader,
            tableName: generateTableName(fileName, sheetName),
            fields: headers.map((name: string) => ({
              name,
              dataType: 'TEXT' as const,
            })),
            selected: true,
            status: 'idle',
            parentId,
            isParent: false,
          });
        }
      }

      if (items.length > 0) {
        items.unshift({
          id: parentId,
          fileType: 'excel',
          filePath,
          fileName,
          preview: {
            headers: [],
            rows: [],
          },
          hasHeader: firstRowAsHeader === 'true',
          tableName: generateTableName(fileName),
          fields: [],
          selected: false,
          status: 'idle',
          isParent: true,
          sheets: sheetsResponse.data.sheets,
          isExpanded: true,
        });
      }

      return items;
    } catch (e) {
      console.error('[DataImport] Failed to load Excel file:', e);
      setMessage('import.importFailed', 'error');
      return [];
    }
  };

  const loadJsonFile = async (filePath: string, fileName: string): Promise<ImportItem | null> => {
    try {
      const response = await tauriService.loadJson(filePath);
      if (response.success && response.data) {
        const id = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        let rows = response.data.rows;
        if (skipEmptyRows === 'true') {
          rows = rows.filter((row: string[]) => row.some((cell) => cell.trim() !== ''));
        }
        
        const hasHeader = firstRowAsHeader === 'true';
        let headers = hasHeader 
          ? (response.data.headers || []) 
          : (response.data.headers.length > 0 
              ? response.data.headers.map((_, i) => `column_${i + 1}`) 
              : rows[0]?.map((_, i) => `column_${i + 1}`) || []);
        
        return {
          id,
          fileType: 'json',
          filePath,
          fileName,
          preview: {
            headers: response.data.headers || [],
            rows,
          },
          hasHeader,
          tableName: generateTableName(fileName),
          fields: headers.map((name: string) => ({
            name: name || `col_${headers.indexOf(name) + 1}`,
            dataType: 'TEXT' as const,
          })),
          selected: true,
          status: 'idle',
          isParent: false,
        };
      }
    } catch (e) {
      console.error('[DataImport] Failed to load JSON file:', e);
      setMessage('import.importFailed', 'error');
    }
    return null;
  };

  const loadParquetFile = async (filePath: string, fileName: string): Promise<ImportItem | null> => {
    try {
      const response = await tauriService.loadParquet(filePath);
      if (response.success && response.data) {
        const id = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        let rows = response.data.rows;
        if (skipEmptyRows === 'true') {
          rows = rows.filter((row: string[]) => row.some((cell) => cell.trim() !== ''));
        }
        
        const hasHeader = firstRowAsHeader === 'true';
        let headers = hasHeader 
          ? (response.data.headers || []) 
          : (response.data.headers.length > 0 
              ? response.data.headers.map((_, i) => `column_${i + 1}`) 
              : rows[0]?.map((_, i) => `column_${i + 1}`) || []);
        
        return {
          id,
          fileType: 'parquet',
          filePath,
          fileName,
          preview: {
            headers: response.data.headers || [],
            rows,
          },
          hasHeader,
          tableName: generateTableName(fileName),
          fields: headers.map((name: string) => ({
            name: name || `col_${headers.indexOf(name) + 1}`,
            dataType: 'TEXT' as const,
          })),
          selected: true,
          status: 'idle',
          isParent: false,
        };
      }
    } catch (e) {
      console.error('[DataImport] Failed to load Parquet file:', e);
      setMessage('import.importFailed', 'error');
    }
    return null;
  };

  const loadTxtFile = async (filePath: string, fileName: string): Promise<ImportItem | null> => {
    try {
      const response = await tauriService.loadTxt(filePath);
      if (response.success && response.data) {
        const id = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        let rows = response.data.rows;
        if (skipEmptyRows === 'true') {
          rows = rows.filter((row: string[]) => row.some((cell) => cell.trim() !== ''));
        }
        
        const hasHeader = firstRowAsHeader === 'true';
        let headers = hasHeader 
          ? (response.data.headers || []) 
          : (response.data.headers.length > 0 
              ? response.data.headers.map((_, i) => `column_${i + 1}`) 
              : rows[0]?.map((_, i) => `column_${i + 1}`) || []);
        
        return {
          id,
          fileType: 'txt',
          filePath,
          fileName,
          preview: {
            headers: response.data.headers || [],
            rows,
          },
          hasHeader,
          tableName: generateTableName(fileName),
          fields: headers.map((name: string) => ({
            name: name || `col_${headers.indexOf(name) + 1}`,
            dataType: 'TEXT' as const,
          })),
          selected: true,
          status: 'idle',
          isParent: false,
          delimiter: '',
        };
      }
    } catch (e) {
      console.error('[DataImport] Failed to load TXT file:', e);
      setMessage('import.importFailed', 'error');
    }
    return null;
  };

  const processFilePaths = useCallback(async (filePaths: string[]) => {
    const now = Date.now();
    if (now - lastDropTimestamp.current < 200) return;
    if (isProcessingDrop.current) return;
    if (filePaths.length === 0) return;

    const existingPaths = new Set(importItems.map((item) => item.filePath));
    const uniquePaths = filePaths.filter((path) => !existingPaths.has(path));
    if (uniquePaths.length === 0) return;

    lastDropTimestamp.current = now;
    isProcessingDrop.current = true;

    try {
      const maxFileSizeNum = parseInt(maxImportFileSize || '100', 10);
      const maxFileSizeBytes = isNaN(maxFileSizeNum) ? 100 * 1024 * 1024 : maxFileSizeNum * 1024 * 1024;
      const newItems: ImportItem[] = [];

      for (const filePath of uniquePaths) {
        const fileName = filePath.split(/[\\/]/).pop() || 'unknown';
        const extension = fileName.split('.').pop()?.toLowerCase();

        if (!SUPPORTED_EXTENSIONS.includes(extension || '')) {
          continue;
        }

        // 检查文件大小
        try {
          const metaResult = await tauriService.getFileMetadata(filePath);
          if (metaResult.success && metaResult.data) {
            if (metaResult.data.size > maxFileSizeBytes) {
              const fileSizeMB = (metaResult.data.size / (1024 * 1024)).toFixed(2);
              setMessage({ key: 'import.fileTooLarge', vars: { file: fileName, size: fileSizeMB, max: maxFileSizeNum } }, 'error');
              continue;
            }
          }
        } catch (e) {
          console.warn('[DataImport] Failed to get file metadata:', e);
        }

        if (extension === 'csv') {
          const item = await loadCsvFile(filePath, fileName);
          if (item) newItems.push(item);
        } else if (['xlsx', 'xls'].includes(extension || '')) {
          const items = await loadExcelFile(filePath, fileName);
          newItems.push(...items);
        } else if (['json', 'jsonl'].includes(extension || '')) {
          const item = await loadJsonFile(filePath, fileName);
          if (item) newItems.push(item);
        } else if (extension === 'parquet') {
          const item = await loadParquetFile(filePath, fileName);
          if (item) newItems.push(item);
        } else if (extension === 'txt') {
          const item = await loadTxtFile(filePath, fileName);
          if (item) newItems.push(item);
        }
      }

      if (newItems.length > 0) {
        addImportItems(newItems);
        const selectableItems = newItems.filter(i => !i.isParent);
        if (selectableItems.length > 0) {
          setActiveImportItemId(selectableItems[0].id);
        }
        setMessage(t('import.addedFiles', { count: newItems.filter(i => !i.isParent).length }), 'success');
      }
    } catch (e) {
      console.error('[DataImport] Failed to process file paths:', e);
      setMessage('import.importFailed', 'error');
    } finally {
      isProcessingDrop.current = false;
    }
  }, [setMessage, maxImportFileSize, loadCsvFile, loadExcelFile, loadJsonFile, loadParquetFile, loadTxtFile, addImportItems, setActiveImportItemId, t, importItems]);

  useEffect(() => {
    processFilePathsRef.current = processFilePaths;
  }, [processFilePaths]);

  const handleAddFiles = async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: t('toolbar.dataFiles'),
            extensions: SUPPORTED_EXTENSIONS,
          },
        ],
      });

      if (!selected) return;

      const files = Array.isArray(selected) ? selected : [selected];
      await processFilePaths(files);
    } catch (e) {
      console.error('[DataImport] Failed to select files:', e);
      setMessage('import.importFailed', 'error');
    }
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    setIsDragging(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);
    // 文件处理统一交给 Tauri 原生拖放事件监听器，避免 DOM onDrop 与原生事件重复处理。
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    tauriService
      .onDragDropEvent((paths) => {
        if (paths.length > 0) {
          void processFilePathsRef.current?.(paths);
        }
      })
      .then((fn) => {
        if (cancelled) {
          fn();
        } else {
          unlisten = fn;
        }
      })
      .catch((e) => {
        console.error('[DataImport] Failed to register native drag-drop listener:', e);
      });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  if (importItems.length === 0) {
    return (
      <div
        style={styles.emptyContainer}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div
          style={{
            ...styles.dropZone,
            ...(isDragging ? styles.dropZoneActive : {}),
          }}
          onClick={handleAddFiles}
        >
          <div style={styles.emptyImportIcon}>📥</div>
          <div style={styles.emptyImportTitle}>{t('import.noTasks')}</div>
          <div style={styles.emptyImportDesc}>{t('import.selectFileHint')}</div>
          <div style={styles.addButton}>
            <FilePlusIcon size={18} />
            <span>{t('projectManager.selectFile')}</span>
          </div>
          <p style={styles.supportedFormats}>{t('import.supportedFormats')}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        ...styles.container,
        ...(isDragging ? styles.containerActive : {}),
      }}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div style={styles.dragOverlay}>
          <UploadIcon size={48} color="var(--primary)" />
          <p style={styles.dragOverlayText}>{t('import.releaseToAdd')}</p>
        </div>
      )}
      <FileQueue onFileSelect={handleFileSelect} />
      <DataPreview onImportComplete={onImportComplete || (() => {})} />
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
    position: 'relative',
  },
  containerActive: {
    boxShadow: 'inset 0 0 0 3px var(--primary)',
    background: 'var(--primary-bg)',
  },
  emptyContainer: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-primary)',
  },
  dropZone: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 80px',
    border: '2px dashed var(--border-primary)',
    borderRadius: '12px',
    transition: 'all 0.2s',
    cursor: 'pointer',
  },
  dropZoneActive: {
    borderColor: 'var(--primary)',
    background: 'var(--primary-bg)',
  },
  emptyImportIcon: {
    fontSize: '48px',
    marginBottom: '8px',
  },
  emptyImportTitle: {
    fontSize: '20px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginTop: '8px',
  },
  emptyImportDesc: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    marginTop: '8px',
    textAlign: 'center',
  },
  addButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '20px',
    padding: '12px 24px',
    background: 'var(--primary)',
    color: 'white',
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  dropText: {
    marginTop: '16px',
    fontSize: '14px',
    color: 'var(--text-secondary)',
  },
  supportedFormats: {
    marginTop: '8px',
    fontSize: '12px',
    color: 'var(--text-tertiary)',
  },
  dragOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'var(--primary-bg)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    border: '3px dashed var(--primary)',
    borderRadius: '8px',
    margin: '8px',
  },
  dragOverlayText: {
    marginTop: '16px',
    fontSize: '18px',
    color: 'var(--primary)',
    fontWeight: 500,
  },
};
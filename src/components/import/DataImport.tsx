import React, { useState, useCallback } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { FileQueue } from './FileQueue';
import { DataPreview } from './DataPreview';
import { FilePlusIcon, UploadIcon } from '../common/Icons';
import { useImportStore, useAppStore } from '../../store';
import { tauriService } from '../../services';
import type { ImportItem } from '../../types';

interface DataImportProps {
  onImportComplete?: () => void;
}

export const DataImport: React.FC<DataImportProps> = ({
  onImportComplete,
}) => {
  const {
    importItems,
    addImportItems,
    setActiveImportItemId,
  } = useImportStore();
  const { setMessage } = useAppStore();
  
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (id: string) => {
    setActiveImportItemId(id);
  };

  const generateTableName = (fileName: string, sheetName?: string): string => {
    const baseName = fileName.replace(/\.(csv|xlsx?|xls)$/i, '');
    if (sheetName) {
      return `${baseName}_${sheetName}`;
    }
    return baseName;
  };

  const loadCsvFile = async (filePath: string, fileName: string): Promise<ImportItem | null> => {
    try {
      const response = await tauriService.loadCsv(filePath);
      if (response.success && response.data) {
        const id = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        return {
          id,
          fileType: 'csv',
          filePath,
          fileName,
          preview: {
            headers: response.data.headers,
            rows: response.data.rows,
          },
          hasHeader: true,
          tableName: generateTableName(fileName),
          fields: response.data.headers.map((name: string) => ({
            name,
            dataType: 'TEXT' as const,
          })),
          selected: true,
          status: 'idle',
          isParent: false,
        };
      }
    } catch (e) {
      setMessage(`加载 CSV 文件失败: ${String(e)}`, 'error');
    }
    return null;
  };

  const loadExcelFile = async (filePath: string, fileName: string): Promise<ImportItem[]> => {
    try {
      const sheetsResponse = await tauriService.getExcelSheets(filePath);
      if (!sheetsResponse.success || !sheetsResponse.data) {
        setMessage('获取 Excel Sheet 列表失败', 'error');
        return [];
      }

      const parentId = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const items: ImportItem[] = [];
      
      for (const sheet of sheetsResponse.data.sheets) {
        const sheetName = typeof sheet === 'string' ? sheet : sheet.name;
        const previewResponse = await tauriService.loadExcelSheet(filePath, sheetName);
        if (previewResponse.success && previewResponse.data) {
          const sheetId = `${parentId}_${sheetName}`;
          items.push({
            id: sheetId,
            fileType: 'excel',
            filePath,
            fileName,
            sheetName,
            preview: {
              headers: previewResponse.data.headers,
              rows: previewResponse.data.rows,
            },
            hasHeader: true,
            tableName: generateTableName(fileName, sheetName),
            fields: previewResponse.data.headers.map((name: string) => ({
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
          hasHeader: true,
          tableName: generateTableName(fileName),
          fields: [],
          selected: false,
          status: 'idle',
          isParent: true,
          sheets: sheetsResponse.data.sheets.map((s: any) => typeof s === 'string' ? s : s.name),
          isExpanded: true,
        });
      }

      return items;
    } catch (e) {
      setMessage(`加载 Excel 文件失败: ${String(e)}`, 'error');
      return [];
    }
  };

  const handleAddFiles = async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: '数据文件',
            extensions: ['csv', 'xlsx', 'xls'],
          },
        ],
      });

      if (!selected) return;

      const files = Array.isArray(selected) ? selected : [selected];
      const newItems: ImportItem[] = [];

      for (const filePath of files) {
        const fileName = filePath.split(/[\\/]/).pop() || 'unknown';
        const extension = fileName.split('.').pop()?.toLowerCase();

        if (extension === 'csv') {
          const item = await loadCsvFile(filePath, fileName);
          if (item) newItems.push(item);
        } else if (['xlsx', 'xls'].includes(extension || '')) {
          const items = await loadExcelFile(filePath, fileName);
          newItems.push(...items);
        }
      }

      if (newItems.length > 0) {
        addImportItems(newItems);
        const selectableItems = newItems.filter(i => !i.isParent);
        if (selectableItems.length > 0) {
          setActiveImportItemId(selectableItems[0].id);
        }
        setMessage(`已添加 ${newItems.filter(i => !i.isParent).length} 个文件`, 'success');
      }
    } catch (e) {
      setMessage(`选择文件失败: ${String(e)}`, 'error');
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    // 由于浏览器安全限制，无法直接获取拖拽文件的真实路径
    // 提示用户使用文件选择对话框
    setMessage('请使用"添加文件"按钮选择文件，感谢您的理解！', 'info');
  }, [setMessage]);

  if (importItems.length === 0) {
    return (
      <div
        style={styles.emptyContainer}
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
          <UploadIcon size={48} color={isDragging ? '#007bff' : '#999'} />
          <div style={styles.addButton}>
            <FilePlusIcon size={18} />
            <span>添加文件</span>
          </div>
          <p style={styles.dropText}>点击添加文件</p>
          <p style={styles.supportedFormats}>支持 CSV、Excel 文件</p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={styles.container}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div style={styles.dragOverlay}>
          <UploadIcon size={48} color="#007bff" />
          <p style={styles.dragOverlayText}>释放文件以添加</p>
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
  emptyContainer: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#fff',
  },
  dropZone: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 80px',
    border: '2px dashed #dee2e6',
    borderRadius: '12px',
    transition: 'all 0.2s',
    cursor: 'pointer',
  },
  dropZoneActive: {
    borderColor: '#007bff',
    background: '#e3f2fd',
  },
  addButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '20px',
    padding: '12px 24px',
    background: '#007bff',
    color: 'white',
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  dropText: {
    marginTop: '16px',
    fontSize: '14px',
    color: '#666',
  },
  supportedFormats: {
    marginTop: '8px',
    fontSize: '12px',
    color: '#999',
  },
  dragOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(227, 242, 253, 0.95)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    border: '3px dashed #007bff',
    borderRadius: '8px',
    margin: '8px',
  },
  dragOverlayText: {
    marginTop: '16px',
    fontSize: '18px',
    color: '#007bff',
    fontWeight: 500,
  },
};

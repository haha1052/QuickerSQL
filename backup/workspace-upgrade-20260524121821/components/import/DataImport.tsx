import React from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import { useImportStore } from '../../store';
import { tauriService } from '../../services';

ModuleRegistry.registerModules([AllCommunityModule]);

const zhCNLocaleText = {
  equals: '等于',
  notEqual: '不等于',
  lessThan: '小于',
  greaterThan: '大于',
  filterOoo: '筛选...',
  applyFilter: '应用筛选',
  resetFilter: '重置筛选',
  noRowsToShow: '暂无数据',
};

interface DataImportProps {
  onImportComplete: () => void;
}

export const DataImport: React.FC<DataImportProps> = ({ onImportComplete }) => {
  const {
    importItems,
    activeImportItemId,
    loading,
    addImportItems,
    setActiveImportItemId,
    setLoading,
    toggleImportItemSelection,
    removeImportItem,
    clearImportItems,
    updateImportItem,
  } = useImportStore();

  const handleLoadFiles = async () => {
    setLoading(true);
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: true,
        directory: false,
        filters: [
          { name: 'CSV/Excel Files', extensions: ['csv', 'xlsx', 'xls'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (!selected) {
        setLoading(false);
        return;
      }

      const filePaths = Array.isArray(selected) ? selected : [selected];
      const newItems: any[] = [];

      for (const filePath of filePaths) {
        const lowerPath = filePath.toLowerCase();
        const isExcel = lowerPath.endsWith('.xlsx') || lowerPath.endsWith('.xls');

        try {
          if (isExcel) {
            const excelPreview = await tauriService.getExcelSheets(filePath);
            if (!excelPreview.success || !excelPreview.data) {
              throw new Error(excelPreview.error);
            }

            const fileName = filePath.split(/[\\/]/).pop() || 'excel_file';
            const parentId = Date.now().toString() + Math.random().toString(36).substr(2, 9);

            const parentItem = {
              id: parentId,
              fileType: 'excel' as const,
              filePath,
              fileName,
              sheets: excelPreview.data.sheets,
              isParent: true,
              isExpanded: true,
              preview: { headers: [], rows: [] },
              hasHeader: true,
              tableName: '',
              fields: [],
              selected: false,
              status: 'idle' as const,
            };
            newItems.push(parentItem);

            for (let i = 0; i < excelPreview.data.sheets.length; i++) {
              const sheet = excelPreview.data.sheets[i];
              const sheetData = await tauriService.loadExcelSheet(filePath, sheet.name);
              if (!sheetData.success || !sheetData.data) {
                continue;
              }

              const suggestedName = `${fileName.replace(/\.(xlsx|xls)$/i, '')}_${sheet.name}`.replace(/[^a-zA-Z0-9_]/g, '_');
              const initialFields = sheetData.data.headers.map((_header, idx) => ({
                name: `column_${idx + 1}`,
                dataType: 'VARCHAR' as const,
              }));

              newItems.push({
                id: `${parentId}_sheet_${i}`,
                fileType: 'excel' as const,
                filePath,
                fileName,
                sheetName: sheet.name,
                preview: sheetData.data,
                hasHeader: true,
                tableName: suggestedName,
                fields: initialFields,
                selected: true,
                status: 'previewing' as const,
                parentId,
                isParent: false,
              });
            }
          } else {
            const csvPreview = await tauriService.loadCsv(filePath);
            if (!csvPreview.success || !csvPreview.data) {
              throw new Error(csvPreview.error);
            }

            const fileName = filePath.split(/[\\/]/).pop() || 'my_table';
            const suggestedName = fileName.replace('.csv', '').replace(/[^a-zA-Z0-9_]/g, '_');
            const initialFields = csvPreview.data.headers.map((_header, idx) => ({
              name: `column_${idx + 1}`,
              dataType: 'VARCHAR' as const,
            }));

            newItems.push({
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              fileType: 'csv' as const,
              filePath,
              fileName,
              preview: csvPreview.data,
              hasHeader: true,
              tableName: suggestedName,
              fields: initialFields,
              selected: true,
              status: 'previewing' as const,
            });
          }
        } catch (e) {
          console.error(`加载文件失败: ${filePath}`, e);
        }
      }

      addImportItems(newItems);
      const firstSelectable = newItems.find(item => !item.isParent && item.status !== 'error');
      if (firstSelectable) {
        setActiveImportItemId(firstSelectable.id);
      }
    } catch (e) {
      console.error('加载文件失败:', e);
      alert('加载失败: ' + e);
    } finally {
      setLoading(false);
    }
  };

  const handleSingleImport = async (itemId: string) => {
    const item = importItems.find(i => i.id === itemId);
    if (!item) return;

    setLoading(true);
    try {
      updateImportItem(itemId, { status: 'importing' });

      const response = await tauriService.importData({
        rows: item.hasHeader ? item.preview.rows : [item.preview.headers, ...item.preview.rows],
        table_name: item.tableName,
        fields: item.fields,
      });

      if (response.success) {
        updateImportItem(itemId, { status: 'success' });
        alert(response.data);
        onImportComplete();
      } else {
        updateImportItem(itemId, { status: 'error', error: response.error });
        alert('导入失败: ' + response.error);
      }
    } catch (e) {
      updateImportItem(itemId, { status: 'error', error: String(e) });
      alert('导入失败: ' + e);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchImport = async () => {
    const selectedItems = importItems.filter(i => i.selected && i.status !== 'success');
    if (selectedItems.length === 0) {
      alert('请先选择要导入的文件');
      return;
    }

    setLoading(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (const item of selectedItems) {
        try {
          updateImportItem(item.id, { status: 'importing' });

          const response = await tauriService.importData({
            rows: item.hasHeader ? item.preview.rows : [item.preview.headers, ...item.preview.rows],
            table_name: item.tableName,
            fields: item.fields,
          });

          if (response.success) {
            updateImportItem(item.id, { status: 'success' });
            successCount++;
          } else {
            updateImportItem(item.id, { status: 'error', error: response.error });
            failCount++;
          }
        } catch (e) {
          updateImportItem(item.id, { status: 'error', error: String(e) });
          failCount++;
        }
      }

      alert(`导入完成: ${successCount} 成功, ${failCount} 失败`);
      onImportComplete();
    } finally {
      setLoading(false);
    }
  };

  const activeItem = importItems.find(i => i.id === activeImportItemId);

  return (
    <div style={styles.container}>
      <div style={styles.toolbar}>
        <button
          style={styles.primaryButton}
          onClick={handleLoadFiles}
          disabled={loading}
        >
          + 添加文件 (CSV/Excel)
        </button>

        {importItems.length > 0 && (
          <>
            <div style={styles.divider} />
            <button style={styles.secondaryButton} onClick={() => importItems.forEach(i => toggleImportItemSelection(i.id))}>
              全选
            </button>
            <button style={styles.secondaryButton} onClick={handleBatchImport} disabled={loading}>
              全部导入 ({importItems.filter(i => i.selected).length})
            </button>
            <button style={styles.dangerButton} onClick={() => {
              if (confirm('确定要清空队列吗？')) {
                clearImportItems();
              }
            }}>
              清空队列
            </button>
          </>
        )}
      </div>

      {importItems.length > 0 ? (
        <div style={styles.content}>
          <div style={styles.fileList}>
            <div style={styles.fileListHeader}>
              文件队列 ({importItems.length})
            </div>
            {importItems.map((item) => (
              <div
                key={item.id}
                style={{
                  ...styles.fileItem,
                  background: activeImportItemId === item.id ? '#e3f2fd' : 'transparent',
                  borderLeft: activeImportItemId === item.id ? '3px solid #2196f3' : '3px solid transparent',
                }}
                onClick={() => !item.isParent && setActiveImportItemId(item.id)}
              >
                <input
                  type="checkbox"
                  checked={item.selected}
                  onChange={() => toggleImportItemSelection(item.id)}
                />
                <span style={styles.fileName}>
                  {item.sheetName || item.fileName}
                </span>
                {item.status === 'success' && <span style={styles.successBadge}>✓</span>}
                {item.status === 'error' && <span style={styles.errorBadge}>✗</span>}
                {!item.isParent && (
                  <button
                    style={styles.deleteButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeImportItem(item.id);
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>

          <div style={styles.preview}>
            {activeItem && (
              <>
                <div style={styles.previewHeader}>
                  <span>预览: {activeItem.sheetName || activeItem.fileName}</span>
                  <div style={styles.previewActions}>
                    <label style={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={activeItem.hasHeader}
                        onChange={() => updateImportItem(activeItem.id, { hasHeader: !activeItem.hasHeader })}
                      />
                      CSV 包含表头
                    </label>
                    <button
                      style={styles.importButton}
                      onClick={() => handleSingleImport(activeItem.id)}
                      disabled={loading || activeItem.status === 'success'}
                    >
                      单独导入
                    </button>
                  </div>
                </div>
                <div style={styles.gridContainer} className="ag-theme-alpine">
                  <AgGridReact<any>
                    rowData={activeItem.preview.rows}
                    columnDefs={activeItem.preview.headers.map((header, index) => ({
                      field: `col${index}`,
                      headerName: header || `Column ${index + 1}`,
                    }))}
                    localeText={zhCNLocaleText}
                    defaultColDef={{
                      filter: true,
                      sortable: true,
                      resizable: true,
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <div style={styles.emptyState}>
          <p>暂无导入文件</p>
          <p>点击上方"添加文件"按钮导入 CSV 或 Excel 文件</p>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: '#fff',
  },
  toolbar: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid #ddd',
    flexWrap: 'wrap',
  },
  primaryButton: {
    padding: '10px 20px',
    background: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  secondaryButton: {
    padding: '8px 16px',
    background: '#f8f9fa',
    color: '#333',
    border: '1px solid #ddd',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  dangerButton: {
    padding: '8px 16px',
    background: '#f8f9fa',
    color: '#dc3545',
    border: '1px solid #ddd',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  importButton: {
    padding: '10px 20px',
    background: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  divider: {
    width: '1px',
    height: '24px',
    background: '#ddd',
  },
  content: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  fileList: {
    width: '380px',
    borderRight: '1px solid #ddd',
    overflowY: 'auto',
    background: '#f8f9fa',
  },
  fileListHeader: {
    padding: '12px 16px',
    borderBottom: '1px solid #eee',
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#333',
    position: 'sticky',
    top: 0,
    background: '#f8f9fa',
  },
  fileItem: {
    padding: '10px 16px',
    borderBottom: '1px solid #eee',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
  },
  fileName: {
    flex: 1,
    fontSize: '14px',
    color: '#333',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  successBadge: {
    color: '#28a745',
    fontSize: '16px',
  },
  errorBadge: {
    color: '#dc3545',
    fontSize: '16px',
  },
  deleteButton: {
    background: 'none',
    border: 'none',
    color: '#999',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '0 4px',
  },
  preview: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  previewHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 20px',
    borderBottom: '1px solid #ddd',
    background: '#f8f9fa',
  },
  previewActions: {
    display: 'flex',
    gap: '16px',
    alignItems: 'center',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    cursor: 'pointer',
  },
  gridContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#999',
    fontSize: '16px',
  },
};

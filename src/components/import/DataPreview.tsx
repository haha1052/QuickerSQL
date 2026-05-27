import React from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import { PlayIcon } from '../common/Icons';
import { useImportStore, useAppStore } from '../../store';
import { tauriService } from '../../services';

ModuleRegistry.registerModules([AllCommunityModule]);

interface DataPreviewProps {
  onImportComplete: () => void;
}

export const DataPreview: React.FC<DataPreviewProps> = ({ onImportComplete }) => {
  const {
    importItems,
    activeImportItemId,
    updateImportItem,
    setLoading,
  } = useImportStore();
  const { setMessage } = useAppStore();

  const activeItem = importItems.find((item) => item.id === activeImportItemId);

  if (!activeItem || activeItem.isParent) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <p style={styles.emptyText}>选择文件查看预览</p>
        </div>
      </div>
    );
  }

  const handleTableNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateImportItem(activeItem.id, { tableName: e.target.value });
  };

  const handleHasHeaderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newHasHeader = e.target.checked;
    
    let newFields: Array<{ name: string; dataType: string }>;
    
    if (newHasHeader) {
      newFields = activeItem.preview.headers.map((name, index) => ({
        name: name || `col_${index + 1}`,
        dataType: 'TEXT',
      }));
    } else {
      const columnCount = Math.max(
        activeItem.preview.headers.length,
        (activeItem.preview.rows[0]?.length || 0)
      );
      newFields = Array.from({ length: columnCount }, (_, index) => ({
        name: `col_${index + 1}`,
        dataType: 'TEXT',
      }));
    }
    
    updateImportItem(activeItem.id, { 
      hasHeader: newHasHeader, 
      fields: newFields 
    });
  };

  const handleFieldNameChange = (index: number, newName: string) => {
    const newFields = [...activeItem.fields];
    newFields[index] = { ...newFields[index], name: newName };
    updateImportItem(activeItem.id, { fields: newFields });
  };

  const handleFieldTypeChange = (index: number, newType: string) => {
    const newFields = [...activeItem.fields];
    newFields[index] = { ...newFields[index], dataType: newType };
    updateImportItem(activeItem.id, { fields: newFields });
  };

  const inferFieldTypes = () => {
    const newFields = activeItem.fields.map((field, index) => {
      let inferredType = 'TEXT';
      const sampleValues = activeItem.preview.rows.slice(0, 10).map(row => row[index] || '');

      if (sampleValues.length > 0) {
        const allIntegers = sampleValues.every(v => !v || /^-?\d+$/.test(v));
        const allReals = sampleValues.every(v => !v || /^-?\d*\.?\d+$/.test(v));
        const allBooleans = sampleValues.every(v => !v || ['true', 'false', '1', '0', 'yes', 'no'].includes(v.toLowerCase()));
        const allDates = sampleValues.every(v => !v || /^\d{4}[-\/]\d{2}[-\/]\d{2}$/.test(v));

        if (allIntegers) inferredType = 'INTEGER';
        else if (allReals) inferredType = 'REAL';
        else if (allBooleans) inferredType = 'BOOLEAN';
        else if (allDates) inferredType = 'DATE';
      }

      return { ...field, dataType: inferredType };
    });
    updateImportItem(activeItem.id, { fields: newFields });
  };

  const handleSingleImport = async () => {
    setLoading(true);
    updateImportItem(activeItem.id, { status: 'importing' });

    try {
      const response = await tauriService.importDataV2({
        file_path: activeItem.filePath,
        sheet_name: activeItem.sheetName,
        table_name: activeItem.tableName,
        has_header: activeItem.hasHeader,
        fields: activeItem.fields,
      });

      if (response.success) {
        updateImportItem(activeItem.id, { status: 'success' });
        setMessage(response.data || `成功导入表 ${activeItem.tableName}`, 'success');
        onImportComplete();
      } else {
        updateImportItem(activeItem.id, { status: 'error', error: response.error });
        setMessage(`导入失败: ${response.error || '未知错误'}`, 'error');
      }
    } catch (e) {
      updateImportItem(activeItem.id, { status: 'error', error: String(e) });
      setMessage(`导入失败: ${String(e)}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const getSampleValue = (columnIndex: number) => {
    const firstDataRow = activeItem.hasHeader 
      ? activeItem.preview.rows[0] 
      : activeItem.preview.rows[1];
    
    return firstDataRow?.[columnIndex] || '';
  };

  const columnDefs = activeItem.fields.map((field, index) => ({
    field: `col_${index}`,
    headerName: field.name || `列 ${index + 1}`,
    sortable: true,
    filter: true,
    resizable: true,
    minWidth: 150,
    flex: 1,
  }));

  const rowData = activeItem.hasHeader
    ? activeItem.preview.rows.slice(0, 100).map((row, rowIndex) => {
        const rowObj: Record<string, any> = { id: rowIndex };
        row.forEach((cell, colIndex) => {
          rowObj[`col_${colIndex}`] = cell;
        });
        return rowObj;
      })
    : activeItem.preview.rows.slice(0, 101).map((row, rowIndex) => {
        const rowObj: Record<string, any> = { id: rowIndex };
        row.forEach((cell, colIndex) => {
          rowObj[`col_${colIndex}`] = cell;
        });
        return rowObj;
      });

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.configRow}>
          <div style={styles.tableNameGroup}>
            <span style={styles.label}>表名:</span>
            <input
              type="text"
              value={activeItem.tableName}
              onChange={handleTableNameChange}
              style={styles.tableNameInput}
              placeholder="输入表名"
            />
          </div>

          <div style={styles.headerCheckbox}>
            <input
              type="checkbox"
              id="hasHeader"
              checked={activeItem.hasHeader}
              onChange={handleHasHeaderChange}
            />
            <label htmlFor="hasHeader">CSV包含表头</label>
          </div>

          <button
            style={styles.inferBtn}
            onClick={inferFieldTypes}
          >
            🔮 自动推断类型
          </button>

          <button
            style={styles.importBtn}
            onClick={handleSingleImport}
            disabled={activeItem.status === 'importing' || activeItem.status === 'success'}
          >
            <PlayIcon size={16} />
            <span>
              {activeItem.status === 'importing' ? '导入中...' : '导入'}
            </span>
          </button>
        </div>
      </div>

      <div style={styles.fieldsSection}>
        <div style={styles.fieldsHeader}>
          <span style={styles.sectionTitle}>字段配置</span>
        </div>
        <div style={styles.fieldsTableContainer}>
          <table style={styles.fieldsTable}>
            <thead>
              <tr>
                <th style={styles.th}>#</th>
                <th style={styles.th}>字段名</th>
                <th style={styles.th}>类型</th>
                <th style={styles.th}>样本值</th>
              </tr>
            </thead>
            <tbody>
              {activeItem.fields.map((field, index) => (
                <tr key={index} style={styles.tr}>
                  <td style={styles.td}>{index + 1}</td>
                  <td style={styles.td}>
                    <input
                      type="text"
                      value={field.name}
                      onChange={(e) => handleFieldNameChange(index, e.target.value)}
                      style={styles.fieldNameInput}
                    />
                  </td>
                  <td style={styles.td}>
                    <select
                      value={field.dataType}
                      onChange={(e) => handleFieldTypeChange(index, e.target.value)}
                      style={styles.fieldTypeSelect}
                    >
                      <option value="TEXT">TEXT</option>
                      <option value="INTEGER">INTEGER</option>
                      <option value="REAL">REAL</option>
                      <option value="BOOLEAN">BOOLEAN</option>
                      <option value="DATE">DATE</option>
                    </select>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.sampleValue}>
                      {getSampleValue(index)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={styles.previewSection}>
        <div style={styles.previewHeader}>
          <span style={styles.sectionTitle}>
            数据预览 ({rowData.length} 行 × {activeItem.fields.length} 列)
          </span>
          {activeItem.hasHeader && (
            <span style={styles.previewHint}>(第一行作为表头)</span>
          )}
        </div>
        <div style={styles.gridContainer} className="ag-theme-alpine">
          <AgGridReact
            columnDefs={columnDefs}
            rowData={rowData}
            defaultColDef={{
              sortable: true,
              filter: true,
              resizable: true,
              minWidth: 150,
            }}
            containerStyle={{ height: '100%', width: '100%' }}
            animateRows={true}
            rowSelection="single"
          />
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: '#fff',
    overflow: 'hidden',
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: '14px',
  },
  header: {
    padding: '12px 16px',
    borderBottom: '1px solid #e0e0e0',
    background: '#f8f9fa',
  },
  configRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
  },
  tableNameGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  label: {
    fontSize: '13px',
    color: '#666',
  },
  tableNameInput: {
    padding: '6px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    width: '200px',
    outline: 'none',
  },
  headerCheckbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    color: '#666',
  },
  inferBtn: {
    padding: '6px 12px',
    fontSize: '12px',
    background: '#e3f2fd',
    border: '1px solid #007bff',
    borderRadius: '4px',
    color: '#007bff',
    cursor: 'pointer',
  },
  importBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 16px',
    background: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    marginLeft: 'auto',
  },
  fieldsSection: {
    borderBottom: '1px solid #e0e0e0',
    background: '#fafafa',
    maxHeight: '300px',
    overflowY: 'auto',
  },
  fieldsHeader: {
    padding: '10px 16px',
    background: '#f0f2f5',
    borderBottom: '1px solid #e0e0e0',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#333',
  },
  fieldsTableContainer: {
    padding: '8px 16px',
  },
  fieldsTable: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    padding: '8px 12px',
    background: '#f5f7fa',
    textAlign: 'left',
    fontSize: '13px',
    fontWeight: 600,
    color: '#666',
    borderBottom: '1px solid #e0e0e0',
  },
  tr: {
    borderBottom: '1px solid #f0f0f0',
  },
  td: {
    padding: '8px 12px',
    verticalAlign: 'middle',
  },
  fieldNameInput: {
    width: '100%',
    padding: '6px 10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '13px',
    outline: 'none',
  },
  fieldTypeSelect: {
    padding: '6px 10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '13px',
    outline: 'none',
    cursor: 'pointer',
    minWidth: '120px',
  },
  sampleValue: {
    fontSize: '13px',
    color: '#666',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '200px',
    display: 'inline-block',
  },
  previewSection: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  previewHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 16px',
    background: '#fafafa',
    borderBottom: '1px solid #e0e0e0',
  },
  previewHint: {
    fontSize: '12px',
    fontWeight: 400,
    color: '#999',
  },
  gridContainer: {
    flex: 1,
    overflow: 'hidden',
  },
};

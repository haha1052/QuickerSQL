import React from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import { PlayIcon } from '../common/Icons';
import { useImportStore, useAppStore } from '../../store';
import { tauriService } from '../../services';
import { useLocale } from '../../context/LocaleContext';

ModuleRegistry.registerModules([AllCommunityModule]);

interface DataPreviewProps {
  onImportComplete: () => void;
}

export const DataPreview: React.FC<DataPreviewProps> = ({ onImportComplete }) => {
  const {
    importItems, activeImportItemId, updateImportItem, setLoading,
  } = useImportStore();
  const { setMessage } = useAppStore();
  const { t, locale, localeText } = useLocale();

  const activeItem = importItems.find((item) => item.id === activeImportItemId);

  if (!activeItem || activeItem.isParent) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <p style={styles.emptyText}>{t('import.selectFile')}</p>
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
        setMessage(response.data || `${t('import.success')} ${activeItem.tableName}`, 'success');
        onImportComplete();
      } else {
        updateImportItem(activeItem.id, { status: 'error', error: response.error });
        setMessage(`${t('import.fail')}: ${response.error}`, 'error');
      }
    } catch (e) {
      updateImportItem(activeItem.id, { status: 'error', error: String(e) });
      setMessage(`${t('import.fail')}: ${String(e)}`, 'error');
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
            <span style={styles.label}>Table:</span>
            <input
              type="text"
              value={activeItem.tableName}
              onChange={handleTableNameChange}
              style={styles.tableNameInput}
              placeholder="Enter table name"
            />
          </div>

          <div style={styles.headerCheckbox}>
            <input
              type="checkbox"
              id="hasHeader"
              checked={activeItem.hasHeader}
              onChange={handleHasHeaderChange}
            />
            <label htmlFor="hasHeader">CSV includes header</label>
          </div>

          <button
            style={styles.inferBtn}
            onClick={inferFieldTypes}
          >
            🔮 Auto infer
          </button>

          <button
            style={styles.importBtn}
            onClick={handleSingleImport}
            disabled={activeItem.status === 'importing' || activeItem.status === 'success'}
          >
            <PlayIcon size={16} />
            <span>
              {activeItem.status === 'importing' ? t('import.importing') : t('import.import')}
            </span>
          </button>
        </div>
      </div>

      <div style={styles.fieldsSection}>
        <div style={styles.fieldsHeader}>
          <span style={styles.sectionTitle}>Field Configuration</span>
        </div>
        <div style={styles.fieldsTableContainer}>
          <table style={styles.fieldsTable}>
            <thead>
              <tr>
                <th style={styles.th}>#</th>
                <th style={styles.th}>{t('import.field')}</th>
                <th style={styles.th}>{t('import.type')}</th>
                <th style={styles.th}>{t('import.sample')}</th>
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
            {t('import.preview')} ({rowData.length} rows × {activeItem.fields.length} cols)
          </span>
          {activeItem.hasHeader && (
            <span style={styles.previewHint}>(first row as header)</span>
          )}
        </div>
        <div style={styles.gridContainer} className="ag-theme-alpine">
          <AgGridReact
            key={locale}
            columnDefs={columnDefs}
            rowData={rowData}
            localeText={localeText}
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
    background: 'var(--bg-primary)',
    overflow: 'hidden',
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: 'var(--text-secondary)',
    fontSize: '14px',
  },
  header: {
    padding: '12px 16px',
    borderBottom: '1px solid var(--border-primary)',
    background: 'var(--bg-secondary)',
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
    color: 'var(--text-secondary)',
  },
  tableNameInput: {
    padding: '6px 12px',
    border: '1px solid var(--border-primary)',
    borderRadius: '4px',
    fontSize: '14px',
    width: '200px',
    outline: 'none',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
  },
  headerCheckbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    color: 'var(--text-secondary)',
  },
  inferBtn: {
    padding: '6px 12px',
    fontSize: '12px',
    background: 'var(--primary-bg)',
    border: '1px solid var(--primary)',
    borderRadius: '4px',
    color: 'var(--primary)',
    cursor: 'pointer',
  },
  importBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 16px',
    background: 'var(--primary)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    marginLeft: 'auto',
  },
  fieldsSection: {
    borderBottom: '1px solid var(--border-primary)',
    background: 'var(--bg-tertiary)',
    maxHeight: '300px',
    overflowY: 'auto',
  },
  fieldsHeader: {
    padding: '10px 16px',
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border-primary)',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-primary)',
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
    background: 'var(--bg-secondary)',
    textAlign: 'left',
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    borderBottom: '1px solid var(--border-primary)',
  },
  tr: {
    borderBottom: '1px solid var(--border-primary)',
  },
  td: {
    padding: '8px 12px',
    verticalAlign: 'middle',
  },
  fieldNameInput: {
    width: '100%',
    padding: '6px 10px',
    border: '1px solid var(--border-primary)',
    borderRadius: '4px',
    fontSize: '13px',
    outline: 'none',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
  },
  fieldTypeSelect: {
    padding: '6px 10px',
    border: '1px solid var(--border-primary)',
    borderRadius: '4px',
    fontSize: '13px',
    outline: 'none',
    cursor: 'pointer',
    minWidth: '120px',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
  },
  sampleValue: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
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
    background: 'var(--bg-tertiary)',
    borderBottom: '1px solid var(--border-primary)',
  },
  previewHint: {
    fontSize: '12px',
    fontWeight: 400,
    color: 'var(--text-secondary)',
  },
  gridContainer: {
    flex: 1,
    overflow: 'hidden',
  },
};

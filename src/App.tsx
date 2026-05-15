import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { useState } from 'react';
import './App.css';
import { AgGridReact } from 'ag-grid-react';
import { ColDef } from 'ag-grid-community';

interface CsvPreview {
  headers: string[];
  rows: string[][];
}

function App() {
  const [rowData, setRowData] = useState<any[]>([]);
  const [colDefs, setColDefs] = useState<ColDef[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleLoadCsv() {
    setLoading(true);
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      });

      if (typeof selected === 'string') {
        const result = await invoke<CsvPreview>("load_csv", { filePath: selected });
        
        const columns = result.headers.map((header: string) => ({
          field: header,
          filter: true,
          sortable: true,
          resizable: true,
          minWidth: 120,
        }));
        setColDefs(columns);

        const rows = result.rows.map((row: string[]) => {
          let obj: any = {};
          result.headers.forEach((h: string, i: number) => {
            obj[h] = row[i];
          });
          return obj;
        });
        setRowData(rows);
      }
    } catch (e) {
      alert("读取失败：" + e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ padding: '10px', borderBottom: '1px solid #ccc', backgroundColor: '#fff' }}>
        <button onClick={handleLoadCsv} style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}>
          选择 CSV 文件
        </button>
        {loading && <span style={{ marginLeft: '10px', color: '#666' }}>正在加载数据...</span>}
      </div>

      <div style={{ flex: 1, width: '100%' }} className="ag-theme-alpine">
        <AgGridReact
          rowData={rowData}
          columnDefs={colDefs}
          domLayout='normal'
          pagination={true}
          paginationPageSize={50}
          enableCellTextSelection={true}
        />
      </div>
    </div>
  );
}

export default App;
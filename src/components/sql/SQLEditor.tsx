import React from 'react';
import type { SqlQuery } from '../../types';

interface SQLEditorProps {
  query: SqlQuery;
  onChange: (sql: string) => void;
  onExecute: () => void;
  isLoading: boolean;
}

export const SQLEditor: React.FC<SQLEditorProps> = ({
  query,
  onChange,
  onExecute,
  isLoading,
}) => {
  return (
    <div style={styles.container}>
      <div style={styles.editorHeader}>
        <div style={styles.queryName}>{query.name}</div>
        <button
          style={{
            ...styles.executeButton,
            opacity: isLoading ? 0.7 : 1,
            cursor: isLoading ? 'not-allowed' : 'pointer',
          }}
          onClick={onExecute}
          disabled={isLoading}
        >
          {isLoading ? '执行中...' : '执行'}
        </button>
      </div>
      <textarea
        style={styles.textarea}
        value={query.sql}
        onChange={(e) => onChange(e.target.value)}
        placeholder="输入 SQL 查询..."
        spellCheck={false}
      />
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
  editorHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid #ddd',
    background: '#f8f9fa',
  },
  queryName: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#333',
  },
  executeButton: {
    padding: '8px 20px',
    background: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
  },
  textarea: {
    flex: 1,
    padding: '16px',
    border: 'none',
    fontSize: '14px',
    fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
    lineHeight: 1.5,
    resize: 'none',
    outline: 'none',
  },
};

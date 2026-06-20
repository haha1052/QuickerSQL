import React from 'react';
import type { SqlQuery } from '../../types';
import { useSetting } from '../../context/SettingsContext';
import { useLocale } from '../../context/LocaleContext';

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
  const { t } = useLocale();

  // 外观设置
  const [fontSize] = useSetting('appearance', 'fontSize');
  const [fontFamily] = useSetting('appearance', 'fontFamily');
  const [lineHeight] = useSetting('appearance', 'lineHeight');
  const [wordWrap] = useSetting('appearance', 'wordWrap');
  const [tabSize] = useSetting('appearance', 'tabSize');

  // 编辑器设置
  const [autoSave] = useSetting('editor', 'autoSave');
  const [saveInterval] = useSetting('editor', 'saveInterval');

  const fontSizeNum = parseInt(fontSize || '14', 10);
  const lineHeightNum = parseFloat(lineHeight || '1.6');
  const tabSizeNum = parseInt(tabSize || '2', 10);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      const newSql = query.sql.substring(0, start) + ' '.repeat(tabSizeNum) + query.sql.substring(end);
      onChange(newSql);

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + tabSizeNum;
      }, 0);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.editorHeader}>
        <div style={styles.queryName}>{query.name}</div>
        {autoSave === 'true' && (
          <div style={styles.autoSaveIndicator}>
            {t('sqlEditor.autoSaveEnabled')}
            {saveInterval && <span style={{fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '8px'}}>（{t('sqlEditor.autoSaveEvery30')}）</span>}
          </div>
        )}
        <button
          style={{
            ...styles.executeButton,
            opacity: isLoading ? 0.7 : 1,
            cursor: isLoading ? 'not-allowed' : 'pointer',
          }}
          onClick={onExecute}
          disabled={isLoading}
        >
          {isLoading ? t('sqlEditor.executing') : t('query.execute')}
        </button>
      </div>
      <textarea
        style={{
          ...styles.textarea,
          fontSize: `${fontSizeNum}px`,
          fontFamily: fontFamily || 'Monaco, Menlo, "Ubuntu Mono", monospace',
          lineHeight: lineHeightNum,
          whiteSpace: wordWrap === 'true' ? 'pre-wrap' : 'pre',
          color: 'var(--text-primary)',
          backgroundColor: 'var(--bg-secondary)',
        }}
        value={query.sql}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t('sqlEditor.inputSql')}
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
    background: 'var(--bg-secondary)',
  },
  editorHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border-primary)',
    background: 'var(--bg-tertiary)',
  },
  queryName: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: 'var(--text-primary)',
  },
  autoSaveIndicator: {
    fontSize: '12px',
    color: 'var(--success)',
    background: 'var(--success-bg)',
    padding: '4px 10px',
    borderRadius: '4px',
  },
  executeButton: {
    padding: '8px 24px',
    background: 'var(--primary)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
  },
  textarea: {
    flex: 1,
    padding: '16px',
    border: 'none',
    resize: 'none',
    outline: 'none',
  },
};

import React from 'react';
import type { SqlQuery } from '../../types';
import { useSetting } from '../../context/SettingsContext';
import { useLocale } from '../../context/LocaleContext';

interface SQLEditorProps {
  query: SqlQuery;
  onChange: (sql: string) => void;
}

export const SQLEditor: React.FC<SQLEditorProps> = ({
  query,
  onChange,
}) => {
  const { t } = useLocale();

  // 外观设置
  const [fontSize] = useSetting('appearance', 'fontSize');
  const [fontFamily] = useSetting('appearance', 'fontFamily');
  const [lineHeight] = useSetting('appearance', 'lineHeight');
  const [wordWrap] = useSetting('appearance', 'wordWrap');
  const [tabSize] = useSetting('appearance', 'tabSize');

  const fontSizeNum = parseInt(fontSize || '14', 10);
  const lineHeightNum = parseFloat(lineHeight || '1.6');
  const tabSizeNum = parseInt(tabSize || '2', 10);

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
      onKeyDown={handleTabKeyDown}
      placeholder={t('sqlEditor.inputSql')}
      spellCheck={false}
    />
  );
};

const styles: Record<string, React.CSSProperties> = {
  textarea: {
    flex: 1,
    padding: '16px',
    border: 'none',
    resize: 'none',
    outline: 'none',
  },
};

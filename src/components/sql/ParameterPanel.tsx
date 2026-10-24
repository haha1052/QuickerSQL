import React, { useState, useMemo } from 'react';
import { extractParameters, type SqlParameter } from '../../utils/sqlParameterParser';
import { useLocale } from '../../context/LocaleContext';

interface ParameterPanelProps {
  sql: string;
}

export const ParameterPanel: React.FC<ParameterPanelProps> = ({ sql }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [values, setValues] = useState<Record<string, string>>({});
  const { t } = useLocale();

  const parameters = useMemo(() => extractParameters(sql), [sql]);

  const handleValueChange = (paramName: string, value: string) => {
    setValues((prev) => ({
      ...prev,
      [paramName]: value,
    }));
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      console.warn('[ParameterPanel] 复制失败:', e);
    }
  };

  const getTypeLabel = (type: SqlParameter['type']): string => {
    switch (type) {
      case 'numeric':
        return t('query.parameter.number');
      case 'named':
        return t('query.parameter.named');
      case 'template':
        return t('query.parameter.template');
      default:
        return '';
    }
  };

  const getTypeBadgeStyle = (type: SqlParameter['type']): React.CSSProperties => {
    switch (type) {
      case 'numeric':
        return {
          background: 'var(--primary-bg)',
          color: 'var(--primary)',
        };
      case 'named':
        return {
          background: 'var(--success-bg)',
          color: 'var(--success)',
        };
      case 'template':
        return {
          background: 'var(--warning-bg)',
          color: 'var(--warning)',
        };
      default:
        return {};
    }
  };

  if (parameters.length === 0) {
    return null;
  }

  return (
    <div style={styles.container}>
      <div
        style={styles.header}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={styles.headerLeft}>
          <span style={styles.toggleIcon}>
            {isExpanded ? '▼' : '▶'}
          </span>
          <span style={styles.title}>参数</span>
          <span style={styles.countBadge}>
            {parameters.length}
          </span>
        </div>
        <span style={styles.hint}>
          检测到的参数占位符（手动替换后执行）
        </span>
      </div>

      {isExpanded && (
        <div style={styles.content}>
          <div style={styles.notice}>
            <span style={styles.noticeIcon}>ℹ️</span>
            <span style={styles.noticeText}>
              当前版本为 UI 预览，参数值不自动替换，请手动替换后执行
            </span>
          </div>

          <div style={styles.paramList}>
            {parameters.map((param) => (
              <div key={param.name + param.type} style={styles.paramRow}>
                <div style={styles.paramInfo}>
                  <button
                    style={styles.paramNameButton}
                    onClick={() => copyToClipboard(param.raw)}
                    title={t('query.copyToClipboard')}
                  >
                    <code style={styles.paramName}>{param.raw}</code>
                  </button>
                  <span style={{ ...styles.typeBadge, ...getTypeBadgeStyle(param.type) }}>
                    {getTypeLabel(param.type)}
                  </span>
                </div>
                <input
                  type="text"
                  style={styles.input}
                  value={values[param.name] || ''}
                  onChange={(e) => handleValueChange(param.name, e.target.value)}
                  placeholder={t('query.parameter.inputPlaceholder', { raw: param.raw })}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    borderTop: '1px solid var(--border-primary)',
    background: 'var(--bg-secondary)',
    fontSize: '13px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    cursor: 'pointer',
    userSelect: 'none',
    background: 'var(--bg-tertiary)',
    borderBottom: '1px solid var(--border-primary)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  toggleIcon: {
    fontSize: '10px',
    color: 'var(--text-tertiary)',
    width: '12px',
    textAlign: 'center',
  },
  title: {
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  countBadge: {
    fontSize: '11px',
    padding: '1px 6px',
    borderRadius: '10px',
    background: 'var(--primary-bg)',
    color: 'var(--primary)',
    fontWeight: 500,
  },
  hint: {
    fontSize: '12px',
    color: 'var(--text-tertiary)',
  },
  content: {
    padding: '12px',
  },
  notice: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '8px 12px',
    marginBottom: '12px',
    background: 'var(--warning-bg)',
    borderRadius: '6px',
    border: '1px solid var(--border-secondary)',
  },
  noticeIcon: {
    fontSize: '14px',
    flexShrink: 0,
  },
  noticeText: {
    fontSize: '12px',
    color: 'var(--warning)',
    lineHeight: 1.5,
  },
  paramList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  paramRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  paramInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    minWidth: '180px',
    flexShrink: 0,
  },
  paramNameButton: {
    background: 'none',
    border: 'none',
    padding: '4px 8px',
    cursor: 'pointer',
    borderRadius: '4px',
    transition: 'background 0.2s',
  },
  paramName: {
    fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
    fontSize: '12px',
    color: 'var(--primary)',
    background: 'var(--primary-bg)',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  typeBadge: {
    fontSize: '10px',
    padding: '1px 6px',
    borderRadius: '10px',
    fontWeight: 500,
  },
  input: {
    flex: 1,
    padding: '6px 10px',
    fontSize: '13px',
    border: '1px solid var(--border-primary)',
    borderRadius: '6px',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
};

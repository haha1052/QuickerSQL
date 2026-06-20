import React from 'react';
import { useLocale } from '../../context/LocaleContext';

interface ChartConfigPanelProps {
  columns: string[];
  config: {
    xAxisColumn: string;
    yAxisColumns: string[];
  };
  onChange: (config: { xAxisColumn?: string; yAxisColumns?: string[] }) => void;
}

export const ChartConfigPanel: React.FC<ChartConfigPanelProps> = ({
  columns,
  config,
  onChange,
}) => {
  const { t } = useLocale();

  const handleXAxisChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ xAxisColumn: e.target.value });
  };

  const handleYAxisToggle = (column: string) => {
    const newYAxis = config.yAxisColumns.includes(column)
      ? config.yAxisColumns.filter((c) => c !== column)
      : [...config.yAxisColumns, column];
    onChange({ yAxisColumns: newYAxis });
  };

  return (
    <div style={styles.container}>
      {/* X轴选择 */}
      <div style={styles.section}>
        <label style={styles.label}>{t('chart.xAxis')}</label>
        <select
          value={config.xAxisColumn}
          onChange={handleXAxisChange}
          style={styles.select}
        >
          <option value="">{t('chart.selectXAxis')}</option>
          {columns.map((col) => (
            <option key={col} value={col}>
              {col}
            </option>
          ))}
        </select>
      </div>

      {/* Y轴选择 */}
      <div style={styles.section}>
        <div style={styles.yAxisHeader}>
          <label style={styles.label}>{t('chart.yAxis')}</label>
          <div style={styles.actionButtons}>
            <button
              onClick={() => onChange({ yAxisColumns: [...columns] })}
              style={styles.actionButton}
            >
              {t('common.selectAll')}
            </button>
            <button
              onClick={() => onChange({ yAxisColumns: [] })}
              style={styles.actionButton}
            >
              {t('common.selectNone')}
            </button>
          </div>
        </div>
        <div style={styles.checkboxGroup}>
          {columns.map((col) => (
            <label key={col} style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={config.yAxisColumns.includes(col)}
                onChange={() => handleYAxisToggle(col)}
                style={styles.checkbox}
              />
              <span>{col}</span>
            </label>
          ))}
        </div>
      </div>

      {/* 提示 */}
      {config.yAxisColumns.length === 0 && (
        <div style={styles.warning}>
          {t('chart.selectAtLeastOneY')}
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '16px',
    background: 'var(--bg-tertiary)',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  yAxisHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionButtons: {
    display: 'flex',
    gap: '8px',
  },
  actionButton: {
    padding: '4px 10px',
    fontSize: '12px',
    background: 'var(--primary)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  label: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  select: {
    padding: '8px 12px',
    border: '1px solid var(--border-primary)',
    borderRadius: '4px',
    fontSize: '13px',
    background: 'var(--bg-secondary)',
    cursor: 'pointer',
    color: 'var(--text-primary)',
  },
  checkboxGroup: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    transition: 'all 0.2s',
    color: 'var(--text-primary)',
  },
  checkbox: {
    cursor: 'pointer',
  },
  warning: {
    padding: '8px 12px',
    background: 'var(--warning-bg)',
    border: '1px solid var(--warning)',
    borderRadius: '4px',
    color: 'var(--warning)',
    fontSize: '12px',
  },
};

export default ChartConfigPanel;

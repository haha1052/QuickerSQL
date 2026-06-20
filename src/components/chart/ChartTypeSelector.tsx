import React from 'react';
import { useLocale } from '../../context/LocaleContext';

export type ChartType = 'bar' | 'line' | 'pie' | 'stackedBar' | 'area' | 'scatter';

interface ChartTypeSelectorProps {
  value: ChartType;
  onChange: (type: ChartType) => void;
  recommended?: ChartType[];
}

export const ChartTypeSelector: React.FC<ChartTypeSelectorProps> = ({
  value,
  onChange,
  recommended = [],
}) => {
  const { t } = useLocale();
  const isRecommended = (type: ChartType) => recommended.includes(type);

  const CHART_TYPES: Array<{
    type: ChartType;
    label: string;
    icon: string;
    description: string;
  }> = [
    {
      type: 'bar',
      label: t('chart.bar'),
      icon: '📊',
      description: t('chart.suitable.compare'),
    },
    {
      type: 'line',
      label: t('chart.line'),
      icon: '📈',
      description: t('chart.suitable.trend'),
    },
    {
      type: 'pie',
      label: t('chart.pie'),
      icon: '🥧',
      description: t('chart.suitable.proportion'),
    },
    {
      type: 'stackedBar',
      label: t('chart.stackedBar'),
      icon: '📊',
      description: t('chart.suitable.multiDimensional'),
    },
    {
      type: 'area',
      label: t('chart.area'),
      icon: '📈',
      description: t('chart.suitable.cumulative'),
    },
    {
      type: 'scatter',
      label: t('chart.scatter'),
      icon: '🕸️',
      description: t('chart.suitable.correlation'),
    },
  ];

  return (
    <div style={styles.container}>
      <div style={styles.scrollContainer}>
        <div style={styles.buttonRow}>
          {CHART_TYPES.map(({ type, label, icon, description }) => (
            <button
              key={type}
              onClick={() => onChange(type)}
              style={{
                ...styles.button,
                ...(value === type ? styles.buttonActive : {}),
              }}
              title={description}
            >
              <span style={styles.icon}>{icon}</span>
              <span style={styles.label}>{label}</span>
              {isRecommended(type) && (
                <span style={styles.badge}>{t('chart.recommended')}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '4px',
  },
  scrollContainer: {
    overflowX: 'auto',
    overflowY: 'hidden',
    whiteSpace: 'nowrap',
    scrollbarWidth: 'thin',
  },
  buttonRow: {
    display: 'inline-flex',
    gap: '8px',
    padding: '4px 0',
  },
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border-primary)',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    position: 'relative',
    whiteSpace: 'nowrap',
    color: 'var(--text-primary)',
  },
  buttonActive: {
    background: 'var(--primary)',
    border: '1px solid var(--primary)',
    color: 'white',
  },
  icon: {
    fontSize: '16px',
  },
  label: {
    fontSize: '12px',
    fontWeight: 500,
  },
  badge: {
    position: 'absolute',
    top: '-4px',
    right: '-4px',
    fontSize: '9px',
    background: 'var(--success)',
    color: 'white',
    padding: '1px 4px',
    borderRadius: '3px',
  },
};

export default ChartTypeSelector;

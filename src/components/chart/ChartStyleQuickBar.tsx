import React, { useCallback } from 'react';
import type { VisualConfig } from '../../types/chart';
import { useLocale } from '../../context/LocaleContext';

interface ChartStyleQuickBarProps {
  value: VisualConfig;
  onChange: (config: VisualConfig) => void;
}

const COLOR_SCHEMES = [
  { id: 'default', colors: ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272'] },
  { id: 'dark', colors: ['#4992ff', '#7cffb2', '#fddd60', '#ff6e76', '#58d9f9', '#05c091'] },
  { id: 'light', colors: ['#9ecaff', '#b8f0c8', '#ffe89c', '#ffa5ad', '#b0ecf7', '#7edcc3'] },
  { id: 'colorful', colors: ['#ff4d4f', '#fa8c16', '#faad14', '#a0d911', '#52c41a', '#13c2c2'] },
  { id: 'pastel', colors: ['#ffb3ba', '#ffdfba', '#ffffba', '#baffc9', '#bae1ff', '#e0baff'] },
  { id: 'vivid', colors: ['#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4'] },
];

const LEGEND_POSITIONS = [
  { value: 'top', label: 'chart.visual.legendTop' },
  { value: 'bottom', label: 'chart.visual.legendBottom' },
  { value: 'left', label: 'chart.visual.legendLeft' },
  { value: 'right', label: 'chart.visual.legendRight' },
];

export const ChartStyleQuickBar: React.FC<ChartStyleQuickBarProps> = ({ value, onChange }) => {
  const { t } = useLocale();

  const handleColorScheme = useCallback((schemeId: string) => {
    const scheme = COLOR_SCHEMES.find(s => s.id === schemeId);
    if (scheme) {
      onChange({
        ...value,
        color: {
          ...value.color,
          scheme: schemeId,
          customPalette: scheme.colors,
        },
      });
    }
  }, [value, onChange]);

  const handleLegendPosition = useCallback((position: string) => {
    onChange({
      ...value,
      legend: {
        ...value.legend,
        show: true,
        position: position as 'top' | 'bottom' | 'left' | 'right',
      },
    });
  }, [value, onChange]);

  const handleLabelToggle = useCallback(() => {
    const currentShow = value.label?.show ?? false;
    onChange({
      ...value,
      label: {
        ...value.label,
        show: !currentShow,
        position: value.label?.position || 'top',
        format: value.label?.format || ['value'],
      },
    });
  }, [value, onChange]);

  const handleAxisTitle = useCallback((axis: 'xAxis' | 'yAxis', title: string) => {
    onChange({
      ...value,
      [axis]: {
        ...value[axis],
        title: {
          ...value[axis]?.title,
          text: title,
        },
      },
    });
  }, [value, onChange]);

  const currentScheme = value.color?.scheme || 'default';
  const currentLabelShow = value.label?.show ?? false;

  return (
    <div style={styles.container}>
      <div style={styles.group}>
        <div style={styles.label}>{t('chart.visual.color')}</div>
        <div style={styles.colorSwatches}>
          {COLOR_SCHEMES.map((scheme) => (
            <button
              key={scheme.id}
              type="button"
              title={t(`chart.visual.scheme_${scheme.id}`)}
              onClick={() => handleColorScheme(scheme.id)}
              style={{
                ...styles.colorSwatch,
                background: `linear-gradient(90deg, ${scheme.colors.join(', ')})`,
                borderColor: currentScheme === scheme.id ? 'var(--primary)' : 'var(--border-primary)',
              }}
            />
          ))}
        </div>
      </div>

      <div style={styles.divider} />

      <div style={styles.group}>
        <div style={styles.label}>{t('chart.visual.legend')}</div>
        <select
          value={value.legend?.position || 'top'}
          onChange={(e) => handleLegendPosition(e.target.value)}
          style={styles.select}
        >
          {LEGEND_POSITIONS.map(pos => (
            <option key={pos.value} value={pos.value}>
              {t(pos.label)}
            </option>
          ))}
        </select>
      </div>

      <div style={styles.divider} />

      <div style={styles.group}>
        <div style={styles.label}>{t('chart.visual.label')}</div>
        <button
          type="button"
          onClick={handleLabelToggle}
          style={{
            ...styles.toggleBtn,
            background: currentLabelShow ? 'var(--primary)' : 'var(--bg-secondary)',
            color: currentLabelShow ? 'white' : 'var(--text-secondary)',
          }}
        >
          {currentLabelShow ? t('chart.visual.labelOn') : t('chart.visual.labelOff')}
        </button>
      </div>

      <div style={styles.divider} />

      <div style={styles.group}>
        <div style={styles.label}>{t('chart.visual.xAxisTitle')}</div>
        <input
          type="text"
          value={value.xAxis?.title?.text || ''}
          onChange={(e) => handleAxisTitle('xAxis', e.target.value)}
          placeholder={t('chart.visual.xAxisPlaceholder')}
          style={styles.input}
        />
      </div>

      <div style={styles.group}>
        <div style={styles.label}>{t('chart.visual.yAxisTitle')}</div>
        <input
          type="text"
          value={value.yAxis?.title?.text || ''}
          onChange={(e) => handleAxisTitle('yAxis', e.target.value)}
          placeholder={t('chart.visual.yAxisPlaceholder')}
          style={styles.input}
        />
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 16px',
    background: 'var(--bg-secondary)',
    borderRadius: '6px',
    border: '1px solid var(--border-primary)',
    flexWrap: 'wrap',
  },
  group: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  label: {
    fontSize: '12px',
    color: 'var(--text-tertiary)',
    whiteSpace: 'nowrap',
  },
  colorSwatches: {
    display: 'flex',
    gap: '4px',
  },
  colorSwatch: {
    width: '24px',
    height: '16px',
    borderRadius: '3px',
    border: '2px solid',
    cursor: 'pointer',
    padding: 0,
    outline: 'none',
  },
  select: {
    padding: '4px 8px',
    fontSize: '12px',
    border: '1px solid var(--border-primary)',
    borderRadius: '4px',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
  },
  toggleBtn: {
    padding: '4px 10px',
    fontSize: '12px',
    border: '1px solid var(--border-primary)',
    borderRadius: '4px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  input: {
    padding: '4px 8px',
    fontSize: '12px',
    border: '1px solid var(--border-primary)',
    borderRadius: '4px',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    width: '100px',
  },
  divider: {
    width: '1px',
    height: '20px',
    background: 'var(--border-primary)',
  },
};

export default ChartStyleQuickBar;
import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { VisualConfig, AxisVisualConfig } from '../../types/chart';
import { useLocale } from '../../context/LocaleContext';

interface ChartVisualFullEditorProps {
  value: VisualConfig;
  onChange: (config: VisualConfig) => void;
  seriesNames?: string[];
  itemNames?: string[];
  isItemBased?: boolean;
}

type TabKey = 'title' | 'legend' | 'axes' | 'labels' | 'grid' | 'color' | 'animation' | 'tooltip';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'color', label: 'chart.visual.tabColor', icon: '🎨' },
  { key: 'title', label: 'chart.visual.tabTitle', icon: '📝' },
  { key: 'legend', label: 'chart.visual.tabLegend', icon: '📍' },
  { key: 'axes', label: 'chart.visual.tabAxes', icon: '📐' },
  { key: 'labels', label: 'chart.visual.tabLabels', icon: '🏷️' },
  { key: 'grid', label: 'chart.visual.tabGrid', icon: '🔲' },
  { key: 'animation', label: 'chart.visual.tabAnimation', icon: '✨' },
  { key: 'tooltip', label: 'chart.visual.tabTooltip', icon: '💬' },
];

const COLOR_SCHEMES = [
  { id: 'default', colors: ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc'] },
  { id: 'dark', colors: ['#4992ff', '#7cffb2', '#fddd60', '#ff6e76', '#58d9f9', '#05c091', '#ff8a45', '#8d48e3', '#dd79ff'] },
  { id: 'light', colors: ['#9ecaff', '#b8f0c8', '#ffe89c', '#ffa5ad', '#b0ecf7', '#7edcc3', '#ffc39e', '#d0a8f0', '#f5b8e0'] },
  { id: 'colorful', colors: ['#ff4d4f', '#fa8c16', '#faad14', '#a0d911', '#52c41a', '#13c2c2', '#1890ff', '#722ed1', '#eb2f96'] },
  { id: 'pastel', colors: ['#ffb3ba', '#ffdfba', '#ffffba', '#baffc9', '#bae1ff', '#e0baff', '#ffb3e6', '#c9c9ff', '#ffd6a5'] },
  { id: 'vivid', colors: ['#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6', '#bcf60c'] },
];

export const ChartVisualFullEditor: React.FC<ChartVisualFullEditorProps> = ({
  value,
  onChange,
  seriesNames = [],
  itemNames = [],
  isItemBased = false,
}) => {
  const { t } = useLocale();
  const [activeTab, setActiveTab] = useState<TabKey>('color');

  const valueRef = useRef<VisualConfig>(value);
  useEffect(() => { valueRef.current = value; }, [value]);

  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const updateField = useCallback(<K extends keyof VisualConfig>(key: K, val: VisualConfig[K]) => {
    const current = valueRef.current;
    const existing = current[key] as Record<string, unknown> | undefined;
    if (
      val !== null && val !== undefined && typeof val === 'object' && !Array.isArray(val) &&
      existing !== null && existing !== undefined && typeof existing === 'object' && !Array.isArray(existing)
    ) {
      const merged: Record<string, unknown> = { ...existing, ...(val as Record<string, unknown>) };
      Object.keys(merged).forEach((k) => {
        if (merged[k] === null || merged[k] === undefined) delete merged[k];
      });
      onChangeRef.current({ ...current, [key]: merged } as VisualConfig);
    } else {
      onChangeRef.current({ ...current, [key]: val });
    }
  }, []);

  const updateAxis = useCallback(
    (axisKey: 'xAxis' | 'yAxis', field: keyof AxisVisualConfig, val: unknown) => {
      const current = valueRef.current;
      onChangeRef.current({
        ...current,
        [axisKey]: {
          ...(current[axisKey] as Record<string, unknown> | undefined),
          [field]: val,
        },
      });
    },
    []
  );

  return (
    <div style={styles.container}>
      <div style={styles.tabsRow}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            style={{
              ...styles.tabBtn,
              ...(activeTab === tab.key ? styles.tabBtnActive : {}),
            }}
          >
            <span style={styles.tabIcon}>{tab.icon}</span>
            <span style={styles.tabLabel}>{t(tab.label)}</span>
          </button>
        ))}
      </div>

      <div style={styles.tabContent}>
        {activeTab === 'color' && (
          <ColorPanel
            value={value}
            updateField={updateField}
            seriesNames={seriesNames}
            itemNames={itemNames}
            isItemBased={isItemBased}
          />
        )}
        {activeTab === 'title' && <TitlePanel value={value} updateField={updateField} />}
        {activeTab === 'legend' && <LegendPanel value={value} updateField={updateField} />}
        {activeTab === 'axes' && <AxesPanel value={value} updateAxis={updateAxis} />}
        {activeTab === 'labels' && <LabelsPanel value={value} updateField={updateField} />}
        {activeTab === 'grid' && <GridPanel value={value} updateField={updateField} />}
        {activeTab === 'animation' && <AnimationPanel value={value} updateField={updateField} />}
        {activeTab === 'tooltip' && <TooltipPanel value={value} updateField={updateField} />}
      </div>
    </div>
  );
};

interface PanelProps {
  value: VisualConfig;
  updateField: <K extends keyof VisualConfig>(key: K, val: VisualConfig[K]) => void;
}

const ColorPanel: React.FC<PanelProps & { seriesNames: string[]; itemNames: string[]; isItemBased: boolean }> = ({ value, updateField, seriesNames, itemNames, isItemBased }) => {
  const { t } = useLocale();
  const currentScheme = value.color?.scheme || 'default';

  const handleScheme = (schemeId: string) => {
    const scheme = COLOR_SCHEMES.find(s => s.id === schemeId);
    if (scheme) {
      updateField('color', { ...value.color, scheme: schemeId, customPalette: scheme.colors });
    }
  };

  const handleSeriesColor = (seriesName: string, color: string) => {
    const overrides = { ...value.color?.seriesOverrides };
    overrides[seriesName] = { ...overrides[seriesName], color };
    updateField('color', { ...value.color, seriesOverrides: overrides });
  };

  const colorTargetNames = isItemBased ? itemNames : seriesNames;
  const colorLabel = isItemBased ? t('chart.visual.itemColors') : t('chart.visual.seriesColors');

  return (
    <div style={styles.panelSection}>
      <div style={styles.subSectionTitle}>{t('chart.visual.colorScheme')}</div>
      <div style={styles.swatchGrid}>
        {COLOR_SCHEMES.map((scheme) => (
          <button
            key={scheme.id}
            type="button"
            title={t(`chart.visual.scheme_${scheme.id}`)}
            onClick={() => handleScheme(scheme.id)}
            style={{
              ...styles.swatchItem,
              ...(currentScheme === scheme.id ? styles.swatchItemSelected : {}),
              background: `linear-gradient(90deg, ${scheme.colors.join(', ')})`,
            }}
          />
        ))}
      </div>

      {colorTargetNames.length > 0 && (
        <>
          <div style={styles.subSectionTitle}>{colorLabel}</div>
          <div style={styles.seriesList}>
            {colorTargetNames.map((name) => {
              const override = value.color?.seriesOverrides?.[name];
              return (
                <div key={name} style={styles.seriesRow}>
                  <span style={styles.seriesName}>{name}</span>
                  <input
                    type="color"
                    value={override?.color || '#5470c6'}
                    onChange={(e) => handleSeriesColor(name, e.target.value)}
                    style={styles.colorPicker}
                  />
                  <span style={styles.colorHex}>{override?.color || '自动'}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

const TitlePanel: React.FC<PanelProps> = ({ value, updateField }) => {
  const { t } = useLocale();
  const title = value.title;

  const getInitialAlign = (): 'left' | 'center' | 'right' => {
    if (title?.align) return title.align;
    if (title?.position === 'center' || title?.position === 'left' || title?.position === 'right') {
      return title.position as 'left' | 'center' | 'right';
    }
    return 'left';
  };

  const getInitialVertical = (): 'top' | 'middle' | 'bottom' => {
    if (title?.verticalAlign) return title.verticalAlign;
    if (title?.position === 'bottom') return 'bottom';
    if (title?.position === 'center') return 'middle';
    return 'top';
  };

  const handleAlignChange = (align: 'left' | 'center' | 'right') => {
    const newTitle = { ...title, align, verticalAlign: getInitialVertical() };
    updateField('title', newTitle);
  };

  const handleVerticalChange = (verticalAlign: 'top' | 'middle' | 'bottom') => {
    const newTitle = { ...title, align: getInitialAlign(), verticalAlign };
    updateField('title', newTitle);
  };

  return (
    <div style={styles.panelSection}>
      <FieldRow label={t('chart.visual.titleText')}>
        <input
          type="text"
          value={title?.text || ''}
          onChange={(e) => updateField('title', { ...title, text: e.target.value })}
          placeholder={t('chart.visual.titlePlaceholder')}
          style={styles.fullWidthInput}
        />
      </FieldRow>
      <FieldRow label={t('chart.visual.horizontalAlign')}>
        <select
          value={getInitialAlign()}
          onChange={(e) => handleAlignChange(e.target.value as 'left' | 'center' | 'right')}
          style={styles.select}
        >
          <option value="left">{t('chart.visual.posLeft')}</option>
          <option value="center">{t('chart.visual.posCenter')}</option>
          <option value="right">{t('chart.visual.posRight')}</option>
        </select>
      </FieldRow>
      <FieldRow label={t('chart.visual.verticalAlign')}>
        <select
          value={getInitialVertical()}
          onChange={(e) => handleVerticalChange(e.target.value as 'top' | 'middle' | 'bottom')}
          style={styles.select}
        >
          <option value="top">{t('chart.visual.posTop')}</option>
          <option value="middle">{t('chart.visual.posCenter')}</option>
          <option value="bottom">{t('chart.visual.posBottom')}</option>
        </select>
      </FieldRow>
      <FieldRow label={t('chart.visual.titleFontSize')}>
        <input
          type="number" min={8} max={48}
          value={title?.fontSize || 14}
          onChange={(e) => updateField('title', { ...title, fontSize: Number(e.target.value) })}
          style={styles.numberInput}
        />
        <span style={styles.unit}>px</span>
      </FieldRow>
      <FieldRow label={t('chart.visual.titleColor')}>
        <input
          type="color"
          value={title?.color || '#333333'}
          onChange={(e) => updateField('title', { ...title, color: e.target.value })}
          style={styles.colorPicker}
        />
      </FieldRow>
      <FieldRow label={t('chart.visual.fontWeight')}>
        <select
          value={title?.fontWeight || 'normal'}
          onChange={(e) => updateField('title', { ...title, fontWeight: e.target.value as 'normal' | 'bold' })}
          style={styles.select}
        >
          <option value="normal">{t('chart.visual.weightNormal')}</option>
          <option value="bold">{t('chart.visual.weightBold')}</option>
        </select>
      </FieldRow>
    </div>
  );
};

const LegendPanel: React.FC<PanelProps> = ({ value, updateField }) => {
  const { t } = useLocale();
  const legend = value.legend;

  return (
    <div style={styles.panelSection}>
      <FieldRow label={t('chart.visual.showLegend')}>
        <ToggleSwitch
          checked={legend?.show ?? true}
          onChange={(v) => updateField('legend', { ...legend, show: v })}
        />
      </FieldRow>
      <FieldRow label={t('chart.visual.legendPosition')}>
        <select
          value={legend?.position || 'top'}
          onChange={(e) => updateField('legend', { ...legend, position: e.target.value as 'top' | 'bottom' | 'left' | 'right' })}
          style={styles.select}
        >
          <option value="top">{t('chart.visual.posTop')}</option>
          <option value="bottom">{t('chart.visual.posBottom')}</option>
          <option value="left">{t('chart.visual.posLeft')}</option>
          <option value="right">{t('chart.visual.posRight')}</option>
        </select>
      </FieldRow>
      <FieldRow label={t('chart.visual.legendOrient')}>
        <select
          value={legend?.orient || 'horizontal'}
          onChange={(e) => updateField('legend', { ...legend, orient: e.target.value as 'horizontal' | 'vertical' })}
          style={styles.select}
        >
          <option value="horizontal">{t('chart.visual.orientHorizontal')}</option>
          <option value="vertical">{t('chart.visual.orientVertical')}</option>
        </select>
      </FieldRow>
      <FieldRow label={t('chart.visual.legendFontSize')}>
        <input
          type="number" min={8} max={24}
          value={legend?.fontSize || 12}
          onChange={(e) => updateField('legend', { ...legend, fontSize: Number(e.target.value) })}
          style={styles.numberInput}
        />
        <span style={styles.unit}>px</span>
      </FieldRow>
    </div>
  );
};

interface AxesPanelProps {
  value: VisualConfig;
  updateAxis: (axisKey: 'xAxis' | 'yAxis', field: keyof AxisVisualConfig, val: unknown) => void;
}

const AxesPanel: React.FC<AxesPanelProps> = ({ value, updateAxis }) => {
  const { t } = useLocale();
  const xAxis = value.xAxis;
  const yAxis = value.yAxis;

  const renderAxis = (axisKey: 'xAxis' | 'yAxis', axis: AxisVisualConfig | undefined) => (
    <div style={styles.axisBlock}>
      <div style={styles.axisTitle}>{axisKey === 'xAxis' ? 'X' : 'Y'} {t('chart.visual.axis')}</div>
      <FieldRow label={t('chart.visual.showAxis')}>
        <ToggleSwitch
          checked={axis?.show ?? true}
          onChange={(v) => updateAxis(axisKey, 'show', v)}
        />
      </FieldRow>
      <FieldRow label={t('chart.visual.axisTitle')}>
        <input
          type="text"
          value={axis?.title?.text || ''}
          onChange={(e) => updateAxis(axisKey, 'title', { ...axis?.title, text: e.target.value })}
          placeholder={t('chart.visual.axisTitlePlaceholder')}
          style={styles.fullWidthInput}
        />
      </FieldRow>
      <FieldRow label={t('chart.visual.titleFontSize')}>
        <input
          type="number" min={8} max={32}
          value={axis?.title?.fontSize || 12}
          onChange={(e) => updateAxis(axisKey, 'title', { ...axis?.title, fontSize: Number(e.target.value) })}
          style={styles.numberInput}
        />
        <span style={styles.unit}>px</span>
      </FieldRow>
      <FieldRow label={t('chart.visual.titleColor')}>
        <input
          type="color"
          value={axis?.title?.color || '#666666'}
          onChange={(e) => updateAxis(axisKey, 'title', { ...axis?.title, color: e.target.value })}
          style={styles.colorPicker}
        />
      </FieldRow>
      <FieldRow label={t('chart.visual.labelRotate')}>
        <input
          type="range" min={-90} max={90}
          value={axis?.labelRotate || 0}
          onChange={(e) => updateAxis(axisKey, 'labelRotate', Number(e.target.value))}
          style={{ flex: 1 }}
        />
        <span style={styles.rangeValue}>{axis?.labelRotate || 0}°</span>
      </FieldRow>
      <FieldRow label={t('chart.visual.labelFontSize')}>
        <input
          type="number" min={8} max={24}
          value={axis?.labelFontSize || 12}
          onChange={(e) => updateAxis(axisKey, 'labelFontSize', Number(e.target.value))}
          style={styles.numberInput}
        />
        <span style={styles.unit}>px</span>
      </FieldRow>
      <FieldRow label={t('chart.visual.labelColor')}>
        <input
          type="color"
          value={axis?.labelColor || '#666666'}
          onChange={(e) => updateAxis(axisKey, 'labelColor', e.target.value)}
          style={styles.colorPicker}
        />
      </FieldRow>
      <FieldRow label={t('chart.visual.showGrid')}>
        <ToggleSwitch
          checked={axis?.showGrid ?? true}
          onChange={(v) => updateAxis(axisKey, 'showGrid', v)}
        />
      </FieldRow>
      <FieldRow label={t('chart.visual.inverse')}>
        <ToggleSwitch
          checked={axis?.inverse ?? false}
          onChange={(v) => updateAxis(axisKey, 'inverse', v)}
        />
      </FieldRow>
      <FieldRow label={t('chart.visual.min')}>
        <input
          type="text"
          value={axis?.min !== undefined && axis?.min !== 'auto' ? String(axis.min) : ''}
          onChange={(e) => {
            const v = e.target.value;
            updateAxis(axisKey, 'min', v === '' ? 'auto' : (isNaN(Number(v)) ? v : Number(v)));
          }}
          placeholder="auto"
          style={styles.numberInput}
        />
      </FieldRow>
      <FieldRow label={t('chart.visual.max')}>
        <input
          type="text"
          value={axis?.max !== undefined && axis?.max !== 'auto' ? String(axis.max) : ''}
          onChange={(e) => {
            const v = e.target.value;
            updateAxis(axisKey, 'max', v === '' ? 'auto' : (isNaN(Number(v)) ? v : Number(v)));
          }}
          placeholder="auto"
          style={styles.numberInput}
        />
      </FieldRow>
    </div>
  );

  return (
    <div style={styles.panelSection}>
      {renderAxis('xAxis', xAxis)}
      {renderAxis('yAxis', yAxis)}
    </div>
  );
};

const LabelsPanel: React.FC<PanelProps> = ({ value, updateField }) => {
  const { t } = useLocale();
  const label = value.label;

  const toggleFormat = (fmt: 'name' | 'value' | 'percent') => {
    const current = label?.format || [];
    const next = current.includes(fmt)
      ? current.filter(f => f !== fmt)
      : [...current, fmt];
    updateField('label', { ...label, format: next });
  };

  return (
    <div style={styles.panelSection}>
      <FieldRow label={t('chart.visual.showLabel')}>
        <ToggleSwitch
          checked={label?.show ?? false}
          onChange={(v) => updateField('label', { ...label, show: v })}
        />
      </FieldRow>
      <FieldRow label={t('chart.visual.labelPosition')}>
        <select
          value={label?.position || 'top'}
          onChange={(e) => updateField('label', { ...label, position: e.target.value as 'top' | 'bottom' | 'left' | 'right' | 'inside' | 'outside' | 'center' })}
          style={styles.select}
        >
          <option value="top">{t('chart.visual.posTop')}</option>
          <option value="bottom">{t('chart.visual.posBottom')}</option>
          <option value="left">{t('chart.visual.posLeft')}</option>
          <option value="right">{t('chart.visual.posRight')}</option>
          <option value="inside">{t('chart.visual.posInside')}</option>
          <option value="outside">{t('chart.visual.posOutside')}</option>
          <option value="center">{t('chart.visual.posCenter')}</option>
        </select>
      </FieldRow>
      <FieldRow label={t('chart.visual.labelFormat')}>
        <div style={styles.formatChips}>
          {(['name', 'value', 'percent'] as const).map((fmt) => (
            <button
              key={fmt}
              type="button"
              onClick={() => toggleFormat(fmt)}
              style={{
                ...styles.formatChip,
                ...((label?.format || []).includes(fmt) ? styles.formatChipActive : {}),
              }}
            >
              {t(`chart.visual.fmt_${fmt}`)}
            </button>
          ))}
        </div>
      </FieldRow>
      <FieldRow label={t('chart.visual.labelFontSize')}>
        <input
          type="number" min={8} max={32}
          value={label?.fontSize || 12}
          onChange={(e) => updateField('label', { ...label, fontSize: Number(e.target.value) })}
          style={styles.numberInput}
        />
        <span style={styles.unit}>px</span>
      </FieldRow>
      <FieldRow label={t('chart.visual.labelColor')}>
        <input
          type="color"
          value={label?.color || '#666666'}
          onChange={(e) => updateField('label', { ...label, color: e.target.value })}
          style={styles.colorPicker}
        />
      </FieldRow>
    </div>
  );
};

const GridPanel: React.FC<PanelProps> = ({ value, updateField }) => {
  const { t } = useLocale();
  const grid = value.grid;

  return (
    <div style={styles.panelSection}>
      <FieldRow label={t('chart.visual.showGrid')}>
        <ToggleSwitch
          checked={grid?.show ?? true}
          onChange={(v) => updateField('grid', { ...grid, show: v })}
        />
      </FieldRow>
      <FieldRow label="Left">
        <input type="text" value={grid?.left || ''} onChange={(e) => updateField('grid', { ...grid, left: e.target.value })} placeholder="10%" style={styles.numberInput} />
      </FieldRow>
      <FieldRow label="Right">
        <input type="text" value={grid?.right || ''} onChange={(e) => updateField('grid', { ...grid, right: e.target.value })} placeholder="5%" style={styles.numberInput} />
      </FieldRow>
      <FieldRow label="Top">
        <input type="text" value={grid?.top || ''} onChange={(e) => updateField('grid', { ...grid, top: e.target.value })} placeholder="60px" style={styles.numberInput} />
      </FieldRow>
      <FieldRow label="Bottom">
        <input type="text" value={grid?.bottom || ''} onChange={(e) => updateField('grid', { ...grid, bottom: e.target.value })} placeholder="8%" style={styles.numberInput} />
      </FieldRow>
    </div>
  );
};

const AnimationPanel: React.FC<PanelProps> = ({ value, updateField }) => {
  const { t } = useLocale();
  const anim = value.animation;

  return (
    <div style={styles.panelSection}>
      <FieldRow label={t('chart.visual.showAnimation')}>
        <ToggleSwitch
          checked={anim?.show ?? true}
          onChange={(v) => updateField('animation', { ...anim, show: v })}
        />
      </FieldRow>
      <FieldRow label={t('chart.visual.duration')}>
        <input
          type="number" min={0} max={5000} step={100}
          value={anim?.duration || 1000}
          onChange={(e) => updateField('animation', { ...anim, duration: Number(e.target.value) })}
          style={styles.numberInput}
        />
        <span style={styles.unit}>ms</span>
      </FieldRow>
    </div>
  );
};

const TooltipPanel: React.FC<PanelProps> = ({ value, updateField }) => {
  const { t } = useLocale();
  const tip = value.tooltip;

  return (
    <div style={styles.panelSection}>
      <FieldRow label={t('chart.visual.showTooltip')}>
        <ToggleSwitch
          checked={tip?.show ?? true}
          onChange={(v) => updateField('tooltip', { ...tip, show: v })}
        />
      </FieldRow>
      <FieldRow label={t('chart.visual.trigger')}>
        <select
          value={tip?.trigger || 'item'}
          onChange={(e) => updateField('tooltip', { ...tip, trigger: e.target.value as 'item' | 'axis' | 'none' })}
          style={styles.select}
        >
          <option value="item">{t('chart.visual.triggerItem')}</option>
          <option value="axis">{t('chart.visual.triggerAxis')}</option>
          <option value="none">{t('chart.visual.triggerNone')}</option>
        </select>
      </FieldRow>
    </div>
  );
};

const FieldRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={styles.fieldRow}>
    <span style={styles.fieldLabel}>{label}</span>
    <div style={styles.fieldControl}>{children}</div>
  </div>
);

const ToggleSwitch: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
  <label style={styles.switch}>
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span style={{
      ...styles.switchSlider,
      ...(checked ? styles.switchSliderOn : {}),
    }} />
  </label>
);

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  tabsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    padding: '8px',
    background: 'var(--bg-secondary)',
    borderRadius: '6px',
    marginBottom: '8px',
  },
  tabBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    padding: '4px 8px',
    fontSize: '11px',
    border: '1px solid var(--border-primary)',
    borderRadius: '4px',
    background: 'var(--bg-primary)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    // 每行内等宽拉伸填满容器：避免末行按钮数量少时短且左对齐（2026-10-23 用户反馈）
    flex: '1 1 auto',
  },
  tabBtnActive: {
    background: 'var(--primary)',
    color: 'white',
    borderColor: 'var(--primary)',
  },
  tabIcon: { fontSize: '12px' },
  tabLabel: { fontSize: '11px' },
  tabContent: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 4px',
  },
  panelSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  subSectionTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: '4px',
  },
  swatchGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '6px',
  },
  swatchItem: {
    height: '24px',
    border: '2px solid var(--border-primary)',
    borderRadius: '4px',
    cursor: 'pointer',
    padding: 0,
  },
  swatchItemSelected: {
    borderColor: 'var(--primary)',
    boxShadow: '0 0 0 1px var(--primary)',
  },
  seriesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  seriesRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 8px',
    background: 'var(--bg-secondary)',
    borderRadius: '4px',
  },
  seriesName: {
    flex: 1,
    fontSize: '12px',
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  colorPicker: {
    width: '32px',
    height: '24px',
    padding: 0,
    border: '1px solid var(--border-primary)',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  colorHex: {
    fontSize: '11px',
    color: 'var(--text-tertiary)',
    fontFamily: 'monospace',
  },
  fieldRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  fieldLabel: {
    fontSize: '12px',
    color: 'var(--text-tertiary)',
    width: '100px',
    flexShrink: 0,
  },
  fieldControl: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  fullWidthInput: {
    flex: 1,
    padding: '4px 8px',
    fontSize: '12px',
    border: '1px solid var(--border-primary)',
    borderRadius: '4px',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    minWidth: 0,
  },
  numberInput: {
    padding: '4px 8px',
    fontSize: '12px',
    border: '1px solid var(--border-primary)',
    borderRadius: '4px',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    width: '60px',
  },
  select: {
    padding: '4px 8px',
    fontSize: '12px',
    border: '1px solid var(--border-primary)',
    borderRadius: '4px',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
  },
  unit: {
    fontSize: '11px',
    color: 'var(--text-tertiary)',
  },
  rangeValue: {
    fontSize: '11px',
    color: 'var(--text-tertiary)',
    minWidth: '36px',
    textAlign: 'right',
  },
  formatChips: {
    display: 'flex',
    gap: '4px',
  },
  formatChip: {
    padding: '3px 10px',
    fontSize: '11px',
    border: '1px solid var(--border-primary)',
    borderRadius: '12px',
    background: 'var(--bg-primary)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
  formatChipActive: {
    background: 'var(--primary)',
    color: 'white',
    borderColor: 'var(--primary)',
  },
  axisBlock: {
    padding: '8px',
    background: 'var(--bg-secondary)',
    borderRadius: '6px',
    marginBottom: '8px',
  },
  axisTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '6px',
  },
  switch: {
    position: 'relative',
    display: 'inline-block',
    width: '36px',
    height: '20px',
    cursor: 'pointer',
  },
  switchSlider: {
    position: 'absolute',
    inset: 0,
    background: 'var(--border-primary)',
    borderRadius: '20px',
    transition: '0.2s',
  },
  switchSliderOn: {
    background: 'var(--primary)',
  },
};

export default ChartVisualFullEditor;
import React, { useState, useCallback } from 'react';
import type { VisualConfig, AxisVisualConfig } from '../../types/chart';
import { useLocale } from '../../context/LocaleContext';

interface ChartStyleAdvancedPanelProps {
  value: VisualConfig;
  onChange: (config: VisualConfig) => void;
}

export const ChartStyleAdvancedPanel: React.FC<ChartStyleAdvancedPanelProps> = ({ value, onChange }) => {
  const { t } = useLocale();
  const [collapsed, setCollapsed] = useState(true);

  const updateField = useCallback(<K extends keyof VisualConfig>(key: K, val: VisualConfig[K]) => {
    onChange({ ...value, [key]: val });
  }, [value, onChange]);

  const updateAxisField = useCallback(
    (axisKey: 'xAxis' | 'yAxis', field: keyof AxisVisualConfig, val: unknown) => {
      onChange({
        ...value,
        [axisKey]: {
          ...value[axisKey],
          [field]: val,
        },
      });
    },
    [value, onChange]
  );

  const axisField = value.xAxis;
  const axisFieldY = value.yAxis;
  const titleConfig = value.title;
  const legendConfig = value.legend;
  const gridConfig = value.grid;
  const labelConfig = value.label;
  const animationConfig = value.animation;
  const tooltipConfig = value.tooltip;

  return (
    <div style={styles.container}>
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        style={styles.toggleHeader}
      >
        <span style={styles.toggleIcon}>{collapsed ? '▶' : '▼'}</span>
        <span style={styles.toggleText}>{t('chart.visual.advanced')}</span>
      </button>

      {!collapsed && (
        <div style={styles.content}>
          <Section title={t('chart.visual.title')}>
            <Row label={t('chart.visual.titleText')}>
              <input
                type="text"
                value={titleConfig?.text || ''}
                onChange={(e) => updateField('title', { ...titleConfig, text: e.target.value })}
                placeholder={t('chart.visual.titlePlaceholder')}
                style={styles.wideInput}
              />
            </Row>
            <Row label={t('chart.visual.titlePosition')}>
              <select
                value={titleConfig?.position || 'top'}
                onChange={(e) => updateField('title', { ...titleConfig, position: e.target.value as VisualConfig['title'] extends object ? VisualConfig['title'] extends { position?: infer P } ? P : never : never })}
                style={styles.select}
              >
                <option value="top">{t('chart.visual.posTop')}</option>
                <option value="bottom">{t('chart.visual.posBottom')}</option>
                <option value="left">{t('chart.visual.posLeft')}</option>
                <option value="right">{t('chart.visual.posRight')}</option>
                <option value="center">{t('chart.visual.posCenter')}</option>
              </select>
            </Row>
            <Row label={t('chart.visual.titleFontSize')}>
              <input
                type="number"
                min={8}
                max={48}
                value={titleConfig?.fontSize || 14}
                onChange={(e) => updateField('title', { ...titleConfig, fontSize: Number(e.target.value) })}
                style={styles.numberInput}
              />
              <span style={styles.unit}>px</span>
            </Row>
            <Row label={t('chart.visual.titleColor')}>
              <input
                type="color"
                value={titleConfig?.color || '#333333'}
                onChange={(e) => updateField('title', { ...titleConfig, color: e.target.value })}
                style={styles.colorInput}
              />
            </Row>
          </Section>

          <Section title={t('chart.visual.legend')}>
            <Row label={t('chart.visual.showLegend')}>
              <label style={styles.switch}>
                <input
                  type="checkbox"
                  checked={legendConfig?.show ?? true}
                  onChange={(e) => updateField('legend', { ...legendConfig, show: e.target.checked })}
                />
                <span style={styles.switchSlider} />
              </label>
            </Row>
            <Row label={t('chart.visual.legendOrient')}>
              <select
                value={legendConfig?.orient || 'horizontal'}
                onChange={(e) => updateField('legend', { ...legendConfig, orient: e.target.value as 'horizontal' | 'vertical' })}
                style={styles.select}
              >
                <option value="horizontal">{t('chart.visual.orientHorizontal')}</option>
                <option value="vertical">{t('chart.visual.orientVertical')}</option>
              </select>
            </Row>
          </Section>

          <Section title={t('chart.visual.axis')}>
            <div style={styles.axisBlock}>
              <div style={styles.axisTitle}>X {t('chart.visual.axis')}</div>
              <Row label={t('chart.visual.showAxis')}>
                <label style={styles.switch}>
                  <input
                    type="checkbox"
                    checked={axisField?.show ?? true}
                    onChange={(e) => updateAxisField('xAxis', 'show', e.target.checked)}
                  />
                  <span style={styles.switchSlider} />
                </label>
              </Row>
              <Row label={t('chart.visual.axisTitle')}>
                <input
                  type="text"
                  value={axisField?.title?.text || ''}
                  onChange={(e) => updateAxisField('xAxis', 'title', { ...axisField?.title, text: e.target.value })}
                  placeholder={t('chart.visual.axisTitlePlaceholder')}
                  style={styles.wideInput}
                />
              </Row>
              <Row label={t('chart.visual.labelRotate')}>
                <input
                  type="range"
                  min={-90}
                  max={90}
                  value={axisField?.labelRotate || 0}
                  onChange={(e) => updateAxisField('xAxis', 'labelRotate', Number(e.target.value))}
                />
                <span style={styles.rangeValue}>{axisField?.labelRotate || 0}°</span>
              </Row>
              <Row label={t('chart.visual.showGrid')}>
                <label style={styles.switch}>
                  <input
                    type="checkbox"
                    checked={axisField?.showGrid ?? true}
                    onChange={(e) => updateAxisField('xAxis', 'showGrid', e.target.checked)}
                  />
                  <span style={styles.switchSlider} />
                </label>
              </Row>
              <Row label={t('chart.visual.inverse')}>
                <label style={styles.switch}>
                  <input
                    type="checkbox"
                    checked={axisField?.inverse ?? false}
                    onChange={(e) => updateAxisField('xAxis', 'inverse', e.target.checked)}
                  />
                  <span style={styles.switchSlider} />
                </label>
              </Row>
            </div>

            <div style={styles.axisBlock}>
              <div style={styles.axisTitle}>Y {t('chart.visual.axis')}</div>
              <Row label={t('chart.visual.showAxis')}>
                <label style={styles.switch}>
                  <input
                    type="checkbox"
                    checked={axisFieldY?.show ?? true}
                    onChange={(e) => updateAxisField('yAxis', 'show', e.target.checked)}
                  />
                  <span style={styles.switchSlider} />
                </label>
              </Row>
              <Row label={t('chart.visual.axisTitle')}>
                <input
                  type="text"
                  value={axisFieldY?.title?.text || ''}
                  onChange={(e) => updateAxisField('yAxis', 'title', { ...axisFieldY?.title, text: e.target.value })}
                  placeholder={t('chart.visual.axisTitlePlaceholder')}
                  style={styles.wideInput}
                />
              </Row>
              <Row label={t('chart.visual.labelRotate')}>
                <input
                  type="range"
                  min={-90}
                  max={90}
                  value={axisFieldY?.labelRotate || 0}
                  onChange={(e) => updateAxisField('yAxis', 'labelRotate', Number(e.target.value))}
                />
                <span style={styles.rangeValue}>{axisFieldY?.labelRotate || 0}°</span>
              </Row>
              <Row label={t('chart.visual.showGrid')}>
                <label style={styles.switch}>
                  <input
                    type="checkbox"
                    checked={axisFieldY?.showGrid ?? true}
                    onChange={(e) => updateAxisField('yAxis', 'showGrid', e.target.checked)}
                  />
                  <span style={styles.switchSlider} />
                </label>
              </Row>
              <Row label={t('chart.visual.inverse')}>
                <label style={styles.switch}>
                  <input
                    type="checkbox"
                    checked={axisFieldY?.inverse ?? false}
                    onChange={(e) => updateAxisField('yAxis', 'inverse', e.target.checked)}
                  />
                  <span style={styles.switchSlider} />
                </label>
              </Row>
            </div>
          </Section>

          <Section title={t('chart.visual.label')}>
            <Row label={t('chart.visual.showLabel')}>
              <label style={styles.switch}>
                <input
                  type="checkbox"
                  checked={labelConfig?.show ?? false}
                  onChange={(e) => updateField('label', { ...labelConfig, show: e.target.checked })}
                />
                <span style={styles.switchSlider} />
              </label>
            </Row>
            <Row label={t('chart.visual.labelPosition')}>
              <select
                value={labelConfig?.position || 'top'}
                onChange={(e) => updateField('label', { ...labelConfig, position: e.target.value as VisualConfig['label'] extends object ? VisualConfig['label'] extends { position?: infer P } ? P : never : never })}
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
            </Row>
            <Row label={t('chart.visual.labelFontSize')}>
              <input
                type="number"
                min={8}
                max={32}
                value={labelConfig?.fontSize || 12}
                onChange={(e) => updateField('label', { ...labelConfig, fontSize: Number(e.target.value) })}
                style={styles.numberInput}
              />
              <span style={styles.unit}>px</span>
            </Row>
            <Row label={t('chart.visual.labelColor')}>
              <input
                type="color"
                value={labelConfig?.color || '#666666'}
                onChange={(e) => updateField('label', { ...labelConfig, color: e.target.value })}
                style={styles.colorInput}
              />
            </Row>
          </Section>

          <Section title={t('chart.visual.grid')}>
            <Row label={t('chart.visual.showGrid')}>
              <label style={styles.switch}>
                <input
                  type="checkbox"
                  checked={gridConfig?.show ?? true}
                  onChange={(e) => updateField('grid', { ...gridConfig, show: e.target.checked })}
                />
                <span style={styles.switchSlider} />
              </label>
            </Row>
            <Row label="Left">
              <input
                type="text"
                value={gridConfig?.left || ''}
                onChange={(e) => updateField('grid', { ...gridConfig, left: e.target.value })}
                placeholder="10%"
                style={styles.numberInput}
              />
            </Row>
            <Row label="Right">
              <input
                type="text"
                value={gridConfig?.right || ''}
                onChange={(e) => updateField('grid', { ...gridConfig, right: e.target.value })}
                placeholder="5%"
                style={styles.numberInput}
              />
            </Row>
            <Row label="Top">
              <input
                type="text"
                value={gridConfig?.top || ''}
                onChange={(e) => updateField('grid', { ...gridConfig, top: e.target.value })}
                placeholder="60px"
                style={styles.numberInput}
              />
            </Row>
            <Row label="Bottom">
              <input
                type="text"
                value={gridConfig?.bottom || ''}
                onChange={(e) => updateField('grid', { ...gridConfig, bottom: e.target.value })}
                placeholder="8%"
                style={styles.numberInput}
              />
            </Row>
          </Section>

          <Section title={t('chart.visual.animation')}>
            <Row label={t('chart.visual.showAnimation')}>
              <label style={styles.switch}>
                <input
                  type="checkbox"
                  checked={animationConfig?.show ?? true}
                  onChange={(e) => updateField('animation', { ...animationConfig, show: e.target.checked })}
                />
                <span style={styles.switchSlider} />
              </label>
            </Row>
            <Row label={t('chart.visual.duration')}>
              <input
                type="number"
                min={0}
                max={5000}
                step={100}
                value={animationConfig?.duration || 1000}
                onChange={(e) => updateField('animation', { ...animationConfig, duration: Number(e.target.value) })}
                style={styles.numberInput}
              />
              <span style={styles.unit}>ms</span>
            </Row>
          </Section>

          <Section title={t('chart.visual.tooltip')}>
            <Row label={t('chart.visual.showTooltip')}>
              <label style={styles.switch}>
                <input
                  type="checkbox"
                  checked={tooltipConfig?.show ?? true}
                  onChange={(e) => updateField('tooltip', { ...tooltipConfig, show: e.target.checked })}
                />
                <span style={styles.switchSlider} />
              </label>
            </Row>
            <Row label={t('chart.visual.trigger')}>
              <select
                value={tooltipConfig?.trigger || 'item'}
                onChange={(e) => updateField('tooltip', { ...tooltipConfig, trigger: e.target.value as 'item' | 'axis' | 'none' })}
                style={styles.select}
              >
                <option value="item">{t('chart.visual.triggerItem')}</option>
                <option value="axis">{t('chart.visual.triggerAxis')}</option>
                <option value="none">{t('chart.visual.triggerNone')}</option>
              </select>
            </Row>
          </Section>
        </div>
      )}
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={styles.section}>
    <div style={styles.sectionTitle}>{title}</div>
    <div style={styles.sectionContent}>{children}</div>
  </div>
);

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={styles.row}>
    <span style={styles.rowLabel}>{label}</span>
    <div style={styles.rowControl}>{children}</div>
  </div>
);

const styles: Record<string, React.CSSProperties> = {
  container: {
    borderTop: '1px solid var(--border-primary)',
    marginTop: '8px',
  },
  toggleHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    background: 'var(--bg-secondary)',
    border: 'none',
    cursor: 'pointer',
    width: '100%',
    fontSize: '13px',
    color: 'var(--text-primary)',
    fontWeight: 500,
  },
  toggleIcon: {
    fontSize: '10px',
    transition: 'transform 0.2s',
  },
  toggleText: {
    flex: 1,
    textAlign: 'left',
  },
  content: {
    padding: '8px 16px 16px',
    maxHeight: '400px',
    overflowY: 'auto',
  },
  section: {
    marginBottom: '12px',
  },
  sectionTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: '6px',
    paddingBottom: '4px',
    borderBottom: '1px solid var(--border-primary)',
  },
  sectionContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  rowLabel: {
    fontSize: '12px',
    color: 'var(--text-tertiary)',
    width: '90px',
    flexShrink: 0,
  },
  rowControl: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  wideInput: {
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
  colorInput: {
    width: '32px',
    height: '24px',
    padding: 0,
    border: '1px solid var(--border-primary)',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  unit: {
    fontSize: '11px',
    color: 'var(--text-tertiary)',
  },
  rangeValue: {
    fontSize: '11px',
    color: 'var(--text-tertiary)',
    minWidth: '40px',
    textAlign: 'right',
  },
  axisBlock: {
    padding: '6px 8px',
    background: 'var(--bg-secondary)',
    borderRadius: '4px',
    marginBottom: '6px',
  },
  axisTitle: {
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--text-primary)',
    marginBottom: '4px',
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
    backgroundColor: 'var(--border-primary)',
    borderRadius: '20px',
    transition: '0.2s',
  },
};

export default ChartStyleAdvancedPanel;
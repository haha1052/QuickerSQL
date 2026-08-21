/**
 * DashboardToolbarCanvasSettings — 仪表盘画布设置弹窗子组件
 *
 * 职责：渲染画布设置弹窗（背景设置 / 布局设置 / 画布尺寸），内部管理表单本地编辑态，
 * 点击「应用」时通过 onApply 回传设置。纯展示 + 局部表单状态组件，不直接访问 store。
 * 父组件通过条件挂载（open 为 true 才渲染）保证每次打开都从最新 dashboard 重新初始化表单。
 */
import React, { useState } from 'react';
import { useLocale } from '../../context/LocaleContext';
import type { Dashboard } from '../../types/dashboard';

/** 画布设置数据结构（与父组件 onCanvasSettingsChange 回调签名一致） */
export interface DashboardCanvasSettings {
  backgroundColor?: string;
  backgroundImage?: string;
  canvasWidth?: number;
  canvasHeight?: number;
  padding?: number;
  gridGap?: number;
  rowHeight?: number;
  snapToGrid?: boolean;
}

export interface DashboardToolbarCanvasSettingsProps {
  dashboard: Dashboard;
  onClose: () => void;
  onApply: (settings: DashboardCanvasSettings) => void;
}

export const DashboardToolbarCanvasSettings: React.FC<DashboardToolbarCanvasSettingsProps> = ({ dashboard, onClose, onApply }) => {
  const { t } = useLocale();
  const [bgColor, setBgColor] = useState(dashboard.backgroundColor ?? '');
  const [bgImage, setBgImage] = useState(dashboard.backgroundImage ?? '');
  const [canvasW, setCanvasW] = useState(dashboard.canvasWidth ?? 0);
  const [canvasH, setCanvasH] = useState(dashboard.canvasHeight ?? 0);
  const [padding, setPadding] = useState(dashboard.padding ?? 16);
  const [gridGap, setGridGap] = useState(dashboard.gridGap ?? 16);
  const [rowHeight, setRowHeight] = useState(dashboard.rowHeight ?? 80);
  const [snap, setSnap] = useState(dashboard.snapToGrid ?? true);

  const handleApply = () => onApply({
    backgroundColor: bgColor || undefined,
    backgroundImage: bgImage || undefined,
    canvasWidth: canvasW || undefined,
    canvasHeight: canvasH || undefined,
    padding: padding || undefined,
    gridGap, rowHeight, snapToGrid: snap,
  });

  const sectionTitle = (marginTop: string) => ({ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', marginTop });
  const autoFitHint = t('dashboard.autoFit');

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={{ ...styles.modal, width: '420px' }} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>画布设置</h3>
          <button style={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        <div style={styles.modalContent}>
          <div style={sectionTitle('4px')}>背景设置</div>
          <div style={styles.settingRow}>
            <label style={styles.settingLabel}>背景颜色</label>
            <input type="color" value={bgColor || '#ffffff'} onChange={(e) => setBgColor(e.target.value)} style={styles.colorPicker} />
            <input type="text" value={bgColor} onChange={(e) => setBgColor(e.target.value)} placeholder="#ffffff" style={{ ...styles.input, width: '100px' }} />
          </div>
          <div style={styles.settingRow}>
            <label style={styles.settingLabel}>背景图片 URL</label>
            <input type="text" value={bgImage} onChange={(e) => setBgImage(e.target.value)} placeholder="https://..." style={{ ...styles.input, flex: 1 }} />
          </div>

          <div style={sectionTitle('布局设置')}>布局设置</div>
          <div style={styles.settingRow}>
            <label style={styles.settingLabel}>图表间距 (px)</label>
            <input type="range" min="0" max="32" value={gridGap} onChange={(e) => setGridGap(parseInt(e.target.value))} style={styles.slider} />
            <span style={styles.settingValue}>{gridGap}px</span>
          </div>
          <div style={styles.settingRow}>
            <label style={styles.settingLabel}>行高 (px)</label>
            <input type="range" min="40" max="160" value={rowHeight} onChange={(e) => setRowHeight(parseInt(e.target.value))} style={styles.slider} />
            <span style={styles.settingValue}>{rowHeight}px</span>
          </div>
          <div style={styles.settingRow}>
            <label style={styles.settingLabel}>
              <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} style={styles.checkbox} />磁吸对齐
            </label>
          </div>

          <div style={sectionTitle('画布尺寸')}>画布尺寸</div>
          <div style={styles.settingRow}>
            <label style={styles.settingLabel}>内边距 (px)</label>
            <input type="range" min="0" max="48" value={padding} onChange={(e) => setPadding(parseInt(e.target.value))} style={styles.slider} />
            <span style={styles.settingValue}>{padding}px</span>
          </div>
          <div style={styles.settingRow}>
            <label style={styles.settingLabel}>画布宽度 (px)</label>
            <input type="number" value={canvasW || ''} onChange={(e) => setCanvasW(parseInt(e.target.value) || 0)} placeholder={autoFitHint} style={{ ...styles.input, width: '80px' }} />
            <span style={{ ...styles.settingLabel, fontSize: '11px', color: 'var(--text-tertiary)' }}>{autoFitHint}</span>
          </div>
          <div style={styles.settingRow}>
            <label style={styles.settingLabel}>画布高度 (px)</label>
            <input type="number" value={canvasH || ''} onChange={(e) => setCanvasH(parseInt(e.target.value) || 0)} placeholder={autoFitHint} style={{ ...styles.input, width: '80px' }} />
            <span style={{ ...styles.settingLabel, fontSize: '11px', color: 'var(--text-tertiary)' }}>{autoFitHint}</span>
          </div>
        </div>
        <div style={styles.modalFooter}>
          <button style={styles.cancelBtn} onClick={onClose}>{t('common.cancel')}</button>
          <button style={styles.applyBtn} onClick={handleApply}>应用</button>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: 'var(--bg-primary)', borderRadius: '12px', width: '440px', maxWidth: '90vw', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid var(--border-primary)' },
  modalTitle: { margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' },
  closeBtn: { background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px 8px' },
  modalContent: { padding: '20px' },
  settingRow: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' },
  settingLabel: { fontSize: '13px', color: 'var(--text-primary)', minWidth: '100px' },
  slider: { flex: 1, cursor: 'pointer' },
  colorPicker: { width: '32px', height: '32px', border: '1px solid var(--border-primary)', borderRadius: '4px', cursor: 'pointer', padding: 0 },
  input: { padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--border-primary)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px' },
  settingValue: { fontSize: '12px', color: 'var(--text-secondary)', minWidth: '40px', textAlign: 'right' },
  checkbox: { cursor: 'pointer', marginRight: '8px' },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 24px', borderTop: '1px solid var(--border-primary)' },
  cancelBtn: { padding: '8px 16px', background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' },
  applyBtn: { padding: '8px 16px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' },
};

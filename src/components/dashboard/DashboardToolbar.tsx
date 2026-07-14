import React, { useState } from 'react';
import { useDashboardStore } from '../../store';
import { useLocale } from '../../context/LocaleContext';
import type { Dashboard } from '../../types/dashboard';
import { TaskEditorModal } from '../automation/TaskEditorModal';

interface DashboardToolbarProps {
  dashboard: Dashboard | null;
  isEditing: boolean;
  onToggleEdit: () => void;
  savingLayout?: boolean;
  onDashboardChange: (id: string) => void;
  onToggleLibrary?: () => void;
  libraryOpen?: boolean;
  onExportPng?: () => void;
  onCanvasSettingsChange?: (settings: {
    backgroundColor?: string;
    backgroundImage?: string;
    canvasWidth?: number;
    canvasHeight?: number;
    padding?: number;
    gridGap?: number;
    rowHeight?: number;
    snapToGrid?: boolean;
  }) => void;
  onSave?: () => void;
  isSaving?: boolean;
}

export const DashboardToolbar: React.FC<DashboardToolbarProps> = ({
  dashboard,
  isEditing,
  onToggleEdit,
  savingLayout = false,
  onDashboardChange,
  onToggleLibrary,
  libraryOpen,
  onExportPng,
  onCanvasSettingsChange,
  onSave,
  isSaving = false,
}) => {
  const { t } = useLocale();
  const { dashboards, deleteDashboard, toggleFullscreen, isFullscreen, refreshCharts, createDashboard } = useDashboardStore();
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showCanvasSettings, setShowCanvasSettings] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDashboardName, setNewDashboardName] = useState('');
  const [creating, setCreating] = useState(false);
  // 画布设置状态
  const [localBackgroundColor, setLocalBackgroundColor] = useState(dashboard?.backgroundColor ?? '');
  const [localBackgroundImage, setLocalBackgroundImage] = useState(dashboard?.backgroundImage ?? '');
  const [localCanvasWidth, setLocalCanvasWidth] = useState(dashboard?.canvasWidth ?? 0);
  const [localCanvasHeight, setLocalCanvasHeight] = useState(dashboard?.canvasHeight ?? 0);
  const [localPadding, setLocalPadding] = useState(dashboard?.padding ?? 16);
  const [localGridGap, setLocalGridGap] = useState(dashboard?.gridGap ?? 16);
  const [localRowHeight, setLocalRowHeight] = useState(dashboard?.rowHeight ?? 80);
  const [localSnapToGrid, setLocalSnapToGrid] = useState(dashboard?.snapToGrid ?? true);

  const handleDelete = async () => {
    if (!dashboard) return;
    if (confirm(`确定删除仪表盘 "${dashboard.name}" 吗？`)) {
      await deleteDashboard(dashboard.id);
    }
  };

  const handleCreateDashboard = async () => {
    if (!newDashboardName.trim()) return;
    setCreating(true);
    try {
      const newDash = await createDashboard(newDashboardName.trim());
      if (newDash) {
        onDashboardChange(newDash.id);
        setShowCreateModal(false);
        setNewDashboardName('');
      }
    } finally {
      setCreating(false);
    }
  };

  const handleApplyCanvasSettings = () => {
    onCanvasSettingsChange?.({
      backgroundColor: localBackgroundColor || undefined,
      backgroundImage: localBackgroundImage || undefined,
      canvasWidth: localCanvasWidth || undefined,
      canvasHeight: localCanvasHeight || undefined,
      padding: localPadding || undefined,
      gridGap: localGridGap,
      rowHeight: localRowHeight,
      snapToGrid: localSnapToGrid,
    });
    setShowCanvasSettings(false);
  };

  const handleOpenCanvasSettings = () => {
    // 从 dashboard 同步当前设置
    setLocalBackgroundColor(dashboard?.backgroundColor ?? '');
    setLocalBackgroundImage(dashboard?.backgroundImage ?? '');
    setLocalCanvasWidth(dashboard?.canvasWidth ?? 0);
    setLocalCanvasHeight(dashboard?.canvasHeight ?? 0);
    setLocalPadding(dashboard?.padding ?? 16);
    setLocalGridGap(dashboard?.gridGap ?? 16);
    setLocalRowHeight(dashboard?.rowHeight ?? 80);
    setLocalSnapToGrid(dashboard?.snapToGrid ?? true);
    setShowCanvasSettings(true);
  };

  return (
    <>
      <div style={styles.toolbar}>
      <div style={styles.toolbarLeft}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            style={styles.select}
            value={dashboard?.id || ''}
            onChange={(e) => onDashboardChange(e.target.value)}
          >
            {dashboards.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <button
            style={styles.btn}
            onClick={() => setShowCreateModal(true)}
            title="新建仪表盘"
          >
            ➕ 新建
          </button>
        </div>

        {onToggleLibrary && (
          <button
            style={{
              ...styles.btn,
              ...(libraryOpen ? styles.btnActive : {}),
            }}
            onClick={onToggleLibrary}
            title={t('dashboard.openChartLibrary')}
          >
            📚 {t('chart.chartLibrary')}
          </button>
        )}
      </div>

      <div style={styles.toolbarRight}>
        {dashboard && (
          <>
            <button style={styles.btn} onClick={refreshCharts} title={t('dashboard.refreshAllCharts')}>
              🔄 {t('common.refresh')}
            </button>
            <button
              style={styles.btn}
              onClick={() => setShowScheduleModal(true)}
              title={t('dashboard.scheduleRefresh')}
            >
              ⚡ 定时刷新
            </button>
            {onExportPng && (
              <button
                style={{
                  ...styles.btn,
                  ...(isSaving || savingLayout ? styles.btnDisabled : {}),
                }}
                onClick={onExportPng}
                title={t('dashboard.exportPng')}
              >
                📷 导出
              </button>
            )}
            <button
              style={styles.btn}
              onClick={handleOpenCanvasSettings}
              title={t('dashboard.canvasSettings')}
            >
              ⚙️ 画布
            </button>
            {onSave && (
              <button
                style={{
                  ...styles.btn,
                  ...((isSaving || savingLayout) ? styles.btnDisabled : {}),
                }}
                onClick={onSave}
                disabled={isSaving || savingLayout}
                title="保存仪表盘 (Ctrl+S)"
              >
                {isSaving ? '⏳ 保存中...' : '💾 保存'}
              </button>
            )}
            <button
              style={{
                ...styles.btn,
                ...(isEditing ? styles.btnActive : {}),
              }}
              onClick={onToggleEdit}
              disabled={savingLayout}
            >
              {savingLayout ? '⏳ 保存中...' : (isEditing ? '✅ 保存布局' : '📝 编辑')}
            </button>
            <button style={styles.btn} onClick={toggleFullscreen}>
              {isFullscreen ? '🗗 退出全屏' : '🗖 全屏'}
            </button>
            <button
              style={styles.btnDanger}
              onClick={handleDelete}
              title={t('dashboard.deleteDashboard')}
            >
              🗑
            </button>
          </>
        )}
      </div>
    </div>
    <TaskEditorModal
        open={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        initialTaskType="refresh_dashboard"
        initialPayload={{ dashboardId: (dashboard?.id || '').toString() }}
        initialName={'定时刷新仪表盘: ' + (dashboard?.name || '')}
      />

      {/* 新建仪表盘弹窗 */}
      {showCreateModal && (
        <div
          style={styles.modalOverlay}
          onClick={() => !creating && setShowCreateModal(false)}
        >
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>{t('dashboard.createDashboard')}</h3>
              <button
                style={styles.modalCloseBtn}
                onClick={() => !creating && setShowCreateModal(false)}
                disabled={creating}
              >
                ×
              </button>
            </div>
            <div style={styles.modalBody}>
              <label style={styles.modalLabel}>{t('dashboard.dashboardName')} *</label>
              <input
                style={styles.modalInput}
                value={newDashboardName}
                onChange={(e) => setNewDashboardName(e.target.value)}
                placeholder={t('dashboard.namePlaceholder')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateDashboard();
                  } else if (e.key === 'Escape') {
                    if (!creating) setShowCreateModal(false);
                  }
                }}
                autoFocus
                disabled={creating}
              />
            </div>
            <div style={styles.modalFooter}>
              <button
                style={styles.modalCancelBtn}
                onClick={() => setShowCreateModal(false)}
                disabled={creating}
              >
                {t('common.cancel')}
              </button>
              <button
                style={{
                  ...styles.modalConfirmBtn,
                  opacity: creating || !newDashboardName.trim() ? 0.6 : 1,
                  cursor: creating || !newDashboardName.trim() ? 'not-allowed' : 'pointer',
                }}
                onClick={handleCreateDashboard}
                disabled={creating || !newDashboardName.trim()}
              >
                {creating ? t('common.creating') : t('common.create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 画布设置弹窗 */}
      {showCanvasSettings && (
        <div style={styles.modalOverlay} onClick={() => setShowCanvasSettings(false)}>
          <div style={{ ...styles.modal, width: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>画布设置</h3>
              <button style={styles.closeBtn} onClick={() => setShowCanvasSettings(false)}>×</button>
            </div>
            <div style={styles.modalContent}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', marginTop: '4px' }}>背景设置</div>
              <div style={styles.settingRow}>
                <label style={styles.settingLabel}>背景颜色</label>
                <input
                  type="color"
                  value={localBackgroundColor || '#ffffff'}
                  onChange={(e) => setLocalBackgroundColor(e.target.value)}
                  style={styles.colorPicker}
                />
                <input
                  type="text"
                  value={localBackgroundColor}
                  onChange={(e) => setLocalBackgroundColor(e.target.value)}
                  placeholder="#ffffff"
                  style={{ ...styles.input, width: '100px' }}
                />
              </div>
              <div style={styles.settingRow}>
                <label style={styles.settingLabel}>背景图片 URL</label>
                <input
                  type="text"
                  value={localBackgroundImage}
                  onChange={(e) => setLocalBackgroundImage(e.target.value)}
                  placeholder="https://..."
                  style={{ ...styles.input, flex: 1 }}
                />
              </div>

              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', marginTop: '16px' }}>布局设置</div>
              <div style={styles.settingRow}>
                <label style={styles.settingLabel}>图表间距 (px)</label>
                <input
                  type="range"
                  min="0"
                  max="32"
                  value={localGridGap}
                  onChange={(e) => setLocalGridGap(parseInt(e.target.value))}
                  style={styles.slider}
                />
                <span style={styles.settingValue}>{localGridGap}px</span>
              </div>
              <div style={styles.settingRow}>
                <label style={styles.settingLabel}>行高 (px)</label>
                <input
                  type="range"
                  min="40"
                  max="160"
                  value={localRowHeight}
                  onChange={(e) => setLocalRowHeight(parseInt(e.target.value))}
                  style={styles.slider}
                />
                <span style={styles.settingValue}>{localRowHeight}px</span>
              </div>
              <div style={styles.settingRow}>
                <label style={styles.settingLabel}>
                  <input
                    type="checkbox"
                    checked={localSnapToGrid}
                    onChange={(e) => setLocalSnapToGrid(e.target.checked)}
                    style={styles.checkbox}
                  />
                  磁吸对齐
                </label>
              </div>

              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', marginTop: '16px' }}>画布尺寸</div>
              <div style={styles.settingRow}>
                <label style={styles.settingLabel}>内边距 (px)</label>
                <input
                  type="range"
                  min="0"
                  max="48"
                  value={localPadding}
                  onChange={(e) => setLocalPadding(parseInt(e.target.value))}
                  style={styles.slider}
                />
                <span style={styles.settingValue}>{localPadding}px</span>
              </div>
              <div style={styles.settingRow}>
                <label style={styles.settingLabel}>画布宽度 (px)</label>
                <input
                  type="number"
                  value={localCanvasWidth || ''}
                  onChange={(e) => setLocalCanvasWidth(parseInt(e.target.value) || 0)}
                  placeholder={t('dashboard.autoFit')}
                  style={{ ...styles.input, width: '80px' }}
                />
                <span style={{ ...styles.settingLabel, fontSize: '11px', color: 'var(--text-tertiary)' }}>{t('dashboard.autoFit')}</span>
              </div>
              <div style={styles.settingRow}>
                <label style={styles.settingLabel}>画布高度 (px)</label>
                <input
                  type="number"
                  value={localCanvasHeight || ''}
                  onChange={(e) => setLocalCanvasHeight(parseInt(e.target.value) || 0)}
                  placeholder={t('dashboard.autoFit')}
                  style={{ ...styles.input, width: '80px' }}
                />
                <span style={{ ...styles.settingLabel, fontSize: '11px', color: 'var(--text-tertiary)' }}>{t('dashboard.autoFit')}</span>
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button style={styles.cancelBtn} onClick={() => setShowCanvasSettings(false)}>{t('common.cancel')}</button>
              <button style={styles.applyBtn} onClick={handleApplyCanvasSettings}>应用</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const styles: Record<string, React.CSSProperties> = {
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border-primary)',
    gap: '16px',
  },
  toolbarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  toolbarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  select: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: '1px solid var(--border-primary)',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontSize: '13px',
    cursor: 'pointer',
    minWidth: '150px',
  },
  btn: {
    padding: '6px 12px',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-primary)',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  btnDanger: {
    padding: '6px 10px',
    background: 'transparent',
    color: 'var(--error)',
    border: '1px solid var(--border-primary)',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  btnActive: {
    background: 'var(--primary)',
    color: 'white',
    borderColor: 'var(--primary)',
  },
  btnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: 'var(--bg-primary)',
    borderRadius: '12px',
    width: '440px',
    maxWidth: '90vw',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
    overflow: 'hidden',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '18px 24px',
    borderBottom: '1px solid var(--border-primary)',
  },
  modalTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  modalCloseBtn: {
    background: 'none',
    border: 'none',
    fontSize: '22px',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    padding: '4px 8px',
    lineHeight: 1,
    borderRadius: '4px',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    padding: '4px 8px',
  },
  modalBody: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  modalLabel: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  modalInput: {
    padding: '10px 14px',
    border: '1px solid var(--border-primary)',
    borderRadius: '8px',
    fontSize: '14px',
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    outline: 'none',
  },
  modalContent: {
    padding: '20px',
  },
  settingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
  },
  settingLabel: {
    fontSize: '13px',
    color: 'var(--text-primary)',
    minWidth: '100px',
  },
  slider: {
    flex: 1,
    cursor: 'pointer',
  },
  colorPicker: {
    width: '32px',
    height: '32px',
    border: '1px solid var(--border-primary)',
    borderRadius: '4px',
    cursor: 'pointer',
    padding: 0,
  },
  input: {
    padding: '6px 10px',
    borderRadius: '4px',
    border: '1px solid var(--border-primary)',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontSize: '13px',
  },
  settingValue: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    minWidth: '40px',
    textAlign: 'right',
  },
  checkbox: {
    cursor: 'pointer',
    marginRight: '8px',
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    padding: '16px 24px',
    borderTop: '1px solid var(--border-primary)',
  },
  modalCancelBtn: {
    padding: '8px 20px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: '8px',
    cursor: 'pointer',
    color: 'var(--text-primary)',
    fontSize: '14px',
  },
  modalConfirmBtn: {
    padding: '8px 20px',
    background: 'var(--primary)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
  },
  cancelBtn: {
    padding: '8px 16px',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-primary)',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  applyBtn: {
    padding: '8px 16px',
    background: 'var(--primary)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
  },
};
